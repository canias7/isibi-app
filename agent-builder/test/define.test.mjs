import test from "node:test";
import assert from "node:assert/strict";
import { defineAgent, defineTool, toolsFor, wireTools, PUBLIC, TOOL_NAME } from "../src/define.mjs";
import { LIMIT_DEFAULTS } from "../src/limits.mjs";

const goodTool = () => ({
  name: "lookup_order",
  description: "Find one order by its id.",
  input: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  scope: "orders:read",
  run: async ({ id }) => ({ id, status: "shipped" }),
});
const goodAgent = (over = {}) => ({
  name: "support",
  model: "claude-sonnet-5",
  instructions: "Help the customer with their order.",
  ...over,
});

// ── defineTool ───────────────────────────────────────────────────────────────
test("defineTool accepts a whole declaration and freezes it", () => {
  const t = defineTool(goodTool());
  assert.equal(t.kind, "tool");
  assert.equal(t.name, "lookup_order");
  assert.equal(t.scope, "orders:read");
  assert.equal(typeof t.run, "function");
  assert.ok(Object.isFrozen(t), "a declaration that can be mutated after the fact");
});

test("EVERY REQUIRED PART OF A TOOL IS COMPELLED — a census, so a new part is covered", () => {
  // Derived by deleting one key at a time from a declaration known to work,
  // rather than one case per part: a hand-listed set here would go stale the
  // first time a part is added, and the miss would be silent.
  const parts = Object.keys(goodTool());
  assert.ok(parts.length >= 5, `only ${parts.length} parts found — the observer is dead`);
  for (const missing of parts) {
    const spec = goodTool();
    delete spec[missing];
    assert.throws(() => defineTool(spec), { name: "TypeError" },
      `a tool with no ${missing} was accepted — it would fail later, somewhere else`);
  }
  // THE CONTROL: the untouched declaration must still pass, or the census above
  // is passing because everything throws.
  assert.doesNotThrow(() => defineTool(goodTool()), "the control declaration no longer works");
});

test("a tool name must match the PROVIDER's grammar, not ours", () => {
  for (const bad of ["look up", "order.read", "join-our-wifi!", "", "a".repeat(65), "café"]) {
    assert.throws(() => defineTool({ ...goodTool(), name: bad }), { name: "TypeError" },
      `"${bad}" was accepted as a tool name and the provider would refuse the request`);
  }
  for (const ok of ["a", "lookup_order", "lookup-order", "tool123", "A".repeat(64)]) {
    assert.doesNotThrow(() => defineTool({ ...goodTool(), name: ok }), `"${ok}" refused`);
    assert.ok(TOOL_NAME.test(ok));
  }
});

test("scope is COMPELLED, and PUBLIC is how a tool says it needs none", () => {
  const spec = goodTool();
  delete spec.scope;
  assert.throws(() => defineTool(spec), /scope is required/,
    "an omitted scope got a default, and both possible defaults are wrong");
  const pub = defineTool({ ...goodTool(), scope: PUBLIC });
  assert.equal(pub.scope, PUBLIC);
});

test("defineTool refuses rather than coerces — an array is not a string", () => {
  // `String(["hi"])` is "hi", so a coercing reader takes this as a description.
  for (const key of ["name", "description", "scope"]) {
    assert.throws(() => defineTool({ ...goodTool(), [key]: ["lookup_order"] }), { name: "TypeError" },
      `${key} accepted an array — String(["x"]) is "x"`);
    assert.throws(() => defineTool({ ...goodTool(), [key]: "   " }), { name: "TypeError" },
      `${key} accepted whitespace as an answer`);
  }
  assert.throws(() => defineTool({ ...goodTool(), input: "{}" }), { name: "TypeError" },
    "input accepted a string, which reaches the provider as a malformed request");
  assert.throws(() => defineTool({ ...goodTool(), run: "run" }), { name: "TypeError" });
  for (const bad of [null, undefined, 4, "tool", []]) {
    assert.throws(() => defineTool(bad), { name: "TypeError" });
  }
});

// ── defineAgent ──────────────────────────────────────────────────────────────
test("defineAgent accepts a whole declaration, with no tools a real answer", () => {
  const a = defineAgent(goodAgent());
  assert.equal(a.kind, "agent");
  assert.deepEqual([...a.tools], []);
  assert.equal(a.limits.steps, LIMIT_DEFAULTS.steps);
  assert.ok(Object.isFrozen(a));
});

test("EVERY REQUIRED PART OF AN AGENT IS COMPELLED — census, with a control", () => {
  const parts = Object.keys(goodAgent());
  assert.ok(parts.length >= 3, `only ${parts.length} parts found`);
  for (const missing of parts) {
    const spec = goodAgent();
    delete spec[missing];
    assert.throws(() => defineAgent(spec), { name: "TypeError" }, `an agent with no ${missing} was accepted`);
  }
  assert.doesNotThrow(() => defineAgent(goodAgent()), "the control declaration no longer works");
});

test("AN AGENT DECLARATION IS THE TRUSTED DOOR — the author may set any usable bound", () => {
  // An agent definition is code the developer wrote. The untrusted parties are
  // the model and the tenant, and they narrow at `runAgent` through
  // `narrowLimits`. See the reasoning at the top of planLimits.
  const a = defineAgent(goodAgent({ limits: { steps: 3 } }));
  assert.equal(a.limits.steps, 3);
  const b = defineAgent(goodAgent({ limits: { steps: LIMIT_DEFAULTS.steps + 500 } }));
  assert.equal(b.limits.steps, LIMIT_DEFAULTS.steps + 500, "the author could not raise their own bound");
  const c = defineAgent(goodAgent({ limits: { wallMs: Infinity } }));
  assert.equal(c.limits.wallMs, Infinity, "an unbounded agent cannot be declared");
  // A value that cannot be read is still refused and reported, not coerced.
  const d = defineAgent(goodAgent({ limits: { steps: "3" } }));
  assert.equal(d.limits.steps, LIMIT_DEFAULTS.steps);
  assert.deepEqual([...d.limits.refused], ["steps"]);
});

test("TWO TOOLS WITH ONE NAME ARE REFUSED — a shadowed tool reads as live", () => {
  const one = defineTool(goodTool());
  const two = defineTool({ ...goodTool(), description: "A different thing entirely." });
  assert.throws(() => defineAgent(goodAgent({ tools: [one, two] })), /both named "lookup_order"/);
  // The control: two DIFFERENT names are fine, so the refusal is about the clash.
  assert.doesNotThrow(() => defineAgent(goodAgent({
    tools: [one, defineTool({ ...goodTool(), name: "cancel_order" })],
  })));
});

test("a tool is checked by SHAPE, not by identity", () => {
  // A tool that crossed a module boundary, or came back through structuredClone,
  // is still a tool. An `instanceof` wall would refuse a legitimate one for a
  // reason nobody can see from the error.
  const t = defineTool(goodTool());
  const copy = { ...t };
  assert.doesNotThrow(() => defineAgent(goodAgent({ tools: [copy] })), "a structurally identical tool was refused");
  for (const bad of [{ name: "x" }, { kind: "tool", name: "x" }, "lookup_order", null, 4]) {
    assert.throws(() => defineAgent(goodAgent({ tools: [bad] })), /must come from defineTool/);
  }
  assert.throws(() => defineAgent(goodAgent({ tools: "lookup_order" })), /tools must be an array/);
});

// ── toolsFor: the tenancy wall ───────────────────────────────────────────────
const agentWithScopes = () => defineAgent(goodAgent({
  tools: [
    defineTool({ ...goodTool(), name: "add", scope: PUBLIC }),
    defineTool({ ...goodTool(), name: "read_orders", scope: "orders:read" }),
    defineTool({ ...goodTool(), name: "refund", scope: "money:write" }),
  ],
}));

test("toolsFor offers PUBLIC tools and the granted ones, and WITHHOLDS the rest BY NAME", () => {
  const { allowed, withheld } = toolsFor(agentWithScopes(), ["orders:read"]);
  assert.deepEqual(allowed.map((t) => t.name), ["add", "read_orders"]);
  // The names come back. A filter is a silent drop and a check is a sentence: the
  // caller needs to be able to say WHY the agent could not do the thing.
  assert.deepEqual([...withheld], [{ name: "refund", scope: "money:write" }]);
});

test("THE TENANCY WALL FAILS CLOSED, with a live control", () => {
  const a = agentWithScopes();
  // Everything unreadable as a grant is not a grant.
  for (const grants of [undefined, null, [], "orders:read", {}, 4, [null], [{}], [["orders:read"]]]) {
    const { allowed, withheld } = toolsFor(a, grants);
    assert.deepEqual(allowed.map((t) => t.name), ["add"],
      `grants ${JSON.stringify(grants) ?? String(grants)} opened a scoped tool`);
    assert.equal(withheld.length, 2);
  }
  // A string that is not a scope must not match one, and a prototype key must
  // not either — `granted.has("constructor")` on a Set is false, which is the
  // reason a Set is used rather than an object.
  assert.equal(toolsFor(a, ["constructor"]).allowed.length, 1);
  assert.equal(toolsFor(a, ["orders"]).allowed.length, 1, "a scope prefix matched a scope");
  // THE CONTROL. Without it every case above also passes against a toolsFor that
  // allows nothing ever.
  assert.deepEqual(
    toolsFor(a, ["orders:read", "money:write"]).allowed.map((t) => t.name),
    ["add", "read_orders", "refund"],
    "the observer is dead: toolsFor cannot allow a scoped tool at all",
  );
});

test("wireTools is the ONE place that knows the provider's shape", () => {
  const a = agentWithScopes();
  const wire = wireTools(toolsFor(a, []).allowed);
  assert.deepEqual(wire, [{
    name: "add",
    description: "Find one order by its id.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  }]);
  // The implementation must NOT ride out to the provider.
  for (const w of wire) assert.equal(w.run, undefined, "a tool's run function was put on the wire");
  for (const w of wire) assert.equal(w.scope, undefined, "a tenant's scope names were put on the wire");
});

test("`repeatable` DEFAULTS TO PROTECT, and is refused rather than coerced", () => {
  // It answers one question, and only a resume asks it: if we cannot tell whether
  // this tool already ran, is running it again safe? A read is; taking a payment
  // is not. Unlike `scope` it is not compelled, because here one default is simply
  // safe — a wrong `false` is an inconvenience, a wrong `true` is somebody billed
  // twice.
  assert.equal(defineTool(goodTool()).repeatable, false, "a tool is repeatable unless it says otherwise");
  assert.equal(defineTool({ ...goodTool(), repeatable: true }).repeatable, true);
  assert.equal(defineTool({ ...goodTool(), repeatable: false }).repeatable, false);
  // `Boolean("false")` is TRUE, so a string out of a config file must not be the
  // thing that makes a payment tool repeatable.
  for (const bad of ["false", "true", 1, 0, null, [], {}, "yes"]) {
    assert.throws(() => defineTool({ ...goodTool(), repeatable: bad }), { name: "TypeError" },
      `repeatable accepted ${JSON.stringify(bad) ?? String(bad)}`);
  }
  assert.equal(Boolean("false"), true, "the fact the refusal rests on");
});

test("⚠ `waits` IS A DECLARATION, AND A WAITING TOOL MUST BE REPEATABLE", () => {
  // It says this call cannot be answered in the delivery that makes it: the tool starts
  // work that finishes somewhere else, and the model's answer arrives LATER. An approval
  // is held BEFORE the dispatch; this is held AFTER it, because the work really did start
  // and its RESULT is what is missing.
  assert.equal(defineTool(goodTool()).waits, false, "a tool waits only if it says so");
  assert.equal(defineTool({ ...goodTool(), waits: true, repeatable: true }).waits, true);
  assert.equal(defineTool({ ...goodTool(), waits: false }).waits, false);
  // Refused rather than coerced, for `repeatable`'s own reason.
  for (const bad of ["false", "true", 1, 0, null, [], {}, "yes"]) {
    assert.throws(() => defineTool({ ...goodTool(), waits: bad }), { name: "TypeError" },
      `waits accepted ${JSON.stringify(bad) ?? String(bad)}`);
  }
  // ⚠ AND THE IMPLICATION IS SHARPER THAN `writes`': a waiting call is resumed BY
  // DEFINITION — that is the whole of what waiting means here — so one that is not safe to
  // repeat is refused by the resume and NAMED, for ever. The tool would be a control that
  // holds and never completes.
  assert.throws(() => defineTool({ ...goodTool(), waits: true }), /must be repeatable/,
    "a waiting tool that says nothing about repeating was accepted");
  assert.throws(() => defineTool({ ...goodTool(), waits: true, repeatable: false }), /must be repeatable/);
  // The CONTROL: the pair really is what is refused, not the flag.
  assert.equal(defineTool({ ...goodTool(), waits: true, repeatable: true }).repeatable, true);
});
