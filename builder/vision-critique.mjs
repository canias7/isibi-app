// Vision critique + automatic visual repair (the LIVE half of the design engine #3 / generated-app testing #4).
// After an app is generated + built, this renders each route in a headless browser, screenshots it, asks a vision
// model to critique the RENDERED result (layout, contrast, alignment, empty states, broken elements — things you
// cannot see from source), and feeds the critique back into a revise pass. It loops until the app looks right or
// a round cap is hit. This is what turns "the model can generate design" into "the app consistently looks right".
//
// WORKER-SAFE: this module is fetch + JSON only (no node:module / Playwright), so worker.js can import it to run
// the vision call. The headless render lives in vision-render.mjs (container-only). The vision call uses
// ANTHROPIC_API_KEY exactly like worker.js's existing /v1/messages calls, so it activates wherever the key is.

// The vision model default (override via opts.model). Vision-capable Claude.
export const DEFAULT_VISION_MODEL = "claude-sonnet-5";

// buildCritiquePrompt(ctx) — the instruction the vision model gets alongside the screenshot.
export function buildCritiquePrompt(ctx = {}) {
  const family = ctx.family ? `The intended design family is "${ctx.family}".` : "";
  const goal = ctx.goal ? `The app's goal: ${ctx.goal}.` : "";
  return [
    "You are a senior product designer reviewing a SCREENSHOT of a generated web app page.",
    goal, family,
    "Judge only what you can SEE in the render — layout, spacing, alignment, contrast/legibility, visual hierarchy,",
    "empty/blank areas, overflow or cut-off content, broken or unstyled elements, and overall polish.",
    "Respond with ONLY a JSON object, no prose, of the form:",
    '{"score": <0-100 overall visual quality>, "verdict": "<one short sentence>", "issues": [',
    '  {"severity": "critical|major|minor", "area": "<e.g. header, form, spacing>", "message": "<what is wrong>", "fix": "<a concrete change>"}',
    "]}",
    "A blank/near-empty page, unstyled default HTML, invisible text (contrast), or cut-off content are CRITICAL.",
    "If the page looks polished and intentional, return a high score with an empty issues array.",
  ].filter(Boolean).join(" ");
}

// parseCritique(text) — robustly extract the JSON critique; safe default on garbage.
export function parseCritique(text) {
  const raw = String(text || "");
  let obj = null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{"), end = candidate.lastIndexOf("}");
  if (start !== -1 && end > start) { try { obj = JSON.parse(candidate.slice(start, end + 1)); } catch {} }
  if (!obj || typeof obj !== "object") return { score: 0, verdict: "unparseable critique", issues: [{ severity: "critical", area: "system", message: "vision response could not be parsed", fix: "retry" }], ok: false };
  const score = Math.max(0, Math.min(100, Number(obj.score) || 0));
  const issues = Array.isArray(obj.issues) ? obj.issues.filter((i) => i && i.message).map((i) => ({
    severity: ["critical", "major", "minor"].includes(i.severity) ? i.severity : "minor",
    area: String(i.area || "general").slice(0, 60),
    message: String(i.message).slice(0, 400),
    fix: i.fix ? String(i.fix).slice(0, 400) : null,
  })) : [];
  return { score, verdict: String(obj.verdict || "").slice(0, 200), issues, ok: true };
}

// requestCritique(opts) — call the vision model on one screenshot; returns a parsed critique.
//   opts: { apiKey, model?, pngBase64, prompt, fetchImpl? } — fetchImpl is injectable for tests.
export async function requestCritique(opts) {
  const fetchImpl = opts.fetchImpl || fetch;
  if (!opts.apiKey) return { score: 0, verdict: "no api key", issues: [], ok: false, skipped: true };
  const body = {
    model: opts.model || DEFAULT_VISION_MODEL,
    max_tokens: 700,
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: "image/png", data: opts.pngBase64 } },
      { type: "text", text: opts.prompt || buildCritiquePrompt() },
    ] }],
  };
  const r = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) return { score: 0, verdict: "vision request failed (" + r.status + ")", issues: [], ok: false };
  const j = await r.json();
  const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  return parseCritique(text);
}

// critiquesToInstruction(critiques) — fold the issues from all routes into one revise instruction for the generator.
export function critiquesToInstruction(critiques) {
  const all = [];
  for (const c of critiques) for (const i of c.issues) all.push(`[${i.severity}] ${i.area}: ${i.message}${i.fix ? " → " + i.fix : ""}`);
  if (!all.length) return null;
  return "A visual review of the rendered app found these issues — fix them without changing the app's data model or routes:\n- " + all.slice(0, 25).join("\n- ");
}

// visualRepairLoop(opts) — the orchestration. Injectable render/critiqueOne/generate so it is testable offline:
//   render(files) → [{route,pngBase64}]      (default: build-then-render, provided by the caller)
//   critiqueOne(shot) → critique             (default: requestCritique with the shared apiKey+prompt)
//   generate(files, instruction) → files     (the revise pass — provided by the caller; this is the credit spend)
//   threshold (default 75), maxRounds (default 2)
// Returns { files, passed, rounds:[{minScore, critiques}] }.
export async function visualRepairLoop(opts) {
  const { render, generate } = opts;
  const critiqueOne = opts.critiqueOne || ((shot) => requestCritique({ apiKey: opts.apiKey, model: opts.model, pngBase64: shot.pngBase64, prompt: buildCritiquePrompt(opts.context || {}) }));
  const threshold = opts.threshold != null ? opts.threshold : 75;
  const maxRounds = opts.maxRounds != null ? opts.maxRounds : 2;
  let files = opts.files;
  const rounds = [];
  for (let round = 0; round < maxRounds; round++) {
    const shots = await render(files);
    const critiques = [];
    for (const s of shots) critiques.push(await critiqueOne(s));
    const minScore = critiques.length ? Math.min(...critiques.map((c) => c.score)) : 0;
    rounds.push({ minScore, critiques });
    if (minScore >= threshold) return { files, passed: true, rounds };
    const instruction = critiquesToInstruction(critiques);
    if (!instruction) return { files, passed: true, rounds }; // no actionable issues
    if (round === maxRounds - 1) break; // last round: critique recorded, no more revises
    files = await generate(files, instruction);
  }
  return { files, passed: false, rounds };
}
