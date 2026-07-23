// Vision-critique tests — parse, prompt, the Anthropic request (mocked fetch), a REAL Playwright render, the
// instruction fold, and the repair loop against mocks. The only live-credit part (the actual vision call) is
// exercised with an injected fetch, so this whole suite is $0.
import { makeTally } from "./harness.mjs";
import {
  renderRoutes, buildCritiquePrompt, parseCritique, requestCritique, critiquesToInstruction, visualRepairLoop, DEFAULT_VISION_MODEL,
} from "../../builder/vision-critique.mjs";

const t = makeTally("Vision critique");

// --- parseCritique ---
t.eq(parseCritique('{"score":88,"verdict":"clean","issues":[]}').score, 88, "parses a plain JSON critique");
let p = parseCritique('Here is my review:\n```json\n{"score":40,"issues":[{"severity":"critical","area":"header","message":"blank"}]}\n```');
t.eq(p.score, 40, "parses fenced JSON inside prose");
t.eq(p.issues[0].severity, "critical", "…keeps the issue severity");
let g = parseCritique("totally not json");
t.eq(g.ok, false, "garbage → ok:false");
t.eq(g.score, 0, "…score 0");
t.eq(parseCritique('{"score":250,"issues":[{"severity":"bogus","message":"x"}]}').score, 100, "score clamps to 100");
t.eq(parseCritique('{"score":50,"issues":[{"severity":"bogus","message":"x"}]}').issues[0].severity, "minor", "unknown severity → minor");
t.eq(parseCritique('{"score":50,"issues":[{"severity":"major"}]}').issues.length, 0, "an issue with no message is dropped");

// --- buildCritiquePrompt ---
const prompt = buildCritiquePrompt({ family: "studio-dark", goal: "a task board" });
t.ok(/JSON/.test(prompt) && /"score"/.test(prompt), "prompt demands a JSON score");
t.ok(/CRITICAL/.test(prompt), "…and defines what's critical (blank/contrast/cut-off)");
t.ok(/studio-dark/.test(prompt) && /task board/.test(prompt), "…and includes the family + goal context");

// --- requestCritique with an injected fetch ---
let captured = null;
const fakeFetch = async (url, init) => { captured = { url, init }; return { ok: true, json: async () => ({ content: [{ type: "text", text: '{"score":92,"verdict":"nice","issues":[]}' }] }) }; };
let rc = await requestCritique({ apiKey: "sk-test", pngBase64: "AAAA", prompt: "crit", fetchImpl: fakeFetch });
t.eq(rc.score, 92, "requestCritique parses the model's JSON reply");
t.eq(captured.url, "https://api.anthropic.com/v1/messages", "…hits the Anthropic messages API");
t.eq(captured.init.headers["x-api-key"], "sk-test", "…sends the api key");
const sent = JSON.parse(captured.init.body);
t.eq(sent.model, DEFAULT_VISION_MODEL, "…uses the vision model");
t.eq(sent.messages[0].content[0].type, "image", "…sends the screenshot as an image block");
t.eq(sent.messages[0].content[0].source.data, "AAAA", "…with the base64 png");
// No key → skipped, no call.
let skip = await requestCritique({ pngBase64: "x", fetchImpl: () => { throw new Error("should not call"); } });
t.eq(skip.skipped, true, "no api key → skipped (no call)");
// Non-200 → failure critique.
let fail = await requestCritique({ apiKey: "k", pngBase64: "x", fetchImpl: async () => ({ ok: false, status: 500 }) });
t.eq(fail.ok, false, "a non-200 vision response → ok:false");

// --- critiquesToInstruction ---
t.eq(critiquesToInstruction([{ issues: [] }, { issues: [] }]), null, "no issues → no instruction");
let instr = critiquesToInstruction([{ issues: [{ severity: "critical", area: "hero", message: "text invisible", fix: "raise contrast" }] }]);
t.ok(/critical/.test(instr) && /raise contrast/.test(instr), "issues fold into a revise instruction");

// --- REAL Playwright render of a fixture (proves the screenshot pipeline, $0) ---
const shots = await renderRoutes({ html: "<h1 style='font:30px system-ui;color:#111'>Task Board</h1>" }, ["/"], { width: 800, height: 400 });
t.eq(shots.length, 1, "renders one screenshot");
t.ok(shots[0].pngBase64.length > 500, "…a non-trivial PNG");
t.eq(Buffer.from(shots[0].pngBase64, "base64").slice(0, 4).toString("hex"), "89504e47", "…valid PNG magic bytes");

// --- visualRepairLoop with mocks ---
// (a) passes immediately when the first render already scores high.
let genCalls = 0;
const gen = async (files) => { genCalls++; return { ...files, revised: genCalls }; };
let a = await visualRepairLoop({ files: { v: 0 }, render: async () => [{ pngBase64: "x" }], critiqueOne: async () => ({ score: 90, issues: [] }), generate: gen, threshold: 75 });
t.eq(a.passed, true, "a good app passes on round 1");
t.eq(genCalls, 0, "…and no revise was needed");

// (b) iterates: round 0 low → revise → round 1 high → passed.
genCalls = 0; let round = 0;
let b = await visualRepairLoop({ files: { v: 0 }, threshold: 75, maxRounds: 2,
  render: async () => [{ pngBase64: "x" }],
  critiqueOne: async () => (round++ === 0 ? { score: 30, issues: [{ severity: "major", area: "x", message: "cramped" }] } : { score: 88, issues: [] }),
  generate: gen });
t.eq(b.passed, true, "iterates then passes after a repair");
t.eq(genCalls, 1, "…revised exactly once");
t.eq(b.rounds.length, 2, "…recorded both rounds");

// (c) never fixed → fails after the round cap.
genCalls = 0;
let c = await visualRepairLoop({ files: { v: 0 }, threshold: 75, maxRounds: 2,
  render: async () => [{ pngBase64: "x" }],
  critiqueOne: async () => ({ score: 20, issues: [{ severity: "critical", area: "x", message: "blank" }] }),
  generate: gen });
t.eq(c.passed, false, "an unfixable app fails after maxRounds");
t.eq(genCalls, 1, "…revised (maxRounds-1) times, no wasted final revise");

t.done();
