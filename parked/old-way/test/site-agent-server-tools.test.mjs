// PARKED (2026-11-03, park-old-way): the old-way half of test/site-agent-server-tools.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The site agent's server tools (2026-10-30, the owner approved five):
// call_function, read_errors, list_keys, change_schema, read_docs, and the
// owner's five rules for server code. Every dependency is stubbed: no network,
// no model, no database.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runSiteAgent, toolsFor, toolCounts, roundFacts, agentSystem, AGENT_TOOLS, TOOL_NEEDS, SERVER_RULES } from "../../../builder/site-agent.mjs";
import {
  docsAllowed, docsText, readDocs, redactSecrets, errorLines, keyNames, schemaChange, mergeSchemaOps, keepsEverything,
  callRequest, callAnswer, DOCS_HOSTS, DOCS_MAX_CHARS,
} from "../../../builder/agent-server-tools.mjs";
import { dryRunServerParts } from "../../../builder/server-dryrun.mjs";

const PAGES = [{ path: "index.tsx", source: "export default function Home(){return <h1>Home</h1>}" }];
const FN = `export const hosts = [];
export default async function (request: Request, site: any) {
  const u = new URL(request.url);
  const b = request.method === "GET" ? {} : await request.json();
  if (!b.email && !u.searchParams.get("email")) return Response.json({ error: "email is required" }, { status: 400 });
  const rows = await site.sql("insert into signups (email) values (?)", [b.email]);
  return Response.json({ ok: true, email: b.email || u.searchParams.get("email"), rows: rows.length });
}`;
const PARTS = [{ name: "site-footer", source: "export default function F(){return <footer/>}" }, { name: "server-signup", source: FN }];
const SPEC = { tables: [{ name: "signups", columns: [{ name: "email", type: "text" }, { name: "name", type: "text" }] }] };
const use = (name, input, id) => ({ type: "tool_use", name, input, ...(id ? { id } : {}) });
const answer = (...uses) => ({ content: uses, usage: { input_tokens: 100, output_tokens: 20 }, stop_reason: "tool_use" });
function scripted(rounds) {
  const sent = []; let i = 0;
  return { sent, send: async (req) => { sent.push(JSON.parse(JSON.stringify(req))); return rounds[Math.min(i++, rounds.length - 1)]; } };
}
const results = (sent) => sent.at(-1).messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).filter((b) => b.type === "tool_result");
const NAMES = ["call_function", "read_errors", "list_keys", "change_schema", "read_docs"];

test("ST17 the worker wires each tool to its dependency, and the container answers /agent-call", () => {
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const start = w.indexOf("async function runAgentChange(");
  const end = w.indexOf("\n}\n", start);
  assert.ok(start > 0 && end > start);
  const body = w.slice(start, end);
  for (const k of ["callFunction: agentCall(env, slug)", "fetchDocs: agentFetchDocs", "readErrors: agentReadErrors", "listKeys: agentListKeys", "applySchema:"]) assert.ok(body.includes(k), k);
  assert.match(body, /applyAgentSchema\(env, slug, conn, schemaOps, job\)/);
  const keys = w.slice(w.indexOf("function agentListKeys("), w.indexOf("function agentListKeys(") + 600);
  assert.match(keys, /SELECT name FROM _secrets/);
  assert.ok(!/cipher|hint/.test(keys.replace(/\/\*\*[\s\S]*?\*\//, "")), "only the name column is selected");
  const fb = w.slice(w.indexOf("agentWrite: agentTakes()"), w.indexOf("generate: async () =>", w.indexOf("agentWrite: agentTakes()")));
  assert.ok(fb.includes("callFunction: agentCall(env, slug)") && fb.includes("fetchDocs: agentFetchDocs"));
  const bs = fs.readFileSync(new URL("../../../builder/build-server.mjs", import.meta.url), "utf8");
  const at = bs.indexOf('req.url === "/agent-call"');
  assert.ok(at > 0 && /dryRunServerParts\(sp,[\s\S]{0,120}call:/.test(bs.slice(at, at + 1500)));
});
