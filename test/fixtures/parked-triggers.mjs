// READING A WORKFLOW'S TRIGGERS, LIVE AND PARKED.
//
// Owner, 2026-09-09: "REMOVE ALL THOSE WORKFLOWS FROM THE MERGE THING, I JUST
// WANT THE MERGE THING THERE, THATS IT." Twenty-two automatic triggers came off
// that day and were COMMENTED OUT rather than deleted, so that restoring one is
// uncommenting a block. Two guards need to read them — `merge-triggers` asks
// what still fires on a merge, `ci-browser-order` asks whether a parked path
// filter still names the scripts its workflow runs — and two copies of this
// reader is the recorded "two lists of the same thing", with a silent drift the
// day the parking convention changes. One copy, here.
//
// NO YAML PARSER. There is none at the root and adding one for a test is a new
// dependency in a repo whose CI installs only what package.json declares — the
// recorded trap where a test imports something `npm ci` never installed. So
// this reads the `on:` block, which is flat, and is DRIVEN against fixtures in
// `merge-triggers.test.mjs` in both directions, because a reader that quietly
// stops matching answers "nothing fires on a merge" for every possible input —
// which is the answer this whole change is trying to be true.

/**
 * Undo the parking, leaving the explanatory notes as comments.
 *
 * Parking prefixed every line of the trigger with `  # `, so a parked YAML line
 * is `  # ` followed by that line's OWN indentation — `  #   push:` — while a
 * note written by a person starts at the first column after the prefix:
 * `  # This fired on a push to main`. That leading space is the whole
 * discriminator, and it is what keeps un-parking from turning the note into
 * a syntax error where a trigger should be.
 */
export function unpark(src) {
  return src
    .split("\n")
    .map((l) => {
      if (/^ {2}#$/.test(l)) return "";              // a blank line inside the block
      const m = l.match(/^ {2}# (?= )(.*)$/);        // parked YAML keeps its own indent
      return m ? m[1] : l;
    })
    .join("\n");
}

/**
 * The `on:` block's live event keys, each with the lines indented under it.
 *
 * Comments are skipped, which is what makes a parked trigger invisible here —
 * exactly the property being asserted. Returns a Map so a caller can tell an
 * event with no configuration (`push:` alone, every branch) from one with a
 * filter, which are different answers.
 */
export function triggersOf(src) {
  const lines = src.split("\n");
  const start = lines.findIndex((l) => l === "on:");
  if (start === -1) return new Map();
  const out = new Map();
  let cur = null;
  for (const line of lines.slice(start + 1)) {
    if (!line.trim()) continue;
    if (/^\S/.test(line)) break;                     // back to a top-level key
    // TWO DEFENCES, AND THEY ARE REDUNDANT ON PURPOSE — said out loud because a
    // sweep cannot say it. Cutting the skip alone was mutated and SURVIVED, and
    // it survived by being inert: the event regex below demands `[a-z_]`
    // immediately after exactly two spaces, so a `  # ` line can never register
    // as an event whether or not it was skipped. Measured over all 33 workflows
    // and five questions each: zero answers moved. The pair is what is
    // load-bearing, so the pair is what the sweep mutates — cut both and every
    // parked trigger reads as live.
    if (/^\s*#/.test(line)) continue;                // a comment, parked or prose
    const ev = line.match(/^ {2}([a-z_]+):\s*$/);
    if (ev) { cur = []; out.set(ev[1], cur); continue; }
    if (cur) cur.push(line);
  }
  return out;
}

/** An inline `key: [a, b]` from a trigger's own lines, or null. */
function listUnder(lines, key) {
  for (const l of lines) {
    const m = l.match(new RegExp("^\\s+" + key + ":\\s*\\[(.*)\\]\\s*$"));
    if (m) return m[1].split(",").map((s) => s.trim().replace(/['"]/g, "")).filter(Boolean);
  }
  return null;
}

/**
 * Would a push to `branch` start this workflow?
 *
 * The three cases, and the middle one is the one worth naming: a `push:` with
 * NO branch filter fires on every branch including main, so an absent filter is
 * a yes and not a no. Reading it the other way would report the whole repo as
 * already off the merge.
 */
export function firesOnPush(src, branch = "main") {
  const push = triggersOf(src).get("push");
  if (push === undefined) return false;
  const ignore = listUnder(push, "branches-ignore");
  if (ignore && ignore.includes(branch)) return false;
  const only = listUnder(push, "branches");
  if (only) return only.includes(branch);
  return true;
}

/** Is this workflow chained to `name` completing? */
export function chainedTo(src, name) {
  const run = triggersOf(src).get("workflow_run");
  if (!run) return false;
  const named = listUnder(run, "workflows") || [];
  return named.includes(name);
}
