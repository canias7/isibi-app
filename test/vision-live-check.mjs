// Live vision-critique check — runs ONLY in CI (workflow_dispatch), where ANTHROPIC_API_KEY is available from
// GitHub secrets. It sends two committed screenshot fixtures (a polished page and a deliberately broken one) to
// the real vision model and asserts the model scores the good one high and the broken one critical. This proves
// the live vision call + parsing works end-to-end with the real key. Exits non-zero on failure. Costs ~2 calls.
import { readFileSync } from "node:fs";
import { requestCritique, buildCritiquePrompt } from "../builder/vision-critique.mjs";

const key = process.env.ANTHROPIC_API_KEY;
if (!key) { console.error("ANTHROPIC_API_KEY not set — this script only runs in CI with the secret."); process.exit(2); }

const b64 = (p) => readFileSync(new URL(p, import.meta.url)).toString("base64");
const good = b64("./fixtures/vision/good.png");
const broken = b64("./fixtures/vision/broken.png");
const prompt = buildCritiquePrompt({ family: "studio-dark", goal: "a coffee-shop loyalty punch card" });

const g = await requestCritique({ apiKey: key, pngBase64: good, prompt });
const b = await requestCritique({ apiKey: key, pngBase64: broken, prompt });

console.log("GOOD   →", JSON.stringify({ score: g.score, verdict: g.verdict, issues: g.issues.length, ok: g.ok }));
console.log("BROKEN →", JSON.stringify({ score: b.score, verdict: b.verdict, issues: b.issues.map((i) => i.severity + ":" + i.area), ok: b.ok }));

const problems = [];
if (!g.ok) problems.push("good critique did not parse");
if (!b.ok) problems.push("broken critique did not parse");
if (g.score < 70) problems.push(`good scored too low (${g.score}, want ≥70)`);
if (b.score > 55) problems.push(`broken scored too high (${b.score}, want ≤55)`);
if (g.score <= b.score) problems.push(`good (${g.score}) should beat broken (${b.score})`);
if (!b.issues.some((i) => i.severity === "critical")) problems.push("broken page should have a critical issue (invisible text/blank)");

if (problems.length) { console.error("\nFAIL:\n- " + problems.join("\n- ")); process.exit(1); }
console.log("\nPASS: the live vision model scored the polished page high and the broken page critical.");
