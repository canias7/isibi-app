// Test bench for the free-account video watermark burn (fal blend-video).
// Runs in CI where FAL_KEY lives. Answers three questions before we wire
// this into /api/save:
//   1. Does blend-video accept our badge-overlay video and produce output?
//   2. Does the bottom video's AUDIO survive the blend? (lip-sync videos!)
//   3. What happens on a resolution/aspect mismatch — scale or error?
import { fal } from "@fal-ai/client";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "inherit"] }).toString();
const OUT = "wm-test-out";
mkdirSync(OUT, { recursive: true });

// ── 1. Build assets on the runner ────────────────────────────────────────
// Badge overlays: long black clips with the badge bottom-right (26% width,
// 2% pad — same spec as the Photon image burn). screen-blend leaves black
// pixels untouched, so only the badge region changes.
const overlays = [
  { name: "wm-overlay-169.mp4", w: 1920, h: 1080 },
  { name: "wm-overlay-916.mp4", w: 1080, h: 1920 },
];
for (const o of overlays) {
  const bw = 2 * Math.round((o.w * 0.26) / 2);
  const pad = Math.round(o.w * 0.02);
  sh("ffmpeg", ["-y", "-f", "lavfi", "-i", `color=c=black:s=${o.w}x${o.h}:d=60:r=24`,
    "-i", "public/wm-badge.png",
    "-filter_complex", `[1:v]scale=${bw}:-2[b];[0:v][b]overlay=W-w-${pad}:H-h-${pad}`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-preset", "fast",
    "-movflags", "+faststart", `${OUT}/${o.name}`]);
  console.log(`built ${o.name}: ${readFileSync(`${OUT}/${o.name}`).length} bytes`);
}
// Test sources WITH AUDIO (sine tone) — audio survival is the key question.
sh("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc2=s=1280x720:d=5:r=24",
  "-f", "lavfi", "-i", "sine=frequency=440:duration=5",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", `${OUT}/src-169.mp4`]);
sh("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc2=s=720x1280:d=5:r=24",
  "-f", "lavfi", "-i", "sine=frequency=440:duration=5",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", `${OUT}/src-916.mp4`]);

// ── 2. Upload to fal storage ─────────────────────────────────────────────
const up = async (path, name) => {
  const url = await fal.storage.upload(new File([readFileSync(path)], name, { type: "video/mp4" }));
  console.log(`uploaded ${name} -> ${url}`);
  return url;
};
const ov169 = await up(`${OUT}/wm-overlay-169.mp4`, "wm-overlay-169.mp4");
const src169 = await up(`${OUT}/src-169.mp4`, "src-169.mp4");
const src916 = await up(`${OUT}/src-916.mp4`, "src-916.mp4");

// ── 3. Blend tests ───────────────────────────────────────────────────────
async function blend(label, top, bottom) {
  const t0 = Date.now();
  try {
    const r = await fal.subscribe("fal-ai/workflow-utilities/blend-video", {
      input: { top_video_url: top, bottom_video_url: bottom, blend_mode: "screen", opacity: 0.8, shortest: true },
      logs: true,
      onQueueUpdate: (u) => console.log(`[${label}] ${u.status}`),
    });
    console.log(`[${label}] DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify(r.data));
    return r.data?.video?.url || null;
  } catch (e) {
    console.log(`[${label}] FAILED in ${((Date.now() - t0) / 1000).toFixed(1)}s:`, String(e), JSON.stringify(e?.body ?? {}));
    return null;
  }
}
const outA = await blend("A same-aspect 1080p-overlay/720p-source", ov169, src169);
const outB = await blend("B aspect-mismatch 16:9-overlay/9:16-source", ov169, src916);

// ── 4. Probe + frame-grab the results ────────────────────────────────────
async function inspect(label, url, file) {
  if (!url) { console.log(`[${label}] no output to inspect`); return; }
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(`${OUT}/${file}.mp4`, buf);
  const probe = JSON.parse(sh("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", `${OUT}/${file}.mp4`]));
  const streams = probe.streams.map((s) => `${s.codec_type}:${s.codec_name} ${s.width || ""}x${s.height || ""}`.trim());
  console.log(`[${label}] size=${buf.length}B dur=${probe.format?.duration}s streams=[${streams.join(", ")}] AUDIO=${probe.streams.some((s) => s.codec_type === "audio") ? "YES" : "NO !!"}`);
  sh("ffmpeg", ["-y", "-ss", "2", "-i", `${OUT}/${file}.mp4`, "-frames:v", "1", `${OUT}/${file}-frame.png`]);
}
await inspect("A", outA, "blend-A");
await inspect("B", outB, "blend-B");
console.log("test bench complete");
