// A ONE-LINE SINGLE-QUOTED VALUE MUST CLOSE WHERE IT ENDS (2026-10-14).
// `build-as-owner.yml`'s mode description gained "source's" with a bare
// apostrophe; YAML read the quote as closed there, GitHub refused the whole
// file on push (run 38578125153, no jobs) and the press could not have been
// pressed. Inside '…' an apostrophe is written twice. No YAML parser is a
// dependency here, so this reads the one shape the workflows use: `key: '…'`
// on one line, optionally followed by a comment.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const WF = new URL("../.github/workflows/", import.meta.url);
const VALUE = /^\s*(?:-\s+)?[A-Za-z0-9_-]+:\s+'(.*)$/;
const CLOSED = /^(?:[^']|'')*'\s*(?:#.*)?$/;

export function badQuotes(text) {
  const bad = [];
  let seen = 0;
  text.split("\n").forEach((line, i) => {
    const m = VALUE.exec(line);
    if (!m) return;
    seen++;
    if (!CLOSED.test(m[1])) bad.push(i + 1);
  });
  return { seen, bad };
}

test("WQ 1: the reader is alive — it catches a bare apostrophe and passes a doubled one", () => {
  assert.deepEqual(badQuotes("    description: 'the source's page'").bad, [1]);
  assert.deepEqual(badQuotes("    description: 'the source''s page'").bad, []);
  assert.deepEqual(badQuotes("    if: a != 'check' && b != 'x'").bad, []);
  assert.deepEqual(badQuotes("        node-version: '22'  # pinned").bad, []);
});

test("WQ 2: every one-line single-quoted value in every workflow closes where it ends", () => {
  const files = readdirSync(WF).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  assert.ok(files.includes("build-as-owner.yml"), "the workflows directory is the one read");
  let seen = 0;
  const bad = [];
  for (const f of files) {
    const r = badQuotes(readFileSync(new URL(f, WF), "utf8"));
    seen += r.seen;
    for (const n of r.bad) bad.push(`${f}:${n}`);
  }
  assert.ok(seen > 20, `quoted values were found (${seen})`);
  assert.deepEqual(bad, []);
});
