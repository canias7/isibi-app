// The paths pricecheck.mjs did NOT cover: image mode, audio mode, LipSync,
// multi-shot, and Veo Lite's fixed-8s first-&-last-frame.
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || "/opt/node22/lib/node_modules/playwright/index.mjs");
import { readFileSync } from "node:fs";
const ROOT = process.env.REPO_ROOT || process.cwd();
const OUT = process.env.ATTACH_OUT || "/tmp/attach-check";
const session = JSON.parse(readFileSync(`${OUT}/session.json`, "utf8"));
const worker = readFileSync(`${ROOT}/worker.js`, "utf8");
function lift(name, kind = "function") {
  const at = worker.indexOf(kind === "function" ? `\nfunction ${name}(` : `const ${name} = `);
  let bodyAt = worker.indexOf("{", at);
  if (kind === "function") {
    let p = 0, i = worker.indexOf("(", at);
    for (; i < worker.length; i++) { if (worker[i] === "(") p++; else if (worker[i] === ")" && --p === 0) break; }
    bodyAt = worker.indexOf("{", i);
  }
  let d = 0, out = "";
  for (let i = bodyAt; i < worker.length; i++) { out += worker[i]; if (worker[i] === "{") d++; else if (worker[i] === "}" && --d === 0) break; }
  return kind === "function" ? worker.slice(at, bodyAt) + out : `const ${name} = ${out};`;
}
const cost = new Function(["VIDEO_USD","IMAGE_USD","AUDIO_USD_PER_1K","GPT_PRICE"].map(n=>lift(n,"const")).join("\n")
  + "\nconst CREDIT_USD=0.008;const AUDIO_DRIVE_MAX_S=60;\n" + lift("creditCost") + "\nreturn creditCost;")();

const b = await chromium.launch({ args: ["--no-sandbox"] });
const p = await (await b.newContext({ viewport: { width: 1300, height: 800 } })).newPage();
await p.addInitScript((s) => localStorage.setItem("zephyr_session_v1", JSON.stringify(s)), session);
await p.goto((process.env.APP_URL || "http://127.0.0.1:8099") + "/index.html", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);

const rows = await p.evaluate(() => {
  const out = [];
  const q = (t) => { const s = estimatePrice(t); return s ? Number(String(s).replace(/[^\d]/g, "")) : null; };
  // IMAGE mode
  mode = "image";
  for (const m of ["fal-ai/nano-banana-pro", "openai/gpt-image-2"]) {
    model = m;
    for (const n of [1, 2, 4]) for (const ql of ["low","medium","high"]) for (const sz of ["1K","2K","4K"]) {
      numImages = n; quality = m === "openai/gpt-image-2" ? ql : sz; gptSize = sz; ratio = "16:9";
      out.push({ kind: "image", model: m, n, ql, sz, quote: q() });
    }
  }
  // AUDIO mode
  mode = "audio";
  for (const m of ["fal-ai/elevenlabs/tts/eleven-v3","fal-ai/elevenlabs/tts/turbo-v2.5","fal-ai/elevenlabs/tts/multilingual-v2"]) {
    model = m;
    for (const text of ["hi", "x".repeat(500), "y".repeat(2500)]) out.push({ kind: "audio", model: m, chars: text.length, quote: q(text) });
  }
  // LIPSYNC + multi-shot + Lite first&last
  mode = "video";
  model = "fal-ai/kling-video/lipsync/audio-to-video";
  for (const cs of [0, 3, 7, 10]) {
    attachments.clip = cs ? "data:video/mp4;base64,AAAA" : null;
    clipMeta = cs ? { dur: cs, w: 1280, h: 720, type: "video/mp4" } : null;
    out.push({ kind: "lipsync", model, clipSecs: cs, quote: q() });
  }
  attachments.clip = null; clipMeta = null;
  model = "fal-ai/veo3.1/lite"; quality = "720p"; duration = 4; soundOn = true;
  attachments.ffirst = "data:image/png;base64,AAAA"; attachments.flast = "data:image/png;base64,AAAA";
  out.push({ kind: "liteflf", model, quote: q() });
  attachments.ffirst = null; attachments.flast = null;
  // MULTI-SHOT: Kling bills the SUM of the shot durations, not the picker
  for (const m of ["fal-ai/kling-video/o3/pro/text-to-video", "fal-ai/kling-video/v3/pro/text-to-video"]) {
    model = m; duration = 5; soundOn = true;
    if (typeof shotsApply === "function" && !shotsApply(m)) continue;
    // sanitizeShots drops any shot without a prompt, and clamps each to 2-10s
    for (const shots of [[{prompt:"a",duration:3},{prompt:"b",duration:4}],
                         [{prompt:"a",duration:5},{prompt:"b",duration:5},{prompt:"c",duration:5}]]) {
      const s = estimatePrice(undefined, shots);
      out.push({ kind: "shots", model: m, sum: shots.reduce((t,x)=>t+x.duration,0),
        quote: s ? Number(String(s).replace(/[^\d]/g, "")) : null });
    }
  }
  return out;
});

let bad = 0;
for (const r of rows) {
  if (r.quote == null) { console.log("no quote:", r.kind, r.model); continue; }
  let charge;
  if (r.kind === "image") {
    charge = cost("image", r.model, { num: r.n, gptQuality: r.ql, gptSize: r.sz,
      img4k: r.model === "fal-ai/nano-banana-pro" && r.sz === "4K" });
  } else if (r.kind === "audio") {
    charge = cost("audio", r.model, { chars: Math.min(2000, r.chars) });
  } else if (r.kind === "lipsync") {
    charge = cost("video", r.model, { clipSeconds: r.clipSecs });
  } else if (r.kind === "liteflf") {
    charge = cost("video", r.model, { duration: 8, quality: "720p" });
  } else if (r.kind === "shots") {
    charge = cost("video", r.model, { duration: r.sum });   // worker: shotSecs
  }
  if (charge !== r.quote) { bad++; console.log(`MISMATCH [${r.kind}] ${r.model} ${JSON.stringify(r)} charge=${charge}`); }
}
console.log(`\n${rows.length - bad}/${rows.length} agree` + (bad ? `  — ${bad} MISMATCH` : "  ✅"));
await b.close();
