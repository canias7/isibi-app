// Every agent build runs the old data check (2026-11-04, carry-over M-18).
// lintPages ran only on a first build, so an edit could ship a form that writes
// where the database refuses (403) or reads a table that doesn't exist: it
// compiled, published, and failed silently for the visitor.
import test from "node:test";
import assert from "node:assert/strict";
import { runSiteAgent, dataProblems, makeWorkspace, DATA_TRIES } from "../builder/site-agent.mjs";

const SPEC = { tables: [
  { name: "products", access: "display", columns: [{ name: "name", type: "text" }] },
  { name: "enquiries", access: "collect", columns: [{ name: "email", type: "text" }] },
] };
const page = (body) => 'import { createFileRoute } from "@tanstack/react-router";\nimport { useRows, useCreateRow } from "@/lib/rows";\nexport const Route = createFileRoute("/contact")({ head: () => ({ meta: [{ title: "c" }] }), component: P });\nfunction P() { ' + body + ' return null; }\n';
const BAD = page('const add = useCreateRow("products");');
const GOOD = page('const add = useCreateRow("enquiries");');

test("the data findings are found on a page, and only data findings", () => {
  const dp = dataProblems(makeWorkspace([{ path: "contact.tsx", source: BAD }], []), SPEC, []);
  assert.ok(dp.length >= 1, "the observer is alive: a write to a public list was found");
  assert.ok(dp.every((m) => /products/.test(m)), dp.join(" | "));
  assert.deepEqual(dataProblems(makeWorkspace([{ path: "contact.tsx", source: GOOD }], []), SPEC, []), [], "a form into a collect table was flagged");
  // A table this run created counts as declared.
  const made = page('const add = useCreateRow("signups");');
  assert.ok(dataProblems(makeWorkspace([{ path: "contact.tsx", source: made }], []), SPEC, []).length > 0);
  assert.deepEqual(dataProblems(makeWorkspace([{ path: "contact.tsx", source: made }], []), SPEC, [{ table: "signups", create: { columns: [{ name: "email", type: "text" }], access: "collect" } }]), []);
});

const use = (name, input) => ({ type: "tool_use", id: name + Math.random(), name, input });
test("the agent cannot finish on a build whose data check failed, until it fixes it", async () => {
  const seen = [];
  let n = 0;
  const script = [
    [use("write_file", { file: "contact.tsx", source: BAD })],
    [use("build", {})],
    [use("finish", { summary: "done" })],          // refused: the build's data check failed
    [use("write_file", { file: "contact.tsx", source: GOOD })],
    [use("build", {})],
    [use("finish", { summary: "done" })],
  ];
  const ag = await runSiteAgent({
    send: async (req) => {
      const last = req.messages[req.messages.length - 1];
      if (n > 0 && last && Array.isArray(last.content)) for (const b of last.content) if (b.type === "tool_result") seen.push(String(typeof b.content === "string" ? b.content : JSON.stringify(b.content)));
      return { content: script[n++] || [use("finish", { summary: "done" })], stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } };
    },
    build: async () => ({ ok: true }),
  }, { request: "add a contact form\nThey answered: Yes, go ahead", pages: [{ path: "index.tsx", source: "export default 1" }], parts: [], spec: SPEC, model: "m", maxRounds: 10 });
  assert.match(seen.join("\n"), /the pages read or write the database in ways it will refuse/);
  assert.equal(ag.ok, true, "the fixed site could not finish");
  assert.equal(ag.pages.find((p) => p.path === "contact.tsx").source, GOOD, "the agent finished with the broken form");
  assert.ok(DATA_TRIES >= 1);
});
