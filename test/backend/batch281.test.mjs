// Batch 281 — SPAM / HONEYPOT SCORE. A stateless heuristic scorer for a form submission: a filled honeypot,
// a too-fast submit, too many links, shouting, and spam words each add to a 0–100 score with a verdict.
// Public (no auth). Covers clean → ham, honeypot → spam, fast → suspect, links, keywords, thresholds.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 281");
const slug = "b281";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const check = (body) => c.post(`/api/db/${slug}/spam-check`, body).then((r) => r.json);

// --- Clean submission → ham ---
let r = await check({ text: "Hi, I would love to learn more about your product. Thanks!", elapsed_ms: 8000 });
t.eq(r.verdict, "ham", "a normal message is ham");
t.eq(r.score, 0, "…score 0");

// --- Honeypot filled → spam ---
r = await check({ honeypot: "http://bot.example", text: "hello", elapsed_ms: 9000 });
t.ok(r.score >= 60, "a filled honeypot scores high");
t.eq(r.verdict, "spam", "…verdict spam");
t.ok(r.reasons.some((x) => /honeypot/.test(x)), "…reason names the honeypot");

// --- Too fast alone → 25 points, still ham ---
r = await check({ text: "quick note here", elapsed_ms: 500 });
t.ok(r.reasons.some((x) => /fast/.test(x)), "a sub-2s submit is flagged");
t.eq(r.score, 25, "…25 points on its own");
t.eq(r.verdict, "ham", "…still below the suspect threshold");

// --- Fast + shouting crosses into suspect ---
r = await check({ text: "HELLO THIS IS A SHORT SHOUTED MESSAGE OKAY", elapsed_ms: 500 });
t.eq(r.verdict, "suspect", "fast + all-caps → suspect");

// --- Too many links ---
r = await check({ text: "buy here http://a.com and http://b.com and http://c.com", elapsed_ms: 9000 });
t.ok(r.reasons.some((x) => /links/.test(x)), "3 links (over the default 2) flagged");

// --- Spam keywords + shouting + fast → spam-ish ---
r = await check({ text: "CHEAP VIAGRA AND CASINO BONUS CLICK NOW FOR CRYPTO", elapsed_ms: 500 });
t.ok(r.reasons.some((x) => /keyword/.test(x)), "spam keywords flagged");
t.ok(r.reasons.some((x) => /caps/.test(x)), "all-caps flagged");
t.ok(r.score >= 50, "…combined score is high");

// --- links_max override ---
r = await check({ text: "http://a.com http://b.com", links_max: 5, elapsed_ms: 9000 });
t.eq(r.score, 0, "raising links_max suppresses the link flag");

// --- Score is capped at 100 ---
r = await check({ honeypot: "x", text: "VIAGRA CASINO CRYPTO http://a http://b http://c aaaaaaaaaa", elapsed_ms: 10 });
t.ok(r.score <= 100, "the score never exceeds 100");

t.done(); h.restore();
