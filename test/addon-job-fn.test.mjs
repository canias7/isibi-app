// THE JOB DESIGNER NAMES ONLY A FUNCTION THAT EXISTS (2026-10-22, live
// `no-job-fn`).
//
// Each add-on kind is its own model call, and the `job` designer runs after
// the `function` designer. Its instruction used to say the function could be
// "one you are declaring in this same change", but the job tool has no field
// to declare a function in: a weekly job was designed naming a counting
// function nobody wrote, and `cleanAdd` refused it `no-job-fn`. The rule now
// says the name must be on the listed functions a job may run (which already
// include the ones declared a step earlier), that it cannot declare one, and
// what to do when none fits.
//
//   AJF1  the job rule: no "declaring in this same change"; names the list; says
//         it cannot declare one; says what to do when none fits
//   AJF2  the note it is shown still prints that list (the observer is alive)
import test from "node:test";
import assert from "node:assert/strict";
import { addRule, siteNote } from "../builder/site-add.mjs";

test("AJF1 THE JOB RULE NEVER INVITES A FUNCTION IT CANNOT DECLARE — the name must be on the listed functions a job may run, and none fitting is said, not invented", () => {
  const rule = addRule("job");
  assert.ok(typeof rule === "string" && rule.length > 200, "the job rule was not read");
  assert.ok(/scheduled job/i.test(rule), "the job rule was not read");
  assert.ok(!/declaring in this same change/.test(rule), "the job designer is still told it may declare the function itself");
  assert.match(rule, /list of functions a scheduled job may run/, "the job designer is not pointed at the list it may name from");
  assert.match(rule, /cannot declare a function here/, "the job designer is not told it cannot declare a function");
  assert.match(rule, /when none fits, design no job/, "the job designer is not told what to do when no function fits");
  assert.match(rule, /no such list is printed there is none/, "an empty list is not said to mean none");
});

test("AJF2 THE LIST THE RULE POINTS AT IS PRINTED IN THE NOTE", () => {
  const n = siteNote({ name: "Harbour Loaf", pages: ["/"], hasDatabase: true, tables: ["signups"], functions: ["count_signups"], jobFns: ["count_signups"] });
  assert.match(n, /The functions a scheduled job may run are: count_signups\./);
});
