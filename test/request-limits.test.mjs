// How much a caller is allowed to send.
//
// The public data API had NO body limit. Measured live 2026-07-28: a 3,000,000
// character field went through POST /api/db/<slug>/rows/<table> and landed in
// the owner's Neon database. Uploads were capped at 5 MB; JSON was capped at
// nothing — so with the write limit at 60/min, one anonymous caller could push
// ~180 MB a minute into a database the site owner PAYS for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readJsonBody, clampFields, MAX_JSON_BODY, MAX_FIELD_CHARS, MAX_BODY_KEYS } from "../request-limits.mjs";

const req = (body, headers = {}) => new Request("https://isibi.ai/x", {
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body,
});

test("an ordinary form submission goes through", async () => {
  const r = await readJsonBody(req(JSON.stringify({ name: "Ada", notes: "window seat" })));
  assert.equal(r.ok, true);
  assert.deepEqual(r.body, { name: "Ada", notes: "window seat" });
});

test("the body that got into production is refused", async () => {
  // 3,000,000 characters, exactly as sent on 2026-07-28.
  const r = await readJsonBody(req(JSON.stringify({ customer_name: "x".repeat(3_000_000) })));
  assert.equal(r.ok, false);
  assert.equal(r.status, 413);
  assert.equal(r.code, "too_big");
});

test("a lying content-length does not get more through", async () => {
  // The header is written by the caller, so it can only ever be a courtesy that
  // saves us buffering. The real check is on what actually arrived.
  const big = JSON.stringify({ a: "x".repeat(MAX_JSON_BODY) });
  const r = await readJsonBody(req(big, { "content-length": "10" }));
  assert.equal(r.ok, false);
  assert.equal(r.status, 413);
});

test("a huge content-length is refused before the body is read", async () => {
  let read = 0;
  const fake = {
    headers: new Headers({ "content-length": String(MAX_JSON_BODY * 100) }),
    text: async () => { read++; return "{}"; },
  };
  const r = await readJsonBody(fake);
  assert.equal(r.status, 413);
  assert.equal(read, 0, "buffering megabytes to then refuse them is the attack, not the defence");
});

test("multi-byte characters are measured as bytes, not as characters", async () => {
  // "🙂".length is 2 but it is 4 bytes. Measuring .length would let a caller
  // send twice the limit in emoji — and it is bytes that reach the database.
  const emoji = "🙂".repeat(Math.ceil(MAX_JSON_BODY / 4));
  const r = await readJsonBody(req(JSON.stringify({ a: emoji })));
  assert.equal(r.ok, false, "byte length must decide");
  assert.equal(r.status, 413);
});

test("a body right at the limit is allowed", async () => {
  const pad = "y".repeat(MAX_JSON_BODY - 20);
  const body = JSON.stringify({ a: pad });
  assert.ok(new TextEncoder().encode(body).length <= MAX_JSON_BODY);
  assert.equal((await readJsonBody(req(body))).ok, true, "the cap must not be off by one against a legitimate caller");
});

test("malformed JSON is a 400, not a crash", async () => {
  for (const bad of ["{", "not json", '{"a":}', "[1,2,3]", '"a string"', "null", "42"]) {
    const r = await readJsonBody(req(bad));
    assert.equal(r.ok, false, bad);
    assert.equal(r.status, 400, bad);
  }
});

test("an empty body is an empty object, not an error", async () => {
  // A DELETE or a POST with nothing to say is normal.
  for (const b of ["", "   ", undefined]) {
    const r = await readJsonBody(req(b));
    assert.equal(r.ok, true, JSON.stringify(b));
    assert.deepEqual(r.body, {});
  }
});

test("an unreadable stream is a 400, not a throw", async () => {
  const fake = { headers: new Headers(), text: async () => { throw new Error("stream reset"); } };
  const r = await readJsonBody(fake);
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(r.code, "unreadable");
});

// ────────────────────────────────────────────────────────── per-field clamp

test("one field cannot hold the whole budget", async () => {
  // 128 KB in a single column is still a paragraph nobody typed, and a form
  // with twenty fields should not be able to put all of it in a customer name.
  const { body, clamped } = clampFields({ customer_name: "x".repeat(MAX_FIELD_CHARS * 3), notes: "fine" });
  assert.equal(body.customer_name.length, MAX_FIELD_CHARS);
  assert.equal(body.notes, "fine");
  assert.equal(clamped, 1);
});

test("a long field is truncated, not rejected", async () => {
  // A visitor who pasted too much should get their booking, not an error about
  // a field they cannot see.
  const { body } = clampFields({ notes: "x".repeat(MAX_FIELD_CHARS + 1) });
  assert.equal(typeof body.notes, "string");
  assert.equal(body.notes.length, MAX_FIELD_CHARS);
});

test("non-strings are passed through untouched", async () => {
  const { body, clamped } = clampFields({ n: 5, b: true, o: { a: 1 }, z: null, u: undefined });
  assert.deepEqual(body, { n: 5, b: true, o: { a: 1 }, z: null, u: undefined });
  assert.equal(clamped, 0);
});

test("a body with a thousand keys is cut to the cap", async () => {
  const many = {};
  for (let i = 0; i < 1000; i++) many["k" + i] = "v";
  const { body } = clampFields(many);
  assert.equal(Object.keys(body).length, MAX_BODY_KEYS);
});

test("nothing at all does not crash", async () => {
  for (const b of [null, undefined, {}]) {
    assert.deepEqual(clampFields(b).body, {});
  }
});

test("this supersedes tooLargeBody for JSON, rather than competing with it", async () => {
  // worker.js's tooLargeBody checks content-length ONLY — the header the caller
  // writes — so a request that omits it passes unconditionally. That is fine as
  // a pre-buffer courtesy and useless as a control. Asserted here because the
  // failure mode is somebody adding a third mechanism, or trusting the header.
  const noHeader = {
    headers: new Headers(),                       // no content-length at all
    text: async () => JSON.stringify({ a: "x".repeat(MAX_JSON_BODY) }),
  };
  const r = await readJsonBody(noHeader);
  assert.equal(r.ok, false, "a body with no content-length must still be measured");
  assert.equal(r.status, 413);
});
