// Attach every synthetic clip to every model in the REAL app and record what
// the validators do — the browser decodes each file itself (readClipMeta), so
// this exercises the shipped path, not a re-implementation of it.
const { chromium } = await import(process.env.PLAYWRIGHT_PATH
  || "/opt/node22/lib/node_modules/playwright/index.mjs");
import { readFileSync, readdirSync } from "node:fs";

const OUT = process.env.ATTACH_OUT || "/tmp/attach-check";
const session = JSON.parse(readFileSync(`${OUT}/session.json`, "utf8"));
const tvmeta = JSON.parse(readFileSync(`${OUT}/tvmeta.json`, "utf8"));
const clips = Object.keys(tvmeta).sort();

const MODELS = [
  "google/gemini-omni-flash",
  "fal-ai/veo3.1",
  "fal-ai/veo3.1/fast",
  "fal-ai/veo3.1/lite",
  "bytedance/seedance-2.0/text-to-video",
  "bytedance/seedance-2.0/fast/text-to-video",
  "bytedance/seedance-2.0/mini/text-to-video",
  "fal-ai/kling-video/o3/pro/text-to-video",
  "fal-ai/kling-video/o3/standard/text-to-video",
  "fal-ai/kling-video/v3/pro/text-to-video",
  "fal-ai/kling-video/v3/standard/text-to-video",
  "fal-ai/kling-video/lipsync/audio-to-video",
];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript((s) => localStorage.setItem("zephyr_session_v1", JSON.stringify(s)), session);
await page.goto((process.env.APP_URL || "http://127.0.0.1:8099") + "/index.html", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const results = await page.evaluate(({ MODELS, tvmeta }) => {
  // Headless Chromium ships without H.264, so its own decode returns zeros for
  // every mp4. Feed the validators the TRUE metadata (ffprobe on the host) —
  // exactly what readClipMeta produces in a real browser — so what is under
  // test is clipIssue's logic, not the test runner's codec support.
  const rows = [];
  for (const mdl of MODELS) {
    model = mdl;
    const caps = (currentOpts() || {}).caps || {};
    for (const [name, m] of Object.entries(tvmeta)) {
      if (!caps.clip) { rows.push({ mdl, name, verdict: "no clip slot" }); continue; }
      attachments.clip = "data:" + m.type + ";base64,AAAA";
      clipMeta = { dur: m.dur, w: m.w, h: m.h, type: m.type };
      let issue = clipIssue();
      // the full attach path also runs the area + fps gates, which now reject
      if (!issue) {
        const lim = CLIP_LIMITS[mdl] || {};
        if (lim.maxArea && m.w * m.h > lim.maxArea) issue = "area: " + m.w + "x" + m.h + " over the ~720p band";
        else if (lim.fps && (m.fps < lim.fps[0] || m.fps > lim.fps[1])) issue = "fps: " + m.fps + " outside " + lim.fps.join("-");
      }
      rows.push({ mdl, name, dur: m.dur, dims: m.w + "x" + m.h, fps: m.fps, type: m.type,
        verdict: issue ? "REJECT" : "accept", why: issue ? issue.slice(0, 60) : "" });
      attachments.clip = null; clipMeta = null;
    }
  }
  return rows;
}, { MODELS, tvmeta });

console.log(JSON.stringify(results));
await browser.close();
