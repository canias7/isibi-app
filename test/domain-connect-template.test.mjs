// THE TEMPLATE IS VALIDATED AGAINST THE UPSTREAM SCHEMA, IN CI.
//
// `domain-connect/gofarther.dev.site.json` is submitted to a repository we do
// not control, reviewed by people who do not know this codebase, and ingested by
// DNS providers who will simply refuse a malformed one. The whole feature — the
// one-click button in Cloud → Domains — is a 404 at the provider's end until it
// is merged, so a template that fails their schema is a silent dead end rather
// than an error anybody here would see.
//
// `domain-connect/template.schema` is THEIR schema, vendored verbatim from the
// upstream repository. Vendored rather than fetched: a test that reaches the
// network fails when GitHub is slow and passes when a proxy serves a cached
// 404 page, which is exactly the shape of check that reads as coverage and is
// not. Re-copy it when they change it — the URL is in the README.
//
// The validator below implements the draft-07 subset that schema actually uses,
// enumerated from the file rather than guessed: $ref, allOf/anyOf/oneOf/not,
// contains, const, enum, pattern, required, properties, items, type. `ajv` would
// do this in one line and is not a dependency of this Worker; adding one to the
// deploy bundle for a test is the wrong trade.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../domain-connect/template.schema", import.meta.url), "utf8"));
const template = JSON.parse(readFileSync(new URL("../domain-connect/gofarther.dev.site.json", import.meta.url), "utf8"));

function resolveRef(ref) {
  // Only local pointers appear in this schema, and anything else is a bug in
  // the vendored copy rather than something to fetch.
  assert.ok(ref.startsWith("#/"), `unsupported $ref: ${ref}`);
  let node = schema;
  for (const part of ref.slice(2).split("/")) node = node[decodeURIComponent(part)];
  assert.ok(node, `unresolvable $ref: ${ref}`);
  return node;
}

function typeOk(value, t) {
  switch (t) {
    case "object": return value !== null && typeof value === "object" && !Array.isArray(value);
    case "array": return Array.isArray(value);
    case "string": return typeof value === "string";
    // JSON has one number type; draft-07 says an integer is a number with no
    // fractional part, so 1.0 is a valid integer and "1" is not.
    case "integer": return typeof value === "number" && Number.isInteger(value);
    case "number": return typeof value === "number";
    case "boolean": return typeof value === "boolean";
    case "null": return value === null;
    default: throw new Error(`unsupported type: ${t}`);
  }
}

/** Every reason `value` fails `node`, as paths. Empty means valid. */
function errors(node, value, path = "") {
  if (node === true) return [];
  if (node === false) return [`${path || "/"}: schema is false`];
  const out = [];
  const at = path || "/";

  if (node.$ref) out.push(...errors(resolveRef(node.$ref), value, path));

  if (node.type) {
    const types = Array.isArray(node.type) ? node.type : [node.type];
    if (!types.some((t) => typeOk(value, t))) out.push(`${at}: expected ${types.join("|")}`);
  }
  if (node.const !== undefined && JSON.stringify(value) !== JSON.stringify(node.const)) {
    out.push(`${at}: expected const ${JSON.stringify(node.const)}`);
  }
  if (node.enum && !node.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) {
    out.push(`${at}: not one of ${JSON.stringify(node.enum)}`);
  }
  if (node.pattern && typeof value === "string" && !new RegExp(node.pattern).test(value)) {
    out.push(`${at}: does not match ${node.pattern}`);
  }
  if (node.required && typeOk(value, "object")) {
    for (const k of node.required) {
      if (!Object.hasOwn(value, k)) out.push(`${at}: missing required "${k}"`);
    }
  }
  if (node.properties && typeOk(value, "object")) {
    for (const [k, sub] of Object.entries(node.properties)) {
      if (Object.hasOwn(value, k)) out.push(...errors(sub, value[k], `${path}/${k}`));
    }
  }
  if (node.items && typeOk(value, "array")) {
    value.forEach((v, i) => out.push(...errors(node.items, v, `${path}/${i}`)));
  }
  if (node.contains && typeOk(value, "array") && !value.some((v) => errors(node.contains, v).length === 0)) {
    out.push(`${at}: no item matches "contains"`);
  }
  if (node.allOf) node.allOf.forEach((sub) => out.push(...errors(sub, value, path)));
  if (node.anyOf && !node.anyOf.some((sub) => errors(sub, value, path).length === 0)) {
    out.push(`${at}: matches none of anyOf`);
  }
  if (node.oneOf) {
    const hits = node.oneOf.filter((sub) => errors(sub, value, path).length === 0).length;
    if (hits !== 1) out.push(`${at}: matched ${hits} of oneOf, expected exactly 1`);
  }
  if (node.not && errors(node.not, value, path).length === 0) out.push(`${at}: matches "not"`);

  return out;
}

test("the validator can actually fail — a wrong type, a missing field, a bad enum", () => {
  // Written first and asserted first, because a validator that returns [] for
  // everything passes the real test below and proves nothing. Every construct
  // the template depends on is exercised here against a deliberate violation.
  assert.deepEqual(errors({ type: "string" }, "ok"), []);
  assert.equal(errors({ type: "string" }, 7).length, 1);
  assert.equal(errors({ type: "integer" }, 1.5).length, 1);
  assert.equal(errors({ required: ["a"] }, {}).length, 1);
  assert.equal(errors({ properties: { a: { type: "string" } } }, { a: 1 }).length, 1);
  assert.equal(errors({ items: { type: "string" } }, ["a", 2]).length, 1);
  assert.equal(errors({ enum: ["A", "B"] }, "C").length, 1);
  assert.equal(errors({ const: "A" }, "B").length, 1);
  assert.equal(errors({ pattern: "^[a-z]+$" }, "AB").length, 1);
  assert.equal(errors({ contains: { const: "x" } }, ["y"]).length, 1);
  assert.equal(errors({ not: { type: "string" } }, "s").length, 1);
  assert.equal(errors({ oneOf: [{ type: "string" }, { type: "string" }] }, "s").length, 1);
  assert.equal(errors({ anyOf: [{ type: "number" }] }, "s").length, 1);
  assert.deepEqual(errors({ allOf: [{ type: "string" }, { pattern: "^a" }] }, "ab"), []);
  assert.equal(errors({ allOf: [{ type: "string" }, { pattern: "^a" }] }, "bb").length, 1);
});

test("the vendored schema is the upstream one, and it resolves", () => {
  assert.equal(schema.$schema, "http://json-schema.org/draft-07/schema#");
  assert.equal(schema.$ref, "#/definitions/DomainConnectTemplate");
  // The record types are what a reviewer's tooling checks a template against;
  // if the vendored copy were truncated or a stub, these would be missing and
  // every validation below would pass vacuously.
  for (const t of ["Record-CNAME", "Record-A", "Record-TXT", "Record-MX", "Record-SPFM"]) {
    assert.ok(schema.definitions[t], `missing ${t} — vendored schema looks incomplete`);
  }
});

test("gofarther.dev.site.json validates against it", () => {
  const found = errors(schema, template);
  assert.deepEqual(found, [], found.join("\n"));
});

test("the template still says the things the submission is rejected without", () => {
  // Their PR checklist, not the schema — the schema requires none of this and
  // a reviewer requires all of it. Asserted here because the file is edited by
  // whoever changes the DNS story next, and the checklist is not in front of
  // them.
  assert.equal(template.providerId, "gofarther.dev", "providerId should be a domain we control");
  assert.equal(template.serviceId, "site");
  assert.equal(typeof template.syncPubKeyDomain, "string");
  assert.ok(template.syncPubKeyDomain, "syncPubKeyDomain is mandatory; omitting it needs written justification");
  // Mutually exclusive with a signature, and a template carrying both is
  // refused. See the README for why the signature is the right half of the pair.
  assert.ok(!("warnPhishing" in template), "warnPhishing must not appear alongside syncPubKeyDomain");
  assert.ok(template.syncRedirectDomain, "without this the apply URL is an open redirect");
  assert.ok(!/[*]/.test(template.syncRedirectDomain), "a wildcard redirect domain defeats the point of having one");
});

test("no CNAME sits at the apex, which is the rule that rewrote this template", () => {
  // THE SCHEMA CHECK ABOVE IS WHAT FOUND THIS, and it is worth stating on its
  // own because the first draft was a single CNAME at `@` with
  // `hostRequired: false` — reasoned out, written up in the README, and
  // INVALID. The standard refuses that combination: a template whose CNAME (or
  // NS) sits at `@`/`""` must set `hostRequired: true`, which would have meant
  // a host was always mandatory and the bare domain could never be applied.
  // The apex is the case a small business asks for by name, so the answer is
  // the standard's own APEXCNAME type — the record a provider implements with
  // ALIAS, ANAME or CNAME flattening.
  //
  // Asserted separately from the schema run because the schema states it as a
  // negated $ref three levels down, and a reader hitting a red build needs the
  // reason and not the pointer.
  const bad = template.records.filter((r) => ["CNAME", "NS"].includes(r.type) && ["@", ""].includes(r.host));
  assert.deepEqual(bad, [], "a CNAME/NS at the apex forces hostRequired:true — use APEXCNAME");
});

test("the records it applies are the ones the Worker builds a link for", () => {
  // The template and `applyUrl` are two halves of one thing living in two
  // files, and a disagreement between them is a consent screen that applies
  // the wrong record — or, for a group name that does not exist, nothing at
  // all while reporting success. The group ids and the variable are the seams.
  assert.equal(template.hostRequired, false);
  const groups = Object.fromEntries(template.records.map((r) => [r.groupId, r]));
  assert.deepEqual(Object.keys(groups).sort(), ["apex", "www"]);
  assert.equal(groups.apex.type, "APEXCNAME");
  assert.ok(!("host" in groups.apex), "APEXCNAME is apex by definition and takes no host");
  assert.equal(groups.www.type, "CNAME");
  assert.equal(groups.www.host, "www");
  for (const r of template.records) assert.equal(r.pointsTo, "%target%");

  const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.ok(/params:\s*\{\s*target:/.test(worker),
    "worker.js must send a `target` param — the template's only variable");
  // Matched against the real record list rather than a literal pair, so adding
  // a third group to the template fails here until the Worker can select it.
  for (const g of Object.keys(groups)) {
    assert.ok(new RegExp(`["']${g}["']`).test(worker), `worker.js never selects the "${g}" group`);
  }
  assert.ok(/groupId:\s*dcGroup/.test(worker), "the selected group must reach applyUrl");
});

test("the private key is not in the repository", () => {
  // The public half is DNS and the private half is a GitHub Actions secret.
  // Committing the second one would let anybody forge an apply link under our
  // provider name, which is the exact attack the signature exists to stop.
  const readme = readFileSync(new URL("../domain-connect/README.md", import.meta.url), "utf8");
  assert.ok(!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(readme));
  assert.ok(!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(JSON.stringify(template)));
});
