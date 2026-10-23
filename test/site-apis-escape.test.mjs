// Audit A30-8: a parameter is escaped for where it lands. URL-encoded in the
// URL, JSON-escaped in a JSON body, line breaks taken out of a header value.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeApi, callApi, fill } from "../site-apis.mjs";

function deps() {
  const sent = [];
  return {
    sent,
    secrets: { COURIER_KEY: "k1" },
    blockedReason: () => null,
    fetch: async (url, init) => { sent.push({ url, init }); return { status: 200, headers: new Headers({ "content-type": "application/json" }), text: async () => "{}" }; },
    cacheGet: async () => null,
    cacheSet: async () => {},
  };
}
const POST = {
  name: "slots",
  method: "POST",
  url: "https://api.courier.test/v1/slots?pc={{param.postcode}}",
  headers: { Authorization: "Bearer {{COURIER_KEY}}", "X-Ref": "{{param.ref}}" },
  body: '{"postcode":"{{param.postcode}}","email":"{{param.email}}","note":"{{param.note}}"}',
  params: ["postcode", "email", "note", "ref"],
};

test("a JSON body carries the values as typed, and the URL still encodes them", async () => {
  const d = deps();
  const api = normalizeApi(POST);
  assert.ok(api && api.method === "POST", "the declaration did not normalise as a POST");
  const params = { postcode: "SW1A 1AA", email: "a@b.com", note: 'say "hi"\nthanks', ref: "r1\r\nX-Evil: 1" };
  await callApi(d, { slug: "shop", api, params });
  assert.equal(d.sent.length, 1);
  const { url, init } = d.sent[0];
  assert.deepEqual(JSON.parse(init.body), { postcode: "SW1A 1AA", email: "a@b.com", note: 'say "hi"\nthanks' });
  assert.ok(String(url).endsWith("?pc=SW1A%201AA"), String(url));
  const h = init.headers;
  assert.equal(h["X-Ref"], "r1X-Evil: 1", "a line break reached a header value");
  assert.equal(h.Authorization, "Bearer k1");
});

test("a form-encoded body stays URL-encoded", async () => {
  const d = deps();
  const api = normalizeApi({ ...POST, headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "postcode={{param.postcode}}&email={{param.email}}" });
  await callApi(d, { slug: "shop", api, params: { postcode: "SW1A 1AA", email: "a&b@c.com" } });
  assert.equal(d.sent[0].init.body, "postcode=SW1A%201AA&email=a%26b%40c.com");
});

test("fill escapes by context, URL by default", () => {
  const params = { x: 'a "b"&c' };
  assert.equal(fill("{{param.x}}", { params }).text, "a%20%22b%22%26c");
  assert.equal(fill("{{param.x}}", { params, escape: "json" }).text, 'a \\"b\\"&c');
  assert.equal(fill("{{param.x}}", { params, escape: "toString" }).text, "a%20%22b%22%26c", "an unknown context is not the URL's");
});
