// Quote-vs-charge parity. The button says "✦ N" from estimatePrice() in the
// browser; the ledger is debited by creditCost() in the worker. Nothing has
// ever compared them — and a quote that disagrees with the charge is exactly
// what the Gemini clip edit did (quoted 30s of input, delivered 10).
//
// estimatePrice reads module-scope globals, so it runs in the real page; the
// worker's creditCost is lifted out of worker.js and run here. Same inputs,
// both sides, every combination.
const { chromium } = await import(process.env.PLAYWRIGHT_PATH
  || "/opt/node22/lib/node_modules/playwright/index.mjs");
import { readFileSync } from "node:fs";

const ROOT = process.env.REPO_ROOT || process.cwd();
const OUT = process.env.ATTACH_OUT || "/tmp/attach-check";
const session = JSON.parse(readFileSync(`${OUT}/session.json`, "utf8"));
const worker = readFileSync(`${ROOT}/worker.js`, "utf8");

// --- lift the worker's real pricing ---
function lift(name, kind = "function") {
  const at = worker.indexOf(kind === "function" ? `\nfunction ${name}(` : `const ${name} = `);
  if (at < 0) throw new Error("missing " + name);
  // creditCost destructures in its SIGNATURE, so the first "{" after the name
  // is the params object, not the body — walk past the closing paren first.
  let bodyAt = worker.indexOf("{", at);
  if (kind === "function") {
    let p = 0, i = worker.indexOf("(", at);
    for (; i < worker.length; i++) {
      if (worker[i] === "(") p++;
      else if (worker[i] === ")" && --p === 0) break;
    }
    bodyAt = worker.indexOf("{", i);
  }
  let d = 0, out = "";
  for (let i = bodyAt; i < worker.length; i++) {
    out += worker[i];
    if (worker[i] === "{") d++;
    else if (worker[i] === "}" && --d === 0) break;
  }
  return kind === "function" ? worker.slice(at, bodyAt) + out : `const ${name} = ${out};`;
}

const serverCost = new Function(
  ["VIDEO_USD", "IMAGE_USD", "AUDIO_USD_PER_1K", "GPT_PRICE"].map((n) => lift(n, "const")).join("\n") +
  "\nconst CREDIT_USD = 0.008;\nconst AUDIO_DRIVE_MAX_S = 60;\n" +
  lift("creditCost") + "\nreturn creditCost;")();

const MODELS = [
  "google/gemini-omni-flash", "fal-ai/veo3.1", "fal-ai/veo3.1/fast", "fal-ai/veo3.1/lite",
  "bytedance/seedance-2.0/text-to-video", "bytedance/seedance-2.0/fast/text-to-video",
  "bytedance/seedance-2.0/mini/text-to-video",
  "fal-ai/kling-video/o3/pro/text-to-video", "fal-ai/kling-video/o3/standard/text-to-video",
  "fal-ai/kling-video/v3/pro/text-to-video", "fal-ai/kling-video/v3/standard/text-to-video",
];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 800 } })).newPage();
await page.addInitScript((s) => localStorage.setItem("zephyr_session_v1", JSON.stringify(s)), session);
await page.goto((process.env.APP_URL || "http://127.0.0.1:8099") + "/index.html", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const quotes = await page.evaluate((MODELS) => {
  const rows = [];
  mode = "video";
  const reset = () => { attachments.clip = null; attachments.image = null;
    attachments.ffirst = null; attachments.flast = null; refList.length = 0;
    clipMeta = null; shotsOverride = null; };
  for (const m of MODELS) {
    model = m;
    const o = currentOpts() || {};
    const durs = o.durations || [5];
    const quals = o.resolutions || [null];
    // --- plain generation ---
    for (const d of durs) for (const q of quals) for (const snd of [true, false]) {
      reset(); duration = d; if (q) quality = q; soundOn = snd;
      const txt = estimatePrice();
      rows.push({ kind: "gen", model: m, dur: d, qual: q, soundOn: snd,
        quote: txt ? Number(String(txt).replace(/[^\d]/g, "")) : null });
    }
    const caps = o.caps || {};
    // --- clip attached: extend (Veo, fixed 7s) / edit (Gemini, o3 — whole clip) ---
    if (caps.clip) for (const clipSecs of [4, 9, 14]) {
      reset(); duration = 5; if (quals[0]) quality = quals[0]; soundOn = true;
      attachments.clip = "data:video/mp4;base64,AAAA";
      clipMeta = { dur: clipSecs, w: 1280, h: 720, type: "video/mp4" };
      const txt = estimatePrice();
      rows.push({ kind: "clip", model: m, dur: 5, qual: quals[0] || null, soundOn: true,
        clipSecs, quote: txt ? Number(String(txt).replace(/[^\d]/g, "")) : null });
    }
    // --- reference-to-video (Veo locks output to 8s) ---
    if (caps.ref) {
      reset(); duration = 5; if (quals[0]) quality = quals[0]; soundOn = true;
      refList.push("data:image/png;base64,AAAA");
      const txt = estimatePrice();
      rows.push({ kind: "ref", model: m, dur: 5, qual: quals[0] || null, soundOn: true,
        quote: txt ? Number(String(txt).replace(/[^\d]/g, "")) : null });
    }
    reset();
  }
  return rows;
}, MODELS);

let bad = 0, checked = 0;
const isVeo = (m) => /veo/.test(m);
const isO3 = (m) => /kling-video\/o3/.test(m);
const isGem = (m) => /gemini-omni/.test(m);
for (const r of quotes) {
  if (r.quote == null) continue;
  let billDur = r.dur, v2v = false, clipSeconds = 0, vrefSeconds = 0;
  if (r.kind === "clip") {
    if (isVeo(r.model)) billDur = 7;                       // extend-video: schema const 7s
    else if (isGem(r.model)) { billDur = Math.min(30, Math.ceil(r.clipSecs)); clipSeconds = r.clipSecs; }
    else if (isO3(r.model)) { billDur = Math.min(15, Math.ceil(r.clipSecs)); v2v = true; clipSeconds = r.clipSecs; }
    else { // Seedance: the clip is a REFERENCE — fal prices video input at
           // 0.6x over (input + output) seconds, so pass vrefSeconds like the
           // worker does rather than treating it as a plain generation.
      vrefSeconds = Math.min(15, Math.ceil(r.clipSecs));
    }
  } else if (r.kind === "ref" && isVeo(r.model)) billDur = 8;
  const charge = serverCost("video", r.model, {
    duration: billDur, quality: r.qual || undefined, soundOff: !r.soundOn,
    v2v, clipSeconds, vrefSeconds,
  });
  checked++;
  if (charge !== r.quote) {
    bad++;
    console.log(`MISMATCH [${r.kind}] ${r.model} dur=${r.dur} clip=${r.clipSecs ?? "-"} q=${r.qual} sound=${r.soundOn}  quote=${r.quote} charge=${charge}`);
  }
}
console.log(`\n${checked - bad}/${checked} combinations agree` + (bad ? `  — ${bad} MISMATCH` : "  ✅"));
await browser.close();
