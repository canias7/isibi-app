// The research executor, actually RUN (2026-08-14 audit): `siteWebResearch`
// was the one paid step in the build no test had ever driven — only its model
// constant was source-read — and its designed failure mode is silence, so a
// provider changing the pause_turn or server_tool_use shape would ship
// undetected while every customer whose brief needed real facts silently got
// training-data ones.
//
// Driven through the real worker module (the harness loader) with
// `globalThis.fetch` stubbed — the executor itself is untouched.
import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";

import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { contextSummary, contextSentence, contextBrief, MAX_QUERIES } from "../builder/site-context.mjs";

const workerSrc = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const ENV = { ANTHROPIC_API_KEY: "test-key" };

/** Run siteWebResearch with fetch answering from a script of responses. */
async function drive(script, { queries = ["latest iphone price"] } = {}) {
  const { siteWebResearch } = await loadWorkerModule();
  assert.equal(typeof siteWebResearch, "function", "siteWebResearch is not exported — nothing can run it");
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    const next = script[Math.min(calls.length - 1, script.length - 1)];
    if (next instanceof Error) throw next;
    if (next && next.status) return new Response("nope", { status: next.status });
    return new Response(JSON.stringify(next), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const out = await siteWebResearch(ENV, "a phone shop", queries);
    return { out, calls };
  } finally {
    globalThis.fetch = realFetch;
  }
}

const round = ({ stop = "end_turn", text = "", results = [], searches = 0, usage = {} } = {}) => ({
  stop_reason: stop,
  usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 10, cache_creation_input_tokens: 5,
    server_tool_use: { web_search_requests: searches }, ...usage },
  content: [
    ...(text ? [{ type: "text", text }] : []),
    ...(results.length ? [{ type: "web_search_tool_result", content: results.map((r) => ({ type: "web_search_result", url: r, title: "t" })) }] : []),
  ],
});

test("one round: facts, sources and the API's own search count come back", async () => {
  const { out, calls } = await drive([
    round({ text: "The iPhone 17 costs $799.", results: ["https://a.example/one", "https://a.example/one", "https://b.example/two"], searches: 2 }),
  ]);
  assert.equal(calls.length, 1);
  assert.equal(out.facts, "The iPhone 17 costs $799.");
  assert.equal(out.searches, 2, "searches must come from server_tool_use, the count the bill uses");
  assert.equal(out.usage.in, 100);
  assert.equal(out.usage.out, 50);
  // Duplicate sources collapse — a search that cites one page three times is
  // one source in the brief.
  assert.deepEqual(out.sources.map((s) => s.url), ["https://a.example/one", "https://b.example/two"]);
});

test("a paused turn is continued with the assistant content resent unchanged", async () => {
  const { out, calls } = await drive([
    round({ stop: "pause_turn", text: "part one. ", results: ["https://a.example/"], searches: 1 }),
    round({ text: "part two.", searches: 1 }),
  ]);
  assert.equal(calls.length, 2, "the pause_turn continuation never happened");
  const msgs = calls[1].body.messages;
  assert.equal(msgs.length, 2);
  assert.equal(msgs[1].role, "assistant", "the continuation must resend the assistant turn");
  assert.equal(out.facts, "part one. part two.");
  assert.equal(out.searches, 2, "usage must ACCUMULATE across rounds — the bill depends on it");
  assert.equal(out.usage.in, 200, "token usage did not accumulate across rounds");
});

test("THE SEARCH CAP IS PER BUILD, NOT PER REQUEST — each round asks only for what is left", async () => {
  // The audit's finding: a flat `MAX_QUERIES + 1` on every round re-granted
  // the allowance each continuation, so one research call could legitimately
  // run ~16 searches where everything customer-facing promises ~3.
  const { calls } = await drive([
    round({ stop: "pause_turn", searches: 2 }),
    round({ searches: 1 }),
  ]);
  assert.equal(calls[0].body.tools[0].max_uses, MAX_QUERIES + 1, "round one gets the whole budget");
  assert.equal(calls[1].body.tools[0].max_uses, MAX_QUERIES + 1 - 2,
    "round two re-granted the full allowance — the per-build bound is not enforced");
});

test("A PAUSED TURN WITH THE BUDGET SPENT GETS ONE MORE ROUND — that is the round that answers", async () => {
  // A first draft BROKE here, and it was a worse bug than the overspend it was
  // meant to prevent. `pause_turn` means the server tool loop was cut MID-turn
  // and the model writes its brief AFTER it finishes searching — so "paused
  // with the budget spent" is precisely the round about to produce the answer.
  // Breaking spends every search and returns facts: "", the build pays for the
  // lookup, and the customer is told "Looked up current details on the web"
  // over a site written from training data.
  const { out, calls } = await drive([
    round({ stop: "pause_turn", text: "", searches: MAX_QUERIES + 1 }),
    round({ text: "The 2026 model costs 899." }),
  ]);
  assert.equal(calls.length, 2, "the answering round was thrown away — facts come back empty");
  assert.equal(out.facts, "The 2026 model costs 899.");
});

test("…and only ONE more: a second paused turn past the budget stops", async () => {
  // The overtime is one round, not slack. Bounded, or the whole per-build cap
  // goes back to being a suggestion.
  const { calls } = await drive([
    round({ stop: "pause_turn", searches: MAX_QUERIES + 1 }),
    round({ stop: "pause_turn", searches: 1 }),
    round({ text: "never asked for" }),
  ]);
  assert.equal(calls.length, 2, "the loop kept paying for rounds past its one round of overtime");
});

test("A PROVIDER THAT STOPS REPORTING ITS SEARCH COUNT CANNOT UNCAP THE BUILD", async () => {
  // The cap and the BILL read the same self-reported number, so a renamed or
  // dropped `server_tool_use` removes the cap and silences the charge at the
  // same time — the two failures compound instead of one catching the other:
  // four rounds at a full allowance apiece is 16 searches of real spend billed
  // at zero. The old test suite could not see it, because its round() helper
  // always supplied the field.
  const bare = ({ stop = "end_turn", searches = 0 } = {}) => {
    const r = round({ stop, searches });
    delete r.usage.server_tool_use;   // otherwise well-formed
    return r;
  };
  const { calls, out } = await drive([bare({ stop: "pause_turn" }), bare({ stop: "pause_turn" }), bare(), bare()]);
  const allowance = calls.reduce((n, c) => n + c.body.tools[0].max_uses, 0);
  assert.ok(allowance <= MAX_QUERIES + 2,
    "granted " + allowance + " searches of allowance with no count reported — the cap is unenforced");
  assert.equal(out.searches, 0, "an unreported count must not be invented into the bill");
});

test("…while an honest provider keeps its accurate, LOWER number", async () => {
  // The fallback is a fallback, not a second opinion: a model that used 2 of 4
  // must still get 2 back, or the conservative bound quietly halves a working
  // feature's budget.
  const { calls } = await drive([
    round({ stop: "pause_turn", searches: 2 }),
    round({ searches: 1 }),
  ]);
  assert.equal(calls[1].body.tools[0].max_uses, MAX_QUERIES + 1 - 2,
    "the provider's own count was discarded in favour of what we granted");
});

test("a thrown fetch and a non-2xx both come back empty-handed, never thrown", async () => {
  const boom = await drive([new Error("network down")]);
  assert.equal(boom.out.facts, "");
  assert.equal(boom.out.searches, 0);
  const bad = await drive([{ status: 500 }]);
  assert.equal(bad.out.facts, "");
  assert.deepEqual(bad.out.sources, []);
});

test("no queries and no key both mean NO request at all", async () => {
  const none = await drive([round({ text: "x" })], { queries: [] });
  assert.equal(none.calls.length, 0, "an empty query list still called the model");
  const { siteWebResearch } = await loadWorkerModule();
  const realFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = async () => { called++; return new Response("{}"); };
  try {
    const out = await siteWebResearch({}, "brief", ["q"]);
    assert.equal(called, 0, "a missing API key still called the model");
    assert.equal(out.searches, 0);
  } finally { globalThis.fetch = realFetch; }
});

// ── The failure is LOUD (site-context.mjs) ──────────────────────────────────

test("a wanted search that produced nothing is a FACT on the summary", () => {
  // `searched: false` alone is byte-identical to a build that never needed
  // research — so the customer whose brief the designer judged to need current
  // facts was silently handed training data (the audit's finding, against the
  // module's own THE FAILURE MUST BE LOUD headline).
  const failed = contextSummary({ searchWanted: true, searches: 0, facts: "" });
  assert.equal(failed.searchFailed, true);
  const fine = contextSummary({ searchWanted: true, searches: 2, facts: "real facts" });
  assert.ok(!fine.searchFailed);
  const never = contextSummary({ searchWanted: false, searches: 0 });
  assert.ok(!never.searchFailed, "an ordinary no-research build reads as failed");
  // Facts with no searches is degraded, not empty-handed — the model answered
  // from what it knew, and the facts still reach the pages.
  const partial = contextSummary({ searchWanted: true, searches: 0, facts: "from memory" });
  assert.ok(!partial.searchFailed);
});

test("THE EXPENSIVE FAILURE — searches ran and no facts came back — is the loud one", () => {
  // The discriminator is the FACTS, and a first draft keyed on the SEARCHES
  // (`!searches && !facts`), which excluded exactly the half that costs money:
  // the searches ran, the answering round was lost, facts came back empty. That
  // has searches > 0, so the flag stayed unset while `searched: true` made the
  // sentence claim the lookup worked — the customer told their site reflects
  // current facts while page generation ran on training data, AND billed ~5
  // credits for the searches.
  const s = contextSummary({ searchWanted: true, searches: 4, facts: "" });
  assert.equal(s.searchFailed, true,
    "a build that spent four searches and got nothing still reports as a success");
  // AND THE TWO SENTENCES ARE MUTUALLY EXCLUSIVE. `searched` is factually true
  // (searches did run) — but saying "Looked up current details on the web" is
  // precisely the claim that must not be made when nothing came back.
  const line = contextSentence(s);
  assert.doesNotMatch(line, /Looked up current details/,
    "the reply claims the lookup worked and that it failed, in one breath");
  assert.match(line, /Couldn't look up current details/);
});

test("the failed search reaches the chat sentence — and never the model's brief", () => {
  const s = contextSentence(contextSummary({ searchWanted: true, searches: 0 }));
  assert.match(s, /Couldn't look up current details/, "the customer is not told the lookup failed");
  assert.match(s, /wrote from your description/, "the sentence does not say what was done instead");
  // The brief says NOTHING about it: telling the model invites an apology
  // written into the site — the same rule failed links already follow.
  const brief = contextBrief("a phone shop", { facts: "", sources: [] });
  assert.ok(!/couldn|failed|sorry/i.test(brief), "the failure leaked into the model's brief");
});

test("the worker passes searchWanted from the research gate itself", () => {
  // The flag is `!!researchPromise` — the same expression that decides whether
  // research runs — so the summary and the gate cannot disagree about whether
  // a search was wanted.
  assert.match(workerSrc, /searchWanted: !!researchPromise/,
    "the summary is never told research was wanted — searchFailed can never fire in production");
});
