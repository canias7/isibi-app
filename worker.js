// Photon (WASM) for server-side image watermarking — the workerd build
// instantiates the wasm synchronously on import, so the functions are ready to
// call. Bundled by wrangler at deploy (see package.json).
import { PhotonImage, watermark, resize, SamplingFilter } from "@cf-wasm/photon";
import { Container, getContainer } from "@cloudflare/containers";
import { parseGeneratedFiles, REACT_RULES, REACT_FIX_RULES, REACT_REVISE_RULES, SCHEMA_REPAIR_RULES, WIRING_REPAIR_RULES } from "./builder/react-gen.mjs";

// React-builder build-service container (Phase 3). Runs the build-server.mjs
// image (Node + Vite + pinned deps); the Worker POSTs generated project files to
// its /build and gets back the compiled static dist. Sleeps after idle to scale
// to zero. Configured in wrangler.jsonc (containers + BUILD_CONTAINER binding).
export class BuildContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "3m";
}

const VIDEO_MODELS = new Set([
  "bytedance/seedance-2.0/text-to-video",
  "bytedance/seedance-2.0/fast/text-to-video",
  "bytedance/seedance-2.0/mini/text-to-video",
  "fal-ai/kling-video/v3/pro/text-to-video",
  "fal-ai/kling-video/v3/standard/text-to-video",
  "google/gemini-omni-flash",
  "fal-ai/veo3.1",
  "fal-ai/veo3.1/fast",
  "fal-ai/veo3.1/lite",
  "fal-ai/kling-video/o3/pro/text-to-video",
  "fal-ai/kling-video/o3/standard/text-to-video",
  "fal-ai/kling-video/lipsync/audio-to-video",
]);
const DEFAULT_VIDEO_MODEL = "bytedance/seedance-2.0/fast/text-to-video";
// Audio-driven lip-sync models take no text prompt — they run off attachments.
// (LipSync's text mode ACCEPTS text, but never requires it. OmniHuman 1.0/1.5
// were removed 2026-07-17, owner's call.)
const PROMPTLESS_VIDEO = new Set([
  "fal-ai/kling-video/lipsync/audio-to-video",
]);

const IMAGE_MODELS = new Set([
  "fal-ai/nano-banana-pro",
  "openai/gpt-image-2",
]);
const DEFAULT_IMAGE_MODEL = "fal-ai/nano-banana-pro";

// Image editing: attaching an image in Image mode routes to the model's
// edit / image-to-image endpoint. `multi` → image_urls[] vs a single image_url.
// Models not listed here don't offer editing (the picker is hidden for them).
const IMAGE_EDIT = {
  "fal-ai/nano-banana-pro":                      { endpoint: "fal-ai/nano-banana-pro/edit",            multi: true },
  "openai/gpt-image-2":                          { endpoint: "openai/gpt-image-2/edit",                multi: true },
};

// Audio mode is voice generation (text-to-speech).
const AUDIO_MODELS = new Set([
  "fal-ai/elevenlabs/tts/eleven-v3",
  "fal-ai/elevenlabs/tts/turbo-v2.5",
  "fal-ai/elevenlabs/tts/multilingual-v2",
]);
const DEFAULT_AUDIO_MODEL = "fal-ai/elevenlabs/tts/eleven-v3";

// ── Auth ─────────────────────────────────────────────
// The paid endpoints (generation + director) require a signed-in Supabase
// user. The anon key is public by design; token verification is delegated to
// Supabase GoTrue so no JWT secret needs to live in the Worker.
const SUPABASE_URL = "https://ujrqdmmtcptvimazlhom.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4";

// ── Credits: 1 credit = $0.008 of fal cost, charged BEFORE fal is called ──
// The ledger lives in Postgres (public.credits + use_credits/get_credits,
// SECURITY DEFINER, RLS owner-only). The Worker calls it under the caller's
// own JWT, so the client can display but never mint credits.
const CREDIT_USD = 0.008;
const VIDEO_USD = {
  // aoff = audio-off rates (fal bills less with generate_audio:false; applied
  // only when the director's "silent" flag is set — verified on fal's pricing
  // pages 2026-07-15: Veo halves, Kling v3 pro 0.112 / std 0.084, o3 0.112).
  "fal-ai/veo3.1":                                { s: { "720p": 0.40, "1080p": 0.40, "4k": 0.60 }, aoff: { "720p": 0.20, "1080p": 0.20, "4k": 0.40 }, d: 8 },
  // Veo 3.1 Fast (fal page 2026-07-16): 720p/1080p $0.15/s audio-on, $0.10/s off;
  // 4k $0.35/s on, $0.30/s off. Same endpoints/shapes as full Veo, ~2.7× cheaper.
  "fal-ai/veo3.1/fast":                           { s: { "720p": 0.15, "1080p": 0.15, "4k": 0.35 }, aoff: { "720p": 0.10, "1080p": 0.10, "4k": 0.30 }, d: 8 },
  // Lite (t2v + i2v only, no 4k) — verified on fal's page 2026-07-17: unlike
  // Standard/Fast, 1080p genuinely costs more than 720p here.
  "fal-ai/veo3.1/lite":                           { s: { "720p": 0.05, "1080p": 0.08 }, aoff: { "720p": 0.03, "1080p": 0.05 }, d: 8 },
  // v2s = video-to-video rates (clip re-render bills higher than t2v/i2v).
  // Seedance has no published audio-off discount — silent renders bill the same.
  "bytedance/seedance-2.0/text-to-video":         { s: { "480p": 0.14, "720p": 0.304, "1080p": 0.682, "4k": 1.59 }, d: 5 },
  // (fast tier has no 1080p on fal — resolution enum is 480p/720p only)
  "bytedance/seedance-2.0/fast/text-to-video":    { s: { "480p": 0.135, "720p": 0.242 }, d: 5 },
  "bytedance/seedance-2.0/mini/text-to-video":    { s: { "480p": 0.0725, "720p": 0.155 }, d: 5 },
  // o3's video-to-video/edit bills a 20% premium over t2v ($0.168/s vs $0.14/s
  // — verified on fal's pricing page + a real $2.52 bill for a 15s edit).
  // o3 t2v/i2v now send generate_audio:true, matching the $0.14/s audio-on rate.
  "fal-ai/kling-video/o3/pro/text-to-video":      { s: { def: 0.14 }, aoff: { def: 0.112 }, v2s: { def: 0.168 }, d: 5 },
  // o3 Standard (fal pages 2026-07-16): t2v/i2v/ref $0.112/s audio-on, $0.084/s
  // off; the video-to-video edit bills $0.126/s (same whole-clip basis as pro).
  "fal-ai/kling-video/o3/standard/text-to-video": { s: { def: 0.112 }, aoff: { def: 0.084 }, v2s: { def: 0.126 }, d: 5 },
  "fal-ai/kling-video/v3/pro/text-to-video":      { s: { def: 0.168 }, aoff: { def: 0.112 }, d: 5 },
  "fal-ai/kling-video/v3/standard/text-to-video": { s: { def: 0.126 }, aoff: { def: 0.084 }, d: 5 },
  "google/gemini-omni-flash":                     { s: { def: 0.13 }, d: 8 },
  // LipSync bills on the INPUT VIDEO's seconds ($0.014/s, rolled UP to the next
  // 5s increment) — not the audio. Billed from the client-reported clip length,
  // defaulting to the 10s max when unknown (never undercharge).
  "fal-ai/kling-video/lipsync/audio-to-video":    { videoPer5s: 0.014 },
};
// Kling LipSync text-mode voices — the curated English subset of the schema's
// voice_id enum (the rest are Chinese-language voices). Mirrored in the UI.
const KLS_VOICES = new Set([
  "reader_en_m-v1", "commercial_lady_en_f-v1", "uk_man2", "uk_boy1",
  "uk_oldman3", "ai_kaiya", "oversea_male1",
]);
// GPT Image 2 $/image by SIZE tier × QUALITY — a small margin over fal's max
// price for each tier's pixel budget (1K ≤1024²-class, 2K ≤2560×1440, 4K
// ≤3840×2160). Never undercharges; mirrored on the client.
const GPT_PRICE = {
  // 1K high is $0.23 (not $0.211) to cover the worst case where fal's undocumented
  // named preset maps to a 2560×1440-class image ($0.222) instead of ~1024².
  "1K": { low: 0.008, medium: 0.06,  high: 0.23 },
  "2K": { low: 0.008, medium: 0.06,  high: 0.23 },
  "4K": { low: 0.014, medium: 0.104, high: 0.41 },
};
// Explicit {width,height} for GPT's 2K/4K tiers at a given ratio. Scaled to the
// tier's pixel budget (2K≈2560×1440, 4K≈3840×2160) and floored to /16 so the
// pixel count never exceeds the budget — keeping billing on the priced class.
function gptSizePx(ratio, tier) {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(ratio || "");
  if (!m) return null;
  const rw = +m[1], rh = +m[2];
  const budget = tier === "4K" ? 8_290_000 : 3_690_000;
  const scale = Math.sqrt(budget / (rw * rh));
  const w = Math.min(3840, Math.floor((rw * scale) / 16) * 16);
  const h = Math.min(3840, Math.floor((rh * scale) / 16) * 16);
  return (w >= 16 && h >= 16) ? { width: w, height: h } : null;
}
const IMAGE_USD = {
  "fal-ai/nano-banana-pro": 0.15,
  // Token-billed; fal's own table puts a High-quality 1024² at $0.211 (edit
  // $0.219) — the old $0.12 undercharged ~2× since quality defaults to auto.
  "openai/gpt-image-2": 0.22,
};
const AUDIO_USD_PER_1K = {
  "fal-ai/elevenlabs/tts/eleven-v3": 0.10,
  "fal-ai/elevenlabs/tts/turbo-v2.5": 0.05,
  "fal-ai/elevenlabs/tts/multilingual-v2": 0.10,
};

// Audio-driven video models (Kling LipSync) are billed by fal on
// the driving clip's real length, so we cap and charge by measured seconds.
const AUDIO_DRIVE_MAX_S = 60;

// Live fal platform balance (GET api.fal.ai/v1/account/billing — official
// Platform API). Cached 60s per isolate; null = unknown (endpoint down, or
// FAL_KEY isn't admin-scoped) and callers MUST fail open on null so a
// monitoring hiccup can never block paying users.
let _falBal = { at: 0, usd: null };
async function falBalanceUSD(env) {
  if (!env.FAL_KEY) return null;
  if (Date.now() - _falBal.at < 60_000) return _falBal.usd;
  let usd = null;
  try {
    const r = await fetch("https://api.fal.ai/v1/account/billing?expand=credits", {
      headers: { Authorization: `Key ${env.FAL_KEY}` },
      signal: AbortSignal.timeout(4000),
    });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      const v = j && j.credits && j.credits.current_balance;
      if (Number.isFinite(+v)) usd = +v;
    }
  } catch (e) {}
  _falBal = { at: Date.now(), usd };
  return usd;
}

// Generation credits are now PURE fal cost — the director's Claude bill is no
// longer folded in here. AI usage is a separate paid product (the AI
// Orchestrator add-on), metered against its own $19.99 budget, so charging it
// again on the generation would double-bill.
function creditCost(kind, model, { duration, quality, num, chars, audioSeconds, v2v, clipSeconds, soundOff, vrefSeconds, img4k, gptQuality, gptSize }) {
  let usd;
  // GPT Image 2 is priced by quality tier; Nano Banana Pro 4K bills double the
  // base rate (1K/2K bill base); everything else is a flat per-image rate.
  if (kind === "image") {
    if (model === "openai/gpt-image-2") {
      const t = GPT_PRICE[gptSize] || GPT_PRICE["1K"];
      usd = (t[gptQuality] != null ? t[gptQuality] : t.high) * (num || 1);
    } else {
      usd = (IMAGE_USD[model] || 0.15) * (num || 1) * (img4k ? 2 : 1);
    }
  }
  else if (kind === "audio") usd = (Math.max(chars || 0, 40) / 1000) * (AUDIO_USD_PER_1K[model] || 0.10);
  else {
    const p = VIDEO_USD[model];
    const secs = Math.max(1, Math.min(AUDIO_DRIVE_MAX_S, Math.round(audioSeconds || 0)));
    if (!p) usd = 3; // unlisted video model: charge high, never undercharge
    else if (p.audioPerSec != null) usd = p.audioPerSec * secs;
    else if (p.videoPer5s != null) {
      // Billed on the input clip's length, rolled UP to the next 5s (LipSync:
      // $0.014/s). Unknown length bills the 10s max — never undercharge.
      const vs = Math.max(2, Math.min(10, Math.round(clipSeconds || 0) || 10));
      usd = p.videoPer5s * Math.ceil(vs / 5) * 5;
    }
    else if (p.flat != null) usd = p.flat;
    else {
      // Unknown quality never undercharges: fall back to def, else the highest
      // listed tier (not 720p, which could be cheaper than what fal renders).
      // Rate table: clip attached → v2s (re-render premium); else the t2v rates —
      // discounted to aoff when the render is explicitly silent (Veo, Kling).
      const tbl = v2v && p.v2s ? p.v2s : (soundOff && p.aoff ? p.aoff : p.s);
      const tiers = Object.values(tbl).filter((n) => typeof n === "number");
      const maxTier = tiers.length ? Math.max(...tiers) : 0.4;
      const rate = tbl[quality] != null ? tbl[quality] : tbl.def != null ? tbl.def : maxTier;
      // Seedance reference-to-video WITH a @Video1 clip: fal's page prices video
      // input at 0.6× the rate over (input + output) seconds — bill that basis
      // (covers both published readings; to be relaxed if a live job bills less).
      if (vrefSeconds) usd = 0.6 * (rate != null ? rate : maxTier) * (vrefSeconds + (duration || p.d || 5));
      else usd = (rate != null ? rate : maxTier) * (duration || p.d || 5);
    }
  }
  return Math.max(1, Math.ceil(usd / CREDIT_USD));
}

// Read the TRUE length (seconds) out of an uploaded audio data URI, so the
// lip-sync charge matches what fal bills — fal bills by the real driving-audio
// length, and a tampered client could otherwise claim a short duration on a
// long clip and underpay. Returns a
// number when a header can be parsed confidently, else null (caller falls back
// to the conservative size-derived floor). Covers WAV, MP3 (CBR + Xing/Info
// VBR) and MP4/M4A — the formats a voice clip actually arrives in.
function audioDurationFromDataUri(dataUri) {
  if (typeof dataUri !== "string") return null;
  const comma = dataUri.indexOf(",");
  if (comma < 0 || !/;base64/i.test(dataUri.slice(0, comma))) return null;
  let b;
  try {
    const bin = atob(dataUri.slice(comma + 1));
    const n = bin.length;
    b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = bin.charCodeAt(i);
  } catch { return null; }
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const wav = durWav(b, dv);
  if (wav != null) return wav;
  const mp4 = durMp4(b, dv);
  if (mp4 != null) return mp4;
  return durMp3(b);
}

// Real duration of a video clip data URI (mp4/mov both use moov→mvhd) — so
// LipSync billing measures the clip instead of trusting the client's claim.
function videoDurationFromDataUri(dataUri) {
  if (typeof dataUri !== "string") return null;
  const comma = dataUri.indexOf(",");
  if (comma < 0 || !/;base64/i.test(dataUri.slice(0, comma))) return null;
  let b;
  try {
    const bin = atob(dataUri.slice(comma + 1));
    b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  } catch { return null; }
  return durMp4(b, new DataView(b.buffer, b.byteOffset, b.byteLength));
}

// RIFF/WAVE: duration = data-chunk bytes / byteRate (exact for PCM).
function durWav(b, dv) {
  if (b.length < 44) return null;
  if (b[0] !== 0x52 || b[1] !== 0x49 || b[2] !== 0x46 || b[3] !== 0x46) return null; // "RIFF"
  if (b[8] !== 0x57 || b[9] !== 0x41 || b[10] !== 0x56 || b[11] !== 0x45) return null; // "WAVE"
  let off = 12, byteRate = 0, dataSize = 0;
  while (off + 8 <= b.length) {
    const id = String.fromCharCode(b[off], b[off + 1], b[off + 2], b[off + 3]);
    const size = dv.getUint32(off + 4, true);
    if (id === "fmt " && off + 24 <= b.length) byteRate = dv.getUint32(off + 16, true);
    else if (id === "data") {
      dataSize = size && off + 8 + size <= b.length ? size : b.length - (off + 8);
      break;
    }
    off += 8 + size + (size & 1); // chunks are word-aligned
  }
  return byteRate > 0 && dataSize > 0 ? dataSize / byteRate : null;
}

// ISO base-media (mp4/m4a/aac-in-mp4): moov → mvhd → duration / timescale.
function durMp4(b, dv) {
  if (b.length < 16) return null;
  if (b[4] !== 0x66 || b[5] !== 0x74 || b[6] !== 0x79 || b[7] !== 0x70) return null; // "ftyp"
  const find = (start, end, name) => {
    let off = start;
    while (off + 8 <= end) {
      let size = dv.getUint32(off), hdr = 8;
      const type = String.fromCharCode(b[off + 4], b[off + 5], b[off + 6], b[off + 7]);
      if (size === 1) { if (off + 16 > end) break; size = Number(dv.getBigUint64(off + 8)); hdr = 16; }
      else if (size === 0) size = end - off;
      if (size < hdr) break;
      if (type === name) return { off, size, hdr };
      off += size;
    }
    return null;
  };
  const moov = find(0, b.length, "moov");
  if (!moov) return null;
  const mvhd = find(moov.off + moov.hdr, Math.min(moov.off + moov.size, b.length), "mvhd");
  if (!mvhd) return null;
  const p = mvhd.off + mvhd.hdr; // version(1) + flags(3) then the fields
  if (p + 20 > b.length) return null;
  if (b[p] === 1) {
    if (p + 32 > b.length) return null;
    const ts = dv.getUint32(p + 20), dur = Number(dv.getBigUint64(p + 24));
    return ts ? dur / ts : null;
  }
  const ts = dv.getUint32(p + 12), dur = dv.getUint32(p + 16);
  return ts ? dur / ts : null;
}

// MPEG audio: honour a Xing/Info VBR header (exact frame count) else assume CBR
// from the first frame's bitrate over the remaining bytes.
const MP3_BR = {
  // [MPEG1 L1, L2, L3, MPEG2/2.5 L1, L2&L3] in kbps, indexed by the 4-bit field
  1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0],
  2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0],
  3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  4: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0],
  5: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
};
function durMp3(b) {
  const total = b.length;
  let i = 0;
  if (total > 10 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) { // "ID3" v2 tag
    i = 10 + ((b[6] & 0x7f) << 21 | (b[7] & 0x7f) << 14 | (b[8] & 0x7f) << 7 | (b[9] & 0x7f));
    if (b[5] & 0x10) i += 10; // footer present
  }
  const scanEnd = Math.min(total - 4, i + 200000);
  while (i <= scanEnd && !(b[i] === 0xff && (b[i + 1] & 0xe0) === 0xe0)) i++;
  if (i + 4 > total || !(b[i] === 0xff && (b[i + 1] & 0xe0) === 0xe0)) return null;
  const b1 = b[i + 1], b2 = b[i + 2], b3 = b[i + 3];
  const verBits = (b1 >> 3) & 3, layerBits = (b1 >> 1) & 3;
  if (verBits === 1 || layerBits === 0) return null; // reserved
  const layer = 4 - layerBits;                       // 1 | 2 | 3
  const isV1 = verBits === 3;
  const brRow = layer === 1 ? (isV1 ? 1 : 4) : layer === 2 ? (isV1 ? 2 : 5) : (isV1 ? 3 : 5);
  const brIdx = (b2 >> 4) & 0xf, srIdx = (b2 >> 2) & 3;
  if (brIdx === 0 || brIdx === 15 || srIdx === 3) return null;
  const bitrate = MP3_BR[brRow][brIdx] * 1000;
  const srTable = verBits === 3 ? [44100, 48000, 32000] : verBits === 2 ? [22050, 24000, 16000] : [11025, 12000, 8000];
  const sr = srTable[srIdx];
  if (!bitrate || !sr) return null;
  const spf = layer === 1 ? 384 : layer === 3 && !isV1 ? 576 : 1152; // samples/frame
  // Xing/Info header lives after the side-info block of the first frame.
  const chanMode = (b3 >> 6) & 3;
  const sideInfo = isV1 ? (chanMode === 3 ? 17 : 32) : (chanMode === 3 ? 9 : 17);
  const x = i + 4 + sideInfo;
  if (x + 12 <= total) {
    const tag = String.fromCharCode(b[x], b[x + 1], b[x + 2], b[x + 3]);
    if (tag === "Xing" || tag === "Info") {
      const flags = (b[x + 4] << 24 | b[x + 5] << 16 | b[x + 6] << 8 | b[x + 7]) >>> 0;
      if (flags & 1) {
        const frames = (b[x + 8] << 24 | b[x + 9] << 16 | b[x + 10] << 8 | b[x + 11]) >>> 0;
        if (frames > 0) return (frames * spf) / sr;
      }
    }
  }
  return ((total - i) * 8) / bitrate; // CBR
}

// Deduct credits atomically under the caller's own JWT. Returns the new
// balance, or -1 when the balance is too low; throws if the ledger is down.
async function useCredits(authHeader, cost) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/use_credits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: authHeader,
    },
    body: JSON.stringify({ cost }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error("credits rpc " + r.status);
  return Number(await r.json());
}

// Reverse a small service fee whose work never happened (an orchestrator call
// charged before an upstream failure). Server-authorized only: the RPC's
// EXECUTE is service_role-only and hard-caps the per-call amount, so this can
// never become a client-reachable mint. Best-effort — a failed reversal is
// logged nowhere and simply stands as the (tiny) original charge.
async function creditBack(env, userId, amount) {
  if (!env.SUPABASE_SERVICE_KEY || !userId || !(amount > 0)) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/credit_back`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ target: userId, amount }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {}
}

// Read the caller's balance without deducting (used to reject a broke user
// before we spend any fal money). get_credits also does the one-time signup
// grant on first touch, same as use_credits. Throws if the ledger is down.
async function readCredits(authHeader) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_credits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: authHeader,
    },
    body: "{}",
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error("credits rpc " + r.status);
  return Number(await r.json());
}

// ---- AI-as-a-primitive: a built app calls an LLM through the platform ----------
// The platform holds the key; each call is metered to the app OWNER's credits (their
// app's visitors trigger it, so we can't charge the caller). use_credits_for is
// service_role-only + mint-gated, returns the new balance or -1 when the owner can't
// afford it. Flat fee per call — Haiku with a capped output makes the real cost small.
const AI_FEE = 1; // credits per app AI call
async function chargeOwnerAI(env, ownerUid, credits) {
  if (!env.SUPABASE_SERVICE_KEY || !env.CREDITS_MINT_SECRET || !ownerUid || !(credits > 0)) return -1;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/use_credits_for`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
      body: JSON.stringify({ target: ownerUid, amount: credits, mint_key: env.CREDITS_MINT_SECRET }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return -1;
    return Number(await r.json());
  } catch { return -1; }
}
// Owner (isibi user) id for a built app, from the D1 backend ledger, then the source.
async function siteOwnerUid(env, slug) {
  try {
    const g = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(slug)}&select=uid`, { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` }, signal: AbortSignal.timeout(8000) });
    const rows = await g.json().catch(() => []);
    if (Array.isArray(rows) && rows[0] && rows[0].uid) return rows[0].uid;
  } catch {}
  try { const o = await env.SITES_BUCKET.get("sitesrc/" + slug + ".json"); if (o) { const j = JSON.parse(await o.text()); if (j && j.uid) return j.uid; } } catch {}
  return null;
}
// Run one platform AI call for a built app. Charges the owner up front (refunds on any
// failure). Errors are always generic — a built app's visitors must never see provider
// internals. Returns { text } or { error }.
async function runSiteAI(env, ownerUid, opts) {
  const prompt = String((opts && opts.prompt) || "").slice(0, 6000);
  if (!prompt.trim()) return { error: "Ask a question first." };
  if (!env.ANTHROPIC_API_KEY || !ownerUid) return { error: "This app's AI isn't available right now." };
  const bal = await chargeOwnerAI(env, ownerUid, AI_FEE);
  if (bal < 0) return { error: "This app's AI is temporarily unavailable." }; // owner out of credits (generic)
  const system = String((opts && opts.system) || "").slice(0, 2000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(Object.assign({ model: "claude-haiku-4-5", max_tokens: 800, messages: [{ role: "user", content: prompt }] }, system ? { system } : {})),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) { await creditBack(env, ownerUid, AI_FEE); return { error: "The AI is busy — try again in a moment." }; }
    const j = await r.json();
    const text = (Array.isArray(j.content) ? j.content.filter((b) => b && b.type === "text").map((b) => b.text).join("") : "").trim();
    if (!text) { await creditBack(env, ownerUid, AI_FEE); return { error: "The AI returned nothing — try rewording." }; }
    return { text };
  } catch { await creditBack(env, ownerUid, AI_FEE); return { error: "The AI is busy — try again in a moment." }; }
}

// Per-user daily quota, enforced by the Postgres side (use_quota is
// SECURITY DEFINER over a client-locked table). Fails open if the quota
// service itself is unreachable so an outage can't take the feature down —
// EXCEPT the 'research' kind, which spends real money per call and so fails
// CLOSED (an outage blocks it and the frontend degrades to no web facts,
// rather than leaving an uncapped money-spender wide open).
async function useQuota(request, kind, limit) {
  const token = (request.headers.get("Authorization") || "").slice(7).trim();
  const onError = kind !== "research"; // fail open, except research → fail closed
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/use_quota`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_kind: kind, p_limit: limit }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return onError;
    return (await r.json()) === true;
  } catch {
    return onError;
  }
}
const QUOTA_EXCEEDED = () => Response.json({ error: "daily limit reached" }, { status: 429 });

// Best-effort cancel of a just-submitted fal job — used when we submitted but
// then couldn't charge, so a failed debit never yields a free generation.
async function cancelFal(data, env) {
  try {
    const u = String((data && data.status_url) || "").replace(/\/status$/, "/cancel");
    if (/^https:\/\/queue\.fal\.run\//.test(u) && env.FAL_KEY) {
      await fetch(u, { method: "PUT", headers: { Authorization: `Key ${env.FAL_KEY}` }, signal: AbortSignal.timeout(8000) });
    }
  } catch {}
}

// Upload an inline data-URI attachment to fal's own storage and return the
// hosted https URL. Images ride fine as data URIs, but Kling's video validator
// probes video_url (format/duration/resolution) and 422s an inline blob — so
// clips get parked on fal storage first and submitted as a real URL.
async function falUpload(dataUri, env) {
  try {
    const m = String(dataUri).match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!m || !env.FAL_KEY) return null;
    const mime = m[1];
    const raw = atob(m[2]);
    const bin = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i);
    const ext = mime.includes("quicktime") ? "mov" : (mime.split("/")[1] || "bin").split("+")[0];
    const init = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3", {
      method: "POST",
      headers: { Authorization: `Key ${env.FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ file_name: `isibi-input.${ext}`, content_type: mime }),
      signal: AbortSignal.timeout(15000),
    });
    if (!init.ok) return null;
    const meta = await init.json().catch(() => ({}));
    if (!meta.upload_url || !meta.file_url) return null;
    const put = await fetch(meta.upload_url, {
      method: "PUT",
      headers: { "Content-Type": mime },
      body: bin,
      signal: AbortSignal.timeout(60000),
    });
    if (!put.ok) return null;
    return meta.file_url;
  } catch {
    return null;
  }
}

// Resolve the caller's Supabase access token to a user, or null if missing/invalid.
async function authUser(request) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const user = await r.json();
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}

const UNAUTHED = () => Response.json({ error: "sign in required" }, { status: 401 });

// Baseline security headers on every response (audit item). script-src is
// 'self' with NO 'unsafe-inline' (all handlers are wired via addEventListener /
// data-act hooks, so injected HTML can't execute as script); style-src keeps
// 'unsafe-inline' for the handful of style="" attributes; img/media/connect
// allow Supabase Storage + fal.media plus data:/blob: (thumbnails, downloads).
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // No 'unsafe-inline' for scripts: all handlers are wired via addEventListener
  // (data-act hooks), so a would-be HTML injection can't execute as script.
  // 'wasm-unsafe-eval' lets the Studio's on-device video editor (ffmpeg.wasm,
  // self-hosted under /vendor/ffmpeg) compile WebAssembly WITHOUT permitting
  // JS eval() — the narrow token, not 'unsafe-eval'.
  // style-src keeps 'unsafe-inline' for the handful of inline style attributes.
  "script-src 'self' 'wasm-unsafe-eval'",
  // blob: frames = the Website Builder's preview (generated sites render in a
  // sandboxed allow-scripts iframe from a Blob URL — an opaque origin with no
  // access to the app's DOM/storage; srcdoc would inherit THIS CSP and block
  // the generated site's own inline scripts).
  "frame-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // *.ytimg.com = YouTube video thumbnails, *.cdninstagram.com / *.fbcdn.net =
  // Instagram post thumbnails (Media Agent tabs) — CSP was silently blocking them.
  "img-src 'self' data: blob: https://*.supabase.co https://fal.media https://*.fal.media https://*.ytimg.com https://*.cdninstagram.com https://*.fbcdn.net",
  // data: is needed so the client can decode an attached audio clip's data-URL
  // (measures its real duration → correct lip-sync billing) and play it back.
  // These directives don't govern scripts, so this doesn't weaken script-src.
  "media-src 'self' data: blob: https://*.supabase.co https://fal.media https://*.fal.media",
  // blob: on connect-src so the Studio editor's worker can fetch the
  // decompressed ffmpeg-core.wasm (a blob: URL); non-script directive.
  "connect-src 'self' data: blob: https://*.supabase.co https://fal.media https://*.fal.media",
].join("; ");

// Reduce an upstream (fal/Anthropic) error payload to a short, plain string
// so the client gets something useful to explain the failure without exposing
// the provider's raw error object/structure.
// Strip the provider from any string bound for the client (standing owner
// rule: the user must NEVER see "fal"). Mirrors the frontend scrubProvider —
// word-boundary safe so "false"/"falcon" survive (2026-07-17).
function scrubProvider(s) {
  if (typeof s !== "string") return s;
  return s
    .replace(/https?:\/\/[^\s"']*\bfal\.(?:ai|run|media)[^\s"']*/gi, "the render service")
    .replace(/\bfal\.(?:ai|run|media)\b/gi, "the render service")
    .replace(/\bfal-ai\b/gi, "the render service")
    .replace(/\bfal\b/gi, "the render service");
}
function briefErr(d) {
  const scrub = (s) => (typeof s === "string" ? scrubProvider(s.slice(0, 200)) : s);
  if (typeof d === "string") return scrub(d);
  if (!d || typeof d !== "object") return undefined;
  const m = d.detail ?? d.error ?? d.message;
  if (typeof m === "string") return scrub(m);
  if (Array.isArray(m)) {
    const s = m.map((x) => x && (x.msg || x.message)).filter(Boolean).join("; ");
    return s ? scrub(s) : undefined;
  }
  return undefined;
}

function harden(res, request) {
  const h = new Headers(res.headers);
  // The vendored marketing demos under /mkt/demo* are self-contained pages the
  // landing embeds in an <iframe> (demo carousel). Two relaxations for those
  // paths ONLY: (1) same-origin framable (still blocks cross-origin framing);
  // (2) allow inline scripts — the vendored SPA demos ship React SSR hydration
  // scripts + a small router-spoof shim inline, which strict script-src blocks.
  // These are fixed, self-authored files with no user-input reflection, so
  // 'unsafe-inline' here carries no injection risk. The app + auth + API keep
  // the strict policy (DENY / frame-ancestors 'none' / no inline scripts).
  let pathname = "";
  try { pathname = new URL(request.url).pathname; } catch {}
  const sameOriginFrame = pathname.startsWith("/mkt/demo");
  // A published Website-Builder site (isibi.ai/s/<slug>) is a real end-user
  // website — it needs its OWN inline <style>/<script>, Google Fonts, and the
  // Supabase-hosted images, so it gets a permissive website CSP, not the strict
  // app policy. Still same-origin-only for scripts/connect (no external code).
  // /preview/ = the builder's live draft preview: it renders the SAME generated
  // page in the workspace iframe, so it needs the identical website CSP (a
  // blob/srcdoc preview would inherit the strict app CSP and blank the page).
  const publishedSite = pathname.startsWith("/s/") || pathname.startsWith("/preview/");
  h.set("X-Content-Type-Options", "nosniff");
  if (publishedSite) {
    h.set("Content-Security-Policy", [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.supabase.co",
      "connect-src 'self'",
      // Live map embeds (OpenStreetMap / Google Maps) — no API key, real interactive
      // maps. Without this, default-src 'self' would block the map iframe on publish.
      "frame-src 'self' https://www.openstreetmap.org https://www.google.com https://maps.google.com",
      "base-uri 'self'",
      "frame-ancestors 'self'",
    ].join("; "));
    h.set("X-Frame-Options", "SAMEORIGIN");
  } else {
    const demoCSP = CSP
      .replace("frame-ancestors 'none'", "frame-ancestors 'self'")
      .replace("script-src 'self' 'wasm-unsafe-eval'", "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'");
    h.set("Content-Security-Policy", sameOriginFrame ? demoCSP : CSP);
    h.set("X-Frame-Options", sameOriginFrame ? "SAMEORIGIN" : "DENY");
  }
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

// Pull the (possibly still-growing) "reply" string out of a partial tool-input
// JSON buffer, so the ask step can stream isibi's reply as Sonnet writes it.
function extractReplyPrefix(buf) {
  const m = buf.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!m) return "";
  let s = m[1];
  if (/(?:^|[^\\])(?:\\\\)*\\$/.test(s)) s = s.slice(0, -1); // trailing half escape
  s = s.replace(/\\u[0-9a-fA-F]{0,3}$/, ""); // incomplete \uXXXX
  try { return JSON.parse('"' + s + '"'); } catch { return ""; }
}

// Minimal HTML-entity decoder for scraped <meta> URLs (og:image with &amp;).
function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;|&#0?39;|&#x27;/gi, "'").replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return ""; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ""; } });
}

// Anti-bot walls (Walmart's "Robot or human?", Amazon's captcha, Cloudflare's
// "Just a moment…", PerimeterX…) return 200 with a real <title> — detect them
// so the import-from-link box can say what actually happened instead of a
// misleading "no image found".
const WALL_RE = /robot or human|are you a (?:human|robot)|you're not a robot|verify you are human|just a moment|attention required|access denied|pardon our interruption|automated access|请开启|captcha/i;
// Site chrome that must never become "the imported image".
const JUNK_IMG_RE = /sprite|logo|icon|placeholder|favicon|1x1|pixel|badge|spacer|blank|loading|captcha/i;
const CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

// All plausible "main image" candidates from a page's HTML, best first:
// JSON-LD schema.org image → og:image/twitter:image → microdata → <link
// image_src> → the best real <img> (lazy-load + srcset aware, skips chrome).
// Ported from the removed product scanner's extractProduct (2026-07-16).
function pageImageCandidates(html, pageUrl) {
  const abs = (s) => { if (!s) return null; try { return new URL(s, pageUrl).toString(); } catch { return null; } };
  const ok = (s) => s && /^https?:\/\//i.test(s);
  const candidates = [];
  const push = (v) => { if (v && ok(v) && !JUNK_IMG_RE.test(v) && !candidates.includes(v)) candidates.push(v); };
  const allMeta = (prop) => {
    const re = new RegExp('<meta[^>]+(?:property|name|itemprop)=["\\\']' + prop + '["\\\'][^>]*>', "ig");
    const out = []; let m;
    while ((m = re.exec(html)) && out.length < 8) {
      const c = m[0].match(/content=["']([^"']*)["']/i);
      if (c && c[1]) out.push(decodeEntities(c[1]).trim());
    }
    return out;
  };
  // JSON-LD image (any @type — a pasted link isn't necessarily a Product page)
  {
    const imgOf = (v) => {
      if (!v) return "";
      if (typeof v === "string") return v;
      if (Array.isArray(v)) { for (const x of v) { const r = imgOf(x); if (r) return r; } return ""; }
      if (typeof v === "object") return imgOf(v.url || v.contentUrl);
      return "";
    };
    const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/ig;
    let m, blocks = 0;
    while ((m = re.exec(html)) && blocks < 30 && candidates.length < 4) {
      blocks++;
      let data; try { data = JSON.parse(m[1].trim()); } catch { continue; }
      const stack = Array.isArray(data) ? data.slice() : [data];
      let guard = 0;
      while (stack.length && guard < 300) {
        guard++;
        const node = stack.shift();
        if (!node || typeof node !== "object") continue;
        if (Array.isArray(node)) { stack.push(...node); continue; }
        if (node["@graph"]) stack.push(...(Array.isArray(node["@graph"]) ? node["@graph"] : [node["@graph"]]));
        const im = abs(imgOf(node.image));
        if (im) push(im);
      }
    }
  }
  allMeta("og:image").concat(allMeta("og:image:secure_url"), allMeta("twitter:image"), allMeta("twitter:image:src")).map(abs).forEach(push);
  push(abs(allMeta("image")[0]));
  {
    const link = ((html.match(/<link[^>]+rel=["']image_src["'][^>]*>/i) || [])[0] || "").match(/href=["']([^"']+)["']/i);
    if (link) push(abs(link[1]));
  }
  if (!candidates.length) {
    const largestFromSrcset = (ss) => {
      let best = "", bestW = -1;
      for (const part of ss.split(",")) {
        const bits = part.trim().split(/\s+/);
        const w = bits[1] && /^(\d+)w$/.test(bits[1]) ? parseInt(bits[1]) : 0;
        if (bits[0] && w >= bestW) { bestW = w; best = bits[0]; }
      }
      return best;
    };
    for (const mm of [...html.matchAll(/<img\b[^>]*>/ig)].slice(0, 150)) {
      const tag = mm[0];
      const at = (a) => (tag.match(new RegExp(a + '=["\\\']([^"\\\']+)["\\\']', "i")) || [])[1] || "";
      const ss = at("data-srcset") || at("srcset");
      const src = at("data-src") || at("data-original") || at("data-lazy-src") || (ss && largestFromSrcset(ss)) || at("src");
      if (!src || JUNK_IMG_RE.test(src)) continue;
      const a = abs(src);
      if (ok(a)) { push(a); if (candidates.length >= 3) break; }
    }
  }
  return candidates.slice(0, 5);
}

// ── SSRF guard for user-supplied URLs (the gallery's Import-from-link).
// Normalizes the host and rejects loopback / link-local / private / metadata
// targets across the usual encodings (bracketed IPv6, IPv4-mapped,
// decimal/octal/hex IPv4, trailing dot). Re-checked on every redirect hop by
// safeFetch. ──
function ipv4Blocked(o) {
  const [a, b] = o;
  if (o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  if (a === 0) return true;                          // 0.0.0.0/8 "this network"
  if (a === 10) return true;                         // private
  if (a === 127) return true;                        // loopback
  if (a === 169 && b === 254) return true;           // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;  // private
  if (a === 192 && b === 168) return true;           // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}
function parseIPv4(h) {
  const toInt = (p) =>
    /^0x[0-9a-f]+$/i.test(p) ? parseInt(p, 16) :
    /^0[0-7]+$/.test(p) ? parseInt(p, 8) :
    /^\d+$/.test(p) ? parseInt(p, 10) : NaN;
  const parts = h.split(".");
  if (parts.length === 4) {
    const o = parts.map(toInt);
    if (o.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return o;
  }
  // Single-integer form (decimal / 0x-hex / 0-octal) → 32-bit dotted quad.
  const n = /^0x[0-9a-f]+$/i.test(h) ? parseInt(h, 16) : /^0[0-7]+$/.test(h) ? parseInt(h, 8) : /^\d+$/.test(h) ? parseInt(h, 10) : NaN;
  if (Number.isInteger(n) && n >= 0 && n <= 0xffffffff) return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  return null;
}
// Extract the embedded IPv4 from an IPv4-mapped (::ffff:…) or NAT64 (64:ff9b::…)
// IPv6 host, in dotted OR the hex form new URL() normalizes to (::ffff:7f00:1).
function embeddedIPv4(h) {
  const dotted = h.match(/(?:^|:)((?:\d{1,3}\.){3}\d{1,3})$/);
  if (dotted) return parseIPv4(dotted[1]);
  if (/(^|:)ffff:[0-9a-f]{1,4}(:[0-9a-f]{1,4})?$/i.test(h) || /^64:ff9b:/i.test(h)) {
    const g = h.split(":").filter((x) => x !== "");
    const last = g.slice(-2).map((x) => parseInt(x, 16));
    const w1 = last.length === 2 ? last[0] : 0;
    const w2 = last.length === 2 ? last[1] : last[0];
    if (Number.isInteger(w1) && Number.isInteger(w2) && w1 <= 0xffff && w2 <= 0xffff) {
      return [(w1 >> 8) & 255, w1 & 255, (w2 >> 8) & 255, w2 & 255];
    }
  }
  return null;
}
function hostIsBlocked(rawHost) {
  let h = (rawHost || "").toLowerCase().trim();
  if (!h) return true;
  if (h.endsWith(".")) h = h.slice(0, -1);           // trailing-dot FQDN
  if (h.startsWith("[")) { const e = h.indexOf("]"); h = e > 0 ? h.slice(1, e) : h.slice(1); }
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") ||
      h.endsWith(".local") || h === "metadata.google.internal") return true;
  if (h.includes(":")) {                             // IPv6
    if (h === "::1" || h === "::") return true;       // loopback / unspecified
    if (/^fe[89ab]/.test(h)) return true;            // link-local fe80::/10
    if (/^f[cd]/.test(h)) return true;               // unique-local fc00::/7
    const embedded = embeddedIPv4(h);                // IPv4-mapped / NAT64 (dotted or hex-normalized)
    if (embedded && ipv4Blocked(embedded)) return true;
    return false;                                    // other public IPv6
  }
  const ip = parseIPv4(h);
  if (ip) return ipv4Blocked(ip);
  return false;                                      // regular hostname
}
// Fetch that won't be redirected onto a blocked host: follows up to `max` hops
// manually, re-validating scheme + host on each Location.
async function safeFetch(startUrl, opts = {}, max = 4) {
  let current = startUrl;
  for (let i = 0; i <= max; i++) {
    let u;
    try { u = new URL(current); } catch { return null; }
    if ((u.protocol !== "http:" && u.protocol !== "https:") || hostIsBlocked(u.hostname)) return null;
    const r = await fetch(u.toString(), { ...opts, redirect: "manual" });
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get("location");
      if (!loc) return r;
      current = new URL(loc, u).toString();
      continue;
    }
    return r;
  }
  return null; // too many redirects
}
function b64FromBuffer(ab) {
  const bytes = new Uint8Array(ab);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// Reject an obviously-oversized body by Content-Length before parsing it — a
// generous backstop (attachments are already capped client-side), not a tight
// limit. Returns a 413 Response, or null to proceed.
function tooLargeBody(request, maxBytes) {
  const len = Number(request.headers.get("content-length") || 0);
  return len > maxBytes ? Response.json({ error: "payload too large" }, { status: 413 }) : null;
}

// Read a response body up to maxBytes, stopping the moment the ceiling is crossed
// so a hostile or oversized upstream can't OOM the isolate — r.arrayBuffer() would
// buffer the entire body first. Returns a Uint8Array (at most maxBytes long).
async function readCapped(resp, maxBytes) {
  if (!resp || !resp.body || !resp.body.getReader) {
    const ab = await resp.arrayBuffer();
    return new Uint8Array(ab).subarray(0, maxBytes);
  }
  const reader = resp.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length) {
        chunks.push(value);
        total += value.length;
        if (total >= maxBytes) break; // ceiling hit — stop pulling more bytes
      }
    }
  } finally {
    try { await reader.cancel(); } catch {}
  }
  const out = new Uint8Array(Math.min(total, maxBytes));
  let off = 0;
  for (const c of chunks) {
    if (off >= out.length) break;
    const take = Math.min(c.length, out.length - off);
    out.set(c.subarray(0, take), off);
    off += take;
  }
  return out;
}

// ── Free-tier watermark, burned server-side ────────────────────────────────
// The "✦ isibi.ai" badge PNG lives in public/; fetched once per isolate via the
// ASSETS binding and cached. Composited bottom-right, scaled to ~26% of the
// image width (matching the client's width-relative mark).
let _wmBadge = null;
async function wmBadgeBytes(env, request) {
  if (_wmBadge) return _wmBadge;
  const r = await env.ASSETS.fetch(new URL("/wm-badge.png", request.url));
  if (!r.ok) throw new Error("badge missing");
  _wmBadge = new Uint8Array(await r.arrayBuffer());
  return _wmBadge;
}
// Returns watermarked JPEG bytes (Uint8Array). Throws on decode failure so the
// caller can fail closed rather than store an un-watermarked image.
function watermarkImageBytes(imgBytes, badgeBytes) {
  const img = PhotonImage.new_from_byteslice(imgBytes);
  const badge = PhotonImage.new_from_byteslice(badgeBytes);
  let scaled = null;
  try {
    const iw = img.get_width(), ih = img.get_height();
    const targetW = Math.max(80, Math.min(Math.round(iw * 0.26), iw));
    const bw = badge.get_width(), bh = badge.get_height();
    scaled = resize(badge, targetW, Math.max(1, Math.round(bh * (targetW / bw))), SamplingFilter.Lanczos3);
    const sw = scaled.get_width(), sh = scaled.get_height();
    const pad = Math.round(iw * 0.02);
    const x = Math.max(0, iw - sw - pad), y = Math.max(0, ih - sh - pad);
    watermark(img, scaled, BigInt(x), BigInt(y));
    return img.get_bytes_jpeg(90);
  } finally {
    img.free(); badge.free(); if (scaled) scaled.free();
  }
}
// Server-side image resize / transform for uploads (photon/wasm). Takes decoded
// bytes + their mime + a transform spec, returns {bytes, mime, ext} — the resized/
// re-encoded image, or the ORIGINAL untouched on any problem (unsupported source,
// no-op spec, decode/encode failure) so a bad transform never loses the upload.
//   spec: { max?, w?, h?, format?('jpeg'|'webp'|'png'), quality? }
//   - max: bound the LONGEST side to N px (downscale only, keeps aspect) — the common
//          "shrink big phone photos" case.
//   - w/h: exact target; one alone scales the other to keep aspect.
//   - format: re-encode (jpeg shrinks photos hard; webp is smallest; png for alpha).
// Only PNG/JPEG/WEBP sources are transformable (GIF loses animation, PDF isn't an
// image) — those pass through unchanged.
function transformImageBytes(bytes, mime, spec) {
  const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const orig = { bytes, mime, ext: EXT[mime] || null };
  if (!spec || typeof spec !== "object") return orig;
  if (!(mime === "image/jpeg" || mime === "image/png" || mime === "image/webp")) return orig;
  const fmtRaw = String(spec.format || "").toLowerCase();
  const fmt = fmtRaw === "jpg" ? "jpeg" : fmtRaw;
  const wantFmt = (fmt === "jpeg" || fmt === "webp" || fmt === "png") ? fmt : null;
  const clampDim = (n) => { const v = Math.round(Number(n)); return (Number.isFinite(v) && v > 0) ? Math.min(v, 5000) : 0; };
  const max = clampDim(spec.max), wIn = clampDim(spec.w != null ? spec.w : spec.width), hIn = clampDim(spec.h != null ? spec.h : spec.height);
  if (!max && !wIn && !hIn && !wantFmt) return orig; // nothing asked
  let img = null, out = null;
  try {
    img = PhotonImage.new_from_byteslice(bytes);
    const ow = img.get_width(), oh = img.get_height();
    if (!(ow > 0 && oh > 0)) return orig;
    let tw = ow, th = oh;
    if (max) { if (Math.max(ow, oh) > max) { const s = max / Math.max(ow, oh); tw = Math.max(1, Math.round(ow * s)); th = Math.max(1, Math.round(oh * s)); } }
    else if (wIn && hIn) { tw = wIn; th = hIn; }
    else if (wIn) { tw = wIn; th = Math.max(1, Math.round(oh * (wIn / ow))); }
    else if (hIn) { th = hIn; tw = Math.max(1, Math.round(ow * (hIn / oh))); }
    const needResize = tw !== ow || th !== oh;
    const src = needResize ? (out = resize(img, tw, th, SamplingFilter.Lanczos3)) : img;
    const outMime = wantFmt ? ("image/" + wantFmt) : mime;
    let enc;
    if (outMime === "image/jpeg") { let q = parseInt(spec.quality, 10); if (!(q >= 40 && q <= 100)) q = 82; enc = src.get_bytes_jpeg(q); }
    else if (outMime === "image/webp") enc = src.get_bytes_webp();
    else enc = src.get_bytes(); // png
    if (!enc || !enc.length) return orig; // encode produced nothing → keep original
    return { bytes: enc instanceof Uint8Array ? enc : new Uint8Array(enc), mime: outMime, ext: EXT[outMime] };
  } catch { return orig; }
  finally { try { if (out) out.free(); if (img) img.free(); } catch {} }
}
// Detect an image by magic bytes (PNG / JPEG / WEBP), returning its media type
// or null — never trust an upstream Content-Type for the watermark decision.
function sniffImageType(b) {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}
async function isPaidUser(request) {
  try {
    const p = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: request.headers.get("Authorization") || "" },
      body: "{}",
      signal: AbortSignal.timeout(8000),
    });
    return p.ok ? (await p.json()) === true : false;
  } catch { return false; }
}

// The caller's gallery-storage picture in bytes ({ used, cap, tier }), from the
// storage_status RPC (SECURITY DEFINER, reads the caller's objects + tier cap).
// cap 0 = free / lapsed = no gallery saving. Returns null if the ledger is down.
async function storageStatus(request) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/storage_status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: request.headers.get("Authorization") || "" },
      body: "{}",
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const s = await r.json();
    return { used: Number(s.used) || 0, cap: Number(s.cap) || 0, tier: String(s.tier || "free") };
  } catch { return null; }
}
// Atomic gallery-storage reservation: the storage_reserve RPC counts committed
// objects PLUS in-flight reservations under a per-user lock, so concurrent saves
// can't each pass a stale check and overshoot the cap. Returns the parsed
// { ok, id, reason, ... } — or null if the ledger is unreachable, in which case
// the caller fails open (never blocks a paid save on a ledger hiccup).
async function storageReserve(request, bytes) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/storage_reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: request.headers.get("Authorization") || "" },
      body: JSON.stringify({ p_bytes: Math.max(0, Math.round(bytes || 0)) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
// Release a reservation once the upload settled — on success the object now
// counts in storage.objects, on failure the space is freed. Best-effort; a
// missed release self-heals via the reservation's 2-minute TTL.
async function storageRelease(request, id) {
  if (!id) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/storage_release`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: request.headers.get("Authorization") || "" },
      body: JSON.stringify({ p_id: id }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {}
}

// ── AI Orchestrator (metered through regular credits) ───────────────────────
// The director (ask/compose/revise/research/error/studio) is available to
// everyone — no subscription. Each call is charged to the credit ledger at the
// $0.008/credit basis (see /api/direct). The per-call cost is a deterministic
// at-cost estimate in micro-dollars (1e-6 USD), keyed to the model that runs
// the step: Sonnet (High+) and web-search research cost most; Haiku steps are
// pennies. 1 credit = 8000 micros, so dividing by 8000 gives fractional credits.
function orchestratorCostMicros(step, effort) {
  if (step === "research") return 35000; // Sonnet + up to 4 web searches
  if ((step === "compose" || step === "revise") &&
      (effort === "high" || effort === "ultra" || effort === "max")) return 25000; // Sonnet
  if (step === "ask") return 3000; // Haiku, thinking off, ~1.5k tokens
  return 4000; // Haiku prompt-writing / error / studio
}

// ── Composio (Media Agent social connections) ─────────────────────────────
// Instagram/YouTube are linked per-user through Composio. The API key stays
// server-side (env.COMPOSIO_API_KEY); each Zephyr user maps to a Composio
// user_id === their Supabase uid, so connections never cross accounts.
const COMPOSIO_BASE = "https://backend.composio.dev/api/v3.1";
const SOCIAL_TOOLKITS = { instagram: "instagram", youtube: "youtube" };

function composioFetch(env, path, opts = {}) {
  return fetch(`${COMPOSIO_BASE}${path}`, {
    ...opts,
    headers: { "x-api-key": env.COMPOSIO_API_KEY, "Content-Type": "application/json", ...(opts.headers || {}) },
    signal: AbortSignal.timeout(12000),
  });
}

// The Meta App Review test account: routed through our CUSTOM (own-app) auth
// config so the reviewer exercises our app's permissions. Everyone else uses
// the live managed config (the custom app is dev-mode until App Review passes).
const REVIEW_USER_ID = "36cb7d83-b310-4715-b11e-0df2ed5618e0";

// The dashboard-created OAuth auth config for a toolkit. Prefer a Composio-
// MANAGED enabled config: managed apps are live and work for every user,
// whereas a custom (own-credentials) app stays in Meta development mode until
// it passes App Review — preferring it would break connect for non-tester
// users. Switch to preferring custom once that app is Live. Null if none.
async function composioAuthConfigId(env, toolkit, userId) {
  const r = await composioFetch(env, `/auth_configs?toolkit_slug=${encodeURIComponent(toolkit)}&limit=20`);
  if (!r.ok) return null;
  const items = (await r.json().catch(() => ({}))).items || [];
  const enabled = items.filter((a) => a.status === "ENABLED");
  const preferCustom = userId === REVIEW_USER_ID;
  const pick =
    (preferCustom && enabled.find((a) => a.is_composio_managed === false)) ||
    enabled.find((a) => a.is_composio_managed === true) || enabled[0] || items[0];
  return pick ? pick.id : null;
}

// This user's connected accounts (optionally one toolkit). Filtered by user_id
// server-side, so a caller only ever sees / acts on their own connections.
async function composioConnections(env, userId, toolkit) {
  const q = new URLSearchParams({ user_ids: userId, limit: "50" });
  if (toolkit) q.set("toolkit_slugs", toolkit);
  const r = await composioFetch(env, `/connected_accounts?${q}`);
  if (!r.ok) return [];
  return (await r.json().catch(() => ({}))).items || [];
}

function socialSlot(conns, toolkit) {
  const cs = conns.filter((c) => String(c.toolkit?.slug || "").toLowerCase() === toolkit);
  const c = cs.find((x) => x.status === "ACTIVE") || cs[0];
  return c ? { connected: c.status === "ACTIVE", status: c.status, id: c.id } : { connected: false, status: null, id: null };
}

// Run a Composio tool. Composio needs a user identity (user_id) alongside the
// connected account; the real agent passes the caller's Supabase uid.
async function composioExecute(env, slug, { userId, connectedAccountId }, args) {
  const body = { arguments: args || {} };
  if (userId) body.user_id = userId;
  if (connectedAccountId) body.connected_account_id = connectedAccountId;
  const r = await composioFetch(env, `/tools/execute/${encodeURIComponent(slug)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  return { http: r.status, successful: d.successful === true, error: d.error || null, data: d.data };
}

function composioErrText(e) {
  return e && typeof e === "object" ? (e.message || JSON.stringify(e)) : (e || null);
}

// Compact MD5 (public-domain, Joseph Myers) → hex. Workers' WebCrypto has no
// MD5, and Composio's file-upload presign requires one for dedup/integrity.
function md5hex(bytes) {
  const add32 = (a, b) => (a + b) & 0xffffffff;
  const cmn = (q, a, b, x, s, t) => { a = add32(add32(a, q), add32(x, t)); return add32((a << s) | (a >>> (32 - s)), b); };
  const ff = (a,b,c,d,x,s,t) => cmn((b&c)|((~b)&d),a,b,x,s,t);
  const gg = (a,b,c,d,x,s,t) => cmn((b&d)|(c&(~d)),a,b,x,s,t);
  const hh = (a,b,c,d,x,s,t) => cmn(b^c^d,a,b,x,s,t);
  const ii = (a,b,c,d,x,s,t) => cmn(c^(b|(~d)),a,b,x,s,t);
  const n = bytes.length, words = [];
  for (let i = 0; i < n; i++) words[i >> 2] = (words[i >> 2] || 0) | (bytes[i] << ((i % 4) * 8));
  words[n >> 2] = (words[n >> 2] || 0) | (0x80 << ((n % 4) * 8));
  const len = (((n + 8) >> 6) + 1) * 16;
  while (words.length < len) words.push(0);
  words[len - 2] = (n * 8) & 0xffffffff;
  words[len - 1] = Math.floor((n * 8) / 0x100000000) & 0xffffffff;
  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  for (let i = 0; i < words.length; i += 16) {
    const oa=a,ob=b,oc=c,od=d;
    a=ff(a,b,c,d,words[i],7,-680876936);d=ff(d,a,b,c,words[i+1],12,-389564586);c=ff(c,d,a,b,words[i+2],17,606105819);b=ff(b,c,d,a,words[i+3],22,-1044525330);
    a=ff(a,b,c,d,words[i+4],7,-176418897);d=ff(d,a,b,c,words[i+5],12,1200080426);c=ff(c,d,a,b,words[i+6],17,-1473231341);b=ff(b,c,d,a,words[i+7],22,-45705983);
    a=ff(a,b,c,d,words[i+8],7,1770035416);d=ff(d,a,b,c,words[i+9],12,-1958414417);c=ff(c,d,a,b,words[i+10],17,-42063);b=ff(b,c,d,a,words[i+11],22,-1990404162);
    a=ff(a,b,c,d,words[i+12],7,1804603682);d=ff(d,a,b,c,words[i+13],12,-40341101);c=ff(c,d,a,b,words[i+14],17,-1502002290);b=ff(b,c,d,a,words[i+15],22,1236535329);
    a=gg(a,b,c,d,words[i+1],5,-165796510);d=gg(d,a,b,c,words[i+6],9,-1069501632);c=gg(c,d,a,b,words[i+11],14,643717713);b=gg(b,c,d,a,words[i],20,-373897302);
    a=gg(a,b,c,d,words[i+5],5,-701558691);d=gg(d,a,b,c,words[i+10],9,38016083);c=gg(c,d,a,b,words[i+15],14,-660478335);b=gg(b,c,d,a,words[i+4],20,-405537848);
    a=gg(a,b,c,d,words[i+9],5,568446438);d=gg(d,a,b,c,words[i+14],9,-1019803690);c=gg(c,d,a,b,words[i+3],14,-187363961);b=gg(b,c,d,a,words[i+8],20,1163531501);
    a=gg(a,b,c,d,words[i+13],5,-1444681467);d=gg(d,a,b,c,words[i+2],9,-51403784);c=gg(c,d,a,b,words[i+7],14,1735328473);b=gg(b,c,d,a,words[i+12],20,-1926607734);
    a=hh(a,b,c,d,words[i+5],4,-378558);d=hh(d,a,b,c,words[i+8],11,-2022574463);c=hh(c,d,a,b,words[i+11],16,1839030562);b=hh(b,c,d,a,words[i+14],23,-35309556);
    a=hh(a,b,c,d,words[i+1],4,-1530992060);d=hh(d,a,b,c,words[i+4],11,1272893353);c=hh(c,d,a,b,words[i+7],16,-155497632);b=hh(b,c,d,a,words[i+10],23,-1094730640);
    a=hh(a,b,c,d,words[i+13],4,681279174);d=hh(d,a,b,c,words[i],11,-358537222);c=hh(c,d,a,b,words[i+3],16,-722521979);b=hh(b,c,d,a,words[i+6],23,76029189);
    a=hh(a,b,c,d,words[i+9],4,-640364487);d=hh(d,a,b,c,words[i+12],11,-421815835);c=hh(c,d,a,b,words[i+15],16,530742520);b=hh(b,c,d,a,words[i+2],23,-995338651);
    a=ii(a,b,c,d,words[i],6,-198630844);d=ii(d,a,b,c,words[i+7],10,1126891415);c=ii(c,d,a,b,words[i+14],15,-1416354905);b=ii(b,c,d,a,words[i+5],21,-57434055);
    a=ii(a,b,c,d,words[i+12],6,1700485571);d=ii(d,a,b,c,words[i+3],10,-1894986606);c=ii(c,d,a,b,words[i+10],15,-1051523);b=ii(b,c,d,a,words[i+1],21,-2054922799);
    a=ii(a,b,c,d,words[i+8],6,1873313359);d=ii(d,a,b,c,words[i+15],10,-30611744);c=ii(c,d,a,b,words[i+6],15,-1560198380);b=ii(b,c,d,a,words[i+13],21,1309151649);
    a=ii(a,b,c,d,words[i+4],6,-145523070);d=ii(d,a,b,c,words[i+11],10,-1120210379);c=ii(c,d,a,b,words[i+2],15,718787259);b=ii(b,c,d,a,words[i+9],21,-343485551);
    a=add32(a,oa);b=add32(b,ob);c=add32(c,oc);d=add32(d,od);
  }
  const out = [a,b,c,d]; let hex = "";
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) hex += ((out[i] >> (j*8)) & 0xff).toString(16).padStart(2, "0");
  return hex;
}

// Ingest a remote media URL into Composio's file storage and return the file
// object ({name, mimetype, s3key}) that a tool's file param expects.
async function composioUploadFile(env, { toolkitSlug, toolSlug, url }) {
  const resp = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!resp.ok) throw new Error("could not fetch media (" + resp.status + ")");
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const mimetype = resp.headers.get("content-type") || "application/octet-stream";
  const filename = ((url.split("/").pop() || "upload").split("?")[0]) || "upload";
  const md5 = md5hex(bytes);
  const reqR = await composioFetch(env, "/files/upload/request", {
    method: "POST",
    body: JSON.stringify({ toolkit_slug: toolkitSlug, tool_slug: toolSlug, filename, mimetype, md5 }),
  });
  if (!reqR.ok) throw new Error("presign failed (" + reqR.status + ")");
  const pre = await reqR.json().catch(() => ({}));
  const putUrl = pre.new_presigned_url || pre.newPresignedUrl;
  if (!putUrl) throw new Error("no presigned url");
  const put = await fetch(putUrl, { method: "PUT", headers: { "Content-Type": mimetype }, body: bytes, signal: AbortSignal.timeout(150000) });
  if (!put.ok) throw new Error("storage upload failed (" + put.status + ")");
  return { name: filename, mimetype, s3key: pre.key };
}

// ── Publishing (write) ─────────────────────────────────────────────────────
// Executed ONLY after the user confirms in the UI — never autonomously by the
// model. YouTube = single upload; Instagram = create-container then publish.
async function socialPublish(env, userId, p) {
  const ident = { userId };
  const platform = String(p.platform || "").toLowerCase();
  const mediaUrl = String(p.media_url || "");
  if (!mediaUrl) return { ok: false, platform, error: "no media url" };

  if (platform === "youtube") {
    let file;
    try {
      file = await composioUploadFile(env, { toolkitSlug: "youtube", toolSlug: "YOUTUBE_UPLOAD_VIDEO", url: mediaUrl });
    } catch (e) {
      return { ok: false, platform, step: "upload", error: String(e && e.message || e) };
    }
    const args = {
      title: String(p.title || "Untitled").slice(0, 100),
      description: String(p.description || "").slice(0, 4900),
      tags: Array.isArray(p.tags) ? p.tags.map(String).slice(0, 20) : [],
      categoryId: String(p.categoryId || "22"),
      privacyStatus: ["private", "public", "unlisted"].includes(p.privacy) ? p.privacy : "private",
      videoFilePath: file,
    };
    const ex = await composioExecute(env, "YOUTUBE_UPLOAD_VIDEO", ident, args);
    const vid = ex.data && (ex.data.id || (ex.data.response_data && ex.data.response_data.id));
    return { ok: ex.successful, platform, id: vid || null, result: ex.data, error: composioErrText(ex.error) };
  }

  if (platform === "instagram") {
    const info = await composioExecute(env, "INSTAGRAM_GET_USER_INFO", ident, {});
    const igId = info.data && info.data.id;
    if (!igId) return { ok: false, platform, step: "resolve", error: "couldn't resolve Instagram account id" };
    const isVideo = String(p.media_type || "").toLowerCase() === "video";
    const cArgs = { ig_user_id: igId, caption: String(p.caption || "").slice(0, 2200) };
    if (isVideo) { cArgs.video_url = mediaUrl; cArgs.media_type = "REELS"; }
    else { cArgs.image_url = mediaUrl; }
    const c = await composioExecute(env, "INSTAGRAM_POST_IG_USER_MEDIA", ident, cArgs);
    const creation = c.data && (c.data.id || c.data.creation_id || (c.data.data && c.data.data.id));
    if (!c.successful || !creation)
      return { ok: false, platform, step: "container", error: composioErrText(c.error) || "container failed", result: c.data };
    const pub = await composioExecute(env, "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH", ident, { ig_user_id: igId, creation_id: String(creation) });
    return { ok: pub.successful, platform, id: creation, result: pub.data, error: composioErrText(pub.error) };
  }

  return { ok: false, platform, error: "unknown platform" };
}

// ── Analytics (read) ───────────────────────────────────────────────────────
// Pulls a compact Instagram dashboard through Composio: account totals, 30-day
// reach/impressions/profile-views, a 14-day reach series, and top posts. Every
// Composio call is defensive — a missing field returns null and the frontend
// degrades gracefully, so one unavailable metric never sinks the whole panel.
function anNum(x) { const n = Number(x); return Number.isFinite(n) ? n : null; }

// Instagram Insights come back as { data: [ { name, values:[{value,end_time}],
// total_value:{value} } ] }; unwrap whichever envelope Composio hands back.
function anInsightList(d) {
  const a = d && (d.data || (d.response_data && d.response_data.data) || d.insights);
  return Array.isArray(a) ? a : [];
}
function anMetricTotal(list, name) {
  const m = list.find((x) => x && x.name === name);
  if (!m) return null;
  if (m.total_value && m.total_value.value != null) return anNum(m.total_value.value);
  // For windowed metrics (e.g. reach over days_28) each value is a rolling
  // total per day — take the most recent, never sum consecutive windows.
  if (Array.isArray(m.values) && m.values.length)
    return anNum(m.values[m.values.length - 1].value);
  return null;
}
function anMediaList(d) {
  const a = d && (d.data || (d.response_data && d.response_data.data) || d.media);
  return Array.isArray(a) ? a : [];
}

async function instagramAnalytics(env, userId, debug) {
  const ident = { userId };
  const out = {
    username: null, followers: null, media_count: null,
    reach: null, views: null, interactions: null,
    reach_series: null, top_posts: [],
  };
  const raw = {};
  let igId = null;
  try {
    const info = await composioExecute(env, "INSTAGRAM_GET_USER_INFO", ident, {});
    if (debug) raw.info = info.data;
    const d = info.data || {};
    igId = d.id || d.ig_id || (d.data && d.data.id) || null;
    out.username = d.username || (d.data && d.data.username) || null;
    out.followers = anNum(d.followers_count ?? d.followers ?? (d.data && d.data.followers_count));
    out.media_count = anNum(d.media_count ?? (d.data && d.data.media_count));
  } catch {}

  if (igId) {
    // 30-day account totals. Instagram's current metric set is reach / views
    // (replaced "impressions") / total_interactions — and one invalid metric
    // 400s the whole request, so fetch each on its own to isolate failures.
    const fetchTotal = async (metric, extra) => {
      try {
        const r = await composioExecute(env, "INSTAGRAM_GET_USER_INSIGHTS", ident,
          { ig_user_id: igId, metric, period: "days_28", ...(extra || {}) });
        if (debug) raw["m_" + metric] = r.data;
        return anMetricTotal(anInsightList(r.data), metric);
      } catch { return null; }
    };
    out.reach = await fetchTotal("reach");
    out.views = await fetchTotal("views", { metric_type: "total_value" });
    out.interactions = await fetchTotal("total_interactions", { metric_type: "total_value" });
    // 14-day daily reach series for the trend chart.
    try {
      const s = await composioExecute(env, "INSTAGRAM_GET_USER_INSIGHTS", ident,
        { ig_user_id: igId, metric: "reach", period: "day" });
      if (debug) raw.series = s.data;
      const r = anInsightList(s.data).find((x) => x && x.name === "reach");
      if (r && Array.isArray(r.values) && r.values.length)
        out.reach_series = r.values.slice(-14).map((x) => ({ t: x.end_time || null, v: anNum(x.value) }));
    } catch {}
    // Top posts by likes (from the media list — no per-post insight calls).
    try {
      const media = await composioExecute(env, "INSTAGRAM_GET_IG_USER_MEDIA", ident, {
        ig_user_id: igId, limit: 24,
        fields: "id,caption,media_type,media_url,thumbnail_url,permalink,like_count,comments_count,timestamp",
      });
      if (debug) raw.media = media.data;
      const posts = anMediaList(media.data).map((m) => ({
        id: m.id,
        caption: String(m.caption || "").replace(/\s+/g, " ").trim().slice(0, 80),
        media_type: String(m.media_type || "").toLowerCase(),
        permalink: m.permalink || null,
        thumb: m.thumbnail_url || m.media_url || null,
        likes: anNum(m.like_count), comments: anNum(m.comments_count),
      })).filter((p) => p.id);
      posts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
      out.top_posts = posts.slice(0, 5);
    } catch {}
  }
  if (debug) out._raw = raw;
  return out;
}

// YouTube channel analytics. All three reads are verified live (see
// docs/media-agent.md): channel info, statistics, and recent uploads. Every
// field degrades to null/[] on failure rather than throwing.
async function youtubeAnalytics(env, userId) {
  const ident = { userId };
  const out = { channel: null, subscribers: null, views: null, video_count: null, videos: [] };
  try {
    const ch = await composioExecute(env, "YOUTUBE_LIST_CHANNELS", ident, { mine: true });
    const c = (ch.data && (ch.data.items || [])[0]) || null;
    if (c) {
      const sn = c.snippet || {};
      const th = sn.thumbnails || {};
      out.channel = {
        id: c.id || null,
        title: sn.title || null,
        handle: sn.customUrl || null,
        thumb: (th.medium && th.medium.url) || (th.default && th.default.url) || (th.high && th.high.url) || null,
      };
    }
  } catch {}
  try {
    const st = await composioExecute(env, "YOUTUBE_GET_CHANNEL_STATISTICS", ident, { mine: true });
    const s = (st.data && ((st.data.channels || [])[0] || (st.data.items || [])[0])) || null;
    const stats = s && s.statistics;
    if (stats) {
      out.subscribers = anNum(stats.subscriberCount);
      out.views = anNum(stats.viewCount);
      out.video_count = anNum(stats.videoCount);
    }
  } catch {}
  try {
    const vids = await composioExecute(env, "YOUTUBE_LIST_CHANNEL_VIDEOS", ident, { mine: true, maxResults: 12 });
    const items = (vids.data && (vids.data.items || [])) || [];
    out.videos = items.map((v) => {
      const sn = v.snippet || {};
      const th = sn.thumbnails || {};
      const vidId = (sn.resourceId && sn.resourceId.videoId) || null;
      return {
        id: vidId,
        title: String(sn.title || "").slice(0, 100),
        thumb: (th.medium && th.medium.url) || (th.high && th.high.url) || (th.default && th.default.url) || null,
        published: sn.publishedAt || null,
        url: vidId ? "https://www.youtube.com/watch?v=" + vidId : null,
      };
    }).filter((v) => v.id).slice(0, 8);
  } catch {}
  return out;
}

// The channel's uploads for the YouTube Videos tab. The list comes from the
// verified LIST_CHANNEL_VIDEOS read; per-video view/like counts are enriched
// opportunistically via a batch details call (best-effort — degrades to no
// counts if that action isn't available).
async function youtubeVideos(env, userId, limit) {
  const ident = { userId };
  let list = [];
  try {
    const vids = await composioExecute(env, "YOUTUBE_LIST_CHANNEL_VIDEOS", ident, {
      mine: true, maxResults: Math.min(Math.max(limit || 24, 1), 50),
    });
    const items = (vids.data && (vids.data.items || [])) || [];
    // YouTube keeps tombstones for deleted uploads in the channel list — title
    // "Deleted video" and no thumbnails. Drop them (both checks, so a real
    // video actually titled that never gets hidden).
    list = items.filter((v) => {
      const sn = v.snippet || {};
      return !(sn.title === "Deleted video" && !Object.keys(sn.thumbnails || {}).length);
    }).map((v) => {
      const sn = v.snippet || {};
      const th = sn.thumbnails || {};
      const vidId = (sn.resourceId && sn.resourceId.videoId) || null;
      return {
        id: vidId,
        title: String(sn.title || "").slice(0, 140),
        // Largest thumbnail YouTube has for this video — the grid cards render
        // big (and 2x on retina), so medium (320px) visibly blurs.
        thumb: (th.maxres && th.maxres.url) || (th.standard && th.standard.url) || (th.high && th.high.url) || (th.medium && th.medium.url) || (th.default && th.default.url) || null,
        published: sn.publishedAt || null,
        url: vidId ? "https://www.youtube.com/watch?v=" + vidId : null,
        views: null, likes: null,
      };
    }).filter((v) => v.id);
  } catch { return { videos: [] }; }
  try {
    const ids = list.map((v) => v.id).slice(0, 50).join(",");
    if (ids) {
      const det = await composioExecute(env, "YOUTUBE_GET_VIDEO_DETAILS_BATCH", ident, { id: ids });
      const ditems = (det.data && (det.data.items || [])) || [];
      const byId = {};
      for (const it of ditems) { if (it && it.id) byId[it.id] = it.statistics || {}; }
      for (const v of list) { const s = byId[v.id]; if (s) { v.views = anNum(s.viewCount); v.likes = anNum(s.likeCount); } }
    }
  } catch {}
  return { videos: list };
}

// The channel's playlists for the YouTube Playlists tab (verified read).
async function youtubePlaylists(env, userId) {
  const ident = { userId };
  try {
    const pl = await composioExecute(env, "YOUTUBE_LIST_USER_PLAYLISTS", ident, {});
    const items = (pl.data && (pl.data.items || [])) || [];
    const playlists = items.map((p) => {
      const sn = p.snippet || {};
      const th = sn.thumbnails || {};
      const cd = p.contentDetails || {};
      return {
        id: p.id || null,
        title: String(sn.title || "").slice(0, 140),
        thumb: (th.medium && th.medium.url) || (th.high && th.high.url) || (th.default && th.default.url) || null,
        count: anNum(cd.itemCount),
        url: p.id ? "https://www.youtube.com/playlist?list=" + p.id : null,
      };
    }).filter((p) => p.id);
    return { playlists };
  } catch { return { playlists: [] }; }
}

// The user's Instagram posts (most recent first), normalized for the grid.
// Likes/comments come free with the media list; per-post reach would need an
// insight call each, so it's left for a detail view later.
async function instagramPosts(env, userId, limit) {
  const ident = { userId };
  let igId = null;
  try {
    const info = await composioExecute(env, "INSTAGRAM_GET_USER_INFO", ident, {});
    const d = info.data || {};
    igId = d.id || d.ig_id || (d.data && d.data.id) || null;
  } catch {}
  if (!igId) return { posts: [] };
  try {
    const media = await composioExecute(env, "INSTAGRAM_GET_IG_USER_MEDIA", ident, {
      ig_user_id: igId, limit: Math.min(Math.max(limit || 48, 1), 96),
      fields: "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,like_count,comments_count,timestamp",
    });
    const posts = anMediaList(media.data).map((m) => ({
      id: m.id,
      caption: String(m.caption || "").replace(/\s+/g, " ").trim().slice(0, 140),
      media_type: String(m.media_product_type || "").toUpperCase() === "REELS" ? "reel"
        : String(m.media_type || "").toLowerCase() === "carousel_album" ? "carousel"
        : String(m.media_type || "").toLowerCase(),
      thumb: m.thumbnail_url || m.media_url || null,
      permalink: m.permalink || null,
      likes: anNum(m.like_count), comments: anNum(m.comments_count),
      timestamp: m.timestamp || null,
    })).filter((p) => p.id);
    return { posts };
  } catch { return { posts: [] }; }
}

// A merged feed of recent comments across the user's latest posts. Instagram
// has no account-wide comment feed, so we pull the recent posts then their
// comments and flatten. Bounded to a handful of posts to cap Composio calls.
async function instagramComments(env, userId) {
  const ident = { userId };
  let igId = null;
  try {
    const info = await composioExecute(env, "INSTAGRAM_GET_USER_INFO", ident, {});
    const d = info.data || {};
    igId = d.id || d.ig_id || (d.data && d.data.id) || null;
  } catch {}
  if (!igId) return { comments: [] };
  let media = [];
  try {
    const m = await composioExecute(env, "INSTAGRAM_GET_IG_USER_MEDIA", ident, {
      ig_user_id: igId, limit: 8,
      fields: "id,media_type,media_url,thumbnail_url,permalink",
    });
    media = anMediaList(m.data).slice(0, 8);
  } catch {}
  const out = [];
  for (const post of media) {
    try {
      const c = await composioExecute(env, "INSTAGRAM_GET_IG_MEDIA_COMMENTS", ident, { ig_media_id: post.id });
      const list = (c.data && (c.data.data || (c.data.comments && c.data.comments.data))) || [];
      for (const cm of Array.isArray(list) ? list : []) {
        if (!cm || !cm.id) continue;
        out.push({
          id: cm.id,
          text: String(cm.text || "").replace(/\s+/g, " ").trim().slice(0, 300),
          from: cm.username || (cm.from && cm.from.username) || null,
          likes: anNum(cm.like_count),
          timestamp: cm.timestamp || null,
          post_id: post.id,
          post_thumb: post.thumbnail_url || post.media_url || null,
          post_permalink: post.permalink || null,
        });
      }
    } catch {}
  }
  out.sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
  return { comments: out.slice(0, 60) };
}

// ── Auto-reply engine (cron) ───────────────────────────────────────────────
// Runs on a schedule (see scheduled()): for accounts with DM and/or comment
// auto-reply on, it answers new inbound DMs and new public comments using the
// owner's saved per-channel prompt. While under test it's gated to an allowlist
// of uids — empty the set to open it to everyone.
const AUTOREPLY_ALLOW = new Set(["7cf5e6de-a025-419e-81ca-18e26a648cf6"]);

function sbSvcHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

// Ref ids we've already answered for this user+channel (reply at most once).
async function autoreplyHandled(env, uid, channel = "dm") {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/autoreply_log?user_id=eq.${uid}&channel=eq.${channel}&select=ref_id&order=created_at.desc&limit=300`, {
      headers: sbSvcHeaders(env), signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;               // null → couldn't read; caller skips sending to stay safe
    const rows = await r.json().catch(() => []);
    return new Set((Array.isArray(rows) ? rows : []).map((x) => x.ref_id));
  } catch { return null; }
}

async function autoreplyMark(env, uid, refId, replied, channel = "dm") {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/autoreply_log`, {
      method: "POST",
      headers: { ...sbSvcHeaders(env), Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: uid, channel, ref_id: refId, replied: !!replied }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {}
}

// Recency guard. DMs: Instagram only allows a reply within 24h of the last
// inbound message. Comments: we self-impose a short window so enabling the
// feature doesn't necro-reply an old backlog.
function autoreplyWithinDays(ts, days = 1) {
  if (ts == null || ts === "") return true;   // unknown → let the send attempt decide
  let t = typeof ts === "number" ? ts : Date.parse(ts);
  if (!Number.isFinite(t)) return true;
  if (t < 1e12) t *= 1000;                     // seconds → ms
  return Date.now() - t < days * 24 * 60 * 60 * 1000;
}

// Draft a reply with Haiku from the owner's instructions + the recent context.
// kind: 'dm' (private thread) | 'comment' (public reply under a post).
async function autoreplyDraft(env, transcript, ownerPrompt, kind = "dm") {
  const surface = kind === "comment"
    ? "You are auto-replying to a PUBLIC comment on one of the account owner's Instagram posts. " +
      "Keep it to ONE short public reply (well under 300 characters), no more than one hashtag, no links, " +
      "and never write in all capital letters. "
    : "You are auto-replying to an Instagram direct message on behalf of the account owner. ";
  const system =
    surface +
    "Follow the owner's instructions exactly. Write ONE short, natural reply in the owner's voice — " +
    "no surrounding quotation marks, no preamble. Output only the reply text.\n\n" +
    "Owner's instructions:\n" + String(ownerPrompt || "").slice(0, 3000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", max_tokens: 300, system,
        messages: [{ role: "user", content: "Conversation so far:\n" + transcript + "\n\nWrite the reply." }],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return null;
    const d = await r.json().catch(() => ({}));
    const text = (d.content || []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
    return text ? text.slice(0, 900) : null;
  } catch { return null; }
}

// Answer new inbound DMs for one user.
async function runAutoReplyDm(env, uid, cfg) {
  const ident = { userId: uid };
  const info = await composioExecute(env, "INSTAGRAM_GET_USER_INFO", ident, {});
  const me = info.data && (info.data.username || (info.data.data && info.data.data.username));
  if (!me) return;
  const handled = await autoreplyHandled(env, uid);
  if (!handled) return;                          // couldn't read the log — skip this tick (no double-replies)
  const c = await composioExecute(env, "INSTAGRAM_LIST_ALL_CONVERSATIONS", ident, {});
  const items = (c.data && (c.data.data || c.data.conversations || c.data.items)) || [];
  if (!Array.isArray(items) || !items.length) return;
  const msgsOf = (d) => (d && (d.data || (d.messages && d.messages.data))) || [];
  let budget = 5;                                // cap sends per user per run
  for (const it of items.slice(0, 10)) {
    if (budget <= 0) break;
    const m = await composioExecute(env, "INSTAGRAM_LIST_ALL_MESSAGES", ident, { conversation_id: it.id });
    const ml = msgsOf(m.data);
    if (!Array.isArray(ml) || !ml.length) continue;
    const latest = ml[0];                        // newest-first
    const fromUser = latest.from && latest.from.username;
    if (!latest.id || !fromUser || fromUser === me) continue;   // last message is ours or unknown
    if (handled.has(latest.id)) continue;        // already answered this message
    if (!autoreplyWithinDays(latest.created_time, 1)) { await autoreplyMark(env, uid, latest.id, false); continue; }
    const recipient = latest.from && latest.from.id;
    if (!recipient) continue;
    const transcript = ml.slice(0, 10).reverse()
      .map((x) => ((x.from && x.from.username) === me ? "You" : "Them") + ": " + String(x.message || "").replace(/\s+/g, " ").trim())
      .filter((l) => l.length > 5).join("\n");
    const reply = await autoreplyDraft(env, transcript, cfg.dm_prompt);
    if (!reply) continue;                         // no draft this time — retry next tick
    let ok = false;
    try {
      const ex = await composioExecute(env, "INSTAGRAM_SEND_TEXT_MESSAGE", ident, { recipient_id: String(recipient), text: reply });
      ok = ex.successful;
    } catch {}
    await autoreplyMark(env, uid, latest.id, ok); // mark handled either way — never loop on one message
    budget--;
  }
}

// Answer new public comments on one user's recent posts.
async function runAutoReplyComment(env, uid, cfg) {
  const ident = { userId: uid };
  const info = await composioExecute(env, "INSTAGRAM_GET_USER_INFO", ident, {});
  const d = (info.data && (info.data.data || info.data)) || {};
  const me = d.username;
  const igId = d.id || d.ig_id || null;
  if (!me || !igId) return;
  const handled = await autoreplyHandled(env, uid, "comment");
  if (!handled) return;                          // couldn't read the log — skip this tick
  let media = [];
  try {
    const m = await composioExecute(env, "INSTAGRAM_GET_IG_USER_MEDIA", ident, {
      ig_user_id: igId, limit: 8, fields: "id,permalink",
    });
    media = anMediaList(m.data).slice(0, 8);
  } catch {}
  if (!media.length) return;
  let budget = 5;                                // cap replies per user per run
  for (const post of media) {
    if (budget <= 0) break;
    let list = [];
    try {
      const c = await composioExecute(env, "INSTAGRAM_GET_IG_MEDIA_COMMENTS", ident, { ig_media_id: post.id });
      list = (c.data && (c.data.data || (c.data.comments && c.data.comments.data))) || [];
    } catch { continue; }
    for (const cm of Array.isArray(list) ? list : []) {
      if (budget <= 0) break;
      if (!cm || !cm.id) continue;
      const from = cm.username || (cm.from && cm.from.username) || null;
      if (!from || from === me) continue;          // skip our own comments / our own replies
      if (handled.has(cm.id)) continue;            // already answered this comment
      if (!autoreplyWithinDays(cm.timestamp, 2)) { await autoreplyMark(env, uid, cm.id, false, "comment"); continue; }
      const text = String(cm.text || "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const reply = await autoreplyDraft(env, "@" + from + " commented: " + text, cfg.comment_prompt, "comment");
      if (!reply) continue;                        // no draft this time — retry next tick
      let ok = false;
      try {
        const ex = await composioExecute(env, "INSTAGRAM_POST_IG_COMMENT_REPLIES", ident, {
          ig_comment_id: String(cm.id), message: reply.slice(0, 300),
        });
        ok = ex.successful;
      } catch {}
      await autoreplyMark(env, uid, cm.id, ok, "comment"); // mark handled either way
      budget--;
    }
  }
}

// Cron entry: run each enabled (and allowlisted) channel for every account.
async function runAutoReply(env) {
  if (!env.COMPOSIO_API_KEY || !env.ANTHROPIC_API_KEY || !env.SUPABASE_SERVICE_KEY) return;
  let rows = [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/user_autoreply?or=(dm_enabled.eq.true,comment_enabled.eq.true)&select=user_id,dm_enabled,dm_prompt,comment_enabled,comment_prompt`, {
      headers: sbSvcHeaders(env), signal: AbortSignal.timeout(8000),
    });
    if (r.ok) rows = await r.json().catch(() => []);
  } catch {}
  for (const cfg of Array.isArray(rows) ? rows : []) {
    if (AUTOREPLY_ALLOW.size && !AUTOREPLY_ALLOW.has(cfg.user_id)) continue;   // scoped while testing
    if (cfg.dm_enabled && String(cfg.dm_prompt || "").trim()) {
      try { await runAutoReplyDm(env, cfg.user_id, cfg); } catch {}
    }
    if (cfg.comment_enabled && String(cfg.comment_prompt || "").trim()) {
      try { await runAutoReplyComment(env, cfg.user_id, cfg); } catch {}
    }
  }
}

// ── Media Agent brain: read-only action catalog ───────────────────────────
// The agent gets ONE tool (run_action) and may only call slugs in this
// allowlist — all read-only, so it can never post/delete on the live accounts.
// Publishing actions land later behind an explicit confirm gate.
const AGENT_ACTIONS = {
  instagram: {
    INSTAGRAM_GET_USER_INFO: "Profile: username, followers/follows counts, media count, account type. Returns the IG account id ('id') that media actions need.",
    INSTAGRAM_GET_USER_INSIGHTS: "Account-level insights (reach, impressions, follower demographics). May need 'metric' and 'period' args.",
    INSTAGRAM_GET_IG_USER_MEDIA: "List your published posts. Needs 'ig_user_id' — get it from INSTAGRAM_GET_USER_INFO first.",
    INSTAGRAM_GET_IG_MEDIA: "Details of one post. Needs the media id.",
    INSTAGRAM_GET_IG_MEDIA_INSIGHTS: "Performance metrics for one post (views, reach, engagement). Needs the media id.",
    INSTAGRAM_GET_IG_MEDIA_COMMENTS: "Comments on one post. Needs the media id.",
    INSTAGRAM_GET_IG_USER_CONTENT_PUBLISHING_LIMIT: "How many posts can still be published in the current 24h window.",
  },
  youtube: {
    YOUTUBE_LIST_CHANNELS: "Your channel(s). Pass {\"mine\": true}.",
    YOUTUBE_GET_CHANNEL_STATISTICS: "Subscriber, view and video counts. Pass {\"mine\": true}.",
    YOUTUBE_LIST_CHANNEL_VIDEOS: "Your uploaded videos (most recent first). Pass {\"mine\": true}.",
    YOUTUBE_LIST_USER_PLAYLISTS: "Your playlists.",
    YOUTUBE_LIST_USER_SUBSCRIPTIONS: "Channels you subscribe to.",
    YOUTUBE_SEARCH_YOU_TUBE: "Search YouTube. Needs 'q'.",
  },
};
const AGENT_ALLOW = new Set([
  ...Object.keys(AGENT_ACTIONS.instagram),
  ...Object.keys(AGENT_ACTIONS.youtube),
]);

function agentSystemPrompt(connected) {
  const lines = [];
  for (const [tk, acts] of Object.entries(AGENT_ACTIONS)) {
    const on = connected[tk];
    lines.push(`\n${tk.toUpperCase()} — ${on ? "connected" : "NOT connected (tell the user to connect it above; don't call its actions)"}`);
    for (const [slug, desc] of Object.entries(acts)) lines.push(`  • ${slug}: ${desc}`);
  }
  return [
    "You are the Media Agent for Zephyr (isibi.ai) — a helpful assistant that manages the user's Instagram and YouTube accounts.",
    "You can inspect their accounts by calling run_action with one of the allowed action slugs and its arguments. All actions are READ-ONLY right now; you cannot post, upload, comment, or delete yet — if asked to, say that publishing is coming soon.",
    "Chain actions when needed (e.g. get the IG account id before listing media). Keep answers concise and concrete — cite real numbers you fetched. Format lists cleanly. Never invent metrics; if an action fails, say what happened.",
    "\nAllowed actions:", lines.join("\n"),
  ].join("\n");
}

export default {
  async fetch(request, env, ctx) {
    const resp = harden(await handleRequest(request, env, ctx), request);
    try { const m = new URL(request.url).pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\//); if (m) recordSiteHit(env, ctx, m[1].toLowerCase(), resp.status); } catch {}
    return resp;
  },
  // Cron trigger (see wrangler.jsonc): drive the DM auto-reply engine.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAutoReply(env));
    ctx.waitUntil(runScheduledSiteFunctions(env, ctx));
  },
};

// ── Free-tier media proxy ──
// Free/over-cap users can't save to the gallery, so their render is delivered
// on the temporary provider link. Putting that raw link straight into a
// <video>/<audio> src exposes the provider host (right-click "copy address",
// devtools) — which the platform never reveals. Instead the provider URL is
// AES-GCM-sealed into an opaque token the client puts in the src, and
// /api/m/<token> decrypts it server-side and STREAMS the bytes same-origin
// (Range forwarded), so the host is never client-visible. The seal key is
// derived from an existing server secret (no new secret to provision) and the
// token carries an expiry so it can't be replayed forever.
let _mediaKeyPromise = null;
function mediaSealKey(env) {
  if (!_mediaKeyPromise) {
    _mediaKeyPromise = (async () => {
      const material = new TextEncoder().encode((env.FAL_KEY || "isibi") + "|media-proxy-v1");
      const digest = await crypto.subtle.digest("SHA-256", material);
      return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    })();
  }
  return _mediaKeyPromise;
}
function b64urlFromBytes(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function bytesFromB64url(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
// Only genuine provider media URLs are ever sealed/unsealed.
const PROVIDER_MEDIA_RE = /^https:\/\/([a-z0-9-]+\.)?fal\.media\//i;
async function sealMediaUrl(env, mediaUrl, ttlMs = 7 * 24 * 3600 * 1000) {
  if (!PROVIDER_MEDIA_RE.test(mediaUrl)) return null;
  const key = await mediaSealKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify({ u: mediaUrl, e: Date.now() + ttlMs }));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  const packed = new Uint8Array(iv.length + ct.length);
  packed.set(iv, 0);
  packed.set(ct, iv.length);
  return b64urlFromBytes(packed);
}
async function openMediaToken(env, token) {
  try {
    const packed = bytesFromB64url(token);
    if (packed.length < 29) return null; // 12 iv + 16 tag minimum
    const iv = packed.slice(0, 12);
    const ct = packed.slice(12);
    const key = await mediaSealKey(env);
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    const obj = JSON.parse(new TextDecoder().decode(plainBuf));
    if (!obj || typeof obj.u !== "string") return null;
    if (obj.e && Date.now() > obj.e) return null;
    if (!PROVIDER_MEDIA_RE.test(obj.u)) return null;
    return obj.u;
  } catch {
    return null;
  }
}

// ── Published-site visitor auth (real accounts for the sites the builder makes) ──
// Storage is Supabase (site_users, service-key writes); the Worker is the brains:
// PBKDF2 password hashing + HMAC-signed stateless session tokens. The signing key
// is derived from a server-only secret so no new secret is needed and it never
// leaves the Worker. These accounts are the SITE'S members — wholly separate from
// isibi's own auth.users (the builder). Same-origin (isibi.ai/s/… → isibi.ai/api),
// so the published-site CSP (connect-src 'self') already allows the calls.
let _siteAuthKeyPromise = null;
function siteAuthKey(env) {
  if (!_siteAuthKeyPromise) {
    _siteAuthKeyPromise = (async () => {
      const material = new TextEncoder().encode((env.SUPABASE_SERVICE_KEY || env.FAL_KEY || "isibi") + "|site-auth-v1");
      const digest = await crypto.subtle.digest("SHA-256", material);
      return crypto.subtle.importKey("raw", digest, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
    })();
  }
  return _siteAuthKeyPromise;
}
// Constant-time byte compare (avoid leaking hash equality via timing).
function timingSafeEqualBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
const PBKDF2_ITERS = 100000;
async function hashSitePassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMat = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" }, keyMat, 256));
  return "pbkdf2$" + PBKDF2_ITERS + "$" + b64urlFromBytes(salt) + "$" + b64urlFromBytes(bits);
}
async function verifySitePassword(password, stored) {
  try {
    const parts = String(stored || "").split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    const iters = parseInt(parts[1], 10) || PBKDF2_ITERS;
    const salt = bytesFromB64url(parts[2]);
    const expected = bytesFromB64url(parts[3]);
    const keyMat = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iters, hash: "SHA-256" }, keyMat, expected.length * 8));
    return timingSafeEqualBytes(bits, expected);
  } catch { return false; }
}
async function signSiteToken(env, payload, ttlMs = 30 * 24 * 3600 * 1000) {
  const body = { ...payload, exp: Date.now() + ttlMs };
  const b = b64urlFromBytes(new TextEncoder().encode(JSON.stringify(body)));
  const key = await siteAuthKey(env);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(b)));
  return b + "." + b64urlFromBytes(sig);
}
async function verifySiteToken(env, token) {
  try {
    const [b, sigStr] = String(token || "").split(".");
    if (!b || !sigStr) return null;
    const key = await siteAuthKey(env);
    const ok = await crypto.subtle.verify("HMAC", key, bytesFromB64url(sigStr), new TextEncoder().encode(b));
    if (!ok) return null;
    const obj = JSON.parse(new TextDecoder().decode(bytesFromB64url(b)));
    if (!obj || (obj.exp && Date.now() > obj.exp)) return null;
    return obj;
  } catch { return null; }
}
const SITE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Published-site analytics: one hit per served page, aggregated per slug/day.
async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// Fire-and-forget (ctx.waitUntil) so serving the page is never slowed. Bots are
// skipped; the IP is hashed (never stored raw) so "visitors" = distinct hash/day.
function logSiteHit(env, ctx, slug, path, request) {
  if (!env.SUPABASE_SERVICE_KEY) return;
  const ua = request.headers.get("User-Agent") || "";
  if (/bot|crawl|spider|slurp|facebookexternalhit|bingpreview|headless|monitor|uptime|curl|wget/i.test(ua)) return;
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "0";
  const p = (async () => {
    try {
      const ipHash = (await sha256hex(ip + "|" + slug + "|isibi-analytics-v1")).slice(0, 32);
      await fetch(`${SUPABASE_URL}/rest/v1/site_hits`, {
        method: "POST",
        headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ slug, ip_hash: ipHash, path: (path || "/").slice(0, 200) }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {}
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(p);
}

// ── Secrets vault: AES-GCM encrypt at rest, key derived from a server-only secret.
let _siteSecretKeyPromise = null;
function siteSecretKey(env) {
  if (!_siteSecretKeyPromise) {
    _siteSecretKeyPromise = (async () => {
      const material = new TextEncoder().encode((env.SUPABASE_SERVICE_KEY || env.FAL_KEY || "isibi") + "|site-secrets-v1");
      const digest = await crypto.subtle.digest("SHA-256", material);
      return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    })();
  }
  return _siteSecretKeyPromise;
}
async function encryptSecret(env, plaintext) {
  const key = await siteSecretKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(String(plaintext))));
  const packed = new Uint8Array(iv.length + ct.length); packed.set(iv, 0); packed.set(ct, iv.length);
  return b64urlFromBytes(packed);
}
// Inverse of encryptSecret — used ONLY server-side by the function interpreter to
// inject a stored secret into an outbound fetch. A plaintext secret NEVER leaves
// the Worker (never returned in an API response).
async function decryptSecret(env, packed) {
  const key = await siteSecretKey(env);
  const bytes = bytesFromB64url(String(packed || ""));
  const iv = bytes.slice(0, 12), ct = bytes.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// ── Site "edge functions" (Path A): the generator DECLARES a function-SPEC (a
// bounded trigger→steps recipe), never arbitrary code. The Worker interprets the
// spec against primitives we already own (collections, secrets, external fetch),
// so nothing user-authored ever executes — there is no code to sandbox. ──
const FN_ACTIONS = new Set(["read", "save", "fetch", "respond", "checkout", "email", "ai", "notify"]);
const cleanColl = (s) => (typeof s === "string" ? s.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) : "");
const cleanAs = (s) => (typeof s === "string" ? s.replace(/[^A-Za-z0-9_]/g, "").slice(0, 40) : "");
// Bound a spec value: keep template placeholders intact, cap strings/arrays/objects.
function cleanTempl(v, depth = 0) {
  if (typeof v === "string") return v.slice(0, 4000);
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (depth >= 4) return undefined;
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => cleanTempl(x, depth + 1)).filter((x) => x !== undefined);
  if (v && typeof v === "object") { const o = {}; let n = 0; for (const k of Object.keys(v)) { if (n++ >= 20) break; const cv = cleanTempl(v[k], depth + 1); if (cv !== undefined) o[String(k).slice(0, 80)] = cv; } return o; }
  return undefined;
}
// Validate + normalize a declared spec to the tight shape the interpreter runs.
// Returns null for anything empty or unrecognizable (block is then just dropped).
function normalizeFnSpec(spec) {
  if (!spec || typeof spec !== "object") return null;
  const stepsIn = Array.isArray(spec.steps) ? spec.steps : [];
  const steps = []; let fetches = 0;
  for (const s of stepsIn) {
    if (steps.length >= 8) break;
    if (!s || typeof s !== "object") continue;
    const op = String(s.do || s.action || "").toLowerCase();
    if (!FN_ACTIONS.has(op)) continue;
    if (op === "read") {
      const collection = cleanColl(s.collection); if (!collection) continue;
      steps.push({ do: "read", collection, limit: Math.min(50, Math.max(1, parseInt(s.limit, 10) || 20)), as: cleanAs(s.as) || "records" });
    } else if (op === "save") {
      const collection = cleanColl(s.collection); if (!collection) continue;
      steps.push({ do: "save", collection, data: cleanTempl(s.data) || {} });
    } else if (op === "fetch") {
      if (fetches >= 2) continue; fetches++;
      const url = typeof s.url === "string" ? s.url.slice(0, 600) : ""; if (!url) continue;
      const method = ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(String(s.method || "GET").toUpperCase()) ? String(s.method).toUpperCase() : "GET";
      const step = { do: "fetch", url, method, headers: cleanTempl(s.headers) || {}, as: cleanAs(s.as) || "response" };
      if (s.body != null) step.body = cleanTempl(s.body);
      steps.push(step);
    } else if (op === "ai") {
      const prompt = typeof s.prompt === "string" ? s.prompt.slice(0, 6000) : "";
      if (!prompt) continue;
      steps.push({ do: "ai", prompt, system: typeof s.system === "string" ? s.system.slice(0, 2000) : "", as: cleanAs(s.as) || "ai" });
    } else if (op === "notify") {
      steps.push({ do: "notify", to: cleanTempl(s.to != null ? s.to : s.user), type: typeof s.type === "string" ? s.type.slice(0, 40) : "", text: cleanTempl(s.text != null ? s.text : s.message), link: cleanTempl(s.link) });
    } else if (op === "respond") {
      steps.push({ do: "respond", data: cleanTempl(s.data != null ? s.data : s.body) });
    } else if (op === "checkout") {
      steps.push({
        do: "checkout",
        secret: typeof s.secret === "string" ? (s.secret.replace(/[^A-Za-z0-9_]/g, "").slice(0, 64) || "STRIPE_KEY") : "STRIPE_KEY",
        amount: (typeof s.amount === "number" || typeof s.amount === "string") ? String(s.amount).slice(0, 40) : "",
        currency: typeof s.currency === "string" ? s.currency.slice(0, 8) : "usd",
        name: typeof s.name === "string" ? s.name.slice(0, 200) : "",
        quantity: Math.min(999, Math.max(1, parseInt(s.quantity, 10) || 1)),
        mode: s.mode === "subscription" ? "subscription" : "payment",
        interval: ["day", "week", "month", "year"].includes(s.interval) ? s.interval : "month",
        success_url: typeof s.success_url === "string" ? s.success_url.slice(0, 600) : "",
        cancel_url: typeof s.cancel_url === "string" ? s.cancel_url.slice(0, 600) : "",
        as: cleanAs(s.as) || "session",
      });
    } else if (op === "email") {
      steps.push({
        do: "email",
        provider: ["resend", "sendgrid", "postmark"].includes(s.provider) ? s.provider : "resend",
        secret: typeof s.secret === "string" ? (s.secret.replace(/[^A-Za-z0-9_]/g, "").slice(0, 64) || "RESEND_KEY") : "RESEND_KEY",
        from: typeof s.from === "string" ? s.from.slice(0, 200) : "",
        to: typeof s.to === "string" ? s.to.slice(0, 200) : "",
        subject: typeof s.subject === "string" ? s.subject.slice(0, 300) : "",
        html: typeof s.html === "string" ? s.html.slice(0, 20000) : (typeof s.text === "string" ? s.text.slice(0, 20000) : ""),
        as: cleanAs(s.as) || "email",
      });
    }
  }
  if (!steps.length) return null;
  const out = { trigger: "http", steps };
  if (spec.verify === "stripe") out.verify = "stripe";
  // Optional schedule: run on a timer from the cron. Clamp 5 min … 30 days.
  const em = spec.schedule && parseInt(spec.schedule.everyMinutes, 10);
  if (Number.isFinite(em) && em > 0) out.schedule = { everyMinutes: Math.min(43200, Math.max(5, em)) };
  // Optional event trigger: run automatically when a row is inserted INTO or UPDATED IN a
  // declared table. Accepts { on:{ insert:"table" } } / { on:{ update:"table" } },
  // "on":"insert:table" / "on":"update:table", or trigger:"insert:table" / "update:table".
  let trigI = null, trigU = null;
  if (spec.on && typeof spec.on === "object") { if (typeof spec.on.insert === "string") trigI = spec.on.insert; if (typeof spec.on.update === "string") trigU = spec.on.update; }
  else if (typeof spec.on === "string" && /^insert:/i.test(spec.on)) trigI = spec.on.slice(7);
  else if (typeof spec.on === "string" && /^update:/i.test(spec.on)) trigU = spec.on.slice(7);
  else if (typeof spec.trigger === "string" && /^insert:/i.test(spec.trigger)) trigI = spec.trigger.slice(7);
  else if (typeof spec.trigger === "string" && /^update:/i.test(spec.trigger)) trigU = spec.trigger.slice(7);
  const _cleanTrig = (x) => { const t = String(x).replace(/[^a-z0-9_]/gi, "").slice(0, 41); return t || null; };
  const oi = trigI ? _cleanTrig(trigI) : null, ou = trigU ? _cleanTrig(trigU) : null;
  if (oi || ou) { out.on = {}; if (oi) out.on.insert = oi; if (ou) out.on.update = ou; }
  return out;
}
// Pull declared <script type="application/isibi-fn" data-name="X">{spec}</script>
// blocks out of a page: return the cleaned HTML (blocks stripped — the spec must
// never ship to the public page) plus the validated {name, spec} list.
function extractSiteFunctions(html) {
  const fns = [];
  const clean = String(html || "").replace(/<script\b[^>]*type=["']application\/isibi-fn["'][^>]*>([\s\S]*?)<\/script>/gi, (m, inner) => {
    const nameM = m.match(/data-name=["']([A-Za-z0-9_-]{1,64})["']/i);
    const name = nameM ? nameM[1] : "";
    let spec = null; try { spec = JSON.parse(String(inner).trim()); } catch {}
    const norm = name && spec ? normalizeFnSpec(spec) : null;
    if (name && norm) fns.push({ name, spec: norm });
    return ""; // strip regardless — never leave a dead/leaky block on the page
  });
  return { clean, fns };
}
// Resolve {{input.x}} / {{steps.<as>.<path>}} placeholders. {{secret.NAME}} is
// resolved ONLY when `secrets` is provided (fetch step); everywhere else (save,
// respond) a secret ref collapses to "" so a plaintext key can never be echoed.
function resolveStr(s, data, secrets) {
  return String(s).replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (m, path) => {
    const parts = path.split(".");
    if (parts[0] === "secret") { const name = parts[1] || ""; return secrets && Object.prototype.hasOwnProperty.call(secrets, name) ? String(secrets[name]) : ""; }
    let cur = parts[0] === "input" ? data.input : parts[0] === "steps" ? data.steps : undefined;
    for (let i = 1; i < parts.length && cur != null; i++) cur = cur[parts[i]];
    if (cur == null) return "";
    return typeof cur === "object" ? JSON.stringify(cur) : String(cur);
  }).slice(0, 6000);
}
// Resolve one path to its RAW value (not stringified) — used when a template value
// is a SOLE `{{placeholder}}`, so `"{{steps.list.records}}"` embeds the actual array
// (a function can respond with structured data), not a JSON string of it.
function resolveRaw(path, data, secrets) {
  const parts = path.split(".");
  if (parts[0] === "secret") { const name = parts[1] || ""; return secrets && Object.prototype.hasOwnProperty.call(secrets, name) ? secrets[name] : ""; }
  let cur = parts[0] === "input" ? data.input : parts[0] === "steps" ? data.steps : undefined;
  for (let i = 1; i < parts.length && cur != null; i++) cur = cur[parts[i]];
  return cur;
}
function resolveTempl(v, data, secrets) {
  if (typeof v === "string") {
    const sole = v.match(/^\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}$/); // the whole value is ONE placeholder → preserve its type
    if (sole) { const raw = resolveRaw(sole[1], data, secrets); if (raw !== undefined) return raw; }
    return resolveStr(v, data, secrets);
  }
  if (Array.isArray(v)) return v.map((x) => resolveTempl(x, data, secrets));
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = resolveTempl(v[k], data, secrets); return o; }
  return v;
}
// Decrypt this site's secrets into a name→plaintext map (server-only, per run).
async function loadSiteSecrets(env, ownerId, slug) {
  const map = {};
  try {
    const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/site_secrets?owner_id=eq.${ownerId}&slug=eq.${encodeURIComponent(slug)}&select=name,value_encrypted&limit=100`, { headers: svc, signal: AbortSignal.timeout(8000) });
    const rows = await r.json().catch(() => []);
    for (const row of (Array.isArray(rows) ? rows : [])) { try { map[row.name] = await decryptSecret(env, row.value_encrypted); } catch {} }
  } catch {}
  return map;
}
// Send an email through a provider (Resend/SendGrid/Postmark) — shared by the
// `email` function action and password-reset. Key + recipient go only to the
// provider; returns {ok, status}.
async function postProviderEmail(provider, key, from, to, subject, html) {
  let url, headers, bodyObj;
  if (provider === "sendgrid") { url = "https://api.sendgrid.com/v3/mail/send"; headers = { Authorization: "Bearer " + key, "Content-Type": "application/json" }; bodyObj = { personalizations: [{ to: [{ email: to }] }], from: { email: from }, subject, content: [{ type: "text/html", value: html }] }; }
  else if (provider === "postmark") { url = "https://api.postmarkapp.com/email"; headers = { "X-Postmark-Server-Token": key, "Content-Type": "application/json", Accept: "application/json" }; bodyObj = { From: from, To: to, Subject: subject, HtmlBody: html }; }
  else { url = "https://api.resend.com/emails"; headers = { Authorization: "Bearer " + key, "Content-Type": "application/json" }; bodyObj = { from, to, subject, html }; }
  try {
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(bodyObj), signal: AbortSignal.timeout(12000) });
    await readCapped(resp, 4096);
    return { ok: resp.status >= 200 && resp.status < 300, status: resp.status };
  } catch { return { ok: false, status: 0 }; }
}
// Send using the site owner's configured email secrets (convention: EMAIL_FROM +
// one of RESEND_KEY / SENDGRID_KEY / POSTMARK_KEY). Returns false if unconfigured
// — the platform has no fallback sender for a site (it's bring-your-own).
async function sendSiteEmailByConvention(env, ownerId, slug, to, subject, html) {
  const secrets = await loadSiteSecrets(env, ownerId, slug);
  const from = secrets.EMAIL_FROM;
  if (!from) return false;
  const provider = secrets.RESEND_KEY ? "resend" : secrets.SENDGRID_KEY ? "sendgrid" : secrets.POSTMARK_KEY ? "postmark" : "";
  const key = secrets.RESEND_KEY || secrets.SENDGRID_KEY || secrets.POSTMARK_KEY || "";
  if (!provider || !key) return false;
  return (await postProviderEmail(provider, key, from, to, subject, html)).ok;
}
// Send a PLATFORM email (from isibi itself) through Go Farther — used by features
// that aren't the site owner's own provider, e.g. built-app password resets.
// No-ops (returns false) if GO_FARTHER_API_KEY isn't configured on the Worker.
async function sendPlatformEmail(env, to, subject, html) {
  if (!env.GO_FARTHER_API_KEY) return false;
  try {
    const r = await fetch("https://lkpfeqrelvziltfwpuxi.supabase.co/functions/v1/mailer", {
      method: "POST",
      headers: { Authorization: "Bearer " + env.GO_FARTHER_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", from: env.EMAIL_FROM || "isibi <login@isibi.ai>", to, subject, html }),
      signal: AbortSignal.timeout(10000),
    });
    return r.ok;
  } catch { return false; }
}
// Run one declared function against the live primitives. Every path is bounded
// (≤8 steps, ≤2 fetches already enforced in the spec, 8s per network op, 32KB
// response reads) and external fetches go through safeFetch (SSRF-guarded).
// Event triggers: functions declared with on:{insert:<table>} run automatically when a
// row is inserted into <table>. The per-slug trigger list is cached in-isolate (60s TTL)
// so a normal insert pays at most one lookup per minute — sites with no triggers cache an
// empty list. Fired via ctx.waitUntil so the visitor's write never waits on the function.
const _trigCache = new Map();
async function insertTriggersFor(env, slug) {
  const c = _trigCache.get(slug);
  if (c && (Date.now() - c.at) < 60000) return c.fns;
  let fns = [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/site_functions?slug=eq.${encodeURIComponent(slug)}&enabled=is.true&select=owner_id,published_site_id,name,spec&limit=50`, { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY }, signal: AbortSignal.timeout(6000) });
    const rows = await r.json().catch(() => []);
    if (Array.isArray(rows)) fns = rows.filter((x) => x && x.spec && x.spec.on && (x.spec.on.insert || x.spec.on.update));
  } catch {}
  _trigCache.set(slug, { at: Date.now(), fns });
  return fns;
}
// Fire the functions whose `on.<event>` names this table. event = "insert" | "update".
function fireRowTriggers(env, ctx, slug, table, rowData, event) {
  if (!env.SUPABASE_SERVICE_KEY) return;
  const run = async () => {
    let fns; try { fns = await insertTriggersFor(env, slug); } catch { return; }
    for (const f of fns) {
      const target = f.spec.on && f.spec.on[event];
      if (!target || String(target).toLowerCase() !== String(table).toLowerCase()) continue;
      try { await runSiteFunction(env, { owner_id: f.owner_id, published_site_id: f.published_site_id, spec: f.spec }, Object.assign({ _event: event }, rowData || {}), slug); } catch {}
    }
  };
  if (ctx && ctx.waitUntil) ctx.waitUntil(run()); else run();
}
function fireInsertTriggers(env, ctx, slug, table, rowData) { fireRowTriggers(env, ctx, slug, table, rowData, "insert"); }
function fireUpdateTriggers(env, ctx, slug, table, rowData) { fireRowTriggers(env, ctx, slug, table, rowData, "update"); }
async function runSiteFunction(env, row, input, slug) {
  const steps = Array.isArray(row.spec && row.spec.steps) ? row.spec.steps.slice(0, 8) : [];
  const data = { input: input && typeof input === "object" && !Array.isArray(input) ? input : {}, steps: {} };
  const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY };
  let secrets = null, response = null;
  // React sites have their OWN D1 database — a function's read/save should target
  // the app's real tables (record a Stripe order, read app data for a digest), not
  // the legacy collections store. Looked up once, lazily; sites with no D1 fall back
  // to site_collections (unchanged). D1 read/save only touch DECLARED tables.
  let d1uuid = undefined, d1schema = null; // undefined=not looked up yet, null=no D1
  const getD1 = async () => {
    if (d1uuid === undefined) {
      d1uuid = null;
      if (d1Configured(env)) { try { const u = await siteBackendBySlug(env, slug); if (u) { d1uuid = u; d1schema = await loadSiteSchema(env, u); } } catch {} }
    }
    return d1uuid;
  };
  const d1Cols = (def) => { const managed = new Set(["id", "created_at", "owner_id"]); return (Array.isArray(def.columns) ? def.columns : []).map((c) => (typeof c === "string" ? c : c && c.name)).filter((n) => n && !managed.has(String(n).toLowerCase())); };
  for (const st of steps) {
    try {
      if (st.do === "read") {
        const uuid = await getD1();
        const def = uuid ? tableDef(d1schema, String(st.collection || "")) : null;
        if (uuid && def) {
          const lim = Math.min(200, Math.max(1, parseInt(st.limit || 20, 10) || 20));
          const rows = await cfD1Query(env, uuid, "SELECT * FROM " + sqlIdent(def.name) + " ORDER BY id DESC LIMIT ?", [lim]);
          data.steps[st.as] = { records: rows, count: rows.length };
        } else {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/site_collections?slug=eq.${encodeURIComponent(slug)}&collection=eq.${encodeURIComponent(st.collection)}&select=data,created_at&order=created_at.desc&limit=${st.limit || 20}`, { headers: svc, signal: AbortSignal.timeout(8000) });
          const rows = await r.json().catch(() => []);
          const records = Array.isArray(rows) ? rows.map((x) => x.data) : [];
          data.steps[st.as] = { records, count: records.length };
        }
      } else if (st.do === "save") {
        const rec = resolveTempl(st.data, data, null); // secrets never saved to a public store
        const uuid = await getD1();
        const def = uuid ? tableDef(d1schema, String(st.collection || "")) : null;
        if (uuid && def) {
          const use = d1Cols(def).filter((c) => rec && rec[c] !== undefined);
          if (use.length) { await cfD1Query(env, uuid, "INSERT INTO " + sqlIdent(def.name) + " (" + use.map(sqlIdent).join(",") + ") VALUES (" + use.map(() => "?").join(",") + ")", use.map((c) => rec[c])); }
          data.steps[st.as || "saved"] = { ok: true };
        } else {
          // Legacy collections. Bound abuse: same ≤500-per-(slug,collection) cap as /api/site/data.
          let total = 0;
          try { const c = await fetch(`${SUPABASE_URL}/rest/v1/site_collections?slug=eq.${encodeURIComponent(slug)}&collection=eq.${encodeURIComponent(st.collection)}&select=id`, { headers: { ...svc, Prefer: "count=exact", Range: "0-0" }, signal: AbortSignal.timeout(8000) }); total = parseInt(((c.headers.get("content-range") || "").split("/")[1] || "0"), 10) || 0; } catch {}
          if (total < 500) { try { await fetch(`${SUPABASE_URL}/rest/v1/site_collections`, { method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ published_site_id: row.published_site_id || null, owner_id: row.owner_id, slug, collection: st.collection, data: rec && typeof rec === "object" ? rec : {} }), signal: AbortSignal.timeout(8000) }); } catch {} }
          data.steps[st.as || "saved"] = { ok: true };
        }
      } else if (st.do === "ai") {
        // Platform LLM call, metered to this app's owner. Prompt/system may template
        // in earlier steps + input; the result lands as {{steps.<as>.text}}.
        const prompt = resolveStr(String(st.prompt || ""), data, null);
        const system = st.system ? resolveStr(String(st.system), data, null) : "";
        const res = await runSiteAI(env, row.owner_id, { prompt, system });
        data.steps[st.as || "ai"] = (res.text != null) ? { text: res.text } : { error: res.error || "ai unavailable" };
      } else if (st.do === "fetch") {
        if (secrets === null) secrets = await loadSiteSecrets(env, row.owner_id, slug);
        const url = resolveStr(st.url, data, secrets);
        const headers = resolveTempl(st.headers, data, secrets) || {};
        let out; if (st.body != null) { const b = resolveTempl(st.body, data, secrets); out = typeof b === "string" ? b : JSON.stringify(b); }
        const resp = await safeFetch(url, { method: st.method, headers, body: (st.method === "GET" || st.method === "DELETE") ? undefined : out, signal: AbortSignal.timeout(8000) });
        let status = 0, parsed = null;
        if (resp) { status = resp.status; const txt = new TextDecoder().decode(await readCapped(resp, 32768)); try { parsed = JSON.parse(txt); } catch { parsed = txt; } }
        data.steps[st.as] = { status, body: parsed };
      } else if (st.do === "checkout") {
        // Create a Stripe Checkout Session with the owner's key (from the vault).
        // Key goes ONLY to api.stripe.com; only the returned url/id is captured.
        if (secrets === null) secrets = await loadSiteSecrets(env, row.owner_id, slug);
        const key = st.secret && Object.prototype.hasOwnProperty.call(secrets, st.secret) ? secrets[st.secret] : "";
        const amount = parseInt(resolveStr(String(st.amount || ""), data, null), 10);
        if (!key || !(amount > 0)) { data.steps[st.as] = { error: "checkout not configured — add your Stripe key in Secrets and a valid amount" }; continue; }
        const name = (resolveStr(st.name || "Purchase", data, null) || "Purchase").slice(0, 250);
        const currency = (st.currency || "usd").toLowerCase().replace(/[^a-z]/g, "").slice(0, 3) || "usd";
        const form = new URLSearchParams();
        form.set("mode", st.mode === "subscription" ? "subscription" : "payment");
        const su = resolveStr(st.success_url || "", data, null), cu = resolveStr(st.cancel_url || "", data, null);
        if (su) form.set("success_url", su.slice(0, 600));
        if (cu) form.set("cancel_url", cu.slice(0, 600));
        form.set("line_items[0][quantity]", String(st.quantity || 1));
        form.set("line_items[0][price_data][currency]", currency);
        form.set("line_items[0][price_data][unit_amount]", String(amount));
        form.set("line_items[0][price_data][product_data][name]", name);
        if (st.mode === "subscription") form.set("line_items[0][price_data][recurring][interval]", st.interval || "month");
        try {
          const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString(), signal: AbortSignal.timeout(12000) });
          const txt = new TextDecoder().decode(await readCapped(resp, 32768));
          let j = null; try { j = JSON.parse(txt); } catch {}
          data.steps[st.as] = (j && j.url) ? { url: j.url, id: j.id } : { error: (j && j.error && j.error.message) || "checkout failed" };
        } catch { data.steps[st.as] = { error: "checkout failed" }; }
      } else if (st.do === "email") {
        // Send through the owner's OWN email provider (key from the vault). Key +
        // recipients go only to the provider; only status/ok is captured.
        if (secrets === null) secrets = await loadSiteSecrets(env, row.owner_id, slug);
        const key = st.secret && Object.prototype.hasOwnProperty.call(secrets, st.secret) ? secrets[st.secret] : "";
        const to = resolveStr(st.to || "", data, null).slice(0, 200);
        const from = resolveStr(st.from || "", data, null).slice(0, 200);
        const subject = resolveStr(st.subject || "", data, null).slice(0, 300);
        const html = resolveStr(st.html || "", data, null).slice(0, 20000);
        if (!key || !to || !from) { data.steps[st.as] = { error: "email not configured — add your email provider key in Secrets and set from/to" }; continue; }
        const er = await postProviderEmail(st.provider, key, from, to, subject, html);
        data.steps[st.as] = { ok: er.ok, status: er.status };
      } else if (st.do === "notify") {
        // Create an in-app notification for a member (server-side only). `to` is a
        // member id (templated from earlier steps/input). No secret exposure.
        const uuid = await getD1();
        if (uuid) {
          const to = resolveStr(String(st.to != null ? st.to : ""), data, null);
          const text = resolveStr(String(st.text || ""), data, null);
          const link = resolveStr(String(st.link || ""), data, null);
          try { await createNotification(env, uuid, to, { type: st.type, text, link }); } catch {}
        }
        data.steps[st.as || "notified"] = { ok: true };
      } else if (st.do === "respond") {
        response = resolveTempl(st.data, data, null); // NEVER expose secrets to the caller
      }
    } catch { data.steps[st.as || "_err"] = { error: true }; }
  }
  return response != null ? response : { ok: true };
}
// Persist declared functions (service-key upsert on owner+slug+name). Called at
// build/revise time; declared functions overwrite prior versions, none are auto-
// deleted (the owner removes them from the Cloud panel).
async function persistSiteFunctions(env, ownerId, slug, fns) {
  if (!env.SUPABASE_SERVICE_KEY || !slug || !ownerId || !fns.length) return;
  const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY, "Content-Type": "application/json" };
  const now = new Date().toISOString();
  const rows = fns.slice(0, 20).map((f) => ({ owner_id: ownerId, slug, name: f.name, spec: f.spec, enabled: true, updated_at: now, schedule_minutes: (f.spec && f.spec.schedule && f.spec.schedule.everyMinutes) || null }));
  try { await fetch(`${SUPABASE_URL}/rest/v1/site_functions?on_conflict=owner_id,slug,name`, { method: "POST", headers: { ...svc, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows), signal: AbortSignal.timeout(10000) }); } catch {}
}
// Best-effort per-slug rate limit (per isolate) — a coarse backstop on top of the
// hard per-run bounds, since /api/site/fn is public like /api/site/form.
const _fnRate = new Map();
function fnRateOk(slug) {
  const now = Date.now(), e = _fnRate.get(slug);
  if (!e || now > e.reset) { _fnRate.set(slug, { n: 1, reset: now + 60000 }); return true; }
  if (e.n >= 120) return false; e.n++; return true;
}
// Stripe webhook signature verification (so a forged "payment succeeded" can't
// mark an order paid). Header: "t=<ts>,v1=<hex hmac of `${t}.${rawBody}`>".
async function hmacSha256Hex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function ctEqHex(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
async function verifyStripeSig(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = {};
  for (const kv of String(sigHeader).split(",")) { const i = kv.indexOf("="); if (i > 0) { const k = kv.slice(0, i).trim(); if (!(k in parts)) parts[k] = kv.slice(i + 1).trim(); } }
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return false;
  const ts = parseInt(t, 10);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false; // 5-min replay window
  const expected = await hmacSha256Hex(secret, t + "." + rawBody);
  return ctEqHex(expected, v1);
}
// Server-side query over a collection (records' `data` is JSONB). We fetch up to
// the storage cap (500) then filter/sort/paginate IN THE WORKER — safe (no raw
// query is ever exposed to a visitor → no injection) and bounded. Keeps the
// wrapped {data, created_at} row shape so existing sites' rec.data still works.
// Params: where=<field>:<op>:<value> (repeatable; op eq|ne|lt|lte|gt|gte|contains|in),
//         q=<text> (free-text over string fields), sort=<field> order=asc|desc,
//         limit(1..100), offset(≥0). Returns {records, total, offset, limit}.
function applySiteQuery(rows, sp) {
  let list = (Array.isArray(rows) ? rows : []).filter((x) => x && x.data && typeof x.data === "object");
  const num = (v) => { const s = String(v == null ? "" : v).trim(); if (s === "") return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
  const OPS = ["eq", "ne", "lt", "lte", "gt", "gte", "contains", "in"];
  const clauses = sp.getAll("where").slice(0, 8).map((w) => {
    const s = String(w); const i = s.indexOf(":"), j = s.indexOf(":", i + 1);
    if (i < 0 || j < 0) return null;
    const field = s.slice(0, i).replace(/[^A-Za-z0-9_]/g, "").slice(0, 60);
    const op = s.slice(i + 1, j).toLowerCase();
    const val = s.slice(j + 1).slice(0, 200);
    return field && OPS.includes(op) ? { field, op, val } : null;
  }).filter(Boolean);
  const match = (d, c) => {
    const cell = d[c.field];
    if (c.op === "eq") return String(cell) === c.val;
    if (c.op === "ne") return String(cell) !== c.val;
    if (c.op === "contains") return String(cell == null ? "" : cell).toLowerCase().includes(c.val.toLowerCase());
    if (c.op === "in") return c.val.split(",").map((x) => x.trim()).includes(String(cell));
    const a = num(cell), b = num(c.val);
    if (a == null || b == null) return false;
    return c.op === "lt" ? a < b : c.op === "lte" ? a <= b : c.op === "gt" ? a > b : a >= b;
  };
  if (clauses.length) list = list.filter((row) => clauses.every((c) => match(row.data, c)));
  const q = (sp.get("q") || "").trim().toLowerCase().slice(0, 100);
  if (q) list = list.filter((row) => Object.keys(row.data).some((k) => typeof row.data[k] === "string" && row.data[k].toLowerCase().includes(q)));
  const sortField = (sp.get("sort") || "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 60);
  if (sortField) {
    const desc = (sp.get("order") || "asc").toLowerCase() === "desc";
    list.sort((x, y) => {
      const xv = x.data[sortField], yv = y.data[sortField], xn = num(xv), yn = num(yv);
      const c = (xn != null && yn != null) ? (xn - yn) : String(xv == null ? "" : xv).localeCompare(String(yv == null ? "" : yv));
      return desc ? -c : c;
    });
  }
  const total = list.length;
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "50", 10) || 50));
  const offset = Math.max(0, parseInt(sp.get("offset") || "0", 10) || 0);
  return { records: list.slice(offset, offset + limit), total, offset, limit };
}
// Load an enabled function by (slug, name) and run it. Shared by /api/site/fn
// (the site's own JS) and /api/site/hook/… (external webhooks).
async function invokeSiteFunctionByName(env, slug, fnName, input) {
  const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY };
  let row = null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/site_functions?slug=eq.${encodeURIComponent(slug)}&name=eq.${encodeURIComponent(fnName)}&enabled=is.true&select=owner_id,published_site_id,spec&limit=1`, { headers: svc, signal: AbortSignal.timeout(8000) });
    const rows = await r.json().catch(() => []); row = Array.isArray(rows) ? rows[0] : null;
  } catch {}
  if (!row) return { notFound: true };
  return { out: await runSiteFunction(env, row, input, slug) };
}
// Cron tick (every 2 min): run any scheduled function whose interval has elapsed.
// input is {scheduled:true}; last_run is stamped so it fires ~once per interval.
async function runScheduledSiteFunctions(env, ctx) {
  if (!env.SUPABASE_SERVICE_KEY) return;
  const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY };
  let rows = [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/site_functions?enabled=is.true&schedule_minutes=not.is.null&select=owner_id,published_site_id,slug,name,spec,schedule_minutes,last_run&limit=200`, { headers: svc, signal: AbortSignal.timeout(10000) });
    rows = await r.json().catch(() => []);
  } catch { return; }
  if (!Array.isArray(rows)) return;
  const now = Date.now();
  const due = rows.filter((row) => {
    const mins = parseInt(row.schedule_minutes, 10); if (!(mins > 0)) return false;
    if (!row.last_run) return true;
    const last = Date.parse(row.last_run); if (!Number.isFinite(last)) return true;
    return (now - last) >= (mins * 60000 - 30000); // 30s grace so a 2-min tick doesn't skip an hourly job
  }).slice(0, 50); // bound work per tick
  for (const row of due) {
    try {
      // Stamp last_run FIRST so a slow run can't double-fire on the next tick.
      await fetch(`${SUPABASE_URL}/rest/v1/site_functions?slug=eq.${encodeURIComponent(row.slug)}&name=eq.${encodeURIComponent(row.name)}`, {
        method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ last_run: new Date().toISOString() }), signal: AbortSignal.timeout(8000),
      });
      await runSiteFunction(env, row, { scheduled: true }, row.slug);
    } catch {}
  }
}

// ── Website Builder: server-side image generation ──
// The design pass emits <img data-gen="<photo prompt>" data-ar="16:9"> placeholders;
// we generate each with Nano Banana Pro (fal sync endpoint), host it in the user's
// Supabase storage, and swap the real URL in — real photography, not CSS art.
const SITE_IMG_MODEL = "fal-ai/nano-banana-pro";
const SITE_IMG_USD = 0.15; // 2K nano-banana-pro (fal), = ceil(0.15/0.008)=19 credits
async function genOneSiteImage(env, prompt, aspect) {
  const r = await fetch(`https://fal.run/${SITE_IMG_MODEL}`, {
    method: "POST",
    headers: { Authorization: `Key ${env.FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: String(prompt || "").slice(0, 1500),
      aspect_ratio: /^\d{1,2}:\d{1,2}$/.test(aspect) ? aspect : "16:9",
      resolution: "2K", output_format: "jpeg", num_images: 1,
    }),
    signal: AbortSignal.timeout(120000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("img gen " + r.status);
  const url = d.images && d.images[0] && d.images[0].url;
  if (!url) throw new Error("img gen empty");
  return url;
}
async function storeSiteImage(request, uid, falUrl) {
  const media = await fetch(falUrl, { signal: AbortSignal.timeout(30000) });
  if (!media.ok || !media.body) throw new Error("img fetch");
  const ct = (media.headers.get("content-type") || "image/jpeg").split(";")[0];
  const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
  const path = `${uid}/site/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const jwt = (request.headers.get("Authorization") || "").slice(7);
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY, "Content-Type": ct, "cache-control": "max-age=31536000" },
    body: media.body,
    signal: AbortSignal.timeout(30000),
  });
  if (!up.ok) throw new Error("img store " + up.status);
  return `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}
// Soft gradient placeholder (base64 SVG data URI) when an image can't be made —
// keeps the layout intact instead of a broken-image icon.
function siteImgFallback() {
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='10'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#241c2e'/><stop offset='1' stop-color='#0d0b12'/></linearGradient></defs><rect width='16' height='10' fill='url(#g)'/></svg>";
  return "data:image/svg+xml;base64," + btoa(svg);
}
const decodeHtmlAttr = (s) => String(s || "").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
// Fill every data-gen <img> in `html`: generate the first `budget` in parallel,
// host + swap real src; anything over budget or that fails gets the gradient
// fallback. Returns { html, charged } (charged = images that actually generated).
async function injectSiteImages(html, request, env, uid, budget) {
  const tags = [];
  html.replace(/<img\b[^>]*\bdata-gen="[^"]*"[^>]*>/gi, (tag) => { tags.push(tag); return tag; });
  if (!tags.length) return { html, charged: 0 };
  const withReal = tags.slice(0, Math.max(0, budget));
  const overflow = tags.slice(Math.max(0, budget));
  const done = await Promise.all(withReal.map(async (tag) => {
    const prompt = decodeHtmlAttr((tag.match(/data-gen="([^"]*)"/i) || [])[1]);
    const ar = (tag.match(/data-ar="([^"]*)"/i) || [])[1] || "16:9";
    try {
      const falUrl = await genOneSiteImage(env, prompt, ar);
      const hosted = await storeSiteImage(request, uid, falUrl);
      return { tag, src: hosted, ok: true };
    } catch (e) {
      console.log("site image failed:", e && e.message);
      return { tag, src: siteImgFallback(), ok: false };
    }
  }));
  let out = html, charged = 0;
  const swap = (tag, src) => tag.replace(/\sdata-gen="[^"]*"/i, ' src="' + src + '"').replace(/\sdata-ar="[^"]*"/i, "");
  for (const r of done) { out = out.replace(r.tag, swap(r.tag, r.src)); if (r.ok) charged++; }
  for (const tag of overflow) out = out.replace(tag, swap(tag, siteImgFallback()));
  return { html: out, charged };
}
// React variant of the image pass (Phase 3): the generated project's SOURCE files
// carry `@@IMG:<prompt>@@` tokens (a nearby data-ar gives the aspect). Generate +
// host a real image for each UNIQUE token within budget, then substitute the URL
// into every file BEFORE the container build. Over-budget / failed → gradient
// fallback. Returns the rewritten files + how many images were actually charged.
async function injectReactImages(files, request, env, uid, budget, onImage) {
  const tokens = new Map(); // token → { prompt, ar }
  for (const src of Object.values(files)) {
    const rr = /@@IMG:([\s\S]*?)@@/g; let m;
    while ((m = rr.exec(src))) {
      if (tokens.has(m[0])) continue;
      const near = src.slice(m.index, m.index + m[0].length + 90);
      const ar = (near.match(/data-ar=["']?(\d{1,2}:\d{1,2})/) || [])[1] || "16:9";
      tokens.set(m[0], { prompt: m[1].trim().slice(0, 1500), ar });
    }
  }
  const list = [...tokens.entries()];
  const affordable = list.slice(0, Math.max(0, budget));
  const overflow = list.slice(Math.max(0, budget));
  const urlByToken = {};
  let charged = 0;
  (await Promise.all(affordable.map(async ([tok, info]) => {
    try { const f = await genOneSiteImage(env, info.prompt, info.ar); const url = await storeSiteImage(request, uid, f); try { if (onImage) onImage({ prompt: info.prompt, url }); } catch {} return [tok, url, true]; }
    catch (e) { console.log("react image failed:", e && e.message); return [tok, siteImgFallback(), false]; }
  }))).forEach(([tok, url, ok]) => { urlByToken[tok] = url; if (ok) charged++; });
  for (const [tok] of overflow) urlByToken[tok] = siteImgFallback();
  const out = {};
  for (const [path, src] of Object.entries(files)) {
    let s = src;
    for (const [tok, url] of Object.entries(urlByToken)) s = s.split(tok).join(url);
    s = s.replace(/@@IMG:[\s\S]*?@@/g, () => siteImgFallback()); // any stray tokens
    out[path] = s;
  }
  return { files: out, charged };
}

// ---- Layer-2: per-site backend on Cloudflare D1 --------------------------------
// Each built site that needs data/auth gets its OWN D1 database, created on demand
// via the Cloudflare REST API and addressed by its UUID — a query for site A can
// only ever reach site A's database (hard isolation, one Worker, many DBs). The
// slug→UUID map lives in Supabase (site_backends, service-key writes). Requires two
// Worker secrets: CF_ACCOUNT_ID + CF_D1_API_TOKEN (token scoped to D1:Edit).
function d1Configured(env) { return !!(env.CF_ACCOUNT_ID && env.CF_D1_API_TOKEN); }
async function cfD1Create(env, name) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CF_D1_API_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.result || !d.result.uuid) { const e = new Error("d1 create failed"); e.detail = JSON.stringify(d.errors || d).slice(0, 300); throw e; }
  return d.result.uuid;
}
// D1 binds a JS boolean as the text "true"/"false" (both truthy in the app that
// reads it back — "false" would break `if (row.done)`). SQLite has no boolean
// type; the convention is 1/0. Coerce every bound param so boolean columns round-
// trip cleanly. (undefined → null so a missing value doesn't bind as the string.)
function d1Params(params) {
  return (params || []).map((v) => (v === true ? 1 : v === false ? 0 : v === undefined ? null : v));
}
// Run SQL against ONE site's D1 database (by UUID). Returns the first statement's
// result rows. Always parameterize — never string-concat user input into `sql`.
async function cfD1Query(env, uuid, sql, params) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${uuid}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CF_D1_API_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ sql, params: d1Params(params) }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.success === false) { const e = new Error("d1 query failed"); e.detail = JSON.stringify(d.errors || d).slice(0, 400); throw e; }
  const first = Array.isArray(d.result) ? d.result[0] : d.result;
  return (first && first.results) || [];
}
// Same as cfD1Query but also returns how many rows the statement changed
// (meta.changes) — used by scoped UPDATE/DELETE to tell "done" from "matched
// nothing" (e.g. a visitor trying to edit a row that isn't theirs → 0 changes).
async function cfD1Exec(env, uuid, sql, params) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${uuid}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CF_D1_API_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ sql, params: d1Params(params) }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.success === false) { const e = new Error("d1 query failed"); e.detail = JSON.stringify(d.errors || d).slice(0, 400); throw e; }
  const first = Array.isArray(d.result) ? d.result[0] : d.result;
  return { results: (first && first.results) || [], changes: (first && first.meta && typeof first.meta.changes === "number") ? first.meta.changes : null };
}
// NOTE: D1's HTTP /query API rejects multi-statement SQL and disallows BEGIN/COMMIT, so
// true multi-write transactions aren't available for these dynamic per-site DBs. Cascade
// runs SEQUENTIAL deletes children-FIRST — a mid-way failure can only leave a childless
// parent (harmless, re-deletable), never an orphan child.
// Direct child tables of <parentName>: the declared tables with a column whose `ref`
// points back at it (used to cascade a delete so no orphan children are left behind).
function childRefsOf(spec, parentName) {
  const out = []; const pn = String(parentName).toLowerCase();
  for (const t of (spec && Array.isArray(spec.tables) ? spec.tables : [])) {
    const refs = (t && t.refs) || {}; const modes = (t && t.refModes) || {};
    for (const col of Object.keys(refs)) if (String(refs[col]).toLowerCase() === pn) out.push({ table: t.name, col, mode: modes[col] || "cascade" });
  }
  return out;
}
// Delete one row AND its direct children (rows in tables whose `ref` points at it), so
// a delete never orphans related rows. Verifies the row exists within the caller's scope
// FIRST (so a not-yours/gone row deletes nothing), then removes children + the row in one
// batched call. Returns false if the row wasn't there / not in scope. (One level of
// children — the common shape; grandchildren aren't auto-chased.)
async function cascadeDeleteRow(env, uuid, spec, table, tn, id, scopeSql, scopeParams) {
  const sp = scopeParams || [];
  const check = await cfD1Query(env, uuid, "SELECT id FROM " + tn + " WHERE id=?" + (scopeSql || ""), [id].concat(sp));
  if (!check[0]) return false;
  const kids = childRefsOf(spec, table);
  // RESTRICT: if any restricted child still points here, refuse the delete (throw → 409).
  for (const k of kids.filter((k) => k.mode === "restrict")) {
    const ex = await cfD1Query(env, uuid, "SELECT 1 FROM " + sqlIdent(k.table) + " WHERE " + sqlIdent(k.col) + "=? LIMIT 1", [id]);
    if (ex[0]) throw Object.assign(new Error("delete restricted: related rows in " + k.table), { restrict: true });
  }
  // Then unlink (setNull) or remove (cascade, default) the rest.
  for (const k of kids) {
    if (k.mode === "restrict") continue;
    try {
      if (k.mode === "setnull") await cfD1Query(env, uuid, "UPDATE " + sqlIdent(k.table) + " SET " + sqlIdent(k.col) + "=NULL WHERE " + sqlIdent(k.col) + "=?", [id]);
      else await cfD1Query(env, uuid, "DELETE FROM " + sqlIdent(k.table) + " WHERE " + sqlIdent(k.col) + "=?", [id]);
    } catch (e) { console.error("cascade child (" + k.mode + ") failed:", k.table, e && e.message); }
  }
  await cfD1Query(env, uuid, "DELETE FROM " + tn + " WHERE id=?" + (scopeSql || ""), [id].concat(sp));
  return true;
}
// Permanently delete a site's D1 database (idempotent — already-gone is fine).
async function cfD1Delete(env, uuid) {
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${uuid}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${env.CF_D1_API_TOKEN}` },
    });
    return r.ok || r.status === 404;
  } catch { return false; }
}
// Look up (or lazily create) the D1 backend for a site slug → its database UUID.
// Ownership is enforced: a caller can only reach a backend whose row.uid is theirs.
async function ensureSiteBackend(env, slug, uid) {
  const hdr = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
  const g = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(slug)}&select=d1_uuid,uid`, { headers: hdr });
  const rows = await g.json().catch(() => []);
  if (Array.isArray(rows) && rows[0] && rows[0].d1_uuid) {
    if (uid && rows[0].uid && rows[0].uid !== uid) throw Object.assign(new Error("not owner"), { forbidden: true });
    return rows[0].d1_uuid;
  }
  const name = ("site_" + slug).replace(/[^a-z0-9_-]/gi, "_").slice(0, 60);
  const uuid = await cfD1Create(env, name);
  await fetch(`${SUPABASE_URL}/rest/v1/site_backends`, {
    method: "POST",
    headers: { ...hdr, "content-type": "application/json", Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify({ slug, uid, d1_uuid: uuid, d1_name: name }),
  });
  return uuid;
}
// Phase B — schema: the AI declares the tables a data-driven site needs (as a
// validated JSON spec, NOT raw SQL), and we generate safe DDL and apply it to that
// site's own D1 database. Every identifier is strictly validated + double-quoted so
// a declared name can never inject SQL; types are whitelisted. Each table always
// gets an auto `id` PK and a `created_at`. Idempotent (CREATE TABLE IF NOT EXISTS).
const D1_TYPES = { text: "TEXT", string: "TEXT", integer: "INTEGER", int: "INTEGER", real: "REAL", float: "REAL", number: "REAL", numeric: "NUMERIC", blob: "BLOB", boolean: "INTEGER", bool: "INTEGER", json: "TEXT", array: "TEXT", object: "TEXT" };
// JSON/array columns store as TEXT: an object/array value is JSON-stringified on write
// and re-parsed on read, so an app can keep nested/flexible data in one column.
function jsonizeRow(def, obj) {
  const jc = (def && Array.isArray(def.json)) ? def.json : null;
  if (!jc || !jc.length || !obj || typeof obj !== "object") return obj;
  for (const c of jc) { const v = obj[c]; if (v !== undefined && v !== null && typeof v === "object") { try { obj[c] = JSON.stringify(v); } catch {} } }
  return obj;
}
function parseJsonRows(def, rows) {
  const jc = (def && Array.isArray(def.json)) ? def.json : null;
  if (!jc || !jc.length || !Array.isArray(rows)) return rows;
  for (const r of rows) { if (!r) continue; for (const c of jc) { const v = r[c]; if (typeof v === "string" && (v[0] === "{" || v[0] === "[")) { try { r[c] = JSON.parse(v); } catch {} } } }
  return rows;
}
// Computed / derived read columns — `computed:{full_name:["first_name"," ","last_name"]}`.
// On READ, each template token that matches a declared column name is replaced by that
// row's value; anything else is a literal. Assembled in JS (no SQL, so no injection); the
// value is attached under the computed name. Read-only (never written/queried). NULLs → "".
// Formula fields — a table-level `formulas:{name:[tok,…]}` computes a NUMBER per row from
// arithmetic over its columns (line_total = quantity * unit_price, net = subtotal - discount,
// with_tax = subtotal * 1.2). Tokens alternate operand/operator; operands are numeric column
// names or literal numbers, operators are + - * / with correct precedence (* and / bind first).
// Read-only + derived (never stored). Any non-numeric operand or divide-by-zero → null.
function attachFormulas(def, rows) {
  const fs = def && def.formulas;
  if (!fs || !Array.isArray(rows) || !rows.length) return rows;
  const colSet = new Set([].concat((Array.isArray(def.columns) ? def.columns : []).map((c) => String(c).toLowerCase()), ["id", "position"]));
  const PREC = { "+": 1, "-": 1, "*": 2, "/": 2 };
  const evalFormula = (toks, r) => {
    const nums = [], ops = [];
    const apply = () => { const op = ops.pop(), b = nums.pop(), a = nums.pop(); let v; if (op === "+") v = a + b; else if (op === "-") v = a - b; else if (op === "*") v = a * b; else v = (b === 0 ? NaN : a / b); if (!Number.isFinite(v)) return false; nums.push(v); return true; };
    let expectNum = true;
    for (const tok of toks) {
      const s = String(tok);
      if (PREC[s] !== undefined && !expectNum) { while (ops.length && PREC[ops[ops.length - 1]] >= PREC[s]) { if (!apply()) return null; } ops.push(s); expectNum = true; }
      else if (expectNum && PREC[s] === undefined) { const v = colSet.has(s.toLowerCase()) ? Number(r[s]) : Number(s); if (!Number.isFinite(v)) return null; nums.push(v); expectNum = false; }
      else return null;
    }
    if (expectNum) return null;
    while (ops.length) { if (!apply()) return null; }
    return nums.length === 1 ? nums[0] : null;
  };
  for (const [name, toks] of Object.entries(fs)) for (const r of rows) { if (!r) continue; r[name] = evalFormula(toks, r); }
  return rows;
}
function attachComputed(def, rows) {
  const comp = def && def.computed;
  if (!comp || !Array.isArray(rows) || !rows.length) return rows;
  const colSet = new Set([].concat((Array.isArray(def.columns) ? def.columns : []).map((c) => String(c).toLowerCase()), ["id", "created_at", "owner_id", "updated_at", "slug", "position", "pinned"]));
  for (const [name, toks] of Object.entries(comp)) {
    for (const r of rows) {
      if (!r) continue;
      r[name] = toks.map((tok) => { const isCol = colSet.has(String(tok).toLowerCase()); return isCol ? (r[tok] != null ? String(r[tok]) : "") : String(tok); }).join("");
    }
  }
  return rows;
}
// Multi-currency — a table-level `currency:{amount,code,base,rates,as}` normalizes each
// row's money into ONE base currency for apples-to-apples roll-ups. `amount` (numeric col)
// + `code` (the row's ISO currency col) → `as` = amount × rate[code] into `base` (rate =
// base units per 1 unit of that currency; base itself is 1). Read-only derived field; an
// unknown currency code (no rate) → null so it reads as unconvertible. The SAME rates drive
// the SQL-side conversion in stats (buildD1Stats) so a cross-currency pipeline sums correctly.
function attachCurrency(def, rows) {
  const cfg = def && def.currency;
  if (!cfg || !Array.isArray(rows) || !rows.length) return rows;
  for (const r of rows) {
    if (!r) continue;
    const amt = Number(r[cfg.amount]);
    const code = String(r[cfg.code] == null ? "" : r[cfg.code]).toUpperCase();
    const rate = code === cfg.base ? 1 : cfg.rates[code];
    r[cfg.as] = (Number.isFinite(amt) && Number.isFinite(rate)) ? Math.round(amt * rate * 100) / 100 : null;
  }
  return rows;
}
// Parse an SLA/duration value → whole minutes. Accepts a number (minutes) or a string with a unit
// (`30m`, `4h`, `2d`, `1w`; bare number = minutes). 0 when unparseable.
function slaMinutes(v) {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  const s = String(v == null ? "" : v).trim().toLowerCase();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)?$/);
  if (!m) return 0;
  const n = parseFloat(m[1]); const u = m[2] || "min";
  const mult = u[0] === "w" ? 10080 : u[0] === "d" ? 1440 : u[0] === "h" ? 60 : 1;
  const mins = Math.floor(n * mult);
  return mins > 0 ? mins : 0;
}
// SLA / time-based deadlines — a table declaring `sla:{start,mins,done}` gets a read-time `_sla`
// on each row describing its deadline and whether it's overdue. The clock runs from `start` (a date
// column, default created_at) for `mins` minutes; if the row's `done` status column holds a
// stop value the clock is MET (never overdue). Pure read-time (no cron) — powers "overdue" badges,
// urgency sorting, and the /overdue queue (which computes the same thing in SQL for filtering).
function attachSla(def, rows, nowMs) {
  const s = def && def.sla;
  if (!s || !s.mins || !Array.isArray(rows) || !rows.length) return rows;
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  for (const r of rows) {
    if (!r) continue;
    const startMs = Date.parse(r[s.start] != null ? r[s.start] : r.created_at);
    if (!Number.isFinite(startMs)) { r._sla = null; continue; }
    const dueMs = startMs + s.mins * 60000;
    const done = !!(s.doneField && s.doneValues && s.doneValues.map((x) => x.toLowerCase()).includes(String(r[s.doneField] == null ? "" : r[s.doneField]).toLowerCase()));
    r._sla = { due_at: new Date(dueMs).toISOString(), remaining_mins: Math.round((dueMs - now) / 60000), overdue: !done && now > dueMs, done };
  }
  return rows;
}
const SAFE_IDENT = /^[a-z_][a-z0-9_]{0,40}$/i;
function sqlIdent(name) { if (!SAFE_IDENT.test(String(name || ""))) throw Object.assign(new Error("bad identifier: " + name), { bad: true }); return '"' + name + '"'; }
// Auto-slug: a url-safe, lowercase, dash-joined key derived from a source column
// ("My First Post!" → "my-first-post"), used for pretty per-row URLs. Uniqueness is
// enforced with a UNIQUE INDEX; on collision we append -2, -3, … (also deduping within
// a single batch via `extraTaken`). Diacritics are folded; empty → "item".
function slugify(s) {
  return String(s == null ? "" : s).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
async function uniqueSlug(env, uuid, tn, base, extraTaken) {
  const rows = await cfD1Query(env, uuid, "SELECT slug FROM " + tn + " WHERE slug = ? OR slug LIKE ?", [base, base + "-%"]);
  const taken = new Set(rows.map((r) => r.slug));
  if (extraTaken) for (const s of extraTaken) taken.add(s);
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100000; n++) { const c = base + "-" + n; if (!taken.has(c)) return c; }
  return base + "-" + Date.now();
}
// Populate body.slug for an INSERT when the table declares a slug source. Returns true
// only when WE generated one (so the caller adds "slug" to the insert column list); an
// app-supplied slug is normalized in place and left to the UNIQUE index to police.
async function maybeSlug(env, uuid, def, tn, body, extraTaken) {
  const sc = def && def.slug; if (!sc || !sc.from || !body || typeof body !== "object") return false;
  if (body.slug !== undefined && body.slug !== null && String(body.slug).trim() !== "") {
    body.slug = slugify(body.slug) || null; if (extraTaken && body.slug) extraTaken.add(body.slug); return false;
  }
  const base = slugify(body[sc.from]) || "item";
  const s = await uniqueSlug(env, uuid, tn, base, extraTaken);
  body.slug = s; if (extraTaken) extraTaken.add(s);
  return true;
}
// Auto-numbering — a table declaring `sequence:{field,prefix,pad,start}` stamps each new row
// with the next human-readable record number (INV-01000, LEAD-0042, PO/2001). Backed by an
// atomic per-table `_counters` row (name `seq:<table>`), so numbers are gap-free and never
// collide even under concurrency. The field is platform-set only (kept out of the writable
// allow-list), so it's authoritative — a client can't spoof or reuse a number. Sets body[field]
// and returns true (so the caller adds the column to the INSERT); false when not configured.
async function maybeSequence(env, uuid, def, tn, body) {
  const sq = def && def.sequence;
  if (!sq || !sq.field || !body || typeof body !== "object") return false;
  const n = await bumpCounter(env, uuid, "seq:" + String(def.name || tn), 1);
  const num = (sq.start || 1) + (Number(n) || 1) - 1;
  const padded = sq.pad > 0 ? String(num).padStart(sq.pad, "0") : String(num);
  body[sq.field] = (sq.prefix || "") + padded;
  return true;
}
// Round-robin assignment (lead routing) — a user/feed table declaring `roundRobin:{among:[roles]}`
// auto-distributes each new row across the pool of members whose role is in `among`, rotating in
// a stable order (by member id) via an atomic per-table `_counters` row (`rr:<table>`). Returns the
// next assignee's id, or `fallback` (the creator) when there's no config or the pool is empty — so
// leads never fail to be owned. Blocked members are skipped from the pool.
async function roundRobinOwner(env, uuid, def, table, fallback) {
  const rr = def && def.roundRobin;
  if (!rr || !Array.isArray(rr.among) || !rr.among.length) return fallback;
  let pool = [];
  try { pool = await cfD1Query(env, uuid, "SELECT id FROM _users WHERE LOWER(role) IN (" + rr.among.map(() => "?").join(",") + ") AND (blocked IS NULL OR blocked=0) ORDER BY id", rr.among); } catch { return fallback; }
  if (!pool.length) return fallback;
  const n = await bumpCounter(env, uuid, "rr:" + String(def.name || table), 1);
  return pool[((Number(n) || 1) - 1) % pool.length].id;
}
// Resolve an "assign token" (a member id or email, as written in an assignBy map) to a member id.
async function resolveMemberId(env, uuid, token) {
  const s = String(token == null ? "" : token).trim();
  if (/^\d+$/.test(s)) { try { const r = await cfD1Query(env, uuid, "SELECT id FROM _users WHERE id=?", [parseInt(s, 10)]); return r[0] ? r[0].id : null; } catch { return null; } }
  if (s.includes("@")) { try { const r = await cfD1Query(env, uuid, "SELECT id FROM _users WHERE email=?", [s.toLowerCase()]); return r[0] ? r[0].id : null; } catch { return null; } }
  return null;
}
// Decide the owner of a new row: TERRITORY routing first (assignBy maps the row's field value to a
// specific member — leads from "west" → the west rep), then ROUND-ROBIN distribution, then the
// creator. So a table can route known segments to named owners and spread the rest across a pool.
async function resolveAssignee(env, uuid, def, table, body, fallback) {
  const ab = def && def.assignBy;
  if (ab && ab.field && body && typeof body === "object") {
    const val = String(body[ab.field] == null ? "" : body[ab.field]).toLowerCase().trim();
    const token = (val && ab.map[val]) || ab.default || null;
    if (token != null) { const id = await resolveMemberId(env, uuid, token); if (id) return id; }
  }
  return await roundRobinOwner(env, uuid, def, table, fallback);
}
// Minimal RFC-4180-ish CSV parser → array of string arrays. Handles quoted fields,
// embedded commas/newlines, and "" escaped quotes. For owner data import.
function parseCsv(text) {
  const s = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = []; let row = [], field = "", q = false, i = 0;
  while (i < s.length) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
// The model mostly emits the canonical shape, but sometimes varies it (tables as
// an object-map keyed by name; `fields` instead of `columns`; a column as a bare
// string or {name,type} with odd keys; missing `access`). Coerce all of that into
// the canonical { tables:[{name, access, columns:[{name,type,...}]}] } so a valid-
// intent schema is never silently dropped. Missing access → 'collect' (safe: public
// insert, owner-only read).
function normalizeSchema(spec) {
  if (!spec || typeof spec !== "object") return { tables: [] };
  const out = [];
  const coerceCol = (c) => {
    if (typeof c === "string") return { name: c, type: "text" };
    if (c && typeof c === "object" && c.name) return { name: c.name, type: c.type || c.dataType || "text", pk: c.pk || c.primary, notnull: c.notnull || c.required || c.notNull, unique: c.unique, ref: c.ref || c.references || c.foreignKey || c.fk, max: (c.max !== undefined ? c.max : (c.maxLength !== undefined ? c.maxLength : c.maxlength)), min: (c.min !== undefined ? c.min : c.minLength), format: c.format, enum: c.enum || c.oneOf || c.values, pattern: c.pattern || c.regex, default: (c.default !== undefined ? c.default : c.defaultValue), immutable: !!(c.immutable || c.readonly || c.readOnly || c.writeOnce), onDelete: (() => { const m = String(c.onDelete || c.on_delete || c.onDeleteAction || "").toLowerCase().replace(/[^a-z]/g, ""); return (m === "setnull" || m === "cascade" || m === "restrict") ? m : null; })() };
    return null;
  };
  const coerceTable = (name, def) => {
    if (!name || !def || typeof def !== "object") return;
    const access = ["collect", "display", "user", "feed", "admin"].includes(def.access) ? def.access : "collect";
    const src = def.columns || def.fields || def.cols || def.schema;
    let cols = [];
    if (Array.isArray(src)) cols = src.map(coerceCol);
    else if (src && typeof src === "object") cols = Object.entries(src).map(([n, ty]) => ({ name: n, type: (typeof ty === "string" ? ty : (ty && (ty.type || ty.dataType)) || "text") }));
    out.push({ name, access, columns: cols.filter(Boolean), unique: def.unique, oncePerUser: def.oncePerUser || def.uniquePerUser || def.oncePer, trash: !!(def.trash || def.softDelete || def.soft), slug: def.slug || def.slugFrom || def.slugify, writeRoles: def.writeRoles || def.write_roles || def.editorRoles, version: !!(def.version || def.optimisticLock || def.concurrency), timestamps: !!(def.timestamps || def.updatedAt || def.updated_at || def.timestamp), ordered: !!(def.ordered || def.position || def.sortable || def.reorderable), expires: !!(def.expires || def.ttl || def.expiry || def.expiring), pinnable: !!(def.pinnable || def.pinned || def.featurable || def.sticky), defaultSort: (() => { const s = def.defaultSort || def.default_sort || def.orderBy || def.order_by; return (typeof s === "string" && /^[-+a-z0-9_,\s]{1,80}$/i.test(s)) ? s : null; })(), scheduled: !!(def.publishable || def.scheduled || def.publishAt || def.publish_at || def.scheduling), uniqueCI: def.uniqueCI || def.uniqueCaseInsensitive || def.ciUnique || null, maxRows: (() => { const n = parseInt(def.maxRows != null ? def.maxRows : (def.max_rows != null ? def.max_rows : (def.rowLimit != null ? def.rowLimit : def.cap)), 10); return (Number.isFinite(n) && n > 0) ? Math.min(n, 10000000) : 0; })(), checks: (() => { const raw = def.checks || def.validate || def.constraints; if (!Array.isArray(raw)) return null; const OPS = new Set(["gt", "gte", "lt", "lte", "eq", "ne"]); const out = []; for (const ch of raw) { if (!Array.isArray(ch) || ch.length < 3) continue; const a = String(ch[0]).toLowerCase(), op = String(ch[1]).toLowerCase(), b = String(ch[2]).toLowerCase(); if (/^[a-z0-9_]{1,40}$/.test(a) && OPS.has(op) && /^[a-z0-9_]{1,40}$/.test(b)) out.push([a, op, b]); } return out.length ? out.slice(0, 12) : null; })(), enforceRefs: !!(def.enforceRefs || def.refIntegrity || def.strictRefs), computed: (() => { const src = def.computed || def.derived || def.virtual; if (!src || typeof src !== "object" || Array.isArray(src)) return null; const out = {}; for (const [name, tpl] of Object.entries(src)) { if (!/^[a-z0-9_]{1,40}$/i.test(name)) continue; const arr = Array.isArray(tpl) ? tpl : (typeof tpl === "string" ? [tpl] : null); if (!arr) continue; const toks = arr.filter((x) => typeof x === "string" && x.length <= 60).slice(0, 8); if (toks.length) out[name.toLowerCase()] = toks; } return Object.keys(out).length ? out : null; })(), requireVerified: !!(def.requireVerified || def.verifiedOnly || def.emailVerified), audit: !!(def.audit || def.auditLog || def.changelog), history: !!(def.history || def.versions || def.snapshots || def.revisions), archivable: !!(def.archivable || def.archive), sync: !!(def.sync || def.syncable || def.offline), searchWeights: (() => { const w = def.searchWeights || def.searchRank || def.searchBoost; if (!w || typeof w !== "object" || Array.isArray(w)) return null; const out = {}; for (const [k, v] of Object.entries(w)) { const n = Number(v); if (/^[a-z0-9_]{1,40}$/i.test(k) && Number.isFinite(n) && n > 0) out[k.toLowerCase()] = Math.min(n, 100); } return Object.keys(out).length ? out : null; })(), rateLimit: (() => { const n = parseInt(def.rateLimit != null ? def.rateLimit : (def.writeLimit != null ? def.writeLimit : (def.throttle != null ? def.throttle : def.maxPerMinute)), 10); return (Number.isFinite(n) && n > 0) ? Math.min(n, 10000) : 0; })(), geo: (() => { const g = def.geo || def.location; if (g && typeof g === "object" && g.lat && g.lng) { const la = String(g.lat).toLowerCase(), ln = String(g.lng).toLowerCase(); if (/^[a-z0-9_]{1,40}$/.test(la) && /^[a-z0-9_]{1,40}$/.test(ln)) return { lat: la, lng: ln }; } return null; })(), transitions: (() => { const raw = def.transitions || def.stateMachine || def.stages; if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null; const out = {}; for (const [col, m] of Object.entries(raw)) { if (!/^[a-z0-9_]{1,40}$/i.test(col) || !m || typeof m !== "object" || Array.isArray(m)) continue; const cm = {}; for (const [from, tos] of Object.entries(m)) { if (String(from).length > 60) continue; const arr = (Array.isArray(tos) ? tos : [tos]).map((x) => String(x)).filter((x) => x.length <= 60).slice(0, 24); if (arr.length) cm[from] = arr; } if (Object.keys(cm).length) out[col.toLowerCase()] = cm; } return Object.keys(out).length ? out : null; })(), formulas: (() => { const src = def.formulas || def.formula || def.calc; if (!src || typeof src !== "object" || Array.isArray(src)) return null; const out = {}; for (const [name, tpl] of Object.entries(src)) { if (!/^[a-z0-9_]{1,40}$/i.test(name)) continue; const arr = Array.isArray(tpl) ? tpl : (typeof tpl === "string" ? tpl.trim().split(/\s+/) : null); if (!arr) continue; const toks = arr.filter((x) => (typeof x === "string" || typeof x === "number") && String(x).length <= 40).map(String).slice(0, 24); if (toks.length) out[name.toLowerCase()] = toks; } return Object.keys(out).length ? out : null; })(), fieldRoles: (() => { const raw = def.fieldRoles || def.fieldSecurity || def.secureFields; if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null; const out = {}; for (const [col, roles] of Object.entries(raw)) { if (!/^[a-z0-9_]{1,40}$/i.test(col)) continue; const arr = (Array.isArray(roles) ? roles : [roles]).map((x) => String(x).toLowerCase()).filter((x) => /^[a-z0-9_]{1,24}$/.test(x)).slice(0, 24); if (arr.length) out[col.toLowerCase()] = arr; } return Object.keys(out).length ? out : null; })(), teamRead: !!(def.teamRead || def.teamVisible || def.managerRead || def.hierarchyRead), currency: (() => { const c = def.currency || def.money || def.multiCurrency; if (!c || typeof c !== "object" || Array.isArray(c)) return null; const amount = String(c.amount || c.value || c.field || "").toLowerCase(); const code = String(c.code || c.currency || c.currencyField || c.codeField || "").toLowerCase(); if (!/^[a-z0-9_]{1,40}$/.test(amount) || !/^[a-z0-9_]{1,40}$/.test(code)) return null; const base = String(c.base || c.baseCurrency || "USD").toUpperCase().slice(0, 8); if (!/^[A-Z]{2,8}$/.test(base)) return null; const rates = {}; const raw = c.rates || c.rate; if (raw && typeof raw === "object" && !Array.isArray(raw)) { for (const [k, v] of Object.entries(raw)) { const cc = String(k).toUpperCase(); const n = Number(v); if (/^[A-Z]{2,8}$/.test(cc) && Number.isFinite(n) && n > 0) rates[cc] = n; } } rates[base] = 1; let as = String(c.as || c.into || (amount + "_base")).toLowerCase(); if (!/^[a-z0-9_]{1,40}$/.test(as)) as = amount + "_base"; return { amount, code, base, rates, as }; })(), approval: (() => { const a = def.approval || def.approvals || def.signoff; if (!a || typeof a !== "object" || Array.isArray(a)) return null; const src = Array.isArray(a.approvers) ? a.approvers : (Array.isArray(a.roles) ? a.roles : [a.approvers || a.roles]); const approvers = src.map((x) => String(x == null ? "" : x).toLowerCase()).filter((x) => /^[a-z0-9_]{1,24}$/.test(x)); const uniq = [...new Set(approvers)].slice(0, 12); if (!uniq.length) return null; let status = String(a.status || a.field || a.statusField || "approval_status").toLowerCase(); if (!/^[a-z0-9_]{1,40}$/.test(status)) status = "approval_status"; return { approvers: uniq, status }; })(), sequence: (() => { const s = def.sequence || def.autoNumber || def.recordNumber || def.numbering; if (!s || typeof s !== "object" || Array.isArray(s)) return null; const field = String(s.field || s.column || s.into || "number").toLowerCase(); if (!/^[a-z0-9_]{1,40}$/.test(field)) return null; let prefix = String(s.prefix == null ? "" : s.prefix).slice(0, 16); if (!/^[A-Za-z0-9_\-\/#.]*$/.test(prefix)) prefix = ""; let pad = parseInt(s.pad != null ? s.pad : s.padding, 10); pad = (Number.isFinite(pad) && pad > 0) ? Math.min(pad, 12) : 0; let start = parseInt(s.start != null ? s.start : s.from, 10); start = Number.isFinite(start) ? start : 1; return { field, prefix, pad, start }; })(), roundRobin: (() => { const r = def.roundRobin || def.autoAssign || def.leadRouting || def.assignRoundRobin; if (!r) return null; const src = r === true ? ["user"] : (Array.isArray(r) ? r : (Array.isArray(r.among) ? r.among : (Array.isArray(r.roles) ? r.roles : [r.among || r.roles || r.role]))); const among = src.map((x) => String(x == null ? "" : x).toLowerCase()).filter((x) => /^[a-z0-9_]{1,24}$/.test(x)); const uniq = [...new Set(among)].slice(0, 24); return uniq.length ? { among: uniq } : null; })(), assignBy: (() => { const a = def.assignBy || def.territory || def.assignmentRules || def.routeBy; if (!a || typeof a !== "object" || Array.isArray(a)) return null; const field = String(a.field || a.on || a.by || "").toLowerCase(); if (!/^[a-z0-9_]{1,40}$/.test(field)) return null; const rawMap = a.map || a.rules || a.routes; const map = {}; if (rawMap && typeof rawMap === "object" && !Array.isArray(rawMap)) { for (const [k, v] of Object.entries(rawMap)) { const key = String(k).toLowerCase().trim(); const val = String(v == null ? "" : v).trim(); if (key && val && (/^\d+$/.test(val) || val.includes("@")) && val.length <= 120) map[key] = val; } } if (!Object.keys(map).length) return null; const d0 = a.default != null ? String(a.default).trim() : ""; const dfl = (d0 && (/^\d+$/.test(d0) || d0.includes("@")) && d0.length <= 120) ? d0 : null; return { field, map, default: dfl }; })(), sla: (() => { const s = def.sla || def.deadline || def.responseTime; if (!s || typeof s !== "object" || Array.isArray(s)) return null; const mins = slaMinutes(s.mins != null ? s.mins : (s.within != null ? s.within : (s.minutes != null ? s.minutes : s.duration))); if (!mins) return null; let start = String(s.start || s.from || s.since || "created_at").toLowerCase(); if (!/^[a-z0-9_]{1,40}$/.test(start)) start = "created_at"; let doneField = null, doneValues = null; const d = s.done || s.until || s.stopWhen; if (d && typeof d === "object" && !Array.isArray(d)) { const df = String(d.field || d.column || "").toLowerCase(); const vals = (Array.isArray(d.values) ? d.values : (d.value != null ? [d.value] : [])).map((x) => String(x)).filter((x) => x.length <= 60).slice(0, 24); if (/^[a-z0-9_]{1,40}$/.test(df) && vals.length) { doneField = df; doneValues = vals; } } let escalate = null; const e = s.escalate || s.then || s.onBreach; if (e && typeof e === "object" && !Array.isArray(e)) { const to0 = e.to != null ? String(e.to).trim() : ""; const toV = (to0 && (/^\d+$/.test(to0) || to0.includes("@")) && to0.length <= 120) ? to0 : null; const ef = String(e.field || e.column || "").toLowerCase(); const efV = /^[a-z0-9_]{1,40}$/.test(ef) ? ef : null; const ev = e.value != null ? String(e.value).slice(0, 120) : null; const hasField = !!(efV && ev != null); if (toV || hasField) escalate = { to: toV, field: hasField ? efV : null, value: hasField ? ev : null }; } return { start, mins, doneField, doneValues, escalate }; })() });
  };
  const t = spec.tables || spec;
  if (Array.isArray(t)) t.forEach((tb) => tb && coerceTable(tb.name, tb));
  else if (t && typeof t === "object") Object.entries(t).forEach(([n, def]) => coerceTable(n, def));
  // Per-app rate-limit config — the owner tunes the data API's per-IP caps (requests
  // per minute) for reads and writes; `{read, write}` (aliases rateLimits/rate/
  // apiRateLimit, a bare number = both). Clamped to sane bounds; absent → platform
  // defaults (300 read / 60 write). Threaded through to the persisted schema so it's
  // loaded with the spec (no extra per-request read).
  const rlSrc = spec.rateLimits || spec.rate || spec.apiRateLimit || spec.rateLimit;
  let rateLimits = null;
  if (rlSrc != null) {
    const clamp = (v) => { const n = parseInt(v, 10); return (Number.isFinite(n) && n > 0) ? Math.min(n, 100000) : 0; };
    if (typeof rlSrc === "number" || typeof rlSrc === "string") { const b = clamp(rlSrc); if (b) rateLimits = { read: b, write: b }; }
    else if (typeof rlSrc === "object" && !Array.isArray(rlSrc)) {
      const read = clamp(rlSrc.read != null ? rlSrc.read : rlSrc.get);
      const write = clamp(rlSrc.write != null ? rlSrc.write : (rlSrc.post != null ? rlSrc.post : rlSrc.mutate));
      if (read || write) rateLimits = { read: read || 0, write: write || 0 };
    }
  }
  return rateLimits ? { tables: out, rateLimits } : { tables: out };
}
async function applySiteSchema(env, uuid, spec) {
  spec = normalizeSchema(spec);
  const tables = (spec && Array.isArray(spec.tables)) ? spec.tables.slice(0, 24) : [];
  const made = [], norm = [];
  for (const t of tables) {
    if (!t || !t.name) continue;
    const tn = sqlIdent(t.name);
    // access = who can read/write via the public data API:
    //   collect  — anyone can INSERT; nobody reads publicly (owner reads in-app)
    //   display  — anyone can READ; no public writes (owner-managed content)
    //   user     — requires the site's own login; each visitor sees only THEIR rows
    //   feed     — anyone READS; a logged-in visitor posts + edits only their OWN rows
    //   admin    — anyone READS; only an 'admin' site-user WRITES (shared, in-app CMS)
    const access = ["collect", "display", "user", "feed", "admin"].includes(t.access) ? t.access : "collect";
    const cols = []; let hasPk = false;
    const colNames = []; const numCols = []; const jsonCols = []; const seen = new Set(); const refs = {}; const refModes = {}; const rules = {};
    const appAdds = []; // [name-type] for each declared app column, ALTER-added on re-apply so a REVISE that adds a field actually gets the column (CREATE IF NOT EXISTS won't)
    // Auto-slug config: table-level `"slug":"title"` or `{"from":"title"}` → the platform
    // adds+fills a unique url-safe `slug` column derived from that source column on insert.
    let slugFrom = null;
    if (typeof t.slug === "string" && SAFE_IDENT.test(t.slug)) slugFrom = t.slug.toLowerCase();
    else if (t.slug && typeof t.slug === "object" && typeof t.slug.from === "string" && SAFE_IDENT.test(t.slug.from)) slugFrom = t.slug.from.toLowerCase();
    // RBAC: an `admin`-access table may name extra custom roles allowed to WRITE (the
    // built-in `admin` role always can). Role names are short safe identifiers.
    const writeRoles = (access === "admin" && Array.isArray(t.writeRoles)) ? t.writeRoles.map((r) => String(r).toLowerCase()).filter((r) => /^[a-z0-9_]{1,24}$/.test(r)).slice(0, 16) : null;
    // id / created_at / owner_id are ALWAYS platform-managed — we add them below.
    // Skip any the model declared itself (the rules say not to, but models don't
    // always comply) and skip duplicate column names, else CREATE TABLE would have
    // two columns of the same name → D1 error 7500 and the whole backend fails.
    const MANAGED = new Set(["id", "created_at", "owner_id"]);
    for (const c of (Array.isArray(t.columns) ? t.columns.slice(0, 48) : [])) {
      if (!c || !c.name) continue;
      const low = String(c.name).toLowerCase();
      if (MANAGED.has(low) || seen.has(low)) continue;
      seen.add(low);
      const cn = sqlIdent(c.name);
      const ctype = String(c.type || "text").toLowerCase();
      const ty = D1_TYPES[ctype] || "TEXT";
      const isNum = ["integer", "int", "real", "float", "number", "numeric"].includes(ctype);
      const isJson = ["json", "array", "object"].includes(ctype);
      let def = cn + " " + ty;
      if (c.pk) { def += " PRIMARY KEY"; if (ty === "INTEGER") def += " AUTOINCREMENT"; hasPk = true; }
      if (c.notnull || c.required) def += " NOT NULL";
      if (c.unique) def += " UNIQUE";
      // Column DEFAULT — a server-side default applied when the writer omits the field.
      // Safely literalized: numbers as-is, booleans as 0/1, strings single-quote-escaped.
      if (c.default !== undefined && c.default !== null && !c.pk) {
        let dl = null;
        // Computed default tokens (dynamic per-insert): `@now`/`now`/`timestamp` →
        // current datetime, `@today`/`today` → current date, `@uuid`/`uuid` → a random
        // uuid-shaped id. Emitted as a SQL DEFAULT expression so the DB fills it when the
        // writer omits the field (no insert-path plumbing). A bare literal string default
        // still works for anything that isn't one of these reserved words.
        const COMPUTED = { now: "(datetime('now'))", timestamp: "(datetime('now'))", today: "(date('now'))", uuid: "(lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))))" };
        const tok = typeof c.default === "string" ? c.default.trim().toLowerCase().replace(/^@/, "") : null;
        if (tok && COMPUTED[tok]) dl = COMPUTED[tok];
        else if (typeof c.default === "number" && Number.isFinite(c.default)) dl = String(c.default);
        else if (typeof c.default === "boolean") dl = c.default ? "1" : "0";
        else if (typeof c.default === "string" && c.default.length <= 200) dl = "'" + c.default.replace(/'/g, "''") + "'";
        if (dl != null) def += " DEFAULT " + dl;
      }
      cols.push(def); colNames.push(c.name); if (isNum) numCols.push(String(c.name).toLowerCase()); if (isJson) jsonCols.push(String(c.name).toLowerCase());
      appAdds.push(cn + " " + ty); // bare type only — ALTER ADD COLUMN can't carry NOT NULL/UNIQUE/PK on a populated table; required-ness is enforced at the API layer anyway
      // A declared foreign key (`ref`/`references`) is stored as metadata only — the
      // column stays a plain integer id; the `expand` reader uses refs to join. Not a
      // SQL FK (D1 has FKs off by default), so app-side integrity, platform-side join.
      if (c.ref && SAFE_IDENT.test(String(c.ref))) { refs[low] = String(c.ref); if (c.onDelete) refModes[low] = c.onDelete; } // onDelete: setnull|cascade(default)|restrict
      // validation rules (enforced on writes): required, length/value bounds, format,
      // allowed-set (enum) and regex pattern.
      const rule = {};
      if (c.notnull || c.required) rule.required = true;
      if (isNum) { const nmn = Number(c.min); if (Number.isFinite(nmn)) rule.numMin = nmn; const nmx = Number(c.max); if (Number.isFinite(nmx)) rule.numMax = nmx; }
      else { const mx = parseInt(c.max, 10); if (mx > 0) rule.max = Math.min(mx, 100000); const mn = parseInt(c.min, 10); if (mn > 0) rule.minLen = Math.min(mn, 100000); }
      const fmt = String(c.format || "").toLowerCase(); if (["email", "url", "number"].includes(fmt)) rule.format = fmt;
      if (Array.isArray(c.enum) && c.enum.length) rule.enum = c.enum.map((x) => String(x)).slice(0, 100);
      if (typeof c.pattern === "string" && c.pattern.length && c.pattern.length <= 300) rule.pattern = c.pattern;
      if (c.immutable) rule.immutable = true; // write-once: set on insert, rejected on any later edit
      if (Object.keys(rule).length) rules[low] = rule;
    }
    if (!hasPk) cols.unshift('"id" INTEGER PRIMARY KEY AUTOINCREMENT');
    // Auto-slug column (unless the app already declared its own `slug`): a UNIQUE url-safe key.
    if (slugFrom && !seen.has("slug")) { cols.push('"slug" TEXT'); colNames.push("slug"); seen.add("slug"); }
    if (access === "user" || access === "feed") { cols.push('"owner_id" INTEGER'); } // stamps the author / scopes rows
    if (t.trash) cols.push('"deleted_at" TEXT'); // soft-delete: NULL = live, timestamp = trashed
    if (t.version) cols.push('"_version" INTEGER NOT NULL DEFAULT 1'); // optimistic-concurrency row version
    if (t.timestamps || t.sync) cols.push('"updated_at" TEXT DEFAULT (datetime(\'now\'))'); // auto edit-tracking (also required by sync): set on insert, bumped on every UPDATE
    if (t.ordered) cols.push('"position" REAL'); // manual sort order — auto-assigned to end on insert (trigger below), midpoint-reordered via /move
    if (t.expires) cols.push('"expires_at" TEXT'); // TTL — app sets it; reads hide rows past it
    if (t.pinnable) cols.push('"pinned" INTEGER DEFAULT 0'); // featured/sticky — app sets 0/1; pinned rows list first
    if (t.scheduled) cols.push('"publish_at" TEXT'); // scheduled publish — hidden until this time (app-set)
    if (t.approval) cols.push(sqlIdent(t.approval.status) + " TEXT"); // approval state — endpoint-set only (NOT app-writable), queryable
    if (t.sequence) cols.push(sqlIdent(t.sequence.field) + " TEXT"); // auto-number — stamped on insert (NOT app-writable), queryable/sortable
    if (t.archivable) cols.push('"archived_at" TEXT'); // soft archive — reads hide archived rows by default
    cols.push('"created_at" TEXT DEFAULT (datetime(\'now\'))');
    await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS " + tn + " (" + cols.join(", ") + ")");
    // Schema evolution for APP columns: CREATE IF NOT EXISTS is a no-op on an existing table,
    // so a REVISE that adds a new field (e.g. "add a due_date to tasks") would never get the
    // column and every write to it fails ("data error"). ADD COLUMN is idempotent here (the
    // "duplicate column" error on a fresh table is swallowed), so this backfills any newly
    // declared column onto a pre-existing table without disturbing existing data.
    for (const add of appAdds) { try { await cfD1Query(env, uuid, "ALTER TABLE " + tn + " ADD COLUMN " + add); } catch {} }
    // Schema evolution: CREATE IF NOT EXISTS is a no-op for a table that already exists,
    // so a revise that CHANGES a table's access mode (display→user/feed) or turns on
    // trash would otherwise leave the newly-required platform columns missing — and its
    // scoped writes / soft-deletes would silently fail. ADD COLUMN is idempotent here
    // (a "duplicate column" error on a fresh table is swallowed), so re-declaring safely
    // backfills owner_id / deleted_at onto a pre-existing table.
    if (access === "user" || access === "feed") { try { await cfD1Query(env, uuid, "ALTER TABLE " + tn + ' ADD COLUMN "owner_id" INTEGER'); } catch {} }
    if (t.trash) { try { await cfD1Query(env, uuid, "ALTER TABLE " + tn + ' ADD COLUMN "deleted_at" TEXT'); } catch {} }
    if (t.version) { try { await cfD1Query(env, uuid, "ALTER TABLE " + tn + ' ADD COLUMN "_version" INTEGER NOT NULL DEFAULT 1'); } catch {} }
    // Auto updated_at backfill on a pre-existing table (ALTER ADD COLUMN can't carry a
    // datetime() default, so seed existing rows to created_at; new inserts on a table
    // revised THIS way get updated_at on their first edit — fresh tables get the CREATE
    // default above, so the common path is fully automatic).
    if (t.timestamps || t.sync) { try { await cfD1Query(env, uuid, "ALTER TABLE " + tn + ' ADD COLUMN "updated_at" TEXT'); } catch {} try { await cfD1Query(env, uuid, "UPDATE " + tn + ' SET "updated_at"=created_at WHERE "updated_at" IS NULL'); } catch {} }
    // Re-apply hygiene: DROP the flag-driven triggers first, so turning a flag OFF on a
    // revise (e.g. removing `audit`) actually REMOVES its trigger instead of leaving a stale
    // one behind. A left-behind AFTER trigger keeps firing into its side table (_audit /
    // _history) and rolls back every subsequent write ("data error") — a real bug when a
    // schema is re-applied without a flag it previously had. Each conditional block below
    // recreates its trigger only when the flag is still set. (Names are fixed per table; the
    // per-column enforceRefs triggers are left alone — columns are never dropped.)
    for (const suf of ["_del", "_pos", "_max", "_aud_i", "_aud_u", "_aud_d", "_hist"]) {
      try { await cfD1Query(env, uuid, "DROP TRIGGER IF EXISTS " + sqlIdent("trg_" + t.name + suf)); } catch {}
    }
    // Sync (offline-first) — record deletes as tombstones so a client can pull edits AND
    // deletes since a timestamp via /changes?sync=. `updated_at` (above) covers inserts+edits.
    if (t.sync) {
      try { await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _deletes (row_table TEXT, row_id INTEGER, at TEXT)"); } catch {}
      try { await cfD1Query(env, uuid, "CREATE TRIGGER IF NOT EXISTS " + sqlIdent("trg_" + t.name + "_del") + " AFTER DELETE ON " + tn + " BEGIN INSERT INTO _deletes (row_table,row_id,at) VALUES ('" + t.name.replace(/'/g, "''") + "', OLD.id, datetime('now')); END"); } catch (e) { console.error("delete tombstone trigger failed:", t.name, e && e.detail); }
    }
    // Manual ordering: a `position` column auto-assigned to the END of its scope on insert
    // (per-owner on user/feed, global otherwise) by an AFTER INSERT trigger, so the app
    // never manages positions itself; rows are reordered by the /move endpoint (midpoints,
    // REAL, so no renumber). Backfill existing rows to a stable initial order (by id).
    if (t.ordered) {
      try { await cfD1Query(env, uuid, "ALTER TABLE " + tn + ' ADD COLUMN "position" REAL'); } catch {}
      try { await cfD1Query(env, uuid, "UPDATE " + tn + ' SET "position"=id WHERE "position" IS NULL'); } catch {}
      const scoped = (access === "user" || access === "feed");
      const trg = sqlIdent("trg_" + t.name + "_pos");
      const maxScope = scoped ? ' WHERE "owner_id" IS NEW."owner_id"' : "";
      try {
        await cfD1Query(env, uuid,
          "CREATE TRIGGER IF NOT EXISTS " + trg + " AFTER INSERT ON " + tn + ' WHEN NEW."position" IS NULL BEGIN' +
          ' UPDATE ' + tn + ' SET "position"=(SELECT COALESCE(MAX("position"),0)+1 FROM ' + tn + maxScope + ") WHERE id=NEW.id;" +
          " END");
      } catch (e) { console.error("position trigger failed:", t.name, e && e.detail); }
    }
    if (t.expires) { try { await cfD1Query(env, uuid, "ALTER TABLE " + tn + ' ADD COLUMN "expires_at" TEXT'); } catch {} }
    if (t.pinnable) { try { await cfD1Query(env, uuid, "ALTER TABLE " + tn + ' ADD COLUMN "pinned" INTEGER DEFAULT 0'); } catch {} }
    if (t.scheduled) { try { await cfD1Query(env, uuid, "ALTER TABLE " + tn + ' ADD COLUMN "publish_at" TEXT'); } catch {} }
    if (t.approval) { try { await cfD1Query(env, uuid, "ALTER TABLE " + tn + " ADD COLUMN " + sqlIdent(t.approval.status) + " TEXT"); } catch {} }
    if (t.sequence) { try { await cfD1Query(env, uuid, "ALTER TABLE " + tn + " ADD COLUMN " + sqlIdent(t.sequence.field) + " TEXT"); } catch {} }
    if (t.archivable) { try { await cfD1Query(env, uuid, "ALTER TABLE " + tn + ' ADD COLUMN "archived_at" TEXT'); } catch {} }
    // Auto-slug: backfill the column on a pre-existing table + a UNIQUE index to police
    // collisions (SQLite lets a UNIQUE index hold many NULLs, so slug-less rows are fine).
    if (slugFrom) {
      try { await cfD1Query(env, uuid, "ALTER TABLE " + tn + ' ADD COLUMN "slug" TEXT'); } catch {}
      try { await cfD1Query(env, uuid, "CREATE UNIQUE INDEX IF NOT EXISTS " + sqlIdent("ux_" + t.name + "_slug") + " ON " + tn + ' ("slug")'); } catch (e) { console.error("slug index failed:", t.name, e && e.detail); }
    }
    // Composite UNIQUE constraints (declared at the TABLE level, race-free — enforced
    // by a real UNIQUE INDEX in D1; a violation surfaces to the data API as a 409).
    //   unique: [...]      → a group of columns that must be globally unique
    //   oncePerUser: [...] → unique PER author on user/feed tables (owner_id + cols):
    //                        "one review per member per product", "one RSVP per event".
    // Accepts a single group ["a","b"] or many [["a"],["b","c"]].
    {
      const hasOwner = (access === "user" || access === "feed");
      const colSet = new Set(colNames.map((n) => String(n).toLowerCase()));
      const mkIndexes = async (groups, perUser) => {
        const raw = Array.isArray(groups) ? groups : (groups ? [groups] : []);
        const many = raw.length && Array.isArray(raw[0]) ? raw : (raw.length ? [raw] : []);
        let gi = 0;
        for (const g of many) {
          const gcols = (Array.isArray(g) ? g : [g]).map((c) => String(c).toLowerCase()).filter((c) => colSet.has(c));
          if (!gcols.length) continue;
          const idxCols = (perUser && hasOwner ? ["owner_id"] : []).concat(gcols);
          const idxName = sqlIdent("ux_" + t.name + "_" + (perUser ? "u" : "g") + "_" + (gi++));
          try { await cfD1Query(env, uuid, "CREATE UNIQUE INDEX IF NOT EXISTS " + idxName + " ON " + tn + " (" + idxCols.map(sqlIdent).join(",") + ")"); } catch (e) { console.error("unique index failed:", t.name, e && e.detail); }
        }
      };
      await mkIndexes(t.unique, false);
      await mkIndexes(t.oncePerUser, true);
      // Case-insensitive UNIQUE — `uniqueCI:["email"]` → a UNIQUE INDEX over lower(col), so
      // "A@x.com" and "a@x.com" collide (usernames, emails, slugs). Race-free like `unique`;
      // a violation surfaces as the same 409 duplicate. One column per group.
      { let ci = 0;
        for (const raw of (Array.isArray(t.uniqueCI) ? t.uniqueCI : (t.uniqueCI ? [t.uniqueCI] : []))) {
          const col = String(Array.isArray(raw) ? raw[0] : raw).toLowerCase();
          if (!colSet.has(col)) continue;
          try { await cfD1Query(env, uuid, "CREATE UNIQUE INDEX IF NOT EXISTS " + sqlIdent("ux_" + t.name + "_ci_" + (ci++)) + " ON " + tn + " (lower(" + sqlIdent(col) + "))"); } catch (e) { console.error("uniqueCI index failed:", t.name, e && e.detail); }
        }
      }
    }
    // Max-rows quota — `maxRows:N` caps how many rows the table may hold (scoped per-owner
    // on user/feed, global otherwise), enforced by a BEFORE INSERT trigger that ABORTs once
    // the cap is reached. Zero insert-path plumbing; the abort surfaces to the data API as a
    // clean 409 "limit reached". Free-tier caps, "max 100 todos per user", etc.
    if (t.maxRows > 0) {
      const scoped = (access === "user" || access === "feed");
      const cntScope = scoped ? ' WHERE "owner_id" IS NEW."owner_id"' : "";
      try {
        await cfD1Query(env, uuid,
          "CREATE TRIGGER IF NOT EXISTS " + sqlIdent("trg_" + t.name + "_max") + " BEFORE INSERT ON " + tn +
          " WHEN (SELECT COUNT(*) FROM " + tn + cntScope + ") >= " + Math.floor(t.maxRows) +
          " BEGIN SELECT RAISE(ABORT, 'row limit reached'); END");
      } catch (e) { console.error("maxRows trigger failed:", t.name, e && e.detail); }
    }
    // Referential integrity — `enforceRefs:true` refuses a write whose foreign-key column
    // points at a NON-existent parent (no orphan comments / line-items). A BEFORE INSERT and
    // BEFORE UPDATE trigger per ref column RAISEs when the fk is set but the parent id is
    // missing; the abort maps to a clean 400 in the data API. Complements the delete-time
    // cascade (which stops orphans when a parent is removed). NULL fk = allowed (optional link).
    if (t.enforceRefs) {
      for (const col of Object.keys(refs)) {
        const parent = refs[col];
        if (!SAFE_IDENT.test(String(parent)) || !SAFE_IDENT.test(String(col))) continue;
        const cn = sqlIdent(col), pn = sqlIdent(parent);
        const cond = "NEW." + cn + " IS NOT NULL AND NOT EXISTS (SELECT 1 FROM " + pn + " WHERE id=NEW." + cn + ")";
        try { await cfD1Query(env, uuid, "CREATE TRIGGER IF NOT EXISTS " + sqlIdent("trg_" + t.name + "_ref_" + col + "_i") + " BEFORE INSERT ON " + tn + " WHEN " + cond + " BEGIN SELECT RAISE(ABORT, 'missing parent'); END"); } catch (e) { console.error("ref trigger (i) failed:", t.name, col, e && e.detail); }
        try { await cfD1Query(env, uuid, "CREATE TRIGGER IF NOT EXISTS " + sqlIdent("trg_" + t.name + "_ref_" + col + "_u") + " BEFORE UPDATE OF " + cn + " ON " + tn + " WHEN " + cond + " BEGIN SELECT RAISE(ABORT, 'missing parent'); END"); } catch (e) { console.error("ref trigger (u) failed:", t.name, col, e && e.detail); }
      }
    }
    // Audit log — `audit:true` records every write to the table (insert/update/delete) in a
    // shared `_audit` trail via AFTER triggers (no write-path plumbing). Captures table, row
    // id, action, time, and the actor (owner_id on user/feed tables, else NULL). The app's
    // admin reads it at GET /api/db/<slug>/audit. Compliance, "who changed this", activity.
    if (t.audit) {
      try { await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _audit (id INTEGER PRIMARY KEY AUTOINCREMENT, row_table TEXT, row_id INTEGER, action TEXT, actor_id INTEGER, at TEXT)"); } catch {}
      const hasOwner = (access === "user" || access === "feed");
      const actNew = hasOwner ? 'NEW."owner_id"' : "NULL";
      const actOld = hasOwner ? 'OLD."owner_id"' : "NULL";
      const mk = (suffix, when, idRef, actor, action) => "CREATE TRIGGER IF NOT EXISTS " + sqlIdent("trg_" + t.name + "_aud_" + suffix) + " AFTER " + when + " ON " + tn + " BEGIN INSERT INTO _audit (row_table,row_id,action,actor_id,at) VALUES ('" + t.name.replace(/'/g, "''") + "', " + idRef + ", '" + action + "', " + actor + ", datetime('now')); END";
      try { await cfD1Query(env, uuid, mk("i", "INSERT", "NEW.id", actNew, "insert")); } catch (e) { console.error("audit trigger i failed:", t.name, e && e.detail); }
      try { await cfD1Query(env, uuid, mk("u", "UPDATE", "NEW.id", actNew, "update")); } catch (e) { console.error("audit trigger u failed:", t.name, e && e.detail); }
      try { await cfD1Query(env, uuid, mk("d", "DELETE", "OLD.id", actOld, "delete")); } catch (e) { console.error("audit trigger d failed:", t.name, e && e.detail); }
    }
    // Row history / revert — `history:true` snapshots a row's OLD data columns (as JSON, via
    // json_object) into `_history` on every UPDATE (BEFORE UPDATE trigger). The owner/admin
    // can view the timeline and restore any prior version. Undo, revision history, audit-of-content.
    if (t.history && colNames.length) {
      try { await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _history (id INTEGER PRIMARY KEY AUTOINCREMENT, row_table TEXT, row_id INTEGER, snapshot TEXT, at TEXT)"); } catch {}
      const jsonPairs = colNames.map((cn) => "'" + String(cn).replace(/'/g, "''") + "', OLD." + sqlIdent(cn)).join(", ");
      try {
        await cfD1Query(env, uuid,
          "CREATE TRIGGER IF NOT EXISTS " + sqlIdent("trg_" + t.name + "_hist") + " BEFORE UPDATE ON " + tn +
          " BEGIN INSERT INTO _history (row_table,row_id,snapshot,at) VALUES ('" + t.name.replace(/'/g, "''") + "', OLD.id, json_object(" + jsonPairs + "), datetime('now')); END");
      } catch (e) { console.error("history trigger failed:", t.name, e && e.detail); }
    }
    made.push(t.name);
    norm.push({ name: t.name, access, columns: colNames, refs, refModes: Object.keys(refModes).length ? refModes : null, rules, num: numCols, json: jsonCols, trash: !!t.trash, slug: slugFrom ? { from: slugFrom } : null, writeRoles: (writeRoles && writeRoles.length) ? writeRoles : null, version: !!t.version, timestamps: !!t.timestamps, ordered: !!t.ordered, expires: !!t.expires, pinnable: !!t.pinnable, defaultSort: t.defaultSort || null, scheduled: !!t.scheduled, checks: t.checks || null, computed: t.computed || null, requireVerified: !!t.requireVerified, audit: !!t.audit, history: !!t.history, archivable: !!t.archivable, sync: !!t.sync, searchWeights: t.searchWeights || null, rateLimit: t.rateLimit || 0, geo: t.geo || null, transitions: t.transitions || null, formulas: t.formulas || null, fieldRoles: t.fieldRoles || null, teamRead: !!t.teamRead, currency: t.currency || null, approval: t.approval || null, sequence: t.sequence || null, roundRobin: t.roundRobin || null, assignBy: t.assignBy || null, sla: t.sla || null });
  }
  // Persist the normalized access rules + column allow-list in the site's own DB so
  // the data API can enforce them per request. MERGE into whatever's already
  // persisted (don't replace): a revise may re-emit a schema with only the new/
  // changed table, and replacing would strip the pre-existing tables from the
  // API's allow-list — their data still exists (CREATE IF NOT EXISTS above never
  // drops it) but the data API would 404 them. Re-declared tables win; untouched
  // ones are preserved. (A revise cannot silently drop a table this way.)
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _meta (k TEXT PRIMARY KEY, v TEXT)");
  let mergedTables = norm;
  let rateLimits = spec.rateLimits || null; // this run's per-app rate config (if any)
  try {
    const prev = await loadSiteSchema(env, uuid);
    if (prev && Array.isArray(prev.tables) && prev.tables.length) {
      const byName = new Map();
      for (const t of prev.tables) if (t && t.name) byName.set(String(t.name).toLowerCase(), t);
      for (const t of norm) byName.set(String(t.name).toLowerCase(), t); // this run overrides
      mergedTables = Array.from(byName.values());
    }
    if (!rateLimits && prev && prev.rateLimits) rateLimits = prev.rateLimits; // preserve prior tuning when unspecified
  } catch {}
  const metaOut = { tables: mergedTables }; if (rateLimits) metaOut.rateLimits = rateLimits;
  await cfD1Query(env, uuid, "INSERT INTO _meta (k,v) VALUES ('schema', ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", [JSON.stringify(metaOut)]);
  return made;
}
// Load the persisted access rules for a site's tables (from its own _meta.schema).
async function loadSiteSchema(env, uuid) {
  try { const rows = await cfD1Query(env, uuid, "SELECT v FROM _meta WHERE k='schema'"); if (rows[0] && rows[0].v) return JSON.parse(rows[0].v); } catch {}
  return { tables: [] };
}
function tableDef(spec, name) { return (spec && Array.isArray(spec.tables)) ? spec.tables.find((t) => t && String(t.name).toLowerCase() === String(name).toLowerCase()) : null; }
// Does this isibi user own the React site <slug>? Proven from the generated source's
// stored uid (sitesrc/<slug>.json), falling back to the D1 backend ledger.
async function ownsReactSite(env, slug, uid) {
  try { const o = await env.SITES_BUCKET.get("sitesrc/" + slug + ".json"); if (o) { const j = JSON.parse(await o.text()); if (j && j.uid) return j.uid === uid; } } catch {}
  try { return !!(await siteBackendForOwner(env, slug, uid)); } catch { return false; }
}
// Read-only lookup of a site's D1 for its OWNER (isibi user) — never creates.
async function siteBackendForOwner(env, slug, uid) {
  const g = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(slug)}&select=d1_uuid,uid`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
  });
  const rows = await g.json().catch(() => []);
  if (!rows[0]) return null;
  if (rows[0].uid && rows[0].uid !== uid) throw Object.assign(new Error("not owner"), { forbidden: true });
  return rows[0].d1_uuid;
}
// Pull an `isibi.schema.json` declaration out of the generated project (and remove
// it so it never ships as a static asset). Returns the parsed spec or null.
function parseSchemaSpec(files) {
  const key = Object.keys(files).find((k) => /(^|\/)isibi\.schema\.json$/i.test(k));
  if (!key) return null;
  let spec = null; try { spec = JSON.parse(files[key]); } catch {}
  delete files[key];
  return spec;
}
// Pull declared edge functions out of a React build's `isibi.functions.json`
// (body `{"functions":[{"name":"x","steps":[…],"schedule":?,"verify":?}]}` or a
// bare array). Strips the file (never ships as a static asset). Returns validated
// [{name, spec}] ready for persistSiteFunctions.
function parseFunctionSpecs(files) {
  const key = Object.keys(files).find((k) => /(^|\/)isibi\.functions\.json$/i.test(k));
  if (!key) return [];
  let j = null; try { j = JSON.parse(files[key]); } catch {}
  delete files[key];
  const list = Array.isArray(j) ? j : (j && Array.isArray(j.functions) ? j.functions : []);
  const out = [];
  for (const f of list.slice(0, 20)) {
    if (!f || typeof f !== "object") continue;
    const name = String(f.name || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
    const specRaw = (f.spec && typeof f.spec === "object") ? f.spec : { steps: f.steps, schedule: f.schedule, verify: f.verify };
    const spec = normalizeFnSpec(specRaw);
    if (name && spec) out.push({ name, spec });
  }
  return out;
}
// Lightweight per-isolate burst limiter for the built-apps public API — a fixed 60s
// window keyed by site + visitor IP + kind. Not globally consistent (each Worker
// isolate keeps its own counter), but it caps abuse cheaply with ZERO extra infra; a
// strict global limit would need KV/Durable Objects (noted as the scale upgrade).
// Returns false when the caller is over the limit for this window.
const _rlHits = new Map();
function rateOk(key, limit) {
  const win = Math.floor(Date.now() / 60000);
  const k = key + "|" + win;
  if (_rlHits.size > 8000) { for (const kk of _rlHits.keys()) { if (!kk.endsWith("|" + win)) _rlHits.delete(kk); } } // drop stale windows
  const n = (_rlHits.get(k) || 0) + 1;
  _rlHits.set(k, n);
  return n <= limit;
}
function tooMany(msg) { return Response.json({ ok: false, error: msg || "Too many requests — please slow down." }, { status: 429, headers: { "Retry-After": "30" } }); }
// Per-app observability — count data-API requests + errors per site, buffered in the
// isolate and batch-flushed (every ~10 hits) into the site's own D1 `_metrics` table
// as daily totals, so the owner gets a durable usage view without a write-per-request.
// Approximate by design (a few counts can be lost on isolate recycle); accurate enough
// for "how much traffic / how many errors is my app seeing."
const _metBuf = new Map();
function recordSiteHit(env, ctx, slug, status) {
  let b = _metBuf.get(slug);
  if (!b) { b = { reqs: 0, errs: 0 }; _metBuf.set(slug, b); }
  b.reqs++; if (status >= 400) b.errs++;
  if (b.reqs >= 10) { const agg = { reqs: b.reqs, errs: b.errs }; _metBuf.set(slug, { reqs: 0, errs: 0 }); if (ctx && ctx.waitUntil) ctx.waitUntil(flushSiteMetrics(env, slug, agg)); }
}
async function flushSiteMetrics(env, slug, agg) {
  try {
    const uuid = await siteBackendBySlug(env, slug); if (!uuid) return;
    const day = new Date().toISOString().slice(0, 10);
    await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _metrics (day TEXT PRIMARY KEY, reqs INTEGER DEFAULT 0, errs INTEGER DEFAULT 0)");
    await cfD1Query(env, uuid, "INSERT INTO _metrics (day,reqs,errs) VALUES (?,?,?) ON CONFLICT(day) DO UPDATE SET reqs=reqs+excluded.reqs, errs=errs+excluded.errs", [day, agg.reqs, agg.errs]);
  } catch {}
}
// Visitor analytics — a built app POSTs page views + custom events. Each event is
// written straight through as a tiny (day,event,path) counter upsert-increment in the
// site's own D1 `_analytics` (never raw per-event storage), via ctx.waitUntil so the
// visitor never waits. Written per-event (not buffered) so the counts are EXACT even at
// low traffic — unlike ops `_metrics`, product view-counts need to be trustworthy. The
// `_analytics` table is ensured once per isolate.
const _anaReady = new Set();
function recordVisit(env, ctx, slug, event, path) {
  const day = new Date().toISOString().slice(0, 10);
  const run = async () => {
    try {
      const uuid = await siteBackendBySlug(env, slug); if (!uuid) return;
      if (!_anaReady.has(uuid)) { await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _analytics (day TEXT, event TEXT, path TEXT, n INTEGER DEFAULT 0, PRIMARY KEY(day,event,path))"); _anaReady.add(uuid); }
      await cfD1Query(env, uuid, "INSERT INTO _analytics (day,event,path,n) VALUES (?,?,?,1) ON CONFLICT(day,event,path) DO UPDATE SET n=n+1", [day, event || "view", path || ""]);
    } catch {}
  };
  if (ctx && ctx.waitUntil) ctx.waitUntil(run()); else run();
}
// Named counters — atomic, race-free tallies (likes, views, reactions, poll
// options) that the read-modify-write of a normal row column can't do safely.
// Stored in the site's own D1 `_counters`, ensured once per isolate. Unlike a row
// write these are intentionally PUBLIC (an anonymous visitor can like/view), so
// they live outside the access-mode model and are only rate-limited.
const _countersReady = new Set();
async function ensureCounters(env, uuid) {
  if (_countersReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _counters (name TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, updated_at TEXT)");
  _countersReady.add(uuid);
}
// Atomic increment (or decrement) with a floor of 0, returning the NEW value.
async function bumpCounter(env, uuid, name, by) {
  await ensureCounters(env, uuid);
  const now = new Date().toISOString();
  const rows = await cfD1Query(
    env, uuid,
    "INSERT INTO _counters (name,n,updated_at) VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET n=MAX(0, n + ?), updated_at=? RETURNING n",
    [name, Math.max(0, by), now, by, now],
  );
  return rows && rows[0] ? rows[0].n : null;
}
async function readCounter(env, uuid, name) {
  await ensureCounters(env, uuid);
  const rows = await cfD1Query(env, uuid, "SELECT n FROM _counters WHERE name=?", [name]);
  return rows && rows[0] ? rows[0].n : 0;
}
async function readAllCounters(env, uuid) {
  await ensureCounters(env, uuid);
  return await cfD1Query(env, uuid, "SELECT name,n FROM _counters ORDER BY n DESC LIMIT 500");
}
// Reactions — a first-class "one per user" primitive (likes, upvotes, RSVPs, emoji
// reactions). Unlike a raw counter it's DEDUPED per (target,type,user) and knows
// whether the CALLER reacted — the two things a like button needs. Stored in the
// site's own D1 `_reactions`, ensured once per isolate. Reads are public (counts);
// writes require login (so "one per user" is enforceable).
const _reactionsReady = new Set();
async function ensureReactions(env, uuid) {
  if (_reactionsReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _reactions (target TEXT NOT NULL, type TEXT NOT NULL, user_id INTEGER NOT NULL, created_at TEXT, PRIMARY KEY (target, type, user_id))");
  _reactionsReady.add(uuid);
}
// Toggle a reaction on/off for one user, returning {reacted, count}. `set` forces a
// direction ("on"/"off"); otherwise it flips. Idempotent (the PK dedupes).
async function toggleReaction(env, uuid, target, type, userId, set) {
  await ensureReactions(env, uuid);
  const existing = await cfD1Query(env, uuid, "SELECT 1 FROM _reactions WHERE target=? AND type=? AND user_id=?", [target, type, userId]);
  const has = !!existing[0];
  const want = set === "on" ? true : set === "off" ? false : !has; // default: flip
  if (want && !has) await cfD1Query(env, uuid, "INSERT OR IGNORE INTO _reactions (target,type,user_id,created_at) VALUES (?,?,?,?)", [target, type, userId, new Date().toISOString()]);
  else if (!want && has) await cfD1Query(env, uuid, "DELETE FROM _reactions WHERE target=? AND type=? AND user_id=?", [target, type, userId]);
  const cnt = await cfD1Query(env, uuid, "SELECT COUNT(*) AS n FROM _reactions WHERE target=? AND type=?", [target, type]);
  return { reacted: want, count: (cnt[0] && cnt[0].n) || 0 };
}
// State for one target: {counts:{type:n}, mine:[types the caller reacted with]}.
async function reactionState(env, uuid, target, userId) {
  await ensureReactions(env, uuid);
  const rows = await cfD1Query(env, uuid, "SELECT type, COUNT(*) AS n FROM _reactions WHERE target=? GROUP BY type", [target]);
  const counts = {}; for (const r of rows) counts[r.type] = r.n;
  let mine = [];
  if (userId) { const m = await cfD1Query(env, uuid, "SELECT type FROM _reactions WHERE target=? AND user_id=?", [target, userId]); mine = m.map((x) => x.type); }
  return { counts, mine };
}
// `?reactions=1` — attach each row's reaction state under `row.reactions`
// ({counts,mine}) for target `<table>:<id>`, so a feed renders like buttons with
// counts AND the caller's own state in ONE read. Batched: two grouped queries over
// all row targets (no per-row N+1). userId (or null) drives the `mine` sets.
async function attachReactions(env, uuid, table, rows, url, userId) {
  if (url.searchParams.get("reactions") !== "1" || !rows.length) return rows;
  await ensureReactions(env, uuid);
  const targets = rows.map((r) => table + ":" + r.id);
  const ph = targets.map(() => "?").join(",");
  let counts = [], mine = [];
  try { counts = await cfD1Query(env, uuid, "SELECT target, type, COUNT(*) AS n FROM _reactions WHERE target IN (" + ph + ") GROUP BY target, type", targets); } catch { return rows; }
  if (userId) { try { mine = await cfD1Query(env, uuid, "SELECT target, type FROM _reactions WHERE user_id=? AND target IN (" + ph + ")", [userId, ...targets]); } catch {} }
  const cMap = new Map(), mMap = new Map();
  for (const c of counts) { if (!cMap.has(c.target)) cMap.set(c.target, {}); cMap.get(c.target)[c.type] = c.n; }
  for (const m of mine) { if (!mMap.has(m.target)) mMap.set(m.target, []); mMap.get(m.target).push(m.type); }
  for (const r of rows) { const t = table + ":" + r.id; r.reactions = { counts: cMap.get(t) || {}, mine: mMap.get(t) || [] }; }
  return rows;
}
// Follows — a member follows another member (social graph): followers/following counts,
// "Followers"/"Following" lists, and whether the caller follows a given member. Stored in
// the site's own D1 `_follows` (follower_id, followee_id) with a PK that dedupes, so
// "follow" is idempotent and one-per-pair — mirrors the reactions primitive but over the
// member graph rather than rows. Ensured once per warm isolate.
const _followsReady = new Set();
async function ensureFollows(env, uuid) {
  if (_followsReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _follows (follower_id INTEGER NOT NULL, followee_id INTEGER NOT NULL, created_at TEXT, PRIMARY KEY (follower_id, followee_id))");
  _followsReady.add(uuid);
}
// Toggle whether `follower` follows `followee`. `set` forces on/off; otherwise flips.
// Returns {following, followers} (the caller's new state + followee's follower count).
async function toggleFollow(env, uuid, follower, followee, set) {
  await ensureFollows(env, uuid);
  const existing = await cfD1Query(env, uuid, "SELECT 1 FROM _follows WHERE follower_id=? AND followee_id=?", [follower, followee]);
  const has = !!existing[0];
  const want = set === "on" ? true : set === "off" ? false : !has;
  if (want && !has) await cfD1Query(env, uuid, "INSERT OR IGNORE INTO _follows (follower_id,followee_id,created_at) VALUES (?,?,?)", [follower, followee, new Date().toISOString()]);
  else if (!want && has) await cfD1Query(env, uuid, "DELETE FROM _follows WHERE follower_id=? AND followee_id=?", [follower, followee]);
  const cnt = await cfD1Query(env, uuid, "SELECT COUNT(*) AS n FROM _follows WHERE followee_id=?", [followee]);
  return { following: want, followers: (cnt[0] && cnt[0].n) || 0 };
}
// Counts for one member: {followers, following, mine} — how many follow this member, how
// many they follow, and whether the (optional) viewer follows them.
async function followState(env, uuid, targetId, viewerId) {
  await ensureFollows(env, uuid);
  const fr = await cfD1Query(env, uuid, "SELECT COUNT(*) AS n FROM _follows WHERE followee_id=?", [targetId]);
  const fg = await cfD1Query(env, uuid, "SELECT COUNT(*) AS n FROM _follows WHERE follower_id=?", [targetId]);
  let mine = false;
  if (viewerId) { const m = await cfD1Query(env, uuid, "SELECT 1 FROM _follows WHERE follower_id=? AND followee_id=?", [viewerId, targetId]); mine = !!m[0]; }
  return { followers: (fr[0] && fr[0].n) || 0, following: (fg[0] && fg[0].n) || 0, mine };
}
// The follower (or followee) member profiles for a "Followers"/"Following" page. `dir`
// "followers" → members who follow <id>; "following" → members <id> follows. Batched,
// public-safe profile columns only, newest-first, capped.
async function followList(env, uuid, targetId, dir, limit) {
  await ensureFollows(env, uuid);
  const col = dir === "following" ? "follower_id" : "followee_id";
  const pick = dir === "following" ? "followee_id" : "follower_id";
  const lim = Math.min(200, Math.max(1, limit || 100));
  const rows = await cfD1Query(env, uuid, "SELECT " + pick + " AS uid FROM _follows WHERE " + col + "=? ORDER BY created_at DESC LIMIT ?", [targetId, lim]);
  const ids = [...new Set(rows.map((r) => r.uid).filter((v) => v != null))];
  if (!ids.length) return [];
  let profs = [];
  try { profs = await cfD1Query(env, uuid, "SELECT id,display_name,avatar_url,bio FROM _users WHERE id IN (" + ids.map(() => "?").join(",") + ")", ids); } catch { return []; }
  const byId = new Map(profs.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
// Bookmarks / saves — a member saves any row (target `<table>:<id>`) to a private list
// ("save for later", favourites, a reading list, a wishlist). Deduped per (member,target)
// PK. Mirrors reactions but is PRIVATE to each member (their own saved list). Ensured once.
const _bookmarksReady = new Set();
async function ensureBookmarks(env, uuid) {
  if (_bookmarksReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _bookmarks (user_id INTEGER NOT NULL, target TEXT NOT NULL, created_at TEXT, PRIMARY KEY (user_id, target))");
  _bookmarksReady.add(uuid);
}
async function toggleBookmark(env, uuid, userId, target, set) {
  await ensureBookmarks(env, uuid);
  const existing = await cfD1Query(env, uuid, "SELECT 1 FROM _bookmarks WHERE user_id=? AND target=?", [userId, target]);
  const has = !!existing[0];
  const want = set === "on" ? true : set === "off" ? false : !has;
  if (want && !has) await cfD1Query(env, uuid, "INSERT OR IGNORE INTO _bookmarks (user_id,target,created_at) VALUES (?,?,?)", [userId, target, new Date().toISOString()]);
  else if (!want && has) await cfD1Query(env, uuid, "DELETE FROM _bookmarks WHERE user_id=? AND target=?", [userId, target]);
  const cnt = await cfD1Query(env, uuid, "SELECT COUNT(*) AS n FROM _bookmarks WHERE target=?", [target]);
  return { saved: want, count: (cnt[0] && cnt[0].n) || 0 };
}
async function bookmarkState(env, uuid, target, userId) {
  await ensureBookmarks(env, uuid);
  const cnt = await cfD1Query(env, uuid, "SELECT COUNT(*) AS n FROM _bookmarks WHERE target=?", [target]);
  let mine = false;
  if (userId) { const m = await cfD1Query(env, uuid, "SELECT 1 FROM _bookmarks WHERE user_id=? AND target=?", [userId, target]); mine = !!m[0]; }
  return { count: (cnt[0] && cnt[0].n) || 0, mine };
}
// The caller's saved targets, newest-first, optionally filtered to one table. Returns
// [{target, id, table, created_at}] so an app can fetch the rows (e.g. ?where=id:in:…).
async function bookmarkList(env, uuid, userId, table, limit) {
  await ensureBookmarks(env, uuid);
  const lim = Math.min(500, Math.max(1, limit || 200));
  const rows = table
    ? await cfD1Query(env, uuid, "SELECT target, created_at FROM _bookmarks WHERE user_id=? AND target LIKE ? ORDER BY created_at DESC LIMIT ?", [userId, table + ":%", lim])
    : await cfD1Query(env, uuid, "SELECT target, created_at FROM _bookmarks WHERE user_id=? ORDER BY created_at DESC LIMIT ?", [userId, lim]);
  return rows.map((r) => { const i = String(r.target).indexOf(":"); return { target: r.target, table: i > 0 ? r.target.slice(0, i) : null, id: i > 0 ? parseInt(r.target.slice(i + 1), 10) : null, created_at: r.created_at }; });
}
// App settings / config — a per-app key→value store (theme, hero text, feature flags,
// toggles). Publicly READABLE (the app renders from it), ADMIN-only writable (only the
// built app's admin changes settings). Values are stored as JSON so booleans/numbers/
// objects round-trip. Stored in the site's own D1 `_config`, ensured once per isolate.
const _configReady = new Set();
async function ensureConfig(env, uuid) {
  if (_configReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _config (k TEXT PRIMARY KEY, v TEXT, updated_at TEXT)");
  _configReady.add(uuid);
}
function parseConfigVal(v) { if (v == null) return null; try { return JSON.parse(v); } catch { return v; } }
async function readConfig(env, uuid, key) {
  await ensureConfig(env, uuid);
  if (key) { const r = await cfD1Query(env, uuid, "SELECT v FROM _config WHERE k=?", [key]); return r[0] ? parseConfigVal(r[0].v) : null; }
  const rows = await cfD1Query(env, uuid, "SELECT k, v FROM _config");
  const out = {}; for (const r of rows) out[r.k] = parseConfigVal(r.v); return out;
}
async function writeConfig(env, uuid, key, value) {
  await ensureConfig(env, uuid);
  await cfD1Query(env, uuid, "INSERT INTO _config (k,v,updated_at) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at", [key, JSON.stringify(value === undefined ? null : value), new Date().toISOString()]);
}
// API keys for app-to-app / server-to-server access — an admin mints a long-lived
// secret that another server presents as `X-API-Key` to the data API instead of a
// site-user login. Each key is BOUND to the minting admin's user id, so it inherits
// that member's identity + role through the normal authz path (no special-casing).
// Only a SHA-256 hash is stored (like passwords); the plaintext is shown once at mint.
// Stored in the site's own D1 `_apikeys`, ensured once per isolate.
const _apiKeysReady = new Set();
async function ensureApiKeys(env, uuid) {
  if (_apiKeysReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _apikeys (id INTEGER PRIMARY KEY AUTOINCREMENT, key_hash TEXT UNIQUE NOT NULL, prefix TEXT, label TEXT, user_id INTEGER, created_at TEXT, last_used TEXT, revoked INTEGER DEFAULT 0)");
  _apiKeysReady.add(uuid);
}
// Resolve an X-API-Key header to the member id it acts as (or null). Non-throwing;
// bumps last_used opportunistically so the owner can spot stale keys.
async function resolveApiKeyUser(env, ctx, uuid, request) {
  const raw = (request.headers.get("X-API-Key") || request.headers.get("x-api-key") || "").trim();
  if (!raw || !/^sk_[a-z0-9]{24,64}$/i.test(raw)) return null;
  try {
    await ensureApiKeys(env, uuid);
    const hash = await sha256hex(raw);
    const r = await cfD1Query(env, uuid, "SELECT id, user_id, revoked FROM _apikeys WHERE key_hash=?", [hash]);
    if (!r[0] || r[0].revoked) return null;
    if (ctx && ctx.waitUntil) ctx.waitUntil(cfD1Query(env, uuid, "UPDATE _apikeys SET last_used=? WHERE id=?", [new Date().toISOString(), r[0].id]).catch(() => {}));
    return r[0].user_id || null;
  } catch { return null; }
}
// Content reports / flags → a moderation queue. A member flags a row (target `<table>:<id>`)
// with a reason; the app's ADMIN reviews the queue and resolves/dismisses. Deduped per
// (target, reporter) so one flag each. Stored in the site's own D1 `_reports`, ensured once.
const _reportsReady = new Set();
async function ensureReports(env, uuid) {
  if (_reportsReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _reports (id INTEGER PRIMARY KEY AUTOINCREMENT, target TEXT NOT NULL, reporter_id INTEGER NOT NULL, reason TEXT, status TEXT NOT NULL DEFAULT 'open', created_at TEXT, UNIQUE(target, reporter_id))");
  _reportsReady.add(uuid);
}
async function createReport(env, uuid, target, reporterId, reason) {
  await ensureReports(env, uuid);
  await cfD1Query(env, uuid, "INSERT OR IGNORE INTO _reports (target,reporter_id,reason,status,created_at) VALUES (?,?,?, 'open', ?)", [target, reporterId, String(reason || "").slice(0, 500), new Date().toISOString()]);
  const cnt = await cfD1Query(env, uuid, "SELECT COUNT(*) AS n FROM _reports WHERE target=?", [target]);
  return { reported: true, count: (cnt[0] && cnt[0].n) || 0 };
}
async function reportState(env, uuid, target, userId) {
  await ensureReports(env, uuid);
  const cnt = await cfD1Query(env, uuid, "SELECT COUNT(*) AS n FROM _reports WHERE target=?", [target]);
  let mine = false;
  if (userId) { const m = await cfD1Query(env, uuid, "SELECT 1 FROM _reports WHERE target=? AND reporter_id=?", [target, userId]); mine = !!m[0]; }
  return { count: (cnt[0] && cnt[0].n) || 0, mine };
}
// Approvals — a sign-off workflow on a table declaring `approval:{approvers,status}`. A row is
// submitted (status→pending), then an approver (a member whose role is in `approvers`, or admin)
// approves (→approved) or rejects (→rejected). The status lives in the row's platform-added
// `approval:{status}` column (endpoint-set only — never app-writable, so an owner can't
// self-approve by PATCHing). Every decision is logged to `_approvals` for the audit trail
// (who submitted/approved/rejected, when, with an optional note). Ensured once per isolate.
const _approvalsReady = new Set();
async function ensureApprovals(env, uuid) {
  if (_approvalsReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _approvals (id INTEGER PRIMARY KEY AUTOINCREMENT, row_table TEXT NOT NULL, row_id INTEGER NOT NULL, action TEXT NOT NULL, actor_id INTEGER, note TEXT, at TEXT)");
  _approvalsReady.add(uuid);
}
async function logApproval(env, uuid, table, rowId, action, actorId, note) {
  await ensureApprovals(env, uuid);
  await cfD1Query(env, uuid, "INSERT INTO _approvals (row_table,row_id,action,actor_id,note,at) VALUES (?,?,?,?,?,?)", [table, rowId, action, actorId || null, String(note || "").slice(0, 1000) || null, new Date().toISOString()]);
}
// Activity notes — a member logs a note/call/email/meeting/task against any record (a CRM
// activity log against a contact or deal). Polymorphic: keyed by (row_table, row_id). Stored in
// `_notes` with the author + a `kind` + free-text body. Reads are newest-first with the author's
// public profile; a member removes their OWN note (an admin removes any). Ensured once per isolate.
const _notesReady = new Set();
const NOTE_KINDS = new Set(["note", "call", "email", "meeting", "task", "sms", "log"]);
async function ensureNotes(env, uuid) {
  if (_notesReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _notes (id INTEGER PRIMARY KEY AUTOINCREMENT, row_table TEXT NOT NULL, row_id INTEGER NOT NULL, author_id INTEGER, kind TEXT NOT NULL DEFAULT 'note', body TEXT, created_at TEXT)");
  _notesReady.add(uuid);
}
// File attachments on records — a contract PDF on a deal, a photo on a ticket. Bytes live in the
// R2 SITES_BUCKET (stored base64 so it round-trips faithfully; decoded when streamed back); the
// metadata (filename, type, size, key, uploader) lives in the site's own D1 `_attachments`, keyed
// (row_table,row_id). Fetched back through the Worker so access follows the record's visibility —
// the provider/bucket is never exposed. Ensured once per isolate.
const _attachReady = new Set();
async function ensureAttachments(env, uuid) {
  if (_attachReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _attachments (id INTEGER PRIMARY KEY AUTOINCREMENT, row_table TEXT NOT NULL, row_id INTEGER NOT NULL, filename TEXT, content_type TEXT, size INTEGER, r2_key TEXT NOT NULL, uploaded_by INTEGER, created_at TEXT)");
  _attachReady.add(uuid);
}
// A signed-in member can log/see notes on a record they can SEE: public-read tables
// (display/feed/admin) → any member; a `user` table → the row's owner, its owner's manager
// (teamRead), or an admin. `collect` (write-only) exposes nothing, so no notes there.
async function memberCanSeeRow(env, uuid, def, tn, rowId, userId, access) {
  if (access === "collect") return false;
  if (access !== "user") return true;
  const row = await cfD1Query(env, uuid, "SELECT owner_id FROM " + tn + " WHERE id=?", [rowId]);
  if (!row[0]) return false;
  if (row[0].owner_id === userId) return true;
  const rr = await cfD1Query(env, uuid, "SELECT role FROM _users WHERE id=?", [userId]);
  if (rr[0] && rr[0].role === "admin") return true;
  if (def.teamRead && row[0].owner_id != null) {
    const dl = await cfD1Query(env, uuid, "WITH RECURSIVE dl(id) AS (SELECT ? UNION SELECT u.id FROM _users u JOIN dl ON u.manager_id = dl.id) SELECT 1 FROM dl WHERE id=? LIMIT 1", [userId, row[0].owner_id]);
    if (dl[0]) return true;
  }
  return false;
}
// Polls — one vote per member per poll (change your vote by voting again). A poll is any
// string id (e.g. `best-logo` or `question:${id}`); options are app-defined strings. Stored
// in `_polls` with PK (poll, user_id), so re-voting UPDATES the member's choice — real
// one-per-user tallies. Ensured once per isolate.
const _pollsReady = new Set();
async function ensurePolls(env, uuid) {
  if (_pollsReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _polls (poll TEXT NOT NULL, option TEXT NOT NULL, user_id INTEGER NOT NULL, created_at TEXT, PRIMARY KEY (poll, user_id))");
  _pollsReady.add(uuid);
}
async function pollState(env, uuid, poll, userId) {
  await ensurePolls(env, uuid);
  const rows = await cfD1Query(env, uuid, "SELECT option, COUNT(*) AS n FROM _polls WHERE poll=? GROUP BY option", [poll]);
  const counts = {}; let total = 0; for (const r of rows) { counts[r.option] = r.n; total += r.n; }
  let mine = null;
  if (userId) { const m = await cfD1Query(env, uuid, "SELECT option FROM _polls WHERE poll=? AND user_id=?", [poll, userId]); mine = m[0] ? m[0].option : null; }
  return { counts, total, mine };
}
async function votePoll(env, uuid, poll, option, userId) {
  await ensurePolls(env, uuid);
  await cfD1Query(env, uuid, "INSERT INTO _polls (poll,option,user_id,created_at) VALUES (?,?,?,?) ON CONFLICT(poll,user_id) DO UPDATE SET option=excluded.option, created_at=excluded.created_at", [poll, option, userId, new Date().toISOString()]);
  return pollState(env, uuid, poll, userId);
}
async function unvotePoll(env, uuid, poll, userId) {
  await ensurePolls(env, uuid);
  await cfD1Query(env, uuid, "DELETE FROM _polls WHERE poll=? AND user_id=?", [poll, userId]);
  return pollState(env, uuid, poll, userId);
}
// Blocks — a member blocks another so they can hide that member's content (feed reads with
// `?hideBlocked=1` exclude blocked authors) and sever any follow edges between them. Stored
// in `_blocks` PK(blocker_id, blocked_id). Personal + private to each member. Ensured once.
const _blocksReady = new Set();
async function ensureBlocks(env, uuid) {
  if (_blocksReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _blocks (blocker_id INTEGER NOT NULL, blocked_id INTEGER NOT NULL, created_at TEXT, PRIMARY KEY (blocker_id, blocked_id))");
  _blocksReady.add(uuid);
}
async function toggleBlock(env, uuid, blocker, blocked, set) {
  await ensureBlocks(env, uuid);
  const has = !!(await cfD1Query(env, uuid, "SELECT 1 FROM _blocks WHERE blocker_id=? AND blocked_id=?", [blocker, blocked]))[0];
  const want = set === "on" ? true : set === "off" ? false : !has;
  if (want && !has) {
    await cfD1Query(env, uuid, "INSERT OR IGNORE INTO _blocks (blocker_id,blocked_id,created_at) VALUES (?,?,?)", [blocker, blocked, new Date().toISOString()]);
    try { await ensureFollows(env, uuid); await cfD1Query(env, uuid, "DELETE FROM _follows WHERE (follower_id=? AND followee_id=?) OR (follower_id=? AND followee_id=?)", [blocked, blocker, blocker, blocked]); } catch {}
  } else if (!want && has) { await cfD1Query(env, uuid, "DELETE FROM _blocks WHERE blocker_id=? AND blocked_id=?", [blocker, blocked]); }
  return { blocking: want };
}
async function blockState(env, uuid, blocker, target) {
  await ensureBlocks(env, uuid);
  const m = await cfD1Query(env, uuid, "SELECT 1 FROM _blocks WHERE blocker_id=? AND blocked_id=?", [blocker, target]);
  return { blocking: !!m[0] };
}
async function blockedIdList(env, uuid, blocker) {
  await ensureBlocks(env, uuid);
  const rows = await cfD1Query(env, uuid, "SELECT blocked_id FROM _blocks WHERE blocker_id=? ORDER BY created_at DESC", [blocker]);
  return rows.map((r) => r.blocked_id);
}
// Presence / who's-online — a member pings while active; the app shows who's online now
// (chat, a collab room, a member directory). One last-seen row per member in `_presence`;
// "online" = pinged within the last N minutes. Ensured once per isolate.
const _presenceReady = new Set();
async function ensurePresence(env, uuid) {
  if (_presenceReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _presence (user_id INTEGER PRIMARY KEY, at TEXT)");
  _presenceReady.add(uuid);
}
async function touchPresence(env, uuid, userId) {
  await ensurePresence(env, uuid);
  await cfD1Query(env, uuid, "INSERT INTO _presence (user_id,at) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET at=excluded.at", [userId, new Date().toISOString()]);
}
async function onlineList(env, uuid, within) {
  await ensurePresence(env, uuid);
  return cfD1Query(env, uuid, "SELECT p.user_id AS id, p.at AS last_seen, u.display_name, u.avatar_url FROM _presence p LEFT JOIN _users u ON u.id=p.user_id WHERE datetime(p.at) > datetime('now', ?) ORDER BY p.at DESC LIMIT 500", ["-" + within + " minutes"]);
}
async function presenceOf(env, uuid, userId, within) {
  await ensurePresence(env, uuid);
  const r = await cfD1Query(env, uuid, "SELECT at FROM _presence WHERE user_id=?", [userId]);
  if (!r[0]) return { online: false, last_seen: null };
  const on = await cfD1Query(env, uuid, "SELECT 1 AS y FROM _presence WHERE user_id=? AND datetime(at) > datetime('now', ?)", [userId, "-" + within + " minutes"]);
  return { online: !!on[0], last_seen: r[0].at };
}
// Saved views / filters — a member saves a NAMED query config (a filter set, a saved search,
// a custom dashboard layout) as arbitrary JSON, and lists/loads them later. Private per
// member, keyed (user_id, name) in `_views`. Ensured once per isolate.
const _viewsReady = new Set();
async function ensureViews(env, uuid) {
  if (_viewsReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _views (user_id INTEGER NOT NULL, name TEXT NOT NULL, spec TEXT, created_at TEXT, PRIMARY KEY (user_id, name))");
  _viewsReady.add(uuid);
}
const _parseView = (v) => { try { return JSON.parse(v); } catch { return v; } };
async function saveView(env, uuid, userId, name, spec) {
  await ensureViews(env, uuid);
  await cfD1Query(env, uuid, "INSERT INTO _views (user_id,name,spec,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id,name) DO UPDATE SET spec=excluded.spec, created_at=excluded.created_at", [userId, name, JSON.stringify(spec === undefined ? null : spec), new Date().toISOString()]);
}
async function listViews(env, uuid, userId) {
  await ensureViews(env, uuid);
  const rows = await cfD1Query(env, uuid, "SELECT name, spec, created_at FROM _views WHERE user_id=? ORDER BY name", [userId]);
  return rows.map((r) => ({ name: r.name, spec: _parseView(r.spec), created_at: r.created_at }));
}
async function getView(env, uuid, userId, name) {
  await ensureViews(env, uuid);
  const r = await cfD1Query(env, uuid, "SELECT spec FROM _views WHERE user_id=? AND name=?", [userId, name]);
  return r[0] ? _parseView(r[0].spec) : null;
}
async function deleteView(env, uuid, userId, name) {
  await ensureViews(env, uuid);
  await cfD1Query(env, uuid, "DELETE FROM _views WHERE user_id=? AND name=?", [userId, name]);
}
// Many-to-many links — a generic UNDIRECTED relationship between any two rows (targets are
// `<table>:<id>`): tags↔posts, users↔projects, students↔courses, a "related items" web.
// Pairs are normalized (sorted) + PK-deduped in `_links` so one edge per pair, queryable
// from EITHER side. Saves declaring a join table for a simple many-to-many.
const _linksReady = new Set();
async function ensureLinks(env, uuid) {
  if (_linksReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _links (a TEXT NOT NULL, b TEXT NOT NULL, created_at TEXT, PRIMARY KEY (a,b))");
  _linksReady.add(uuid);
}
const _normPair = (x, y) => (x <= y ? [x, y] : [y, x]);
async function addLink(env, uuid, x, y) { await ensureLinks(env, uuid); const [a, b] = _normPair(x, y); await cfD1Query(env, uuid, "INSERT OR IGNORE INTO _links (a,b,created_at) VALUES (?,?,?)", [a, b, new Date().toISOString()]); }
async function removeLink(env, uuid, x, y) { await ensureLinks(env, uuid); const [a, b] = _normPair(x, y); await cfD1Query(env, uuid, "DELETE FROM _links WHERE a=? AND b=?", [a, b]); }
async function linksOf(env, uuid, target, toTable) {
  await ensureLinks(env, uuid);
  const rows = await cfD1Query(env, uuid, "SELECT a,b,created_at FROM _links WHERE a=? OR b=? ORDER BY created_at DESC LIMIT 500", [target, target]);
  const others = rows.map((r) => (r.a === target ? r.b : r.a));
  const filtered = toTable ? others.filter((o) => o.toLowerCase().startsWith(toTable.toLowerCase() + ":")) : others;
  return filtered.map((o) => { const i = o.indexOf(":"); return { target: o, table: i > 0 ? o.slice(0, i) : null, id: i > 0 ? parseInt(o.slice(i + 1), 10) : null }; });
}
// Coupons / discount codes — a redeemable code with an optional usage cap + expiry. The app
// ADMIN mints codes; anyone can VALIDATE one, and a signed-in member REDEEMS it (an atomic
// UPDATE bumps `used`, so the cap is race-free). `discount` is app-defined JSON (percent/
// amount/free-shipping/…). Stored in `_coupons`. Ensured once per isolate.
const _couponsReady = new Set();
async function ensureCoupons(env, uuid) {
  if (_couponsReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _coupons (code TEXT PRIMARY KEY, discount TEXT, max_uses INTEGER, used INTEGER DEFAULT 0, expires_at TEXT, created_at TEXT)");
  _couponsReady.add(uuid);
}
const _parseDiscount = (v) => { if (v == null) return null; try { return JSON.parse(v); } catch { return v; } };
async function couponState(env, uuid, code) {
  await ensureCoupons(env, uuid);
  const r = await cfD1Query(env, uuid, "SELECT code,discount,max_uses,used,expires_at FROM _coupons WHERE code=?", [code]);
  if (!r[0]) return { valid: false, reason: "not found" };
  const row = r[0];
  const expired = row.expires_at && new Date(row.expires_at).getTime() <= Date.now();
  const spent = row.max_uses != null && row.used >= row.max_uses;
  return { valid: !expired && !spent, reason: expired ? "expired" : spent ? "used up" : null, discount: _parseDiscount(row.discount), remaining: row.max_uses != null ? Math.max(0, row.max_uses - row.used) : null };
}
async function redeemCoupon(env, uuid, code) {
  await ensureCoupons(env, uuid);
  const ex = await cfD1Exec(env, uuid, "UPDATE _coupons SET used=used+1 WHERE code=? AND (max_uses IS NULL OR used < max_uses) AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))", [code]);
  if (!ex.changes) { const st = await couponState(env, uuid, code); return { ok: false, reason: st.reason || "invalid" }; }
  const r = await cfD1Query(env, uuid, "SELECT discount FROM _coupons WHERE code=?", [code]);
  return { ok: true, discount: r[0] ? _parseDiscount(r[0].discount) : null };
}
// Shopping cart — a member's cart of items (`<table>:<id>` → quantity). One row per
// (member,item) in `_cart`; setting qty≤0 removes. A ready cart so the app doesn't hand-roll
// one; on checkout it reads the cart, prices it, and (once paid) writes an orders row + clears.
const _cartReady = new Set();
async function ensureCart(env, uuid) {
  if (_cartReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _cart (user_id INTEGER NOT NULL, item TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 1, added_at TEXT, PRIMARY KEY (user_id, item))");
  _cartReady.add(uuid);
}
async function setCartItem(env, uuid, userId, item, qty) {
  await ensureCart(env, uuid);
  if (qty <= 0) await cfD1Query(env, uuid, "DELETE FROM _cart WHERE user_id=? AND item=?", [userId, item]);
  else await cfD1Query(env, uuid, "INSERT INTO _cart (user_id,item,qty,added_at) VALUES (?,?,?,?) ON CONFLICT(user_id,item) DO UPDATE SET qty=excluded.qty", [userId, item, qty, new Date().toISOString()]);
}
async function getCart(env, uuid, userId) {
  await ensureCart(env, uuid);
  const rows = await cfD1Query(env, uuid, "SELECT item, qty, added_at FROM _cart WHERE user_id=? ORDER BY added_at DESC", [userId]);
  return rows.map((r) => { const i = String(r.item).indexOf(":"); return { item: r.item, table: i > 0 ? r.item.slice(0, i) : null, id: i > 0 ? parseInt(r.item.slice(i + 1), 10) : null, qty: r.qty, added_at: r.added_at }; });
}
async function clearCart(env, uuid, userId) { await ensureCart(env, uuid); await cfD1Query(env, uuid, "DELETE FROM _cart WHERE user_id=?", [userId]); }
// Tags / labels — attach short labels to any row and filter by them. Stored in the
// site's own D1 `_tags` (row_table, row_id, tag), ensured once per isolate. Reads are
// public; adding/removing follows the same write scope as the row.
const _tagsReady = new Set();
async function ensureTags(env, uuid) {
  if (_tagsReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _tags (row_table TEXT NOT NULL, row_id INTEGER NOT NULL, tag TEXT NOT NULL, created_at TEXT, PRIMARY KEY (row_table, row_id, tag))");
  _tagsReady.add(uuid);
}
const cleanTag = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
async function tagsForRow(env, uuid, table, rowId) {
  await ensureTags(env, uuid);
  const r = await cfD1Query(env, uuid, "SELECT tag FROM _tags WHERE row_table=? AND row_id=? ORDER BY tag", [table, rowId]);
  return r.map((x) => x.tag);
}
// `?tags=1` — attach each row's tag list under `row.tags` (batched over all row ids).
async function attachTags(env, uuid, table, rows, url) {
  if (url.searchParams.get("tags") !== "1" || !rows.length) return rows;
  await ensureTags(env, uuid);
  const ids = rows.map((r) => r.id).filter((v) => v != null).slice(0, 200);
  if (!ids.length) return rows;
  let recs = [];
  try { recs = await cfD1Query(env, uuid, "SELECT row_id, tag FROM _tags WHERE row_table=? AND row_id IN (" + ids.map(() => "?").join(",") + ") ORDER BY tag", [table, ...ids]); } catch { return rows; }
  const m = new Map();
  for (const rec of recs) { if (!m.has(rec.row_id)) m.set(rec.row_id, []); m.get(rec.row_id).push(rec.tag); }
  for (const r of rows) r.tags = m.get(r.id) || [];
  return rows;
}
// Per-row sharing / ACL — a member who OWNS a private (`user`-access) row can grant
// specific OTHER members `view` or `edit` access to just that row (share a doc, a
// board, a trip). Stored in the site's own D1 `_shares`, keyed (row_table,row_id,user).
const _sharesReady = new Set();
async function ensureShares(env, uuid) {
  if (_sharesReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _shares (row_table TEXT NOT NULL, row_id INTEGER NOT NULL, user_id INTEGER NOT NULL, perm TEXT NOT NULL DEFAULT 'view', created_at TEXT, PRIMARY KEY (row_table, row_id, user_id))");
  _sharesReady.add(uuid);
}
// The caller's access level to one row via a share: 'edit' | 'view' | null.
async function shareLevel(env, uuid, table, rowId, userId) {
  if (!userId || !(rowId > 0)) return null;
  await ensureShares(env, uuid);
  const r = await cfD1Query(env, uuid, "SELECT perm FROM _shares WHERE row_table=? AND row_id=? AND user_id=?", [table, rowId, userId]);
  return r[0] ? (r[0].perm === "edit" ? "edit" : "view") : null;
}
// Row ids of `table` shared WITH this member (for the "shared with me" list view).
async function sharedRowIds(env, uuid, table, userId, editOnly) {
  if (!userId) return [];
  await ensureShares(env, uuid);
  const r = await cfD1Query(env, uuid, "SELECT row_id FROM _shares WHERE row_table=? AND user_id=?" + (editOnly ? " AND perm='edit'" : ""), [table, userId]);
  return r.map((x) => x.row_id);
}
// In-app notifications — a per-member inbox (someone commented on your post, your
// order shipped, you were @mentioned). Created SERVER-SIDE ONLY (a function/trigger
// `notify` step), so a visitor can't spam another; each member reads only their own.
// Stored in the site's own D1 `_notifications`, ensured once per isolate.
const _notifsReady = new Set();
async function ensureNotifications(env, uuid) {
  if (_notifsReady.has(uuid)) return;
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT, text TEXT, link TEXT, read INTEGER DEFAULT 0, created_at TEXT)");
  _notifsReady.add(uuid);
}
async function createNotification(env, uuid, userId, n) {
  const uid = parseInt(userId, 10);
  if (!(uid > 0)) return false;
  await ensureNotifications(env, uuid);
  await cfD1Query(env, uuid, "INSERT INTO _notifications (user_id,type,text,link,created_at) VALUES (?,?,?,?,?)", [uid, String(n.type || "").slice(0, 40), String(n.text || "").slice(0, 500), String(n.link || "").slice(0, 400), new Date().toISOString()]);
  return true;
}
// Invite-only signup — the owner can require a valid invite code to register.
// Flag in _meta ('invite_only'='1'); codes live in `_invites` (code, uses_left).
async function ensureInvites(env, uuid) {
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _invites (code TEXT PRIMARY KEY, uses_left INTEGER DEFAULT 1, used_count INTEGER DEFAULT 0, created_at TEXT)");
}
async function isInviteOnly(env, uuid) {
  try { const r = await cfD1Query(env, uuid, "SELECT v FROM _meta WHERE k='invite_only'"); return !!(r[0] && r[0].v === "1"); } catch { return false; }
}
// Redeem a code atomically (decrement uses_left, bump used_count). Returns true on
// success. A code with uses_left<=0 (or unknown) fails.
async function consumeInvite(env, uuid, code) {
  const c = String(code || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40);
  if (!c) return false;
  await ensureInvites(env, uuid);
  const ex = await cfD1Exec(env, uuid, "UPDATE _invites SET uses_left=uses_left-1, used_count=used_count+1 WHERE code=? AND uses_left>0", [c]);
  return ex.changes > 0;
}
// Parse the shared filter part of a data-API read: `where=<col>:<op>:<val>`
// (repeatable, AND-ed; op eq|ne|lt|lte|gt|gte|contains) + `q=<text>` (free-text LIKE
// across the declared columns). Columns are validated against the table's own columns
// and double-quoted; every value is parameterized. `base` prepends a scope clause
// (owner_id for a `user` table). Returns the WHERE fragment + its params + the set of
// columns that are legal to reference (for sort/group validation upstream).
function buildD1Filter(url, allowCols, base, extra) {
  // `extra` = auto-managed columns this table actually has (position/updated_at/_version),
  // so where/sort can target them without them being app-declared columns.
  const filterable = new Set(allowCols.concat(["id", "created_at"], extra || []).map((c) => String(c).toLowerCase()));
  const OPS = { eq: "=", ne: "!=", lt: "<", lte: "<=", gt: ">", gte: ">=", contains: "LIKE", startswith: "LIKE", endswith: "LIKE" };
  const where = [], params = [];
  if (base && base.clause) { where.push(base.clause); params.push(...base.params); }
  for (const raw of url.searchParams.getAll("where").slice(0, 12)) {
    const m = String(raw).match(/^([a-z_][a-z0-9_]{0,40}):(eq|ne|lt|lte|gt|gte|contains|startswith|endswith|in|nin|between|isnull|notnull):([\s\S]*)$/i);
    if (!m) continue;
    const col = m[1].toLowerCase(); if (!filterable.has(col)) continue;
    const opName = m[2].toLowerCase(), val = m[3];
    if (opName === "isnull") { where.push(sqlIdent(col) + " IS NULL"); continue; }
    if (opName === "notnull") { where.push(sqlIdent(col) + " IS NOT NULL"); continue; }
    // Inclusive range: `col:between:lo:hi` (or `lo,hi`) → col >= lo AND col <= hi. Good for
    // price bands, date windows, score ranges. Both bounds required; values bind as-is
    // (SQLite column affinity handles numeric vs text comparison).
    if (opName === "between") {
      const parts = String(val).split(/[:,]/).map((x) => x.trim());
      if (parts.length < 2 || parts[0] === "" || parts[1] === "") continue;
      where.push("(" + sqlIdent(col) + " >= ? AND " + sqlIdent(col) + " <= ?)");
      params.push(parts[0], parts[1]);
      continue;
    }
    if (opName === "in" || opName === "nin") {
      const vals = String(val).split(",").map((x) => x.trim()).filter((x) => x !== "").slice(0, 100);
      if (!vals.length) continue;
      where.push(sqlIdent(col) + (opName === "nin" ? " NOT IN (" : " IN (") + vals.map(() => "?").join(",") + ")");
      params.push(...vals);
      continue;
    }
    const op = OPS[opName]; if (!op) continue;
    where.push(sqlIdent(col) + " " + op + " ?");
    params.push(op !== "LIKE" ? val : opName === "startswith" ? val + "%" : opName === "endswith" ? "%" + val : "%" + val + "%");
  }
  // Free-text `q`: split into words and require EVERY word to appear in SOME declared
  // column (AND of terms, OR across columns) — so "miami beach" matches rows containing
  // both words in any order/field, not just the literal substring.
  const q = (url.searchParams.get("q") || "").trim();
  const terms = q ? q.split(/\s+/).filter(Boolean).slice(0, 6) : [];
  if (terms.length && allowCols.length) {
    for (const term of terms) {
      where.push("(" + allowCols.map((c) => sqlIdent(c) + " LIKE ?").join(" OR ") + ")");
      for (let i = 0; i < allowCols.length; i++) params.push("%" + term + "%");
    }
  }
  return { filterable, whereSql: where.length ? " WHERE " + where.join(" AND ") : "", params, terms };
}
// Build a filtered/sorted/paginated SELECT for a data-API list read: the filter above
// plus `sort=<col>&order=asc|desc`, `limit`(≤200)+`offset`. Returns the row query + a
// matching COUNT for {total}.
function buildD1List(url, tn, allowCols, base, extra, opts) {
  opts = opts || {};
  const f = buildD1Filter(url, allowCols, base, extra);
  // Sort — supports a SINGLE column (`sort=price&order=asc`) OR MULTIPLE, comma-
  // separated with an optional per-column direction prefix: `sort=-price,created_at`
  // (price DESC, created_at using the default). No prefix → the `order` param (default
  // DESC). Each column is validated against the table's own columns; up to 4.
  // A table can declare `defaultSort` (e.g. "-created_at") — used when the request sends
  // no `sort` of its own, so a list has a sensible built-in order without every query
  // asking for it.
  const globalDesc = !/^asc$/i.test(url.searchParams.get("order") || "");
  const sortParam = url.searchParams.get("sort");
  const sortRaw = (sortParam != null && sortParam !== "") ? sortParam : (opts.defaultSort || "");
  const sortToks = String(sortRaw).toLowerCase().split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
  // When ANY column carries a direction prefix (`-`/`+`), an UNprefixed column defaults
  // to ASC (the prefix convention — `sort=status,-price` = status asc, price desc).
  // With no prefixes anywhere, every column follows the `order` param (default DESC),
  // preserving the single-column `sort=price&order=asc` behavior.
  const hasPrefix = sortToks.some((t) => t[0] === "-" || t[0] === "+");
  const defaultDir = hasPrefix ? "ASC" : (globalDesc ? "DESC" : "ASC");
  const orderCols = [];
  for (const tk of sortToks) {
    let dir = null, col = tk;
    if (tk[0] === "-") { dir = "DESC"; col = tk.slice(1); }
    else if (tk[0] === "+") { dir = "ASC"; col = tk.slice(1); }
    if (!f.filterable.has(col)) continue;
    orderCols.push(sqlIdent(col) + " " + (dir || defaultDir));
  }
  const hasExplicit = orderCols.length > 0;
  const lim = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10) || 100));
  const off = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);
  // Relevance ranking: with a free-text `q` and no explicit sort, order by how many
  // (term × column) pairs a row matches — best matches first — then by id.
  let orderSql = (hasExplicit ? orderCols.join(", ") : ("id " + (globalDesc ? "DESC" : "ASC"))), rankParams = [];
  if (f.terms && f.terms.length && allowCols.length && !hasExplicit) {
    // Relevance rank. With a table `searchWeights` map, matches in higher-weighted columns
    // (e.g. title:3, body:1) score more AND only the weighted columns rank; otherwise every
    // column ranks equally (weight 1). The WHERE-side `q` filter still matches any column.
    const weights = opts.searchWeights;
    const rankCols = weights ? allowCols.filter((c) => weights[String(c).toLowerCase()] != null) : allowCols;
    const use = rankCols.length ? rankCols : allowCols;
    const parts = [];
    for (const t of f.terms) for (const c of use) { const w = weights ? (weights[String(c).toLowerCase()] || 1) : 1; parts.push((w !== 1 ? w + "*" : "") + "(" + sqlIdent(c) + " LIKE ?)"); rankParams.push("%" + t + "%"); }
    orderSql = "(" + parts.join(" + ") + ") DESC, id DESC";
  }
  // `sort=random` (aliases rand/shuffle) → random order, for "discover"/"featured"/
  // "shuffle" surfaces. Overrides relevance/explicit sort. Not for pagination (each page
  // reshuffles) — pair with a small `limit` to pick N random rows.
  if (/^(random|rand|shuffle)$/i.test(String(sortRaw).trim())) orderSql = "RANDOM()";
  // Pinned / featured first — on a `pinnable` table, rows with pinned=1 float to the top
  // of EVERY order (sticky posts, featured products), then the normal order (or shuffle)
  // applies within each group. `pinned` is a real app-set column, so `?sort=pinned` and
  // `where=pinned:eq:1` also work.
  if (opts.pinCol && f.filterable.has(String(opts.pinCol).toLowerCase())) orderSql = sqlIdent(opts.pinCol) + " DESC, " + orderSql;
  // Keyset (cursor) pagination for endless "load more" over big/growing lists —
  // stable and faster than large OFFSETs. `?after=<id>` returns rows OLDER than that
  // id (id < after — pairs with the default newest-first order); `?before=<id>` the
  // newer side (id > before). The client just passes the last row's id as the next
  // `after`. Ignored alongside a relevance sort. `where`/`q`/sort still apply.
  let pageWhere = f.whereSql, pageParams = f.params.slice();
  const after = parseInt(url.searchParams.get("after") || "", 10);
  const before = parseInt(url.searchParams.get("before") || "", 10);
  if (Number.isFinite(after) && after > 0) { pageWhere += (pageWhere ? " AND " : " WHERE ") + "id < ?"; pageParams.push(after); }
  else if (Number.isFinite(before) && before > 0) { pageWhere += (pageWhere ? " AND " : " WHERE ") + "id > ?"; pageParams.push(before); }
  return {
    sql: "SELECT * FROM " + tn + pageWhere + " ORDER BY " + orderSql + " LIMIT ? OFFSET ?",
    params: pageParams.concat(rankParams, [lim, off]),
    countSql: "SELECT COUNT(*) AS n FROM " + tn + f.whereSql, // total is the FULL filtered count, not the page
    countParams: f.params.slice(),
  };
}
// Build an aggregate SELECT for the /stats read: always COUNT(*), plus any requested
// sum/avg/min/max over a declared column, optionally grouped by one declared column.
// Reuses the filter above (so stats respect where/q). Aggregate + group columns are
// validated against the table's own columns; everything is parameterized. Returns the
// SQL, params, the requested aggregates, and the resolved group column.
function buildD1Stats(url, tn, allowCols, base, def, spec) {
  const f = buildD1Filter(url, allowCols, base);
  // Multi-currency: the derived base-currency field (`cfg.as`) is aggregatable in SQL by
  // converting each row's amount into the base currency with a CASE over its currency code
  // (same rates as the read-time attach). `cfg.as` isn't a real column, so it's allowed here
  // explicitly and rendered via `convExpr` (not sqlIdent) wherever it's summed/avg'd.
  const cfg = def && def.currency;
  const convExpr = (prefix) => "(" + prefix + sqlIdent(cfg.amount) + " * CASE UPPER(" + prefix + sqlIdent(cfg.code) + ") " + Object.entries(cfg.rates).map(([cc, r]) => "WHEN '" + cc + "' THEN " + Number(r)).join(" ") + " ELSE NULL END)";
  const aggExpr = (prefix, col) => (cfg && col === cfg.as) ? convExpr(prefix) : (prefix + sqlIdent(col));
  const wanted = { sum: [], avg: [], min: [], max: [] };
  for (const k of ["sum", "avg", "min", "max"]) {
    for (const raw of url.searchParams.getAll(k)) {
      for (const c of String(raw).split(",")) {
        const col = c.trim().toLowerCase();
        if (col && (f.filterable.has(col) || (cfg && col === cfg.as)) && !wanted[k].includes(col)) wanted[k].push(col);
      }
    }
  }
  // Grouped-report controls (apply to EVERY grouped path): sort groups by an aggregate, cap to
  // top-N, and filter groups with HAVING — so "top 10 accounts by revenue" or "reps whose pipeline
  // exceeds quota" are one request. An "agg spec" is `count` | `<sum|avg|min|max>:<col>` | `value`.
  const aggSqlExpr = (spec) => {
    const s = String(spec == null ? "" : spec).toLowerCase().trim();
    if (s === "count" || s === "") return "COUNT(*)";
    if (s === "value" || s === "group") return "_g0";
    const m = s.match(/^(sum|avg|min|max):([a-z0-9_]+)$/);
    if (m && (f.filterable.has(m[2]) || (cfg && m[2] === cfg.as))) return m[1].toUpperCase() + "(" + aggExpr("", m[2]) + ")";
    return null;
  };
  const HOPS = { gt: ">", gte: ">=", lt: "<", lte: "<=", eq: "=", ne: "!=" };
  const havingParts = [], havingParams = [];
  for (const raw of url.searchParams.getAll("having")) {
    const m = String(raw).toLowerCase().match(/^([a-z0-9_:]+):(gt|gte|lt|lte|eq|ne):(-?\d+(?:\.\d+)?)$/);
    if (!m) continue;
    const expr = aggSqlExpr(m[1]);
    if (!expr || expr === "_g0") continue; // HAVING is over aggregates, not the raw group value
    havingParts.push(expr + " " + HOPS[m[2]] + " ?"); havingParams.push(Number(m[3]));
  }
  const havingSql = havingParts.length ? " HAVING " + havingParts.join(" AND ") : "";
  const sortExpr = url.searchParams.get("groupSort") ? aggSqlExpr(url.searchParams.get("groupSort")) : null;
  const sortDir = String(url.searchParams.get("groupOrder") || "").toLowerCase() === "asc" ? "ASC" : "DESC";
  const orderOverride = sortExpr ? (sortExpr + " " + sortDir) : null;
  const groupLimit = (() => { const n = parseInt(url.searchParams.get("groupLimit") || url.searchParams.get("topn") || "", 10); return (Number.isFinite(n) && n > 0) ? Math.min(n, 1000) : 500; })();
  const groupRaw = (url.searchParams.get("group") || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
  // CROSS-TABLE group — a token `fkcol.parentcol` groups by a column on the table that fk
  // points to (e.g. group opportunities by `account_id.industry` → pipeline by account
  // industry). One cross dimension supported; the base filter (incl. owner scoping) is
  // isolated in a subquery so the JOIN can never make a base column ambiguous.
  const crossTok = groupRaw.find((g) => g.includes("."));
  if (crossTok && def && spec) {
    const [fk, pcol] = crossTok.split(".");
    const parent = def.refs && def.refs[fk];
    const pdef = parent ? tableDef(spec, parent) : null;
    const pcols = pdef ? new Set([].concat((pdef.columns || []).map((c) => String(c).toLowerCase()), ["id", "created_at", "slug"])) : null;
    if (pdef && pcols && pcols.has(pcol) && f.filterable.has(fk)) {
      const qsel = ["COUNT(*) AS _count"];
      for (const k of ["sum", "avg", "min", "max"]) for (const col of wanted[k]) qsel.push(k.toUpperCase() + "(" + aggExpr("t.", col) + ") AS " + k + "__" + col);
      const sql = "SELECT p." + sqlIdent(pcol) + " AS _g0, " + qsel.join(", ") + " FROM (SELECT * FROM " + tn + f.whereSql + ") t LEFT JOIN " + sqlIdent(parent) + " p ON t." + sqlIdent(fk) + " = p.id GROUP BY p." + sqlIdent(pcol) + havingSql + " ORDER BY " + (orderOverride || "_count DESC") + " LIMIT " + groupLimit;
      return { sql, params: f.params.slice().concat(havingParams), wanted, groupCols: [crossTok] };
    }
  }
  // TIME-BUCKET group — a token `datecol:granularity` (year|month|week|day|hour) buckets rows by
  // a truncated timestamp for a trend/time-series report ("revenue per month", "leads per week").
  // Ordered CHRONOLOGICALLY (bucket ASC) so it plots directly. The column must be filterable and
  // hold an ISO/SQLite datetime (created_at, updated_at, or a declared date column).
  const TIME_FMT = { year: "%Y", month: "%Y-%m", week: "%Y-W%W", day: "%Y-%m-%d", date: "%Y-%m-%d", hour: "%Y-%m-%d %H:00" };
  const timeTok = groupRaw.find((g) => { const p = g.split(":"); return p.length === 2 && TIME_FMT[p[1]] && f.filterable.has(p[0]); });
  if (timeTok) {
    const [tcol, gran] = timeTok.split(":");
    const tsel = ["COUNT(*) AS _count"];
    for (const k of ["sum", "avg", "min", "max"]) for (const col of wanted[k]) tsel.push(k.toUpperCase() + "(" + aggExpr("", col) + ") AS " + k + "__" + col);
    const bucket = "strftime('" + TIME_FMT[gran] + "', " + sqlIdent(tcol) + ")";
    const sql = "SELECT " + bucket + " AS _g0, " + tsel.join(", ") + " FROM " + tn + f.whereSql + " GROUP BY _g0" + havingSql + " ORDER BY " + (orderOverride || "_g0 ASC") + " LIMIT " + groupLimit;
    return { sql, params: f.params.slice().concat(havingParams), wanted, groupCols: [timeTok] };
  }
  const selects = ["COUNT(*) AS _count"];
  for (const k of ["sum", "avg", "min", "max"]) for (const col of wanted[k]) selects.push(k.toUpperCase() + "(" + aggExpr("", col) + ") AS " + k + "__" + col);
  // GROUP BY one OR MORE base columns (comma-separated) → multi-dimensional "matrix" reports
  // ("pipeline by stage AND by rep"). Up to 4 dimensions; each must be a filterable column.
  const groupCols = groupRaw.filter((c) => f.filterable.has(c)).slice(0, 4);
  let sql, outParams = f.params.slice();
  if (groupCols.length) {
    const gsel = groupCols.map((c, i) => sqlIdent(c) + " AS _g" + i).join(", ");
    const gby = groupCols.map((c) => sqlIdent(c)).join(", ");
    sql = "SELECT " + gsel + ", " + selects.join(", ") + " FROM " + tn + f.whereSql + " GROUP BY " + gby + havingSql + " ORDER BY " + (orderOverride || "_count DESC") + " LIMIT " + groupLimit;
    outParams = f.params.slice().concat(havingParams);
  } else {
    sql = "SELECT " + selects.join(", ") + " FROM " + tn + f.whereSql; // HAVING/top-N need a GROUP BY — ignored on an ungrouped total
  }
  return { sql, params: outParams, wanted, groupCols };
}
// Relations: for a set of rows, `?expand=<fk_col>[,<fk_col>]` attaches each row's
// referenced parent (declared via a column `ref`). Batched (one SELECT … WHERE id IN
// per column, no N+1). SAFETY: a parent is only joined when the referenced table is
// PUBLIC-READ (display/feed/admin) — never a `user`/`collect` table, so expand can't
// leak private rows. Attached under the fk name minus a trailing `_id` (post_id →
// `post`), else `<col>_ref`. Mutates + returns rows.
async function expandRows(env, uuid, spec, def, rows, url) {
  const want = String(url.searchParams.get("expand") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 4);
  if (!want.length || !rows.length) return rows;
  const refs = (def && def.refs) || {};
  for (const col of want) {
    const refTable = refs[col];
    if (!refTable) continue;
    const rdef = tableDef(spec, refTable);
    if (!rdef) continue;
    if (!["display", "feed", "admin"].includes(rdef.access || "collect")) continue; // public-read only
    const ids = [...new Set(rows.map((r) => r[col]).filter((v) => v != null))].slice(0, 200);
    if (!ids.length) continue;
    let parents = [];
    try { parents = await cfD1Query(env, uuid, "SELECT * FROM " + sqlIdent(refTable) + " WHERE id IN (" + ids.map(() => "?").join(",") + ")", ids); } catch { continue; }
    const byId = new Map(parents.map((p) => [p.id, p]));
    const key = /_id$/i.test(col) ? col.replace(/_id$/i, "") : col + "_ref";
    for (const r of rows) r[key] = byId.get(r[col]) || null;
  }
  return rows;
}
// Reverse relations: `?children=<child_table>[,<child_table>]` attaches each parent
// row's children — the rows in <child_table> whose declared `ref` points back at THIS
// table. Batched (one SELECT … WHERE fk IN (parentIds) per child table, grouped in
// memory — no N+1), capped 500 total / 50 per parent. SAFETY: only PUBLIC-READ child
// tables (display/feed/admin) are joined, never a `user`/`collect` table. Attached
// under the child table's name (post.comments = [...]). Mutates + returns rows.
async function expandChildren(env, uuid, spec, def, rows, url) {
  const want = String(url.searchParams.get("children") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 3);
  if (!want.length || !rows.length) return rows;
  const parentIds = [...new Set(rows.map((r) => r.id).filter((v) => v != null))].slice(0, 200);
  if (!parentIds.length) return rows;
  const thisName = String(def.name).toLowerCase();
  for (const childName of want) {
    const cdef = tableDef(spec, childName);
    if (!cdef) continue;
    if (!["display", "feed", "admin"].includes(cdef.access || "collect")) continue; // don't leak private children
    const crefs = cdef.refs || {};
    const fkCol = Object.keys(crefs).find((c) => String(crefs[c]).toLowerCase() === thisName);
    if (!fkCol) continue; // this child doesn't reference us
    let kids = [];
    try { kids = await cfD1Query(env, uuid, "SELECT * FROM " + sqlIdent(childName) + " WHERE " + sqlIdent(fkCol) + " IN (" + parentIds.map(() => "?").join(",") + ") ORDER BY id DESC LIMIT 500", parentIds); } catch { continue; }
    const grouped = new Map();
    for (const k of kids) { const pid = k[fkCol]; if (!grouped.has(pid)) grouped.set(pid, []); const arr = grouped.get(pid); if (arr.length < 50) arr.push(k); }
    for (const r of rows) r[childName] = grouped.get(r.id) || [];
  }
  return rows;
}
// `?authors=1` — attach each row's AUTHOR public profile under `row.author`
// ({id, display_name, avatar_url}), keyed off the row's `owner_id` (stamped on
// user/feed/admin writes). Batched (one SELECT over distinct owner_ids), safe
// columns only. Lets a feed show who posted without copying an author name into
// every row. No-op when rows have no owner_id (display/collect tables).
async function attachAuthors(env, uuid, rows, url) {
  if (url.searchParams.get("authors") !== "1" || !rows.length) return rows;
  const ids = [...new Set(rows.map((r) => r.owner_id).filter((v) => v != null))].slice(0, 200);
  if (!ids.length) return rows;
  let authors = [];
  try { authors = await cfD1Query(env, uuid, "SELECT id,display_name,avatar_url FROM _users WHERE id IN (" + ids.map(() => "?").join(",") + ")", ids); } catch { return rows; }
  const byId = new Map(authors.map((a) => [a.id, a]));
  for (const r of rows) if (r.owner_id != null) r.author = byId.get(r.owner_id) || null;
  return rows;
}
// `?count=<child>[,<child>]` — attach how many rows each child table has pointing back
// at THIS row, WITHOUT fetching them, under `row._counts` ({comments: 12}). A feed shows
// "12 comments" in one list request. Batched (one grouped COUNT per child, no N+1), only
// PUBLIC-READ child tables (never leaks private counts), trash-aware. Peer of ?children.
async function attachCounts(env, uuid, spec, def, rows, url) {
  const want = String(url.searchParams.get("count") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 4);
  if (!want.length || !rows.length) return rows;
  const parentIds = [...new Set(rows.map((r) => r.id).filter((v) => v != null))].slice(0, 200);
  if (!parentIds.length) return rows;
  const thisName = String(def.name).toLowerCase();
  for (const childName of want) {
    const cdef = tableDef(spec, childName);
    if (!cdef) continue;
    if (!["display", "feed", "admin"].includes(cdef.access || "collect")) continue; // don't leak private counts
    const crefs = cdef.refs || {};
    const fkCol = Object.keys(crefs).find((c) => String(crefs[c]).toLowerCase() === thisName);
    if (!fkCol) continue; // this child doesn't reference us
    let counts = [];
    try { counts = await cfD1Query(env, uuid, "SELECT " + sqlIdent(fkCol) + " AS pid, COUNT(*) AS n FROM " + sqlIdent(childName) + " WHERE " + sqlIdent(fkCol) + " IN (" + parentIds.map(() => "?").join(",") + ")" + (cdef.trash ? " AND deleted_at IS NULL" : "") + " GROUP BY " + sqlIdent(fkCol), parentIds); } catch { continue; }
    const byPid = new Map(counts.map((c) => [c.pid, Number(c.n) || 0]));
    for (const r of rows) { if (!r._counts) r._counts = {}; r._counts[childName] = byPid.get(r.id) || 0; }
  }
  return rows;
}
// `?rollup=<child>:<agg>:<col>` (comma-list) — aggregate a child column up onto each parent
// row WITHOUT fetching the children: order total (`line_items:sum:amount`), average rating
// (`reviews:avg:rating`), highest bid, etc. `agg` ∈ sum/avg/min/max/count. Attaches
// `row._rollups.<child>.<agg>.<col>` (count → `row._rollups.<child>.count`). Batched grouped
// aggregate per spec (no N+1), public-read children only, trash-aware. Peer of ?count.
async function attachRollups(env, uuid, spec, def, rows, url) {
  const specs = String(url.searchParams.get("rollup") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6);
  if (!specs.length || !rows.length) return rows;
  const parentIds = [...new Set(rows.map((r) => r.id).filter((v) => v != null))].slice(0, 200);
  if (!parentIds.length) return rows;
  const thisName = String(def.name).toLowerCase();
  const AGG = { sum: "SUM", avg: "AVG", min: "MIN", max: "MAX", count: "COUNT" };
  for (const one of specs) {
    const parts = one.toLowerCase().split(":");
    const childName = parts[0], aggName = parts[1], colName = parts[2];
    const agg = AGG[aggName]; if (!agg) continue;
    const cdef = tableDef(spec, childName); if (!cdef) continue;
    if (!["display", "feed", "admin"].includes(cdef.access || "collect")) continue; // don't leak private children
    const crefs = cdef.refs || {};
    const fkCol = Object.keys(crefs).find((c) => String(crefs[c]).toLowerCase() === thisName);
    if (!fkCol) continue;
    let col = colName;
    if (agg === "COUNT") col = "*";
    else { const cols = new Set((cdef.columns || []).map((x) => String(x).toLowerCase())); if (!cols.has(col)) continue; }
    const expr = agg + "(" + (col === "*" ? "*" : sqlIdent(col)) + ")";
    let out = [];
    try { out = await cfD1Query(env, uuid, "SELECT " + sqlIdent(fkCol) + " AS pid, " + expr + " AS v FROM " + sqlIdent(childName) + " WHERE " + sqlIdent(fkCol) + " IN (" + parentIds.map(() => "?").join(",") + ")" + (cdef.trash ? " AND deleted_at IS NULL" : "") + " GROUP BY " + sqlIdent(fkCol), parentIds); } catch { continue; }
    const byPid = new Map(out.map((o) => [o.pid, o.v]));
    for (const r of rows) {
      if (!r._rollups) r._rollups = {};
      if (!r._rollups[childName]) r._rollups[childName] = {};
      if (agg === "COUNT") { r._rollups[childName].count = Number(byPid.get(r.id)) || 0; }
      else { if (!r._rollups[childName][aggName]) r._rollups[childName][aggName] = {}; r._rollups[childName][aggName][col] = byPid.has(r.id) ? byPid.get(r.id) : null; }
    }
  }
  return rows;
}
// `?fields=a,b` — sparse field selection: return only the named columns (plus id, always,
// which clients need for keys/links), trimming payload on big lists. Applied LAST, after
// all joins, so opt-in attached objects (author, children, _counts, expanded refs,
// reactions, tags) are always kept — the projection only controls the row's OWN columns.
// Unknown/undeclared field names are ignored. No-op when the param is absent.
// Field-level security — remove columns the caller's role isn't allowed to see from read
// rows. `def.fieldRoles` maps a column → the roles permitted to read it; an `admin` is a
// superuser and always sees everything; everyone else (incl. `public` = signed-out) has
// disallowed columns deleted. Runs before ?fields projection.
function stripFieldRoles(def, rows, role) {
  const fr = def && def.fieldRoles;
  if (!fr || !Array.isArray(rows) || !rows.length) return rows;
  const r = String(role || "public").toLowerCase();
  if (r === "admin") return rows; // superuser sees all
  const hide = [];
  for (const [col, roles] of Object.entries(fr)) { if (!(Array.isArray(roles) ? roles : []).map((x) => String(x).toLowerCase()).includes(r)) hide.push(col); }
  if (!hide.length) return rows;
  for (const row of rows) { if (!row) continue; for (const h of hide) delete row[h]; }
  return rows;
}
function projectFields(rows, url, allow) {
  const raw = url.searchParams.get("fields");
  if (!raw || !rows.length) return rows;
  const allowSet = new Set((allow || []).map((c) => String(c).toLowerCase()));
  const selectable = new Set(["id", "owner_id", "created_at", "updated_at", "slug", ...allowSet]);
  const baseCols = new Set(["id", "owner_id", "created_at", "updated_at", "deleted_at", "_version", "slug", ...allowSet]);
  const keep = new Set(raw.toLowerCase().split(",").map((s) => s.trim()).filter((c) => selectable.has(c)));
  keep.add("id"); // id is always retained
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]; const out = {};
    for (const k of Object.keys(row)) {
      const lk = k.toLowerCase();
      if (!baseCols.has(lk)) { out[k] = row[k]; continue; } // an attached join key → always keep
      if (keep.has(lk)) out[k] = row[k];
    }
    rows[i] = out;
  }
  return rows;
}
// Create-or-update by a key column (`?upsert=<col>`): find an existing row whose
// <col> matches (within the owner scope when given), UPDATE it, else INSERT. Powers
// settings singletons, likes/toggles, idempotent saves. No DB-level UNIQUE is required
// (small race window under truly-concurrent writes, fine at app scale). Returns
// {created}. `owner` scopes the match/insert to one user (user/feed tables).
async function upsertRow(env, uuid, tn, allow, col, body, owner, def) {
  const use = allow.filter((c) => body[c] !== undefined);
  const where = [sqlIdent(col) + "=?"], wparams = [body[col]];
  if (owner != null) { where.push('"owner_id"=?'); wparams.push(owner); }
  const found = await cfD1Query(env, uuid, "SELECT id FROM " + tn + " WHERE " + where.join(" AND ") + " LIMIT 1", wparams);
  if (found[0]) {
    const setCols = use.filter((c) => c !== col);
    if (setCols.length) await cfD1Query(env, uuid, "UPDATE " + tn + " SET " + setCols.map((c) => sqlIdent(c) + "=?").join(",") + " WHERE id=?", setCols.map((c) => body[c]).concat([found[0].id]));
    return { id: found[0].id, created: false };
  }
  // Creating a new row → generate its slug (skips the update branch above, so edits don't re-slug).
  if (def && def.slug && def.slug.from && await maybeSlug(env, uuid, def, tn, body) && !use.includes("slug")) use.push("slug");
  if (def && def.sequence && await maybeSequence(env, uuid, def, tn, body) && !use.includes(def.sequence.field)) use.push(def.sequence.field);
  const cols = owner != null ? use.concat(["owner_id"]) : use;
  const vals = owner != null ? use.map((c) => body[c]).concat([owner]) : use.map((c) => body[c]);
  await cfD1Query(env, uuid, "INSERT INTO " + tn + " (" + cols.map(sqlIdent).join(",") + ") VALUES (" + cols.map(() => "?").join(",") + ")", vals);
  return { created: true };
}
// Server-side validation of a write against the table's declared rules. On INSERT,
// required columns must be present + non-empty; on UPDATE only supplied fields are
// checked (partial update). Enforces max length + basic email/url/number format, plus
// a hard 100k-char cap on ANY field (abuse guard). Returns an error string or null.
function validateRow(def, body, isInsert) {
  const rules = (def && def.rules) || {};
  for (const c of Object.keys(body || {})) {
    const v = body[c];
    if (typeof v === "string" && v.length > 100000) return c + " is too long";
  }
  for (const [col, rule] of Object.entries(rules)) {
    const v = body ? body[col] : undefined;
    const present = v !== undefined && v !== null && !(typeof v === "string" && v.trim() === "");
    if (rule.required && isInsert && !present) return col + " is required";
    // Write-once / immutable: settable on insert, but any UPDATE that carries the field
    // is rejected (a client trying to change a locked value — an email, a created price).
    if (rule.immutable && !isInsert && v !== undefined) return col + " can't be changed";
    if (!present) continue;
    if (rule.max && typeof v === "string" && v.length > rule.max) return col + " is too long (max " + rule.max + ")";
    if (rule.minLen && typeof v === "string" && v.length < rule.minLen) return col + " is too short (min " + rule.minLen + ")";
    if (rule.format === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v))) return col + " must be a valid email";
    if (rule.format === "url" && !/^https?:\/\/[^\s]+$/i.test(String(v))) return col + " must be a valid URL";
    if (rule.format === "number" && isNaN(Number(v))) return col + " must be a number";
    if ((rule.numMin !== undefined || rule.numMax !== undefined)) { const n = Number(v); if (isNaN(n)) return col + " must be a number"; if (rule.numMin !== undefined && n < rule.numMin) return col + " must be at least " + rule.numMin; if (rule.numMax !== undefined && n > rule.numMax) return col + " must be at most " + rule.numMax; }
    if (Array.isArray(rule.enum) && !rule.enum.includes(String(v))) return col + " must be one of: " + rule.enum.join(", ");
    if (rule.pattern) { try { if (!new RegExp(rule.pattern).test(String(v))) return col + " has an invalid format"; } catch {} }
  }
  // Cross-field checks (`checks:[["end","gte","start"]]`) — compare two fields on a write
  // (end after start, max ≥ min, price ≥ cost). Numeric when both parse as numbers, else a
  // string/ISO-date compare. Enforced when BOTH fields are present in the body (always on a
  // full insert; on a partial update only if the write carries both).
  const SYM = { gt: ">", gte: "≥", lt: "<", lte: "≤", eq: "=", ne: "≠" };
  for (const ch of (Array.isArray(def && def.checks) ? def.checks : [])) {
    const a = ch[0], op = ch[1], b = ch[2];
    const va = body ? body[a] : undefined, vb = body ? body[b] : undefined;
    if (va === undefined || vb === undefined || va === null || vb === null) continue;
    const na = Number(va), nb = Number(vb);
    const bothNum = !isNaN(na) && !isNaN(nb) && String(va).trim() !== "" && String(vb).trim() !== "";
    const x = bothNum ? na : String(va), y = bothNum ? nb : String(vb);
    const ok = op === "gt" ? x > y : op === "gte" ? x >= y : op === "lt" ? x < y : op === "lte" ? x <= y : op === "eq" ? x === y : x !== y;
    if (!ok) return a + " must be " + SYM[op] + " " + b;
  }
  return null;
}
// Write-authorization for an `admin`-access table (public read, role-gated write). By
// default only the built-in `admin` role may write, but a table can declare
// `writeRoles:["editor","admin"]` (RBAC) to let other custom roles write too — the
// `admin` role is ALWAYS allowed (superuser). Returns true if this user may write.
// Optimistic concurrency: on a table declared `version:true`, every row carries a
// `_version` that bumps on each single-row PATCH. A client that read version N can send
// `?ifVersion=N` (or an `If-Match: N` header) so its update only lands if nobody else
// changed the row meanwhile — otherwise a 409 conflict, no silent lost update. Returns
// the SQL fragments to splice into the UPDATE plus the requested version (if any).
function versionBits(def, url, request) {
  if (!def || !def.version) return { on: false, setFrag: "", guardSql: "", guardParams: [], want: null };
  const raw = url.searchParams.get("ifVersion") || url.searchParams.get("ifversion") || ((request.headers.get("If-Match") || "").replace(/[^0-9]/g, ""));
  const want = parseInt(raw, 10);
  const hasWant = Number.isFinite(want) && want > 0;
  return { on: true, setFrag: ', "_version"="_version"+1', guardSql: hasWant ? ' AND "_version"=?' : "", guardParams: hasWant ? [want] : [], want: hasWant ? want : null };
}
async function siteRoleAllows(env, uuid, userId, def) {
  if (!userId) return false;
  const rr = await cfD1Query(env, uuid, "SELECT role FROM _users WHERE id=?", [userId]);
  const role = rr[0] && rr[0].role;
  if (!role) return false;
  if (role === "admin") return true;
  const wr = def && Array.isArray(def.writeRoles) ? def.writeRoles.map(String) : null;
  return wr ? wr.includes(String(role)) : false;
}
// Batch insert — POST `{rows:[…]}` writes many rows in ONE statement (import a CSV,
// seed a list, bulk actions). Uses the union of declared columns present across the
// batch (missing cells → NULL); `owner` stamps every row (user/feed). Cap 100/call.
async function insertMany(env, uuid, tn, allow, rowsArr, owner, def) {
  const rows = (Array.isArray(rowsArr) ? rowsArr : []).slice(0, 100).filter((r) => r && typeof r === "object").map((r) => jsonizeRow(def, r));
  if (!rows.length) return { inserted: 0 };
  // Auto-slug each row (a shared `seen` set dedupes slugs WITHIN this batch, since the
  // uniqueness query can't see rows not yet inserted). Must run before `cols` is derived.
  if (def && def.slug && def.slug.from) { const seen = new Set(); for (const r of rows) await maybeSlug(env, uuid, def, tn, r, seen); }
  // Auto-number each row in the batch (the field isn't in `allow`, so add it to the column set).
  if (def && def.sequence) { for (const r of rows) await maybeSequence(env, uuid, def, tn, r); }
  const cols = allow.filter((c) => rows.some((r) => r[c] !== undefined));
  if (def && def.sequence && rows.some((r) => r[def.sequence.field] !== undefined) && !cols.includes(def.sequence.field)) cols.push(def.sequence.field);
  if (!cols.length && owner == null) return { inserted: 0 };
  const outCols = owner != null ? cols.concat(["owner_id"]) : cols;
  const placeholders = [], params = [];
  for (const r of rows) {
    placeholders.push("(" + outCols.map(() => "?").join(",") + ")");
    for (const c of cols) params.push(r[c] === undefined ? null : r[c]);
    if (owner != null) params.push(owner);
  }
  await cfD1Query(env, uuid, "INSERT INTO " + tn + " (" + outCols.map(sqlIdent).join(",") + ") VALUES " + placeholders.join(","), params);
  return { inserted: rows.length };
}
// Shape one aggregate result row into { count, sum:{col:v}, avg:{…}, … } (only
// requested aggregate families are present).
function shapeD1Stats(row, wanted) {
  const out = { count: Number((row && row._count) || 0) };
  for (const k of ["sum", "avg", "min", "max"]) {
    if (!wanted[k].length) continue;
    out[k] = {};
    for (const col of wanted[k]) out[k][col] = row ? row[k + "__" + col] : null;
  }
  return out;
}

// ---- Phase C: built-site auth (each site's OWN visitor login) -----------------
// Visitors of a built site log into THAT site — their accounts live in the site's
// own D1 (_users), passwords hashed with WebCrypto PBKDF2, and session tokens are
// HMAC-signed with a secret that is generated once and stored IN THE SITE'S OWN
// database (_meta.auth_secret). So a token for site A can't be forged for site B,
// and no platform-wide secret gates it. These endpoints are PUBLIC (the visitors
// aren't isibi users) but strictly scoped by slug → the site's own database.
const _sbEnc = new TextEncoder();
const PBKDF2_ITER = 100000; // Cloudflare Workers caps PBKDF2 at 100k iterations
function _b64(bytes) { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function _unb64(str) { const bin = atob(str); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function _b64url(s) { return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
async function _pbkdf2(password, saltBytes) {
  const km = await crypto.subtle.importKey("raw", _sbEnc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITER, hash: "SHA-256" }, km, 256);
  return new Uint8Array(bits);
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await _pbkdf2(password, salt);
  return { salt: _b64(salt), hash: _b64(hash) };
}
async function verifyPassword(password, saltB64, hashB64) {
  const hash = await _pbkdf2(password, _unb64(saltB64));
  const want = _unb64(hashB64);
  if (hash.length !== want.length) return false;
  let diff = 0; for (let i = 0; i < hash.length; i++) diff |= hash[i] ^ want[i];
  return diff === 0; // constant-time compare
}
async function _hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", _sbEnc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, _sbEnc.encode(msg));
  return _b64(new Uint8Array(sig));
}
// TOTP (RFC 6238) for two-factor auth — standard authenticator-app codes (Google
// Authenticator, Authy, 1Password). Secret is base32; codes are 6 digits over a 30s step.
const _B32_ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Encode(bytes) {
  let bits = 0, val = 0, out = "";
  for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += _B32_ALPH[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += _B32_ALPH[(val << (5 - bits)) & 31];
  return out;
}
function base32Decode(s) {
  const clean = String(s || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, val = 0; const out = [];
  for (const ch of clean) { const idx = _B32_ALPH.indexOf(ch); if (idx < 0) continue; val = (val << 5) | idx; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; } }
  return new Uint8Array(out);
}
async function _totpAt(keyBytes, counter) {
  const buf = new Uint8Array(8); let c = counter;
  for (let i = 7; i >= 0; i--) { buf[i] = c & 0xff; c = Math.floor(c / 256); }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
  const off = sig[sig.length - 1] & 0x0f;
  const bin = ((sig[off] & 0x7f) << 24) | (sig[off + 1] << 16) | (sig[off + 2] << 8) | sig[off + 3];
  return String(bin % 1000000).padStart(6, "0");
}
async function totpVerify(secretB32, code, window = 1) {
  const c = String(code || "").replace(/\D/g, "");
  if (c.length !== 6) return false;
  const key = base32Decode(secretB32);
  if (!key.length) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) { if (await _totpAt(key, step + i) === c) return true; }
  return false;
}
function newTotpSecret() { return base32Encode(crypto.getRandomValues(new Uint8Array(20))); }
async function signSiteUserToken(secret, payload) {
  const body = _b64url(btoa(JSON.stringify(payload)));
  return body + "." + _b64url(await _hmac(secret, body));
}
async function verifySiteUserToken(secret, token) {
  if (typeof token !== "string" || token.indexOf(".") < 0) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || sig !== _b64url(await _hmac(secret, body))) return null;
  let p; try { p = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/"))); } catch { return null; }
  if (!p || (p.exp && Math.floor(Date.now() / 1000) > p.exp)) return null;
  return p;
}
// Newer _users columns (roles, email verification) added after some sites were
// created. ALTER them in once per site per warm isolate (the Set caches it, so this
// is not paid on every auth call); each ALTER is idempotent-by-catch. NEW sites get
// the columns from the CREATE below, so the ALTERs just no-op for them.
const _authExtrasDone = new Set();
async function ensureAuthExtras(env, uuid) {
  if (_authExtrasDone.has(uuid)) return;
  for (const sql of [
    "ALTER TABLE _users ADD COLUMN role TEXT DEFAULT 'user'",
    "ALTER TABLE _users ADD COLUMN verified INTEGER DEFAULT 0",
    "ALTER TABLE _users ADD COLUMN verify_token TEXT",
    "ALTER TABLE _users ADD COLUMN verify_exp INTEGER",
    "ALTER TABLE _users ADD COLUMN display_name TEXT",
    "ALTER TABLE _users ADD COLUMN avatar_url TEXT",
    "ALTER TABLE _users ADD COLUMN bio TEXT",
    "ALTER TABLE _users ADD COLUMN blocked INTEGER DEFAULT 0",
    "ALTER TABLE _users ADD COLUMN totp_secret TEXT",
    "ALTER TABLE _users ADD COLUMN totp_enabled INTEGER DEFAULT 0",
    "ALTER TABLE _users ADD COLUMN token_epoch INTEGER DEFAULT 0",
    "ALTER TABLE _users ADD COLUMN manager_id INTEGER", // team/hierarchy: this member reports to <manager_id> (for teamRead visibility)
  ]) { try { await cfD1Query(env, uuid, sql); } catch {} }
  _authExtrasDone.add(uuid);
}
// Ensure a site's D1 has the _users + _meta tables and a per-site signing secret.
async function initSiteAuth(env, uuid) {
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, pass_salt TEXT NOT NULL, pass_hash TEXT NOT NULL, failed INTEGER DEFAULT 0, locked_until INTEGER, role TEXT DEFAULT 'user', verified INTEGER DEFAULT 0, verify_token TEXT, verify_exp INTEGER, created_at TEXT DEFAULT (datetime('now')))");
  await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _meta (k TEXT PRIMARY KEY, v TEXT)");
  await ensureAuthExtras(env, uuid);
  const rows = await cfD1Query(env, uuid, "SELECT v FROM _meta WHERE k='auth_secret'");
  if (rows[0] && rows[0].v) return rows[0].v;
  const secret = _b64(crypto.getRandomValues(new Uint8Array(32)));
  await cfD1Query(env, uuid, "INSERT OR IGNORE INTO _meta (k,v) VALUES ('auth_secret', ?)", [secret]);
  const r2 = await cfD1Query(env, uuid, "SELECT v FROM _meta WHERE k='auth_secret'");
  return (r2[0] && r2[0].v) || secret;
}
// Email a built-site visitor a signed 24h "verify your email" link (→ /verify). Sent
// through the platform mailer; fire-and-forget so signup/login never block on it. The
// mailer no-ops until GO_FARTHER_API_KEY is set as a Worker secret (same as reset).
async function sendVerifyEmail(env, ctx, secret, slug, uid, email) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const token = await signSiteUserToken(secret, { sub: uid, slug, email, purpose: "verify", iat: now, exp: now + 60 * 60 * 24 });
    const link = "https://isibi.ai/verify?slug=" + encodeURIComponent(slug) + "&token=" + encodeURIComponent(token);
    const html = "<p>Thanks for signing up! Please confirm your email address to finish setting up your account:</p>" +
      "<p><a href=\"" + link + "\">Verify my email</a></p>" +
      "<p>This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.</p>";
    const send = sendPlatformEmail(env, email, "Verify your email", html);
    if (ctx && ctx.waitUntil) ctx.waitUntil(send); else { try { await send; } catch {} }
  } catch (e) { console.error("verify email failed:", e && e.message); }
}
// Look up a site's D1 UUID by slug (public, no owner check — used by visitor auth).
async function siteBackendBySlug(env, slug) {
  const g = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(slug)}&select=d1_uuid`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
  });
  const rows = await g.json().catch(() => []);
  return (Array.isArray(rows) && rows[0] && rows[0].d1_uuid) || null;
}
// Content-type for a served R2 object by its extension (React dist assets + pages).
const R2_MIME = { js: "text/javascript", mjs: "text/javascript", css: "text/css", svg: "image/svg+xml", json: "application/json", map: "application/json", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", txt: "text/plain", xml: "application/xml", webmanifest: "application/manifest+json", html: "text/html; charset=utf-8" };
// Keep the last few PUBLISHED builds so a bad deploy can be rolled back: each publish
// snapshots its whole dist as one JSON (builds/<slug>/<ts>.json); keep the newest 5,
// prune older. Best-effort — never blocks a publish.
async function archiveBuild(env, slug, dist) {
  try {
    const now = new Date();
    await env.SITES_BUCKET.put("builds/" + slug + "/" + now.toISOString().replace(/[:.]/g, "-") + ".json", JSON.stringify({ createdAt: now.toISOString(), dist }), { httpMetadata: { contentType: "application/json" } });
    const l = await env.SITES_BUCKET.list({ prefix: "builds/" + slug + "/" });
    const keys = (l.objects || []).map((o) => o.key).sort(); // ascending by ts
    while (keys.length > 5) { const k = keys.shift(); try { await env.SITES_BUCKET.delete(k); } catch {} }
  } catch (e) { console.error("archiveBuild failed:", e && e.message); }
}
// Write a dist map (rel → {t:text}|{b:base64}) to sites/<slug>/, wiping stale objects
// first. Used by rollback (mirrors the inline publish in build/revise).
async function writeDistToR2(env, slug, dist) {
  try { const old = await env.SITES_BUCKET.list({ prefix: "sites/" + slug + "/" }); for (const o of (old.objects || [])) await env.SITES_BUCKET.delete(o.key); } catch {}
  for (const [rel, v] of Object.entries(dist || {})) {
    const safeRel = String(rel).replace(/[^a-z0-9/._-]/gi, "-");
    const ext = (safeRel.match(/\.([a-z0-9]{1,8})$/i) || [])[1] || "";
    const ct = R2_MIME[ext.toLowerCase()] || "application/octet-stream";
    let bodyOut;
    if (v && typeof v.t === "string") bodyOut = v.t;
    else if (v && typeof v.b === "string") { const bin = atob(v.b); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); bodyOut = u8; }
    else continue;
    await env.SITES_BUCKET.put("sites/" + slug + "/" + safeRel, bodyOut, { httpMetadata: { contentType: ct } });
  }
}

// Cheap, high-precision defect scan on a generated page — no JS execution, so it
// only flags things we're SURE are wrong: a truncated document, leftover lorem,
// nav links to pages that don't exist, and hotlinked external images (which the
// published-site CSP will block). Returns a list of plain-English problems; an
// empty list means "ship it, no fix pass" (so clean generations cost nothing extra).
function validateSiteHtml(html, knownPaths) {
  const issues = [];
  const h = String(html || "");
  if (!/<html[\s>]/i.test(h) || !/<\/html>/i.test(h) || !/<body[\s>]/i.test(h) || !/<\/body>/i.test(h)) {
    issues.push("The document is incomplete/truncated — it must be a full <!doctype html><html>…</html> with a complete <body>…</body>.");
  }
  if (/lorem ipsum/i.test(h)) issues.push("Remove ALL 'lorem ipsum' placeholder text and write real, specific, on-brand copy.");
  const badImgs = [];
  h.replace(/<img\b[^>]*?\bsrc\s*=\s*"([^"]+)"[^>]*>/gi, (m, src) => {
    if (/^https?:\/\//i.test(src) && !/^https:\/\/([a-z0-9-]+\.)?supabase\.co\//i.test(src) && !/^https:\/\/isibi\.ai\//i.test(src)) badImgs.push(src.slice(0, 90));
    return m;
  });
  if (badImgs.length) issues.push("These <img> tags hotlink external image URLs, which are BLOCKED on the live site — replace each with a data-gen placeholder <img data-gen=\"<on-subject art-directed prompt>\" data-ar=\"...\" alt=\"...\"> (NO src): " + badImgs.slice(0, 4).join(" | "));
  if (Array.isArray(knownPaths) && knownPaths.length) {
    const dead = new Set();
    h.replace(/<a\b[^>]*?\bhref\s*=\s*"(\/[^"#?]*)"/gi, (m, href) => {
      const p = (href.replace(/\/+$/, "") || "/");
      if (!knownPaths.includes(p) && !knownPaths.includes(href)) dead.add(href);
      return m;
    });
    if (dead.size) issues.push("These nav/link hrefs point to pages that DON'T exist — link only to the site's real pages (" + knownPaths.join(", ") + "), or change them to in-page anchors: " + [...dead].slice(0, 6).join(", "));
  }
  return issues;
}
// One targeted repair pass: fix ONLY the listed defects, return the full corrected
// document, everything else identical. Used by build + revise after validation.
async function autoFixSiteHtml(html, issues, geminiCall, assetLine, extractHTML) {
  const fixed = extractHTML(await geminiCall(
    "You are fixing specific defects in ONE finished HTML page. Return the COMPLETE corrected single-file HTML document (<!doctype html>…</html>) — same design, layout, copy, and structure, changing ONLY what is needed to fix these problems, nothing else:\n- " + issues.join("\n- ") + "\nKeep the brand name/logo, fonts, palette, nav and footer exactly as they are. " + (assetLine || ""),
    "Current HTML:\n\n" + html, "low"
  ));
  return fixed || html;
}

// ── Shared-chrome composition (#3: one source of truth) ──────────────────────
// The plan emits the shared HEAD (fonts + :root tokens + all shared CSS), NAV,
// and FOOTER once, as real code. Each page then generates ONLY its unique <main>
// content, and we assemble the final document — so the header, footer, palette,
// and fonts are BYTE-IDENTICAL on every page (consistency by construction), and
// each page is cheaper to generate. Falls back to full-page mode if the plan
// doesn't produce a usable kit.
const escHtmlAttr = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Mark the current page's nav link active via aria-current="page" (the plan is
// told to style the active link off that attribute), so the nav HTML itself stays
// identical across pages — only the marker moves.
function markActiveNav(nav, path) {
  const want = path === "/" ? "/" : String(path || "/").replace(/\/+$/, "");
  let marked = false;
  return String(nav || "").replace(/<a\b([^>]*?)\shref="([^"]+)"([^>]*)>/gi, (m, pre, href, post) => {
    if (marked || /aria-current=/i.test(m)) return m;
    const h = href.replace(/\/+$/, "") || "/";
    if (h === want) { marked = true; return "<a" + pre + ' href="' + href + '"' + post + ' aria-current="page">'; }
    return m;
  });
}
// Reduce a page-model's output to just its main content, whether it returned a
// clean fragment or (defensively) a whole document. Drops any header/footer it
// duplicated, since the shared ones are added by the composer.
function stripToMain(out) {
  let f = String(out || "").trim().replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const bm = f.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bm) f = bm[1];                                   // model returned a full doc → keep body inner
  else { const di = f.search(/<!doctype html|<html[\s>]/i); if (di >= 0) { const he = f.toLowerCase().indexOf("<head"); f = he >= 0 ? f.slice(f.indexOf(">", he) + 1) : f.slice(di); } }
  f = f.replace(/^\s*<header\b[\s\S]*?<\/header>/i, "").replace(/<footer\b[\s\S]*?<\/footer>\s*$/i, "").trim();
  return f;
}
function composeSitePage(title, desc, headInner, nav, footer, main, path) {
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    "<title>" + escHtmlAttr(title) + "</title>\n" +
    '<meta name="description" content="' + escHtmlAttr(desc).slice(0, 300) + '">\n' +
    String(headInner || "") + "\n</head>\n<body>\n" +
    markActiveNav(nav, path) + "\n" + String(main || "") + "\n" + String(footer || "") +
    "\n</body>\n</html>";
}
// Guaranteed finishing touches injected into every page's <head> AFTER generation
// (so the model can't get them wrong): a brand-monogram favicon so the browser tab
// isn't blank, and Open-Graph/Twitter tags so a shared link previews as a real card.
// Only adds what's missing. og:image uses the page's first hosted image.
function polishHead(html, brand) {
  let h = String(html || "");
  const hm = h.match(/<head[^>]*>/i);
  if (!hm) return h;
  const at = hm.index + hm[0].length;
  let inject = "";
  if (!/<link[^>]+rel=["'][^"']*icon/i.test(h)) {
    const letter = (String(brand || "").trim()[0] || "•").toUpperCase();
    let bg = "#111319";
    const cm = h.match(/--[a-z0-9-]*(?:accent|primary|brand)[a-z0-9-]*\s*:\s*(#[0-9a-fA-F]{6})/) || h.match(/:root[^}]*?:\s*(#[0-9a-fA-F]{6})/);
    if (cm && cm[1] && !/^#[e-fE-F]/.test(cm[1])) bg = cm[1];   // use a token color unless it's near-white
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='" + bg + "'/><text x='16' y='22' font-family='Georgia,serif' font-size='18' font-weight='700' fill='#fff' text-anchor='middle'>" + escHtmlAttr(letter) + "</text></svg>";
    inject += '\n<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent(svg) + '">';
  }
  if (!/property=["']og:title/i.test(h)) {
    const title = ((h.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || String(brand || "")).trim();
    const desc = ((h.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)/i) || [])[1] || "").trim();
    const img = (h.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i) || [])[1] || "";
    inject += '\n<meta property="og:type" content="website">\n<meta property="og:title" content="' + escHtmlAttr(title) + '">';
    if (desc) inject += '\n<meta property="og:description" content="' + escHtmlAttr(desc) + '">';
    if (img) inject += '\n<meta property="og:image" content="' + escHtmlAttr(img) + '">';
    inject += '\n<meta name="twitter:card" content="' + (img ? "summary_large_image" : "summary") + '">';
  }
  return inject ? h.slice(0, at) + inject + h.slice(at) : h;
}

// Recover the shared chrome (head-inner + header/nav + footer) from an already-
// built composed page, so a NEW page can be generated onto the SAME shell and a
// page can be regenerated without re-planning the whole site. Strips the parts
// that are per-page (the <title>, description, og/twitter/favicon that polishHead
// re-adds, and the aria-current active marker markActiveNav re-applies), so the
// kit is byte-for-byte the neutral shared shell every page starts from. Returns
// null if the page doesn't look composed (no usable header/footer).
function extractSiteKit(html) {
  const h = String(html || "");
  const headM = h.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const navM = h.match(/<header\b[\s\S]*?<\/header>/i) || h.match(/<nav\b[\s\S]*?<\/nav>/i);
  const footM = h.match(/<footer\b[\s\S]*?<\/footer>/i);
  if (!headM || !navM || !footM) return null;
  let headInner = headM[1]
    .replace(/<meta[^>]+charset[^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']viewport["'][^>]*>/gi, "")
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta[^>]+name=["']description["'][^>]*>/gi, "")
    .replace(/<meta[^>]+property=["']og:[^"']*["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']twitter:[^"']*["'][^>]*>/gi, "")
    .replace(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/gi, "")
    .trim();
  // Drop the active marker so markActiveNav sets it fresh per page.
  const nav = navM[0].replace(/\s*aria-current=["'][^"']*["']/gi, "");
  return { headInner, nav, footer: footM[0] };
}

// A published multi-page site lives at isibi.ai/s/<slug>/…, so its internal nav
// links (href="/menu") must be prefixed to /s/<slug>/menu. Only rewrites <a>
// hrefs that exactly match one of the site's own page paths (anchors, external
// links, and images are untouched). On a custom domain the prefix is "" (root).
function rewriteSiteLinks(html, prefix, paths) {
  let out = String(html || "");
  for (const p of paths) {
    const target = prefix + (p === "/" ? "/" : p);
    if (target === p) continue;
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp('(<a\\b[^>]*\\shref=)(["\'])' + esc + '\\2', "gi"), "$1$2" + target + "$2");
  }
  return out;
}

async function handleRequest(request, env, ctx) {
    const url = new URL(request.url);

    // Old full-app snapshots (public/demo-hero*) are kept in the repo as
    // reference but must NOT be served — they're pre-scrub clones that name the
    // provider and run against the live backend (owner 2026-07-18: keep the
    // files, stop serving them). The `-2`/`-3` numbered variants MUST be covered
    // too — demo-hero-2 is a full-app clone that still names the provider. Only
    // /demo-hero*; the marketing /mkt/demo* cascade is a different path, stays live.
    if (/^\/demo-hero(-\d+)?(\/|$)/i.test(url.pathname)) {
      return new Response("Not found", { status: 404 });
    }

    // Platform-hosted password-reset page for built-site visitors. The reset email
    // links here (?slug=&token=); the built React app never needs its own /reset
    // route. Self-contained, no external resources; posts to the reset endpoint.
    if (url.pathname === "/reset" && request.method === "GET") {
      const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Reset your password</title><style>
        :root{--bg:#08070c;--panel:rgba(255,255,255,.04);--line:rgba(255,255,255,.12);--text:#edeaf3;--muted:rgba(237,234,243,.55);--split:linear-gradient(120deg,#ff79c6,#ffb84d)}
        *{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--text);font-family:'Space Grotesk',system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem}
        .card{width:min(420px,96vw);background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:2rem 1.8rem;box-shadow:0 30px 70px -20px rgba(0,0,0,.7)}
        h1{font-size:1.35rem;margin-bottom:.4rem}p.sub{color:var(--muted);font-size:.9rem;margin-bottom:1.4rem;line-height:1.5}
        label{display:block;font-size:.78rem;color:var(--muted);margin:.9rem 0 .35rem}
        input{width:100%;background:#0a0910;border:1px solid var(--line);border-radius:10px;padding:.7rem .8rem;color:var(--text);font-size:.95rem}
        input:focus{outline:none;border-color:#ff79c6}
        button{width:100%;margin-top:1.3rem;padding:.8rem;border:0;border-radius:10px;background:var(--split);color:#0b0a10;font-weight:700;font-size:.95rem;cursor:pointer}
        button:disabled{opacity:.6;cursor:default}
        .msg{margin-top:1rem;font-size:.86rem;line-height:1.5;display:none}.msg.err{color:#ff8a8a;display:block}.msg.ok{color:#8fe6b0;display:block}
        a.back{color:#ffb84d;text-decoration:none}
      </style></head><body><div class="card">
        <h1>Reset your password</h1>
        <p class="sub" id="sub">Choose a new password for your account.</p>
        <form id="f" autocomplete="off">
          <label for="p1">New password</label><input id="p1" type="password" minlength="8" required autocomplete="new-password" placeholder="At least 8 characters">
          <label for="p2">Confirm password</label><input id="p2" type="password" minlength="8" required autocomplete="new-password" placeholder="Type it again">
          <button id="btn" type="submit">Set new password</button>
        </form>
        <div class="msg" id="msg"></div>
      </div><script>
        (function(){
          var q=new URLSearchParams(location.search), slug=(q.get('slug')||'').replace(/[^a-z0-9-]/gi,''), token=q.get('token')||'';
          var f=document.getElementById('f'), msg=document.getElementById('msg'), btn=document.getElementById('btn'), sub=document.getElementById('sub');
          function show(t,cls){msg.textContent=t;msg.className='msg '+cls;}
          if(!slug||!token){f.style.display='none';sub.style.display='none';show('This reset link is invalid. Please request a new one from the app.','err');return;}
          f.addEventListener('submit',function(e){
            e.preventDefault();
            var p1=document.getElementById('p1').value, p2=document.getElementById('p2').value;
            if(p1.length<8){show('Password must be at least 8 characters.','err');return;}
            if(p1!==p2){show('Those passwords don\\u2019t match.','err');return;}
            btn.disabled=true;show('','');
            fetch('/api/db/'+slug+'/auth/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token,password:p1})})
              .then(function(r){return r.json().catch(function(){return {ok:false,error:'Something went wrong.'};});})
              .then(function(d){
                if(d&&d.ok){
                  try{localStorage.setItem('zephyr_site_auth_'+slug,d.token);}catch(_){}
                  f.style.display='none';
                  show('Your password has been reset. You can now sign in.  ','ok');
                  var a=document.createElement('a');a.className='back';a.href='/s/'+slug+'/';a.textContent='Go to the app \\u2192';msg.appendChild(a);
                }else{btn.disabled=false;show((d&&d.error)||'This reset link is invalid or has expired.','err');}
              }).catch(function(){btn.disabled=false;show('Couldn\\u2019t reach the server. Try again.','err');});
          });
        })();
      </script></body></html>`;
      return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
    // Email-verification landing: a built-site visitor clicks the link we emailed on
    // signup → we verify the signed token and flip their `verified` flag, then show a
    // small on-brand confirmation. Idempotent (clicking twice is fine).
    if (url.pathname === "/verify" && request.method === "GET") {
      const slug = (url.searchParams.get("slug") || "").replace(/[^a-z0-9-]/gi, "").slice(0, 60);
      const token = url.searchParams.get("token") || "";
      const card = (heading, body, ok, back) =>
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${heading}</title><style>
        :root{--bg:#08070c;--panel:rgba(255,255,255,.04);--line:rgba(255,255,255,.12);--text:#edeaf3;--muted:rgba(237,234,243,.55);--split:linear-gradient(120deg,#ff79c6,#ffb84d)}
        *{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--text);font-family:'Space Grotesk',system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem;text-align:center}
        .card{width:min(420px,96vw);background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:2.4rem 1.8rem;box-shadow:0 30px 70px -20px rgba(0,0,0,.7)}
        .badge{width:54px;height:54px;border-radius:50%;margin:0 auto 1.1rem;display:flex;align-items:center;justify-content:center;font-size:1.6rem;background:var(--split);color:#0b0a10}
        .badge.bad{background:rgba(255,138,138,.16);color:#ff8a8a}
        h1{font-size:1.35rem;margin-bottom:.5rem}p{color:var(--muted);font-size:.92rem;line-height:1.55}
        a.back{display:inline-block;margin-top:1.3rem;color:#ffb84d;text-decoration:none;font-weight:600}
      </style></head><body><div class="card"><div class="badge${ok ? "" : " bad"}">${ok ? "&#10003;" : "!"}</div><h1>${heading}</h1><p>${body}</p>${back ? `<a class="back" href="${back}">Go to the app &#8594;</a>` : ""}</div></body></html>`;
      const page = (h, b, ok, back) => new Response(card(h, b, ok, back), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
      if (!slug || !token || !env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return page("Invalid link", "This verification link is invalid. Try requesting a new one from the app.", false);
      try {
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return page("Invalid link", "This verification link is invalid or has expired.", false);
        const secret = await initSiteAuth(env, uuid);
        const p = await verifySiteUserToken(secret, token);
        if (!p || p.purpose !== "verify" || p.slug !== slug || !p.sub) return page("Link expired", "This verification link is invalid or has expired. Request a new one from the app.", false);
        await cfD1Query(env, uuid, "UPDATE _users SET verified=1, verify_token=NULL, verify_exp=NULL WHERE id=?", [p.sub]);
        return page("Email verified", "Your email is confirmed — you're all set. You can close this tab and head back to the app.", true, "/s/" + slug + "/");
      } catch (e) {
        console.error("verify failed:", e && e.message, e && e.detail);
        return page("Something went wrong", "We couldn't verify your email just now. Try the link again in a moment.", false);
      }
    }

    // Serve a PUBLISHED Website-Builder site from R2: isibi.ai/s/<slug>/<page>.
    // STATIC sites: each page is one HTML object (rest with no extension → .html).
    // REACT sites: the compiled dist — root/no-extension → index.html (HashRouter
    // handles the client routes), and a path WITH an extension (assets/x.js|css,
    // images, fonts) serves that exact object with its real content-type. Both
    // shapes coexist under sites/<slug>/… ; only the key/content-type differ.
    {
      const sm = url.pathname.match(/^\/s\/([a-z0-9][a-z0-9-]{0,80})(?:\/(.*))?$/i);
      if (sm && env.SITES_BUCKET) {
        const slug = sm[1].toLowerCase();
        const rest = (sm[2] || "").replace(/\/+$/, "");
        const last = rest.split("/").pop() || "";
        const ext = (last.match(/\.([a-z0-9]{1,8})$/i) || [])[1];
        let key, ctype, immutable = false;
        if (rest === "") { key = "sites/" + slug + "/index.html"; ctype = "text/html; charset=utf-8"; }
        else if (ext) { key = "sites/" + slug + "/" + rest.replace(/[^a-z0-9/._-]/gi, "-"); ctype = R2_MIME[ext.toLowerCase()] || "application/octet-stream"; immutable = ext.toLowerCase() !== "html"; }
        else { key = "sites/" + slug + "/" + rest.replace(/[^a-z0-9/_-]/gi, "-") + ".html"; ctype = "text/html; charset=utf-8"; }
        const obj = await env.SITES_BUCKET.get(key);
        if (!obj) return new Response("Not found", { status: 404 });
        if (request.method === "GET" && ctype.startsWith("text/html")) logSiteHit(env, ctx, slug, "/" + rest, request); // count real page views (not assets)
        return new Response(obj.body, {
          headers: {
            "content-type": ctype,
            "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=60",
            "x-content-type-options": "nosniff",
          },
        });
      }
      if (sm) return new Response("Not found", { status: 404 });
    }

    // Serve a builder DRAFT preview: isibi.ai/preview/<uid>/<nonce>. The workspace
    // iframe loads this (not a blob) so the generated page runs its OWN inline
    // <script>/<style> under the website CSP (see harden()), exactly like it will
    // once published — blob/srcdoc inherit the app's strict script-src and blank
    // the page. One rolling slot per user (preview/<uid>.html), overwritten each
    // render; the nonce only busts the iframe cache. Never cached.
    {
      const pv = url.pathname.match(/^\/preview\/([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})(?:\/[A-Za-z0-9_-]{1,40})?$/i);
      if (pv && env.SITES_BUCKET) {
        const obj = await env.SITES_BUCKET.get("preview/" + pv[1].toLowerCase() + ".html");
        if (!obj) return new Response("Preview not ready — reopen the site.", { status: 404 });
        return new Response(obj.body, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      }
      if (pv) return new Response("Not found", { status: 404 });
    }

    // Serve a visitor-uploaded file from R2: isibi.ai/u/<slug>/<file>. Public,
    // long-cached, content-type from what was stored. Never lists a directory.
    {
      const um = url.pathname.match(/^\/u\/([a-z0-9][a-z0-9-]{0,80})\/([A-Za-z0-9._-]{1,80})$/);
      if (um && env.SITES_BUCKET) {
        const obj = await env.SITES_BUCKET.get("uploads/" + um[1].toLowerCase() + "/" + um[2]);
        if (!obj) return new Response("Not found", { status: 404 });
        return new Response(obj.body, {
          headers: {
            "content-type": (obj.httpMetadata && obj.httpMetadata.contentType) || "application/octet-stream",
            "cache-control": "public, max-age=31536000, immutable",
            "content-disposition": "inline",
            "x-content-type-options": "nosniff",
          },
        });
      }
      if (um) return new Response("Not found", { status: 404 });
    }

    // Serve a builder attachment (logo / reference the owner attached when
    // building) from R2: isibi.ai/a/<siteId>/<file>. Same shape as /u/.
    {
      const am = url.pathname.match(/^\/a\/([a-z0-9][a-z0-9_-]{0,80})\/([A-Za-z0-9._-]{1,80})$/i);
      if (am && env.SITES_BUCKET) {
        const obj = await env.SITES_BUCKET.get("assets/" + am[1] + "/" + am[2]);
        if (!obj) return new Response("Not found", { status: 404 });
        return new Response(obj.body, {
          headers: {
            "content-type": (obj.httpMetadata && obj.httpMetadata.contentType) || "application/octet-stream",
            "cache-control": "public, max-age=31536000, immutable",
            "x-content-type-options": "nosniff",
          },
        });
      }
      if (am) return new Response("Not found", { status: 404 });
    }

    const genKind =
      url.pathname === "/api/video" ? "video" :
      url.pathname === "/api/image" ? "image" :
      url.pathname === "/api/audio" ? "audio" : null;
    if (genKind && request.method === "POST") {
      const genUser = await authUser(request);
      if (!genUser) return UNAUTHED();
      if (!env.FAL_KEY) {
        return Response.json({ error: "generation not configured" }, { status: 500 });
      }
      // Platform-balance pre-flight (owner 2026-07-17, found live): with the
      // fal account out of money, fal still ACCEPTS jobs and leaves them
      // queued forever — the user would be charged for a render that never
      // runs. Refuse BEFORE any charge. Fails open on null (endpoint down /
      // non-admin key) so monitoring can never block a paying user.
      const falUsd = await falBalanceUSD(env);
      if (falUsd !== null && falUsd < 0.5) {
        return Response.json({ error: "our generation servers are temporarily down — we're working on it, check back soon (you were not charged)" }, { status: 503 });
      }
      const tl = tooLargeBody(request, 100_000_000); if (tl) return tl; // ~100MB backstop
      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400 });
      }
      const prompt =
        // 4000 matches the director's output cap — 2000 chopped long composed
        // prompts mid-word. Per-model caps (Kling 2500 etc.) still apply below.
        typeof body.prompt === "string" ? body.prompt.trim().slice(0, 4000) : "";
      const allowed =
        genKind === "video" ? VIDEO_MODELS :
        genKind === "audio" ? AUDIO_MODELS : IMAGE_MODELS;
      const fallback =
        genKind === "video" ? DEFAULT_VIDEO_MODEL :
        genKind === "audio" ? DEFAULT_AUDIO_MODEL : DEFAULT_IMAGE_MODEL;
      const model = !body.model || body.model === "auto" ? fallback : body.model;
      if (!allowed.has(model)) {
        return Response.json({ error: "unknown model" }, { status: 400 });
      }
      // Idempotency key: the client stamps one per submit and retries with the
      // SAME key if the response is lost after we may have charged. Checked BEFORE
      // the prompt requirement so a minimal recovery re-POST ({model, idem}) can
      // reach it. If a charge already exists for this key, return the stored job
      // instead of charging + submitting again — a dropped reply can't orphan a
      // paid render or double-charge on retry.
      const idem = typeof body.idem === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(body.idem) ? body.idem : "";
      // Only a recovery re-POST (body.recover) pays for the lookup — a normal
      // first submit skips it, so the hot path adds no DB round-trip.
      if (idem && body.recover === true && env.SUPABASE_SERVICE_KEY) {
        // The lookup MUST distinguish "no charge exists" (safe to drop the
        // client's record) from "couldn't check" (transient — the client must
        // keep the record and retry). A failed/throwing lookup returns a
        // retryable 503; only a SUCCESSFUL lookup that finds no row falls
        // through to the normal no-prompt 400 that tells the client to drop it.
        // (Before: any lookup failure fell through to that 400 and destroyed
        // the only recovery record for a possibly-charged job.)
        try {
          const q = await fetch(
            `${SUPABASE_URL}/rest/v1/gen_charges?user_id=eq.${genUser.id}&idem=eq.${encodeURIComponent(idem)}&select=request_id,status_url,response_url,cost&limit=1`,
            { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` }, signal: AbortSignal.timeout(6000) }
          );
          if (!q.ok) return Response.json({ error: "recovery lookup failed", retry: true }, { status: 503 });
          const rows = await q.json().catch(() => null);
          if (rows === null) return Response.json({ error: "recovery lookup failed", retry: true }, { status: 503 });
          const ex = Array.isArray(rows) && rows[0];
          if (ex && ex.status_url && ex.response_url) {
            return Response.json({ request_id: ex.request_id, status_url: ex.status_url, response_url: ex.response_url, model, cost: ex.cost, recovered: true });
          }
          // Lookup succeeded, no charge row → genuinely nothing to recover;
          // fall through to the normal submit (→ 400 no prompt → client drops).
        } catch { return Response.json({ error: "recovery lookup failed", retry: true }, { status: 503 }); }
      }

      // Lip-sync models drive off attachments, not text; everything else needs a prompt.
      const promptless = genKind === "video" && PROMPTLESS_VIDEO.has(model);
      if (!prompt && !promptless) {
        return Response.json({ error: "no prompt" }, { status: 400 });
      }

      // Optional attachments as data URIs (image = start frame / edit source)
      const dataImage = (v) =>
        typeof v === "string" && v.startsWith("data:image/") && v.length < 12_000_000
          ? v
          : null;
      const dataAudio = (v) =>
        typeof v === "string" && v.startsWith("data:audio/") && v.length < 28_000_000
          ? v
          : null;
      const dataVideo = (v) =>
        typeof v === "string" && v.startsWith("data:video/") && v.length < 30_000_000
          ? v
          : null;
      const image = dataImage(body.image);
      const avatar = dataImage(body.avatar);
      const end = dataImage(body.end);
      const audio = dataAudio(body.audio);
      // Video clips can't ride inline: Kling's video_url validator probes the
      // URL for format/duration/resolution and 422s a base64 data URI. Park the
      // clip on fal storage and submit the hosted URL instead. Happens BEFORE
      // the credit charge, so an upload failure costs nothing.
      const clipDataUri = dataVideo(body.clip);
      // Several billing bases need the clip's REAL length (LipSync per-5s, the
      // o3/Gemini edits that render the whole clip, Seedance video-reference
      // input seconds) — measure it from the bytes here (before the data URI is
      // swapped for the hosted URL) rather than trusting the client.
      // Unparseable → 0, and each consumer falls back to its own never-
      // undercharge maximum.
      const clipSecondsReal = clipDataUri ? (videoDurationFromDataUri(clipDataUri) || 0) : 0;
      // Seedance extra references beyond slot #1 (@Video2-3 / @Audio2-3).
      // fal caps: 3 videos combined 2-15s & ≤50MB total; 3 audios combined ≤15s.
      const extraClipUris = model.startsWith("bytedance/") && clipDataUri && Array.isArray(body.extraClips)
        ? body.extraClips.slice(0, 2).map(dataVideo).filter(Boolean)
        : [];
      const extraAudios = model.startsWith("bytedance/") && Array.isArray(body.extraAudios)
        ? body.extraAudios.slice(0, 2).map(dataAudio).filter(Boolean)
        : [];
      if (extraClipUris.length) {
        const totalBytes = Math.floor((clipDataUri.length + extraClipUris.reduce((t, u) => t + u.length, 0)) * 0.75);
        if (totalBytes > 52_000_000) {
          return Response.json({ error: "video references are capped at 50 MB combined" }, { status: 400 });
        }
      }
      // Combined video-ref seconds, byte-measured server-side (billing basis +
      // fal's 15s combined cap). ANY unmeasurable clip → 0 → the consumer's
      // never-undercharge 15s maximum.
      const extraClipSecs = extraClipUris.map((u) => videoDurationFromDataUri(u) || 0);
      const vrefCombinedSecs = extraClipUris.length
        ? (clipSecondsReal && extraClipSecs.every((s) => s > 0) ? clipSecondsReal + extraClipSecs.reduce((t, s) => t + s, 0) : 0)
        : clipSecondsReal;
      if (vrefCombinedSecs > 15.5) {
        return Response.json({ error: "video references are capped at 15 seconds combined" }, { status: 400 });
      }
      let clip = clipDataUri;
      if (clip) {
        clip = await falUpload(clip, env);
        if (!clip) {
          return Response.json({ error: "couldn't stage the video clip — try attaching it again" }, { status: 502 });
        }
      }
      const extraClips = [];
      for (const u of extraClipUris) {
        const hosted = await falUpload(u, env);
        if (!hosted) {
          return Response.json({ error: "couldn't stage a reference clip — try attaching it again" }, { status: 502 });
        }
        extraClips.push(hosted);
      }
      // Extra reference images beyond the first (multi-image models).
      const extraImages = Array.isArray(body.images)
        ? body.images.slice(0, 16).map(dataImage).filter(Boolean) // provider maxima: Nano 14, GPT 16 — the edit branch caps per model below
        : [];
      // Veo 3.1's dedicated image-input modes (mutually exclusive with i2v):
      //  first + last  → first-last-frame-to-video (2 frames)
      //  refs[]        → reference-to-video (subject consistency, ≤3)
      const first = dataImage(body.first);
      const last = dataImage(body.last);
      const refs = Array.isArray(body.refs)
        ? body.refs.slice(0, 9).map(dataImage).filter(Boolean)
        : [];
      // Kling character elements: each entry is one frontal image, cited in the
      // prompt as @Element1-4. Input-only — no fal price dimension.
      const elements = Array.isArray(body.elements)
        ? body.elements.slice(0, 4).map(dataImage).filter(Boolean)
        : [];
      // Kling multi-shot (shot-list): an ordered list of {prompt, duration}
      // shots rendered as one cut sequence. fal's `multi_prompt` lives on
      // Kling's text-to-video AND image-to-video endpoints (verified per schema
      // 2026-07-16) — each shot is 1–15s. Ignored for any other model (the gate
      // below also requires a t2v/i2v endpoint; the o3 edit has no multi_prompt).
      const shots = (model.includes("kling-video") && /\/text-to-video$/.test(model) && Array.isArray(body.shots))
        ? body.shots.slice(0, 8).map((s) => {
            const p = s && typeof s.prompt === "string" ? s.prompt.trim().slice(0, 2500) : "";
            if (!p) return null;
            let d = Math.round(Number(s && s.duration));
            if (!Number.isFinite(d) || d < 1) d = 5;
            if (d > 15) d = 15;
            return { prompt: p, duration: String(d) };
          }).filter(Boolean)
        : [];

      let endpoint = model;
      const input = { prompt };
      // Set once the multi_prompt shot-list is actually applied (Kling pure t2v,
      // ≥2 shots) — flips billing onto the summed shot seconds.
      let useShots = false;
      // Director-driven extras (no UI knobs — the composer sets these from the
      // user's own words). soundOff: an explicit "silent / no sound" request;
      // billing keys off it where fal prices audio-off cheaper (Veo, Kling).
      const soundOff = body.sound === false;
      // A short "avoid X" list for families with a real negative_prompt field.
      const negative = typeof body.negative === "string" ? body.negative.trim().slice(0, 500) : "";
      // More director-driven knobs (all price-neutral, schema-verified 2026-07-16):
      // cfg → Kling v3 cfg_scale (prompt adherence, 0-1); bitrate "high" →
      // Seedance bitrate_mode (full/fast only — fal's pricing page has no bitrate
      // dimension, so it's a free bigger-file encode); shotType "intelligent" →
      // Kling auto-directs the cut structure.
      const cfg = typeof body.cfg === "number" && Number.isFinite(body.cfg) ? Math.min(1, Math.max(0, body.cfg)) : null;
      const bitrateHigh = body.bitrate === "high";
      const intelligentShots = body.shotType === "intelligent";

      const ratio =
        typeof body.ratio === "string" && /^\d{1,2}:\d{1,2}$/.test(body.ratio)
          ? body.ratio
          : null;
      const duration =
        Number.isFinite(Number(body.duration)) &&
        Number(body.duration) >= 1 &&
        Number(body.duration) <= 20
          ? Number(body.duration)
          : null;

      const quality =
        typeof body.quality === "string" && /^(\d{3,4}p|4k)$/.test(body.quality)
          ? body.quality
          : null;

      // Image mode: how many variations to generate (per-image billing, so
      // only forwarded when explicitly above 1; the UI defaults to 1).
      const num = Number.isInteger(body.num) && body.num >= 1 && body.num <= 4 ? body.num : null;

      if (genKind === "audio") {
        // Voice generation: the prompt is the words to speak, and `voice`
        // selects an ElevenLabs preset (defaults to Rachel server-side).
        // Cap the spoken text at 2,000 chars — the SAME cap billing uses
        // (creditCost bills Math.min(2000, len)). Sending the full 4,000-char
        // prompt uncut let TTS bill us for up to 2× what we charged the user.
        delete input.prompt;
        input.text = prompt.slice(0, 2000);
        const voice =
          typeof body.voice === "string" &&
          /^[A-Za-z][A-Za-z0-9 _-]{0,39}$/.test(body.voice)
            ? body.voice
            : null;
        if (voice) input.voice = voice;
        // Director-driven delivery tuning (price-neutral — TTS bills per
        // character). Clamped to each schema's range; eleven-v3 accepts only
        // stability, so speed/style are dropped for it.
        const clamp = (v, lo, hi) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : null);
        const stab = clamp(body.stability, 0, 1);
        if (stab != null) input.stability = stab;
        if (!/eleven-v3/.test(model)) {
          const spd = clamp(body.speed, 0.7, 1.2);
          const sty = clamp(body.style, 0, 1);
          if (spd != null) input.speed = spd;
          if (sty != null) input.style = sty;
        }
      } else if (genKind === "video" && model === "fal-ai/kling-video/lipsync/audio-to-video") {
        // Lip-sync an existing clip. Two fal endpoints behind one model card:
        // an attached voice track drives audio-to-video; no audio but typed
        // words → text-to-video (Kling voices the text itself, same per-5s
        // input-clip billing on both).
        if (!clip || (!audio && !prompt)) {
          return Response.json({ error: "Kling LipSync needs a video clip plus an audio clip — or type the words to speak" }, { status: 400 });
        }
        delete input.prompt;
        input.video_url = clip;
        if (audio) {
          input.audio_url = audio;
        } else {
          endpoint = "fal-ai/kling-video/lipsync/text-to-video";
          input.text = prompt.slice(0, 2000);
          // Curated English voices (schema enum ids); unknown → the narrator.
          input.voice_id = KLS_VOICES.has(body.voice) ? body.voice : "reader_en_m-v1";
          input.voice_language = "en";
        }
      } else if (genKind === "video") {
        const isSeedance = model.startsWith("bytedance/");
        const isKling = model.includes("kling-video");
        const isKlingV3 = model.includes("kling-video/v3");
        const isKlingO3 = model.includes("kling-video/o3");
        const isGrok = model.includes("grok-imagine");
        const isVeo = model.includes("veo");
        const isSora = model.includes("sora");
        const isGemini = model.includes("gemini-omni");
        // A clip attached to an editing model routes to that model's edit
        // endpoint. `bareEdit` marks endpoints that take only prompt+video (no
        // duration/ratio/resolution) so the gen params below are suppressed.
        let bareEdit = false;

        // The image-to-video endpoint id — Veo and Gemini have base ids with no
        // "/text-to-video" segment to swap, so they get the suffix appended instead.
        const i2v = (isVeo || isGemini) ? model + "/image-to-video" : model.replace("/text-to-video", "/image-to-video");
        // Start-image field name differs by family: Kling v3 wants start_image_url;
        // everyone else (Seedance, Kling o3, Grok, Veo, Sora, Hailuo) wants image_url.
        const startField = isKlingV3 ? "start_image_url" : "image_url";

        // Reference-to-video (hold a subject/identity across a fresh scene).
        // Seedance folds any driving audio + multi-image references in here;
        // Veo has its own reference endpoint (≤3 images, no audio).
        if (isSeedance && (refs.length || audio || clip)) {
          // Reference-to-video: hold subjects/motion across a fresh scene from
          // image refs (@ImageN), a driving audio (@Audio1), and/or a video
          // reference (@Video1 — the clip is already staged on fal storage).
          endpoint = model.replace("/text-to-video", "/reference-to-video");
          const rImgs = (refs.length ? refs : [image].filter(Boolean)).slice(0, 9);
          // fal rule: a driving audio needs at least one image OR video reference.
          if (audio && !rImgs.length && !clip) {
            return Response.json({ error: "Add a reference image or video along with the audio." }, { status: 400 });
          }
          if (rImgs.length) input.image_urls = rImgs;
          // Slot #1 + the @Video2-3/@Audio2-3 extras (fal caps both at 3).
          if (clip) input.video_urls = [clip, ...extraClips].slice(0, 3);
          if (audio) input.audio_urls = [audio, ...extraAudios].slice(0, 3);
          // fal's cross-modal cap: ≤12 files total (the client enforces it too).
          if (rImgs.length + (input.video_urls || []).length + (input.audio_urls || []).length > 12) {
            return Response.json({ error: "references are capped at 12 files total" }, { status: 400 });
          }
          // Seedance only uses a reference the prompt CITES (@ImageN/@VideoN).
          // The director writes those tags; for a raw prompt without any, append
          // them so the uploaded references aren't silently ignored.
          const tags = rImgs.map((_, i) => "@Image" + (i + 1))
            .concat((input.video_urls || []).map((_, i) => "@Video" + (i + 1)));
          if (typeof input.prompt === "string" && tags.length && !/@(?:Image|Video)\d/i.test(input.prompt)) {
            input.prompt = (input.prompt.trim() + ` Feature ${tags.join(", ")}.`).trim();
          }
        } else if (isVeo && refs.length) {
          endpoint = model + "/reference-to-video";
          input.image_urls = refs.slice(0, 3);
        } else if (isKlingO3 && (refs.length || elements.length) && !clip) {
          // Kling o3 reference-to-video (pro + standard): ≤4 style references
          // bound as native @Image1..@Image4 tags (Seedance-style) and/or ≤4
          // character elements bound as @Element1..@Element4 (identity holds
          // across the video). A start and/or end frame can ride along; a clip
          // instead routes to the edit endpoint below.
          endpoint = model.replace("/text-to-video", "/reference-to-video");
          if (refs.length) input.image_urls = refs.slice(0, 4);
          if (elements.length) input.elements = elements.map((u) => ({ frontal_image_url: u }));
          const rStart = image || first;
          const rEnd = end || last;
          if (rStart) input.start_image_url = rStart;
          if (rEnd) input.end_image_url = rEnd;
          // For a raw prompt with no tags, cite the attachments so they're used.
          const tags = (input.image_urls || []).map((_, i) => "@Image" + (i + 1))
            .concat(elements.map((_, i) => "@Element" + (i + 1)));
          if (typeof input.prompt === "string" && !/@(?:Image|Element)\d/i.test(input.prompt)) {
            input.prompt = (input.prompt.trim() + ` Feature ${tags.join(", ")}.`).trim();
          }
        } else if (isGemini && refs.length && !clip) {
          // Gemini Omni Flash reference-to-video (fal OpenAPI 2026-07-17):
          // prompt + image_urls ONLY (required, maxItems 10) — no video/audio
          // refs despite the catalog copy, no resolution param. Bills the
          // same ~$0.13/s def rate as t2v.
          endpoint = model + "/reference-to-video";
          input.image_urls = refs.slice(0, 10);
          // A raw prompt with no tags cites every ref (as @ImageN — the tag
          // reconciler below translates them into Gemini's native 0-based
          // <IMAGE_REF_N> form) so uploads are never silently ignored.
          if (typeof input.prompt === "string" && !/@Image\d|<IMAGE_REF_/i.test(input.prompt)) {
            input.prompt = (input.prompt.trim() + ` Feature ${input.image_urls.map((_, i) => "@Image" + (i + 1)).join(", ")}.`).trim();
          }
        } else if (isGemini && clip) {
          // Gemini Omni Flash conversational edit — the instruction rewrites the
          // attached clip (swap/relight/stabilize/bg). Prompt + video only.
          endpoint = model + "/edit";
          input.video_url = clip;
          bareEdit = true;
        } else if (isKlingO3 && clip) {
          // Kling o3 edit — re-render the clip; optional style/appearance images
          // ride along as @ImageN refs, and the source audio is kept by default.
          endpoint = model.replace("/text-to-video", "/video-to-video/edit");
          input.video_url = clip;
          // fal caps characters + style refs at 4 COMBINED on the edit endpoint
          // (elements get the slots first — identity beats style).
          const els = elements.slice(0, 4);
          if (els.length) input.elements = els.map((u) => ({ frontal_image_url: u }));
          if (refs.length && els.length < 4) input.image_urls = refs.slice(0, 4 - els.length);
          bareEdit = true;
        } else if (isVeo && clip) {
          // Veo 3.1 extend — continue/lengthen the clip, driven by the prompt.
          endpoint = model + "/extend-video";
          input.video_url = clip;
          bareEdit = true;
        } else if (first && last) {
          // First & last frame. Veo has a dedicated endpoint; every other family
          // pins the two frames as start+end on their image-to-video endpoint.
          if (isVeo) {
            endpoint = model + "/first-last-frame-to-video";
            input.first_frame_url = first;
            input.last_frame_url = last;
          } else {
            endpoint = i2v;
            input[startField] = first;
            input.end_image_url = last;
          }
        } else if (first || last) {
          // Only one of the two frames was given — run it as a single start image.
          endpoint = i2v;
          input[startField] = first || last;
        } else if (image) {
          endpoint = i2v;
          input[startField] = image;
          // A standalone end frame only applies to families whose i2v accepts one.
          if (end && (isSeedance || isKlingV3 || isKlingO3)) input.end_image_url = end;
        }

        // Kling v3 character elements ride ONLY its image-to-video endpoint
        // (the client requires a start image before letting them submit).
        if (isKlingV3 && elements.length && endpoint === i2v) {
          input.elements = elements.map((u) => ({ frontal_image_url: u }));
        }

        // Kling multi-shot: swap the single prompt for the shot list. fal takes
        // multi_prompt on Kling's t2v AND i2v endpoints (schema-verified), so a
        // start image / first-&-last pair can carry a shot list too. A clip
        // reroutes to o3's edit endpoint, which has no multi_prompt — excluded
        // by the endpoint check. `prompt` and `multi_prompt` are mutually exclusive.
        if (shots.length >= 2 && (endpoint === model || (isKling && (endpoint === i2v || endpoint.includes("/reference-to-video"))))) {
          useShots = true;
          input.multi_prompt = shots;
          delete input.prompt;
        }

        // Kling "intelligent" shot mode: the model auto-directs the cut
        // structure from the single prompt. Meaningless next to an explicit
        // shot list (customize is implied there) and absent from the o3 edit
        // endpoint (bareEdit). Same duration billing — price-neutral.
        if (isKling && intelligentShots && !bareEdit && !useShots) input.shot_type = "intelligent";
        // Kling v3 CFG scale — how tightly the render follows the prompt
        // (0-1, schema default 0.5). o3's schema has no cfg_scale.
        if (isKlingV3 && cfg != null && !bareEdit) input.cfg_scale = cfg;
        // Seedance high-bitrate encode (full + fast tiers; mini's schema lacks
        // the field). fal's pricing has no bitrate dimension — free quality knob.
        if (isSeedance && bitrateHigh && !model.includes("/mini/")) input.bitrate_mode = "high";

        // Reconcile @ImageN reference tags with the ACTUAL generation. Seedance
        // binds tags natively; Veo's reference endpoint has no tag concept, so
        // its tags are translated to plain "reference image N" wording instead
        // of stripped (the UI badges refs as @ImageN on every ref-capable model).
        // On a rerun/revise of an old reference prompt (references already
        // cleared), or a plan-mode prompt whose reference set shrank, tags would
        // be dangling noise pointing at images that aren't there — drop those.
        if (typeof input.prompt === "string" && /@(?:Image|Video|Audio)\d/i.test(input.prompt)) {
          // Count the refs from the ACTUAL payload arrays, not the endpoint name:
          // image_urls/video_urls/audio_urls are set on the reference endpoints
          // AND on Kling o3's /video-to-video/edit (which takes style image_urls +
          // elements). Keying off the endpoint name stripped @ImageN tags on o3
          // edits even though the images were sent (bug 2026-07-17).
          const imgN = Array.isArray(input.image_urls) ? input.image_urls.length : 0;
          const vidN = Array.isArray(input.video_urls) ? input.video_urls.length : 0;
          const audN = Array.isArray(input.audio_urls) ? input.audio_urls.length : 0;
          if ((isSeedance || isKlingO3) && (imgN || vidN || audN)) {
            // Native tag binding (Seedance @Image/@Video/@Audio; Kling o3 ref
            // @Image1-4): keep only tags that point at an attached reference OF
            // THAT MODALITY; drop any dangling tag pointing past what's attached.
            input.prompt = input.prompt
              .replace(/@Image(\d+)/gi, (m, d) => (+d >= 1 && +d <= imgN ? m : ""))
              .replace(/@Video(\d+)/gi, (m, d) => (+d >= 1 && +d <= vidN ? m : ""))
              .replace(/@Audio(\d+)/gi, (m, d) => (+d >= 1 && +d <= audN ? m : ""));
          } else if (isGemini && imgN) {
            // Gemini binds refs natively as 0-BASED <IMAGE_REF_N> tags:
            // translate the user-facing 1-based @ImageN; drop dangling tags
            // and off-modality @Video/@Audio ones.
            input.prompt = input.prompt
              .replace(/@Image(\d+)/gi, (m, d) => (+d >= 1 && +d <= imgN ? "<IMAGE_REF_" + (+d - 1) + ">" : ""))
              .replace(/\s*@(?:Video|Audio)\d+/gi, "");
          } else if (imgN) {
            // Tagless family (Veo): translate cited image tags into natural wording.
            input.prompt = input.prompt.replace(/@Image(\d+)/gi, (m, d) => (+d <= imgN ? "reference image " + d : ""));
            input.prompt = input.prompt.replace(/\s*@(?:Video|Audio)\d+/gi, "");
          } else {
            // Not a reference gen: drop the appended "Feature @Image1, @Image2."
            // clause and any inline tags.
            input.prompt = input.prompt
              .replace(/\s*\bFeature\s+@(?:Image|Video|Audio)\d+(?:\s*,\s*@(?:Image|Video|Audio)\d+)*\s*\.?/gi, "")
              .replace(/\s*@(?:Image|Video|Audio)\d+/gi, "");
          }
          input.prompt = input.prompt.replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
        }
        // @ElementN hygiene, same idea as @ImageN: with elements attached, drop
        // only tags pointing past the attached count; with none, strip them all
        // (a rerun of an old element prompt must not leave dangling tags).
        if (typeof input.prompt === "string" && /@Element\d/i.test(input.prompt)) {
          const elN = Array.isArray(input.elements) ? input.elements.length : 0;
          input.prompt = input.prompt
            .replace(/\s*\bFeature\s+@(?:Image|Element)\d+(?:\s*,\s*@(?:Image|Element)\d+)*\s*\.?/gi, (m) => (elN ? m : ""))
            .replace(/@Element(\d+)/gi, (m, d) => (+d >= 1 && +d <= elN ? m : ""))
            .replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
        }

        if (duration && !bareEdit && !useShots) {
          // Veo wants "8s"; Seedance/Kling want a string enum; the rest an integer.
          if (isVeo && endpoint.includes("/reference-to-video")) input.duration = "8s"; // fal locks Veo ref to 8s only
          // Lite first-&-last only accepts "8s" (fal OpenAPI: duration const
          // "8s"; live 422 2026-07-17); t2v/i2v keep the real 4s/6s/8s enum.
          else if (model.endsWith("veo3.1/lite") && endpoint.includes("/first-last-frame")) input.duration = "8s";
          else if (isVeo) input.duration = duration + "s";
          else if (isSeedance || isKling) input.duration = String(duration);
          else input.duration = duration;
        } else if (isSeedance && !bareEdit && !useShots) {
          // No duration given: every other family's schema default equals the 5s/8s
          // billing base, but Seedance defaults to "auto" (model-chosen length, up
          // to 15s) while the charge falls back to 5s — a duration-less submit
          // could render 3× what it billed. Pin the render to the billed length.
          input.duration = "5";
        }

        // Kling image-to-video has no aspect_ratio; the bare edit endpoints
        // inherit the source clip's framing, so no ratio.
        const isKlingI2V = isKling && endpoint.includes("/image-to-video");
        if (ratio && !isKlingI2V && !bareEdit) input.aspect_ratio = ratio;

        // Video endpoints that accept a resolution (edit endpoints take the source's).
        if (quality && !bareEdit && (isSeedance || isGrok || isVeo || isSora)) input.resolution = quality;

        // ── Audio track control (director-driven, no UI knob) ──
        // Kling o3's generate_audio defaults FALSE (every other family defaults
        // true) while its $0.14/s rate is fal's audio-ON price — so o3 renders
        // were silent yet billed with-audio. Turn audio ON by default so the
        // delivered video matches the rate charged; an explicit "silent" request
        // (soundOff) leaves it off and bills the cheaper audio-off tier.
        if (isKlingO3 && !bareEdit) input.generate_audio = !soundOff;
        // Families whose generate_audio defaults true: only an explicit silent
        // request flips it (and, where fal prices audio-off cheaper — Veo, Kling
        // v3 — billing follows via the aoff tier below).
        else if (soundOff && !bareEdit && (isSeedance || isKlingV3 || isVeo)) input.generate_audio = false;
        // Veo extend is a bareEdit but its endpoint DOES take generate_audio
        // (fal OpenAPI) — send silent so the render matches the audio-off charge
        // (bug 2026-07-17: we billed aoff but rendered with audio at full price).
        if (soundOff && isVeo && endpoint.includes("/extend-video")) input.generate_audio = false;
        // o3 edit keeps the source clip's audio by default; "silent" strips it.
        if (soundOff && isKlingO3 && endpoint.includes("/video-to-video/edit")) input.keep_audio = false;

        // ── negative_prompt (director-driven) ── only Kling v3 and Veo have the
        // field (verified per schema; o3/Seedance/Gemini/Ray do not). Kling's
        // server default is a quality guard — append to it, never replace it.
        if (negative && !bareEdit) {
          if (isKlingV3) input.negative_prompt = negative + ", blur, distort, and low quality";
          else if (isVeo && !endpoint.includes("/reference-to-video")) input.negative_prompt = negative;
        }

        // Veo auto-fix (self-heal content-policy trips by rewording) defaults
        // true on t2v but FALSE on i2v/flf/ref/extend — normalize it on so an
        // i2v run self-heals instead of failing a charged submit. Price-neutral.
        if (isVeo) input.auto_fix = true;
      } else if ((image || avatar || extraImages.length) && IMAGE_EDIT[model]) {
        // Image editing/composing: route to the model's edit endpoint. The
        // inputs are EITHER one edit base (image-to-image) OR a stack of
        // references to build a new image from — never both (client enforces).
        // Size comes from the source image, so no aspect_ratio here.
        const edit = IMAGE_EDIT[model];
        endpoint = edit.endpoint;
        let urls = [image, avatar, ...extraImages].filter(Boolean).slice(0, model === "openai/gpt-image-2" ? 16 : 14);
        // A stack of inline data URIs can blow past what the downstream model
        // accepts (a 14-image edit came back 422 "could not generate with the
        // given prompts and images"). Big batches get staged on fal storage
        // and submitted as real URLs; a failed upload falls back to its data
        // URI rather than dropping the image.
        const inlineBytes = urls.reduce((n, u) => n + (typeof u === "string" && u.startsWith("data:") ? u.length * 0.75 : 0), 0);
        if (urls.length > 4 || inlineBytes > 5_000_000) {
          urls = await Promise.all(urls.map(async (u) =>
            (typeof u === "string" && u.startsWith("data:")) ? ((await falUpload(u, env)) || u) : u));
        }
        if (edit.multi) input.image_urls = urls;
        else input.image_url = urls[0];
        // GPT Image 2's edit endpoint has no aspect_ratio/resolution — it sizes
        // ONLY via image_size. The generic ratio→image_size mapping below lives
        // in the (mutually exclusive) text-to-image branch, so a picked ratio was
        // dropped on edits (every gpt edit came out at the source/auto shape).
        // Map it here so the aspect picker actually reframes. (Nano's edit takes
        // aspect_ratio directly and is handled after the chain.)
        if (model === "openai/gpt-image-2" && ratio) {
          const sizes = { "1:1": "square_hd", "16:9": "landscape_16_9", "9:16": "portrait_16_9", "4:3": "landscape_4_3", "3:4": "portrait_4_3" };
          if (sizes[ratio]) input.image_size = sizes[ratio];
        }
        // GPT Image 2 inpainting: a black/white mask (WHITE = edit, BLACK = keep,
        // same dimensions as the source) confines the edit to a painted region.
        // Only for a single-image edit — the mask maps to one base image. Sent
        // inline as a data URI, like image_urls.
        if (model === "openai/gpt-image-2" && urls.length === 1) {
          const mask = dataImage(body.mask);
          if (mask) input.mask_url = mask;
        }
      } else if (ratio) {
        // These families size output via an image_size enum; the rest take aspect_ratio.
        // gpt-image-2 has no aspect_ratio field at all — it sizes via image_size,
        // so a picked ratio was silently dropped (every render came out landscape_4_3).
        const usesImageSize =
          model === "openai/gpt-image-2" ||
          model.startsWith("fal-ai/flux/") ||
          model.startsWith("fal-ai/flux-2") ||
          model.includes("seedream") ||
          model.includes("recraft");
        if (usesImageSize) {
          const sizes = {
            "1:1": "square_hd",
            "16:9": "landscape_16_9",
            "9:16": "portrait_16_9",
            "4:3": "landscape_4_3",
            "3:4": "portrait_4_3",
          };
          if (sizes[ratio]) input.image_size = sizes[ratio];
        } else {
          input.aspect_ratio = ratio;
        }
      }

      // Nano Banana Pro resolution tier. 2K is the default — fal bills 1K and 2K
      // at the SAME $0.15/image (verified on the pricing page 2026-07-15), so 2K
      // is a free upgrade over the 1K schema default. 4K bills DOUBLE ($0.30),
      // priced accordingly below. Server-authoritative: an unrecognized value
      // falls back to 2K (never the pricier 4K). Applies to both t2i and edit.
      const imgRes = genKind === "image" && model === "fal-ai/nano-banana-pro"
        ? (/^(1K|2K|4K)$/i.test(body.quality) ? body.quality.toUpperCase() : "2K")
        : "";
      if (imgRes) input.resolution = imgRes;

      // Nano Banana Pro aspect_ratio — applied to BOTH text-to-image AND edit
      // (its edit endpoint reframes/outpaints to the target ratio; the generic
      // ratio branch above is skipped on the edit path, so the picked ratio used
      // to be dropped on edits). 'auto' lets the model pick / keeps the source
      // shape; an unrecognized value defaults to 'auto' (never a forced reframe).
      if (genKind === "image" && model === "fal-ai/nano-banana-pro") {
        input.aspect_ratio = /^(auto|\d{1,2}:\d{1,2})$/.test(body.ratio || "") ? body.ratio : "auto";
      }

      // GPT Image 2 quality tier (low/medium/high) — swings fal's price a lot, so
      // it's priced per tier below. Server-authoritative: an unrecognized value
      // defaults to the schema default "high" (never a cheaper tier). Applies to
      // both text-to-image and edit.
      const gptQuality = genKind === "image" && model === "openai/gpt-image-2"
        ? (/^(low|medium|high)$/i.test(body.quality) ? body.quality.toLowerCase() : "high")
        : "";
      if (gptQuality) input.quality = gptQuality;

      // GPT Image 2 resolution tier. 1K keeps the ratio's named image_size preset
      // (set in the branches above); 2K/4K send an explicit {width,height} at the
      // ratio, capped to the priced pixel budget so billing never undercharges.
      // Server-authoritative: unrecognized → 1K (never a pricier tier for free).
      const gptSize = genKind === "image" && model === "openai/gpt-image-2"
        ? (/^(1K|2K|4K)$/i.test(body.size) ? body.size.toUpperCase() : "1K")
        : "";
      if (gptSize === "2K" || gptSize === "4K") {
        const px = gptSizePx(ratio, gptSize);
        if (px) input.image_size = px;
      }

      if (genKind === "image" && num && num > 1) input.num_images = num;

      // Driving-audio length for the audio-billed video models (fal charges by
      // it). The ground truth is the real length read out of the uploaded file
      // header, so the charge matches fal's regardless of what the client
      // claims. When the format can't be parsed we fall back to the client's
      // measured duration floored by a size-derived lower bound: a file of N
      // bytes can't be shorter than N*8 / (highest plausible bitrate for its
      // format), so a tampered short claim can't underpay a big clip.
      let audioSeconds = 0;
      if (model === "fal-ai/kling-video/lipsync/audio-to-video") {
        const claimed = Number(body.audioDuration);
        const hasClaim = Number.isFinite(claimed) && claimed > 0;
        const real = audioDurationFromDataUri(audio); // authoritative when parseable
        // Reject over-length clips on the real duration when we have it, else on
        // the claim (0.5s tolerance for encoder padding on the parsed value).
        if (real != null ? real > AUDIO_DRIVE_MAX_S + 0.5 : hasClaim && claimed > AUDIO_DRIVE_MAX_S) {
          return Response.json({ error: `audio clip too long — max ${AUDIO_DRIVE_MAX_S}s for lip-sync` }, { status: 400 });
        }
        if (real != null) {
          audioSeconds = Math.min(AUDIO_DRIVE_MAX_S, Math.max(1, real));
        } else {
          const bytes = audio ? Math.floor(audio.length * 0.75) : 0;
          // Uncompressed PCM/WAV runs ~1.5 Mbps; lossy (mp3/aac/opus/ogg) tops
          // out near 320 kbps — cap at 384 kbps so the floor is tight but never over.
          const isPcm = /^data:audio\/(wav|x-wav|wave|pcm|aiff|x-aiff|basic)/i.test(audio || "");
          const maxBitrate = isPcm ? 1_536_000 : 384_000;
          const floorSec = bytes ? (bytes * 8) / maxBitrate : 0;
          // A real client always measures and sends the duration; a missing one
          // is treated as the cap so a tampered request can never undercharge.
          audioSeconds = hasClaim ? Math.min(AUDIO_DRIVE_MAX_S, Math.max(claimed, floorSec)) : AUDIO_DRIVE_MAX_S;
        }
      }

      // Endpoint-specific billing shape (verified on fal's pricing pages):
      // Veo extend always outputs a 7s clip (schema const) regardless of the
      // duration picker; Veo reference-to-video always renders 8s (schema const
      // — the input build forces "8s", so billing must too); Ray's image-to-video
      const isVeoRef = model.includes("veo") && endpoint.includes("/reference-to-video");
      // Lite first-&-last renders (and bills) 8s regardless of the picker.
      const isLiteFixed8 = model.endsWith("veo3.1/lite") && endpoint.includes("/first-last-frame");
      // The o3/Gemini clip edits have NO duration input — fal renders (and
      // bills) the WHOLE source clip, so the bill follows the clip's measured
      // length, never the duration picker (a real 15s edit billed $2.52 while
      // the picker said 5s). Unmeasurable → the model's max, never undercharge:
      // the client validates o3 clips to 3-15s and Gemini clips to 30s.
      const isClipEdit = !!clip && (endpoint.includes("/video-to-video/edit") || endpoint.endsWith("gemini-omni-flash/edit"));
      const clipEditMax = endpoint.includes("/video-to-video/edit") ? 15 : 30;
      // Only the server-side byte measurement is trusted; unparseable bills the
      // max (a client-claimed duration could undercharge a long clip).
      const clipBillSecs = isClipEdit ? Math.min(clipEditMax, Math.ceil(clipSecondsReal || clipEditMax)) : 0;
      // Multi-shot bills on the SUM of the shot durations (one continuous render
      // of that total length) at the model's per-second rate.
      const shotSecs = useShots ? shots.reduce((t, s) => t + Number(s.duration), 0) : 0;
      const billDuration = endpoint.includes("/extend-video") ? 7
        : isVeoRef ? 8
        : isLiteFixed8 ? 8
        : isClipEdit ? clipBillSecs
        : useShots ? shotSecs
        : duration;
      const genCost = creditCost(genKind, model, {
        duration: billDuration,
        // Veo extend outputs 720p ONLY (fal OpenAPI: resolution const) — bill
        // that tier regardless of the picker, never a 4k rate for a 720p render.
        quality: endpoint.includes("/extend-video") ? "720p" : quality,
        // Voice bills on chars ACTUALLY spoken — fal's input.text is sliced to
        // 2000, and the client quote caps at 2000 too, so cap billing to match
        // (the prompt itself can be up to 4000; a 2-4k plan-mode script used to
        // bill above the 2000-char quote) (2026-07-17).
        num, chars: genKind === "audio" ? Math.min(2000, prompt.length) : 0,
        img4k: imgRes === "4K",
        gptQuality,
        // No explicit ratio (auto/missing) → no image_size is sent, so fal
        // renders the ~1K default; bill 1K, not the 2K/4K tier. `ratio` is
        // null for auto (normalized above), so the old `=== "auto"` check was
        // dead and 4K-at-auto overcharged ~2× (2026-07-17).
        gptSize: gptSize && !ratio ? "1K" : gptSize,
        audioSeconds,
        // Any clip attached = a v2v re-render; creditCost only applies the
        // premium where the model lists v2s rates (Kling o3).
        v2v: !!clip,
        // LipSync bills on the clip's length, measured server-side from the
        // bytes (never the client's claim). Unparseable → 0 → the 10s max.
        clipSeconds: clipSecondsReal,
        // Explicit "silent" render → the audio-off rate where fal prices one.
        soundOff,
        // Seedance reference-to-video with @VideoN clips bills 0.6× rate over
        // (COMBINED input + output) seconds; unmeasurable input assumes the 15s max.
        vrefSeconds: model.startsWith("bytedance/") && clip ? Math.min(15, Math.ceil(vrefCombinedSecs || 15)) : 0,
      });

      // Charge AFTER fal accepts the job, so a rejected or failed submit never
      // burns the user's credits. First a balance pre-check — rejects a broke
      // user before we spend any fal money (fail closed: ledger down → 503).
      let balance;
      try {
        balance = await readCredits(request.headers.get("Authorization") || "");
      } catch {
        return Response.json({ error: "credits check failed — try again in a moment" }, { status: 503 });
      }
      if (!(balance >= genCost)) {
        return Response.json({ error: "not enough credits", cost: genCost }, { status: 402 });
      }

      // Endpoints hard-cap the prompt and 422 anything longer (verified against
      // each schema: Kling 2500 · Veo/Gemini 20000). Prompts are short by design
      // now, but clamp as a safety net so an over-long prompt can never bounce a
      // whole (charged) render.
      if (typeof input.prompt === "string") {
        const promptCap = endpoint.includes("kling-video") ? 2500  // Kling (all tiers/endpoints)
          : 20000;                                                 // Veo/Gemini 20000; Seedance uncapped
        if (input.prompt.length > promptCap) input.prompt = input.prompt.slice(0, promptCap);
      }

      // Submit to fal. A network error here means nothing was charged.
      let r;
      try {
        r = await fetch(`https://queue.fal.run/${endpoint}`, {
          method: "POST",
          headers: {
            Authorization: `Key ${env.FAL_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(30000),
        });
      } catch {
        return Response.json({ error: "submit failed" }, { status: 502 });
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.request_id) {
        return Response.json(
          { error: "submit failed", detail: briefErr(data) },
          { status: 502 }
        );
      }

      // fal accepted → debit now. The atomic use_credits is the real gate: the
      // pre-check above can race with a concurrent generation, so if the balance
      // dropped below cost in between, cancel the just-queued job (fal doesn't
      // bill a cancelled-while-queued job) rather than give it away free.
      let balanceAfter;
      try {
        balanceAfter = await useCredits(request.headers.get("Authorization") || "", genCost);
      } catch {
        if (ctx && ctx.waitUntil) ctx.waitUntil(cancelFal(data, env));
        return Response.json({ error: "credits check failed — try again in a moment" }, { status: 503 });
      }
      if (!(balanceAfter >= 0)) {
        if (ctx && ctx.waitUntil) ctx.waitUntil(cancelFal(data, env));
        return Response.json({ error: "not enough credits", cost: genCost }, { status: 402 });
      }

      // Record the charge so /api/refund can credit it back if fal never bills
      // us, AND so the idempotency key can recover the job if this response is
      // lost. Stores status/response URLs + idem. AWAITED (with one retry)
      // before responding: this row is the ONLY thing a recovery re-POST or a
      // refund can find, so a fire-and-forget insert that silently failed used
      // to leave a dropped-reply job unrecoverable AND unrefundable — the one
      // path where every charge-loss protection agreed the charge never
      // happened. ~100ms of latency buys a durable record; if both attempts
      // fail we still respond (the client holds the URLs in its own record).
      if (env.SUPABASE_SERVICE_KEY && data.request_id) {
        const insertRec = () => fetch(`${SUPABASE_URL}/rest/v1/gen_charges`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: env.SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            Prefer: "resolution=ignore-duplicates",
          },
          body: JSON.stringify({
            request_id: data.request_id, user_id: genUser.id, cost: genCost,
            idem: idem || null, status_url: data.status_url || null, response_url: data.response_url || null,
          }),
          signal: AbortSignal.timeout(6000),
        });
        try {
          const ok = await insertRec().then((r) => r.ok, () => false);
          if (!ok) { const retry = insertRec().catch(() => {}); if (ctx && ctx.waitUntil) ctx.waitUntil(retry); else await retry; }
        } catch {}
      }

      return Response.json({
        request_id: data.request_id,
        status_url: data.status_url,
        response_url: data.response_url,
        model,
        cost: genCost,
        balance: balanceAfter,
      });
    }

    // ── Memberships: monthly credits at ~$0.012/credit ($0.008 cost basis) ──
    // Checkout creates a Stripe SUBSCRIPTION session; every paid invoice
    // (first charge and each renewal) mints that month's credits via the
    // webhook. Both no-op cleanly until the Stripe secrets are configured.
    const PLANS = {
      "25": { cents: 2499, credits: 2000, name: "isibi Plus — 2,000 credits / month" },
      "50": { cents: 4999, credits: 4000, name: "isibi Pro — 4,000 credits / month" },
      "100": { cents: 9999, credits: 8000, name: "isibi Max — 8,000 credits / month" },
    };
    // One-time top-ups at $0.014/credit — dearer than membership on purpose.
    const TOPUPS = {
      "15": { cents: 1500, credits: 1070 },
      "30": { cents: 3000, credits: 2140 },
      "50": { cents: 5000, credits: 3570 },
      "75": { cents: 7500, credits: 5350 },
      "100": { cents: 10000, credits: 7140 },
    };
    if (url.pathname === "/api/checkout" && request.method === "POST") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      if (!env.STRIPE_SECRET_KEY) {
        return Response.json({ error: "payments not configured yet" }, { status: 501 });
      }
      let body;
      try { body = await request.json(); } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400 });
      }
      const plan = body.plan != null ? PLANS[String(body.plan)] : null;
      const topup = !plan && body.topup != null ? TOPUPS[String(body.topup)] : null;
      if (!plan && !topup) return Response.json({ error: "unknown plan" }, { status: 400 });
      const sub = plan; // memberships are the only subscription
      // Duplicate-membership guard: a second plan checkout would create a SECOND
      // live subscription (double billing). If the caller already has any live
      // subscription, refuse and tell the client to manage the existing one
      // (top-ups are one-time, so they're exempt). Fails open if Stripe is down
      // — a lookup outage must never block a first-time buyer.
      if (sub && user.email) {
        try {
          const sAuth = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
          const cr = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email)}&limit=100`, { headers: sAuth, signal: AbortSignal.timeout(12000) });
          const cd = await cr.json().catch(() => ({}));
          const LIVE = ["active", "trialing", "past_due", "unpaid", "paused"];
          for (const c of ((cd && cd.data) || [])) {
            const srr = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(c.id)}&status=all&limit=10`, { headers: sAuth, signal: AbortSignal.timeout(12000) });
            const sdd = await srr.json().catch(() => ({}));
            if (((sdd && sdd.data) || []).some((s) => LIVE.includes(s.status))) {
              return Response.json({ error: "already_subscribed", reason: "You already have an active membership. Manage or cancel it from Settings before changing plans." }, { status: 409 });
            }
          }
        } catch {} // Stripe unreachable → let the purchase proceed (fail open)
      }
      const form = new URLSearchParams({
        mode: sub ? "subscription" : "payment",
        success_url: "https://isibi.ai/?credits=added",
        cancel_url: "https://isibi.ai/",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String((plan || topup).cents),
      });
      if (sub) {
        form.set("line_items[0][price_data][recurring][interval]", "month");
        form.set("line_items[0][price_data][product_data][name]", sub.name);
        // Subscription metadata rides along on every invoice, so renewals know
        // who to grant (credits for the plan's monthly refill).
        form.set("subscription_data[metadata][user_id]", user.id);
        form.set("subscription_data[metadata][credits]", String(plan.credits));
      } else {
        form.set("line_items[0][price_data][product_data][name]", topup.credits.toLocaleString("en-US") + " isibi credits");
        form.set("metadata[user_id]", user.id);
        form.set("metadata[credits]", String(topup.credits));
      }
      if (user.email) form.set("customer_email", user.email);
      try {
        const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
          signal: AbortSignal.timeout(15000),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.url) return Response.json({ error: "checkout failed" }, { status: 502 });
        return Response.json({ url: data.url });
      } catch {
        return Response.json({ error: "checkout failed" }, { status: 502 });
      }
    }

    // Cancel membership — a focused, cancel-only flow (deliberately NOT Stripe's
    // hosted Billing Portal, which also surfaces invoice history and payment
    // methods; the user wants this to be about cancelling and nothing else).
    // Checkout uses `customer_email`, so Stripe minted a customer per email; we
    // look the caller up by email and find their one live subscription. A POST
    // without `confirm` just reports status ({active, until}); with confirm:true
    // it sets cancel_at_period_end so credits + plan_until keep their rolling
    // 32-day window and simply lapse to free when the paid period ends.
    if (url.pathname === "/api/billing/cancel" && request.method === "POST") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      if (!env.STRIPE_SECRET_KEY) {
        return Response.json({ error: "payments not configured yet" }, { status: 501 });
      }
      if (!user.email) return Response.json({ active: false });
      let body = {};
      try { body = await request.json(); } catch {}
      const sAuth = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
      const LIVE = ["active", "trialing", "past_due", "unpaid", "paused"];
      // Period end lives on the subscription in classic billing and on the first
      // item in flexible billing — check both, then fall back to cancel_at.
      const subUntil = (s) => {
        const u = s.current_period_end ||
          (s.items && s.items.data && s.items.data[0] && s.items.data[0].current_period_end) ||
          s.cancel_at || 0;
        return u ? new Date(u * 1000).toISOString() : null;
      };
      try {
        const cr = await fetch(
          `https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email)}&limit=100`,
          { headers: sAuth, signal: AbortSignal.timeout(15000) },
        );
        const cd = await cr.json().catch(() => ({}));
        const customers = (cd && cd.data) || [];
        // EVERY live subscription across the caller's customers — a duplicate-buy
        // (bug: /api/checkout doesn't block a second plan) can leave two, and a
        // cancel that stopped at the first would leave the user billed on the
        // other. Collect them all.
        const subs = [];
        for (const c of customers) {
          const sr = await fetch(
            `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(c.id)}&status=all&limit=10`,
            { headers: sAuth, signal: AbortSignal.timeout(15000) },
          );
          const sd = await sr.json().catch(() => ({}));
          ((sd && sd.data) || []).forEach((s) => { if (LIVE.includes(s.status)) subs.push(s); });
        }
        if (!subs.length) return Response.json({ active: false });
        const sub = subs[0];
        const until = subUntil(sub);
        // Status probe (no confirm) — lets the client show the end date + whether
        // a cancellation is already scheduled before asking to confirm.
        if (!body.confirm) {
          return Response.json({ active: true, until, alreadyCanceling: !!sub.cancel_at_period_end, count: subs.length });
        }
        // immediate = account deletion: end billing NOW on every subscription
        // (the account is going away; don't leave live subs on a deleted user).
        // Otherwise a normal cancel schedules each at period end.
        for (const s of subs) {
          if (body.immediate) {
            const dr = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(s.id)}`, {
              method: "DELETE", headers: sAuth, signal: AbortSignal.timeout(15000),
            });
            if (!dr.ok) return Response.json({ error: "cancel_failed" }, { status: 502 });
          } else if (!s.cancel_at_period_end) {
            const ur = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(s.id)}`, {
              method: "POST",
              headers: { ...sAuth, "Content-Type": "application/x-www-form-urlencoded" },
              body: "cancel_at_period_end=true",
              signal: AbortSignal.timeout(15000),
            });
            if (!ur.ok) return Response.json({ error: "cancel_failed" }, { status: 502 });
          }
        }
        return Response.json({ cancelled: true, until, count: subs.length });
      } catch {
        return Response.json({ error: "cancel_failed" }, { status: 502 });
      }
    }

    if (url.pathname === "/api/stripe/webhook" && request.method === "POST") {
      // add_credits is now REVOKEd from anon/authenticated, so the webhook must
      // call it with the service_role key — require that secret too.
      if (!env.STRIPE_WEBHOOK_SECRET || !env.CREDITS_MINT_SECRET || !env.SUPABASE_SERVICE_KEY) {
        return Response.json({ error: "not configured" }, { status: 501 });
      }
      const tooBig = tooLargeBody(request, 262_144); // public+unauth endpoint — cap before buffering the body twice for HMAC
      if (tooBig) return tooBig;
      const raw = await request.text();
      // Stripe-Signature: t=<unix>,v1=<hmac>,v1=<hmac>,... During a webhook-secret
      // rotation Stripe signs with EVERY active secret, so collect all v1 values and
      // accept if ANY matches — keeping only the last would 400 a legit paid invoice.
      let t = 0; const v1s = [];
      for (const p of (request.headers.get("Stripe-Signature") || "").split(",")) {
        const i = p.indexOf("=");
        if (i <= 0) continue;
        const k = p.slice(0, i).trim(), v = p.slice(i + 1).trim();
        if (k === "t") t = Number(v);
        else if (k === "v1") v1s.push(v);
      }
      if (!t || Math.abs(Date.now() / 1000 - t) > 300 || !v1s.length) {
        return Response.json({ error: "bad signature" }, { status: 400 });
      }
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw", enc.encode(env.STRIPE_WEBHOOK_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
      );
      const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${raw}`));
      const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
      // Constant-time compare against each candidate signature (can't be timing-probed).
      const ctEq = (a, b) => {
        let mismatch = a.length ^ b.length;
        for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
        return mismatch === 0;
      };
      if (!v1s.some((sig) => ctEq(hex, String(sig)))) {
        return Response.json({ error: "bad signature" }, { status: 400 });
      }

      let event;
      try { event = JSON.parse(raw); } catch {
        return Response.json({ error: "bad payload" }, { status: 400 });
      }
      // One-time top-ups mint on session completion (payment mode only —
      // membership sessions mint via their invoice instead).
      if (event.type === "checkout.session.completed") {
        const s = event.data && event.data.object;
        const uid = s && s.metadata && s.metadata.user_id;
        const credits = s && s.metadata ? Number(s.metadata.credits) : 0;
        if (s && s.mode === "payment" && s.payment_status === "paid" && s.id && uid && credits > 0) {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/add_credits`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({
              target: uid, amount: credits, cents: s.amount_total || 0,
              purchase_ref: s.id, mint_key: env.CREDITS_MINT_SECRET,
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (!r.ok) return Response.json({ error: "credit grant failed" }, { status: 500 });
        }
      }
      // Memberships mint on every PAID INVOICE — the first charge and each
      // monthly renewal both arrive here. Handle ONLY invoice.paid (Stripe
      // also emits invoice.payment_succeeded for the same invoice; listening to
      // both would call add_credits twice — safe via the ref UNIQUE, but wasteful).
      if (event.type === "invoice.paid") {
        const inv = event.data && event.data.object;
        // Subscription metadata's location varies by Stripe API version.
        const meta =
          (inv && inv.subscription_details && inv.subscription_details.metadata) ||
          (inv && inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.metadata) ||
          (inv && inv.lines && inv.lines.data && inv.lines.data[0] && inv.lines.data[0].metadata) ||
          {};
        const uid = meta.user_id;
        const credits = Number(meta.credits) || 0;
        const paid = inv && (inv.status === "paid" || inv.paid === true);
        // Require money to have actually changed hands — a $0/fully-discounted
        // invoice (coupon, proration, pause) must not mint a full month of credits.
        const amountPaid = Number(inv && inv.amount_paid) || 0;
        if (uid && credits > 0 && paid && amountPaid > 0 && inv.id) {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/add_credits`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({
              target: uid, amount: credits, cents: inv.amount_paid || 0,
              purchase_ref: inv.id, mint_key: env.CREDITS_MINT_SECRET,
            }),
            signal: AbortSignal.timeout(10000),
          });
          // Non-2xx → 500 so Stripe retries the delivery.
          if (!r.ok) return Response.json({ error: "credit grant failed" }, { status: 500 });
          // Record the storage tier (from the plan's credit size) on a rolling
          // 32-day window — a cancellation lapses to free once no invoice renews.
          const tier = credits >= 8000 ? "max" : credits >= 4000 ? "pro" : "plus";
          // set_plan MUST succeed — otherwise the paid customer's storage tier
          // never activates and every save 402s "free" (bug 2026-07-17: this was
          // swallowed and the webhook returned 200, so Stripe never retried).
          // add_credits is idempotent on purchase_ref, so a full-webhook retry
          // re-runs it safely; return 500 on any set_plan failure to trigger it.
          let planOk = false;
          try {
            const pr = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_plan`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
              body: JSON.stringify({
                target: uid, p_tier: tier,
                p_until: new Date(Date.now() + 32 * 86400000).toISOString(),
                mint_key: env.CREDITS_MINT_SECRET,
              }),
              signal: AbortSignal.timeout(10000),
            });
            planOk = pr.ok;
          } catch {}
          if (!planOk) return Response.json({ error: "plan activation failed" }, { status: 500 });
        }
      }
      return Response.json({ received: true });
    }

    // Owner-only live probe of the platform balance the Worker's FAL_KEY sees
    // (diagnoses guard-vs-dashboard mismatches without guessing). Cache-busted
    // so it's always a fresh read. Run from the app console:
    //   await (await apiFetch('/api/fal-balance')).json()
    if (url.pathname === "/api/fal-balance" && request.method === "GET") {
      const u = await authUser(request);
      if (!u) return UNAUTHED();
      if (!["aniascapital@gmail.com", "aniascristian@gmail.com"].includes((u.email || "").toLowerCase())) return Response.json({ error: "not allowed" }, { status: 403 });
      _falBal = { at: 0, usd: null };
      const usd = await falBalanceUSD(env);
      return Response.json({ usd, note: usd === null ? "balance unreadable (endpoint down or key not admin-scoped) — the guard FAILS OPEN on this" : usd < 0.5 ? "below the $0.50 guard threshold — generations are being refused" : "above threshold — guard passes" });
    }

    // Current credit balance (creates the row with the signup grant on first touch).
    if (url.pathname === "/api/credits" && request.method === "GET") {
      if (!(await authUser(request))) return UNAUTHED();
      const rpcHeaders = {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: request.headers.get("Authorization") || "",
      };
      try {
        // paid = has ever purchased; free accounts get watermarked outputs.
        const [r, p] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/rpc/get_credits`, { method: "POST", headers: rpcHeaders, body: "{}", signal: AbortSignal.timeout(10000) }),
          fetch(`${SUPABASE_URL}/rest/v1/rpc/is_paid`, { method: "POST", headers: rpcHeaders, body: "{}", signal: AbortSignal.timeout(10000) }).catch(() => null),
        ]);
        if (!r.ok) throw 0;
        let paid = false;
        try { paid = p && p.ok ? (await p.json()) === true : false; } catch {}
        return Response.json({ balance: Number(await r.json()), paid });
      } catch {
        return Response.json({ error: "credits unavailable" }, { status: 503 });
      }
    }

    // Gallery storage usage vs the caller's tier cap ({used, cap, tier} bytes).
    if (url.pathname === "/api/storage" && request.method === "GET") {
      if (!(await authUser(request))) return UNAUTHED();
      try {
        const s = await storageStatus(request);
        if (!s) throw 0;
        return Response.json(s);
      } catch {
        return Response.json({ error: "storage unavailable" }, { status: 503 });
      }
    }

    // The gallery reads what's ACTUALLY saved in the caller's storage, not what
    // their chat history happens to still reference — so a saved file survives
    // deleting the chat it was made in (files were orphaning otherwise). Returns
    // one row per stored object: its public URL, kind (from extension), size,
    // and created_at. The frontend overlays chat metadata (prompt/poster) when
    // it still has it, but existence is driven by storage.
    if (url.pathname === "/api/gallery" && request.method === "GET") {
      if (!(await authUser(request))) return UNAUTHED();
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/list_media`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: request.headers.get("Authorization") || "" },
          body: "{}",
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) throw 0;
        const rows = await r.json();
        const kindOf = (name) => {
          const ext = String(name).split(".").pop().toLowerCase();
          if (["mp4", "mov", "webm", "m4v"].includes(ext)) return "video";
          if (["mp3", "wav", "m4a", "ogg", "aac", "flac"].includes(ext)) return "audio";
          return "image"; // jpg/jpeg/png/webp/gif
        };
        const items = (Array.isArray(rows) ? rows : [])
          // Skip the internal subfolders. <uid>/chat/ = files unlisted from the
          // gallery but kept for the chat message(s) that still show them.
          // <uid>/site/ = photos the Website Builder generated for a published
          // site — they live in the user's bucket but are NOT their own creative
          // generations, so they never belong in the Gallery.
          .filter((o) => { const seg = String(o.name || "").split("/")[1]; return seg !== "chat" && seg !== "site"; })
          .map((o) => {
            const name = String(o.name || "");
            // Filenames are `<ms>-<hash>.<ext>`; the leading ms is the creation
            // time (falls back to the row's created_at).
            const tsM = name.split("/").pop().match(/^(\d{10,})-/);
            const at = tsM ? Number(tsM[1]) : (Date.parse(o.created_at) || 0);
            return { url: `${SUPABASE_URL}/storage/v1/object/public/media/${name}`, kind: kindOf(name), size: Number(o.size) || 0, at };
          });
        return Response.json({ items });
      } catch {
        return Response.json({ error: "gallery unavailable" }, { status: 503 });
      }
    }

    // Delete-from-gallery while a chat message still shows the file: the file
    // must stay alive (a gallery delete may not break the chat — owner's call,
    // 2026-07-16), so instead of deleting we move it out of the gallery listing
    // to media/<uid>/chat/<file>. The client then rewrites its chat messages to
    // the new URL. Needs the service key (the bucket's RLS has no UPDATE
    // policy), so the caller's own-prefix is enforced strictly.
    if (url.pathname === "/api/media/unlist" && request.method === "POST") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY) return Response.json({ error: "unavailable" }, { status: 503 });
      let body;
      try { body = await request.json(); } catch { return Response.json({ error: "bad body" }, { status: 400 }); }
      const m = String((body && body.url) || "").match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
      const key = m ? decodeURIComponent(m[1]) : "";
      // Only the caller's own TOP-LEVEL files: `<their uid>/<file>` exactly —
      // never another user's object, never a subpath (already-unlisted chat/
      // files, traversal tricks).
      const fname = key.startsWith(`${user.id}/`) ? key.slice(user.id.length + 1) : "";
      if (!fname || fname.includes("/")) return Response.json({ error: "bad key" }, { status: 400 });
      const dest = `${user.id}/chat/${fname}`;
      try {
        const r = await fetch(`${SUPABASE_URL}/storage/v1/object/move`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: env.SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ bucketId: "media", sourceKey: key, destinationKey: dest }),
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw 0;
        return Response.json({ url: `${SUPABASE_URL}/storage/v1/object/public/media/${dest}` });
      } catch {
        return Response.json({ error: "move failed" }, { status: 502 });
      }
    }

    // ── Media Agent: social account connections via Composio ──
    // Connection status for the current user's Instagram + YouTube.
    if (url.pathname === "/api/social/status" && request.method === "GET") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      if (!env.COMPOSIO_API_KEY) return Response.json({ error: "social not configured" }, { status: 501 });
      try {
        const conns = await composioConnections(env, user.id, null);
        return Response.json({
          instagram: socialSlot(conns, "instagram"),
          youtube: socialSlot(conns, "youtube"),
        });
      } catch {
        return Response.json({ error: "social status unavailable" }, { status: 503 });
      }
    }

    // Start an OAuth link session — returns the URL the client opens in a popup.
    if (url.pathname === "/api/social/connect" && request.method === "POST") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      if (!env.COMPOSIO_API_KEY) return Response.json({ error: "social not configured" }, { status: 501 });
      let body;
      try { body = await request.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
      const toolkit = String(body.toolkit || "").toLowerCase();
      if (!SOCIAL_TOOLKITS[toolkit]) return Response.json({ error: "unknown toolkit" }, { status: 400 });
      try {
        const authConfigId = await composioAuthConfigId(env, toolkit, user.id);
        // No auth config yet → the user must create it in the Composio dashboard
        // (it holds the Meta/Google app credentials we can't provision for them).
        if (!authConfigId) return Response.json({ error: "no_auth_config", toolkit }, { status: 409 });
        const r = await composioFetch(env, "/connected_accounts/link", {
          method: "POST",
          body: JSON.stringify({ auth_config_id: authConfigId, user_id: user.id }),
        });
        if (!r.ok) {
          const detail = (await r.text().catch(() => "")).slice(0, 300);
          return Response.json({ error: "connect failed", detail }, { status: 502 });
        }
        const d = await r.json();
        return Response.json({ redirect_url: d.redirect_url, connected_account_id: d.connected_account_id });
      } catch {
        return Response.json({ error: "connect failed" }, { status: 502 });
      }
    }

    // Disconnect — deletes this user's connected account(s) for a toolkit.
    if (url.pathname === "/api/social/disconnect" && request.method === "POST") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      if (!env.COMPOSIO_API_KEY) return Response.json({ error: "social not configured" }, { status: 501 });
      let body;
      try { body = await request.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
      const toolkit = String(body.toolkit || "").toLowerCase();
      if (!SOCIAL_TOOLKITS[toolkit]) return Response.json({ error: "unknown toolkit" }, { status: 400 });
      try {
        // Scoped to user.id, so only the caller's own connections are removed.
        const conns = await composioConnections(env, user.id, toolkit);
        await Promise.all(conns.map((c) =>
          composioFetch(env, `/connected_accounts/${encodeURIComponent(c.id)}`, { method: "DELETE" }).catch(() => {})
        ));
        return Response.json({ ok: true });
      } catch {
        return Response.json({ error: "disconnect failed" }, { status: 502 });
      }
    }

    // Instagram Direct Messages inbox. GET → conversations, or ?conversation_id
    // → that thread's messages. Read via the user's own connection.
    if (url.pathname === "/api/social/dm" && request.method === "GET") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      if (!env.COMPOSIO_API_KEY) return Response.json({ error: "social not configured" }, { status: 501 });
      const ident = { userId: user.id };
      const convId = url.searchParams.get("conversation_id");
      try {
        const info = await composioExecute(env, "INSTAGRAM_GET_USER_INFO", ident, {});
        const me = info.data && info.data.username;
        const msgsOf = (d) => (d && (d.data || (d.messages && d.messages.data))) || [];
        if (convId) {
          const m = await composioExecute(env, "INSTAGRAM_LIST_ALL_MESSAGES", ident, { conversation_id: convId });
          const list = msgsOf(m.data).map((x) => ({
            id: x.id, from: x.from && x.from.username, mine: (x.from && x.from.username) === me,
            text: x.message || "", at: x.created_time,
          })).reverse();
          return Response.json({ me, messages: list });
        }
        const c = await composioExecute(env, "INSTAGRAM_LIST_ALL_CONVERSATIONS", ident, {});
        const items = (c.data && (c.data.data || c.data.conversations || c.data.items)) || [];
        // Fetch each conversation's messages in PARALLEL — doing them one-by-one
        // meant ~14 sequential Composio calls and the tab hung on "Loading".
        const convs = await Promise.all(items.slice(0, 12).map(async (it) => {
          try {
            const cm = await composioExecute(env, "INSTAGRAM_LIST_ALL_MESSAGES", ident, { conversation_id: it.id });
            const ml = msgsOf(cm.data);
            const other = ml.map((x) => x.from).find((f) => f && f.username && f.username !== me);
            const last = ml[0];
            return {
              id: it.id, user: other ? other.username : "unknown", user_id: other ? other.id : null,
              last: last ? (last.message || "").slice(0, 80) : "", at: it.updated_time,
            };
          } catch {
            return { id: it.id, user: "unknown", user_id: null, last: "", at: it.updated_time };
          }
        }));
        return Response.json({ me, conversations: convs });
      } catch {
        return Response.json({ error: "dm unavailable" }, { status: 503 });
      }
    }

    // Send a DM reply. Only within Instagram's 24h window; user-initiated.
    if (url.pathname === "/api/social/dm/send" && request.method === "POST") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      if (!env.COMPOSIO_API_KEY) return Response.json({ error: "social not configured" }, { status: 501 });
      if (!(await useQuota(request, "dm", 200))) return QUOTA_EXCEEDED();
      let body;
      try { body = await request.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
      const recipient = String(body.recipient_id || "");
      const text = String(body.text || "").slice(0, 900);
      if (!recipient || !text) return Response.json({ error: "missing recipient or text" }, { status: 400 });
      try {
        const ex = await composioExecute(env, "INSTAGRAM_SEND_TEXT_MESSAGE", { userId: user.id }, { recipient_id: recipient, text });
        if (!ex.successful) return Response.json({ ok: false, error: String(composioErrText(ex.error) || "").slice(0, 200) }, { status: 502 });
        return Response.json({ ok: true });
      } catch {
        return Response.json({ ok: false, error: "send failed" }, { status: 502 });
      }
    }

    // Publish media to a connected account. Called ONLY after the user confirms
    // in the UI — writes are never triggered autonomously by the agent model.
    if (url.pathname === "/api/social/publish" && request.method === "POST") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      if (!env.COMPOSIO_API_KEY) return Response.json({ error: "social not configured" }, { status: 501 });
      if (!(await useQuota(request, "publish", 30))) return QUOTA_EXCEEDED();
      let body;
      try { body = await request.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
      try {
        const res = await socialPublish(env, user.id, body);
        return Response.json(res, { status: res.ok ? 200 : 502 });
      } catch {
        return Response.json({ ok: false, error: "publish failed" }, { status: 502 });
      }
    }

    // Analytics dashboard for a connected account (read-only). Instagram and
    // YouTube; returns a normalized payload with null for anything unavailable.
    if (url.pathname === "/api/social/analytics" && request.method === "GET") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      if (!env.COMPOSIO_API_KEY) return Response.json({ error: "social not configured" }, { status: 501 });
      if (!(await useQuota(request, "analytics", 120))) return QUOTA_EXCEEDED();
      const platform = (url.searchParams.get("platform") || "instagram").toLowerCase();
      if (platform !== "instagram" && platform !== "youtube") {
        return Response.json({ error: "unsupported platform" }, { status: 400 });
      }
      try {
        const data = platform === "youtube"
          ? await youtubeAnalytics(env, user.id)
          : await instagramAnalytics(env, user.id, url.searchParams.get("debug") === "1");
        return Response.json({ ok: true, platform, ...data });
      } catch {
        return Response.json({ error: "analytics unavailable" }, { status: 503 });
      }
    }

    // The user's Instagram posts for the Posts tab (read-only). Instagram only.
    if (url.pathname === "/api/social/posts" && request.method === "GET") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      if (!env.COMPOSIO_API_KEY) return Response.json({ error: "social not configured" }, { status: 501 });
      if (!(await useQuota(request, "analytics", 120))) return QUOTA_EXCEEDED();
      const platform = (url.searchParams.get("platform") || "instagram").toLowerCase();
      if (platform !== "instagram" && platform !== "youtube") {
        return Response.json({ error: "unsupported platform" }, { status: 400 });
      }
      try {
        const data = platform === "youtube"
          ? await youtubeVideos(env, user.id, 40)
          : await instagramPosts(env, user.id, 48);
        return Response.json({ ok: true, platform, ...data });
      } catch {
        return Response.json({ error: "posts unavailable" }, { status: 503 });
      }
    }

    // The user's YouTube playlists (read-only).
    if (url.pathname === "/api/social/playlists" && request.method === "GET") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      if (!env.COMPOSIO_API_KEY) return Response.json({ error: "social not configured" }, { status: 501 });
      if (!(await useQuota(request, "analytics", 120))) return QUOTA_EXCEEDED();
      const platform = (url.searchParams.get("platform") || "youtube").toLowerCase();
      if (platform !== "youtube") return Response.json({ error: "unsupported platform" }, { status: 400 });
      try {
        const data = await youtubePlaylists(env, user.id);
        return Response.json({ ok: true, ...data });
      } catch {
        return Response.json({ error: "playlists unavailable" }, { status: 503 });
      }
    }

    // Recent comments across the user's Instagram posts (read-only).
    if (url.pathname === "/api/social/comments" && request.method === "GET") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      if (!env.COMPOSIO_API_KEY) return Response.json({ error: "social not configured" }, { status: 501 });
      if (!(await useQuota(request, "analytics", 120))) return QUOTA_EXCEEDED();
      const platform = (url.searchParams.get("platform") || "instagram").toLowerCase();
      if (platform !== "instagram") return Response.json({ error: "unsupported platform" }, { status: 400 });
      try {
        const data = await instagramComments(env, user.id);
        return Response.json({ ok: true, ...data });
      } catch {
        return Response.json({ error: "comments unavailable" }, { status: 503 });
      }
    }

    // Manually reply to one Instagram comment (user-initiated from the Comments
    // tab). Posts a public reply via INSTAGRAM_POST_IG_COMMENT_REPLIES.
    if (url.pathname === "/api/social/comment/reply" && request.method === "POST") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      if (!env.COMPOSIO_API_KEY) return Response.json({ error: "social not configured" }, { status: 501 });
      const body = await request.json().catch(() => ({}));
      const commentId = String(body.comment_id || "").trim();
      const message = String(body.message || "").trim().slice(0, 300);
      if (!commentId || !message) return Response.json({ ok: false, error: "missing comment or message" }, { status: 400 });
      try {
        const ex = await composioExecute(env, "INSTAGRAM_POST_IG_COMMENT_REPLIES", { userId: user.id }, {
          ig_comment_id: commentId, message,
        });
        if (!ex.successful) return Response.json({ ok: false, error: composioErrText(ex.error) || "reply failed" }, { status: 502 });
        return Response.json({ ok: true, id: (ex.data && (ex.data.id || (ex.data.data && ex.data.data.id))) || null });
      } catch (e) {
        return Response.json({ ok: false, error: String((e && e.message) || e) }, { status: 502 });
      }
    }

    // Auto-reply config (prompt-driven auto-replies to DMs/comments). Stored
    // per-user in user_autoreply (RLS own-row). The execution engine that acts
    // on this config is separate; here we only load/save the settings.
    if (url.pathname === "/api/social/autoreply" && request.method === "GET") {
      if (!(await authUser(request))) return UNAUTHED();
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/user_autoreply?select=dm_enabled,dm_prompt,comment_enabled,comment_prompt&limit=1`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: request.headers.get("Authorization") || "" },
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) throw 0;
        const rows = await r.json().catch(() => []);
        return Response.json((Array.isArray(rows) && rows[0]) ||
          { dm_enabled: false, dm_prompt: "", comment_enabled: false, comment_prompt: "" });
      } catch {
        return Response.json({ error: "autoreply unavailable" }, { status: 503 });
      }
    }
    if (url.pathname === "/api/social/autoreply" && request.method === "POST") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      let body;
      try { body = await request.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
      const row = {
        user_id: user.id,
        dm_enabled: !!body.dm_enabled,
        dm_prompt: String(body.dm_prompt || "").slice(0, 4000),
        comment_enabled: !!body.comment_enabled,
        comment_prompt: String(body.comment_prompt || "").slice(0, 4000),
        updated_at: new Date().toISOString(),
      };
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/user_autoreply?on_conflict=user_id`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY, Authorization: request.headers.get("Authorization") || "",
            "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify(row),
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return Response.json({ error: "save failed" }, { status: 502 });
        return Response.json({ ok: true });
      } catch {
        return Response.json({ error: "save failed" }, { status: 502 });
      }
    }

    // Media Agent brain — chat that inspects the user's IG/YT via Composio
    // tool-use (read-only). Rate-limited; no credit charge (like the director).
    if (url.pathname === "/api/agent" && request.method === "POST") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      if (!env.ANTHROPIC_API_KEY || !env.COMPOSIO_API_KEY)
        return Response.json({ error: "agent not configured" }, { status: 501 });
      if (!(await useQuota(request, "agent", 120))) return QUOTA_EXCEEDED();
      let body;
      try { body = await request.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
      // Client holds the plain-text history; take the recent tail, sanitized.
      const turns = (Array.isArray(body.messages) ? body.messages : [])
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
      if (!turns.length || turns[turns.length - 1].role !== "user")
        return Response.json({ error: "no message" }, { status: 400 });

      const conns = await composioConnections(env, user.id, null);
      const connected = { instagram: socialSlot(conns, "instagram").connected, youtube: socialSlot(conns, "youtube").connected };
      const system = agentSystemPrompt(connected);
      const agentTool = {
        name: "run_action",
        description: "Run one read-only action on the user's connected social account and return its JSON result.",
        input_schema: {
          type: "object",
          properties: {
            action: { type: "string", description: "The action slug to run — must be one of the allowed actions listed in the system prompt." },
            arguments: { type: "object", description: "Arguments object for the action (e.g. {\"mine\": true}). Use {} when none are needed." },
          },
          required: ["action"],
        },
      };

      const actionsLog = [];
      for (let hop = 0; hop < 6; hop++) {
        let r;
        try {
          r = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
            body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 1500, system, tools: [agentTool], messages: turns }),
            signal: AbortSignal.timeout(60000),
          });
        } catch {
          return Response.json({ error: "agent request failed" }, { status: 502 });
        }
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return Response.json({ error: "agent error" }, { status: 502 });
        const content = data.content || [];
        const toolUses = content.filter((c) => c.type === "tool_use");
        if (data.stop_reason !== "tool_use" || !toolUses.length) {
          const reply = content.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
          return Response.json({ reply: reply || "(no reply)", actions: actionsLog });
        }
        turns.push({ role: "assistant", content });
        const results = [];
        for (const tu of toolUses) {
          const slug = String(tu.input?.action || "");
          let out;
          if (!AGENT_ALLOW.has(slug)) {
            out = { error: "action not allowed: " + slug };
          } else {
            const ex = await composioExecute(env, slug, { userId: user.id }, tu.input.arguments || {});
            out = ex.successful ? ex.data : { error: ex.error || "action failed" };
            actionsLog.push(slug);
          }
          results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out).slice(0, 8000) });
        }
        turns.push({ role: "user", content: results });
      }
      return Response.json({ reply: "I ran several steps but couldn't wrap that up — try narrowing the question.", actions: actionsLog });
    }

    // ── Website Builder engine ────────────────────────────────────────────
    // A SEPARATE product from the media studio; shares only the ✦ ledger.
    // Engine (owner 2026-07-18): Gemini-only — one model designs AND engineers
    // the whole single-file site (build) and applies revisions. (The Opus
    // hardening/architecture pass was removed 2026-07-18, owner's call — its
    // requirements are folded into the Gemini prompts.) Charged up front through
    // use_credits exactly like /api/direct; every terminal failure refunds the
    // full fee via credit_back (looped — that RPC caps 10 credits per call).
    // Phase-3 smoke test: prove the build-service container deploys + responds on
    // this account before wiring the full React pipeline onto it. Auth'd; hits the
    // container's /health and reports status + cold-start latency. Safe: touches
    // nothing in the live static builder.
    if (url.pathname === "/api/site/build-health" && request.method === "GET") {
      const bhUser = await authUser(request);
      if (!bhUser) return UNAUTHED();
      if (!env.BUILD_CONTAINER) return Response.json({ ok: false, error: "container binding not configured" }, { status: 501 });
      const t0 = Date.now();
      try {
        const c = getContainer(env.BUILD_CONTAINER);
        const r = await c.fetch(new Request("http://build/health", { method: "GET" }));
        const body = await r.text();
        return Response.json({ ok: r.ok, status: r.status, body: body.slice(0, 100), ms: Date.now() - t0 });
      } catch (e) {
        return Response.json({ ok: false, error: String(e && e.message || e).slice(0, 300), ms: Date.now() - t0 }, { status: 502 });
      }
    }
    // Phase 3b — the REACT build pipeline (behind its own endpoint; the static
    // /api/site path is untouched). Sonnet(REACT_RULES) → parseGeneratedFiles →
    // inject real images into the SOURCE → container `vite build` → dist → R2 at
    // sites/<slug>/… → served by the /s/<slug>/ route. Metered like the static
    // builder (Sonnet tokens + each generated image). Returns the compile error
    // (no charge for the build itself) when the generated project doesn't compile
    // — the Phase-4 auto-fix loop will consume that.
    // Layer-2 Phase A plumbing test: provision (or reuse) a site's own D1 database,
    // then create a table + write + read INSIDE that database — proving per-site
    // isolation end to end. Auth-gated; owner-scoped via ensureSiteBackend.
    if (url.pathname === "/api/site/backend/ensure" && request.method === "POST") {
      const u = await authUser(request); if (!u) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY) return Response.json({ ok: false, error: "service key not configured" }, { status: 501 });
      if (!d1Configured(env)) return Response.json({ ok: false, error: "per-site backend not configured yet", need: "cf_token" }, { status: 501 });
      let bb; try { bb = await request.json(); } catch { return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
      const slug = typeof bb.slug === "string" ? bb.slug.replace(/[^a-z0-9-]/gi, "").slice(0, 60) : "";
      if (!slug) return Response.json({ ok: false, error: "missing slug" }, { status: 400 });
      try {
        const uuid = await ensureSiteBackend(env, slug, u.id);
        await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _ping (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT)");
        await cfD1Query(env, uuid, "INSERT INTO _ping (at) VALUES (?)", [new Date().toISOString()]);
        const rows = await cfD1Query(env, uuid, "SELECT COUNT(*) AS n FROM _ping");
        return Response.json({ ok: true, slug, d1: String(uuid).slice(0, 8) + "…", pings: (rows[0] || {}).n });
      } catch (e) {
        if (e && e.forbidden) return UNAUTHED();
        console.error("site backend ensure failed:", e && e.message, e && e.detail);
        return Response.json({ ok: false, error: "backend provisioning failed", detail: (e && e.detail) || null }, { status: 502 });
      }
    }
    // Phase B test: apply a declared table schema to a site's own D1 and list the
    // resulting tables. Auth-gated + owner-scoped. Validated identifiers only.
    if (url.pathname === "/api/site/backend/schema" && request.method === "POST") {
      const u = await authUser(request); if (!u) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY) return Response.json({ ok: false, error: "service key not configured" }, { status: 501 });
      if (!d1Configured(env)) return Response.json({ ok: false, error: "per-site backend not configured yet", need: "cf_token" }, { status: 501 });
      let bb; try { bb = await request.json(); } catch { return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
      const slug = typeof bb.slug === "string" ? bb.slug.replace(/[^a-z0-9-]/gi, "").slice(0, 60) : "";
      if (!slug || !bb.schema) return Response.json({ ok: false, error: "missing slug or schema" }, { status: 400 });
      try {
        const uuid = await ensureSiteBackend(env, slug, u.id);
        const made = await applySiteSchema(env, uuid, bb.schema);
        const rows = await cfD1Query(env, uuid, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_cf_KV' ORDER BY name");
        return Response.json({ ok: true, slug, created: made, tables: rows.map((r) => r.name) });
      } catch (e) {
        if (e && e.forbidden) return UNAUTHED();
        if (e && e.bad) return Response.json({ ok: false, error: "invalid table or column name" }, { status: 400 });
        console.error("site schema failed:", e && e.message, e && e.detail);
        return Response.json({ ok: false, error: "schema apply failed", detail: (e && e.detail) || null }, { status: 502 });
      }
    }
    // Full site delete (isibi-authed, owner-scoped): wipe EVERYTHING for a slug —
    // the published files + source in R2, the D1 database, and its mapping row.
    // Ownership is proven from the React source's uid and/or the site_backends row.
    if (url.pathname === "/api/site/backend/delete" && request.method === "POST") {
      const u = await authUser(request); if (!u) return UNAUTHED();
      let bb; try { bb = await request.json(); } catch { return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
      const slug = typeof bb.slug === "string" ? bb.slug.replace(/[^a-z0-9-]/gi, "").slice(0, 60) : "";
      if (!slug) return Response.json({ ok: false, error: "missing slug" }, { status: 400 });
      let owned = false, dbuuid = null;
      // (a) the persisted React source records the owner uid
      try { const o = await env.SITES_BUCKET.get("sitesrc/" + slug + ".json"); if (o) { const j = JSON.parse(await o.text()); if (j && j.uid === u.id) owned = true; } } catch {}
      // (b) the backend mapping row (also gives us the D1 uuid to delete)
      if (env.SUPABASE_SERVICE_KEY) {
        try {
          const g = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(slug)}&select=d1_uuid,uid`, { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
          const rows = await g.json().catch(() => []);
          if (rows[0]) { if (rows[0].uid && rows[0].uid !== u.id) return Response.json({ ok: false, error: "not your site" }, { status: 403 }); if (rows[0].uid === u.id) owned = true; dbuuid = rows[0].d1_uuid; }
        } catch {}
      }
      if (!owned) return Response.json({ ok: false, error: "not your site" }, { status: 403 });
      // 1) the site's own database + its mapping row
      if (dbuuid && d1Configured(env)) { try { await cfD1Delete(env, dbuuid); } catch {} }
      if (env.SUPABASE_SERVICE_KEY) {
        const svcH = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
        try { await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(slug)}`, { method: "DELETE", headers: svcH }); } catch {}
        // Secrets + functions for this site (owner-scoped so a shared slug can't wipe another owner's).
        try { await fetch(`${SUPABASE_URL}/rest/v1/site_secrets?slug=eq.${encodeURIComponent(slug)}&owner_id=eq.${u.id}`, { method: "DELETE", headers: svcH }); } catch {}
        try { await fetch(`${SUPABASE_URL}/rest/v1/site_functions?slug=eq.${encodeURIComponent(slug)}&owner_id=eq.${u.id}`, { method: "DELETE", headers: svcH }); } catch {}
      }
      // 2) R2: published dist, uploads, backups, and the generated source
      try { const l = await env.SITES_BUCKET.list({ prefix: "sites/" + slug + "/" }); for (const o of (l.objects || [])) await env.SITES_BUCKET.delete(o.key); } catch {}
      try { const l = await env.SITES_BUCKET.list({ prefix: "uploads/" + slug + "/" }); for (const o of (l.objects || [])) await env.SITES_BUCKET.delete(o.key); } catch {}
      try { const l = await env.SITES_BUCKET.list({ prefix: "backups/" + slug + "/" }); for (const o of (l.objects || [])) await env.SITES_BUCKET.delete(o.key); } catch {}
      try { const l = await env.SITES_BUCKET.list({ prefix: "builds/" + slug + "/" }); for (const o of (l.objects || [])) await env.SITES_BUCKET.delete(o.key); } catch {}
      try { await env.SITES_BUCKET.delete("sitesrc/" + slug + ".json"); } catch {}
      return Response.json({ ok: true });
    }
    // Wipe EVERY site the caller owns — called by the account-deletion flow so a
    // deleted isibi account never orphans a D1 database. Authoritative source is
    // the site_backends ledger (all the user's D1-backed sites, regardless of
    // which device built them); the client may also pass its locally-known slugs
    // so informational sites (no D1, R2 source only) get their R2 cleaned too.
    if (url.pathname === "/api/site/backend/delete-all" && request.method === "POST") {
      const u = await authUser(request); if (!u) return UNAUTHED();
      let bb = {}; try { bb = await request.json(); } catch {}
      const wipeR2 = async (slug) => {
        try { const l = await env.SITES_BUCKET.list({ prefix: "sites/" + slug + "/" }); for (const o of (l.objects || [])) await env.SITES_BUCKET.delete(o.key); } catch {}
        try { const l = await env.SITES_BUCKET.list({ prefix: "uploads/" + slug + "/" }); for (const o of (l.objects || [])) await env.SITES_BUCKET.delete(o.key); } catch {}
        try { const l = await env.SITES_BUCKET.list({ prefix: "backups/" + slug + "/" }); for (const o of (l.objects || [])) await env.SITES_BUCKET.delete(o.key); } catch {}
        try { const l = await env.SITES_BUCKET.list({ prefix: "builds/" + slug + "/" }); for (const o of (l.objects || [])) await env.SITES_BUCKET.delete(o.key); } catch {}
        try { await env.SITES_BUCKET.delete("sitesrc/" + slug + ".json"); } catch {}
      };
      const done = new Set();
      let removed = 0;
      // (1) every D1-backed site in the ledger — the part that must not orphan.
      if (env.SUPABASE_SERVICE_KEY) {
        try {
          const g = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?uid=eq.${encodeURIComponent(u.id)}&select=slug,d1_uuid`, { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
          const rows = await g.json().catch(() => []);
          for (const row of (Array.isArray(rows) ? rows : [])) {
            const slug = String(row.slug || "").replace(/[^a-z0-9-]/gi, "").slice(0, 60);
            if (!slug || done.has(slug)) continue;
            if (row.d1_uuid && d1Configured(env)) { try { await cfD1Delete(env, row.d1_uuid); } catch {} }
            if (env.SITES_BUCKET) await wipeR2(slug);
            done.add(slug); removed++;
          }
          // Drop all the caller's mapping rows + secrets + functions in one shot.
          const svcH = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
          try { await fetch(`${SUPABASE_URL}/rest/v1/site_backends?uid=eq.${encodeURIComponent(u.id)}`, { method: "DELETE", headers: svcH }); } catch {}
          try { await fetch(`${SUPABASE_URL}/rest/v1/site_secrets?owner_id=eq.${encodeURIComponent(u.id)}`, { method: "DELETE", headers: svcH }); } catch {}
          try { await fetch(`${SUPABASE_URL}/rest/v1/site_functions?owner_id=eq.${encodeURIComponent(u.id)}`, { method: "DELETE", headers: svcH }); } catch {}
        } catch (e) { console.error("delete-all ledger sweep failed:", e && e.message); }
      }
      // (2) client-known slugs (informational sites with no ledger row) — verify
      // ownership from the persisted source before wiping its R2.
      if (env.SITES_BUCKET && Array.isArray(bb.slugs)) {
        for (const raw of bb.slugs.slice(0, 60)) {
          const slug = String(raw || "").replace(/[^a-z0-9-]/gi, "").slice(0, 60);
          if (!slug || done.has(slug)) continue;
          let owned = false;
          try { const o = await env.SITES_BUCKET.get("sitesrc/" + slug + ".json"); if (o) { const j = JSON.parse(await o.text()); if (j && j.uid === u.id) owned = true; } } catch {}
          if (owned) { await wipeR2(slug); done.add(slug); removed++; }
        }
      }
      return Response.json({ ok: true, removed });
    }
    // Owner-side data read (isibi-authed): the site OWNER sees any table's rows —
    // powers the builder Data/Users panel and reading 'collect' submissions.
    if (url.pathname === "/api/site/backend/rows" && request.method === "GET") {
      const u = await authUser(request); if (!u) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
      const slug = (url.searchParams.get("slug") || "").replace(/[^a-z0-9-]/gi, "").slice(0, 60);
      const table = (url.searchParams.get("table") || "").replace(/[^a-z0-9_]/gi, "").slice(0, 41);
      if (!slug) return Response.json({ ok: false, error: "missing slug" }, { status: 400 });
      try {
        const uuid = await siteBackendForOwner(env, slug, u.id);
        if (!uuid) return Response.json({ ok: false, error: "no backend" }, { status: 404 });
        const spec = await loadSiteSchema(env, uuid);
        if (!table) return Response.json({ ok: true, tables: (spec.tables || []).map((t) => ({ name: t.name, access: t.access, columns: (t.columns || []) })) });
        if (!tableDef(spec, table) && table !== "_users") return Response.json({ ok: false, error: "unknown table" }, { status: 404 });
        if (table === "_users") await initSiteAuth(env, uuid); // ensure role/verified columns exist on older sites
        const cols = table === "_users" ? "id,email,role,verified,display_name,blocked,created_at" : "*"; // never expose password hashes
        const r = await cfD1Query(env, uuid, "SELECT " + cols + " FROM " + sqlIdent(table) + " ORDER BY id DESC LIMIT 500");
        return Response.json({ ok: true, rows: r });
      } catch (e) {
        if (e && e.forbidden) return UNAUTHED();
        console.error("owner rows failed:", e && e.message, e && e.detail);
        return Response.json({ ok: false, error: "read failed" }, { status: 502 });
      }
    }
    // Owner member moderation — block / unblock a member of one of the owner's built
    // apps. isibi-authed + owner-scoped. A blocked member can't log in and is signed
    // out on their next session check; can also promote/demote the admin role.
    if (url.pathname === "/api/site/backend/member" && request.method === "POST") {
      const u = await authUser(request); if (!u) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
      let bb; try { bb = await request.json(); } catch { return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
      const slug = String(bb.slug || "").replace(/[^a-z0-9-]/gi, "").slice(0, 60);
      const memberId = parseInt(bb.id, 10) || 0;
      const action = String(bb.action || "");
      if (!slug || !memberId) return Response.json({ ok: false, error: "missing slug or id" }, { status: 400 });
      try {
        const uuid = await siteBackendForOwner(env, slug, u.id);
        if (!uuid) return Response.json({ ok: false, error: "no backend" }, { status: 404 });
        await initSiteAuth(env, uuid); // ensure the blocked/role columns exist
        if (action === "block") await cfD1Query(env, uuid, "UPDATE _users SET blocked=1 WHERE id=?", [memberId]);
        else if (action === "unblock") await cfD1Query(env, uuid, "UPDATE _users SET blocked=0 WHERE id=?", [memberId]);
        else if (action === "make_admin") await cfD1Query(env, uuid, "UPDATE _users SET role='admin' WHERE id=?", [memberId]);
        else if (action === "remove_admin") await cfD1Query(env, uuid, "UPDATE _users SET role='user' WHERE id=?", [memberId]);
        else if (action === "set_role") { const role = String(bb.role || "").toLowerCase(); if (!/^[a-z0-9_]{1,24}$/.test(role)) return Response.json({ ok: false, error: "invalid role" }, { status: 400 }); await cfD1Query(env, uuid, "UPDATE _users SET role=? WHERE id=?", [role, memberId]); } // RBAC: assign any custom role
        else if (action === "set_manager") { await ensureAuthExtras(env, uuid); const mgr = bb.manager_id == null || bb.manager_id === "" ? null : (parseInt(bb.manager_id, 10) || 0); if (mgr === memberId) return Response.json({ ok: false, error: "a member can't manage themselves" }, { status: 400 }); await cfD1Query(env, uuid, "UPDATE _users SET manager_id=? WHERE id=?", [mgr || null, memberId]); } // hierarchy: set who this member reports to (null clears it) — drives teamRead visibility
        else return Response.json({ ok: false, error: "unknown action" }, { status: 400 });
        const r = await cfD1Query(env, uuid, "SELECT id,email,role,verified,display_name,blocked FROM _users WHERE id=?", [memberId]);
        return Response.json({ ok: true, member: r[0] || null });
      } catch (e) {
        if (e && e.forbidden) return UNAUTHED();
        console.error("owner member action failed:", e && e.message, e && e.detail);
        return Response.json({ ok: false, error: "action failed" }, { status: 502 });
      }
    }
    // Owner invite management — turn invite-only signup on/off and mint/revoke codes.
    // isibi-authed + owner-scoped. actions: enable | disable | create (count?,uses?) |
    // list | revoke (code).
    if (url.pathname === "/api/site/backend/invites" && request.method === "POST") {
      const u = await authUser(request); if (!u) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
      let bb; try { bb = await request.json(); } catch { return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
      const slug = String(bb.slug || "").replace(/[^a-z0-9-]/gi, "").slice(0, 60);
      const action = String(bb.action || "");
      if (!slug) return Response.json({ ok: false, error: "missing slug" }, { status: 400 });
      try {
        const uuid = await siteBackendForOwner(env, slug, u.id);
        if (!uuid) return Response.json({ ok: false, error: "no backend" }, { status: 404 });
        await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _meta (k TEXT PRIMARY KEY, v TEXT)");
        await ensureInvites(env, uuid);
        if (action === "enable" || action === "disable") {
          await cfD1Query(env, uuid, "INSERT INTO _meta (k,v) VALUES ('invite_only',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", [action === "enable" ? "1" : "0"]);
          return Response.json({ ok: true, invite_only: action === "enable" });
        }
        if (action === "create") {
          const count = Math.min(100, Math.max(1, parseInt(bb.count, 10) || 1));
          const uses = Math.min(10000, Math.max(1, parseInt(bb.uses, 10) || 1));
          const made = [];
          for (let i = 0; i < count; i++) {
            const code = (crypto.randomUUID().replace(/-/g, "").slice(0, 10)).toUpperCase();
            try { await cfD1Query(env, uuid, "INSERT INTO _invites (code,uses_left,used_count,created_at) VALUES (?,?,0,?)", [code, uses, new Date().toISOString()]); made.push(code); } catch {}
          }
          return Response.json({ ok: true, codes: made, uses });
        }
        if (action === "list") {
          const rows = await cfD1Query(env, uuid, "SELECT code,uses_left,used_count,created_at FROM _invites ORDER BY created_at DESC LIMIT 500");
          const io = await isInviteOnly(env, uuid);
          return Response.json({ ok: true, invite_only: io, codes: rows });
        }
        if (action === "revoke") {
          const code = String(bb.code || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40);
          if (!code) return Response.json({ ok: false, error: "missing code" }, { status: 400 });
          await cfD1Query(env, uuid, "DELETE FROM _invites WHERE code=?", [code]);
          return Response.json({ ok: true });
        }
        return Response.json({ ok: false, error: "unknown action" }, { status: 400 });
      } catch (e) {
        if (e && e.forbidden) return UNAUTHED();
        console.error("owner invites failed:", e && e.message, e && e.detail);
        return Response.json({ ok: false, error: "action failed" }, { status: 502 });
      }
    }
    // Owner data export: download one of the OWNER's own built-app tables as CSV or
    // JSON (backups, GDPR, analysis). isibi-authed + owner-scoped; _users is limited to
    // safe columns (never password hashes). Streamed as an attachment.
    if (url.pathname === "/api/site/backend/export" && request.method === "GET") {
      const u = await authUser(request); if (!u) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
      const slug = (url.searchParams.get("slug") || "").replace(/[^a-z0-9-]/gi, "").slice(0, 60);
      const table = (url.searchParams.get("table") || "").replace(/[^a-z0-9_]/gi, "").slice(0, 41);
      const format = (url.searchParams.get("format") || "csv").toLowerCase() === "json" ? "json" : "csv";
      if (!slug || !table) return Response.json({ ok: false, error: "missing slug or table" }, { status: 400 });
      try {
        const uuid = await siteBackendForOwner(env, slug, u.id);
        if (!uuid) return Response.json({ ok: false, error: "no backend" }, { status: 404 });
        const spec = await loadSiteSchema(env, uuid);
        if (!tableDef(spec, table) && table !== "_users") return Response.json({ ok: false, error: "unknown table" }, { status: 404 });
        if (table === "_users") await initSiteAuth(env, uuid);
        const cols = table === "_users" ? "id,email,role,verified,display_name,created_at" : "*"; // never expose password hashes
        const rows = await cfD1Query(env, uuid, "SELECT " + cols + " FROM " + sqlIdent(table) + " ORDER BY id DESC LIMIT 5000");
        const fname = slug + "-" + table + "." + format;
        if (format === "json") {
          return new Response(JSON.stringify(rows, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="' + fname + '"', "Cache-Control": "no-store" } });
        }
        const headers = rows.length ? Object.keys(rows[0]) : (table === "_users" ? ["id", "email", "role", "verified", "created_at"] : ["id"]);
        const esc = (v) => { if (v == null) return ""; const s = String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
        const lines = [headers.join(",")];
        for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
        return new Response(lines.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="' + fname + '"', "Cache-Control": "no-store" } });
      } catch (e) {
        if (e && e.forbidden) return UNAUTHED();
        console.error("owner export failed:", e && e.message, e && e.detail);
        return Response.json({ ok: false, error: "export failed" }, { status: 502 });
      }
    }
    // Owner observability: daily request + error counts for one of the owner's built
    // apps (last N days). isibi-authed + owner-scoped. Flushes this isolate's buffered
    // counts first so the view is current.
    if (url.pathname === "/api/site/backend/metrics" && request.method === "GET") {
      const u = await authUser(request); if (!u) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
      const slug = (url.searchParams.get("slug") || "").replace(/[^a-z0-9-]/gi, "").slice(0, 60);
      const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get("days") || "14", 10) || 14));
      if (!slug) return Response.json({ ok: false, error: "missing slug" }, { status: 400 });
      try {
        const uuid = await siteBackendForOwner(env, slug, u.id);
        if (!uuid) return Response.json({ ok: false, error: "no backend" }, { status: 404 });
        const b = _metBuf.get(slug); if (b && b.reqs) { _metBuf.set(slug, { reqs: 0, errs: 0 }); await flushSiteMetrics(env, slug, { reqs: b.reqs, errs: b.errs }); }
        let rows = [];
        try { rows = await cfD1Query(env, uuid, "SELECT day,reqs,errs FROM _metrics ORDER BY day DESC LIMIT ?", [days]); } catch {}
        const totals = rows.reduce((a, r) => ({ reqs: a.reqs + (r.reqs || 0), errs: a.errs + (r.errs || 0) }), { reqs: 0, errs: 0 });
        return Response.json({ ok: true, days: rows, totals });
      } catch (e) {
        if (e && e.forbidden) return UNAUTHED();
        console.error("owner metrics failed:", e && e.message, e && e.detail);
        return Response.json({ ok: false, error: "read failed" }, { status: 502 });
      }
    }
    // Owner visitor-analytics: page views + custom events for one of the owner's built
    // apps (last N days), aggregated by event and by path. Flushes the live buffer first.
    if (url.pathname === "/api/site/backend/analytics" && request.method === "GET") {
      const u = await authUser(request); if (!u) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
      const slug = (url.searchParams.get("slug") || "").replace(/[^a-z0-9-]/gi, "").slice(0, 60);
      const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get("days") || "14", 10) || 14));
      if (!slug) return Response.json({ ok: false, error: "missing slug" }, { status: 400 });
      try {
        const uuid = await siteBackendForOwner(env, slug, u.id);
        if (!uuid) return Response.json({ ok: false, error: "no backend" }, { status: 404 });
        let rows = [];
        try { rows = await cfD1Query(env, uuid, "SELECT day,event,path,n FROM _analytics WHERE day >= date('now', ?) ORDER BY day DESC, n DESC LIMIT 2000", ["-" + days + " days"]); } catch {}
        let total = 0; const byEvent = {}, byPath = {}, byDay = {};
        for (const r of rows) { const n = r.n || 0; total += n; byEvent[r.event] = (byEvent[r.event] || 0) + n; if (r.path) byPath[r.path] = (byPath[r.path] || 0) + n; byDay[r.day] = (byDay[r.day] || 0) + n; }
        // Named counters (likes/views/reactions/polls) live in the same D1 — surface
        // them alongside analytics so the owner sees them in one place.
        const counters = {}; try { const cr = await cfD1Query(env, uuid, "SELECT name,n FROM _counters ORDER BY n DESC LIMIT 500"); for (const r of cr) counters[r.name] = r.n; } catch {}
        return Response.json({ ok: true, total, byEvent, byPath, byDay, rows, counters });
      } catch (e) {
        if (e && e.forbidden) return UNAUTHED();
        console.error("owner analytics failed:", e && e.message, e && e.detail);
        return Response.json({ ok: false, error: "read failed" }, { status: 502 });
      }
    }
    // Owner data import: load rows into one of the OWNER's declared tables from a CSV
    // string or a rows array (the mirror of export). isibi-authed + owner-scoped; only
    // declared columns are written (case-insensitive header match), cap 2000 rows.
    if (url.pathname === "/api/site/backend/import" && request.method === "POST") {
      const u = await authUser(request); if (!u) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
      let bb; try { bb = await request.json(); } catch { bb = {}; }
      const slug = ((bb.slug || "") + "").replace(/[^a-z0-9-]/gi, "").slice(0, 60);
      const table = ((bb.table || "") + "").replace(/[^a-z0-9_]/gi, "").slice(0, 41);
      if (!slug || !table) return Response.json({ ok: false, error: "missing slug or table" }, { status: 400 });
      try {
        const uuid = await siteBackendForOwner(env, slug, u.id);
        if (!uuid) return Response.json({ ok: false, error: "no backend" }, { status: 404 });
        const spec = await loadSiteSchema(env, uuid);
        const def = tableDef(spec, table);
        if (!def) return Response.json({ ok: false, error: "not an importable table" }, { status: 404 }); // blocks _users/_meta
        const tn = sqlIdent(table);
        const managed = new Set(["id", "created_at", "owner_id"]);
        const allow = (Array.isArray(def.columns) ? def.columns : []).filter((n) => n && !managed.has(String(n).toLowerCase()));
        const colIndex = {}; for (const c of allow) colIndex[String(c).toLowerCase()] = c; // header → real col, case-insensitive
        let objs = [];
        if (typeof bb.csv === "string" && bb.csv.trim()) {
          const grid = parseCsv(bb.csv).filter((r) => r.length && r.some((c) => String(c).trim() !== ""));
          if (grid.length < 2) return Response.json({ ok: false, error: "need a header row plus at least one data row" }, { status: 400 });
          const headers = grid[0].map((h) => String(h).trim());
          for (const r of grid.slice(1, 2001)) { const o = {}; headers.forEach((h, idx) => { o[h] = r[idx]; }); objs.push(o); }
        } else if (Array.isArray(bb.rows)) {
          objs = bb.rows.slice(0, 2000).filter((o) => o && typeof o === "object" && !Array.isArray(o));
        } else {
          return Response.json({ ok: false, error: "provide csv text or a rows array" }, { status: 400 });
        }
        let imported = 0, skipped = 0;
        for (const o of objs) {
          const use = [], vals = [];
          for (const k of Object.keys(o)) { const c = colIndex[String(k).toLowerCase().trim()]; if (c && o[k] !== undefined && o[k] !== null && o[k] !== "") { use.push(c); vals.push(o[k]); } }
          if (!use.length) { skipped++; continue; }
          try { await cfD1Query(env, uuid, "INSERT INTO " + tn + " (" + use.map(sqlIdent).join(",") + ") VALUES (" + use.map(() => "?").join(",") + ")", vals); imported++; } catch { skipped++; }
        }
        return Response.json({ ok: true, imported, skipped, columns: allow });
      } catch (e) {
        if (e && e.forbidden) return UNAUTHED();
        console.error("owner import failed:", e && e.message, e && e.detail);
        return Response.json({ ok: false, error: "import failed" }, { status: 502 });
      }
    }
    // Owner data backup: snapshot ALL of a built app's declared data tables into a
    // single JSON in R2 (backups/<slug>/<ts>.json). isibi-authed + owner-scoped. Covers
    // the app's own content tables (not _users — visitor accounts are excluded on
    // purpose so a restore can never wipe/expose logins).
    if (url.pathname === "/api/site/backend/backup" && request.method === "POST") {
      const u = await authUser(request); if (!u) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
      let bb; try { bb = await request.json(); } catch { bb = {}; }
      const slug = ((bb.slug || "") + "").replace(/[^a-z0-9-]/gi, "").slice(0, 60);
      if (!slug) return Response.json({ ok: false, error: "missing slug" }, { status: 400 });
      try {
        const uuid = await siteBackendForOwner(env, slug, u.id);
        if (!uuid) return Response.json({ ok: false, error: "no backend" }, { status: 404 });
        const spec = await loadSiteSchema(env, uuid);
        const tables = {}; let total = 0;
        for (const t of (spec.tables || [])) {
          if (!t || !t.name) continue;
          try { const rows = await cfD1Query(env, uuid, "SELECT * FROM " + sqlIdent(t.name) + " ORDER BY id ASC LIMIT 5000"); tables[t.name] = rows; total += rows.length; } catch {}
        }
        const now = new Date();
        const ts = now.toISOString().replace(/[:.]/g, "-");
        const key = "backups/" + slug + "/" + ts + ".json";
        const bodyStr = JSON.stringify({ createdAt: now.toISOString(), slug, tables });
        await env.SITES_BUCKET.put(key, bodyStr, { httpMetadata: { contentType: "application/json" } });
        return Response.json({ ok: true, key, tables: Object.keys(tables), rows: total, size: bodyStr.length });
      } catch (e) {
        if (e && e.forbidden) return UNAUTHED();
        console.error("owner backup failed:", e && e.message, e && e.detail);
        return Response.json({ ok: false, error: "backup failed" }, { status: 502 });
      }
    }
    // Owner: list a built app's backups (newest first).
    if (url.pathname === "/api/site/backend/backups" && request.method === "GET") {
      const u = await authUser(request); if (!u) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
      const slug = (url.searchParams.get("slug") || "").replace(/[^a-z0-9-]/gi, "").slice(0, 60);
      if (!slug) return Response.json({ ok: false, error: "missing slug" }, { status: 400 });
      try {
        const uuid = await siteBackendForOwner(env, slug, u.id); // ownership check
        if (!uuid) return Response.json({ ok: false, error: "no backend" }, { status: 404 });
        const l = await env.SITES_BUCKET.list({ prefix: "backups/" + slug + "/" });
        const backups = (l.objects || []).map((o) => ({ key: o.key, size: o.size, uploaded: o.uploaded })).sort((a, b) => (a.key < b.key ? 1 : -1));
        return Response.json({ ok: true, backups });
      } catch (e) {
        if (e && e.forbidden) return UNAUTHED();
        console.error("owner backups list failed:", e && e.message);
        return Response.json({ ok: false, error: "list failed" }, { status: 502 });
      }
    }
    // Owner restore: replace a built app's declared data tables with the contents of a
    // backup snapshot. Row ids are preserved (so relations survive). _users is never
    // touched. isibi-authed + owner-scoped; the key must belong to this slug's backups.
    if (url.pathname === "/api/site/backend/restore" && request.method === "POST") {
      const u = await authUser(request); if (!u) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
      let bb; try { bb = await request.json(); } catch { bb = {}; }
      const slug = ((bb.slug || "") + "").replace(/[^a-z0-9-]/gi, "").slice(0, 60);
      const key = (bb.key || "") + "";
      if (!slug || !key) return Response.json({ ok: false, error: "missing slug or key" }, { status: 400 });
      if (!key.startsWith("backups/" + slug + "/")) return Response.json({ ok: false, error: "bad key" }, { status: 400 });
      try {
        const uuid = await siteBackendForOwner(env, slug, u.id);
        if (!uuid) return Response.json({ ok: false, error: "no backend" }, { status: 404 });
        const obj = await env.SITES_BUCKET.get(key);
        if (!obj) return Response.json({ ok: false, error: "backup not found" }, { status: 404 });
        const snap = JSON.parse(await obj.text());
        const spec = await loadSiteSchema(env, uuid);
        let restored = 0; const done = [];
        for (const [name, rows] of Object.entries(snap.tables || {})) {
          if (!tableDef(spec, name)) continue; // only currently-declared tables
          const tn = sqlIdent(name);
          await cfD1Query(env, uuid, "DELETE FROM " + tn);
          for (const row of (Array.isArray(rows) ? rows : [])) {
            const cols = Object.keys(row).filter((k) => SAFE_IDENT.test(k));
            if (!cols.length) continue;
            await cfD1Query(env, uuid, "INSERT INTO " + tn + " (" + cols.map(sqlIdent).join(",") + ") VALUES (" + cols.map(() => "?").join(",") + ")", cols.map((c) => row[c]));
            restored++;
          }
          done.push(name);
        }
        return Response.json({ ok: true, restored, tables: done });
      } catch (e) {
        if (e && e.forbidden) return UNAUTHED();
        console.error("owner restore failed:", e && e.message, e && e.detail);
        return Response.json({ ok: false, error: "restore failed" }, { status: 502 });
      }
    }
    // Owner: list the recent published builds of a React site (newest first) for
    // rollback. isibi-authed + owner-scoped (via the generated source's uid).
    if (url.pathname === "/api/site/backend/builds" && request.method === "GET") {
      const u = await authUser(request); if (!u) return UNAUTHED();
      const slug = (url.searchParams.get("slug") || "").replace(/[^a-z0-9-]/gi, "").slice(0, 60);
      if (!slug) return Response.json({ ok: false, error: "missing slug" }, { status: 400 });
      if (!(await ownsReactSite(env, slug, u.id))) return UNAUTHED();
      try {
        const l = await env.SITES_BUCKET.list({ prefix: "builds/" + slug + "/" });
        const builds = (l.objects || []).map((o) => ({ key: o.key, size: o.size, uploaded: o.uploaded })).sort((a, b) => (a.key < b.key ? 1 : -1));
        return Response.json({ ok: true, builds });
      } catch (e) {
        console.error("builds list failed:", e && e.message);
        return Response.json({ ok: false, error: "list failed" }, { status: 502 });
      }
    }
    // Owner: roll the LIVE site back to a prior published build (one click). isibi-authed
    // + owner-scoped; the key must belong to this slug's builds. Reverts what SERVES —
    // the generated source is unchanged, so a later AI edit rebuilds from the newest
    // source (i.e. editing after a rollback rolls forward).
    if (url.pathname === "/api/site/backend/rollback" && request.method === "POST") {
      const u = await authUser(request); if (!u) return UNAUTHED();
      let bb; try { bb = await request.json(); } catch { bb = {}; }
      const slug = ((bb.slug || "") + "").replace(/[^a-z0-9-]/gi, "").slice(0, 60);
      const key = (bb.key || "") + "";
      if (!slug || !key) return Response.json({ ok: false, error: "missing slug or key" }, { status: 400 });
      if (!key.startsWith("builds/" + slug + "/")) return Response.json({ ok: false, error: "bad key" }, { status: 400 });
      if (!(await ownsReactSite(env, slug, u.id))) return UNAUTHED();
      try {
        const obj = await env.SITES_BUCKET.get(key);
        if (!obj) return Response.json({ ok: false, error: "build not found" }, { status: 404 });
        const snap = JSON.parse(await obj.text());
        if (!snap.dist || !snap.dist["index.html"]) return Response.json({ ok: false, error: "that snapshot has no page" }, { status: 422 });
        await writeDistToR2(env, slug, snap.dist);
        return Response.json({ ok: true, restored: key, files: Object.keys(snap.dist).length });
      } catch (e) {
        console.error("rollback failed:", e && e.message, e && e.detail);
        return Response.json({ ok: false, error: "rollback failed" }, { status: 502 });
      }
    }
    // Owner content editor: add / edit / delete a row in one of the OWNER's own
    // declared tables (products, posts, menu…). isibi-authed + owner-scoped; only
    // declared tables + columns (never _users/_meta) — this is how 'display' content
    // gets managed without a rebuild.
    if (url.pathname === "/api/site/backend/row" && (request.method === "POST" || request.method === "PATCH" || request.method === "DELETE")) {
      const u = await authUser(request); if (!u) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
      let bb; try { bb = request.method === "DELETE" ? {} : await request.json(); } catch { return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
      const slug = ((bb.slug || url.searchParams.get("slug")) || "").replace(/[^a-z0-9-]/gi, "").slice(0, 60);
      const table = ((bb.table || url.searchParams.get("table")) || "").replace(/[^a-z0-9_]/gi, "").slice(0, 41);
      const rowId = parseInt(bb.id || url.searchParams.get("id") || "0", 10) || 0;
      if (!slug || !table) return Response.json({ ok: false, error: "missing slug or table" }, { status: 400 });
      try {
        const uuid = await siteBackendForOwner(env, slug, u.id);
        if (!uuid) return Response.json({ ok: false, error: "no backend" }, { status: 404 });
        const spec = await loadSiteSchema(env, uuid);
        const def = tableDef(spec, table);
        if (!def) return Response.json({ ok: false, error: "not an editable table" }, { status: 404 }); // blocks _users/_meta
        const tn = sqlIdent(table);
        const managed = new Set(["id", "created_at", "owner_id"]);
        const allow = (Array.isArray(def.columns) ? def.columns : []).filter((n) => n && !managed.has(String(n).toLowerCase()));
        const values = bb.values || bb.row || {};
        const use = allow.filter((c) => values[c] !== undefined);
        if (request.method === "DELETE") {
          if (!rowId) return Response.json({ ok: false, error: "missing id" }, { status: 400 });
          await cascadeDeleteRow(env, uuid, spec, table, tn, rowId, "", []); // cascade children too
          return Response.json({ ok: true });
        }
        if (request.method === "PATCH") {
          if (!rowId) return Response.json({ ok: false, error: "missing id" }, { status: 400 });
          if (!use.length) return Response.json({ ok: false, error: "nothing to update" }, { status: 400 });
          await cfD1Query(env, uuid, "UPDATE " + tn + " SET " + use.map((c) => sqlIdent(c) + "=?").join(",") + " WHERE id=?", use.map((c) => values[c]).concat([rowId]));
          return Response.json({ ok: true });
        }
        // POST (insert)
        if (!use.length) return Response.json({ ok: false, error: "no data" }, { status: 400 });
        await cfD1Query(env, uuid, "INSERT INTO " + tn + " (" + use.map(sqlIdent).join(",") + ") VALUES (" + use.map(() => "?").join(",") + ")", use.map((c) => values[c]));
        return Response.json({ ok: true });
      } catch (e) {
        if (e && e.forbidden) return UNAUTHED();
        if (e && e.bad) return Response.json({ ok: false, error: "invalid field" }, { status: 400 });
        console.error("owner row write failed:", e && e.message, e && e.detail);
        return Response.json({ ok: false, error: "write failed" }, { status: 502 });
      }
    }
    // OAuth social login (Google / GitHub) — the OWNER registers an OAuth app with the
    // provider and stores the credentials as site secrets (GOOGLE_CLIENT_ID /
    // GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET) in Cloud → Secrets.
    // Two GET steps, a normal browser redirect dance (no client secret ever hits the page):
    //   GET /api/db/<slug>/auth/oauth/<provider>[?return=<path>] → 302 to the provider.
    //   GET /api/db/<slug>/auth/oauth/<provider>/callback?code&state → verify the signed
    //       state, exchange the code (server-side, with the secret), read the verified
    //       email, upsert a passwordless `_users` row, mint a normal site-user session
    //       token, and 302 back to /s/<slug>/<return>#token=<jwt> for the SPA to store.
    {
      const oam = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/auth\/oauth\/(google|github)(\/callback)?$/i);
      if (oam && (request.method === "GET" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = oam[1].toLowerCase(), provider = oam[2].toLowerCase(), isCallback = !!oam[3];
        const oauthErr = (msg, status = 400) => new Response("<!doctype html><meta charset=utf-8><title>Sign-in</title><body style=\"font:16px system-ui;max-width:32rem;margin:12vh auto;padding:0 1.25rem;color:#222\"><h1 style=\"font-size:1.3rem\">Couldn't finish signing in</h1><p>" + String(msg).replace(/[<>&]/g, "") + "</p><p><a href=\"/s/" + slug + "/\">← Back to the app</a></p></body>", { status, headers: { "content-type": "text/html; charset=utf-8" } });
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return oauthErr("This app's backend isn't available right now.", 503);
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return oauthErr("This site has no backend yet.", 404);
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        if (!rateOk(slug + "|" + ip + "|oauth", 60)) return oauthErr("Too many attempts — please wait a minute.", 429);
        let secret; try { secret = await initSiteAuth(env, uuid); } catch { return oauthErr("Auth is unavailable right now.", 502); }
        const ownerUid = await siteOwnerUid(env, slug);
        const secrets = ownerUid ? await loadSiteSecrets(env, ownerUid, slug) : {};
        const cfg = provider === "google"
          ? { id: secrets.GOOGLE_CLIENT_ID, sec: secrets.GOOGLE_CLIENT_SECRET, authUrl: "https://accounts.google.com/o/oauth2/v2/auth", scope: "openid email profile", label: "Google" }
          : { id: secrets.GITHUB_CLIENT_ID, sec: secrets.GITHUB_CLIENT_SECRET, authUrl: "https://github.com/login/oauth/authorize", scope: "read:user user:email", label: "GitHub" };
        if (!cfg.id || !cfg.sec) return oauthErr("Social sign-in isn't set up for this site yet. The owner needs to add " + provider.toUpperCase() + "_CLIENT_ID and " + provider.toUpperCase() + "_CLIENT_SECRET in Cloud → Secrets.", 501);
        const origin = url.origin;
        const redirectUri = origin + "/api/db/" + slug + "/auth/oauth/" + provider + "/callback";
        const now = Math.floor(Date.now() / 1000);
        try {
          if (!isCallback) {
            // Step 1 — build the provider authorize URL and bounce the browser to it.
            const ret = (url.searchParams.get("return") || "").replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 80);
            const state = await signSiteUserToken(secret, { purpose: "oauth", slug, provider, ret, nonce: crypto.randomUUID(), iat: now, exp: now + 600 });
            const qp = new URLSearchParams({ client_id: cfg.id, redirect_uri: redirectUri, response_type: "code", scope: cfg.scope, state });
            if (provider === "google") { qp.set("access_type", "online"); qp.set("include_granted_scopes", "true"); }
            return Response.redirect(cfg.authUrl + "?" + qp.toString(), 302);
          }
          // Step 2 — the provider redirected back with ?code&state. Verify the state first.
          const code = url.searchParams.get("code") || "";
          const state = url.searchParams.get("state") || "";
          const st = await verifySiteUserToken(secret, state).catch(() => null);
          if (!code || !st || st.purpose !== "oauth" || st.slug !== slug || st.provider !== provider) return oauthErr("Your sign-in link couldn't be verified (it may have expired). Please try again.", 400);
          // Exchange the authorization code for an access token (server-to-server; the
          // client secret never touches the browser).
          let accessToken = null;
          try {
            if (provider === "google") {
              const tr = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ code, client_id: cfg.id, client_secret: cfg.sec, redirect_uri: redirectUri, grant_type: "authorization_code" }).toString(), signal: AbortSignal.timeout(10000) });
              const tj = await tr.json().catch(() => ({})); accessToken = tj && tj.access_token;
            } else {
              const tr = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ code, client_id: cfg.id, client_secret: cfg.sec, redirect_uri: redirectUri }), signal: AbortSignal.timeout(10000) });
              const tj = await tr.json().catch(() => ({})); accessToken = tj && tj.access_token;
            }
          } catch {}
          if (!accessToken) return oauthErr("Couldn't complete sign-in with " + cfg.label + ". Please try again.", 502);
          // Read the verified email (+ name/avatar) from the provider.
          let email = null, name = null, avatar = null;
          try {
            if (provider === "google") {
              const ur = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: "Bearer " + accessToken }, signal: AbortSignal.timeout(10000) });
              const uj = await ur.json().catch(() => ({}));
              if (uj && uj.email && uj.email_verified !== false && uj.email_verified !== "false") { email = String(uj.email).toLowerCase(); name = uj.name || null; avatar = uj.picture || null; }
            } else {
              const ur = await fetch("https://api.github.com/user", { headers: { Authorization: "Bearer " + accessToken, "User-Agent": "isibi", Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(10000) });
              const uj = await ur.json().catch(() => ({}));
              if (uj) { name = uj.name || uj.login || null; avatar = uj.avatar_url || null; if (uj.email) email = String(uj.email).toLowerCase(); }
              if (!email) { const er = await fetch("https://api.github.com/user/emails", { headers: { Authorization: "Bearer " + accessToken, "User-Agent": "isibi", Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(10000) }); const ej = await er.json().catch(() => []); const prim = Array.isArray(ej) ? (ej.find((e) => e && e.primary && e.verified) || ej.find((e) => e && e.verified)) : null; if (prim) email = String(prim.email).toLowerCase(); }
            }
          } catch {}
          if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return oauthErr("Your " + cfg.label + " account didn't share a verified email, so we can't create an account.", 400);
          // Upsert a passwordless member (provider vouches for the email → verified=1).
          await ensureAuthExtras(env, uuid);
          let urow = (await cfD1Query(env, uuid, "SELECT id, role, token_epoch, blocked FROM _users WHERE email=?", [email]))[0];
          if (urow && urow.blocked) return oauthErr("This account has been suspended.", 403);
          if (!urow) {
            const cnt = await cfD1Query(env, uuid, "SELECT COUNT(*) AS n FROM _users");
            const role = (cnt[0] && cnt[0].n) ? "user" : "admin"; // first member owns the app
            if (role === "user" && await isInviteOnly(env, uuid)) return oauthErr("This app is invite-only, so a social account can't self-join. Ask the owner for an invite.", 403);
            const dn = String(name || email.split("@")[0]).replace(/[\r\n]/g, "").slice(0, 80);
            const rnd = crypto.randomUUID() + crypto.randomUUID(); const { salt, hash } = await hashPassword(rnd); // unusable random password — this account signs in via the provider
            await cfD1Query(env, uuid, "INSERT INTO _users (email,pass_salt,pass_hash,role,display_name,verified,avatar_url) VALUES (?,?,?,?,?,1,?)", [email, salt, hash, role, dn, avatar || null]);
            urow = (await cfD1Query(env, uuid, "SELECT id, role, token_epoch FROM _users WHERE email=?", [email]))[0];
          } else {
            await cfD1Query(env, uuid, "UPDATE _users SET verified=1 WHERE id=? AND (verified IS NULL OR verified=0)", [urow.id]);
          }
          if (!urow) return oauthErr("Couldn't finish creating your account. Please try again.", 502);
          const token = await signSiteUserToken(secret, { sub: urow.id, slug, email, role: urow.role || "user", ep: urow.token_epoch || 0, iat: now, exp: now + 60 * 60 * 24 * 30 });
          const ret = String(st.ret || "").replace(/[^a-zA-Z0-9/_-]/g, "");
          return Response.redirect(origin + "/s/" + slug + "/" + ret + "#token=" + encodeURIComponent(token), 302);
        } catch (e) {
          console.error("oauth failed:", e && e.message, e && e.detail);
          return oauthErr("Something went wrong during sign-in. Please try again.", 502);
        }
      }
    }
    // Phase C — built-site visitor auth: /api/db/<slug>/auth/{signup,login,me}.
    // PUBLIC (the site's own visitors), scoped strictly to that site's D1.
    {
      const am = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/auth\/(signup|login|me)$/i);
      if (am) {
        const slug = am[1].toLowerCase(), action = am[2].toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        if (!rateOk(slug + "|" + (request.headers.get("CF-Connecting-IP") || "0") + "|a", 30)) return tooMany("Too many attempts — please wait a minute.");
        let secret; try { secret = await initSiteAuth(env, uuid); } catch (e) { console.error("initSiteAuth failed:", e && e.message, e && e.detail); return Response.json({ ok: false, error: "auth unavailable" }, { status: 502 }); }
        try {
          if (action === "me") {
            if (request.method !== "GET") return Response.json({ ok: false }, { status: 405 });
            const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
            const p = await verifySiteUserToken(secret, tok);
            if (!p || p.slug !== slug) return Response.json({ ok: false, error: "not signed in" }, { status: 401 });
            const rows = await cfD1Query(env, uuid, "SELECT id,email,created_at,role,verified,display_name,avatar_url,bio,blocked,token_epoch FROM _users WHERE id=?", [p.sub]).catch(async () => { await ensureAuthExtras(env, uuid); return cfD1Query(env, uuid, "SELECT id,email,created_at,role,verified,display_name,avatar_url,bio,blocked,token_epoch FROM _users WHERE id=?", [p.sub]); });
            if (!rows[0]) return Response.json({ ok: false, error: "not signed in" }, { status: 401 });
            if (rows[0].blocked) return Response.json({ ok: false, error: "this account has been suspended" }, { status: 403 }); // block takes effect on the next session check (the app guards on /me)
            // Session revoke — a "log out other devices" bumps token_epoch; a token minted
            // before the bump no longer matches → treat as signed out (the app guards on /me).
            if ((p.ep || 0) !== (rows[0].token_epoch || 0)) return Response.json({ ok: false, error: "session ended — please sign in again" }, { status: 401 });
            const me = rows[0]; delete me.blocked; me.role = me.role || "user"; me.verified = me.verified ? 1 : 0;
            return Response.json({ ok: true, user: me });
          }
          if (request.method !== "POST") return Response.json({ ok: false }, { status: 405 });
          let body; try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
          const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
          const password = String(body.password || "");
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Response.json({ ok: false, error: "enter a valid email" }, { status: 400 });
          if (password.length < 8) return Response.json({ ok: false, error: "password must be at least 8 characters" }, { status: 400 });
          const now = Math.floor(Date.now() / 1000);
          const mkToken = (uid, role, ep) => signSiteUserToken(secret, { sub: uid, slug, email, role: role || "user", ep: ep || 0, iat: now, exp: now + 60 * 60 * 24 * 30 });
          if (action === "signup") {
            // Password strength (signup only — never blocks an existing user's login):
            // reject very common passwords, all-same-character, or the email itself.
            const pwLow = password.toLowerCase();
            const COMMON = new Set(["password", "password1", "12345678", "123456789", "1234567890", "qwertyui", "qwerty123", "11111111", "iloveyou", "letmein1", "welcome1", "admin123", "abc12345", "football", "baseball", "sunshine", "princess", "1qaz2wsx"]);
            if (COMMON.has(pwLow) || /^(.)\1+$/.test(password) || pwLow === email.split("@")[0].toLowerCase() || pwLow === email) {
              return Response.json({ ok: false, error: "please choose a stronger password" }, { status: 400 });
            }
            const exists = await cfD1Query(env, uuid, "SELECT id FROM _users WHERE email=?", [email]);
            if (exists[0]) return Response.json({ ok: false, error: "that email already has an account" }, { status: 409 });
            const { salt, hash } = await hashPassword(password);
            // The FIRST person to sign up owns the app → they become 'admin'
            // automatically (so the built app has an admin without any console step);
            // everyone after is a normal 'user'.
            const cnt = await cfD1Query(env, uuid, "SELECT COUNT(*) AS n FROM _users");
            const role = (cnt[0] && cnt[0].n) ? "user" : "admin";
            // Invite-only gate: when enabled, everyone AFTER the first member (the
            // bootstrap admin) must present a valid invite code, redeemed atomically.
            if (role === "user" && await isInviteOnly(env, uuid)) {
              const okInvite = await consumeInvite(env, uuid, body.invite || body.code || body.invite_code);
              if (!okInvite) return Response.json({ ok: false, error: "a valid invite code is required to join", need: "invite" }, { status: 403 });
            }
            // Optional public display name at signup (else derived from the email local part).
            const dn = (typeof body.display_name === "string" ? body.display_name : (typeof body.name === "string" ? body.name : "")).trim().replace(/[\r\n]/g, "").slice(0, 80) || email.split("@")[0].slice(0, 80);
            await cfD1Query(env, uuid, "INSERT INTO _users (email,pass_salt,pass_hash,role,display_name) VALUES (?,?,?,?,?)", [email, salt, hash, role, dn]);
            const rows = await cfD1Query(env, uuid, "SELECT id FROM _users WHERE email=?", [email]);
            const uid = rows[0] && rows[0].id;
            await sendVerifyEmail(env, ctx, secret, slug, uid, email); // fire-and-forget confirm-your-email
            return Response.json({ ok: true, token: await mkToken(uid, role), user: { id: uid, email, role, verified: 0, display_name: dn } });
          }
          // login
          const rows = await cfD1Query(env, uuid, "SELECT id,pass_salt,pass_hash,failed,locked_until,role,verified,blocked,totp_secret,totp_enabled,token_epoch FROM _users WHERE email=?", [email]).catch(async () => {
            // older sites created before the 2FA columns existed → backfill then retry
            await ensureAuthExtras(env, uuid);
            return cfD1Query(env, uuid, "SELECT id,pass_salt,pass_hash,failed,locked_until,role,verified,blocked,totp_secret,totp_enabled,token_epoch FROM _users WHERE email=?", [email]);
          });
          const u = rows[0];
          if (u && u.locked_until && now < u.locked_until) return Response.json({ ok: false, error: "too many attempts — try again in a few minutes" }, { status: 429 });
          // Always run a hash (even when the email is unknown) so timing can't reveal
          // whether an account exists.
          const ok = u ? await verifyPassword(password, u.pass_salt, u.pass_hash) : (await _pbkdf2(password, _unb64("AAAAAAAAAAAAAAAAAAAAAA==")), false);
          if (!ok) {
            if (u) { const f = (u.failed || 0) + 1; const lock = f >= 8 ? now + 900 : null; await cfD1Query(env, uuid, "UPDATE _users SET failed=?, locked_until=? WHERE id=?", [f, lock, u.id]); }
            return Response.json({ ok: false, error: "wrong email or password" }, { status: 401 });
          }
          if (u.blocked) return Response.json({ ok: false, error: "this account has been suspended" }, { status: 403 });
          // Two-factor gate — when enabled, the password is right but a valid TOTP `code` is
          // also required; without/with-wrong code, tell the client to prompt for it.
          if (u.totp_enabled && u.totp_secret) {
            if (!(await totpVerify(u.totp_secret, body.code))) return Response.json({ ok: false, error: "enter your authenticator code", need: "2fa" }, { status: 401 });
          }
          if (u.failed) await cfD1Query(env, uuid, "UPDATE _users SET failed=0, locked_until=NULL WHERE id=?", [u.id]);
          return Response.json({ ok: true, token: await mkToken(u.id, u.role, u.token_epoch || 0), user: { id: u.id, email, role: u.role || "user", verified: u.verified ? 1 : 0 } });
        } catch (e) {
          console.error("site auth failed:", action, e && e.message, e && e.detail);
          return Response.json({ ok: false, error: "auth error — try again" }, { status: 502 });
        }
      }
      // Two-factor auth (TOTP — authenticator apps). The signed-in member enrolls, confirms
      // with a code to enable, and can disable. Once enabled, login requires a `code`.
      //   POST /api/db/<slug>/auth/2fa/setup            → {secret, otpauth} (start enrollment)
      //   POST /api/db/<slug>/auth/2fa/enable {code}    → verify + turn on
      //   POST /api/db/<slug>/auth/2fa/disable {code}   → turn off
      const tfm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/auth\/2fa\/(setup|enable|disable)$/i);
      if (tfm && (request.method === "POST" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = tfm[1].toLowerCase(), act = tfm[2].toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        if (!rateOk(slug + "|" + ip + "|2fa", 30)) return tooMany();
        let secret; try { secret = await initSiteAuth(env, uuid); } catch { return Response.json({ ok: false, error: "auth unavailable" }, { status: 502 }); }
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        const p = await verifySiteUserToken(secret, tok);
        if (!p || p.slug !== slug) return Response.json({ ok: false, error: "not signed in" }, { status: 401 });
        let body = {}; try { body = await request.json(); } catch {}
        try {
          await ensureAuthExtras(env, uuid);
          const rows = await cfD1Query(env, uuid, "SELECT id,email,totp_secret,totp_enabled FROM _users WHERE id=?", [p.sub]);
          const u = rows[0];
          if (!u) return Response.json({ ok: false, error: "not signed in" }, { status: 401 });
          if (act === "setup") {
            const ts = newTotpSecret();
            await cfD1Query(env, uuid, "UPDATE _users SET totp_secret=?, totp_enabled=0 WHERE id=?", [ts, u.id]);
            const label = encodeURIComponent(slug + ":" + u.email);
            return Response.json({ ok: true, secret: ts, otpauth: "otpauth://totp/" + label + "?secret=" + ts + "&issuer=" + encodeURIComponent(slug) });
          }
          if (act === "enable") {
            if (!u.totp_secret) return Response.json({ ok: false, error: "run setup first" }, { status: 400 });
            if (!(await totpVerify(u.totp_secret, body.code))) return Response.json({ ok: false, error: "that code is incorrect" }, { status: 403 });
            await cfD1Query(env, uuid, "UPDATE _users SET totp_enabled=1 WHERE id=?", [u.id]);
            return Response.json({ ok: true, enabled: true });
          }
          // disable — require a current valid code (so a stolen token alone can't turn it off)
          if (!u.totp_enabled) return Response.json({ ok: true, enabled: false });
          if (!(await totpVerify(u.totp_secret, body.code))) return Response.json({ ok: false, error: "that code is incorrect" }, { status: 403 });
          await cfD1Query(env, uuid, "UPDATE _users SET totp_enabled=0, totp_secret=NULL WHERE id=?", [u.id]);
          return Response.json({ ok: true, enabled: false });
        } catch (e) { console.error("2fa failed:", act, e && e.message, e && e.detail); return Response.json({ ok: false, error: "2fa error" }, { status: 502 }); }
      }
      // Log out other devices — bumps the member's token_epoch so every EXISTING token stops
      // validating at /auth/me; returns a FRESH token so the current device stays signed in.
      //   POST /api/db/<slug>/auth/logout-all  (auth) → {ok, token}
      const lom = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/auth\/logout-all$/i);
      if (lom && (request.method === "POST" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = lom[1].toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        let secret; try { secret = await initSiteAuth(env, uuid); } catch { return Response.json({ ok: false, error: "auth unavailable" }, { status: 502 }); }
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        const p = await verifySiteUserToken(secret, tok);
        if (!p || p.slug !== slug) return Response.json({ ok: false, error: "not signed in" }, { status: 401 });
        try {
          await ensureAuthExtras(env, uuid);
          await cfD1Query(env, uuid, "UPDATE _users SET token_epoch=COALESCE(token_epoch,0)+1 WHERE id=?", [p.sub]);
          const rows = await cfD1Query(env, uuid, "SELECT email, role, token_epoch FROM _users WHERE id=?", [p.sub]);
          if (!rows[0]) return Response.json({ ok: false, error: "not signed in" }, { status: 401 });
          const now = Math.floor(Date.now() / 1000);
          const token = await signSiteUserToken(secret, { sub: p.sub, slug, email: rows[0].email, role: rows[0].role || "user", ep: rows[0].token_epoch || 0, iat: now, exp: now + 60 * 60 * 24 * 30 });
          return Response.json({ ok: true, token });
        } catch (e) { console.error("logout-all failed:", e && e.message, e && e.detail); return Response.json({ ok: false, error: "logout failed" }, { status: 502 }); }
      }
      // Account self-service (the signed-in member manages THEIR OWN account):
      //   POST   /api/db/<slug>/auth/password {current_password, password}  → change password
      //   POST   /api/db/<slug>/auth/email    {password, email}             → change email
      //   DELETE /api/db/<slug>/auth/account  {password}                    → delete own account
      // Each re-verifies the current password (so a stolen token alone can't do it).
      const acm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/auth\/(password|email|account)$/i);
      if (acm && (request.method === "POST" || request.method === "DELETE" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = acm[1].toLowerCase(), what = acm[2].toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        if (!rateOk(slug + "|" + ip + "|acc", 30)) return tooMany("Too many attempts — please wait a minute.");
        let secret; try { secret = await initSiteAuth(env, uuid); } catch { return Response.json({ ok: false, error: "auth unavailable" }, { status: 502 }); }
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        const p = await verifySiteUserToken(secret, tok);
        if (!p || p.slug !== slug) return Response.json({ ok: false, error: "not signed in" }, { status: 401 });
        let body = {}; try { body = await request.json(); } catch {}
        try {
          const rows = await cfD1Query(env, uuid, "SELECT id,email,pass_salt,pass_hash FROM _users WHERE id=?", [p.sub]);
          const u = rows[0];
          if (!u) return Response.json({ ok: false, error: "not signed in" }, { status: 401 });
          // Re-verify the current password on every account change.
          const given = String((what === "password" ? (body.current_password || body.current || body.old_password) : body.password) || "");
          if (!(await verifyPassword(given, u.pass_salt, u.pass_hash))) return Response.json({ ok: false, error: "current password is incorrect" }, { status: 403 });
          const now = Math.floor(Date.now() / 1000);
          if (what === "password") {
            const np = String(body.password || body.new_password || "");
            if (np.length < 8) return Response.json({ ok: false, error: "password must be at least 8 characters" }, { status: 400 });
            if (np.toLowerCase() === u.email.toLowerCase() || np.toLowerCase() === u.email.split("@")[0].toLowerCase() || /^(.)\1+$/.test(np)) return Response.json({ ok: false, error: "please choose a stronger password" }, { status: 400 });
            const { salt, hash } = await hashPassword(np);
            await cfD1Query(env, uuid, "UPDATE _users SET pass_salt=?, pass_hash=?, failed=0, locked_until=NULL WHERE id=?", [salt, hash, u.id]);
            const token = await signSiteUserToken(secret, { sub: u.id, slug, email: u.email, iat: now, exp: now + 60 * 60 * 24 * 30 });
            return Response.json({ ok: true, token });
          }
          if (what === "email") {
            const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Response.json({ ok: false, error: "enter a valid email" }, { status: 400 });
            if (email !== u.email) { const taken = await cfD1Query(env, uuid, "SELECT id FROM _users WHERE email=? AND id!=?", [email, u.id]); if (taken[0]) return Response.json({ ok: false, error: "that email already has an account" }, { status: 409 }); }
            await cfD1Query(env, uuid, "UPDATE _users SET email=?, verified=0 WHERE id=?", [email, u.id]);
            const token = await signSiteUserToken(secret, { sub: u.id, slug, email, iat: now, exp: now + 60 * 60 * 24 * 30 });
            return Response.json({ ok: true, token, user: { id: u.id, email, verified: 0 } });
          }
          // delete account: remove the member + their owned rows + their social side-rows.
          if (request.method !== "DELETE") return Response.json({ ok: false, error: "use DELETE" }, { status: 405 });
          try { const spec = await loadSiteSchema(env, uuid); for (const tdef of (spec && Array.isArray(spec.tables) ? spec.tables : [])) { if (tdef && (tdef.access === "user" || tdef.access === "feed")) { try { await cfD1Query(env, uuid, "DELETE FROM " + sqlIdent(tdef.name) + " WHERE owner_id=?", [u.id]); } catch {} } } } catch {}
          for (const q of [
            "DELETE FROM _follows WHERE follower_id=? OR followee_id=?",
            "DELETE FROM _bookmarks WHERE user_id=?",
            "DELETE FROM _reactions WHERE user_id=?",
            "DELETE FROM _polls WHERE user_id=?",
            "DELETE FROM _reports WHERE reporter_id=?",
            "DELETE FROM _shares WHERE user_id=?",
            "DELETE FROM _notifications WHERE user_id=?",
          ]) { try { await cfD1Query(env, uuid, q, q.includes("OR followee_id") ? [u.id, u.id] : [u.id]); } catch {} }
          await cfD1Query(env, uuid, "DELETE FROM _users WHERE id=?", [u.id]);
          return Response.json({ ok: true, deleted: true });
        } catch (e) {
          console.error("account self-service failed:", what, e && e.message, e && e.detail);
          return Response.json({ ok: false, error: "account update failed" }, { status: 502 });
        }
      }
    }
    // Public user profiles — a shared, publicly-readable member identity (display
    // name, avatar, bio) so a feed can show WHO authored a post without every app
    // copying an author name into every row. Read is PUBLIC (safe columns only —
    // never email/hash); write is the member editing ONLY their own profile.
    //   GET   /api/db/<slug>/profile/<userId>  → public {id, display_name, avatar_url, bio, created_at}
    //   GET   /api/db/<slug>/profile/me         → own profile (auth)
    //   PATCH /api/db/<slug>/profile/me         → update own display_name/avatar_url/bio (auth)
    //   GET   /api/db/<slug>/profiles?ids=1,2,3 → batch public profiles (for a feed)
    {
      const pm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/profile\/([a-z0-9]{1,20})$/i);
      const plm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/profiles$/i);
      if (pm || plm) {
        const slug = (pm ? pm[1] : plm[1]).toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        const PUB = "id,display_name,avatar_url,bio,created_at";
        try {
          let secret; try { secret = await initSiteAuth(env, uuid); } catch { return Response.json({ ok: false, error: "auth unavailable" }, { status: 502 }); }
          // batch public read: /profiles?ids=1,2,3
          if (plm && request.method === "GET") {
            if (!rateOk(slug + "|" + ip + "|pr", 300)) return tooMany();
            const ids = String(url.searchParams.get("ids") || "").split(",").map((x) => parseInt(x, 10)).filter((n) => n > 0).slice(0, 100);
            if (!ids.length) return Response.json({ ok: true, profiles: [] });
            const rows = await cfD1Query(env, uuid, "SELECT " + PUB + " FROM _users WHERE id IN (" + ids.map(() => "?").join(",") + ")", ids);
            return Response.json({ ok: true, profiles: rows });
          }
          const who = pm ? pm[2].toLowerCase() : "";
          // own profile (auth): /profile/me
          if (who === "me") {
            const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
            const p = await verifySiteUserToken(secret, tok);
            if (!p || p.slug !== slug) return Response.json({ ok: false, error: "not signed in" }, { status: 401 });
            if (request.method === "GET") {
              const rows = await cfD1Query(env, uuid, "SELECT " + PUB + ",email,role FROM _users WHERE id=?", [p.sub]);
              return rows[0] ? Response.json({ ok: true, profile: rows[0] }) : Response.json({ ok: false, error: "not found" }, { status: 404 });
            }
            if (request.method === "PATCH") {
              if (!rateOk(slug + "|" + ip + "|pw", 60)) return tooMany();
              let body; try { body = await request.json(); } catch { body = {}; }
              const sets = [], vals = [];
              const clean = (v, n) => String(v == null ? "" : v).replace(/[\r\n]/g, " ").slice(0, n);
              if (body.display_name !== undefined) { const dn = clean(body.display_name, 80).trim(); if (!dn) return Response.json({ ok: false, error: "display name can't be empty" }, { status: 400 }); sets.push("display_name=?"); vals.push(dn); }
              if (body.avatar_url !== undefined) { const a = clean(body.avatar_url, 400).trim(); if (a && !/^https?:\/\//i.test(a)) return Response.json({ ok: false, error: "avatar must be a URL" }, { status: 400 }); sets.push("avatar_url=?"); vals.push(a || null); }
              if (body.bio !== undefined) { sets.push("bio=?"); vals.push(clean(body.bio, 600)); }
              if (!sets.length) return Response.json({ ok: false, error: "nothing to update" }, { status: 400 });
              await cfD1Query(env, uuid, "UPDATE _users SET " + sets.join(",") + " WHERE id=?", vals.concat([p.sub]));
              const rows = await cfD1Query(env, uuid, "SELECT " + PUB + ",email,role FROM _users WHERE id=?", [p.sub]);
              return Response.json({ ok: true, profile: rows[0] || null });
            }
            return Response.json({ ok: false, error: "method not allowed" }, { status: 405 });
          }
          // public read by id: /profile/<id>
          if (request.method === "GET") {
            if (!rateOk(slug + "|" + ip + "|pr", 300)) return tooMany();
            const id = parseInt(who, 10);
            if (!(id > 0)) return Response.json({ ok: false, error: "not found" }, { status: 404 });
            const rows = await cfD1Query(env, uuid, "SELECT " + PUB + " FROM _users WHERE id=?", [id]);
            return rows[0] ? Response.json({ ok: true, profile: rows[0] }) : Response.json({ ok: false, error: "not found" }, { status: 404 });
          }
          return Response.json({ ok: false, error: "method not allowed" }, { status: 405 });
        } catch (e) {
          console.error("profile failed:", e && e.message, e && e.detail);
          return Response.json({ ok: false, error: "profile failed" }, { status: 502 });
        }
      }
    }
    // Built-site password reset — step 1: request a link. ALWAYS returns ok (never
    // reveals whether the email has an account). Emails a single-use, 45-min link
    // through the platform sender (Go Farther); no-ops silently if email isn't
    // configured. The token is bound to the current password hash → once used (or
    // the password changes) it's dead.
    {
      const rm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/auth\/reset-request$/i);
      if (rm && request.method === "POST") {
        const okResp = () => Response.json({ ok: true });
        const slug = rm[1].toLowerCase();
        if (!rateOk(slug + "|" + (request.headers.get("CF-Connecting-IP") || "0") + "|e", 10)) return okResp(); // neutral drop (never reveals; no email flood)
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return okResp();
        let body; try { body = await request.json(); } catch { return okResp(); }
        if (body && (body._hp || body.hp)) return okResp(); // honeypot
        const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return okResp();
        try {
          const uuid = await siteBackendBySlug(env, slug);
          if (!uuid) return okResp();
          const secret = await initSiteAuth(env, uuid);
          const rows = await cfD1Query(env, uuid, "SELECT id,pass_hash FROM _users WHERE email=?", [email]);
          const u = rows[0];
          if (u) {
            const now = Math.floor(Date.now() / 1000);
            const pv = (await sha256hex(u.pass_hash || "")).slice(0, 16); // single-use binding
            const token = await signSiteUserToken(secret, { sub: u.id, slug, email, purpose: "reset", pv, iat: now, exp: now + 45 * 60 });
            const link = "https://isibi.ai/reset?slug=" + encodeURIComponent(slug) + "&token=" + encodeURIComponent(token);
            const html = "<p>We got a request to reset your password. Click below to choose a new one — this link expires in 45 minutes:</p>" +
              "<p><a href=\"" + link + "\">Reset your password</a></p>" +
              "<p>If you didn't request this, you can safely ignore this email.</p>";
            const send = sendPlatformEmail(env, email, "Reset your password", html);
            if (ctx && ctx.waitUntil) ctx.waitUntil(send); else { try { await send; } catch {} }
          }
        } catch (e) { console.error("site reset-request failed:", e && e.message); }
        return okResp();
      }
      // Resend the email-verification link. Neutral response (never reveals whether an
      // account exists / is already verified). Identifies the user by a Bearer token
      // (logged-in) or by {email}. Already-verified users get nothing sent.
      const vm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/auth\/verify-request$/i);
      if (vm && request.method === "POST") {
        const okResp = () => Response.json({ ok: true });
        const slug = vm[1].toLowerCase();
        if (!rateOk(slug + "|" + (request.headers.get("CF-Connecting-IP") || "0") + "|e", 10)) return okResp(); // neutral drop (no email flood)
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return okResp();
        let body; try { body = await request.json(); } catch { body = {}; }
        if (body && (body._hp || body.hp)) return okResp(); // honeypot
        try {
          const uuid = await siteBackendBySlug(env, slug);
          if (!uuid) return okResp();
          const secret = await initSiteAuth(env, uuid);
          let uid = null, email = null, verified = 0;
          const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
          if (tok) { try { const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug && p.sub) { const rows = await cfD1Query(env, uuid, "SELECT id,email,verified FROM _users WHERE id=?", [p.sub]); if (rows[0]) { uid = rows[0].id; email = rows[0].email; verified = rows[0].verified; } } } catch {} }
          if (!uid && body && body.email) {
            const em = String(body.email || "").trim().toLowerCase().slice(0, 200);
            if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { const rows = await cfD1Query(env, uuid, "SELECT id,email,verified FROM _users WHERE email=?", [em]); if (rows[0]) { uid = rows[0].id; email = rows[0].email; verified = rows[0].verified; } }
          }
          if (uid && email && !verified) await sendVerifyEmail(env, ctx, secret, slug, uid, email);
        } catch (e) { console.error("site verify-request failed:", e && e.message); }
        return okResp();
      }
      // AI primitive — a built app asks the platform LLM a question. Metered to the
      // app OWNER's credits (their visitors trigger it). Rate-limited hard.
      const aim = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/ai$/i);
      if (aim && request.method === "POST") {
        const slug = aim[1].toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY) return Response.json({ ok: false, error: "This app's AI isn't available right now." }, { status: 503 });
        if (!rateOk(slug + "|" + (request.headers.get("CF-Connecting-IP") || "0") + "|ai", 20)) return tooMany("You're asking too fast — give it a second.");
        let body; try { body = await request.json(); } catch { body = {}; }
        const ownerUid = await siteOwnerUid(env, slug);
        const res = await runSiteAI(env, ownerUid, { prompt: body && body.prompt, system: body && body.system });
        if (res.text != null) return Response.json({ ok: true, text: res.text });
        return Response.json({ ok: false, error: res.error || "AI unavailable" }, { status: 400 });
      }
      // Visitor analytics — a built app records a page view or custom event. Public,
      // fire-and-forget, buffered (never blocks). Rate-limited.
      const tm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/track$/i);
      if (tm && request.method === "POST") {
        const slug = tm[1].toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY) return Response.json({ ok: true });
        if (!rateOk(slug + "|" + (request.headers.get("CF-Connecting-IP") || "0") + "|t", 300)) return Response.json({ ok: true });
        let body; try { body = await request.json(); } catch { body = {}; }
        const event = String((body && body.event) || "view").replace(/[^a-z0-9_.:-]/gi, "").slice(0, 40) || "view";
        const path = String((body && body.path) || "").replace(/[\n\r"]/g, "").slice(0, 120);
        recordVisit(env, ctx, slug, event, path);
        return Response.json({ ok: true });
      }
      // File upload to R2 (per-app, consistent with the /api/db/<slug>/* API). Base64 data
      // URL in, a permanent public URL out. Images (PNG/JPG/WebP/GIF) + PDF, ≤6MB. Same store
      // + serve (/u/<slug>/…) as the platform uploader; only stores for a REAL live site.
      //   POST /api/db/<slug>/upload {name, data:"data:<mime>;base64,…"} → {url, name, type, size}
      const upm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/upload$/i);
      if (upm && (request.method === "POST" || request.method === "OPTIONS")) {
        const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" };
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
        const slug = upm[1].toLowerCase();
        if (!env.SITES_BUCKET) return Response.json({ ok: false, error: "uploads unavailable" }, { status: 501, headers: cors });
        const tlU = tooLargeBody(request, 9_000_000); if (tlU) return Response.json({ ok: false, error: "too large" }, { status: 413, headers: cors });
        if (!fnRateOk(slug)) return Response.json({ ok: false, error: "rate limited" }, { status: 429, headers: cors });
        let ub; try { ub = await request.json(); } catch { return Response.json({ ok: false, error: "invalid JSON" }, { status: 400, headers: cors }); }
        const m = typeof ub.data === "string" ? ub.data.match(/^data:([^;,]+);base64,(.+)$/s) : null;
        if (!m) return Response.json({ ok: false, error: "send the file as a base64 data URL" }, { status: 400, headers: cors });
        const MIME_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf" };
        const mime = m[1].toLowerCase(); const ext = MIME_EXT[mime];
        if (!ext) return Response.json({ ok: false, error: "Only images (PNG, JPG, WebP, GIF) and PDF are allowed." }, { status: 415, headers: cors });
        let bytes;
        try { const bin = atob(m[2]); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); } catch { return Response.json({ ok: false, error: "couldn't read the file" }, { status: 400, headers: cors }); }
        if (bytes.length > 6_000_000) return Response.json({ ok: false, error: "That file is too big — keep it under 6 MB." }, { status: 413, headers: cors });
        // Optional server-side resize / re-encode (photon) — shrink big photos + convert
        // format on the way in, so an app can store a bounded thumbnail instead of a 6 MB
        // phone shot. Spec via `resize:{max|w|h,format,quality}` (or top-level shortcuts).
        // Applies only to PNG/JPEG/WEBP; GIF/PDF pass through untouched. Falls back to the
        // original bytes on any failure, so a transform can never lose the upload.
        let outBytes = bytes, outMime = mime, outExt = ext;
        if (mime === "image/png" || mime === "image/jpeg" || mime === "image/webp") {
          const rspec = (ub.resize && typeof ub.resize === "object") ? ub.resize
            : ((ub.max != null || ub.w != null || ub.h != null || ub.width != null || ub.height != null || ub.format != null)
              ? { max: ub.max, w: ub.w, h: ub.h, width: ub.width, height: ub.height, format: ub.format, quality: ub.quality } : null);
          if (rspec) { const tr = transformImageBytes(bytes, mime, rspec); outBytes = tr.bytes; outMime = tr.mime; outExt = tr.ext || ext; }
        }
        let siteExists = false;
        try { if (await env.SITES_BUCKET.head("sites/" + slug + "/index.html")) siteExists = true; } catch {}
        if (!siteExists && env.SUPABASE_SERVICE_KEY) { try { const uuid = await siteBackendBySlug(env, slug); if (uuid) siteExists = true; } catch {} }
        if (!siteExists) return Response.json({ ok: false, error: "this site isn't live yet" }, { status: 400, headers: cors });
        try { const listed = await env.SITES_BUCKET.list({ prefix: "uploads/" + slug + "/", limit: 300 }); if (listed && Array.isArray(listed.objects) && listed.objects.length >= 300) return Response.json({ ok: false, error: "upload limit reached for this site" }, { status: 429, headers: cors }); } catch {}
        const id = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
        const key = "uploads/" + slug + "/" + id + "." + outExt;
        try { await env.SITES_BUCKET.put(key, outBytes, { httpMetadata: { contentType: outMime } }); } catch { return Response.json({ ok: false, error: "couldn't save the file" }, { status: 502, headers: cors }); }
        return Response.json({ ok: true, url: "https://isibi.ai/u/" + slug + "/" + id + "." + outExt, name: typeof ub.name === "string" ? ub.name.slice(0, 120) : "", type: outMime, size: outBytes.length }, { headers: cors });
      }
      // Named counters — likes / views / reactions / poll tallies. Public + atomic.
      //   POST /api/db/<slug>/count/<name>[?by=N]  → increments (default +1, floored
      //        at 0), returns {value}. GET /count/<name> → {value}. GET /count → all.
      const cm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/count(?:\/([a-z0-9_.:-]{1,60}))?\/?$/i);
      if (cm && (request.method === "GET" || request.method === "POST" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" } });
        const slug = cm[1].toLowerCase(), name = (cm[2] || "").toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        try {
          if (request.method === "GET") {
            if (!rateOk(slug + "|" + ip + "|cr", 300)) return tooMany();
            if (name) return Response.json({ ok: true, name, value: await readCounter(env, uuid, name) });
            const rows = await readAllCounters(env, uuid);
            const counters = {}; for (const r of rows) counters[r.name] = r.n;
            return Response.json({ ok: true, counters });
          }
          // POST — increment
          if (!name) return Response.json({ ok: false, error: "counter name required" }, { status: 400 });
          if (!rateOk(slug + "|" + ip + "|cw", 120)) return tooMany();
          let by = 1;
          const qby = parseInt(url.searchParams.get("by") || "", 10);
          if (Number.isFinite(qby)) by = qby;
          else { try { const b = await request.json(); if (b && b.by != null && Number.isFinite(parseInt(b.by, 10))) by = parseInt(b.by, 10); } catch {} }
          by = Math.max(-1000, Math.min(1000, by || 1));
          return Response.json({ ok: true, name, value: await bumpCounter(env, uuid, name, by) });
        } catch (e) {
          console.error("counter failed:", e && e.message, e && e.detail);
          return Response.json({ ok: false, error: "counter failed" }, { status: 502 });
        }
      }
      // Reactions — one-per-user likes / upvotes / RSVPs / emoji. GET reads counts
      // (+ the caller's own reactions if signed in); POST toggles the caller's
      // reaction of a given type and returns {reacted, count}.
      //   GET  /api/db/<slug>/react/<target>            → {counts, mine}
      //   POST /api/db/<slug>/react/<target> {type,set} → {reacted, count}  (auth)
      const xm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/react\/([a-z0-9_.:-]{1,80})$/i);
      if (xm && (request.method === "GET" || request.method === "POST" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = xm[1].toLowerCase(), target = xm[2].toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        // identify the signed-in visitor (optional for GET, required for POST)
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        try {
          if (request.method === "GET") {
            if (!rateOk(slug + "|" + ip + "|xr", 300)) return tooMany();
            return Response.json(Object.assign({ ok: true }, await reactionState(env, uuid, target, userId)));
          }
          // POST — toggle (requires login so "one per user" is real)
          if (!userId) return Response.json({ ok: false, error: "sign in to react" }, { status: 401 });
          if (!rateOk(slug + "|" + ip + "|xw", 120)) return tooMany();
          let body = {}; try { body = await request.json(); } catch {}
          const type = String((body && body.type) || "like").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24) || "like";
          const set = body && (body.set === "on" || body.set === "off") ? body.set : (body && typeof body.on === "boolean" ? (body.on ? "on" : "off") : null);
          return Response.json(Object.assign({ ok: true, type }, await toggleReaction(env, uuid, target, type, userId, set)));
        } catch (e) {
          console.error("reaction failed:", e && e.message, e && e.detail);
          return Response.json({ ok: false, error: "reaction failed" }, { status: 502 });
        }
      }
      // Follows — the member social graph. Toggle a follow, read a member's
      // followers/following counts (+ whether the caller follows them), and list either
      // side for a "Followers"/"Following" page.
      //   POST /api/db/<slug>/follow/<userId> {on?}      → toggle (auth) → {following, followers}
      //   GET  /api/db/<slug>/follow/<userId>            → {followers, following, mine}
      //   GET  /api/db/<slug>/follow/<userId>/followers  → [profiles who follow them]
      //   GET  /api/db/<slug>/follow/<userId>/following  → [profiles they follow]
      const fm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/follow\/(\d+)(?:\/(followers|following))?$/i);
      if (fm && (request.method === "GET" || request.method === "POST" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = fm[1].toLowerCase(), targetId = parseInt(fm[2], 10) || 0, dir = fm[3] || "";
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        try {
          if (request.method === "GET") {
            if (!rateOk(slug + "|" + ip + "|flr", 300)) return tooMany();
            if (dir) { const lim = parseInt(url.searchParams.get("limit") || "100", 10); return Response.json({ ok: true, dir, users: await followList(env, uuid, targetId, dir, lim) }); }
            return Response.json(Object.assign({ ok: true, id: targetId }, await followState(env, uuid, targetId, userId)));
          }
          // POST — toggle follow (requires login; can't follow yourself)
          if (!userId) return Response.json({ ok: false, error: "sign in to follow" }, { status: 401 });
          if (dir) return Response.json({ ok: false, error: "use GET for lists" }, { status: 405 });
          if (targetId === userId) return Response.json({ ok: false, error: "you can't follow yourself" }, { status: 400 });
          if (!rateOk(slug + "|" + ip + "|flw", 120)) return tooMany();
          let body = {}; try { body = await request.json(); } catch {}
          const set = body && (body.set === "on" || body.set === "off") ? body.set : (body && typeof body.on === "boolean" ? (body.on ? "on" : "off") : null);
          return Response.json(Object.assign({ ok: true, id: targetId }, await toggleFollow(env, uuid, userId, targetId, set)));
        } catch (e) {
          console.error("follow failed:", e && e.message, e && e.detail);
          return Response.json({ ok: false, error: "follow failed" }, { status: 502 });
        }
      }
      // Bookmarks / saves — a member's private "saved" list over any row (`<table>:<id>`).
      //   POST /api/db/<slug>/save/<target>  → toggle (auth) → {saved, count}
      //   GET  /api/db/<slug>/save/<target>  → {count, mine} (Bearer → mine)
      //   GET  /api/db/<slug>/saves[?table=<t>&limit=N] → the caller's saved items (auth)
      const bl = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/saves$/i);
      if (bl && (request.method === "GET" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = bl[1].toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        if (!rateOk(slug + "|" + ip + "|svlr", 300)) return tooMany();
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
        try {
          const table = (url.searchParams.get("table") || "").toLowerCase().replace(/[^a-z0-9_]/g, "") || null;
          const lim = parseInt(url.searchParams.get("limit") || "200", 10);
          return Response.json({ ok: true, saves: await bookmarkList(env, uuid, userId, table, lim) });
        } catch (e) { console.error("saves list failed:", e && e.message, e && e.detail); return Response.json({ ok: false, error: "saves failed" }, { status: 502 }); }
      }
      const sm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/save\/([a-z0-9_.:-]{1,80})$/i);
      if (sm && (request.method === "GET" || request.method === "POST" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = sm[1].toLowerCase(), target = sm[2].toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        try {
          if (request.method === "GET") {
            if (!rateOk(slug + "|" + ip + "|svr", 300)) return tooMany();
            return Response.json(Object.assign({ ok: true }, await bookmarkState(env, uuid, target, userId)));
          }
          if (!userId) return Response.json({ ok: false, error: "sign in to save" }, { status: 401 });
          if (!rateOk(slug + "|" + ip + "|svw", 120)) return tooMany();
          let body = {}; try { body = await request.json(); } catch {}
          const set = body && (body.set === "on" || body.set === "off") ? body.set : (body && typeof body.on === "boolean" ? (body.on ? "on" : "off") : null);
          return Response.json(Object.assign({ ok: true, target }, await toggleBookmark(env, uuid, userId, target, set)));
        } catch (e) { console.error("save failed:", e && e.message, e && e.detail); return Response.json({ ok: false, error: "save failed" }, { status: 502 }); }
      }
      // Polls — one vote per member (change by re-voting). Poll + options are app strings.
      //   GET    /api/db/<slug>/poll/<poll>           → {counts:{option:n}, total, mine}
      //   POST   /api/db/<slug>/poll/<poll>/<option>  → cast/change vote (auth) → state
      //   DELETE /api/db/<slug>/poll/<poll>           → withdraw your vote (auth) → state
      const plm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/poll\/([a-z0-9_.:-]{1,80})(?:\/([a-z0-9_.:-]{1,60}))?$/i);
      if (plm && (request.method === "GET" || request.method === "POST" || request.method === "DELETE" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = plm[1].toLowerCase(), poll = plm[2].toLowerCase(), option = (plm[3] || "").toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        try {
          if (request.method === "GET") { if (!rateOk(slug + "|" + ip + "|plr", 300)) return tooMany(); return Response.json(Object.assign({ ok: true, poll }, await pollState(env, uuid, poll, userId))); }
          if (!userId) return Response.json({ ok: false, error: "sign in to vote" }, { status: 401 });
          if (!rateOk(slug + "|" + ip + "|plw", 120)) return tooMany();
          if (request.method === "DELETE") return Response.json(Object.assign({ ok: true, poll }, await unvotePoll(env, uuid, poll, userId)));
          if (!option) return Response.json({ ok: false, error: "option required to vote" }, { status: 400 });
          return Response.json(Object.assign({ ok: true, poll, option }, await votePoll(env, uuid, poll, option, userId)));
        } catch (e) { console.error("poll failed:", e && e.message, e && e.detail); return Response.json({ ok: false, error: "poll failed" }, { status: 502 }); }
      }
      // Shopping cart (private per member).
      //   GET    /api/db/<slug>/cart              → {cart:[{item,table,id,qty,added_at}], count}
      //   POST   /api/db/<slug>/cart/<item> {qty} → set quantity (qty≤0 removes) (auth)
      //   DELETE /api/db/<slug>/cart/<item>       → remove one item (auth)
      //   DELETE /api/db/<slug>/cart              → empty the cart (auth)
      const crm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/cart(?:\/([a-z0-9_.:-]{1,80}))?$/i);
      if (crm && (request.method === "GET" || request.method === "POST" || request.method === "DELETE" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = crm[1].toLowerCase(), item = (crm[2] || "").toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
        try {
          if (request.method === "GET") { if (!rateOk(slug + "|" + ip + "|crr", 300)) return tooMany(); const cart = await getCart(env, uuid, userId); return Response.json({ ok: true, cart, count: cart.reduce((n, x) => n + (x.qty || 0), 0) }); }
          if (!rateOk(slug + "|" + ip + "|crw", 200)) return tooMany();
          if (request.method === "DELETE") { if (item) await setCartItem(env, uuid, userId, item, 0); else await clearCart(env, uuid, userId); return Response.json({ ok: true }); }
          // POST — set qty
          if (!item) return Response.json({ ok: false, error: "item required (<table>:<id>)" }, { status: 400 });
          let body = {}; try { body = await request.json(); } catch {}
          let qty = parseInt(body.qty, 10); if (!Number.isFinite(qty)) qty = 1; qty = Math.max(0, Math.min(qty, 100000));
          await setCartItem(env, uuid, userId, item, qty);
          const cart = await getCart(env, uuid, userId);
          return Response.json({ ok: true, cart, count: cart.reduce((n, x) => n + (x.qty || 0), 0) });
        } catch (e) { console.error("cart failed:", e && e.message, e && e.detail); return Response.json({ ok: false, error: "cart failed" }, { status: 502 }); }
      }
      // Coupons / discount codes.
      //   GET    /api/db/<slug>/coupon/<code>          → {valid, discount, remaining} (validate, public)
      //   POST   /api/db/<slug>/coupon/<code>/redeem   → atomically redeem (auth) → {ok, discount}
      //   GET    /api/db/<slug>/coupons                → list (ADMIN)
      //   POST   /api/db/<slug>/coupons {code, discount, max_uses?, expires_at?} → mint (ADMIN)
      //   DELETE /api/db/<slug>/coupons/<code>         → remove (ADMIN)
      const cpuse = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/coupon\/([a-z0-9_.-]{1,60})(\/redeem)?$/i);
      const cpadm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/coupons(?:\/([a-z0-9_.-]{1,60}))?$/i);
      if ((cpuse || cpadm) && (request.method === "GET" || request.method === "POST" || request.method === "DELETE" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = (cpuse || cpadm)[1].toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        try {
          if (cpuse) {
            const code = cpuse[2].toLowerCase(), isRedeem = !!cpuse[3];
            if (!isRedeem) { if (request.method !== "GET") return Response.json({ ok: false, error: "use /redeem to redeem" }, { status: 405 }); if (!rateOk(slug + "|" + ip + "|cpr", 300)) return tooMany(); return Response.json(Object.assign({ ok: true, code }, await couponState(env, uuid, code))); }
            if (request.method !== "POST") return Response.json({ ok: false, error: "use POST" }, { status: 405 });
            if (!userId) return Response.json({ ok: false, error: "sign in to redeem" }, { status: 401 });
            if (!rateOk(slug + "|" + ip + "|cpx", 60)) return tooMany();
            const res = await redeemCoupon(env, uuid, code);
            return Response.json(Object.assign({ code }, res), { status: res.ok ? 200 : 409 });
          }
          // admin coupon management
          if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
          const rr = await cfD1Query(env, uuid, "SELECT role FROM _users WHERE id=?", [userId]);
          if (!(rr[0] && rr[0].role === "admin")) return Response.json({ ok: false, error: "admins only" }, { status: 403 });
          await ensureCoupons(env, uuid);
          const code = cpadm[2] ? cpadm[2].toLowerCase() : null;
          if (request.method === "GET") { if (!rateOk(slug + "|" + ip + "|cpl", 300)) return tooMany(); const rows = await cfD1Query(env, uuid, "SELECT code,discount,max_uses,used,expires_at,created_at FROM _coupons ORDER BY created_at DESC LIMIT 500"); return Response.json({ ok: true, coupons: rows.map((r) => Object.assign(r, { discount: _parseDiscount(r.discount) })) }); }
          if (request.method === "DELETE") { if (!code) return Response.json({ ok: false, error: "code required" }, { status: 400 }); await cfD1Query(env, uuid, "DELETE FROM _coupons WHERE code=?", [code]); return Response.json({ ok: true, code, deleted: true }); }
          // POST — mint
          if (!rateOk(slug + "|" + ip + "|cpw", 120)) return tooMany();
          let body = {}; try { body = await request.json(); } catch {}
          const newCode = String(body.code || "").toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 60);
          if (!newCode) return Response.json({ ok: false, error: "code required" }, { status: 400 });
          const maxUses = (body.max_uses != null && Number.isFinite(parseInt(body.max_uses, 10))) ? Math.max(1, parseInt(body.max_uses, 10)) : null;
          const expiresAt = typeof body.expires_at === "string" ? body.expires_at.slice(0, 40) : null;
          await cfD1Query(env, uuid, "INSERT INTO _coupons (code,discount,max_uses,expires_at,used,created_at) VALUES (?,?,?,?,0,?) ON CONFLICT(code) DO UPDATE SET discount=excluded.discount, max_uses=excluded.max_uses, expires_at=excluded.expires_at", [newCode, JSON.stringify(body.discount === undefined ? null : body.discount), maxUses, expiresAt, new Date().toISOString()]);
          return Response.json(Object.assign({ ok: true, code: newCode }, await couponState(env, uuid, newCode)));
        } catch (e) { console.error("coupon failed:", e && e.message, e && e.detail); return Response.json({ ok: false, error: "coupon failed" }, { status: 502 }); }
      }
      // Many-to-many links between rows (targets are `<table>:<id>`).
      //   POST   /api/db/<slug>/link {a, b}      → link two rows (auth)
      //   DELETE /api/db/<slug>/link {a, b}      → unlink (auth)
      //   GET    /api/db/<slug>/links/<target>[?to=<table>] → rows linked to <target>
      const lkm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/link$/i);
      const lksm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/links\/([a-z0-9_.:-]{1,80})$/i);
      if ((lkm || lksm) && (request.method === "GET" || request.method === "POST" || request.method === "DELETE" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = (lkm || lksm)[1].toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        const okTarget = (s) => /^[a-z_][a-z0-9_]{0,40}:\d{1,18}$/i.test(String(s || ""));
        try {
          if (lksm) { if (request.method !== "GET") return Response.json({ ok: false, error: "read-only" }, { status: 405 }); if (!rateOk(slug + "|" + ip + "|lkr", 300)) return tooMany(); const target = lksm[2].toLowerCase(); const to = (url.searchParams.get("to") || "").toLowerCase().replace(/[^a-z0-9_]/g, "") || null; return Response.json({ ok: true, target, links: await linksOf(env, uuid, target, to) }); }
          // mutating /link — auth required
          let userId = null;
          const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
          if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
          if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
          if (!rateOk(slug + "|" + ip + "|lkw", 120)) return tooMany();
          let body = {}; try { body = await request.json(); } catch {}
          const a = String(body.a || "").toLowerCase(), b = String(body.b || "").toLowerCase();
          if (!okTarget(a) || !okTarget(b)) return Response.json({ ok: false, error: "a and b must be <table>:<id>" }, { status: 400 });
          if (a === b) return Response.json({ ok: false, error: "can't link a row to itself" }, { status: 400 });
          if (request.method === "DELETE") { await removeLink(env, uuid, a, b); return Response.json({ ok: true, unlinked: true }); }
          await addLink(env, uuid, a, b);
          return Response.json({ ok: true, linked: true });
        } catch (e) { console.error("links failed:", e && e.message, e && e.detail); return Response.json({ ok: false, error: "links failed" }, { status: 502 }); }
      }
      // Saved views / filters (private per member) — a named JSON query config.
      //   GET    /api/db/<slug>/views          → the caller's saved views
      //   GET    /api/db/<slug>/views/<name>   → one view's spec
      //   POST   /api/db/<slug>/views/<name> {spec}  → save/update
      //   DELETE /api/db/<slug>/views/<name>   → remove
      const vwm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/views(?:\/([a-z0-9_.:-]{1,60}))?$/i);
      if (vwm && (request.method === "GET" || request.method === "POST" || request.method === "DELETE" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = vwm[1].toLowerCase(), name = (vwm[2] || "").toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
        try {
          if (request.method === "GET") { if (!rateOk(slug + "|" + ip + "|vwr", 300)) return tooMany(); if (name) return Response.json({ ok: true, name, spec: await getView(env, uuid, userId, name) }); return Response.json({ ok: true, views: await listViews(env, uuid, userId) }); }
          if (!name) return Response.json({ ok: false, error: "view name required" }, { status: 400 });
          if (!rateOk(slug + "|" + ip + "|vww", 120)) return tooMany();
          if (request.method === "DELETE") { await deleteView(env, uuid, userId, name); return Response.json({ ok: true, name, deleted: true }); }
          let body = {}; try { body = await request.json(); } catch {}
          const spec = body && Object.prototype.hasOwnProperty.call(body, "spec") ? body.spec : body;
          await saveView(env, uuid, userId, name, spec);
          return Response.json({ ok: true, name, spec: await getView(env, uuid, userId, name) });
        } catch (e) { console.error("views failed:", e && e.message, e && e.detail); return Response.json({ ok: false, error: "views failed" }, { status: 502 }); }
      }
      // Presence / who's-online.
      //   POST /api/db/<slug>/presence            → ping "I'm here" (auth) → {ok}
      //   GET  /api/db/<slug>/presence[?within=5] → members online in the last N min (profiles)
      //   GET  /api/db/<slug>/presence/<userId>   → {online, last_seen} for one member
      const prm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/presence(?:\/(\d+))?$/i);
      if (prm && (request.method === "GET" || request.method === "POST" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = prm[1].toLowerCase(), who = prm[2] ? parseInt(prm[2], 10) : null;
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        const within = Math.min(60, Math.max(1, parseInt(url.searchParams.get("within") || "5", 10) || 5));
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        try {
          if (request.method === "GET") {
            if (!rateOk(slug + "|" + ip + "|prr", 300)) return tooMany();
            if (who) return Response.json(Object.assign({ ok: true, id: who }, await presenceOf(env, uuid, who, within)));
            return Response.json({ ok: true, within, online: await onlineList(env, uuid, within) });
          }
          if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
          if (!rateOk(slug + "|" + ip + "|prw", 120)) return tooMany();
          await touchPresence(env, uuid, userId);
          return Response.json({ ok: true });
        } catch (e) { console.error("presence failed:", e && e.message, e && e.detail); return Response.json({ ok: false, error: "presence failed" }, { status: 502 }); }
      }
      // Blocks — hide another member. `POST /block/<userId>` toggles, `GET /block/<userId>`
      // → {blocking}, `GET /blocks` → your blocked ids. Then pass `?hideBlocked=1` on a feed
      // read to drop blocked authors. All auth-only (a block is personal).
      const blm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/block\/(\d+)$/i);
      const bllm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/blocks$/i);
      if ((blm || bllm) && (request.method === "GET" || request.method === "POST" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = (blm || bllm)[1].toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
        try {
          if (bllm) { if (!rateOk(slug + "|" + ip + "|bkl", 300)) return tooMany(); return Response.json({ ok: true, blocked: await blockedIdList(env, uuid, userId) }); }
          const target = parseInt(blm[2], 10) || 0;
          if (request.method === "GET") { if (!rateOk(slug + "|" + ip + "|bkr", 300)) return tooMany(); return Response.json(Object.assign({ ok: true, id: target }, await blockState(env, uuid, userId, target))); }
          if (target === userId) return Response.json({ ok: false, error: "you can't block yourself" }, { status: 400 });
          if (!rateOk(slug + "|" + ip + "|bkw", 120)) return tooMany();
          let body = {}; try { body = await request.json(); } catch {}
          const set = body && (body.set === "on" || body.set === "off") ? body.set : (body && typeof body.on === "boolean" ? (body.on ? "on" : "off") : null);
          return Response.json(Object.assign({ ok: true, id: target }, await toggleBlock(env, uuid, userId, target, set)));
        } catch (e) { console.error("block failed:", e && e.message, e && e.detail); return Response.json({ ok: false, error: "block failed" }, { status: 502 }); }
      }
      // Content reports / flags + moderation queue.
      //   POST /api/db/<slug>/report/<target> {reason}  → flag a row (auth) → {reported, count}
      //   GET  /api/db/<slug>/report/<target>           → {count, mine}
      //   GET  /api/db/<slug>/reports[?status=open]     → the moderation queue (ADMIN)
      //   POST /api/db/<slug>/reports/<id> {action}     → resolve|dismiss (ADMIN)
      const rpm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/report\/([a-z0-9_.:-]{1,80})$/i);
      const rqm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/reports(?:\/(\d+))?$/i);
      if ((rpm || rqm) && (request.method === "GET" || request.method === "POST" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = (rpm || rqm)[1].toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        try {
          if (rpm) { // member: flag a target / read its report state
            const target = rpm[2].toLowerCase();
            if (request.method === "GET") { if (!rateOk(slug + "|" + ip + "|rpr", 300)) return tooMany(); return Response.json(Object.assign({ ok: true }, await reportState(env, uuid, target, userId))); }
            if (!userId) return Response.json({ ok: false, error: "sign in to report" }, { status: 401 });
            if (!rateOk(slug + "|" + ip + "|rpw", 60)) return tooMany();
            let body = {}; try { body = await request.json(); } catch {}
            return Response.json(Object.assign({ ok: true, target }, await createReport(env, uuid, target, userId, body && body.reason)));
          }
          // admin: the moderation queue
          if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
          const rr = await cfD1Query(env, uuid, "SELECT role FROM _users WHERE id=?", [userId]);
          if (!(rr[0] && rr[0].role === "admin")) return Response.json({ ok: false, error: "admins only" }, { status: 403 });
          await ensureReports(env, uuid);
          const rid = rqm[2] ? parseInt(rqm[2], 10) : null;
          if (request.method === "GET") {
            if (!rateOk(slug + "|" + ip + "|rqr", 300)) return tooMany();
            const status = (url.searchParams.get("status") || "open").toLowerCase().replace(/[^a-z]/g, "").slice(0, 12);
            const lim = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10) || 100));
            const rows = await cfD1Query(env, uuid, "SELECT r.id, r.target, r.reporter_id, r.reason, r.status, r.created_at, u.display_name AS reporter_name FROM _reports r LEFT JOIN _users u ON u.id=r.reporter_id" + (status && status !== "all" ? " WHERE r.status=?" : "") + " ORDER BY r.id DESC LIMIT ?", (status && status !== "all") ? [status, lim] : [lim]);
            return Response.json({ ok: true, reports: rows });
          }
          // POST /reports/<id> {action: resolve|dismiss|reopen}
          if (!rid) return Response.json({ ok: false, error: "report id required" }, { status: 400 });
          if (!rateOk(slug + "|" + ip + "|rqw", 120)) return tooMany();
          let body = {}; try { body = await request.json(); } catch {}
          const action = String(body && body.action || "").toLowerCase();
          const status = action === "resolve" ? "resolved" : action === "dismiss" ? "dismissed" : action === "reopen" ? "open" : null;
          if (!status) return Response.json({ ok: false, error: "action must be resolve|dismiss|reopen" }, { status: 400 });
          const ex = await cfD1Exec(env, uuid, "UPDATE _reports SET status=? WHERE id=?", [status, rid]);
          if (ex.changes === 0) return Response.json({ ok: false, error: "not found" }, { status: 404 });
          return Response.json({ ok: true, id: rid, status });
        } catch (e) { console.error("reports failed:", e && e.message, e && e.detail); return Response.json({ ok: false, error: "reports failed" }, { status: 502 }); }
      }
      // Data export (ADMIN) — download a table as CSV (default) or JSON.
      //   GET /api/db/<slug>/export/<table>[?format=csv|json&limit=N]
      const exm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/export\/([a-z_][a-z0-9_]{0,40})$/i);
      if (exm && (request.method === "GET" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = exm[1].toLowerCase(), table = exm[2];
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
        try {
          const rr = await cfD1Query(env, uuid, "SELECT role FROM _users WHERE id=?", [userId]);
          if (!(rr[0] && rr[0].role === "admin")) return Response.json({ ok: false, error: "admins only" }, { status: 403 });
          const spec = await loadSiteSchema(env, uuid);
          const def = tableDef(spec, table);
          if (!def) return Response.json({ ok: false, error: "unknown table" }, { status: 404 });
          if (!rateOk(slug + "|" + ip + "|expr", 30)) return tooMany();
          const lim = Math.min(50000, Math.max(1, parseInt(url.searchParams.get("limit") || "10000", 10) || 10000));
          const rows = await cfD1Query(env, uuid, "SELECT * FROM " + sqlIdent(table) + " ORDER BY id DESC LIMIT ?", [lim]);
          parseJsonRows(def, rows);
          const fmt = (url.searchParams.get("format") || "csv").toLowerCase();
          if (fmt === "json") return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": 'attachment; filename="' + table + '.json"' } });
          // CSV — union of keys across rows; RFC-4180 escaping.
          const cols = []; const seen = new Set();
          for (const r of rows) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); cols.push(k); }
          const esc = (v) => { if (v == null) return ""; const s = typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
          const csv = [cols.join(",")].concat(rows.map((r) => cols.map((c) => esc(r[c])).join(","))).join("\r\n");
          return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="' + table + '.csv"' } });
        } catch (e) { console.error("export failed:", e && e.message, e && e.detail); return Response.json({ ok: false, error: "export failed" }, { status: 502 }); }
      }
      // CSV import (ADMIN) — bulk-load a spreadsheet into a table, with optional column
      // mapping. Complements the export. Only declared columns are written; unknown/extra
      // CSV columns are ignored; each row is validated. `mapping` maps CSV-header → table-col
      // (default: headers that match a declared column auto-map).
      //   POST /api/db/<slug>/import/<table> {csv, mapping?, hasHeader?} → {inserted, skipped}
      const imm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/import\/([a-z_][a-z0-9_]{0,40})$/i);
      if (imm && (request.method === "POST" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = imm[1].toLowerCase(), table = imm[2];
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
        try {
          const rr = await cfD1Query(env, uuid, "SELECT role FROM _users WHERE id=?", [userId]);
          if (!(rr[0] && rr[0].role === "admin")) return Response.json({ ok: false, error: "admins only" }, { status: 403 });
          const spec = await loadSiteSchema(env, uuid); const def = tableDef(spec, table);
          if (!def) return Response.json({ ok: false, error: "unknown table" }, { status: 404 });
          if (!rateOk(slug + "|" + ip + "|impw", 20)) return tooMany();
          const managed = new Set(["id", "created_at", "owner_id"]);
          const allow = (Array.isArray(def.columns) ? def.columns : []).filter((n) => n && !managed.has(String(n).toLowerCase()));
          const allowByLC = new Map(allow.map((c) => [String(c).toLowerCase(), c]));
          let bd; try { bd = await request.json(); } catch { return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
          const csv = String(bd.csv || ""); if (!csv.trim()) return Response.json({ ok: false, error: "csv required" }, { status: 400 });
          // RFC-4180 parse
          const parseCsv = (text) => { const rows = []; let row = [], field = "", i = 0, inQ = false; while (i < text.length) { const ch = text[i]; if (inQ) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; } field += ch; i++; continue; } if (ch === '"') { inQ = true; i++; continue; } if (ch === ",") { row.push(field); field = ""; i++; continue; } if (ch === "\r") { i++; continue; } if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; } field += ch; i++; } if (field.length || row.length) { row.push(field); rows.push(row); } return rows; };
          const grid = parseCsv(csv);
          if (!grid.length) return Response.json({ ok: false, error: "empty csv" }, { status: 400 });
          const hasHeader = bd.hasHeader !== false;
          const headers = hasHeader ? grid[0].map((s) => String(s).trim()) : allow.slice();
          const dataRows = hasHeader ? grid.slice(1) : grid;
          const mapping = (bd.mapping && typeof bd.mapping === "object") ? bd.mapping : null;
          // resolve each source column index → target table column (or null to skip)
          const target = headers.map((hdr) => { const mapped = mapping && mapping[hdr] != null ? String(mapping[hdr]) : hdr; return allowByLC.get(String(mapped).toLowerCase()) || null; });
          if (!target.some(Boolean)) return Response.json({ ok: false, error: "no CSV columns match this table (send a mapping)" }, { status: 400 });
          const owner = (def.access === "user" || def.access === "feed") ? userId : null;
          const objs = []; let skipped = 0;
          for (const r of dataRows.slice(0, 5000)) {
            if (!r.length || (r.length === 1 && r[0].trim() === "")) { continue; }
            const obj = {}; for (let ci = 0; ci < target.length; ci++) { const col = target[ci]; if (col && r[ci] !== undefined && r[ci] !== "") obj[col] = r[ci]; }
            if (!Object.keys(obj).length) { skipped++; continue; }
            if (validateRow(def, obj, true)) { skipped++; continue; }
            objs.push(obj);
          }
          let inserted = 0;
          for (let i = 0; i < objs.length; i += 100) { try { const res = await insertMany(env, uuid, sqlIdent(table), allow, objs.slice(i, i + 100), owner, def); inserted += (res && res.inserted) || 0; } catch { skipped += Math.min(100, objs.length - i); } }
          return Response.json({ ok: true, inserted, skipped });
        } catch (e) { console.error("import failed:", e && e.message, e && e.detail); return Response.json({ ok: false, error: "import failed" }, { status: 502 }); }
      }
      // Audit trail (ADMIN) — the write history of `audit:true` tables.
      //   GET /api/db/<slug>/audit[?table=<t>&action=insert|update|delete&limit=N]
      const aum = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/audit$/i);
      if (aum && (request.method === "GET" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = aum[1].toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
        try {
          const rr = await cfD1Query(env, uuid, "SELECT role FROM _users WHERE id=?", [userId]);
          if (!(rr[0] && rr[0].role === "admin")) return Response.json({ ok: false, error: "admins only" }, { status: 403 });
          if (!rateOk(slug + "|" + ip + "|audr", 300)) return tooMany();
          const table = (url.searchParams.get("table") || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
          const action = (url.searchParams.get("action") || "").toLowerCase().replace(/[^a-z]/g, "");
          const lim = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10) || 100));
          const conds = [], params = [];
          if (table) { conds.push("row_table=?"); params.push(table); }
          if (["insert", "update", "delete"].includes(action)) { conds.push("action=?"); params.push(action); }
          let rows = [];
          try { rows = await cfD1Query(env, uuid, "SELECT id,row_table,row_id,action,actor_id,at FROM _audit" + (conds.length ? " WHERE " + conds.join(" AND ") : "") + " ORDER BY id DESC LIMIT ?", params.concat([lim])); } catch {}
          return Response.json({ ok: true, audit: rows });
        } catch (e) { console.error("audit read failed:", e && e.message, e && e.detail); return Response.json({ ok: false, error: "audit failed" }, { status: 502 }); }
      }
      // App settings / config KV — public READ (the app renders from it), ADMIN-only WRITE.
      //   GET    /api/db/<slug>/config          → {config:{k:value}}
      //   GET    /api/db/<slug>/config/<key>    → {key, value}
      //   POST   /api/db/<slug>/config/<key> {value}  → set (admin site-user)
      //   DELETE /api/db/<slug>/config/<key>   → remove (admin)
      const gm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/config(?:\/([a-z0-9_.:-]{1,60}))?$/i);
      if (gm && (request.method === "GET" || request.method === "POST" || request.method === "DELETE" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = gm[1].toLowerCase(), key = (gm[2] || "").toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        try {
          if (request.method === "GET") {
            if (!rateOk(slug + "|" + ip + "|cfgr", 300)) return tooMany();
            if (key) return Response.json({ ok: true, key, value: await readConfig(env, uuid, key) });
            return Response.json({ ok: true, config: await readConfig(env, uuid) });
          }
          // writes require an admin site-user (only the app's admin changes settings)
          let userId = null;
          const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
          if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
          if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
          const rr = await cfD1Query(env, uuid, "SELECT role FROM _users WHERE id=?", [userId]);
          if (!(rr[0] && rr[0].role === "admin")) return Response.json({ ok: false, error: "admins only" }, { status: 403 });
          if (!key) return Response.json({ ok: false, error: "config key required" }, { status: 400 });
          if (!rateOk(slug + "|" + ip + "|cfgw", 120)) return tooMany();
          if (request.method === "DELETE") { await ensureConfig(env, uuid); await cfD1Query(env, uuid, "DELETE FROM _config WHERE k=?", [key]); return Response.json({ ok: true, key, deleted: true }); }
          let body = {}; try { body = await request.json(); } catch {}
          const value = body && Object.prototype.hasOwnProperty.call(body, "value") ? body.value : body;
          await writeConfig(env, uuid, key, value);
          return Response.json({ ok: true, key, value: await readConfig(env, uuid, key) });
        } catch (e) {
          console.error("config failed:", e && e.message, e && e.detail);
          return Response.json({ ok: false, error: "config failed" }, { status: 502 });
        }
      }
      // API keys for app-to-app access — an ADMIN site-user mints long-lived secret keys
      // that another server presents as `X-API-Key` to the data API (instead of a login).
      // Each key is bound to the minting admin's identity, so it inherits that role. Only
      // a hash is stored; the plaintext `sk_…` is returned ONCE at mint time.
      //   GET    /api/db/<slug>/apikeys            → {keys:[{id,label,prefix,created_at,last_used,revoked}]} (admin)
      //   POST   /api/db/<slug>/apikeys {label?}   → {id, key:"sk_…"} shown once (admin)
      //   DELETE /api/db/<slug>/apikeys/<id>       → revoke (admin)
      const akm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/apikeys(?:\/(\d+))?$/i);
      if (akm && (request.method === "GET" || request.method === "POST" || request.method === "DELETE" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = akm[1].toLowerCase(), keyId = akm[2] ? parseInt(akm[2], 10) : null;
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        if (!rateOk(slug + "|" + ip + "|akw", 60)) return tooMany();
        // Managing keys requires an ADMIN site-user (mirrors config writes).
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
        try {
          const rr = await cfD1Query(env, uuid, "SELECT role FROM _users WHERE id=?", [userId]);
          if (!(rr[0] && rr[0].role === "admin")) return Response.json({ ok: false, error: "admins only" }, { status: 403 });
          await ensureApiKeys(env, uuid);
          if (request.method === "GET") {
            const rows = await cfD1Query(env, uuid, "SELECT id, label, prefix, created_at, last_used, revoked FROM _apikeys ORDER BY id DESC LIMIT 200");
            return Response.json({ ok: true, keys: rows.map((r) => Object.assign(r, { revoked: !!r.revoked })) });
          }
          if (request.method === "DELETE") {
            if (!(keyId > 0)) return Response.json({ ok: false, error: "key id required" }, { status: 400 });
            const ex = await cfD1Exec(env, uuid, "UPDATE _apikeys SET revoked=1 WHERE id=?", [keyId]);
            return ex.changes > 0 ? Response.json({ ok: true, id: keyId, revoked: true }) : Response.json({ ok: false, error: "not found" }, { status: 404 });
          }
          // POST — mint
          let body = {}; try { body = await request.json(); } catch {}
          const label = String(body.label || "").replace(/[\r\n]+/g, " ").slice(0, 80) || null;
          const cnt = await cfD1Query(env, uuid, "SELECT COUNT(*) AS n FROM _apikeys WHERE revoked=0");
          if (cnt[0] && cnt[0].n >= 50) return Response.json({ ok: false, error: "too many active keys (max 50) — revoke some first" }, { status: 400 });
          const rand = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
          const plain = "sk_" + rand; // 48 hex chars after the prefix
          const hash = await sha256hex(plain);
          const prefix = plain.slice(0, 10); // shown in listings so keys are identifiable
          await cfD1Query(env, uuid, "INSERT INTO _apikeys (key_hash, prefix, label, user_id, created_at, revoked) VALUES (?,?,?,?,?,0)", [hash, prefix, label, userId, new Date().toISOString()]);
          const idr = await cfD1Query(env, uuid, "SELECT id FROM _apikeys WHERE key_hash=?", [hash]);
          return Response.json({ ok: true, id: idr[0] && idr[0].id, key: plain, label, note: "Copy this key now — it won't be shown again." });
        } catch (e) {
          console.error("apikeys failed:", e && e.message, e && e.detail);
          return Response.json({ ok: false, error: "apikeys failed" }, { status: 502 });
        }
      }
      // Mentions → notifications — a member @mentions others in a post/comment; the app
      // detects the handles client-side and calls this with the mentioned user ids, which
      // drops a "mention" notification into each one's inbox. Capped (≤10/call), rate-limited,
      // and deduped per (recipient, target) within an hour so it can't be used to spam.
      //   POST /api/db/<slug>/mention {target, users:[ids], text?}  (auth) → {notified}
      const mnm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/mention$/i);
      if (mnm && (request.method === "POST" || request.method === "OPTIONS")) {
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
        const slug = mnm[1].toLowerCase();
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
        if (!rateOk(slug + "|" + ip + "|mnw", 20)) return tooMany();
        try {
          let body = {}; try { body = await request.json(); } catch {}
          const target = String(body.target || "").slice(0, 400);
          const text = String(body.text || "mentioned you").replace(/[\r\n]+/g, " ").slice(0, 300);
          const ids = [...new Set((Array.isArray(body.users) ? body.users : []).map((x) => parseInt(x, 10)).filter((n) => n > 0 && n !== userId))].slice(0, 10);
          if (!ids.length) return Response.json({ ok: false, error: "no valid users to notify" }, { status: 400 });
          await ensureNotifications(env, uuid);
          let notified = 0;
          for (const uid of ids) {
            if (target) { try { const dup = await cfD1Query(env, uuid, "SELECT 1 FROM _notifications WHERE user_id=? AND type='mention' AND link=? AND datetime(created_at) > datetime('now','-1 hour') LIMIT 1", [uid, target]); if (dup[0]) continue; } catch {} }
            // only notify real members
            const exists = await cfD1Query(env, uuid, "SELECT 1 FROM _users WHERE id=?", [uid]);
            if (!exists[0]) continue;
            if (await createNotification(env, uuid, uid, { type: "mention", text, link: target })) notified++;
          }
          return Response.json({ ok: true, notified });
        } catch (e) { console.error("mention failed:", e && e.message, e && e.detail); return Response.json({ ok: false, error: "mention failed" }, { status: 502 }); }
      }
      // In-app notification inbox (the signed-in member's OWN notifications):
      //   GET  /api/db/<slug>/notifications[?unread=1&limit=N] → {rows, unread}
      //   POST /api/db/<slug>/notifications/<id>/read           → mark one read
      //   POST /api/db/<slug>/notifications/read-all            → mark all read
      const nm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/notifications(?:\/(\d+\/read|read-all))?$/i);
      if (nm) {
        const slug = nm[1].toLowerCase(), sub = nm[2] || "";
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const ip = request.headers.get("CF-Connecting-IP") || "0";
        // must be signed in — the inbox is strictly the caller's own
        let userId = null;
        const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
        try {
          await ensureNotifications(env, uuid);
          if (!sub) {
            if (request.method !== "GET") return Response.json({ ok: false, error: "read-only" }, { status: 405 });
            if (!rateOk(slug + "|" + ip + "|nfr", 300)) return tooMany();
            const lim = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));
            const onlyUnread = url.searchParams.get("unread") === "1";
            const rows = await cfD1Query(env, uuid, "SELECT id,type,text,link,read,created_at FROM _notifications WHERE user_id=?" + (onlyUnread ? " AND read=0" : "") + " ORDER BY id DESC LIMIT ?", [userId, lim]);
            const uc = await cfD1Query(env, uuid, "SELECT COUNT(*) AS n FROM _notifications WHERE user_id=? AND read=0", [userId]);
            return Response.json({ ok: true, rows, unread: (uc[0] && uc[0].n) || 0 });
          }
          if (request.method !== "POST") return Response.json({ ok: false, error: "use POST" }, { status: 405 });
          if (!rateOk(slug + "|" + ip + "|nfw", 120)) return tooMany();
          if (sub === "read-all") { await cfD1Query(env, uuid, "UPDATE _notifications SET read=1 WHERE user_id=? AND read=0", [userId]); return Response.json({ ok: true }); }
          const nid = parseInt(sub, 10) || 0; // "<id>/read" → parseInt grabs the id
          const ex = await cfD1Exec(env, uuid, "UPDATE _notifications SET read=1 WHERE id=? AND user_id=?", [nid, userId]);
          if (ex.changes === 0) return Response.json({ ok: false, error: "not found" }, { status: 404 });
          return Response.json({ ok: true });
        } catch (e) {
          console.error("notifications failed:", e && e.message, e && e.detail);
          return Response.json({ ok: false, error: "notifications failed" }, { status: 502 });
        }
      }
    }
    // Built-site password reset — step 2: set a new password with the token.
    {
      const rm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/auth\/reset$/i);
      if (rm && request.method === "POST") {
        const slug = rm[1].toLowerCase();
        const fail = (error, code) => Response.json({ ok: false, error }, { status: code || 400 });
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return fail("Reset is unavailable right now.", 503);
        let body; try { body = await request.json(); } catch { return fail("Bad request."); }
        const token = typeof body.token === "string" ? body.token : "";
        const password = String(body.password || "");
        if (password.length < 8) return fail("Password must be at least 8 characters.");
        if (password.length > 200) return fail("Password is too long.");
        try {
          const uuid = await siteBackendBySlug(env, slug);
          if (!uuid) return fail("This reset link is invalid or has expired. Request a new one.");
          const secret = await initSiteAuth(env, uuid);
          const p = await verifySiteUserToken(secret, token);
          if (!p || p.purpose !== "reset" || p.slug !== slug || !p.sub) return fail("This reset link is invalid or has expired. Request a new one.");
          const rows = await cfD1Query(env, uuid, "SELECT id,email,pass_hash FROM _users WHERE id=?", [p.sub]);
          const u = rows[0];
          if (!u) return fail("This reset link is invalid or has expired. Request a new one.");
          // Single-use: the token's pv must still match the CURRENT hash.
          const pv = (await sha256hex(u.pass_hash || "")).slice(0, 16);
          if (pv !== p.pv) return fail("This reset link has already been used. Request a new one.");
          const { salt, hash } = await hashPassword(password);
          await cfD1Query(env, uuid, "UPDATE _users SET pass_salt=?, pass_hash=?, failed=0, locked_until=NULL WHERE id=?", [salt, hash, u.id]);
          const now = Math.floor(Date.now() / 1000);
          const session = await signSiteUserToken(secret, { sub: u.id, slug, email: u.email, iat: now, exp: now + 60 * 60 * 24 * 30 });
          return Response.json({ ok: true, token: session, user: { id: u.id, email: u.email } });
        } catch (e) {
          console.error("site reset failed:", e && e.message, e && e.detail);
          return fail("Couldn't reset your password. Please try again.", 502);
        }
      }
    }
    // Phase D.0 — GLOBAL SEARCH across a site's tables: GET /api/db/<slug>/search?q=…
    // [&tables=a,b][&per=N]. Runs the same free-text `q` match each table's list read uses, over
    // EVERY readable table at once (a CRM's global search bar → matching contacts + deals +
    // tickets in one call). Per-table read visibility is respected: display/feed/admin search all
    // rows, a `user` table only the caller's own (needs auth, else that table is skipped), a
    // write-only `collect` table is never searched; trashed rows are excluded and field-level
    // security is applied. Returns `{results:[{table, rows}], count}` grouped by table.
    {
      const sm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/search$/i);
      if (sm) {
        if (request.method !== "GET") return Response.json({ ok: false, error: "read-only" }, { status: 405 });
        const slug = sm[1].toLowerCase();
        const q = (url.searchParams.get("q") || "").trim();
        if (!q) return Response.json({ ok: false, error: "q required" }, { status: 400 });
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const rlIp = request.headers.get("CF-Connecting-IP") || "0";
        if (!rateOk(slug + "|" + rlIp + "|search", 120)) return tooMany();
        const spec = await loadSiteSchema(env, uuid);
        if (!spec || !Array.isArray(spec.tables)) return Response.json({ ok: true, q, results: [], count: 0 });
        let userId = null, callerRole = null;
        const stok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (stok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, stok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        if (userId) { try { const rr = await cfD1Query(env, uuid, "SELECT role FROM _users WHERE id=?", [userId]); callerRole = (rr[0] && rr[0].role) || null; } catch {} }
        const want = (url.searchParams.get("tables") || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
        const per = Math.min(25, Math.max(1, parseInt(url.searchParams.get("per") || url.searchParams.get("limit") || "5", 10) || 5));
        const managed = new Set(["id", "created_at", "owner_id"]);
        const qUrl = new URL("https://s/?q=" + encodeURIComponent(q)); // q-only filter (no per-table where leaks across tables)
        const results = []; let count = 0, scanned = 0;
        for (const tdef of spec.tables) {
          if (scanned >= 20) break;
          const tbl = String((tdef && tdef.name) || "").toLowerCase();
          if (!tbl || !/^[a-z_][a-z0-9_]{0,40}$/.test(tbl) || (want.length && !want.includes(tbl))) continue;
          const access = tdef.access || "collect";
          if (access === "collect") continue;
          const allow = (Array.isArray(tdef.columns) ? tdef.columns : []).filter((n) => n && !managed.has(String(n).toLowerCase()));
          if (!allow.length) continue;
          let base = null;
          if (access === "user") { if (!userId) continue; base = { clause: "owner_id=?", params: [userId] }; }
          if (tdef.trash) base = base ? { clause: base.clause + " AND deleted_at IS NULL", params: base.params.slice() } : { clause: "deleted_at IS NULL", params: [] };
          scanned++;
          const f = buildD1Filter(qUrl, allow, base);
          let rows = [];
          try { rows = await cfD1Query(env, uuid, "SELECT * FROM " + sqlIdent(tbl) + f.whereSql + " ORDER BY id DESC LIMIT " + per, f.params); } catch { continue; }
          if (!rows.length) continue;
          parseJsonRows(tdef, rows); attachComputed(tdef, rows); attachFormulas(tdef, rows); attachCurrency(tdef, rows); attachSla(tdef, rows);
          stripFieldRoles(tdef, rows, callerRole);
          results.push({ table: tbl, rows });
          count += rows.length;
        }
        return Response.json({ ok: true, q, results, count });
      }
    }
    // Phase D.1 — attachment fetch: GET /api/db/<slug>/attach/<attId> streams a record's stored
    // file from R2 (base64 → bytes) with its content-type. Access follows the underlying record's
    // visibility (public-read tables → anyone; a `user` row → its owner/team/admin), so the bucket
    // is never exposed. A missing/forbidden attachment is an indistinguishable 404.
    {
      const am = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/attach\/(\d+)$/i);
      if (am) {
        if (request.method !== "GET") return Response.json({ ok: false, error: "read-only" }, { status: 405 });
        const slug = am[1].toLowerCase(), attId = parseInt(am[2], 10);
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "not found" }, { status: 404 });
        await ensureAttachments(env, uuid);
        const a = (await cfD1Query(env, uuid, "SELECT * FROM _attachments WHERE id=?", [attId]))[0];
        if (!a) return Response.json({ ok: false, error: "not found" }, { status: 404 });
        const spec = await loadSiteSchema(env, uuid);
        const tdef = tableDef(spec, a.row_table);
        if (!tdef) return Response.json({ ok: false, error: "not found" }, { status: 404 });
        const access = tdef.access || "collect";
        let userId = null;
        const atok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (atok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, atok); if (p && p.slug === slug) userId = p.sub; } catch {} }
        if (!(await memberCanSeeRow(env, uuid, tdef, sqlIdent(a.row_table), a.row_id, userId, access))) return Response.json({ ok: false, error: "not found" }, { status: 404 });
        let obj = null; try { obj = await env.SITES_BUCKET.get(a.r2_key); } catch {}
        if (!obj) return Response.json({ ok: false, error: "not found" }, { status: 404 });
        const b64 = await obj.text();
        let bytes; try { const bin = atob(b64); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); } catch { return Response.json({ ok: false, error: "corrupt" }, { status: 502 }); }
        const safeName = String(a.filename || "file").replace(/["\r\n]/g, "");
        return new Response(bytes, { headers: { "content-type": a.content_type || "application/octet-stream", "content-disposition": 'inline; filename="' + safeName + '"', "cache-control": "private, max-age=300" } });
      }
    }
    // Phase D — public data API: /api/db/<slug>/rows/<table>[/<id>], access enforced
    // by the table's declared mode (collect / display / user). Only declared tables +
    // columns are reachable; identifiers are validated; every value is parameterized.
    {
      const dm = url.pathname.match(/^\/api\/db\/([a-z0-9-]{1,60})\/rows\/([a-z_][a-z0-9_]{0,40})(?:\/(\d+|stats|changes|facets|near|tree|duplicates|overdue)(?:\/(incr|restore|tags|share|move|history|revert|archive|unarchive|assign|merge|submit|approve|reject|approvals|notes|timeline|escalate|attach)(?:\/([a-z0-9_-]{1,40}))?)?)?$/i);
      if (dm) {
        const slug = dm[1].toLowerCase(), table = dm[2], method = request.method;
        const isStats = dm[3] === "stats";
        const isChanges = dm[3] === "changes";
        const isFacets = dm[3] === "facets";
        const isNear = dm[3] === "near";
        const isTree = dm[3] === "tree";
        const isDupes = dm[3] === "duplicates";
        const isOverdue = dm[3] === "overdue";
        const isIncr = dm[4] === "incr";
        const isRestore = dm[4] === "restore";
        const isTags = dm[4] === "tags";
        const isShare = dm[4] === "share";
        const isAssign = dm[4] === "assign";
        const isMerge = dm[4] === "merge";
        const isMove = dm[4] === "move";
        const isHistory = dm[4] === "history";
        const isRevert = dm[4] === "revert";
        const isArchive = dm[4] === "archive" || dm[4] === "unarchive";
        const isApprovalAct = dm[4] === "submit" || dm[4] === "approve" || dm[4] === "reject";
        const isApprovalsLog = dm[4] === "approvals";
        const isNotes = dm[4] === "notes";
        const isTimeline = dm[4] === "timeline";
        const isAttach = dm[4] === "attach";
        const rowId = dm[3] && !["stats", "changes", "facets", "near", "tree", "duplicates", "overdue"].includes(dm[3]) ? parseInt(dm[3], 10) : null;
        if (!env.SUPABASE_SERVICE_KEY || !d1Configured(env)) return Response.json({ ok: false, error: "backend unavailable" }, { status: 503 });
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return Response.json({ ok: false, error: "this site has no backend yet" }, { status: 404 });
        const rlIp = request.headers.get("CF-Connecting-IP") || "0";
        try {
          const spec = await loadSiteSchema(env, uuid);
          // Per-IP data-API throttle. Owner-tunable per app via schema `rateLimits`
          // ({read,write} req/min); falls back to the platform defaults (300/60).
          const appRl = spec && spec.rateLimits ? spec.rateLimits : null;
          const rlCap = method === "GET" ? ((appRl && appRl.read) || 300) : ((appRl && appRl.write) || 60);
          if (!rateOk(slug + "|" + rlIp + "|" + (method === "GET" ? "r" : "w"), rlCap)) return tooMany();
          const def = tableDef(spec, table);
          if (!def) return Response.json({ ok: false, error: "unknown table" }, { status: 404 });
          const access = def.access || "collect";
          const managed = new Set(["id", "created_at", "owner_id"]);
          const allow = (Array.isArray(def.columns) ? def.columns : []).filter((n) => n && !managed.has(String(n).toLowerCase()));
          // `expires_at` is platform-added but APP-SET (the app chooses when a row expires),
          // so it's writable + queryable + sortable like a normal column on expiring tables.
          if (def.expires && !allow.some((c) => String(c).toLowerCase() === "expires_at")) allow.push("expires_at");
          // `pinned` is platform-added but APP-SET (the app marks featured rows), so it's
          // writable + queryable + sortable like a normal column on pinnable tables.
          if (def.pinnable && !allow.some((c) => String(c).toLowerCase() === "pinned")) allow.push("pinned");
          // `publish_at` is platform-added but APP-SET (the app schedules when a row goes
          // live), so it's writable + queryable + sortable on scheduled tables.
          if (def.scheduled && !allow.some((c) => String(c).toLowerCase() === "publish_at")) allow.push("publish_at");
          const tn = sqlIdent(table);
          // Identify the logged-in visitor (site-user token), if any.
          let userId = null;
          const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
          if (tok) { try { const secret = await initSiteAuth(env, uuid); const p = await verifySiteUserToken(secret, tok); if (p && p.slug === slug) userId = p.sub; } catch {} }
          // App-to-app access — an `X-API-Key` (minted by an admin) authenticates the
          // caller as the member the key is bound to, so it flows through the same
          // per-access authz as a logged-in visitor. Only consulted when there's no
          // site-user token, so a real login always wins.
          if (!userId) { const kid = await resolveApiKeyUser(env, ctx, uuid, request); if (kid) userId = kid; }
          // Field-level security — on a `fieldRoles:{col:[roles]}` table, sensitive columns are
          // stripped from READ responses for members whose role isn't in the allow-list (an
          // `admin` always sees everything). Resolve the caller's role ONCE, and only when the
          // table actually declares fieldRoles (so every other table pays nothing). `public` =
          // not signed in.
          let callerRole = null;
          if (def.fieldRoles) { if (userId) { try { const rr = await cfD1Query(env, uuid, "SELECT role FROM _users WHERE id=?", [userId]); callerRole = (rr[0] && rr[0].role) || "user"; } catch { callerRole = "user"; } } else callerRole = "public"; }
          // Team / manager-hierarchy visibility — on a `teamRead:true` user table a manager can
          // READ rows owned by their whole downline (recursive `_users.manager_id`), not just
          // their own; WRITES stay own-row-only. Compute the readable owner-id set ONCE (a
          // recursive CTE from the caller down), only for GET on such a table. `teamIds` is null
          // unless the caller actually has reports, so a solo user's reads are unchanged.
          let teamIds = null;
          if (def.teamRead && def.access === "user" && userId && method === "GET") {
            try { const dl = await cfD1Query(env, uuid, "WITH RECURSIVE dl(id) AS (SELECT ? UNION SELECT u.id FROM _users u JOIN dl ON u.manager_id = dl.id) SELECT id FROM dl LIMIT 5000", [userId]); const ids = dl.map((r) => r.id).filter((x) => x != null); if (ids.length > 1) teamIds = ids; } catch {}
          }
          const userReadBase = () => teamIds ? { clause: "owner_id IN (" + teamIds.map(() => "?").join(",") + ")", params: teamIds.slice() } : { clause: "owner_id=?", params: [userId] };
          // Email-verification gate — on a `requireVerified:true` table, a signed-in member
          // must have confirmed their email before ANY write (single choke point covering
          // every write branch). Unverified → 403 {code:'unverified'}. Reads are unaffected.
          if (def.requireVerified && userId && (method === "POST" || method === "PATCH" || method === "DELETE")) {
            try { const vr = await cfD1Query(env, uuid, "SELECT verified FROM _users WHERE id=?", [userId]); if (!(vr[0] && vr[0].verified)) return Response.json({ ok: false, error: "please verify your email first", code: "unverified" }, { status: 403 }); } catch {}
          }
          // Per-member write throttle — on a `rateLimit:N` table each member may make at most
          // N writes per minute to it (anti-spam: "max 5 posts/min"). Keyed per member+table.
          if (def.rateLimit && userId && (method === "POST" || method === "PATCH" || method === "DELETE")) {
            if (!rateOk(slug + "|urate|" + table + "|" + userId, def.rateLimit)) return tooMany("You're doing that too quickly — please slow down.");
          }
          let _bodyCache; const readBody = async () => { if (_bodyCache === undefined) { try { _bodyCache = jsonizeRow(def, await request.json()); } catch { _bodyCache = {}; } } return _bodyCache; }; // memoized (read once) + JSON/array columns stringified on the way in
          const pickCols = (body) => allow.filter((c) => body[c] !== undefined);
          // Stage-gating / state machine — on a `transitions:{col:{from:[to,…]}}` table a PATCH
          // that MOVES a guarded column must follow a declared path (opportunity stage, case
          // status, order state). Reads the row's CURRENT value; a disallowed move → 409
          // {code:'transition'}. Single choke point covering every PATCH branch. Use `"*"` as a
          // from-key to allow a move from ANY current value.
          if (def.transitions && method === "PATCH" && rowId != null) {
            const body = await readBody();
            for (const [col, map] of Object.entries(def.transitions)) {
              if (body[col] === undefined) continue;
              const to = String(body[col]);
              let cur; try { cur = await cfD1Query(env, uuid, "SELECT " + sqlIdent(col) + " AS v FROM " + tn + " WHERE id=?", [rowId]); } catch { cur = []; }
              if (!cur[0]) continue; // row missing → let the branch return its own 404
              const from = cur[0].v == null ? "" : String(cur[0].v);
              if (from === to) continue; // no change
              const allowed = map[from] || map["*"] || [];
              if (!allowed.includes(to)) return Response.json({ ok: false, error: "can't move " + col + " from '" + from + "' to '" + to + "' — not an allowed step", code: "transition", column: col, from, to, allowed }, { status: 409 });
            }
          }
          const doExpand = async (rows) => { parseJsonRows(def, rows); attachComputed(def, rows); attachFormulas(def, rows); attachCurrency(def, rows); attachSla(def, rows); await expandRows(env, uuid, spec, def, rows, url); await expandChildren(env, uuid, spec, def, rows, url); await attachCounts(env, uuid, spec, def, rows, url); await attachRollups(env, uuid, spec, def, rows, url); await attachAuthors(env, uuid, rows, url); await attachReactions(env, uuid, table, rows, url, userId); await attachTags(env, uuid, table, rows, url); stripFieldRoles(def, rows, callerRole); projectFields(rows, url, allow); return rows; }; // JSON cols parsed + ?expand + ?children + ?count + ?authors=1 + ?reactions=1 + ?tags=1 + field-level security strip + ?fields projection (last)
          const upCol = (() => { const c = (url.searchParams.get("upsert") || "").trim().toLowerCase(); return c ? (allow.find((a) => String(a).toLowerCase() === c) || null) : null; })(); // ?upsert=<col> → create-or-update by that key
          const badReq = (msg) => Response.json({ ok: false, error: msg }, { status: 400 });
          const vErr = (b, isInsert) => validateRow(def, b, isInsert); // required/format/length — returns an error string or null
          const vBatch = (arr) => { for (const rr of arr) { const e = vErr(rr, true); if (e) return e; } return null; };
          // Single-row PATCH executor with optimistic-concurrency support. Bumps _version
          // on version tables, honors ?ifVersion / If-Match, and distinguishes a stale-write
          // conflict (row exists but version moved) from a genuine not-found/not-yours.
          // Auto edit-timestamp fragment — on a `timestamps:true` table every UPDATE also
          // bumps updated_at to now (spliced into the SET clause of single/bulk PATCH + incr).
          const tsFrag = (def.timestamps || def.sync) ? ", \"updated_at\"=datetime('now')" : "";
          // Auto-managed columns this table has that are legitimately sortable/filterable
          // (so `?sort=position`, `?sort=updated_at`, `?sort=_version` work even though they
          // aren't app-declared columns).
          const listExtras = [].concat(def.ordered ? ["position"] : [], (def.timestamps || def.sync) ? ["updated_at"] : [], def.version ? ["_version"] : [], def.approval ? [def.approval.status] : [], def.sequence ? [def.sequence.field] : []);
          // List-ordering options for this table: pinned-first (if pinnable) and a built-in
          // defaultSort used when the request sends no sort of its own.
          const listOpts = { pinCol: def.pinnable ? "pinned" : null, defaultSort: def.defaultSort || null, searchWeights: def.searchWeights || null };
          const applyVersionedUpdate = async (use, body, scopeSql, scopeParams) => {
            const v = versionBits(def, url, request);
            const setSql = use.map((c) => sqlIdent(c) + "=?").join(",") + v.setFrag + tsFrag;
            const ex = await cfD1Exec(env, uuid, "UPDATE " + tn + " SET " + setSql + " WHERE id=?" + scopeSql + v.guardSql, use.map((c) => body[c]).concat([rowId], scopeParams, v.guardParams));
            if (ex.changes > 0) { let version; if (v.on) { try { const r = await cfD1Query(env, uuid, 'SELECT "_version" AS v FROM ' + tn + " WHERE id=?", [rowId]); version = r[0] && r[0].v; } catch {} } return { ok: true, version }; }
            if (v.on && v.want != null) { const r = await cfD1Query(env, uuid, 'SELECT "_version" AS v FROM ' + tn + " WHERE id=?" + scopeSql, [rowId].concat(scopeParams)); if (r[0]) return { conflict: r[0].v }; }
            return { notFound: true };
          };
          const versionResp = (r) => r.conflict !== undefined
            ? Response.json({ ok: false, error: "this record changed since you loaded it — reload and try again", code: "conflict", version: r.conflict }, { status: 409 })
            : r.notFound ? Response.json({ ok: false, error: "not found" }, { status: 404 })
              : Response.json({ ok: true, version: r.version });

          // Soft delete / trash — on tables declared with `trash:true`, DELETE hides a
          // row (sets deleted_at) instead of removing it; reads exclude trashed rows by
          // default. `?trashed=1` lists ONLY trashed; `?withTrashed=1` lists everything.
          const trashOn = !!def.trash;
          const trashClause = trashOn
            ? (url.searchParams.get("withTrashed") === "1" ? "" : url.searchParams.get("trashed") === "1" ? "deleted_at IS NOT NULL" : "deleted_at IS NULL")
            : "";
          // Expiring rows / TTL — on tables declared with `expires:true`, reads hide rows
          // whose `expires_at` is in the past (a flash sale, a story, a temp invite). The
          // app sets expires_at (any datetime/ISO string); comparison via SQLite datetime()
          // normalizes formats and needs no bound param. `?expired=1` lists only expired,
          // `?withExpired=1` lists everything. NULL expires_at = never expires.
          const expiresOn = !!def.expires;
          const expiresClause = expiresOn
            ? (url.searchParams.get("withExpired") === "1" ? "" : url.searchParams.get("expired") === "1" ? "(expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now'))" : "(expires_at IS NULL OR datetime(expires_at) > datetime('now'))")
            : "";
          // Scheduled publish (inverse of TTL) — on `scheduled:true` tables reads HIDE rows
          // whose `publish_at` is still in the future (drafts / scheduled posts); NULL or a
          // past time = live. `?scheduled=1` lists only the not-yet-published, `?withScheduled=1`
          // lists everything. Param-free (SQLite datetime()), composes into visClause.
          const scheduledOn = !!def.scheduled;
          const publishClause = scheduledOn
            ? (url.searchParams.get("withScheduled") === "1" ? "" : url.searchParams.get("scheduled") === "1" ? "(publish_at IS NOT NULL AND datetime(publish_at) > datetime('now'))" : "(publish_at IS NULL OR datetime(publish_at) <= datetime('now'))")
            : "";
          // Soft archive (Gmail-style "archive", distinct from trash) — on `archivable:true`
          // tables reads HIDE archived rows by default; `?archived=1` lists only archived,
          // `?withArchived=1` lists everything. Toggled via the /archive|/unarchive endpoints.
          const archivableOn = !!def.archivable;
          const archivedClause = archivableOn
            ? (url.searchParams.get("withArchived") === "1" ? "" : url.searchParams.get("archived") === "1" ? "archived_at IS NOT NULL" : "archived_at IS NULL")
            : "";
          // Combined default row visibility (trash + expiry + scheduled + archive). All
          // clauses are param-free, so they compose into one AND-ed suffix shared by list,
          // single-GET, stats, and bulk.
          const visClause = [trashClause, expiresClause, publishClause, archivedClause].filter(Boolean).join(" AND ");
          const withVisible = (base) => { if (!visClause) return base; const c = base && base.clause ? base.clause + " AND " + visClause : visClause; return { clause: c, params: base ? base.params.slice() : [] }; };
          // On a trash table, DELETE soft-deletes (sets deleted_at) unless `?hard=1`;
          // otherwise it's a real cascade delete. Returns true if a row was affected.
          const doDelete = async (scopeSql, scopeParams) => {
            if (trashOn && url.searchParams.get("hard") !== "1") {
              const ex = await cfD1Exec(env, uuid, "UPDATE " + tn + " SET deleted_at=? WHERE id=? AND deleted_at IS NULL" + scopeSql, [new Date().toISOString(), rowId].concat(scopeParams));
              return ex.changes > 0;
            }
            return await cascadeDeleteRow(env, uuid, spec, table, tn, rowId, scopeSql, scopeParams);
          };

          // Tags — `?tag=<x>` filters the list to rows carrying that tag; `?tags=1`
          // attaches each row's tag array. Both need the _tags table.
          const tagParam = cleanTag(url.searchParams.get("tag") || "");
          const withTagFilter = (base) => {
            if (!tagParam) return base;
            const c = { clause: "id IN (SELECT row_id FROM _tags WHERE row_table=? AND tag=?)", params: [table, tagParam] };
            if (!base || !base.clause) return c;
            return { clause: base.clause + " AND " + c.clause, params: base.params.concat(c.params) };
          };
          if (tagParam || url.searchParams.get("tags") === "1") { try { await ensureTags(env, uuid); } catch {} }

          // Tags sub-endpoints — GET /rows/<t>/<id>/tags (list, public), POST {tag}
          // (add), DELETE /rows/<t>/<id>/tags/<tag> (remove). Add/remove follow the
          // row's write scope (feed/user own row, admin any; display/collect via owner).
          if (isTags) {
            if (!(rowId > 0)) return Response.json({ ok: false, error: "missing row id" }, { status: 400 });
            if (method === "GET") { if (!rateOk(slug + "|" + (request.headers.get("CF-Connecting-IP") || "0") + "|tgr", 300)) return tooMany(); return Response.json({ ok: true, tags: await tagsForRow(env, uuid, table, rowId) }); }
            // mutating: authorize by the same rules as editing this row
            if (access === "display" || access === "collect") return Response.json({ ok: false, error: "not allowed" }, { status: 403 });
            if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
            if (access === "feed" || access === "user") { const own = await cfD1Query(env, uuid, "SELECT 1 FROM " + tn + " WHERE id=? AND owner_id=?", [rowId, userId]); if (!own[0]) return Response.json({ ok: false, error: "not found" }, { status: 404 }); }
            else if (access === "admin") { if (!(await siteRoleAllows(env, uuid, userId, def))) return Response.json({ ok: false, error: "not allowed" }, { status: 403 }); }
            await ensureTags(env, uuid);
            if (method === "POST") {
              let b = {}; try { b = await request.json(); } catch {}
              const tag = cleanTag(b.tag || dm[5] || "");
              if (!tag) return Response.json({ ok: false, error: "tag required" }, { status: 400 });
              await cfD1Query(env, uuid, "INSERT OR IGNORE INTO _tags (row_table,row_id,tag,created_at) VALUES (?,?,?,?)", [table, rowId, tag, new Date().toISOString()]);
              return Response.json({ ok: true, tags: await tagsForRow(env, uuid, table, rowId) });
            }
            if (method === "DELETE") {
              const tag = cleanTag(dm[5] || "");
              if (!tag) return Response.json({ ok: false, error: "tag required" }, { status: 400 });
              await cfD1Query(env, uuid, "DELETE FROM _tags WHERE row_table=? AND row_id=? AND tag=?", [table, rowId, tag]);
              return Response.json({ ok: true, tags: await tagsForRow(env, uuid, table, rowId) });
            }
            return Response.json({ ok: false, error: "method not allowed" }, { status: 405 });
          }

          // Per-row sharing — the OWNER of a private (`user`-access) row grants specific
          // members view/edit access to just that row. GET /rows/<t>/<id>/share (list,
          // owner only) · POST {user:<id|email>, perm:'view'|'edit'} (grant) · DELETE
          // /rows/<t>/<id>/share/<userId> (revoke). Only makes sense for `user` tables.
          if (isShare) {
            if (access !== "user") return Response.json({ ok: false, error: "sharing is only for private (user) tables" }, { status: 400 });
            if (!(rowId > 0)) return Response.json({ ok: false, error: "missing row id" }, { status: 400 });
            if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
            // Only the row's OWNER may see or change its share list.
            const own = await cfD1Query(env, uuid, "SELECT 1 FROM " + tn + " WHERE id=? AND owner_id=?", [rowId, userId]);
            if (!own[0]) return Response.json({ ok: false, error: "not found" }, { status: 404 });
            await ensureShares(env, uuid);
            if (method === "GET") {
              const rows = await cfD1Query(env, uuid, "SELECT s.user_id, s.perm, u.email, u.display_name FROM _shares s LEFT JOIN _users u ON u.id=s.user_id WHERE s.row_table=? AND s.row_id=? ORDER BY s.created_at", [table, rowId]);
              return Response.json({ ok: true, shares: rows });
            }
            if (method === "POST") {
              let b = {}; try { b = await request.json(); } catch {}
              const perm = b.perm === "edit" ? "edit" : "view";
              let targetId = parseInt(b.user, 10) || 0;
              if (!targetId && typeof b.user === "string" && b.user.includes("@")) { const u2 = await cfD1Query(env, uuid, "SELECT id FROM _users WHERE email=?", [String(b.user).trim().toLowerCase()]); targetId = (u2[0] && u2[0].id) || 0; }
              if (!targetId) return Response.json({ ok: false, error: "no such member" }, { status: 404 });
              if (targetId === userId) return Response.json({ ok: false, error: "you already own this" }, { status: 400 });
              await cfD1Query(env, uuid, "INSERT INTO _shares (row_table,row_id,user_id,perm,created_at) VALUES (?,?,?,?,?) ON CONFLICT(row_table,row_id,user_id) DO UPDATE SET perm=excluded.perm", [table, rowId, targetId, perm, new Date().toISOString()]);
              return Response.json({ ok: true, shared: { user_id: targetId, perm } });
            }
            if (method === "DELETE") {
              const targetId = parseInt(dm[5], 10) || 0;
              if (!targetId) return Response.json({ ok: false, error: "member id required" }, { status: 400 });
              await cfD1Query(env, uuid, "DELETE FROM _shares WHERE row_table=? AND row_id=? AND user_id=?", [table, rowId, targetId]);
              return Response.json({ ok: true });
            }
            return Response.json({ ok: false, error: "method not allowed" }, { status: 405 });
          }

          // Restore a soft-deleted row — POST /rows/<t>/<id>/restore (trash tables only),
          // same write scope as delete (feed/user own-row, admin any).
          if (isRestore) {
            if (!trashOn) return Response.json({ ok: false, error: "restore not enabled" }, { status: 400 });
            if (method !== "POST") return Response.json({ ok: false, error: "use POST" }, { status: 405 });
            if (!(rowId > 0)) return Response.json({ ok: false, error: "missing row id" }, { status: 400 });
            if (access === "display" || access === "collect") return Response.json({ ok: false, error: "not allowed" }, { status: 403 });
            let tok2 = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
            if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
            let scope = "", params = [rowId];
            if (access === "feed" || access === "user") { scope = " AND owner_id=?"; params.push(userId); }
            else if (access === "admin") { if (!(await siteRoleAllows(env, uuid, userId, def))) return Response.json({ ok: false, error: "not allowed" }, { status: 403 }); }
            const ex = await cfD1Exec(env, uuid, "UPDATE " + tn + " SET deleted_at=NULL WHERE id=?" + scope, params);
            if (ex.changes === 0) return Response.json({ ok: false, error: "not found" }, { status: 404 });
            return Response.json({ ok: true, restored: rowId });
          }

          // Atomic column increment — POST /rows/<t>/<id>/incr {col, by=1, min?}. Adds
          // `by` to a NUMERIC column on one row, race-free (single UPDATE), returns the
          // new value. For stock/score/quantity on a specific row (view/like TALLIES not
          // tied to a row → use Counters). Same write scope as the table: feed/user edit
          // only their OWN row; admin edits any (admin role); display/collect can't.
          if (isIncr) {
            if (method !== "POST") return Response.json({ ok: false, error: "use POST" }, { status: 405 });
            if (!(rowId > 0)) return Response.json({ ok: false, error: "missing row id" }, { status: 400 });
            const numSet = new Set(Array.isArray(def.num) ? def.num : []);
            const body = await readBody();
            const col = String(body.col || "").toLowerCase();
            if (!col || !allow.map((a) => String(a).toLowerCase()).includes(col)) return badReq("unknown column");
            if (!numSet.has(col)) return badReq("column is not numeric");
            if (def.rules && def.rules[col] && def.rules[col].immutable) return badReq(col + " can't be changed");
            let by = Number(body.by); if (!Number.isFinite(by)) by = 1; by = Math.max(-1e9, Math.min(1e9, by));
            const hasFloor = body.min !== undefined && Number.isFinite(Number(body.min));
            const floor = hasFloor ? Number(body.min) : 0;
            const cq = sqlIdent(col);
            const expr = hasFloor ? "MAX(?, COALESCE(" + cq + ",0) + ?)" : "COALESCE(" + cq + ",0) + ?";
            let scope = "", params;
            if (access === "feed" || access === "user") { if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 }); scope = " AND owner_id=?"; }
            else if (access === "admin") { if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 }); if (!(await siteRoleAllows(env, uuid, userId, def))) return Response.json({ ok: false, error: "not allowed" }, { status: 403 }); }
            else return Response.json({ ok: false, error: "not allowed" }, { status: 403 }); // display/collect
            params = hasFloor ? [floor, by] : [by];
            const where = [rowId].concat(scope ? [userId] : []);
            const ex = await cfD1Exec(env, uuid, "UPDATE " + tn + " SET " + cq + "=" + expr + tsFrag + " WHERE id=?" + scope, params.concat(where));
            if (ex.changes === 0) return Response.json({ ok: false, error: "not found" }, { status: 404 });
            const r = await cfD1Query(env, uuid, "SELECT " + cq + " AS v FROM " + tn + " WHERE id=?", [rowId]);
            return Response.json({ ok: true, id: rowId, col, value: r[0] ? r[0].v : null });
          }

          // Merge duplicate records — POST /rows/<t>/<id>/merge {from:<otherId>, fillBlanks?}.
          // ADMIN-only. Folds the `from` row INTO this one: every child row that references
          // `from` (any table with a `ref` to this one) is repointed to this id, then `from`
          // is deleted. `fillBlanks:true` copies the loser's non-empty values into this row's
          // still-empty columns first (keep the fuller record). Dedupe accounts/contacts.
          if (isMerge) {
            if (method !== "POST") return Response.json({ ok: false, error: "use POST" }, { status: 405 });
            if (!(rowId > 0)) return Response.json({ ok: false, error: "missing row id" }, { status: 400 });
            if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
            const rr = await cfD1Query(env, uuid, "SELECT role FROM _users WHERE id=?", [userId]);
            if (!(rr[0] && rr[0].role === "admin")) return Response.json({ ok: false, error: "only an admin can merge records" }, { status: 403 });
            let b = {}; try { b = await request.json(); } catch {}
            const from = parseInt(b.from, 10) || 0;
            if (!(from > 0) || from === rowId) return Response.json({ ok: false, error: "pass a different 'from' record id to merge in" }, { status: 400 });
            const both = await cfD1Query(env, uuid, "SELECT id FROM " + tn + " WHERE id IN (?,?)", [rowId, from]);
            if (both.length < 2) return Response.json({ ok: false, error: "both records must exist" }, { status: 404 });
            if (b.fillBlanks) {
              try {
                const loser = (await cfD1Query(env, uuid, "SELECT * FROM " + tn + " WHERE id=?", [from]))[0] || {};
                const surv = (await cfD1Query(env, uuid, "SELECT * FROM " + tn + " WHERE id=?", [rowId]))[0] || {};
                const sets = [], vals = [];
                for (const col of allow) { if ((surv[col] == null || surv[col] === "") && loser[col] != null && loser[col] !== "") { sets.push(sqlIdent(col) + "=?"); vals.push(loser[col]); } }
                if (sets.length) await cfD1Exec(env, uuid, "UPDATE " + tn + " SET " + sets.join(",") + tsFrag + " WHERE id=?", vals.concat([rowId]));
              } catch {}
            }
            const repointed = {};
            for (const ch of childRefsOf(spec, table)) {
              try { const ex = await cfD1Exec(env, uuid, "UPDATE " + sqlIdent(ch.table) + " SET " + sqlIdent(ch.col) + "=? WHERE " + sqlIdent(ch.col) + "=?", [rowId, from]); repointed[ch.table] = (repointed[ch.table] || 0) + (ex.changes || 0); } catch {}
            }
            try { await cfD1Exec(env, uuid, "DELETE FROM " + tn + " WHERE id=?", [from]); } catch {}
            return Response.json({ ok: true, into: rowId, from, repointed });
          }
          // Approval workflow — POST /rows/<t>/<id>/submit|approve|reject, GET .../approvals.
          // The table must declare `approval:{approvers,status}`. `submit` (a writer of the row)
          // moves the status column to 'pending'; `approve`/`reject` (a member whose role is in
          // `approvers`, or admin) moves it to 'approved'/'rejected'. The status col is
          // platform-set ONLY — never in the app-writable set — so an owner can't self-approve
          // by PATCHing the row. Every decision is logged to _approvals (audit trail); the GET
          // returns that log + the current status. approve/reject fire on:{update} functions.
          if (isApprovalAct || isApprovalsLog) {
            if (!def.approval) return Response.json({ ok: false, error: "this table has no approval workflow (declare \"approval\":{\"approvers\":[…]})" }, { status: 400 });
            if (!(rowId > 0)) return Response.json({ ok: false, error: "missing row id" }, { status: 400 });
            if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
            const statusCol = def.approval.status;
            const hasOwner = access === "user" || access === "feed";
            const exist = await cfD1Query(env, uuid, "SELECT id" + (hasOwner ? ", owner_id" : "") + ", " + sqlIdent(statusCol) + " AS _status FROM " + tn + " WHERE id=?", [rowId]);
            if (!exist[0]) return Response.json({ ok: false, error: "not found" }, { status: 404 });
            if (isApprovalsLog) {
              if (method !== "GET") return Response.json({ ok: false, error: "read-only" }, { status: 405 });
              await ensureApprovals(env, uuid);
              const log = await cfD1Query(env, uuid, "SELECT id, action, actor_id, note, at FROM _approvals WHERE row_table=? AND row_id=? ORDER BY id DESC LIMIT 200", [table, rowId]);
              return Response.json({ ok: true, id: rowId, status: exist[0]._status || null, log });
            }
            if (method !== "POST") return Response.json({ ok: false, error: "use POST" }, { status: 405 });
            const rr = await cfD1Query(env, uuid, "SELECT role FROM _users WHERE id=?", [userId]);
            const myRole = (rr[0] && rr[0].role) || "user";
            const body = await readBody();
            if (dm[4] === "submit") {
              let maySubmit = myRole === "admin";
              if (!maySubmit) {
                if (access === "admin") maySubmit = await siteRoleAllows(env, uuid, userId, def);
                else if (access === "user" || access === "feed") maySubmit = exist[0].owner_id === userId;
              }
              if (!maySubmit) return Response.json({ ok: false, error: "not allowed to submit this record for approval" }, { status: 403 });
              await cfD1Exec(env, uuid, "UPDATE " + tn + " SET " + sqlIdent(statusCol) + "='pending'" + tsFrag + " WHERE id=?", [rowId]);
              await logApproval(env, uuid, table, rowId, "submit", userId, body.note);
              return Response.json({ ok: true, id: rowId, status: "pending" });
            }
            const isApprover = myRole === "admin" || def.approval.approvers.includes(String(myRole));
            if (!isApprover) return Response.json({ ok: false, error: "only an approver can approve or reject this record", code: "not_approver" }, { status: 403 });
            const decision = dm[4] === "approve" ? "approved" : "rejected";
            await cfD1Exec(env, uuid, "UPDATE " + tn + " SET " + sqlIdent(statusCol) + "=?" + tsFrag + " WHERE id=?", [decision, rowId]);
            await logApproval(env, uuid, table, rowId, dm[4], userId, body.note);
            fireUpdateTriggers(env, ctx, slug, table, { id: rowId, [statusCol]: decision, _approval: dm[4] });
            return Response.json({ ok: true, id: rowId, status: decision });
          }
          // Activity notes — POST /rows/<t>/<id>/notes {body, kind?} logs a note/call/email/
          // meeting/task against a record (a CRM activity log); GET lists them newest-first with
          // the author's public profile (optional ?kind= filter, ?limit=); DELETE
          // /rows/<t>/<id>/notes/<noteId> removes your own note (an admin removes any). A member
          // must be able to SEE the record (owner/team/admin on user tables; anyone on a
          // public-read table). Not available on write-only `collect` tables.
          if (isNotes) {
            if (access === "collect") return Response.json({ ok: false, error: "notes aren't available on a write-only table" }, { status: 400 });
            if (!(rowId > 0)) return Response.json({ ok: false, error: "missing row id" }, { status: 400 });
            if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
            const noteId = dm[5] && /^\d+$/.test(dm[5]) ? parseInt(dm[5], 10) : null;
            await ensureNotes(env, uuid);
            // A member must be able to SEE the record before reading, adding, or removing any of
            // its notes — so an outsider can't even discover that a note exists (always 404).
            if (!(await memberCanSeeRow(env, uuid, def, tn, rowId, userId, access))) return Response.json({ ok: false, error: "not found" }, { status: 404 });
            if (method === "GET") {
              const lim = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10) || 100));
              const kindF = String(url.searchParams.get("kind") || "").toLowerCase();
              const wh = ["row_table=?", "row_id=?"]; const pv = [table, rowId];
              if (NOTE_KINDS.has(kindF)) { wh.push("kind=?"); pv.push(kindF); }
              const notes = await cfD1Query(env, uuid, "SELECT id, author_id, kind, body, created_at FROM _notes WHERE " + wh.join(" AND ") + " ORDER BY id DESC LIMIT " + lim, pv);
              const ids = [...new Set(notes.map((n) => n.author_id).filter((v) => v != null))];
              let byId = new Map();
              if (ids.length) { try { const au = await cfD1Query(env, uuid, "SELECT id,display_name,avatar_url FROM _users WHERE id IN (" + ids.map(() => "?").join(",") + ")", ids); byId = new Map(au.map((a) => [a.id, a])); } catch {} }
              for (const n of notes) n.author = n.author_id != null ? (byId.get(n.author_id) || null) : null;
              return Response.json({ ok: true, id: rowId, notes });
            }
            if (method === "DELETE") {
              if (!(noteId > 0)) return Response.json({ ok: false, error: "DELETE needs a note id: /rows/<t>/<id>/notes/<noteId>" }, { status: 400 });
              const nn = await cfD1Query(env, uuid, "SELECT author_id FROM _notes WHERE id=? AND row_table=? AND row_id=?", [noteId, table, rowId]);
              if (!nn[0]) return Response.json({ ok: false, error: "not found" }, { status: 404 });
              let mayDel = nn[0].author_id === userId;
              if (!mayDel) { const rr = await cfD1Query(env, uuid, "SELECT role FROM _users WHERE id=?", [userId]); mayDel = !!(rr[0] && rr[0].role === "admin"); }
              if (!mayDel) return Response.json({ ok: false, error: "you can only remove your own note" }, { status: 403 });
              const ex = await cfD1Exec(env, uuid, "DELETE FROM _notes WHERE id=?", [noteId]);
              return Response.json({ ok: true, deleted: ex.changes || 0 });
            }
            if (method !== "POST") return Response.json({ ok: false, error: "use POST/GET/DELETE" }, { status: 405 });
            const body = await readBody();
            const kind = NOTE_KINDS.has(String(body.kind || "").toLowerCase()) ? String(body.kind).toLowerCase() : "note";
            const text = String(body.body != null ? body.body : (body.text != null ? body.text : "")).slice(0, 5000);
            if (!text.trim()) return Response.json({ ok: false, error: "note body required" }, { status: 400 });
            const at = new Date().toISOString();
            const ins = await cfD1Query(env, uuid, "INSERT INTO _notes (row_table,row_id,author_id,kind,body,created_at) VALUES (?,?,?,?,?,?) RETURNING id", [table, rowId, userId, kind, text, at]);
            return Response.json({ ok: true, note: { id: ins[0] && ins[0].id, row_id: rowId, kind, body: text, author_id: userId, created_at: at } });
          }
          // File attachments — POST /rows/<t>/<id>/attach {filename, content_type?, data:<base64>}
          // stores a file against a record (bytes in R2, metadata in _attachments); GET lists the
          // record's attachments (metadata + fetch url); DELETE /rows/<t>/<id>/attach/<attId>
          // removes your own (admin any). Bytes are fetched back through /api/db/<slug>/attach/<id>
          // so access follows the record's visibility. A member must be able to SEE the record.
          if (isAttach) {
            if (access === "collect") return Response.json({ ok: false, error: "no attachments on a write-only table" }, { status: 400 });
            if (!(rowId > 0)) return Response.json({ ok: false, error: "missing row id" }, { status: 400 });
            if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
            const attId = dm[5] && /^\d+$/.test(dm[5]) ? parseInt(dm[5], 10) : null;
            await ensureAttachments(env, uuid);
            if (!(await memberCanSeeRow(env, uuid, def, tn, rowId, userId, access))) return Response.json({ ok: false, error: "not found" }, { status: 404 });
            if (method === "GET") {
              const list = await cfD1Query(env, uuid, "SELECT id, filename, content_type, size, uploaded_by, created_at FROM _attachments WHERE row_table=? AND row_id=? ORDER BY id DESC LIMIT 200", [table, rowId]);
              for (const a of list) a.url = "/api/db/" + slug + "/attach/" + a.id;
              return Response.json({ ok: true, id: rowId, attachments: list });
            }
            if (method === "DELETE") {
              if (!(attId > 0)) return Response.json({ ok: false, error: "DELETE needs an attachment id: /rows/<t>/<id>/attach/<attId>" }, { status: 400 });
              const arow = await cfD1Query(env, uuid, "SELECT uploaded_by, r2_key FROM _attachments WHERE id=? AND row_table=? AND row_id=?", [attId, table, rowId]);
              if (!arow[0]) return Response.json({ ok: false, error: "not found" }, { status: 404 });
              let mayDel = arow[0].uploaded_by === userId;
              if (!mayDel) { const rr = await cfD1Query(env, uuid, "SELECT role FROM _users WHERE id=?", [userId]); mayDel = !!(rr[0] && rr[0].role === "admin"); }
              if (!mayDel) return Response.json({ ok: false, error: "you can only remove your own attachment" }, { status: 403 });
              try { await env.SITES_BUCKET.delete(arow[0].r2_key); } catch {}
              const ex = await cfD1Exec(env, uuid, "DELETE FROM _attachments WHERE id=?", [attId]);
              return Response.json({ ok: true, deleted: ex.changes || 0 });
            }
            if (method !== "POST") return Response.json({ ok: false, error: "use POST/GET/DELETE" }, { status: 405 });
            const cnt = await cfD1Query(env, uuid, "SELECT COUNT(*) AS n FROM _attachments WHERE row_table=? AND row_id=?", [table, rowId]);
            if (((cnt[0] && cnt[0].n) || 0) >= 50) return badReq("attachment limit reached for this record (50)");
            const abody = await readBody();
            const filename = String(abody.filename || abody.name || "file").slice(0, 200).replace(/[\r\n]/g, "");
            let data = String(abody.data || abody.base64 || abody.content || "");
            if (data.startsWith("data:")) { const comma = data.indexOf(","); if (comma > 0) data = data.slice(comma + 1); }
            data = data.replace(/\s/g, "");
            if (!data) return badReq("data (base64) required");
            if (data.length > 14000000) return badReq("file too large (max ~10 MB)");
            let size;
            try { size = atob(data).length; } catch { return badReq("invalid base64 data"); }
            const ct = String(abody.content_type || abody.type || "application/octet-stream").slice(0, 120).replace(/[\r\n]/g, "");
            const key = "attach/" + slug + "/" + table + "/" + rowId + "/" + crypto.randomUUID();
            try { await env.SITES_BUCKET.put(key, data); } catch { return Response.json({ ok: false, error: "storage failed" }, { status: 502 }); }
            const at = new Date().toISOString();
            const ins = await cfD1Query(env, uuid, "INSERT INTO _attachments (row_table,row_id,filename,content_type,size,r2_key,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?,?) RETURNING id", [table, rowId, filename, ct, size, key, userId, at]);
            const id = ins[0] && ins[0].id;
            return Response.json({ ok: true, attachment: { id, row_id: rowId, filename, content_type: ct, size, uploaded_by: userId, created_at: at, url: "/api/db/" + slug + "/attach/" + id } });
          }
          // Unified activity TIMELINE — GET /rows/<t>/<id>/timeline merges a record's notes
          // (_notes), approval decisions (_approvals), and field-change audit events (_audit,
          // when the table declares `audit:true`) into ONE reverse-chronological feed, each entry
          // tagged with its `type` and the actor's public profile. The single source for a CRM
          // record's history panel. Same visibility gate as notes (memberCanSeeRow). Optional
          // `?types=note,approval,audit` narrows the sources; `?limit=` caps (default 100).
          if (isTimeline) {
            if (method !== "GET") return Response.json({ ok: false, error: "read-only" }, { status: 405 });
            if (access === "collect") return Response.json({ ok: false, error: "no timeline on a write-only table" }, { status: 400 });
            if (!(rowId > 0)) return Response.json({ ok: false, error: "missing row id" }, { status: 400 });
            if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
            if (!(await memberCanSeeRow(env, uuid, def, tn, rowId, userId, access))) return Response.json({ ok: false, error: "not found" }, { status: 404 });
            const lim = Math.min(300, Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10) || 100));
            const wantTypes = String(url.searchParams.get("types") || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
            const wants = (ty) => !wantTypes.length || wantTypes.includes(ty);
            const events = [];
            if (wants("note")) {
              try { const ns = await cfD1Query(env, uuid, "SELECT id, author_id, kind, body, created_at FROM _notes WHERE row_table=? AND row_id=? ORDER BY id DESC LIMIT " + lim, [table, rowId]);
                for (const n of ns) events.push({ type: "note", id: n.id, at: n.created_at, actor_id: n.author_id, kind: n.kind, body: n.body }); } catch {}
            }
            if (wants("approval")) {
              try { const ap = await cfD1Query(env, uuid, "SELECT id, action, actor_id, note, at FROM _approvals WHERE row_table=? AND row_id=? ORDER BY id DESC LIMIT " + lim, [table, rowId]);
                for (const a of ap) events.push({ type: "approval", id: a.id, at: a.at, actor_id: a.actor_id, action: a.action, note: a.note }); } catch {}
            }
            if (wants("audit") && def.audit) {
              try { const au = await cfD1Query(env, uuid, "SELECT id, action, actor_id, at FROM _audit WHERE row_table=? AND row_id=? ORDER BY id DESC LIMIT " + lim, [table, rowId]);
                for (const a of au) events.push({ type: "audit", id: a.id, at: a.at, actor_id: a.actor_id, action: a.action }); } catch {}
            }
            // Sources timestamp differently — _notes/_approvals store ISO (…T…Z) while the
            // _audit trigger stores SQLite `datetime('now')` (YYYY-MM-DD HH:MM:SS, UTC). Parse
            // both to epoch ms for a correct cross-source sort, and normalize each `at` to ISO
            // so the client sees one format.
            const tsMs = (s) => { if (!s) return 0; let v = String(s); if (v.indexOf(" ") !== -1 && v.indexOf("T") === -1) v = v.replace(" ", "T") + "Z"; const n = Date.parse(v); return Number.isFinite(n) ? n : 0; };
            for (const e of events) { const ms = tsMs(e.at); e._ms = ms; if (ms) { try { e.at = new Date(ms).toISOString(); } catch {} } }
            events.sort((a, b) => (b._ms - a._ms) || (b.type > a.type ? 1 : b.type < a.type ? -1 : 0));
            const feed = events.slice(0, lim);
            for (const e of feed) delete e._ms;
            const ids = [...new Set(feed.map((e) => e.actor_id).filter((v) => v != null))];
            let byId = new Map();
            if (ids.length) { try { const us = await cfD1Query(env, uuid, "SELECT id,display_name,avatar_url FROM _users WHERE id IN (" + ids.map(() => "?").join(",") + ")", ids); byId = new Map(us.map((u) => [u.id, u])); } catch {} }
            for (const e of feed) e.actor = e.actor_id != null ? (byId.get(e.actor_id) || null) : null;
            return Response.json({ ok: true, id: rowId, events: feed });
          }
          // Reassign a record's owner — POST /rows/<t>/<id>/assign {user:<id|email>}. On a
          // table WITH an owner (user/feed), an ADMIN — or the current owner's MANAGER on a
          // `teamRead` table — hands the row to another member (CRM lead routing / case
          // reassignment). The assignee must be a real member. Fires on:{update} functions.
          if (isAssign) {
            if (method !== "POST") return Response.json({ ok: false, error: "use POST" }, { status: 405 });
            if (!(rowId > 0)) return Response.json({ ok: false, error: "missing row id" }, { status: 400 });
            if (!(access === "user" || access === "feed")) return Response.json({ ok: false, error: "assignment only applies to user/feed tables (they have an owner)" }, { status: 400 });
            if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
            const rr = await cfD1Query(env, uuid, "SELECT role FROM _users WHERE id=?", [userId]);
            let mayAssign = !!(rr[0] && rr[0].role === "admin");
            if (!mayAssign && def.teamRead) { const own = await cfD1Query(env, uuid, "SELECT owner_id FROM " + tn + " WHERE id=?", [rowId]); const oid = own[0] && own[0].owner_id; if (oid) { const dl = await cfD1Query(env, uuid, "WITH RECURSIVE dl(id) AS (SELECT ? UNION SELECT u.id FROM _users u JOIN dl ON u.manager_id = dl.id) SELECT 1 FROM dl WHERE id=? LIMIT 1", [userId, oid]); if (dl[0]) mayAssign = true; } }
            if (!mayAssign) return Response.json({ ok: false, error: "only an admin or the current owner's manager can reassign this record" }, { status: 403 });
            let b = {}; try { b = await request.json(); } catch {}
            const who = b.user != null ? b.user : (b.owner_id != null ? b.owner_id : b.assignee);
            let assignee = null;
            if (typeof who === "number" || /^\d+$/.test(String(who || ""))) { const r = await cfD1Query(env, uuid, "SELECT id FROM _users WHERE id=?", [parseInt(who, 10)]); if (r[0]) assignee = r[0].id; }
            else if (typeof who === "string" && who.includes("@")) { const r = await cfD1Query(env, uuid, "SELECT id FROM _users WHERE email=?", [who.trim().toLowerCase()]); if (r[0]) assignee = r[0].id; }
            if (!assignee) return Response.json({ ok: false, error: "assignee not found — pass a member id or email", code: "no_user" }, { status: 400 });
            const ex = await cfD1Exec(env, uuid, "UPDATE " + tn + " SET owner_id=?" + tsFrag + " WHERE id=?", [assignee, rowId]);
            if (!ex.changes) return Response.json({ ok: false, error: "not found" }, { status: 404 });
            fireUpdateTriggers(env, ctx, slug, table, { id: rowId, owner_id: assignee, _assigned: true });
            return Response.json({ ok: true, id: rowId, owner_id: assignee });
          }
          // Reorder — POST /rows/<t>/<id>/move {after|before:<refId>} | {to:<n>}. On an
          // `ordered:true` table, sets this row's `position` to the MIDPOINT between the
          // named neighbour and the next row on that side (REAL positions → no renumber),
          // so a drag-and-drop list persists its order in one call. Same write scope as the
          // table (feed/user → your own rows; admin → any; display/collect can't).
          if (isMove) {
            if (method !== "POST") return Response.json({ ok: false, error: "use POST" }, { status: 405 });
            if (!(rowId > 0)) return Response.json({ ok: false, error: "missing row id" }, { status: 400 });
            if (!def.ordered) return badReq("this table isn't ordered (declare \"ordered\":true)");
            let scope = "", scopeParams = [];
            if (access === "feed" || access === "user") { if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 }); scope = " AND owner_id=?"; scopeParams = [userId]; }
            else if (access === "admin") { if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 }); if (!(await siteRoleAllows(env, uuid, userId, def))) return Response.json({ ok: false, error: "not allowed" }, { status: 403 }); }
            else return Response.json({ ok: false, error: "not allowed" }, { status: 403 }); // display/collect
            // the moving row must exist within scope
            const self = await cfD1Query(env, uuid, "SELECT position FROM " + tn + " WHERE id=?" + scope, [rowId].concat(scopeParams));
            if (!self[0]) return Response.json({ ok: false, error: "not found" }, { status: 404 });
            const body = await readBody();
            let newPos = null;
            if (body.to !== undefined && Number.isFinite(Number(body.to))) {
              newPos = Number(body.to);
            } else {
              const refId = parseInt(body.after !== undefined ? body.after : body.before, 10);
              const isAfter = body.after !== undefined;
              if (!(refId > 0)) return badReq("move needs {after|before:<id>} or {to:<number>}");
              const ref = await cfD1Query(env, uuid, "SELECT position FROM " + tn + " WHERE id=?" + scope, [refId].concat(scopeParams));
              if (!ref[0]) return Response.json({ ok: false, error: "reference row not found" }, { status: 404 });
              const rp = Number(ref[0].position) || 0;
              // the neighbour just beyond the reference on the requested side (within scope)
              const nb = isAfter
                ? await cfD1Query(env, uuid, "SELECT MIN(position) AS p FROM " + tn + " WHERE position > ?" + scope, [rp].concat(scopeParams))
                : await cfD1Query(env, uuid, "SELECT MAX(position) AS p FROM " + tn + " WHERE position < ?" + scope, [rp].concat(scopeParams));
              const np = nb[0] && nb[0].p != null ? Number(nb[0].p) : null;
              newPos = np != null ? (rp + np) / 2 : (isAfter ? rp + 1 : rp - 1);
            }
            await cfD1Exec(env, uuid, "UPDATE " + tn + ' SET "position"=?' + tsFrag + " WHERE id=?" + scope, [newPos, rowId].concat(scopeParams));
            return Response.json({ ok: true, id: rowId, position: newPos });
          }

          // Archive / unarchive — POST /rows/<t>/<id>/archive|/unarchive on an `archivable`
          // table sets/clears archived_at (Gmail-style "archive"/"move to active"). Same write
          // scope as the table (feed/user own rows, admin any, display/collect none).
          if (isArchive) {
            if (method !== "POST") return Response.json({ ok: false, error: "use POST" }, { status: 405 });
            if (!(rowId > 0)) return Response.json({ ok: false, error: "missing row id" }, { status: 400 });
            if (!def.archivable) return badReq("this table isn't archivable (declare \"archivable\":true)");
            let scope = "", sp = [];
            if (access === "feed" || access === "user") { if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 }); scope = " AND owner_id=?"; sp = [userId]; }
            else if (access === "admin") { if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 }); if (!(await siteRoleAllows(env, uuid, userId, def))) return Response.json({ ok: false, error: "not allowed" }, { status: 403 }); }
            else return Response.json({ ok: false, error: "not allowed" }, { status: 403 });
            const val = dm[4] === "archive" ? new Date().toISOString() : null;
            const ex = await cfD1Exec(env, uuid, "UPDATE " + tn + " SET archived_at=?" + tsFrag + " WHERE id=?" + scope, [val, rowId].concat(sp));
            if (ex.changes === 0) return Response.json({ ok: false, error: "not found" }, { status: 404 });
            return Response.json({ ok: true, id: rowId, archived: !!val });
          }
          // Row history / revert (owner or admin) — the change timeline of a `history:true`
          // row and restore of any prior version. GET /rows/<t>/<id>/history lists snapshots
          // (newest first); POST /rows/<t>/<id>/revert/<historyId> restores that snapshot's
          // data columns (itself recorded, so a revert is undoable).
          if (isHistory || isRevert) {
            if (!(rowId > 0)) return Response.json({ ok: false, error: "missing row id" }, { status: 400 });
            if (!def.history) return badReq("this table has no history (declare \"history\":true)");
            let hscope = "", hsp = [];
            if (access === "feed" || access === "user") { if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 }); hscope = " AND owner_id=?"; hsp = [userId]; }
            else if (access === "admin") { if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 }); if (!(await siteRoleAllows(env, uuid, userId, def))) return Response.json({ ok: false, error: "not allowed" }, { status: 403 }); }
            else return Response.json({ ok: false, error: "not allowed" }, { status: 403 }); // display/collect
            const own = await cfD1Query(env, uuid, "SELECT 1 FROM " + tn + " WHERE id=?" + hscope, [rowId].concat(hsp));
            if (!own[0]) return Response.json({ ok: false, error: "not found" }, { status: 404 });
            try { await cfD1Query(env, uuid, "CREATE TABLE IF NOT EXISTS _history (id INTEGER PRIMARY KEY AUTOINCREMENT, row_table TEXT, row_id INTEGER, snapshot TEXT, at TEXT)"); } catch {}
            if (isHistory) {
              if (method !== "GET") return Response.json({ ok: false, error: "read-only" }, { status: 405 });
              const lim = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));
              const rows = await cfD1Query(env, uuid, "SELECT id, snapshot, at FROM _history WHERE row_table=? AND row_id=? ORDER BY id DESC LIMIT ?", [table, rowId, lim]);
              for (const r of rows) { try { r.snapshot = JSON.parse(r.snapshot); } catch {} }
              return Response.json({ ok: true, history: rows });
            }
            // revert
            if (method !== "POST") return Response.json({ ok: false, error: "use POST" }, { status: 405 });
            const histId = parseInt(dm[5], 10) || 0;
            if (!histId) return Response.json({ ok: false, error: "history id required (…/revert/<id>)" }, { status: 400 });
            const hrow = await cfD1Query(env, uuid, "SELECT snapshot FROM _history WHERE id=? AND row_table=? AND row_id=?", [histId, table, rowId]);
            if (!hrow[0]) return Response.json({ ok: false, error: "snapshot not found" }, { status: 404 });
            let snap = null; try { snap = JSON.parse(hrow[0].snapshot); } catch {}
            if (!snap || typeof snap !== "object") return Response.json({ ok: false, error: "snapshot unreadable" }, { status: 502 });
            const cols = allow.filter((c) => Object.prototype.hasOwnProperty.call(snap, c));
            if (!cols.length) return badReq("nothing to revert");
            await cfD1Exec(env, uuid, "UPDATE " + tn + " SET " + cols.map((c) => sqlIdent(c) + "=?").join(",") + tsFrag + " WHERE id=?" + hscope, cols.map((c) => snap[c]).concat([rowId], hsp));
            return Response.json({ ok: true, reverted: rowId, from: histId });
          }

          // Threaded / nested read — GET /rows/<t>/tree for a SELF-REFERENTIAL table (a column
          // whose `ref` points back at its own table, e.g. comments.parent_id → comments).
          // Returns the rows nested: each carries a `replies` array of its children (recursive).
          // `?root=<id>` returns just that node's subtree. Honors ?authors=1/?reactions=1/?tags=1
          // on the flat rows first. Same read visibility as the table (user scoped to own rows).
          if (isTree) {
            if (method !== "GET") return Response.json({ ok: false, error: "read-only" }, { status: 405 });
            if (access === "collect") return Response.json({ ok: false, error: "no read" }, { status: 403 });
            const refs = def.refs || {};
            const selfCol = Object.keys(refs).find((c) => String(refs[c]).toLowerCase() === table.toLowerCase());
            if (!selfCol) return badReq("this table isn't self-referential (declare a column with ref back to itself, e.g. parent_id → " + table + ")");
            let scopeSql = "", sp = [];
            if (access === "user") { if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 }); scopeSql = " AND owner_id=?"; sp = [userId]; }
            const rows = await cfD1Query(env, uuid, "SELECT * FROM " + tn + " WHERE 1=1" + (visClause ? " AND " + visClause : "") + scopeSql + " ORDER BY id ASC LIMIT 2000", sp);
            parseJsonRows(def, rows); attachComputed(def, rows); attachFormulas(def, rows); attachCurrency(def, rows); attachSla(def, rows);
            await attachAuthors(env, uuid, rows, url); await attachReactions(env, uuid, table, rows, url, userId); await attachTags(env, uuid, table, rows, url);
            const byId = new Map(); for (const r of rows) { r.replies = []; byId.set(r.id, r); }
            const roots = [];
            for (const r of rows) { const pid = r[selfCol]; if (pid != null && byId.has(pid) && pid !== r.id) byId.get(pid).replies.push(r); else roots.push(r); }
            const rootId = parseInt(url.searchParams.get("root") || "", 10);
            const tree = (rootId > 0 && byId.has(rootId)) ? [byId.get(rootId)] : roots;
            return Response.json({ ok: true, tree, total: rows.length });
          }
          // Nearby / geo search — GET /rows/<t>/near?lat=&lng=&radius=<km>[&limit=]. A cheap
          // bounding-box prefilter in SQL (no trig needed) narrows candidates, then exact
          // haversine distance in JS filters + sorts. Each row comes back with `_distance_km`.
          // Table declares its coordinate columns as `"geo":{"lat":"latitude","lng":"longitude"}`
          // (or auto-detects lat/lng). Same read visibility as the table.
          if (isNear) {
            if (method !== "GET") return Response.json({ ok: false, error: "read-only" }, { status: 405 });
            if (access === "collect") return Response.json({ ok: false, error: "no read" }, { status: 403 });
            const allowLC = allow.map((a) => String(a).toLowerCase());
            let latCol = def.geo && def.geo.lat, lngCol = def.geo && def.geo.lng;
            if (!latCol) latCol = ["lat", "latitude"].find((x) => allowLC.includes(x));
            if (!lngCol) lngCol = ["lng", "lon", "long", "longitude"].find((x) => allowLC.includes(x));
            if (!latCol || !lngCol || !allowLC.includes(latCol) || !allowLC.includes(lngCol)) return badReq("this table has no lat/lng columns (declare \"geo\":{lat,lng})");
            const latRaw = url.searchParams.get("lat"), lngRaw = url.searchParams.get("lng");
            const lat = (latRaw == null || latRaw === "") ? NaN : Number(latRaw);
            const lng = (lngRaw == null || lngRaw === "") ? NaN : Number(lngRaw);
            let radius = Number(url.searchParams.get("radius") || url.searchParams.get("km"));
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return badReq("lat and lng required");
            if (!Number.isFinite(radius) || radius <= 0) radius = 10;
            radius = Math.min(radius, 20000);
            const lim = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));
            const dLat = radius / 111.32;
            const dLng = radius / (111.32 * Math.max(0.01, Math.cos(lat * Math.PI / 180)));
            let scopeSql = "", scopeParams = [];
            if (access === "user") { if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 }); scopeSql = " AND owner_id=?"; scopeParams = [userId]; }
            const latq = sqlIdent(latCol), lngq = sqlIdent(lngCol);
            const box = latq + " BETWEEN ? AND ? AND " + lngq + " BETWEEN ? AND ?";
            const rows = await cfD1Query(env, uuid, "SELECT * FROM " + tn + " WHERE " + box + (visClause ? " AND " + visClause : "") + scopeSql + " LIMIT 2000", [lat - dLat, lat + dLat, lng - dLng, lng + dLng].concat(scopeParams));
            const R = 6371; // km
            const hav = (la1, lo1, la2, lo2) => { const p = Math.PI / 180; const a = 0.5 - Math.cos((la2 - la1) * p) / 2 + Math.cos(la1 * p) * Math.cos(la2 * p) * (1 - Math.cos((lo2 - lo1) * p)) / 2; return 2 * R * Math.asin(Math.sqrt(a)); };
            const out = [];
            for (const r of rows) { const rl = Number(r[latCol]), rg = Number(r[lngCol]); if (!Number.isFinite(rl) || !Number.isFinite(rg)) continue; const d = hav(lat, lng, rl, rg); if (d <= radius) { r._distance_km = Math.round(d * 100) / 100; out.push(r); } }
            out.sort((a, b) => a._distance_km - b._distance_km);
            const page = out.slice(0, lim);
            await doExpand(page);
            return Response.json({ ok: true, rows: page, total: out.length });
          }
          // Aggregate/stats read — count/sum/avg/min/max (+ optional group-by), for
          // dashboards and analytics. Follows the same read visibility as the table:
          // display/feed aggregate publicly over ALL rows; `user` aggregates only the
          // caller's own rows (login required); `collect` (write-only) exposes nothing.
          if (isStats) {
            if (method !== "GET") return Response.json({ ok: false, error: "read-only" }, { status: 405 });
            if (access === "collect") return Response.json({ ok: false, error: "no stats" }, { status: 403 });
            let base = null;
            if (access === "user") { if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 }); base = userReadBase(); }
            base = withTagFilter(withVisible(base)); // stats respect trash + ?tag= filter
            const b = buildD1Stats(url, tn, allow, base, def, spec);
            const r = await cfD1Query(env, uuid, b.sql, b.params);
            if (b.groupCols && b.groupCols.length) {
              const groups = r.map((row) => {
                const g = {};
                b.groupCols.forEach((c, i) => { g[c] = row["_g" + i]; });
                if (b.groupCols.length === 1) g.value = row["_g0"]; // backward-compatible single-dim shape (`value` + aggs)
                return Object.assign(g, shapeD1Stats(row, b.wanted));
              });
              return Response.json(b.groupCols.length === 1 ? { ok: true, group: b.groupCols[0], groups } : { ok: true, groupBy: b.groupCols, groups });
            }
            return Response.json(Object.assign({ ok: true }, shapeD1Stats(r[0] || {}, b.wanted)));
          }

          // Faceted counts — for each requested column, the distinct values and how many
          // rows have each (`{color:[{value,count}],size:[…]}`), so an app renders filter
          // sidebars like "Red (12) · Blue (4)". Respects the SAME where/q/tag/trash
          // filters as a list read, so counts reflect the currently-applied filters (drill
          // down). Same read visibility as the table (collect exposes nothing; user counts
          // only its own rows). Each facet is a GROUP BY over a declared column, top 100 by
          // count. NULL/empty values are dropped.
          if (isFacets) {
            if (method !== "GET") return Response.json({ ok: false, error: "read-only" }, { status: 405 });
            if (access === "collect") return Response.json({ ok: false, error: "no facets" }, { status: 403 });
            let base = null;
            if (access === "user") { if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 }); base = userReadBase(); }
            base = withTagFilter(withVisible(base));
            const allowSet = new Set(allow.map((c) => String(c).toLowerCase()));
            const fields = (url.searchParams.get("fields") || "").toLowerCase().split(",").map((s) => s.trim()).filter((c) => allowSet.has(c)).slice(0, 8);
            if (!fields.length) return Response.json({ ok: false, error: "fields required" }, { status: 400 });
            const f = buildD1Filter(url, allow, base);
            const facets = {};
            for (const col of fields) {
              const cid = sqlIdent(col);
              const sql = "SELECT " + cid + " AS value, COUNT(*) AS n FROM " + tn + f.whereSql + (f.whereSql ? " AND " : " WHERE ") + cid + " IS NOT NULL AND " + cid + " != '' GROUP BY " + cid + " ORDER BY n DESC, value ASC LIMIT 100";
              try { const rows = await cfD1Query(env, uuid, sql, f.params.slice()); facets[col] = rows.map((r) => ({ value: r.value, count: Number(r.n) || 0 })); }
              catch { facets[col] = []; }
            }
            return Response.json({ ok: true, facets });
          }

          // Duplicate check — GET /rows/<t>/duplicates?email=a@b.com[&phone=…] returns existing
          // rows that match ANY of the supplied declared columns (case-insensitive, trimmed) — the
          // "does this contact/lead already exist?" lookup before a create. `?exclude=<id>` skips a
          // row (checking during an EDIT). Same read visibility as the table (user → own/team via
          // userReadBase; public-read tables → all; collect exposes nothing), trash-aware, and
          // field-level security is applied. Composes with /merge (dedupe) and uniqueCI (hard block).
          if (isDupes) {
            if (method !== "GET") return Response.json({ ok: false, error: "read-only" }, { status: 405 });
            if (access === "collect") return Response.json({ ok: false, error: "no lookups on a write-only table" }, { status: 403 });
            let base = null;
            if (access === "user") { if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 }); base = userReadBase(); }
            base = withVisible(base); // trash-aware
            const allowSet = new Set(allow.map((c) => String(c).toLowerCase()));
            const ctrl = new Set(["limit", "exclude", "fields"]);
            const matchClauses = [], matchParams = [], usedCols = [];
            for (const [k, v] of url.searchParams.entries()) {
              const col = k.toLowerCase();
              if (ctrl.has(col) || !allowSet.has(col) || usedCols.includes(col)) continue;
              if (v == null || String(v).trim() === "") continue;
              matchClauses.push("LOWER(TRIM(" + sqlIdent(col) + ")) = LOWER(TRIM(?))");
              matchParams.push(String(v));
              usedCols.push(col);
            }
            if (!matchClauses.length) return Response.json({ ok: false, error: "pass at least one declared column to check, e.g. ?email=a@b.com" }, { status: 400 });
            const parts = [], allParams = [];
            if (base && base.clause) { parts.push(base.clause); allParams.push(...base.params); }
            parts.push("(" + matchClauses.join(" OR ") + ")");
            allParams.push(...matchParams);
            const excl = parseInt(url.searchParams.get("exclude") || "", 10);
            if (excl > 0) { parts.push("id != ?"); allParams.push(excl); }
            const lim = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
            const rows = await cfD1Query(env, uuid, "SELECT * FROM " + tn + " WHERE " + parts.join(" AND ") + " ORDER BY id DESC LIMIT " + lim, allParams);
            await doExpand(rows);
            return Response.json({ ok: true, matches: rows, count: rows.length, on: usedCols });
          }

          // SLA overdue queue — GET /rows/<t>/overdue lists rows whose SLA deadline has passed and
          // that aren't in a `done` state, most-overdue first, each with its `_sla`. Requires the
          // table to declare `sla:{start,mins,done?}`. The deadline is computed IN SQL
          // (`datetime(start,'+<mins> minutes') < datetime('now')`) so it filters + paginates
          // server-side. Same read visibility as the table (user → own/team; public-read → all;
          // collect → none) and honors ?where=/trash. This is the queue an escalation acts on.
          if (isOverdue) {
            if (!def.sla) return badReq("this table has no SLA (declare \"sla\":{\"mins\":…})");
            const startId0 = sqlIdent(def.sla.start);
            // Overdue-set WHERE parts (deadline passed + not in a done state), shared by the queue
            // (owner-scoped, with ?where) and the escalation sweep (org-wide, admin-gated).
            const overdueParts = (baseClause) => {
              const p = [], pv = [];
              if (baseClause && baseClause.clause) { p.push(baseClause.clause); pv.push(...baseClause.params); }
              p.push("datetime(" + startId0 + ", '+" + def.sla.mins + " minutes') < datetime('now')");
              if (def.sla.doneField) { const dv = def.sla.doneValues.map((v) => String(v).toLowerCase()); p.push("LOWER(COALESCE(" + sqlIdent(def.sla.doneField) + ",'')) NOT IN (" + dv.map(() => "?").join(",") + ")"); pv.push(...dv); }
              return { p, pv };
            };
            // POST /rows/<t>/overdue/escalate — apply the declared `sla.escalate` action (reassign
            // owner and/or set a field) to the overdue rows NOT YET escalated (idempotent). Admin /
            // writeRole only; acts org-wide (not owner-scoped). Wire an external scheduler or a
            // scheduled function to this endpoint to fire escalation on a timer.
            if (dm[4] === "escalate") {
              if (method !== "POST") return Response.json({ ok: false, error: "use POST" }, { status: 405 });
              if (access === "collect" || access === "display") return Response.json({ ok: false, error: "escalation needs a writable table" }, { status: 400 });
              if (!def.sla.escalate) return badReq("no escalation configured (add \"sla\":{…,\"escalate\":{…}})");
              if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
              if (!(await siteRoleAllows(env, uuid, userId, def))) return Response.json({ ok: false, error: "only an admin can run escalation" }, { status: 403 });
              const esc = def.sla.escalate;
              let toId = null;
              if (esc.to) { toId = await resolveMemberId(env, uuid, esc.to); if (!toId) return badReq("escalate target member not found: " + esc.to); }
              const setCols = [], setParams = [], already = [], alreadyParams = [];
              if (toId) { setCols.push("owner_id=?"); setParams.push(toId); already.push("(owner_id IS NOT NULL AND owner_id=?)"); alreadyParams.push(toId); }
              if (esc.field) { setCols.push(sqlIdent(esc.field) + "=?"); setParams.push(esc.value); already.push("(LOWER(COALESCE(" + sqlIdent(esc.field) + ",''))=LOWER(?))"); alreadyParams.push(esc.value); }
              if (!setCols.length) return badReq("escalation has no effect (set a target or a field)");
              const { p, pv } = overdueParts(withVisible(null)); // org-wide, trash-aware
              const notAlready = "NOT (" + already.join(" AND ") + ")";
              const idSub = "id IN (SELECT id FROM " + tn + " WHERE " + p.concat(notAlready).join(" AND ") + " LIMIT 2000)";
              const ex = await cfD1Exec(env, uuid, "UPDATE " + tn + " SET " + setCols.join(",") + tsFrag + " WHERE " + idSub, setParams.concat(pv, alreadyParams));
              return Response.json({ ok: true, escalated: ex.changes || 0, to: toId || undefined, set: esc.field ? { [esc.field]: esc.value } : undefined });
            }
            if (method !== "GET") return Response.json({ ok: false, error: "read-only" }, { status: 405 });
            if (access === "collect") return Response.json({ ok: false, error: "no overdue queue on a write-only table" }, { status: 403 });
            let base = null;
            if (access === "user") { if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 }); base = userReadBase(); }
            const f = buildD1Filter(url, allow, withVisible(base)); // owner + trash + optional ?where=
            const startId = sqlIdent(def.sla.start);
            const parts = [f.whereSql ? f.whereSql.replace(/^ WHERE /, "") : null].filter(Boolean);
            const params = f.params.slice();
            parts.push("datetime(" + startId + ", '+" + def.sla.mins + " minutes') < datetime('now')");
            if (def.sla.doneField) {
              const dv = def.sla.doneValues.map((v) => String(v).toLowerCase());
              parts.push("LOWER(COALESCE(" + sqlIdent(def.sla.doneField) + ",'')) NOT IN (" + dv.map(() => "?").join(",") + ")");
              params.push(...dv);
            }
            const lim = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));
            const off = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);
            const orderSql = " ORDER BY datetime(" + startId + ", '+" + def.sla.mins + " minutes') ASC";
            let total = 0;
            try { const cnt = await cfD1Query(env, uuid, "SELECT COUNT(*) AS n FROM " + tn + " WHERE " + parts.join(" AND "), params); total = (cnt[0] && cnt[0].n) || 0; } catch {}
            const rows = await cfD1Query(env, uuid, "SELECT * FROM " + tn + " WHERE " + parts.join(" AND ") + orderSql + " LIMIT ? OFFSET ?", params.concat([lim, off]));
            await doExpand(rows); // attaches _sla (+ computed/currency, field-level security)
            return Response.json({ ok: true, rows, total });
          }

          // Realtime feed — return only rows NEWER than the caller's cursor (`since`
          // = the last id they've seen), ascending, so an app can poll for live
          // updates (chat, a live feed, comments) instead of re-fetching everything.
          // `wait=1` long-polls up to ~20s (returns the moment a new row lands), which
          // makes updates feel instant with far fewer requests. Response carries a
          // fresh `cursor` (the newest id) to pass to the next call. Same read
          // visibility as the table (collect exposes nothing; user sees only its own).
          // (Appends only — edits/deletes aren't diffed; re-list to reconcile those.)
          if (isChanges) {
            if (method !== "GET") return Response.json({ ok: false, error: "read-only" }, { status: 405 });
            if (access === "collect") return Response.json({ ok: false, error: "no read" }, { status: 403 });
            // Full incremental SYNC (offline-first) — on a `sync:true` table, `?sync=<iso>`
            // returns everything changed since a timestamp: `updated` (rows created OR edited
            // after it, via updated_at) AND `deleted` (row ids tombstoned after it), plus a
            // fresh `at` cursor to pass next time. Omit `sync` (or pass empty) for a full pull.
            if (def.sync && url.searchParams.has("sync")) {
              let sscope = "", sp = [];
              if (access === "user") { if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 }); sscope = " AND owner_id=?"; sp = [userId]; }
              const since = (url.searchParams.get("sync") || "").trim();
              const nowIso = new Date().toISOString();
              const hasSince = /^\d{4}-\d\d-\d\d/.test(since);
              const updSql = "SELECT * FROM " + tn + " WHERE 1=1" + (hasSince ? " AND datetime(COALESCE(updated_at, created_at)) > datetime(?)" : "") + sscope + " ORDER BY datetime(COALESCE(updated_at, created_at)) ASC LIMIT 1000";
              const updated = await cfD1Query(env, uuid, updSql, (hasSince ? [since] : []).concat(sp));
              parseJsonRows(def, updated); attachComputed(def, updated); attachCurrency(def, updated);
              let deleted = [];
              try { const dq = await cfD1Query(env, uuid, "SELECT row_id FROM _deletes WHERE row_table=?" + (hasSince ? " AND datetime(at) > datetime(?)" : "") + " ORDER BY at ASC LIMIT 2000", hasSince ? [table, since] : [table]); deleted = dq.map((r) => r.row_id); } catch {}
              return Response.json({ ok: true, updated, deleted, at: nowIso, count: updated.length + deleted.length });
            }
            let scope = "";
            const params = [];
            if (access === "user") { if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 }); scope = " AND owner_id=?"; }
            const since = Math.max(0, parseInt(url.searchParams.get("since") || "0", 10) || 0);
            const lim = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10) || 100));
            const sql = "SELECT * FROM " + tn + " WHERE id > ?" + scope + " ORDER BY id ASC LIMIT " + lim;
            const runOnce = () => cfD1Query(env, uuid, sql, access === "user" ? [since, userId] : [since]);
            let rows = await runOnce();
            if (!rows.length && url.searchParams.get("wait") === "1") {
              const deadline = Date.now() + 20000;
              while (!rows.length && Date.now() < deadline) {
                await new Promise((r) => setTimeout(r, 2000));
                rows = await runOnce();
              }
            }
            parseJsonRows(def, rows); // realtime path bypasses doExpand → parse JSON cols here
            const cursor = rows.length ? rows[rows.length - 1].id : since;
            return Response.json({ ok: true, rows, cursor, count: rows.length });
          }

          // BULK update / delete by filter — PATCH or DELETE to /rows/<t> with NO id.
          // Powers "mark all read", "delete selected", "archive done tasks". SAFETY:
          // a `where=` filter is REQUIRED (never an unfiltered mass mutation), the set
          // is capped (≤1000 rows via an id-subquery LIMIT), and it's scoped exactly
          // like single writes — feed/user touch only THEIR OWN rows, admin any,
          // display/collect can't. Respects trash (won't touch already-trashed rows;
          // a bulk DELETE on a trash table soft-deletes unless `?hard=1`).
          if (rowId == null && (method === "PATCH" || method === "DELETE")) {
            if (access === "display" || access === "collect") return Response.json({ ok: false, error: "read-only" }, { status: 403 });
            if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
            if (!url.searchParams.getAll("where").length && !(url.searchParams.get("q") || "").trim() && !tagParam) return Response.json({ ok: false, error: "a where/q/tag filter is required for a bulk operation" }, { status: 400 });
            let base = null;
            if (access === "feed" || access === "user") base = { clause: "owner_id=?", params: [userId] };
            else if (access === "admin") { if (!(await siteRoleAllows(env, uuid, userId, def))) return Response.json({ ok: false, error: "not allowed" }, { status: 403 }); }
            const filt = buildD1Filter(url, allow, withTagFilter(withVisible(base)));
            const idSub = "id IN (SELECT id FROM " + tn + filt.whereSql + " LIMIT 1000)";
            if (method === "PATCH") {
              const body = await readBody();
              const use = pickCols(body);
              if (!use.length) return Response.json({ ok: false, error: "no data" }, { status: 400 });
              { const e = vErr(body, false); if (e) return badReq(e); }
              const ex = await cfD1Exec(env, uuid, "UPDATE " + tn + " SET " + use.map((c) => sqlIdent(c) + "=?").join(",") + tsFrag + " WHERE " + idSub, use.map((c) => body[c]).concat(filt.params));
              return Response.json({ ok: true, updated: ex.changes || 0 });
            }
            // bulk DELETE
            if (trashOn && url.searchParams.get("hard") !== "1") {
              const ex = await cfD1Exec(env, uuid, "UPDATE " + tn + " SET deleted_at=? WHERE " + idSub, [new Date().toISOString()].concat(filt.params));
              return Response.json({ ok: true, deleted: ex.changes || 0, soft: true });
            }
            const ex = await cfD1Exec(env, uuid, "DELETE FROM " + tn + " WHERE " + idSub, filt.params);
            return Response.json({ ok: true, deleted: ex.changes || 0 });
          }

          if (access === "display") {
            if (method !== "GET") return Response.json({ ok: false, error: "read-only" }, { status: 403 });
            if (rowId != null) { const r = await cfD1Query(env, uuid, "SELECT * FROM " + tn + " WHERE id=?" + (visClause ? " AND " + visClause : ""), [rowId]); if (r[0]) await doExpand(r); return Response.json({ ok: true, row: r[0] || null }); }
            const b = buildD1List(url, tn, allow, withTagFilter(withVisible(null)), listExtras, listOpts);
            let r = await cfD1Query(env, uuid, b.sql, b.params);
            let total = r.length; try { const c = await cfD1Query(env, uuid, b.countSql, b.countParams); if (c[0] && c[0].n != null) total = c[0].n; } catch {}
            r = await doExpand(r);
            return Response.json({ ok: true, rows: r, total });
          }
          if (access === "collect") {
            if (method !== "POST") return Response.json({ ok: false, error: "submit only" }, { status: 403 });
            const body = await readBody();
            if (Array.isArray(body.rows)) { const e = vBatch(body.rows); if (e) return badReq(e); return Response.json(Object.assign({ ok: true }, await insertMany(env, uuid, tn, allow, body.rows, null, def))); }
            const use = pickCols(body);
            if (!use.length) return Response.json({ ok: false, error: "no data" }, { status: 400 });
            { const e = vErr(body, true); if (e) return badReq(e); }
            if (upCol) return Response.json(Object.assign({ ok: true }, await upsertRow(env, uuid, tn, allow, upCol, body, null, def)));
            if (await maybeSlug(env, uuid, def, tn, body)) use.push("slug"); // auto-slug (adds body.slug + the column)
            if (await maybeSequence(env, uuid, def, tn, body)) use.push(def.sequence.field); // auto-number
            await cfD1Query(env, uuid, "INSERT INTO " + tn + " (" + use.map(sqlIdent).join(",") + ") VALUES (" + use.map(() => "?").join(",") + ")", use.map((c) => body[c]));
            fireInsertTriggers(env, ctx, slug, table, body);
            return Response.json({ ok: true });
          }
          if (access === "feed") {
            // Public READ (a shared feed/board/comments); a LOGGED-IN visitor may
            // post, and may edit/delete only their OWN rows (stamped owner_id).
            if (method === "GET") {
              if (rowId != null) { const r = await cfD1Query(env, uuid, "SELECT * FROM " + tn + " WHERE id=?" + (visClause ? " AND " + visClause : ""), [rowId]); if (r[0]) await doExpand(r); return Response.json({ ok: true, row: r[0] || null }); }
              // Feed audience filters (auth, composable): `?following=1` → only authors the
              // caller follows (home feed); `?hideBlocked=1` → exclude authors the caller has
              // blocked. Both AND together and compose with where/q/sort/pagination; ignored
              // when signed out.
              const audience = [];
              if (url.searchParams.get("following") === "1" && userId) { await ensureFollows(env, uuid); audience.push({ clause: "owner_id IN (SELECT followee_id FROM _follows WHERE follower_id=?)", params: [userId] }); }
              if (url.searchParams.get("hideBlocked") === "1" && userId) { await ensureBlocks(env, uuid); audience.push({ clause: "owner_id NOT IN (SELECT blocked_id FROM _blocks WHERE blocker_id=?)", params: [userId] }); }
              const fbase = audience.length ? { clause: audience.map((a) => a.clause).join(" AND "), params: audience.flatMap((a) => a.params) } : null;
              const b = buildD1List(url, tn, allow, withTagFilter(withVisible(fbase)), listExtras, listOpts);
              let r = await cfD1Query(env, uuid, b.sql, b.params);
              let total = r.length; try { const c = await cfD1Query(env, uuid, b.countSql, b.countParams); if (c[0] && c[0].n != null) total = c[0].n; } catch {}
              r = await doExpand(r);
              return Response.json({ ok: true, rows: r, total });
            }
            if (!userId) return Response.json({ ok: false, error: "sign in to post" }, { status: 401 });
            if (method === "POST") {
              const body = await readBody();
              if (Array.isArray(body.rows)) { const e = vBatch(body.rows); if (e) return badReq(e); return Response.json(Object.assign({ ok: true }, await insertMany(env, uuid, tn, allow, body.rows, userId, def))); }
              const use = pickCols(body);
              if (!use.length) return Response.json({ ok: false, error: "no data" }, { status: 400 }); // reject empty/junk-only bodies (matches collect/admin)
              { const e = vErr(body, true); if (e) return badReq(e); }
              if (upCol) return Response.json(Object.assign({ ok: true }, await upsertRow(env, uuid, tn, allow, upCol, body, userId, def)));
              if (await maybeSlug(env, uuid, def, tn, body)) use.push("slug"); // auto-slug
              if (await maybeSequence(env, uuid, def, tn, body)) use.push(def.sequence.field); // auto-number
              const rrOwner = await resolveAssignee(env, uuid, def, table, body, userId);
              const c2 = use.concat(["owner_id"]), v2 = use.map((c) => body[c]).concat([rrOwner]);
              await cfD1Query(env, uuid, "INSERT INTO " + tn + " (" + c2.map(sqlIdent).join(",") + ") VALUES (" + c2.map(() => "?").join(",") + ")", v2);
              fireInsertTriggers(env, ctx, slug, table, body);
              return Response.json(rrOwner !== userId ? { ok: true, owner_id: rrOwner } : { ok: true });
            }
            if (method === "PATCH" && rowId != null) {
              const body = await readBody(); const use = pickCols(body);
              if (!use.length) return Response.json({ ok: false, error: "no data" }, { status: 400 });
              { const e = vErr(body, false); if (e) return badReq(e); }
              { const _u = await applyVersionedUpdate(use, body, " AND owner_id=?", [userId]); if (_u.ok) fireUpdateTriggers(env, ctx, slug, table, Object.assign({ id: rowId }, body)); return versionResp(_u); } // own row only; optimistic-lock aware; fires on:{update} functions on success
            }
            if (method === "DELETE" && rowId != null) {
              if (!(await doDelete(" AND owner_id=?", [userId]))) return Response.json({ ok: false, error: "not found" }, { status: 404 });
              return Response.json({ ok: true });
            }
            return Response.json({ ok: false, error: "unsupported" }, { status: 405 });
          }
          if (access === "admin") {
            // Anyone READS (shared content — a catalog, blog, events). Only a site-
            // user whose role is 'admin' may write; admins manage ALL rows (not
            // owner-scoped), so this is an in-app CMS the app's own admin controls.
            if (method === "GET") {
              if (rowId != null) { const r = await cfD1Query(env, uuid, "SELECT * FROM " + tn + " WHERE id=?" + (visClause ? " AND " + visClause : ""), [rowId]); if (r[0]) await doExpand(r); return Response.json({ ok: true, row: r[0] || null }); }
              const b = buildD1List(url, tn, allow, withTagFilter(withVisible(null)), listExtras, listOpts);
              let r = await cfD1Query(env, uuid, b.sql, b.params);
              let total = r.length; try { const c = await cfD1Query(env, uuid, b.countSql, b.countParams); if (c[0] && c[0].n != null) total = c[0].n; } catch {}
              r = await doExpand(r);
              return Response.json({ ok: true, rows: r, total });
            }
            if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
            if (!(await siteRoleAllows(env, uuid, userId, def))) return Response.json({ ok: false, error: "not allowed" }, { status: 403 });
            if (method === "POST") {
              const body = await readBody();
              if (Array.isArray(body.rows)) { const e = vBatch(body.rows); if (e) return badReq(e); return Response.json(Object.assign({ ok: true }, await insertMany(env, uuid, tn, allow, body.rows, null, def))); }
              const use = pickCols(body);
              if (!use.length) return Response.json({ ok: false, error: "no data" }, { status: 400 });
              { const e = vErr(body, true); if (e) return badReq(e); }
              if (upCol) return Response.json(Object.assign({ ok: true }, await upsertRow(env, uuid, tn, allow, upCol, body, null, def)));
              if (await maybeSlug(env, uuid, def, tn, body)) use.push("slug"); // auto-slug
              if (await maybeSequence(env, uuid, def, tn, body)) use.push(def.sequence.field); // auto-number
              await cfD1Query(env, uuid, "INSERT INTO " + tn + " (" + use.map(sqlIdent).join(",") + ") VALUES (" + use.map(() => "?").join(",") + ")", use.map((c) => body[c]));
              fireInsertTriggers(env, ctx, slug, table, body);
              return Response.json({ ok: true });
            }
            if (method === "PATCH" && rowId != null) {
              const body = await readBody(); const use = pickCols(body);
              if (!use.length) return Response.json({ ok: false, error: "no data" }, { status: 400 });
              { const e = vErr(body, false); if (e) return badReq(e); }
              { const _u = await applyVersionedUpdate(use, body, "", []); if (_u.ok) fireUpdateTriggers(env, ctx, slug, table, Object.assign({ id: rowId }, body)); return versionResp(_u); } // admin edits any row; optimistic-lock aware; fires on:{update} functions on success
            }
            if (method === "DELETE" && rowId != null) {
              if (!(await doDelete("", []))) return Response.json({ ok: false, error: "not found" }, { status: 404 });
              return Response.json({ ok: true });
            }
            return Response.json({ ok: false, error: "unsupported" }, { status: 405 });
          }
          // access === "user": requires login; every row scoped to owner_id.
          if (!userId) return Response.json({ ok: false, error: "sign in first" }, { status: 401 });
          if (method === "GET") {
            if (rowId != null) {
              const single = userReadBase(); // teamRead: a manager may also read a downline member's row
              let r = await cfD1Query(env, uuid, "SELECT * FROM " + tn + " WHERE id=? AND " + single.clause + (visClause ? " AND " + visClause : ""), [rowId].concat(single.params));
              if (!r[0] && await shareLevel(env, uuid, table, rowId, userId)) r = await cfD1Query(env, uuid, "SELECT * FROM " + tn + " WHERE id=?" + (visClause ? " AND " + visClause : ""), [rowId]); // shared with me
              if (!r[0]) return Response.json({ ok: false, error: "not found" }, { status: 404 });
              await doExpand(r); return Response.json({ ok: true, row: r[0] });
            }
            // "Shared with me" view: rows another member shared with the caller (not owned).
            let base;
            if (url.searchParams.get("shared") === "1") {
              const ids = await sharedRowIds(env, uuid, table, userId);
              if (!ids.length) return Response.json({ ok: true, rows: [], total: 0 });
              base = { clause: "id IN (" + ids.map(() => "?").join(",") + ")", params: ids };
            } else base = userReadBase(); // teamRead: a manager's list includes their downline's rows
            const b = buildD1List(url, tn, allow, withTagFilter(withVisible(base)), listExtras, listOpts);
            let r = await cfD1Query(env, uuid, b.sql, b.params);
            let total = r.length; try { const c = await cfD1Query(env, uuid, b.countSql, b.countParams); if (c[0] && c[0].n != null) total = c[0].n; } catch {}
            r = await doExpand(r);
            return Response.json({ ok: true, rows: r, total });
          }
          if (method === "POST") {
            const body = await readBody();
            if (Array.isArray(body.rows)) { const e = vBatch(body.rows); if (e) return badReq(e); return Response.json(Object.assign({ ok: true }, await insertMany(env, uuid, tn, allow, body.rows, userId, def))); }
            const use = pickCols(body);
            if (!use.length) return Response.json({ ok: false, error: "no data" }, { status: 400 }); // reject empty/junk-only bodies (matches collect/admin)
            { const e = vErr(body, true); if (e) return badReq(e); }
            if (upCol) return Response.json(Object.assign({ ok: true }, await upsertRow(env, uuid, tn, allow, upCol, body, userId, def)));
            if (await maybeSlug(env, uuid, def, tn, body)) use.push("slug"); // auto-slug
            if (await maybeSequence(env, uuid, def, tn, body)) use.push(def.sequence.field); // auto-number
            const rrOwner = await resolveAssignee(env, uuid, def, table, body, userId);
            const c2 = use.concat(["owner_id"]), v2 = use.map((c) => body[c]).concat([rrOwner]);
            await cfD1Query(env, uuid, "INSERT INTO " + tn + " (" + c2.map(sqlIdent).join(",") + ") VALUES (" + c2.map(() => "?").join(",") + ")", v2);
            fireInsertTriggers(env, ctx, slug, table, body);
            return Response.json(rrOwner !== userId ? { ok: true, owner_id: rrOwner } : { ok: true });
          }
          if (method === "PATCH" && rowId != null) {
            const body = await readBody(); const use = pickCols(body);
            if (!use.length) return Response.json({ ok: false, error: "no data" }, { status: 400 });
            { const e = vErr(body, false); if (e) return badReq(e); }
            // Owner may update their own row (optimistic-lock aware); if not the owner, an
            // EDIT-level share collaborator may too (view-only cannot). Both honor ?ifVersion.
            let r = await applyVersionedUpdate(use, body, " AND owner_id=?", [userId]);
            if (r.notFound && (await shareLevel(env, uuid, table, rowId, userId)) === "edit") r = await applyVersionedUpdate(use, body, "", []);
            return versionResp(r);
          }
          if (method === "DELETE" && rowId != null) {
            // Delete stays OWNER-only — a shared collaborator can edit content but never
            // delete someone else's row (safe default).
            if (!(await doDelete(" AND owner_id=?", [userId]))) return Response.json({ ok: false, error: "not found" }, { status: 404 });
            return Response.json({ ok: true });
          }
          return Response.json({ ok: false, error: "unsupported" }, { status: 405 });
        } catch (e) {
          if (e && e.bad) return Response.json({ ok: false, error: "invalid request" }, { status: 400 });
          // A declared UNIQUE constraint was violated (e.g. a member reviewing the same
          // product twice) → a clean 409 the app can show ("you've already done this"),
          // not a scary 502.
          const emsg = (e && (e.detail || e.message)) || "";
          if (/UNIQUE constraint failed/i.test(emsg)) return Response.json({ ok: false, error: "already exists", code: "duplicate" }, { status: 409 });
          // A `maxRows` quota trigger aborted the insert → a clean 409, not a 502.
          if (/row limit reached/i.test(emsg)) return Response.json({ ok: false, error: "row limit reached", code: "limit" }, { status: 409 });
          // A referential-integrity trigger aborted (fk → missing parent) → a clean 400.
          if (/missing parent/i.test(emsg)) return Response.json({ ok: false, error: "referenced record not found", code: "ref" }, { status: 400 });
          // A RESTRICT foreign key blocked a delete (related rows still exist) → a clean 409.
          if (e && e.restrict) return Response.json({ ok: false, error: "can't delete — related records still exist", code: "restrict" }, { status: 409 });
          console.error("data api failed:", slug, table, method, e && e.message, e && e.detail);
          return Response.json({ ok: false, error: "data error — try again" }, { status: 502 });
        }
      }
    }
    if (url.pathname === "/api/site/react-build" && request.method === "POST") {
      const rbUser = await authUser(request);
      if (!rbUser) return UNAUTHED();
      if (!env.ANTHROPIC_API_KEY) return Response.json({ ok: false, error: "engine not configured" }, { status: 501 });
      if (!env.BUILD_CONTAINER || !env.SITES_BUCKET) return Response.json({ ok: false, error: "build service not configured" }, { status: 501 });
      const tlR = tooLargeBody(request, 1_000_000); if (tlR) return tlR;
      let rb; try { rb = await request.json(); } catch { return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
      const brief = typeof rb.brief === "string" ? rb.brief.trim().slice(0, 4000) : "";
      if (!brief) return Response.json({ ok: false, error: "no brief" }, { status: 400 });
      const auth = request.headers.get("Authorization") || "";
      const CREDIT_USD = 0.008, RB_MAX_OUT = 16000, RB_MAX_IMAGES = 6;
      const RB_IMG_CREDITS = Math.max(1, Math.ceil(SITE_IMG_USD / CREDIT_USD));
      // Build model: always Sonnet 5 (owner's call 2026-07-21). Haiku was dropped from
      // the builder — it mis-wired the backend API often enough to ship dead apps, so
      // whole-app builds go through Sonnet for reliability. (Haiku is still used
      // elsewhere for cheap director steps — this only removes it from react-build.)
      const RB_MODEL = "claude-sonnet-5";
      const RATE_IN = 3e-6, RATE_OUT = 15e-6; // Sonnet 5 token rates
      const rbCredits = (i, o) => Math.max(1, Math.ceil((i * RATE_IN + o * RATE_OUT) / CREDIT_USD));
      let bal0; try { bal0 = await readCredits(auth); } catch { bal0 = 0; }
      if (!(bal0 >= rbCredits(2500, RB_MAX_OUT))) return Response.json({ ok: false, error: "not enough credits", need: "credits" }, { status: 402 });
      // The whole build streams as NDJSON so the client shows it LIVE (Claude-Code
      // style): {ev:"code"} carries the source as the model writes it, {ev:"phase"}
      // marks generating→images→compiling→(fixing)→publishing, and the terminal
      // {ev:"done"|"error"} carries the URL/cost. Streaming also keeps the HTTP
      // connection alive so a long build never trips a client/edge idle timeout,
      // and it never blocks on a non-streaming Anthropic call (the large-output
      // timeout risk). ctx.waitUntil keeps the async writer alive after we return
      // the still-open stream.
      const enc = new TextEncoder();
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const emit = (o) => writer.write(enc.encode(JSON.stringify(o) + "\n")).catch(() => {});
      // Stream a Sonnet generation, forwarding text deltas to onDelta and returning
      // the full text + token usage. Throws on a non-OK upstream (status carried).
      const streamGen = async (system, userContent, onDelta) => {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({ model: RB_MODEL, max_tokens: RB_MAX_OUT, stream: true, system, messages: [{ role: "user", content: userContent }] }),
          signal: AbortSignal.timeout(180000),
        });
        if (!r.ok) { const d = await r.json().catch(() => ({})); const e = new Error("gen " + r.status); e.status = r.status; e.detail = JSON.stringify(d).slice(0, 500); throw e; }
        const reader = r.body.getReader(); const dec = new TextDecoder();
        let buf = "", text = "", usedIn = 0, usedOut = 0;
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const js = line.slice(5).trim(); if (!js || js === "[DONE]") continue;
            let ev; try { ev = JSON.parse(js); } catch { continue; }
            if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") { text += ev.delta.text; if (onDelta) onDelta(ev.delta.text); }
            else if (ev.type === "message_start" && ev.message && ev.message.usage) usedIn = ev.message.usage.input_tokens || 0;
            else if (ev.type === "message_delta" && ev.usage) usedOut = ev.usage.output_tokens || usedOut;
          }
        }
        if (!usedOut) usedOut = Math.ceil(text.length / 4);
        return { text, usedIn, usedOut };
      };
      const buildInContainer = async (files) => {
        const c = getContainer(env.BUILD_CONTAINER);
        const t0 = Date.now();
        const br = await c.fetch(new Request("http://build/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files }) }));
        const bd = await br.json().catch(() => ({ ok: false, error: "build service returned no JSON" }));
        return { bd, buildMs: Date.now() - t0 };
      };
      // Batch code deltas so the client gets readable chunks, not a flood.
      let codeBuf = "";
      const flushCode = (force) => { if (codeBuf && (force || codeBuf.length >= 140)) { emit({ ev: "code", t: codeBuf }); codeBuf = ""; } };
      const onDelta = (d) => { codeBuf += d; flushCode(false); };
      const run = async () => {
        let balAfter = bal0, genCredits = 0, imgCredits = 0;
        try {
          // 1) Generate the whole React project (streamed live).
          emit({ ev: "phase", phase: "generating" });
          const g = await streamGen(REACT_RULES, "Build this as a polished React app. Output ONLY the file blocks.\n\n" + brief, onDelta);
          flushCode(true);
          let files = parseGeneratedFiles(g.text);
          if (!files["index.html"] || !files["src/main.jsx"] || !files["src/App.jsx"]) { emit({ ev: "error", stage: "generate", msg: "the generated project came out incomplete — try again" }); return; }
          let schemaSpec = parseSchemaSpec(files); // pulled out of the build; provisioned after publish
          const fnSpecs = parseFunctionSpecs(files); // edge functions, likewise stripped + provisioned after publish
          genCredits += rbCredits(g.usedIn, g.usedOut);
          try { const b = await useCredits(auth, rbCredits(g.usedIn, g.usedOut)); if (b >= 0) balAfter = b; } catch {}
          // SAFETY NET: the app wired itself to the backend API (/auth or /rows) but
          // the model forgot to declare isibi.schema.json → no DB gets provisioned
          // and every backend call 404s "this site has no backend yet" on the live
          // site. Models omit it often enough that this can't be optional: ask for
          // JUST the schema (inferred from the app's own code) and provision it.
          if (!schemaSpec) {
            const usesBackend = Object.values(files).some((src) => /\/auth\/(signup|login)\b/.test(String(src)) || /\/rows\/[a-z_][a-z0-9_]*/i.test(String(src)));
            if (usesBackend) {
              const dump = Object.entries(files).map(([p, s]) => "===FILE: " + p + "===\n" + s).join("\n\n").slice(0, 90000);
              try {
                const sg = await streamGen(SCHEMA_REPAIR_RULES, "This project calls the per-site backend API (/auth and/or /rows/<table>) but is MISSING its isibi.schema.json, so NO database is created and every backend call fails on the live site. Emit ONLY the isibi.schema.json file block declaring the tables it uses.\n\nProject files:\n\n" + dump, null);
                if (sg && sg.text) {
                  const sf = parseGeneratedFiles(sg.text);
                  if (sf["isibi.schema.json"]) { files["isibi.schema.json"] = sf["isibi.schema.json"]; schemaSpec = parseSchemaSpec(files); }
                  const sc = rbCredits(sg.usedIn, sg.usedOut); genCredits += sc; try { const b = await useCredits(auth, sc); if (b >= 0) balAfter = b; } catch {}
                }
              } catch (e) { console.error("react-build schema repair failed:", e && (e.status || e.message)); }
            }
          }
          // SAFETY NET #2: the app calls the backend but wired the URL WITHOUT the
          // site slug (`/api/db/auth/…`, `/api/db/rows/…`, or `` `/api/db${x}` ``
          // with no slug segment). The one true base is `/api/db/<slug>/…` where
          // `<slug> = location.pathname.split('/')[2]`. This compiles fine, so the
          // build loop never catches it — but every backend call 404s on the live
          // site. Detect the broken shape directly (precise, low false-positive:
          // correct code reads `/api/db/${slug}/…`, which none of these match) and
          // hand the app back for a URL-only rewrite. Only when a backend is used.
          {
            const usesBackend2 = Object.values(files).some((src) => /\/auth\/(signup|login)\b/.test(String(src)) || /\/rows\/[a-z_][a-z0-9_]*/i.test(String(src)) || /\/api\/db\b/.test(String(src)));
            const brokenWiring = Object.values(files).some((src) => {
              const s = String(src);
              return /\/api\/db\/(auth|rows)\b/.test(s)                              // "/api/db/auth…" or "/api/db/rows…" — slug missing
                || /\/api\/db\$\{/.test(s)                                          // `/api/db${x}` — no "/<slug>" before the var
                || /["'`]\/api\/db["'`]\s*\+\s*["'`]\/(auth|rows)/.test(s);         // "/api/db" + "/auth…"
            });
            const derivesSlug = Object.values(files).some((src) => /split\(\s*["']\/["']\s*\)\s*(\[\s*2\s*\]|\.at\(\s*2\s*\))/.test(String(src)));
            if (usesBackend2 && brokenWiring && !derivesSlug) {
              const dump = Object.entries(files).map(([p, s]) => "===FILE: " + p + "===\n" + s).join("\n\n").slice(0, 90000);
              try {
                const wg = await streamGen(WIRING_REPAIR_RULES, "This project's backend calls are MISSING the site slug, so every /auth and /rows request 404s on the live site. Re-point EVERY backend call through `const API = '/api/db/' + (location.pathname.split('/')[2] || '')`. Return ONLY the corrected file(s).\n\nProject files:\n\n" + dump, null);
                if (wg && wg.text) {
                  const wf = parseGeneratedFiles(wg.text);
                  for (const [p, v] of Object.entries(wf)) { if (p !== "isibi.schema.json") files[p] = v; } // URL-wiring only; never let it rewrite the schema
                  const wc = rbCredits(wg.usedIn, wg.usedOut); genCredits += wc; try { const b = await useCredits(auth, wc); if (b >= 0) balAfter = b; } catch {}
                }
              } catch (e) { console.error("react-build wiring repair failed:", e && (e.status || e.message)); }
            }
          }
          // 2) Real images into the SOURCE, budgeted to the remaining balance.
          emit({ ev: "phase", phase: "images" });
          {
            const imgBudget = Math.max(0, Math.min(RB_MAX_IMAGES, Math.floor(balAfter / RB_IMG_CREDITS)));
            const inj = await injectReactImages(files, request, env, rbUser.id, imgBudget, (im) => emit({ ev: "image", prompt: im.prompt, url: im.url }));
            files = inj.files;
            if (inj.charged > 0) { const c = inj.charged * RB_IMG_CREDITS; imgCredits += c; try { const b = await useCredits(auth, c); if (b >= 0) balAfter = b; } catch {} }
          }
          // 3) Compile in the container, with an auto-fix loop (≤2 tries): on a
          // compile error, hand the exact error + current files back to Sonnet,
          // graft the corrected files, re-inject any new images, and rebuild.
          emit({ ev: "phase", phase: "compiling" });
          let { bd, buildMs } = await buildInContainer(files);
          let attempt = 0;
          while (!bd.ok && attempt < 2) {
            attempt++;
            emit({ ev: "phase", phase: "fixing", attempt });
            const errText = String(bd.error || "compile failed").slice(0, 2000);
            const filesDump = Object.entries(files).map(([p, src]) => "===FILE: " + p + "===\n" + src).join("\n\n").slice(0, 90000);
            let fg;
            try { fg = await streamGen(REACT_FIX_RULES, "The Vite build FAILED with this error:\n\n" + errText + "\n\nCurrent project files:\n\n" + filesDump + "\n\nReturn the corrected file(s).", onDelta); } catch (e) { if (e && e.status) console.error("react-build fix gen failed:", e.status, e.detail); break; }
            flushCode(true);
            const fixed = parseGeneratedFiles(fg.text);
            if (!Object.keys(fixed).length) break; // nothing usable came back
            for (const [p, v] of Object.entries(fixed)) files[p] = v;
            const fc = rbCredits(fg.usedIn, fg.usedOut); genCredits += fc; try { const b = await useCredits(auth, fc); if (b >= 0) balAfter = b; } catch {}
            const rem = Math.max(0, Math.min(RB_MAX_IMAGES, Math.floor(balAfter / RB_IMG_CREDITS)));
            const inj2 = await injectReactImages(files, request, env, rbUser.id, rem);
            files = inj2.files;
            if (inj2.charged > 0) { const c = inj2.charged * RB_IMG_CREDITS; imgCredits += c; try { const b = await useCredits(auth, c); if (b >= 0) balAfter = b; } catch {} }
            ({ bd, buildMs } = await buildInContainer(files));
          }
          if (!bd.ok) { emit({ ev: "error", stage: "build", msg: "the site didn't compile — try rephrasing or send it again", detail: String(bd.error || "").slice(0, 400), cost: genCredits + imgCredits, balance: balAfter }); return; }
          const dist = bd.files || {};
          if (!dist["index.html"]) { emit({ ev: "error", stage: "build", msg: "the build produced no page — try again", cost: genCredits + imgCredits, balance: balAfter }); return; }
          // 4) Publish the dist to R2 → live at /s/<slug>/.
          emit({ ev: "phase", phase: "publishing" });
          // Brand = the <title> the model chose, minus any " — tagline".
          let brand = "";
          const tm = (files["index.html"] || "").match(/<title>\s*([^<]{1,90})<\/title>/i);
          if (tm) brand = tm[1].split(/\s[—–|·-]+\s/)[0].replace(/\s+/g, " ").trim().slice(0, 40);
          const seed = (brand || brief).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || "app";
          const slug = seed + "-" + crypto.randomUUID().slice(0, 6);
          for (const [rel, v] of Object.entries(dist)) {
            const safeRel = String(rel).replace(/[^a-z0-9/._-]/gi, "-");
            const ext = (safeRel.match(/\.([a-z0-9]{1,8})$/i) || [])[1] || "";
            const ct = R2_MIME[ext.toLowerCase()] || "application/octet-stream";
            let bodyOut;
            if (v && typeof v.t === "string") bodyOut = v.t;
            else if (v && typeof v.b === "string") { const bin = atob(v.b); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); bodyOut = u8; }
            else continue;
            await env.SITES_BUCKET.put("sites/" + slug + "/" + safeRel, bodyOut, { httpMetadata: { contentType: ct } });
          }
          // Persist the GENERATED SOURCE (not the dist) so a later chat revise can
          // load it, edit it, and rebuild. Stored under a private key, never served.
          try { await env.SITES_BUCKET.put("sitesrc/" + slug + ".json", JSON.stringify({ files, uid: rbUser.id }), { httpMetadata: { contentType: "application/json" } }); } catch (e) { console.error("react-build src persist failed:", e && e.message); }
          await archiveBuild(env, slug, dist); // keep a rollback snapshot of this build
          // If the site declared a backend, provision its own D1 + create the tables
          // (non-fatal: the site still ships if this fails; data just won't work).
          let backend = false;
          if (schemaSpec && d1Configured(env)) {
            emit({ ev: "phase", phase: "database" });
            try { const dbid = await ensureSiteBackend(env, slug, rbUser.id); await applySiteSchema(env, dbid, schemaSpec); backend = true; }
            catch (e) { console.error("react-build backend provision failed:", e && e.message, e && e.detail); }
          }
          // Provision declared edge functions (server logic + secrets: 3rd-party API
          // calls, payments, email). Non-fatal — the site still ships if it fails.
          let functions = 0;
          try { if (fnSpecs.length) { await persistSiteFunctions(env, rbUser.id, slug, fnSpecs); functions = fnSpecs.length; } }
          catch (e) { console.error("react-build fn provision failed:", e && e.message); }
          emit({ ev: "done", url: "/s/" + slug + "/", slug, files: Object.keys(dist), buildMs, fixed: attempt, cost: genCredits + imgCredits, balance: balAfter, brand, backend, functions, model: RB_MODEL });
        } catch (e) {
          if (e && e.status) console.error("react-build gen failed:", e.status, e.detail);
          else console.error("react-build failed:", e && e.message);
          emit({ ev: "error", msg: "the builder hit a problem — try again in a moment" });
        } finally { try { await writer.close(); } catch {} }
      };
      ctx.waitUntil(run());
      return new Response(readable, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
    }
    if (url.pathname === "/api/site/react-revise" && request.method === "POST") {
      // Edit an already-built React site by chat: load the persisted source, hand
      // it + the instruction to Sonnet (REACT_REVISE_RULES), graft the changed
      // files, rebuild, and REPUBLISH to the SAME slug so the URL stays stable.
      // Streams the same NDJSON events as the build path (live code + phases).
      const rvUser = await authUser(request);
      if (!rvUser) return UNAUTHED();
      if (!env.ANTHROPIC_API_KEY) return Response.json({ ok: false, error: "engine not configured" }, { status: 501 });
      if (!env.BUILD_CONTAINER || !env.SITES_BUCKET) return Response.json({ ok: false, error: "build service not configured" }, { status: 501 });
      const tlR = tooLargeBody(request, 100_000); if (tlR) return tlR;
      let rv; try { rv = await request.json(); } catch { return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
      const slug = typeof rv.slug === "string" ? rv.slug.replace(/[^a-z0-9-]/gi, "").slice(0, 60) : "";
      const instruction = typeof rv.instruction === "string" ? rv.instruction.trim().slice(0, 2000) : "";
      if (!slug || !instruction) return Response.json({ ok: false, error: "missing slug or instruction" }, { status: 400 });
      // Load the persisted source + verify ownership.
      let srcObj = null;
      try { const o = await env.SITES_BUCKET.get("sitesrc/" + slug + ".json"); if (o) srcObj = JSON.parse(await o.text()); } catch {}
      if (!srcObj || !srcObj.files) return Response.json({ ok: false, error: "this site can't be edited yet — rebuild it first", need: "rebuild" }, { status: 409 });
      if (srcObj.uid && srcObj.uid !== rvUser.id) return UNAUTHED();
      const auth = request.headers.get("Authorization") || "";
      const CREDIT_USD = 0.008, RB_MAX_OUT = 16000, RB_MAX_IMAGES = 4;
      const RB_IMG_CREDITS = Math.max(1, Math.ceil(SITE_IMG_USD / CREDIT_USD));
      const rbCredits = (i, o) => Math.max(1, Math.ceil((i * 3e-6 + o * 15e-6) / CREDIT_USD));
      let bal0; try { bal0 = await readCredits(auth); } catch { bal0 = 0; }
      if (!(bal0 >= rbCredits(4000, RB_MAX_OUT))) return Response.json({ ok: false, error: "not enough credits", need: "credits" }, { status: 402 });
      const enc = new TextEncoder();
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const emit = (o) => writer.write(enc.encode(JSON.stringify(o) + "\n")).catch(() => {});
      const streamGen = async (system, userContent, onDelta) => {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: RB_MAX_OUT, stream: true, system, messages: [{ role: "user", content: userContent }] }),
          signal: AbortSignal.timeout(180000),
        });
        if (!r.ok) { const d = await r.json().catch(() => ({})); const e = new Error("gen " + r.status); e.status = r.status; e.detail = JSON.stringify(d).slice(0, 500); throw e; }
        const reader = r.body.getReader(); const dec = new TextDecoder();
        let buf = "", text = "", usedIn = 0, usedOut = 0;
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const js = line.slice(5).trim(); if (!js || js === "[DONE]") continue;
            let ev; try { ev = JSON.parse(js); } catch { continue; }
            if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") { text += ev.delta.text; if (onDelta) onDelta(ev.delta.text); }
            else if (ev.type === "message_start" && ev.message && ev.message.usage) usedIn = ev.message.usage.input_tokens || 0;
            else if (ev.type === "message_delta" && ev.usage) usedOut = ev.usage.output_tokens || usedOut;
          }
        }
        if (!usedOut) usedOut = Math.ceil(text.length / 4);
        return { text, usedIn, usedOut };
      };
      const buildInContainer = async (files) => {
        const c = getContainer(env.BUILD_CONTAINER);
        const t0 = Date.now();
        const br = await c.fetch(new Request("http://build/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files }) }));
        const bd = await br.json().catch(() => ({ ok: false, error: "build service returned no JSON" }));
        return { bd, buildMs: Date.now() - t0 };
      };
      let codeBuf = "";
      const flushCode = (force) => { if (codeBuf && (force || codeBuf.length >= 140)) { emit({ ev: "code", t: codeBuf }); codeBuf = ""; } };
      const onDelta = (d) => { codeBuf += d; flushCode(false); };
      const run = async () => {
        let balAfter = bal0, genCredits = 0, imgCredits = 0;
        let files = srcObj.files;
        try {
          emit({ ev: "phase", phase: "generating" });
          const filesDump = Object.entries(files).map(([p, src]) => "===FILE: " + p + "===\n" + src).join("\n\n").slice(0, 120000);
          const g = await streamGen(REACT_REVISE_RULES, "Current project files:\n\n" + filesDump + "\n\nCHANGE REQUEST:\n" + instruction + "\n\nReturn only the changed file blocks.", onDelta);
          flushCode(true);
          const changed = parseGeneratedFiles(g.text);
          if (!Object.keys(changed).length) { emit({ ev: "error", stage: "generate", msg: "I couldn't apply that change — try rewording it" }); return; }
          for (const [p, v] of Object.entries(changed)) files[p] = v;
          const schemaSpec = parseSchemaSpec(files); // a revise can add/extend the backend
          genCredits += rbCredits(g.usedIn, g.usedOut);
          try { const b = await useCredits(auth, rbCredits(g.usedIn, g.usedOut)); if (b >= 0) balAfter = b; } catch {}
          emit({ ev: "phase", phase: "images" });
          {
            const imgBudget = Math.max(0, Math.min(RB_MAX_IMAGES, Math.floor(balAfter / RB_IMG_CREDITS)));
            const inj = await injectReactImages(files, request, env, rvUser.id, imgBudget, (im) => emit({ ev: "image", prompt: im.prompt, url: im.url }));
            files = inj.files;
            if (inj.charged > 0) { const c = inj.charged * RB_IMG_CREDITS; imgCredits += c; try { const b = await useCredits(auth, c); if (b >= 0) balAfter = b; } catch {} }
          }
          emit({ ev: "phase", phase: "compiling" });
          let { bd, buildMs } = await buildInContainer(files);
          let attempt = 0;
          while (!bd.ok && attempt < 2) {
            attempt++;
            emit({ ev: "phase", phase: "fixing", attempt });
            const errText = String(bd.error || "compile failed").slice(0, 2000);
            const dump = Object.entries(files).map(([p, src]) => "===FILE: " + p + "===\n" + src).join("\n\n").slice(0, 90000);
            let fg;
            try { fg = await streamGen(REACT_FIX_RULES, "The Vite build FAILED with this error:\n\n" + errText + "\n\nCurrent project files:\n\n" + dump + "\n\nReturn the corrected file(s).", onDelta); } catch (e) { if (e && e.status) console.error("react-revise fix gen failed:", e.status, e.detail); break; }
            flushCode(true);
            const fixed = parseGeneratedFiles(fg.text);
            if (!Object.keys(fixed).length) break;
            for (const [p, v] of Object.entries(fixed)) files[p] = v;
            const fc = rbCredits(fg.usedIn, fg.usedOut); genCredits += fc; try { const b = await useCredits(auth, fc); if (b >= 0) balAfter = b; } catch {}
            const rem = Math.max(0, Math.min(RB_MAX_IMAGES, Math.floor(balAfter / RB_IMG_CREDITS)));
            const inj2 = await injectReactImages(files, request, env, rvUser.id, rem);
            files = inj2.files;
            if (inj2.charged > 0) { const c = inj2.charged * RB_IMG_CREDITS; imgCredits += c; try { const b = await useCredits(auth, c); if (b >= 0) balAfter = b; } catch {} }
            ({ bd, buildMs } = await buildInContainer(files));
          }
          if (!bd.ok) { emit({ ev: "error", stage: "build", msg: "that change broke the build — try rewording it", cost: genCredits + imgCredits, balance: balAfter }); return; }
          const dist = bd.files || {};
          if (!dist["index.html"]) { emit({ ev: "error", stage: "build", msg: "the rebuild produced no page — try again", cost: genCredits + imgCredits, balance: balAfter }); return; }
          emit({ ev: "phase", phase: "publishing" });
          // Republish to the SAME slug (overwrite dist). Clean out old hashed assets
          // so stale bundles don't linger.
          try { const old = await env.SITES_BUCKET.list({ prefix: "sites/" + slug + "/" }); for (const o of (old.objects || [])) await env.SITES_BUCKET.delete(o.key); } catch {}
          for (const [rel, v] of Object.entries(dist)) {
            const safeRel = String(rel).replace(/[^a-z0-9/._-]/gi, "-");
            const ext = (safeRel.match(/\.([a-z0-9]{1,8})$/i) || [])[1] || "";
            const ct = R2_MIME[ext.toLowerCase()] || "application/octet-stream";
            let bodyOut;
            if (v && typeof v.t === "string") bodyOut = v.t;
            else if (v && typeof v.b === "string") { const bin = atob(v.b); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); bodyOut = u8; }
            else continue;
            await env.SITES_BUCKET.put("sites/" + slug + "/" + safeRel, bodyOut, { httpMetadata: { contentType: ct } });
          }
          try { await env.SITES_BUCKET.put("sitesrc/" + slug + ".json", JSON.stringify({ files, uid: rvUser.id }), { httpMetadata: { contentType: "application/json" } }); } catch {}
          await archiveBuild(env, slug, dist); // keep a rollback snapshot of this revision
          let backend = false;
          if (schemaSpec && d1Configured(env)) {
            emit({ ev: "phase", phase: "database" });
            try { const dbid = await ensureSiteBackend(env, slug, rvUser.id); await applySiteSchema(env, dbid, schemaSpec); backend = true; }
            catch (e) { console.error("react-revise backend provision failed:", e && e.message, e && e.detail); }
          }
          emit({ ev: "done", url: "/s/" + slug + "/", slug, files: Object.keys(dist), buildMs, fixed: attempt, cost: genCredits + imgCredits, balance: balAfter, revised: true, backend });
        } catch (e) {
          if (e && e.status) console.error("react-revise gen failed:", e.status, e.detail);
          else console.error("react-revise failed:", e && e.message);
          emit({ ev: "error", msg: "the edit hit a problem — try again in a moment" });
        } finally { try { await writer.close(); } catch {} }
      };
      ctx.waitUntil(run());
      return new Response(readable, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
    }
    if (url.pathname === "/api/site" && request.method === "POST") {
      // Builder engine = Claude Sonnet 5 (owner's call 2026-07-20, replacing
      // Gemini Flash): the same model class Lovable runs on — much stronger design
      // + code quality, and on the owner's Anthropic key (far higher limits than
      // the Gemini free/Tier-1 quota that was throwing 429/503). The internal
      // helper is still named geminiCall to avoid churn across all its call sites.
      const CLAUDE_MODEL = "claude-sonnet-5";
      // The single-file contract both models must obey. Forms stay inert
      // (action="#") until the hosting/backend phase wires real endpoints.
      const SITE_RULES = "HARD OUTPUT RULES: Output exactly ONE complete single-file HTML document (<!doctype html> … </html>) and NOTHING else — no markdown fences, no commentary before or after. All CSS lives in one <style> block in <head>; small vanilla JS in one <script> block before </body> when the design needs it (nav, reveals-on-scroll, tabs, a testimonial slider, smooth scroll). TYPOGRAPHY: you MAY (and should) load real fonts from Google Fonts via a <link> to fonts.googleapis.com in <head> — pick fonts with real character, never leave it on the system default. That link is the ONLY external resource you load directly: NO CDN scripts/frameworks/icon-fonts. For PHOTOGRAPHY, use the data-gen <img> placeholder protocol (the platform generates and hosts each image, then fills its src) — never hotlink an external image URL yourself. For everything else (textures, icons, logos, decorative shapes, patterns) use CSS gradients/meshes, CSS shapes, and hand-written inline SVG. Fully responsive down to 360px (fluid clamp() type, no fixed widths that overflow). Semantic landmarks (<header> <nav> <main> <section> <footer>), alt/aria on meaningful svg, visible focus states, <meta name=viewport>, a real <title> and <meta name=description>. Respect prefers-reduced-motion. NEVER-BLANK RULE (CRITICAL — a page that is empty on load is a total failure): ALL content MUST be visible with CSS alone — JavaScript is ENHANCEMENT ONLY. NEVER start sections/hero/text at opacity:0, visibility:hidden, transform, or display:none and rely on JS (scroll-reveal / IntersectionObserver) to reveal them — if that JS is slow, deferred, or throws, the page stays BLANK forever. For entrance or scroll animations do ONE of: (a) a pure-CSS animation/transition that plays on load (no JS gate), OR (b) gate the hidden state on a class you add to the <html> element in the VERY FIRST inline <script> in <head> (document.documentElement.className+=' js') and scope every hidden/pre-animation rule under that class (e.g. .js .reveal{opacity:0;transform:translateY(20px)} .reveal{opacity:1}) so that with no-JS or broken-JS the content is fully visible. Wrap any non-trivial JS in try/catch so a single error can never blank the page. Verify mentally: with JavaScript disabled, is every headline, section, and image still visible? It MUST be. INTERACTIONS MUST ACTUALLY WORK (critical — a dead button reads as broken): wire EVERY interactive element with vanilla JS in the single <script>. Give sections ids; every in-page nav link and CTA button uses href=\"#id\" and smooth-scrolls to its target. The mobile/hamburger menu and any tabs, accordions, FAQ, or sliders must genuinely open/switch. SITE CONTEXT — define ONCE at the very top of your single <script> and use everywhere: function siteSlug(){return (window.__SITE_SLUG__)||(location.pathname.match(/^\\/s\\/([^\\/]+)/)||[])[1]||'';} and a storage helper that never throws (so accounts work in the sandboxed live-preview too): var store={_m:{},get:function(k){try{return localStorage.getItem(k)}catch(e){return this._m[k]||null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){this._m[k]=v}},del:function(k){try{localStorage.removeItem(k)}catch(e){delete this._m[k]}}}; — use siteSlug() wherever a slug is needed and store for the session token. FORMS: on submit, preventDefault, collect the fields into an object, and fire-and-forget POST them as JSON to /api/site/form with body {slug:siteSlug(), form:'<a short name for this form e.g. waitlist/contact>', data:{field:value,…}} (ignore the response) — this saves the submission for the site owner on the live site. Then ALWAYS show the inline success state (e.g. swap the form for a \"You're on the list ✓\" confirmation). Add a visually-hidden honeypot input named \"_hp\" (aria-hidden, off-screen) — if it's filled, skip the POST. Never real-submit to an external URL, never leave a dead form. Buttons that imply an action either scroll to the relevant section or trigger a small JS affordance. NO dead buttons, NO placeholder '#' links that go nowhere. Every hover/focus state is visible. ACCOUNTS / LOGIN (REAL — this platform provides a real auth backend, so NEVER fake it): if the site needs sign-up / log-in / a members-only area, wire it to the REAL endpoints — do NOT build a pretend login or an ungated 'dashboard'. Use the shared token key K='zephyr_site_auth_'+siteSlug(). SIGN-UP form → fetch('/api/site/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:siteSlug(),email,password})}); LOG-IN form → POST /api/site/auth/login with the same body. Parse the JSON: on {ok:true} do store.set(K,json.token) then redirect to the member area (e.g. location.href='/dashboard'); on {ok:false} show json.error inline by the form. Require the password field minlength 8 and include the hidden _hp honeypot on these forms too. Every MEMBER-ONLY / dashboard / account page MUST guard on load: var t=store.get(K); if(!t){location.replace('/login')} else fetch('/api/site/auth/me',{headers:{Authorization:'Bearer '+t}}).then(r=>r.json()).then(d=>{if(!d.ok)throw 0; /* reveal page + show d.email */}).catch(()=>{store.del(K);location.replace('/login')}); — NEVER render member content without this real check. A LOG-OUT control does store.del(K) then goes home. Show the member's REAL email from /api/site/auth/me — never invent fake names, fake stats, or fake 'logged in as' data. NEVER put a password field in a form that POSTs to /api/site/form. (Accounts only work on the PUBLISHED site; in preview SLUG is '' and the endpoint replies that it isn't live yet — surface that message, don't fake success.) PASSWORD RESET (REAL — forgot-password by email; only works if the owner has wired email, see below): if the login area needs a 'Forgot password?' flow, build TWO pieces. (1) A FORGOT-PASSWORD form (email field + hidden _hp honeypot) that POSTs to /api/site/auth/reset-request: fetch('/api/site/auth/reset-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:siteSlug(),email})}); it ALWAYS resolves ok (never reveals whether the account exists), so on ANY response show the SAME neutral confirmation — 'If that email has an account, we've sent a reset link.' — never a 'no such user' error. (2) A RESET page at path '/reset' that on load reads the token from the URL (var token=new URLSearchParams(location.search).get('token')) — if there's no token show 'This link is invalid.', otherwise show a new-password form (password minlength 8 + confirm) that POSTs to /api/site/auth/reset: fetch('/api/site/auth/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password})}).then(r=>r.json()).then(d=>{if(d.ok){store.set('zephyr_site_auth_'+siteSlug(),d.token);location.href='/dashboard'}else{/* show d.error inline, e.g. link expired/used */}}); on success the returned d.token is a fresh session — store it under the same K key and send them into the member area. The reset link the visitor receives points to https://<this-site>/s/<slug>/reset?token=… so the '/reset' page MUST exist. IMPORTANT — email is REQUIRED for this to work: the reset email is sent through the SITE OWNER's OWN provider, so TELL the user they must add EMAIL_FROM (a from-address on a domain they've verified) plus a provider key (RESEND_KEY, or SENDGRID_KEY / POSTMARK_KEY) in Cloud → Secrets — with no email configured the request still succeeds silently but no link is ever sent. LIVE MAP (REAL): for a location / 'find us' / directions section with a real address, embed a REAL interactive map with an <iframe> — this iframe is the ONE allowed exception to the no-embeds rule. Use OpenStreetMap (no API key): <iframe title=\"Map\" loading=\"lazy\" style=\"border:0;width:100%;height:380px\" src=\"https://www.openstreetmap.org/export/embed.html?bbox=LON1,LAT1,LON2,LAT2&layer=mapnik&marker=LAT,LON\"></iframe> where the marker is the address's approximate lat/lon and the bbox spans ~0.004° around it, plus a 'View larger map' link to openstreetmap.org. NEVER fake a map with a static image or an empty box when a real address is given. DATABASE / COLLECTIONS (REAL — public, displayable data the site both SAVES and SHOWS: testimonials/reviews walls, menus, guestbooks, listings, anything a visitor submits AND everyone sees; NOT for private/sensitive captures — those go to /api/site/form). To SAVE a record: fetch('/api/site/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:siteSlug(),collection:'<name, e.g. reviews>',data:{field:value,…}})}) (fire-and-forget; include the hidden _hp honeypot; then show the inline success state). To DISPLAY records: fetch('/api/site/data?slug='+encodeURIComponent(siteSlug())+'&collection=<name>').then(r=>r.json()).then(d=>{(d.records||[]).forEach(function(rec){ /* render rec.data — escape text before inserting */ });}); run it on page load to populate the list. Records are PUBLIC and newest-first (cap 100). QUERY on the SERVER for anything beyond a short latest-N list (filtering/sorting/searching/paging a real dataset like listings): add params to the GET — where=<field>:<op>:<value> (REPEATABLE; op = eq|ne|lt|lte|gt|gte|contains|in; numeric ops compare as numbers, so where=price:lte:2000000&where=beds:gte:3&where=city:eq:Miami), q=<text> (free-text across all string fields), sort=<field>&order=asc|desc, and limit(≤100)+offset for paging. The response then also carries {total} (the matched count, for \"X results\" / pagination) alongside {records}. Example: fetch('/api/site/data?slug='+encodeURIComponent(siteSlug())+'&collection=listings&where=beds:gte:3&where=price:lte:2000000&sort=price&order=asc&limit=12'). Build filter UIs (dropdowns, price sliders, a search box) that re-fetch with these params rather than fetching everything and filtering in the browser. Use collections for content the visitor both adds and sees; keep anything private in /api/site/form. EDGE FUNCTIONS / SERVER LOGIC (REAL — for custom backend behavior the primitives above don't cover: calling a THIRD-PARTY API with a saved key (Slack/Discord webhook, Stripe, an LLM API, a mailing service), computing/aggregating collection data, or a multi-step 'on submit do A then B'). Do NOT fake server logic in front-end JS, and NEVER hardcode an API key in the page — DECLARE a function instead. Put a spec block in <head>: <script type=\"application/isibi-fn\" data-name=\"notify-signup\">{\"steps\":[ … ]}</script> (data-name is a unique short id, letters/numbers/dash). Each step is exactly ONE of: {\"do\":\"read\",\"collection\":\"reviews\",\"limit\":20,\"as\":\"list\"} → reads public collection records, then {{steps.list.records}} / {{steps.list.count}} are available; {\"do\":\"save\",\"collection\":\"signups\",\"data\":{\"email\":\"{{input.email}}\"}} → saves a record; {\"do\":\"fetch\",\"url\":\"https://api.example.com/x\",\"method\":\"POST\",\"headers\":{\"Authorization\":\"Bearer {{secret.API_KEY}}\",\"Content-Type\":\"application/json\"},\"body\":{\"text\":\"{{input.msg}}\"},\"as\":\"api\"} → calls an external HTTPS API, then {{steps.api.status}} / {{steps.api.body}} are available; {\"do\":\"respond\",\"data\":{\"ok\":true}} → the JSON the browser receives back. TEMPLATES: {{input.x}} = the caller's input; {{steps.<as>.<path>}} = an earlier step's output; {{secret.NAME}} = a saved secret, resolved SERVER-SIDE and injected ONLY into fetch (url/headers/body) — it is NEVER sent to the browser, so every real API key goes in {{secret.NAME}} (the owner adds the value in Cloud → Secrets), never inline. Limits: ≤8 steps, ≤2 fetch per function. CALL a function from your page JS: fetch('/api/site/fn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:siteSlug(),fn:'notify-signup',input:{email:val}})}).then(function(r){return r.json()}).then(function(d){ /* d is your respond data */ }). TRIGGERS (beyond your page calling it): (1) SCHEDULE — add \"schedule\":{\"everyMinutes\":60} at the top level of the spec (sibling of \"steps\"; min 5, 60=hourly, 1440=daily) and the function runs on a timer with input {scheduled:true} — perfect for a daily digest, a cleanup, or a periodic fetch, no page needed; (2) WEBHOOK — an outside service (Stripe, Zapier, a form/webhook tool) can POST its own JSON to https://<this-site>/api/site/hook/<slug>/<function-name> and the ENTIRE POST body becomes the function's input; the owner copies that URL from Cloud → Edge functions and pastes it into the other service. PAYMENTS (REAL — sell a product/booking with Stripe Checkout using the SITE OWNER's OWN Stripe account): a BUY button calls a function with steps [{\"do\":\"checkout\",\"secret\":\"STRIPE_KEY\",\"amount\":<price in the smallest unit — cents, so 2999 = $29.99>,\"currency\":\"usd\",\"name\":\"<product name>\",\"quantity\":1,\"success_url\":\"https://<this-site>/thanks\",\"cancel_url\":\"https://<this-site>/\",\"as\":\"s\"},{\"do\":\"respond\",\"data\":{\"url\":\"{{steps.s.url}}\"}}]; the button's JS calls it via /api/site/fn then redirects location.href=res.url. amount may be dynamic ({{input.amount}}); for a subscription set \"mode\":\"subscription\" and \"interval\":\"month\". The owner adds their Stripe SECRET key as the secret named STRIPE_KEY in Cloud → Secrets — TELL the user to do this (never hardcode a key). TO RECORD PAID ORDERS, also declare a WEBHOOK function with \"verify\":\"stripe\" at the top of the spec plus a step {\"do\":\"save\",\"collection\":\"orders\",\"data\":{\"email\":\"{{input.data.object.customer_details.email}}\",\"amount\":\"{{input.data.object.amount_total}}\",\"session\":\"{{input.data.object.id}}\"}}; the owner pastes that function's webhook URL into Stripe (Dashboard → Developers → Webhooks) sending ONLY the checkout.session.completed event and adds their Stripe webhook signing secret as the secret STRIPE_WEBHOOK_SECRET — isibi verifies Stripe's signature so a forged call can never record a fake order. EMAIL (REAL — send email from the SITE OWNER's OWN email provider: a welcome email on signup, a 'new submission' alert to the owner, an order receipt): use an email step {\"do\":\"email\",\"provider\":\"resend\",\"secret\":\"RESEND_KEY\",\"from\":\"you@yourdomain.com\",\"to\":\"{{input.email}}\",\"subject\":\"Welcome!\",\"html\":\"<h1>Thanks for joining</h1>\",\"as\":\"m\"}. provider is resend | sendgrid | postmark (default resend); the owner adds THEIR provider API key in Cloud → Secrets under the name you reference (e.g. RESEND_KEY) and 'from' must be an address on a domain they've verified in that provider — TELL the user both. from/to/subject/html support {{templates}}. To EMAIL THE OWNER when a contact form is submitted, wire that form to a FUNCTION (save the message to a collection, then email the owner's address) instead of /api/site/form. Never hardcode an email key in the page. Use a function ONLY when the primitives above don't fit — for plain public save+show use collections, for a private capture use /api/site/form. FILE UPLOADS (REAL — let a visitor upload an image or PDF: a listing photo, an avatar, a resume): give an <input type=\"file\" accept=\"image/*,application/pdf\">; on change, read the file as a data URL and POST it — var rd=new FileReader();rd.onload=function(){fetch('/api/site/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:siteSlug(),name:f.name,data:rd.result})}).then(function(r){return r.json()}).then(function(res){if(res.url){/* show it: img.src=res.url — AND to KEEP it, save res.url into a collection via /api/site/data, e.g. a listing record {photo:res.url,…} */}else{/* show res.error inline */}})};rd.readAsDataURL(f); — the response {url} is a PERMANENT public link to the file. Images (PNG/JPG/WebP/GIF) and PDF only, ≤6MB. NEVER upload to an external service. An uploaded file the site never references is orphaned, so ALWAYS persist res.url into a collection (or a form/profile) to keep it. Uploads need the site to have a slug (live or preview-draft); if siteSlug() is empty, tell the user it isn't ready instead of faking success. GENERAL HONESTY: never ship UI that pretends to do something it can't — if a capability truly isn't supported, degrade honestly (a clear 'coming soon' or a real waitlist via /api/site/form) instead of faking it.";
      const stUser = await authUser(request);
      if (!stUser) return UNAUTHED();
      if (!env.ANTHROPIC_API_KEY) {
        return Response.json({ error: "site engine not configured" }, { status: 501 });
      }
      const tlS = tooLargeBody(request, 1_000_000); if (tlS) return tlS;
      let body;
      try { body = await request.json(); } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400 });
      }
      const step = body.step === "revise" ? "revise" : "build";
      const brief = typeof body.brief === "string" ? body.brief.trim().slice(0, 4000) : "";
      const instruction = typeof body.instruction === "string" ? body.instruction.trim().slice(0, 2000) : "";
      const curHtml = typeof body.html === "string" ? body.html.slice(0, 400000) : "";
      // The whole site's pages (revise only) — needed for site-wide ops (global
      // edit / add page / remove page / regenerate). Each: {path,name,html}.
      const sitePagesIn = Array.isArray(body.pages)
        ? body.pages.filter((p) => p && typeof p.path === "string" && typeof p.html === "string")
            .slice(0, 8).map((p) => ({ path: p.path.slice(0, 40), name: (typeof p.name === "string" ? p.name : p.path).slice(0, 60), html: p.html.slice(0, 400000) }))
        : [];
      if (step === "build" && !brief) return Response.json({ error: "no brief" }, { status: 400 });
      if (step === "revise" && (!instruction || !curHtml)) return Response.json({ error: "no instruction" }, { status: 400 });
      // Real-money engine calls, directly callable → a daily cap BEFORE the
      // charge (same stance as research: a capped user is told, not debited).
      if (!(await useQuota(request, "site", 40))) return QUOTA_EXCEEDED();
      // Metered billing (owner 2026-07-18): charge the ACTUAL cost, and charge
      // ONLY AFTER each step succeeds — so nothing is ever reserved or refunded
      // (this replaced a reserve→credit_back model whose refund undercounted,
      // since credit_back caps at 10/call). gemini-3.5-flash = $1.50/M in, $9/M
      // out (flat; output incl. thinking); each Nano Banana Pro image = $0.15;
      // 1 credit = $0.008. We pre-check the balance covers a worst-case build,
      // run it, then debit the measured Gemini cost + each generated image.
      const CREDIT_USD = 0.008, MAX_OUT_TOK = 20000, SITE_MAX_IMAGES = 6; // site-wide image cap (across all pages)
      const IMG_CREDITS = Math.max(1, Math.ceil(SITE_IMG_USD / CREDIT_USD));
      const auth = request.headers.get("Authorization") || "";
      // Metered at Claude Sonnet 5 rates ($3/M input, $15/M output) so the builder
      // charge covers the real API spend (was Gemini Flash rates).
      const toCredits = (inTok, outTok) => Math.max(1, Math.ceil((inTok * 3e-6 + outTok * 15e-6) / CREDIT_USD));
      // Upper bound: the payload we already hold (~4 chars/token) + the output cap.
      const estInTok = Math.ceil((((step === "build" ? brief : instruction + curHtml) || "").length + 1800) / 4);
      const estGemMax = toCredits(estInTok, MAX_OUT_TOK);
      let stBalance;
      try {
        stBalance = await readCredits(auth);
      } catch {
        return Response.json({ error: "site engine unavailable" }, { status: 503 });
      }
      // Need enough for the worst-case Gemini pass up front (images are charged
      // as-generated below, capped to whatever's left — never overspent).
      if (!(stBalance >= estGemMax)) {
        return Response.json({ error: "not enough credits", need: "credits" }, { status: 402 });
      }
      // Attached images (logo / product photo / design reference): host each in
      // R2 (so the generator can EMBED it as a real <img>) AND keep the base64 to
      // show Gemini's VISION (so it can match a reference). ≤3 images, ≤5MB each.
      const assetSiteId = typeof body.siteId === "string" ? body.siteId.slice(0, 80) : "";
      let imageParts = [], assetUrls = [];
      {
        const rawImages = Array.isArray(body.images) ? body.images.slice(0, 3) : [];
        const A_MIME = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp", "image/gif": "gif" };
        for (const im of rawImages) {
          const m = im && typeof im.data === "string" ? im.data.match(/^data:([^;,]+);base64,(.+)$/s) : null;
          if (!m) continue;
          const mime = m[1].toLowerCase(), ext = A_MIME[mime]; if (!ext) continue;
          let bytes; try { const bin = atob(m[2]); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); } catch { continue; }
          if (bytes.length > 5_000_000) continue;
          imageParts.push({ type: "image", source: { type: "base64", media_type: mime, data: m[2] } });
          if (env.SITES_BUCKET && assetSiteId) {
            const id = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
            const key = "assets/" + assetSiteId + "/" + id + "." + ext;
            try { await env.SITES_BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } }); assetUrls.push("https://isibi.ai/a/" + assetSiteId + "/" + id + "." + ext); } catch {}
          }
        }
      }
      const assetLine = (imageParts.length)
        ? " ATTACHED IMAGES: the user attached " + imageParts.length + " image(s)" + (assetUrls.length ? ", hosted at these EXACT urls: " + assetUrls.join(", ") : "") + " — and you can SEE them below. If an image is a LOGO or a product/photo the user wants ON the site, EMBED it with a real <img src=\"<that exact hosted url>\" alt=\"...\"> (logo in the header/footer, product in a hero, etc.). If it's a DESIGN/STYLE reference (a screenshot, a mood board), MATCH its palette, layout and vibe but do NOT embed it. Use the brief/instruction to decide which. Never invent any other external image URL."
        : "";
      let usedInTok = 0, usedOutTok = 0;
      // Builder engine call → Claude Sonnet 5 (Anthropic Messages API). Keeps the
      // (system, user, thinking, imgParts) signature so every build/revise call
      // site is unchanged; `thinking` now just nudges the output ceiling (build
      // "high" gets more room than a surgical "low" edit). Resilient: retries
      // transient 429/500/503/529 (overloaded) AND empty/truncated responses with
      // backoff, and always throws an error carrying the TRUE status so the
      // build's "no pages" error reports the real cause instead of a bare -1.
      const geminiCall = async (system, user, thinking = "low", imgParts = []) => {
        const BACKOFF = [1200, 3000, 6000]; // ms before attempts 2, 3, 4
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
        const maxTok = thinking === "high" ? MAX_OUT_TOK : Math.min(MAX_OUT_TOK, 8000);
        const content = [{ type: "text", text: user }, ...(Array.isArray(imgParts) ? imgParts : [])];
        let lastErr = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          let r;
          try {
            r = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
              body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: maxTok, system, messages: [{ role: "user", content }] }),
              signal: AbortSignal.timeout(180000),
            });
          } catch (netErr) { lastErr = netErr; if (attempt < 3) { await sleep(BACKOFF[attempt]); continue; } throw netErr; }
          // Retryable HTTP (rate-limit / transient overload — 529 = Anthropic "overloaded").
          if (!r.ok && (r.status === 429 || r.status === 500 || r.status === 503 || r.status === 529) && attempt < 3) {
            lastErr = Object.assign(new Error("gen " + r.status), { status: r.status });
            try { await r.body?.cancel(); } catch {}
            await sleep(BACKOFF[attempt]); continue;
          }
          const d = await r.json().catch(() => ({}));
          if (!r.ok) { const e = new Error("gen " + r.status); e.status = r.status; e.detail = JSON.stringify(d).slice(0, 300); throw e; }
          const text = Array.isArray(d.content) ? d.content.filter((b) => b && b.type === "text").map((b) => b.text || "").join("") : "";
          if (!text) {
            lastErr = Object.assign(new Error("empty"), { status: 0, detail: "stop:" + (d.stop_reason || "none") });
            if (attempt < 3) { await sleep(BACKOFF[attempt]); continue; }
            throw lastErr;
          }
          // Success — real usage for metered billing. ACCUMULATE across calls.
          const um = d.usage || {};
          usedInTok += um.input_tokens || 0;
          usedOutTok += um.output_tokens || Math.ceil(text.length / 4);
          console.log("site tokens (cum):", usedInTok, "in /", usedOutTok, "out");
          return text;
        }
        throw lastErr || Object.assign(new Error("gen failed"), { status: -1 });
      };
      // Model output → the bare HTML document (fences stripped, prose cut).
      const extractHTML = (s) => {
        let t = String(s || "").trim().replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "").trim();
        const i = t.search(/<!doctype html|<html[\s>]/i);
        if (i < 0) return "";
        t = t.slice(i);
        const end = t.toLowerCase().lastIndexOf("</html>");
        return end < 0 ? "" : t.slice(0, end + 7);
      };
      // Shared design-director bar (the anti-"AI-slop" rules) used by every page.
      const DESIGN_DIRECTOR =
        "Design like the lead at a world-class studio — award-winning craft, never a template. " +
        "TYPOGRAPHY is the identity (real Google Fonts: a characterful display face + a clean body face, clamp() scale, confident headings — never a system default). " +
        "COLOR: a considered palette — hue-biased neutrals (never pure grey), one restrained accent, grounds that suit the brand; no default purple→blue gradients. " +
        "LAYOUT: editorial and intentional — asymmetry, overlap, generous negative space, a strong grid; NOT everything centered, NOT cookie-cutter equal cards; the hero is a thesis. " +
        "PHOTOGRAPHY: for the hero and up to ~3 more impactful spots on this page, emit <img data-gen=\"<a vivid art-directed photo prompt: subject, light, mood, composition, color grade — on-brand>\" data-ar=\"16:9\" alt=\"...\" class=\"...\"> with NO src (the platform generates + hosts each image and fills its src). data-ar: 16:9/3:2 wide, 4:5/1:1 portrait. Cinematic prompts, not stock. Size in CSS (object-fit:cover) so layout holds. EVERY image MUST depict THIS site's real subject/industry (a real-estate site → homes & interiors; a bakery → bread & the shop) — NEVER off-topic or generic (e.g. no astronauts/space on a property site). For a repeated set of cards that each need a photo (listings, products, gallery, team), write each card as STATIC HTML with its OWN <img data-gen=\"…\"> (a distinct, on-subject prompt per card) so the platform fills a fitting image — do NOT build those cards in JS with a hardcoded or placeholder src, and never reuse one image for many different items. Everything else = CSS gradients/mesh + inline SVG. " +
        "DEPTH & MOTION: layered gradients/mesh, subtle grain/texture, fine borders, considered shadows, tasteful scroll-reveal + hover microinteractions (respect prefers-reduced-motion). " +
        "COPY: real, specific, on-brand — never lorem, never 'Welcome to X', never fake 'John D.' testimonials. " +
        "AVOID AI-slop tells: centered-everything, emoji section icons, identical rounded cards, a generic hero→features→pricing→footer, Inter/system-ui as the identity, washed-out purple gradients, no spacing rhythm. Take one real aesthetic risk that fits the brand. " +
        "You are also the engineer: semantic structure, responsive to 360px, accessible (focus/contrast/aria), clean SEO meta, robust guarded JS. ";
      const DESIGN_BAR = DESIGN_DIRECTOR + SITE_RULES;
      // Composed-mode rules: build ONLY this page's <main> (the shared shell adds
      // <head>/nav/footer). The output override precedes SITE_RULES so the
      // full-document mandate inside it doesn't apply; stripToMain also defends.
      const MAIN_RULES = "OUTPUT ONLY this page's MAIN CONTENT: the <main>…</main> element, plus — only if this page needs them — ONE page-scoped <style> and ONE page-scoped <script> placed AFTER </main>. Do NOT output <!doctype>, <html>, <head>, <body>, the site header/nav, or the footer; those are added automatically from the shared shell. Therefore any instruction below to 'output ONE complete single-file HTML document' or to put all CSS in <head> is OVERRIDDEN — output only this page's content fragment, reusing the shared head's classes + :root tokens so it matches every other page exactly. " + SITE_RULES;
      const slug = (s) => "/" + String(s || "page").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
      try {
        // Conversational gate (Lovable-style): a greeting, a question, thanks, or a
        // message too vague to act on gets a CHAT reply — not a credit-heavy
        // build/edit. Biased hard toward acting, so any real brief/change passes.
        // On a revise it ALSO routes the request: an ordinary change edits THIS
        // page (edit); a whole-site change (edit), a "add a … page" (addpage), a
        // "remove/delete the … page" (removepage), or a "redo/redesign this page
        // from scratch" (regenerate) each take a dedicated path.
        let route = { kind: "edit", page: "" };
        {
          const multi = step === "revise" && sitePagesIn.length > 0;
          const pageList = multi ? sitePagesIn.map((p) => p.name + " (" + p.path + ")").join(", ") : "";
          const clsRaw = await geminiCall(
            "You are isibi, a warm, friendly AI website builder. Classify the user's chat message. " +
            (step === "build" ? "They have NO site yet (new project)." : "They already have a site open; a normal request would EDIT the current page.") +
            (multi ? " The site's pages are: " + pageList + ". The page currently open is \"" + (typeof body.path === "string" ? body.path : "/") + "\"." : "") +
            " Return ONLY minified JSON: {\"act\":true|false,\"reply\":\"\"" + (multi ? ",\"kind\":\"edit|global|addpage|removepage|regenerate\",\"page\":\"\"" : "") + "}. act=true = the message is an ACTIONABLE request to build or change the site (it names a site, a business/purpose, or a concrete change) → reply empty. act=false ONLY for a pure greeting (\"hey\"), thanks, small talk, or a question/too-vague message with nothing to act on → reply = a short warm 1-2 sentence answer: for a new project, invite them to describe the site with a concrete example (e.g. \"a landing page for my coffee shop with the menu and hours\"); for a question, answer briefly then nudge toward what to build or change. When unsure, prefer act=true." +
            (multi ? " When act=true, also set kind: \"edit\" for a normal change to the CURRENTLY-OPEN page (the default — use this whenever unsure); \"global\" for a change the user wants applied to the WHOLE site / EVERY page (e.g. the shared header, footer, nav, fonts, or colors, or phrases like 'on every page', 'across the site', 'all pages'); \"addpage\" to ADD a brand-new page (e.g. 'add a contact page', 'create a blog', 'I need an about page') — set page to a SHORT name for it (e.g. 'Contact'); \"removepage\" to DELETE an existing page — set page to that page's name or path; \"regenerate\" to REDO/REDESIGN/START-OVER the current page (or a named page) from scratch — set page to the page name/path if they named one, else empty. page is \"\" for edit and global." : ""),
            "User message: " + (step === "build" ? brief : instruction), "low"
          );
          let cls = null;
          try { const j = clsRaw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim(); cls = JSON.parse(j.slice(j.indexOf("{"), j.lastIndexOf("}") + 1)); } catch {}
          if (cls && cls.act === false && typeof cls.reply === "string" && cls.reply.trim()) {
            const gc = toCredits(usedInTok, usedOutTok);
            let ba = stBalance; try { const b = await useCredits(auth, gc); if (b >= 0) ba = b; } catch {}
            return Response.json({ chat: cls.reply.trim().slice(0, 600), cost: gc, balance: ba });
          }
          if (multi && cls && typeof cls.kind === "string" && ["edit", "global", "addpage", "removepage", "regenerate"].includes(cls.kind)) {
            route = { kind: cls.kind, page: typeof cls.page === "string" ? cls.page.slice(0, 60).trim() : "" };
          }
        }
        if (step === "build") {
          // #4 — stream the build as NDJSON so the chat shows live progress
          // (planning → each page → photos) instead of one static "Building…".
          // The final {ev:"done"} line carries the exact payload the JSON build
          // returned; {ev:"error"} replaces the 502. ctx.waitUntil keeps the async
          // writer alive after the handler returns the (still-open) stream.
          const enc = new TextEncoder();
          const { readable, writable } = new TransformStream();
          const writer = writable.getWriter();
          const emit = (o) => writer.write(enc.encode(JSON.stringify(o) + "\n")).catch(() => {});
          const run = async () => {
           try {
            await emit({ ev: "status", phase: "plan", msg: "Planning your site…" });
          // Phase 1 — plan the sitemap + a shared design system so all pages match.
          const planRaw = await geminiCall(
            "You are the creative director + information architect for a client's new website (the platform you run on is called isibi, but that is NEVER the client's brand — do not name the site 'isibi'). From the brief, plan the site. Decide how many PAGES it genuinely needs — a simple landing is ONE page (path \"/\"); a richer brand may warrant a few (e.g. Home, Menu, About, Contact). Do NOT pad — only real pages the brief justifies. Pick ONE exact brand/company NAME for the site (invent a fitting, specific one if the brief doesn't give one) — this same name is the logo/wordmark on every page. Then define ONE shared design system every page will follow so the site reads as one brand. Return ONLY minified JSON (no prose, no fences): {\"brand\":\"<the site's exact brand/company name — NOT 'isibi'>\",\"pages\":[{\"path\":\"/\",\"name\":\"Home\",\"purpose\":\"...\"}],\"design\":\"<one tight paragraph: the art direction, exact palette hex values, the Google Font pairing (display + body by name), the voice/tone, and 2-3 signature visual motifs — concrete enough that every page matches. State the PHOTOGRAPHY subject/style for this specific industry (e.g. a real-estate site shows homes/interiors — never off-topic stock).>\",\"head\":\"<the COMPLETE shared <head> INNER html the WHOLE site reuses verbatim: the Google Fonts <link>, then a <style> with :root{ exact --color and --font tokens } + a CSS reset + base typography + the HEADER/NAV styles + FOOTER styles + button/link styles + container & layout utilities + shared component classes — thorough enough that each page adds only a little page-specific CSS. Style the ACTIVE nav link with an aria-current=page attribute selector. Do NOT put <title> or <meta name=description> here (added per page).>\",\"nav\":\"<the exact shared <header>...</header> markup reused verbatim on every page: the brand wordmark (the brand name above) and nav links to EVERY page by path (href=/ , href=/listings , ...), using the classes defined in head>\",\"footer\":\"<the exact shared <footer>...</footer> markup reused verbatim on every page, using the classes defined in head>\"}. Every page will REUSE your head + nav + footer verbatim and only add its own <main>, so make those three complete, valid, and self-consistent. Max 5 pages. Home is always first with path \"/\"." + assetLine,
            "Brief:\n" + brief, "high", imageParts
          );
          let plan = null;
          try { const j = planRaw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim(); plan = JSON.parse(j.slice(j.indexOf("{"), j.lastIndexOf("}") + 1)); } catch {}
          const seen = new Set();
          let planned = ((plan && Array.isArray(plan.pages)) ? plan.pages : []).filter((p) => p && p.name).slice(0, 5)
            .map((p, i) => ({ path: i === 0 ? "/" : (String(p.path || "").startsWith("/") ? String(p.path).slice(0, 32) : slug(p.name)), name: String(p.name).slice(0, 40), purpose: String(p.purpose || "").slice(0, 300) }))
            .filter((p) => !seen.has(p.path) && seen.add(p.path));
          if (!planned.length) planned = [{ path: "/", name: "Home", purpose: "the single landing page" }];
          let brand = String((plan && plan.brand) || "").replace(/\s+/g, " ").trim().slice(0, 60);
          if (/^isibi$/i.test(brand)) brand = ""; // never let the platform name leak as the site brand
          const design = (brand ? "BRAND NAME (use this EXACT name as the logo/wordmark on every page): " + brand + ". " : "") + String((plan && plan.design) || "").slice(0, 4000);
          // #3 shared chrome: if the plan produced a usable kit (head+nav+footer),
          // build in COMPOSED mode — each page contributes only its <main> and we
          // assemble the doc, so the header/footer/palette are byte-identical on
          // every page. Otherwise fall back to full-page generation.
          const kitHead = String((plan && plan.head) || "").slice(0, 16000);
          const kitNav = String((plan && plan.nav) || "").slice(0, 8000);
          const kitFooter = String((plan && plan.footer) || "").slice(0, 8000);
          const composed = kitHead.length > 300 && /<style[\s>]/i.test(kitHead) && /<(header|nav)[\s>]/i.test(kitNav) && /<footer[\s>]/i.test(kitFooter);
          // Cap page COUNT to what the balance affords (estPageMax generously covers
          // one page's Gemini cost; the pre-check already guaranteed ≥ one page).
          const estPageMax = toCredits(Math.ceil((design.length + brief.length + 2000) / 4), MAX_OUT_TOK);
          const pagesToBuild = planned.slice(0, Math.max(1, Math.min(planned.length, Math.floor(stBalance / estPageMax))));
          const navList = pagesToBuild.map((p) => p.name + " (" + p.path + ")").join(", ");
          await emit({ ev: "status", phase: "design", pages: pagesToBuild.map((p) => p.name), msg: "Designing " + pagesToBuild.length + (pagesToBuild.length > 1 ? " pages" : " page") + "…" });
          // Phase 2 — generate every page in parallel. COMPOSED: each page returns
          // only its <main>, assembled onto the shared shell (byte-identical chrome).
          // FALLBACK: each page returns a full document matching the design paragraph.
          const buildOnePage = async (pg) => {
            if (composed) {
              const frag = stripToMain(await geminiCall(
                "You are a world-class designer + front-end engineer building the MAIN content of ONE page of a client's website. " + MAIN_RULES + "\n\nSHARED DESIGN SYSTEM (match it exactly):\n" + design + (brand ? "\nBrand (already rendered in the shared header/footer): " + brand + "." : "") + "\n\nSHARED <head> — its classes and :root tokens are AVAILABLE to you; REUSE them, do NOT redefine them:\n" + kitHead + "\n\nSHARED header/nav (added ABOVE your content automatically — do NOT repeat it):\n" + kitNav + "\n\nSHARED footer (added BELOW your content automatically — do NOT repeat it):\n" + kitFooter + assetLine + " " + DESIGN_DIRECTOR,
                "Build the MAIN content for the \"" + pg.name + "\" page (path " + pg.path + "). Its purpose: " + pg.purpose + "\n\nThe overall brief:\n" + brief, "high"
              ));
              if (!frag) return null;
              return { path: pg.path, name: pg.name, html: composeSitePage((pg.path === "/" ? (brand || pg.name) : pg.name + (brand ? " · " + brand : "")), pg.purpose, kitHead, kitNav, kitFooter, frag, pg.path) };
            }
            const h = extractHTML(await geminiCall(
              "You are a world-class designer + front-end engineer building ONE page of a client's multi-page website as a COMPLETE single-file HTML document that matches this shared DESIGN SYSTEM exactly (same brand name, fonts, palette, nav, footer, voice) so every page reads as ONE brand:\n" + design + assetLine + (brand ? "\n\nThe brand/logo on EVERY page is EXACTLY \"" + brand + "\" — render that same wordmark in the header and footer; never invent a different name from page to page, and NEVER use \"isibi\" (that is the builder platform, not this client's site)." : "") + "\n\nThe site's pages are: " + navList + ". Put the SAME nav on this page linking to EVERY page by its path (href=\"/\", href=\"/menu\", …), the current page marked active, and the SAME footer. " + DESIGN_BAR,
              "Build the \"" + pg.name + "\" page (path " + pg.path + "). Its purpose: " + pg.purpose + "\n\nThe overall brief:\n" + brief, "high"
            ));
            return h ? { path: pg.path, name: pg.name, html: h } : null;
          };
          // Generate every page in parallel, with ONE retry if a page comes back
          // empty/errored — so a single Gemini hiccup never silently drops a page.
          let lastPageErr = null;
          const built = (await Promise.all(pagesToBuild.map(async (pg) => {
            for (let attempt = 0; attempt < 2; attempt++) {
              try { const r = await buildOnePage(pg); if (r) { emit({ ev: "page", name: pg.name }); return r; } }
              catch (e) { lastPageErr = e; console.log("site page failed", pg.path, "attempt", attempt, e && e.message, e && e.detail); }
            }
            return null;
          }))).filter(Boolean);
          // Surface the REAL underlying cause (rate-limit 429 / empty-0 / http)
          // instead of a bare -1, so a persistent failure is diagnosable.
          if (!built.length) { const e = new Error("build returned no pages"); e.status = (lastPageErr && lastPageErr.status != null) ? lastPageErr.status : -1; e.detail = lastPageErr && lastPageErr.detail; throw e; }
          await emit({ ev: "status", phase: "photos", msg: "Adding photos + finishing touches…" });
          // Validate → auto-fix each page BEFORE charging (so the fix's tokens are
          // billed and the fixed page is what we image + ship). One pass, only for
          // real defects — clean pages skip it and cost nothing extra.
          const validPaths = pagesToBuild.map((p) => p.path);
          await Promise.all(built.map(async (pg) => {
            const issues = validateSiteHtml(pg.html, validPaths);
            if (!issues.length) return;
            try { const fx = await autoFixSiteHtml(pg.html, issues, geminiCall, assetLine, extractHTML); if (fx) pg.html = fx; }
            catch (e) { console.log("site autofix failed", pg.path, e && e.message); }
          }));
          // Charge measured Gemini cost (plan + all pages), then generate images
          // across the WHOLE site within a site-wide budget capped to the balance.
          const gemCredits = toCredits(usedInTok, usedOutTok);
          let balAfter = stBalance;
          try { const b = await useCredits(auth, gemCredits); if (b >= 0) balAfter = b; } catch {}
          let imgBudget = Math.max(0, Math.min(SITE_MAX_IMAGES, Math.floor(balAfter / IMG_CREDITS)));
          let imgCharged = 0;
          for (const pg of built) {
            const inj = await injectSiteImages(pg.html, request, env, stUser.id, imgBudget);
            pg.html = polishHead(inj.html, brand); imgBudget -= inj.charged; imgCharged += inj.charged;
          }
          let imgCredits = 0;
          if (imgCharged > 0) { imgCredits = imgCharged * IMG_CREDITS; try { const b = await useCredits(auth, imgCredits); if (b >= 0) balAfter = b; } catch {} }
          // Give the site a REAL identity NOW (a draft slug + owner row) — the row
          // existing is what /api/site/auth + /api/site/form validate against, so
          // accounts/forms/maps work in the PREVIEW, not only after publish. Pages
          // aren't written to R2 here (a draft isn't publicly served — publish does
          // that); the row is just addressable. Slug is reused on publish (by site_id).
          let draftSlug = "";
          const buildSiteId = typeof body.siteId === "string" ? body.siteId.slice(0, 80) : "";
          if (buildSiteId) {
            try {
              const jwtB = (request.headers.get("Authorization") || "").slice(7);
              const sbH = { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + jwtB };
              const ex = await fetch(`${SUPABASE_URL}/rest/v1/published_sites?site_id=eq.${encodeURIComponent(buildSiteId)}&select=slug&limit=1`, { headers: sbH, signal: AbortSignal.timeout(8000) });
              const rows = await ex.json().catch(() => []);
              if (Array.isArray(rows) && rows[0] && rows[0].slug) draftSlug = rows[0].slug;
              if (!draftSlug) {
                // Slug from the AI-chosen BRAND (e.g. "Veridian Estates" → veridian-
                // estates-ab12cd), not the raw first prompt ("make me a website").
                const base = ((brand || (planned[0] && planned[0].name) || brief).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32)) || "site";
                draftSlug = base + "-" + crypto.randomUUID().slice(0, 6);
                await fetch(`${SUPABASE_URL}/rest/v1/published_sites`, {
                  method: "POST", headers: { ...sbH, Prefer: "return=minimal" },
                  body: JSON.stringify({ user_id: stUser.id, site_id: buildSiteId, slug: draftSlug, title: brand || (planned[0] && planned[0].name) || "site" }),
                  signal: AbortSignal.timeout(8000),
                });
              }
            } catch (e) { console.log("draft identity failed:", e && e.message); draftSlug = ""; }
          }
          // Extract any declared edge functions from every page (strip the spec
          // blocks so they never ship publicly), then persist them for this site.
          { const byName = {}; for (const pg of built) { const ex = extractSiteFunctions(pg.html); pg.html = ex.clean; for (const f of ex.fns) byName[f.name] = f; } const fnList = Object.values(byName); if (draftSlug && fnList.length) await persistSiteFunctions(env, stUser.id, draftSlug, fnList); }
          await emit({ ev: "done", pages: built, design, brand, cost: gemCredits + imgCredits, balance: balAfter, slug: draftSlug });
           } catch (e) {
             console.error("site build stream failed:", e && e.message, "|", e && e.detail);
             try { await emit({ ev: "error", code: (e && e.status != null ? e.status : -1) }); } catch {}
           }
           try { await writer.close(); } catch {}
          };
          ctx.waitUntil(run());
          return new Response(readable, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
        } else {
          // Revise ONE page. SURGICAL by default: the model returns the SMALLEST
          // find/replace edits, which we splice into the existing HTML — so every
          // untouched byte stays identical (no drift, faster, cheaper). Falls back
          // to a full-document rebuild only if not one edit applies.
          const design0 = typeof body.design === "string" ? body.design.slice(0, 4000) : "";
          const curPath = typeof body.path === "string" ? body.path : "/";
          // ── Site-wide operations, routed by the classify gate (all chat-driven, no
          // UI): global edit / add page / remove page / regenerate. Each returns the
          // FULL updated page set as {pages, active}. They only run when the client
          // sent the whole site (sitePagesIn); otherwise everything falls through to
          // the single-page surgical edit below (route.kind stays "edit").
          const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const brandGuess = ((sitePagesIn[0] && sitePagesIn[0].html.match(/<title[^>]*>([^<]*)<\/title>/i)) || [])[1] ?
            String(((sitePagesIn[0].html.match(/<title[^>]*>([^<]*)<\/title>/i)) || [])[1]).split("·").pop().trim().slice(0, 60) : "";
          // Swap in a page's nav block (header or nav) with a new shared nav, marking
          // the active link for that page. Function replacer → no $-substitution bugs.
          const replaceNav = (h, newNav, path) => {
            const marked = markActiveNav(newNav, path);
            if (/<header\b[\s\S]*?<\/header>/i.test(h)) return h.replace(/<header\b[\s\S]*?<\/header>/i, () => marked);
            if (/<nav\b[\s\S]*?<\/nav>/i.test(h)) return h.replace(/<nav\b[\s\S]*?<\/nav>/i, () => marked);
            return h;
          };
          // Shared finisher for the multi-page ops: charge measured Gemini tokens,
          // run the image pass on each page within an affordable site-wide budget,
          // polish heads, persist any declared edge functions, return all pages.
          const shipPages = async (pages, activePath) => {
            const gemCredits = toCredits(usedInTok, usedOutTok);
            let balAfter = stBalance;
            try { const b = await useCredits(auth, gemCredits); if (b >= 0) balAfter = b; } catch {}
            let budget = Math.max(0, Math.min(SITE_MAX_IMAGES, Math.floor(balAfter / IMG_CREDITS))), imgCharged = 0;
            for (const pg of pages) {
              try { const inj = await injectSiteImages(pg.html, request, env, stUser.id, budget); pg.html = polishHead(inj.html, brandGuess); budget -= inj.charged; imgCharged += inj.charged; }
              catch (e) { console.log("site-wide image pass failed:", e && e.message); pg.html = polishHead(pg.html, brandGuess); }
            }
            let imgCredits = 0;
            if (imgCharged > 0) { imgCredits = imgCharged * IMG_CREDITS; try { const b = await useCredits(auth, imgCredits); if (b >= 0) balAfter = b; } catch {} }
            const byName = {};
            for (const pg of pages) { const ex = extractSiteFunctions(pg.html); pg.html = ex.clean; for (const f of ex.fns) byName[f.name] = f; }
            const fnList = Object.values(byName), rsId = typeof body.siteId === "string" ? body.siteId.slice(0, 80) : "";
            if (fnList.length && rsId) {
              try {
                const jwtR = (request.headers.get("Authorization") || "").slice(7);
                const rr = await fetch(`${SUPABASE_URL}/rest/v1/published_sites?site_id=eq.${encodeURIComponent(rsId)}&select=slug&limit=1`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + jwtR }, signal: AbortSignal.timeout(8000) });
                const rows = await rr.json().catch(() => []);
                const rSlug = Array.isArray(rows) && rows[0] ? rows[0].slug : "";
                if (rSlug) await persistSiteFunctions(env, stUser.id, rSlug, fnList);
              } catch (e) { console.log("site-wide fn persist failed:", e && e.message); }
            }
            return Response.json({ pages, active: activePath, cost: gemCredits + imgCredits, balance: balAfter });
          };

          // GLOBAL EDIT — one set of surgical edits, applied to every page. The
          // shared chrome/CSS is byte-identical across pages, so an edit anchored in
          // the current page anchors in all of them.
          if (route.kind === "global" && sitePagesIn.length) {
            const gRaw = await geminiCall(
              "You are a front-end engineer applying a SITE-WIDE change to a client's website — it must apply to EVERY page. Every page shares BYTE-IDENTICAL chrome (the same <head> <style>, the same header/nav, the same footer), so express the change as edits to that SHARED markup or CSS. Return ONLY minified JSON (no prose/fences): {\"edits\":[{\"find\":\"<a substring copied VERBATIM from the HTML below — from the shared header/footer/nav or the shared <style> — long + specific enough to occur EXACTLY ONCE per page>\",\"replace\":\"<the new HTML/CSS for that region>\"}]}. Copy each find character-for-character (same whitespace, same quotes). Change ONLY what's asked; keep the brand name/logo untouched (never rename it, never use \"isibi\"). Stay consistent with the design system" + (design0 ? ":\n" + design0 : ".") + " " + assetLine,
              "Site-wide instruction: " + instruction + "\n\nOne page's full HTML (its shared chrome/CSS is identical on every page):\n\n" + curHtml, "low", imageParts
            );
            let gEdits = [];
            try { const j = gRaw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim(); const o = JSON.parse(j.slice(j.indexOf("{"), j.lastIndexOf("}") + 1)); if (o && Array.isArray(o.edits)) gEdits = o.edits; } catch {}
            const pages = sitePagesIn.map((p) => ({ path: p.path, name: p.name, html: p.html }));
            let totalApplied = 0;
            for (const pg of pages) {
              for (const e of gEdits) {
                if (!e || typeof e.find !== "string" || typeof e.replace !== "string" || !e.find) continue;
                const i = pg.html.indexOf(e.find);
                if (i < 0) continue;
                pg.html = pg.html.slice(0, i) + e.replace + pg.html.slice(i + e.find.length);
                totalApplied++;
              }
            }
            if (totalApplied > 0) return await shipPages(pages, curPath);
            // Nothing anchored → fall through to the single-page edit path below.
          }

          // ADD PAGE — generate the new page's <main> + a complete new shared nav
          // that includes a link to it; swap that nav into every existing page and
          // compose the new page onto the shared shell.
          if (route.kind === "addpage" && sitePagesIn.length) {
            const kit = extractSiteKit(sitePagesIn[0].html) || extractSiteKit(curHtml);
            if (kit) {
              let newName = (route.page || "").replace(/\s+/g, " ").trim().slice(0, 40) || "New Page";
              const existing = new Set(sitePagesIn.map((p) => p.path));
              let newPath = slug(newName), n = 2;
              while (existing.has(newPath) || newPath === "/") { newPath = slug(newName) + "-" + n; n++; }
              const aRaw = await geminiCall(
                "You are a designer + front-end engineer ADDING one brand-new page to a client's existing multi-page website, matching its shared design system EXACTLY (same fonts, palette, voice, components). " + MAIN_RULES + "\n\nSHARED DESIGN SYSTEM:\n" + design0 + "\n\nThe EXISTING shared header/nav is:\n" + kit.nav + "\n\nReturn ONLY minified JSON (no prose/fences): {\"main\":\"<the new page's <main>…</main> fragment (plus, if needed, ONE page-scoped <style>/<script> AFTER </main>), reusing the shared head classes + :root tokens>\",\"nav\":\"<the COMPLETE shared header/nav markup — IDENTICAL to the existing one but with ONE extra nav link added for the new page: href=\\\"" + newPath + "\\\", label styled like the other links, placed in a sensible position>\"}. Keep the brand/logo in the nav exactly as it is (never rename it, never use \"isibi\"). Photos use the data-gen <img> protocol (art-directed on-subject prompt, data-ar, NO src). " + assetLine + " " + DESIGN_DIRECTOR,
                "New page to add: \"" + newName + "\" at path " + newPath + ".\nWhat it's for / the user's request: " + instruction, "high", imageParts
              );
              let aMain = "", aNav = "";
              try { const j = aRaw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim(); const o = JSON.parse(j.slice(j.indexOf("{"), j.lastIndexOf("}") + 1)); if (o) { aMain = typeof o.main === "string" ? o.main : ""; aNav = typeof o.nav === "string" ? o.nav : ""; } } catch {}
              aMain = stripToMain(aMain);
              const newNav = /<(header|nav)\b/i.test(aNav) ? aNav : kit.nav;
              if (aMain) {
                const pages = sitePagesIn.map((p) => ({ path: p.path, name: p.name, html: replaceNav(p.html, newNav, p.path) }));
                const title = newName + (brandGuess ? " · " + brandGuess : "");
                const newHtml = composeSitePage(title, newName, kit.headInner, newNav, kit.footer, aMain, newPath);
                pages.push({ path: newPath, name: newName, html: newHtml });
                return await shipPages(pages, newPath);
              }
            }
            // Couldn't extract a kit or generate the page → fall through to edit.
          }

          // REMOVE PAGE — drop the named page (never home) and strip its nav link
          // from every remaining page.
          if (route.kind === "removepage" && sitePagesIn.length > 1) {
            const key = (route.page || "").toLowerCase().trim();
            const target = sitePagesIn.find((p) => p.path === route.page || p.name.toLowerCase() === key || slug(p.name) === slug(key)) || null;
            if (target && target.path !== "/") {
              const rmA = new RegExp("<li\\b[^>]*>\\s*<a\\b[^>]*href=[\"']" + escRe(target.path) + "[\"'][\\s\\S]*?<\\/a>\\s*<\\/li>", "i");
              const rmB = new RegExp("<a\\b[^>]*href=[\"']" + escRe(target.path) + "[\"'][\\s\\S]*?<\\/a>", "i");
              const remaining = sitePagesIn.filter((p) => p.path !== target.path)
                .map((p) => ({ path: p.path, name: p.name, html: p.html.replace(rmA, "").replace(rmB, "") }));
              return await shipPages(remaining, "/");
            }
            // No removable target → fall through to edit.
          }

          // REGENERATE — rebuild ONE page's <main> from scratch (a fresh take) onto
          // the unchanged shared shell.
          if (route.kind === "regenerate" && sitePagesIn.length) {
            const key = (route.page || "").toLowerCase().trim();
            const target = (route.page && sitePagesIn.find((p) => p.path === route.page || p.name.toLowerCase() === key || slug(p.name) === slug(key)))
              || sitePagesIn.find((p) => p.path === curPath) || { path: curPath, name: (sitePagesIn.find((p) => p.path === curPath) || {}).name || "Page", html: curHtml };
            const kit = extractSiteKit(sitePagesIn[0].html) || extractSiteKit(target.html);
            if (kit) {
              const rMain = stripToMain(await geminiCall(
                "You are a world-class designer + front-end engineer REBUILDING the MAIN content of ONE page of a client's website FROM SCRATCH — a fresh, different take — while keeping the shared design system, header, and footer IDENTICAL. " + MAIN_RULES + "\n\nSHARED DESIGN SYSTEM:\n" + design0 + "\n\nSHARED <head> classes + :root tokens are AVAILABLE; reuse them, don't redefine them:\n" + kit.headInner + assetLine + " " + DESIGN_DIRECTOR,
                "Rebuild the \"" + target.name + "\" page (path " + target.path + ") from scratch. What the user wants: " + instruction, "high", imageParts
              ));
              if (rMain) {
                const title = target.path === "/" ? (brandGuess || target.name) : (target.name + (brandGuess ? " · " + brandGuess : ""));
                const newHtml = composeSitePage(title, target.name, kit.headInner, kit.nav, kit.footer, rMain, target.path);
                let found = false;
                const pages = sitePagesIn.map((p) => { if (p.path === target.path) { found = true; return { path: p.path, name: p.name, html: newHtml }; } return { path: p.path, name: p.name, html: p.html }; });
                if (!found) pages.push({ path: target.path, name: target.name, html: newHtml });
                return await shipPages(pages, target.path);
              }
            }
            // Couldn't rebuild → fall through to edit.
          }

          const editRaw = await geminiCall(
            "You are a front-end engineer editing ONE page of a client's website. Apply the user's instruction with the SMALLEST possible change and do ONLY what is asked — add nothing extra. Return ONLY minified JSON (no prose, no fences): {\"edits\":[{\"find\":\"<a substring copied VERBATIM from the current HTML — long + specific enough to occur EXACTLY ONCE>\",\"replace\":\"<the new HTML for exactly that region>\"}]}. Each find must be an exact character-for-character slice of the current HTML (same whitespace, same quotes). Change ONLY what the instruction requires; keep all other copy, sections, design, nav, footer, and the brand name/logo untouched (never rename the brand, never use \"isibi\"). Keep it consistent with the shared design system" + (design0 ? ":\n" + design0 : ".") + " New photos use the data-gen <img> protocol (art-directed prompt, data-ar, NO src). If — and ONLY if — the instruction is a full redesign, return ONE edit whose find is the entire \"<body …>…</body>\" and replace is the new body. If the current HTML ALREADY fully satisfies the instruction, return {\"edits\":[],\"done\":true} — do NOT invent changes. " + assetLine,
            "Instruction: " + instruction + "\n\nCurrent page HTML:\n\n" + curHtml, "low", imageParts
          );
          let edits = [], alreadyDone = false;
          try { const j = editRaw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim(); const o = JSON.parse(j.slice(j.indexOf("{"), j.lastIndexOf("}") + 1)); if (o) { if (Array.isArray(o.edits)) edits = o.edits; if (o.done === true || o.noop === true) alreadyDone = true; } } catch {}
          let html = curHtml, applied = 0;
          for (const e of edits) {
            if (!e || typeof e.find !== "string" || typeof e.replace !== "string" || !e.find) continue;
            const i = html.indexOf(e.find);
            if (i < 0) continue; // couldn't anchor this edit → skip it
            html = html.slice(0, i) + e.replace + html.slice(i + e.find.length);
            applied++;
          }
          // Already implemented: the model made no edits and flagged it done → return
          // the page UNCHANGED (no wasteful full re-roll, no drift). Only the tiny edit
          // call is billed.
          if (!applied && alreadyDone) {
            const gc = toCredits(usedInTok, usedOutTok);
            let ba = stBalance; try { const b = await useCredits(auth, gc); if (b >= 0) ba = b; } catch {}
            return Response.json({ html: curHtml, path: typeof body.path === "string" ? body.path : "/", cost: gc, balance: ba, noop: true });
          }
          // Fallback: no edit anchored (model didn't copy exact bytes) → full-document
          // rebuild, the previous behavior, so the change still lands.
          if (!applied) {
            html = extractHTML(await geminiCall(
              "You are a designer and front-end engineer editing ONE page of a client's multi-page website. Apply the user's instruction: make EXACTLY the change asked and keep everything else — design, copy, sections, structure, and the site nav/footer — intact unless told otherwise. Keep the brand name/logo EXACTLY as it already appears (never rename it, never use \"isibi\"). Stay consistent with the shared design system" + (design0 ? ":\n" + design0 + "\n" : " (fonts, palette, nav, footer). ") +
              " Keep semantic, accessible, responsive. IMAGES: keep every existing <img src=\"...\"> as-is unless told to change it; if asked for MORE/NEW photos, add them with the data-gen <img> protocol (NO src) — never hotlink. " + assetLine + " " + SITE_RULES,
              "Instruction: " + instruction + "\n\nCurrent page HTML:\n\n" + curHtml, "low", imageParts
            ));
          }
          if (!html) throw new Error("revision returned no document");
          // Validate → auto-fix the edited page BEFORE charging (dead links checked
          // only when the client sent the site's real page paths).
          {
            const issues = validateSiteHtml(html, Array.isArray(body.paths) ? body.paths.filter((p) => typeof p === "string").slice(0, 12) : null);
            if (issues.length) { try { const fx = await autoFixSiteHtml(html, issues, geminiCall, assetLine, extractHTML); if (fx) html = fx; } catch (e) { console.log("revise autofix failed:", e && e.message); } }
          }
          const gemCredits = toCredits(usedInTok, usedOutTok);
          let balAfter = stBalance;
          try { const b = await useCredits(auth, gemCredits); if (b >= 0) balAfter = b; } catch {}
          const affordable = Math.max(0, Math.min(SITE_MAX_IMAGES, Math.floor(balAfter / IMG_CREDITS)));
          let imgCredits = 0;
          try {
            const inj = await injectSiteImages(html, request, env, stUser.id, affordable);
            html = polishHead(inj.html, "");
            if (inj.charged > 0) { imgCredits = inj.charged * IMG_CREDITS; try { const b = await useCredits(auth, imgCredits); if (b >= 0) balAfter = b; } catch {} }
          } catch (e) { console.log("site image pass failed:", e && e.message); }
          // A revision can add/replace edge functions too — extract, strip, persist.
          { const ex = extractSiteFunctions(html); html = ex.clean;
            const reviseSiteId = typeof body.siteId === "string" ? body.siteId.slice(0, 80) : "";
            if (ex.fns.length && reviseSiteId) {
              try {
                const jwtR = (request.headers.get("Authorization") || "").slice(7);
                const rr = await fetch(`${SUPABASE_URL}/rest/v1/published_sites?site_id=eq.${encodeURIComponent(reviseSiteId)}&select=slug&limit=1`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + jwtR }, signal: AbortSignal.timeout(8000) });
                const rows = await rr.json().catch(() => []);
                const rSlug = Array.isArray(rows) && rows[0] ? rows[0].slug : "";
                if (rSlug) await persistSiteFunctions(env, stUser.id, rSlug, ex.fns);
              } catch (e) { console.log("revise fn persist failed:", e && e.message); }
            } }
          return Response.json({ html, path: typeof body.path === "string" ? body.path : "/", cost: gemCredits + imgCredits, balance: balAfter });
        }
      } catch (e) {
        console.error("site engine failed:", e && e.message, "|", e && e.detail);
        // Charge-after model: nothing was debited before this point, so there is
        // nothing to refund. `code` is just a number (upstream HTTP status, or 0
        // for an empty response) for debugging — never names the engine.
        return Response.json({ error: "build failed", code: (e && e.status != null ? e.status : -1) }, { status: 502 });
      }
    }

    // Publish a built site to R2 → live at isibi.ai/s/<slug>. Each page becomes
    // one HTML object; internal nav links are prefixed to the /s/<slug>/ path.
    // The published_sites row (owner + slug + routing) is upserted under the
    // caller's JWT (RLS owner-only). Republishing reuses the same slug/URL.
    // Take a published site offline: delete its R2 objects (pages 404) but keep
    // the ownership row + slug so re-publishing restores the same URL, and member
    // accounts / submissions survive.
    if (url.pathname === "/api/site/unpublish" && request.method === "POST") {
      const uUser = await authUser(request);
      if (!uUser) return UNAUTHED();
      if (!env.SITES_BUCKET) return Response.json({ error: "hosting not configured" }, { status: 501 });
      let ub; try { ub = await request.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
      const uSiteId = typeof ub.siteId === "string" ? ub.siteId.slice(0, 80) : "";
      if (!uSiteId) return Response.json({ error: "no site" }, { status: 400 });
      const ujwt = (request.headers.get("Authorization") || "").slice(7);
      const usb = { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + ujwt, "Content-Type": "application/json" };
      let urow = null;
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/published_sites?site_id=eq.${encodeURIComponent(uSiteId)}&select=slug,pages&limit=1`, { headers: usb, signal: AbortSignal.timeout(10000) });
        const rows = await r.json().catch(() => []);
        urow = Array.isArray(rows) ? rows[0] : null;
      } catch {}
      if (!urow) return Response.json({ ok: true }); // nothing live to take down
      try {
        const keys = Array.isArray(urow.pages) ? urow.pages.map((p) => p && p.key).filter(Boolean) : [];
        for (const k of keys) { try { await env.SITES_BUCKET.delete(k); } catch {} }
      } catch {}
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/published_sites?site_id=eq.${encodeURIComponent(uSiteId)}`, {
          method: "PATCH", headers: { ...usb, Prefer: "return=minimal" },
          body: JSON.stringify({ pages: [], updated_at: new Date().toISOString() }),
          signal: AbortSignal.timeout(10000),
        });
      } catch {}
      return Response.json({ ok: true });
    }
    // Store the current draft page for the workspace preview (served back from
    // /preview/<uid>/<nonce> under the website CSP so the page's inline scripts
    // actually run). Auth'd; one small rolling slot per user (preview/<uid>.html),
    // overwritten each render, so it never accumulates.
    if (url.pathname === "/api/site/preview" && request.method === "POST") {
      const pvUser = await authUser(request);
      if (!pvUser) return UNAUTHED();
      if (!env.SITES_BUCKET) return Response.json({ error: "preview unavailable" }, { status: 501 });
      const tlP = tooLargeBody(request, 4_000_000); if (tlP) return tlP;
      let pb; try { pb = await request.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
      const html = typeof pb.html === "string" ? pb.html : "";
      if (!html || html.length > 3_000_000) return Response.json({ error: "no html" }, { status: 400 });
      try {
        await env.SITES_BUCKET.put("preview/" + pvUser.id + ".html", html, { httpMetadata: { contentType: "text/html; charset=utf-8" } });
      } catch { return Response.json({ error: "preview store failed" }, { status: 502 }); }
      const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
      return Response.json({ url: "/preview/" + pvUser.id + "/" + nonce });
    }
    if (url.pathname === "/api/site/publish" && request.method === "POST") {
      const pubUser = await authUser(request);
      if (!pubUser) return UNAUTHED();
      if (!env.SITES_BUCKET) return Response.json({ error: "hosting not configured" }, { status: 501 });
      let body;
      try { body = await request.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
      const siteId = typeof body.siteId === "string" ? body.siteId.slice(0, 80) : "";
      const name = (typeof body.name === "string" ? body.name : "site").slice(0, 80);
      const pages = Array.isArray(body.pages)
        ? body.pages.filter((p) => p && typeof p.html === "string" && typeof p.path === "string").slice(0, 8)
        : [];
      if (!pages.length) return Response.json({ error: "no pages" }, { status: 400 });
      const jwt = (request.headers.get("Authorization") || "").slice(7);
      const sbHeaders = { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + jwt };
      // Reuse the slug on republish (look up this user's own row for this site).
      let slug = "";
      try {
        const ex = await fetch(`${SUPABASE_URL}/rest/v1/published_sites?site_id=eq.${encodeURIComponent(siteId)}&select=slug&limit=1`, { headers: sbHeaders, signal: AbortSignal.timeout(10000) });
        const rows = await ex.json().catch(() => []);
        if (Array.isArray(rows) && rows[0] && rows[0].slug) slug = rows[0].slug;
      } catch {}
      if (!slug) {
        const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "site";
        slug = base + "-" + crypto.randomUUID().slice(0, 6);
      }
      const paths = pages.map((p) => p.path);
      const prefix = "/s/" + slug;
      const outPages = [];
      try {
        for (const p of pages) {
          const pageKey = p.path === "/" ? "index" : p.path.replace(/^\//, "").replace(/[^a-z0-9/_-]/gi, "-");
          const html = rewriteSiteLinks(p.html, prefix, paths);
          await env.SITES_BUCKET.put("sites/" + slug + "/" + pageKey + ".html", html, { httpMetadata: { contentType: "text/html; charset=utf-8" } });
          outPages.push({ path: p.path, key: "sites/" + slug + "/" + pageKey + ".html" });
        }
      } catch (e) {
        console.error("publish r2 failed:", e && e.message);
        return Response.json({ error: "publish failed" }, { status: 502 });
      }
      // Upsert the ownership/routing row (update by slug if it exists, else insert).
      const now = new Date().toISOString();
      try {
        const upd = await fetch(`${SUPABASE_URL}/rest/v1/published_sites?slug=eq.${encodeURIComponent(slug)}`, {
          method: "PATCH", headers: { ...sbHeaders, Prefer: "return=representation" },
          body: JSON.stringify({ site_id: siteId, title: name, pages: outPages, updated_at: now, published_at: now }),
          signal: AbortSignal.timeout(10000),
        });
        const updRows = await upd.json().catch(() => []);
        if (!Array.isArray(updRows) || !updRows.length) {
          await fetch(`${SUPABASE_URL}/rest/v1/published_sites`, {
            method: "POST", headers: { ...sbHeaders, Prefer: "return=minimal" },
            body: JSON.stringify({ user_id: pubUser.id, site_id: siteId, slug, title: name, pages: outPages, updated_at: now, published_at: now }),
            signal: AbortSignal.timeout(10000),
          });
        }
      } catch (e) { console.error("publish db failed:", e && e.message); }
      return Response.json({ url: `https://isibi.ai/s/${slug}`, slug, pages: outPages.length });
    }

    // ── Published-site visitor auth: REAL accounts for the sites the builder
    // makes. Storage = Supabase site_users (service-key writes, no client policy);
    // brains = the Worker (PBKDF2 hashing + HMAC-signed sessions). Unlike forms
    // these RETURN real success/failure so the site's login UI can react.
    const siteAuthCors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
    if (url.pathname.startsWith("/api/site/auth/") && request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" } });
    }
    if ((url.pathname === "/api/site/auth/signup" || url.pathname === "/api/site/auth/login") && request.method === "POST") {
      const isSignup = url.pathname.endsWith("/signup");
      const fail = (error, status = 200) => Response.json({ ok: false, error }, { status, headers: siteAuthCors });
      if (!env.SUPABASE_SERVICE_KEY) return fail("Accounts are unavailable right now.");
      const tlA = tooLargeBody(request, 8000); if (tlA) return fail("Bad request.");
      let body; try { body = await request.json(); } catch { return fail("Bad request."); }
      if (body && (body._hp || body.hp)) return Response.json({ ok: true }, { headers: siteAuthCors }); // honeypot → fake-ok for bots
      const slug = typeof body.slug === "string" ? body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90) : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (!slug) return fail("This site isn’t published yet — accounts work once it’s live.");
      if (!SITE_EMAIL_RE.test(email)) return fail("Enter a valid email address.");
      if (password.length < 8) return fail("Password must be at least 8 characters.");
      if (password.length > 200) return fail("Password is too long.");
      const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY, "Content-Type": "application/json" };
      // Resolve the published site (confirms the slug is real + gets the owner).
      let site = null;
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/published_sites?slug=eq.${encodeURIComponent(slug)}&select=id,user_id&limit=1`, { headers: svc, signal: AbortSignal.timeout(10000) });
        const rows = await r.json().catch(() => []);
        site = Array.isArray(rows) ? rows[0] : null;
      } catch {}
      if (!site) return fail("This site isn’t available.");
      // Existing member for this (site, email)?
      let existing = null;
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/site_users?published_site_id=eq.${site.id}&email=eq.${encodeURIComponent(email)}&select=id,password_hash&limit=1`, { headers: svc, signal: AbortSignal.timeout(10000) });
        const rows = await r.json().catch(() => []);
        existing = Array.isArray(rows) ? rows[0] : null;
      } catch { return fail("Something went wrong. Please try again."); }
      if (isSignup) {
        if (existing) return fail("An account with this email already exists — try logging in.");
        const password_hash = await hashSitePassword(password);
        let created = null;
        try {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/site_users`, {
            method: "POST", headers: { ...svc, Prefer: "return=representation" },
            body: JSON.stringify({ published_site_id: site.id, owner_id: site.user_id, slug, email, password_hash, last_login_at: new Date().toISOString() }),
            signal: AbortSignal.timeout(10000),
          });
          if (r.status === 409) return fail("An account with this email already exists — try logging in.");
          const rows = await r.json().catch(() => []);
          created = Array.isArray(rows) ? rows[0] : (rows && rows.id ? rows : null);
          if (!r.ok || !created) return fail("Couldn’t create your account. Please try again.");
        } catch { return fail("Couldn’t create your account. Please try again."); }
        const token = await signSiteToken(env, { sid: site.id, sub: created.id, em: email, slug });
        return Response.json({ ok: true, token, email }, { headers: siteAuthCors });
      }
      // login
      if (!existing || !(await verifySitePassword(password, existing.password_hash))) return fail("Incorrect email or password.");
      try { await fetch(`${SUPABASE_URL}/rest/v1/site_users?id=eq.${existing.id}`, { method: "PATCH", headers: { ...svc, Prefer: "return=minimal" }, body: JSON.stringify({ last_login_at: new Date().toISOString() }), signal: AbortSignal.timeout(8000) }); } catch {}
      const token = await signSiteToken(env, { sid: site.id, sub: existing.id, em: email, slug });
      return Response.json({ ok: true, token, email }, { headers: siteAuthCors });
    }
    // Validate a session token — the member-page guard calls this on load.
    if (url.pathname === "/api/site/auth/me" && request.method === "GET") {
      const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const claims = await verifySiteToken(env, tok);
      if (!claims) return Response.json({ ok: false }, { status: 401, headers: siteAuthCors });
      return Response.json({ ok: true, email: claims.em || "", slug: claims.slug || "" }, { headers: siteAuthCors });
    }
    // Password reset — step 1: request a link. ALWAYS returns ok (never reveals
    // whether an account exists). The email goes through the SITE OWNER's own
    // provider (EMAIL_FROM + a RESEND/SENDGRID/POSTMARK key in Secrets); with no
    // email configured, nothing is sent (bring-your-own, no platform fallback).
    if (url.pathname === "/api/site/auth/reset-request" && request.method === "POST") {
      const okResp = () => Response.json({ ok: true }, { headers: siteAuthCors });
      if (!env.SUPABASE_SERVICE_KEY) return okResp();
      const tlR = tooLargeBody(request, 8000); if (tlR) return okResp();
      let body; try { body = await request.json(); } catch { return okResp(); }
      if (body && (body._hp || body.hp)) return okResp();
      const slug = typeof body.slug === "string" ? body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90) : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
      if (!slug || !SITE_EMAIL_RE.test(email)) return okResp();
      const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY };
      let site = null;
      try { const r = await fetch(`${SUPABASE_URL}/rest/v1/published_sites?slug=eq.${encodeURIComponent(slug)}&select=id,user_id&limit=1`, { headers: svc, signal: AbortSignal.timeout(8000) }); const rows = await r.json().catch(() => []); site = Array.isArray(rows) ? rows[0] : null; } catch {}
      if (!site) return okResp();
      let user = null;
      try { const r = await fetch(`${SUPABASE_URL}/rest/v1/site_users?published_site_id=eq.${site.id}&email=eq.${encodeURIComponent(email)}&select=id,password_hash&limit=1`, { headers: svc, signal: AbortSignal.timeout(8000) }); const rows = await r.json().catch(() => []); user = Array.isArray(rows) ? rows[0] : null; } catch {}
      if (user) {
        // Single-use, 45-min token BOUND to the current password hash — once the
        // password changes (hash changes), any outstanding link is dead.
        const pv = (await sha256hex(user.password_hash || "")).slice(0, 16);
        const token = await signSiteToken(env, { sid: site.id, sub: user.id, em: email, slug, purpose: "reset", pv }, 45 * 60 * 1000);
        const link = "https://isibi.ai/s/" + slug + "/reset?token=" + encodeURIComponent(token);
        const html = "<p>We got a request to reset your password. Click below to choose a new one — this link expires in 45 minutes:</p><p><a href=\"" + link + "\">Reset your password</a></p><p>If you didn't request this, you can safely ignore this email.</p>";
        const send = sendSiteEmailByConvention(env, site.user_id, slug, email, "Reset your password", html);
        if (ctx && ctx.waitUntil) ctx.waitUntil(send); else { try { await send; } catch {} }
      }
      return okResp();
    }
    // Password reset — step 2: set a new password using the token from the email.
    if (url.pathname === "/api/site/auth/reset" && request.method === "POST") {
      const fail = (error) => Response.json({ ok: false, error }, { headers: siteAuthCors });
      if (!env.SUPABASE_SERVICE_KEY) return fail("Reset is unavailable right now.");
      const tlR2 = tooLargeBody(request, 8000); if (tlR2) return fail("Bad request.");
      let body; try { body = await request.json(); } catch { return fail("Bad request."); }
      const token = typeof body.token === "string" ? body.token : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < 8) return fail("Password must be at least 8 characters.");
      if (password.length > 200) return fail("Password is too long.");
      const claims = await verifySiteToken(env, token);
      if (!claims || claims.purpose !== "reset" || !claims.sub) return fail("This reset link is invalid or has expired. Request a new one.");
      const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY, "Content-Type": "application/json" };
      let user = null;
      try { const r = await fetch(`${SUPABASE_URL}/rest/v1/site_users?id=eq.${claims.sub}&select=id,email,password_hash,slug&limit=1`, { headers: svc, signal: AbortSignal.timeout(8000) }); const rows = await r.json().catch(() => []); user = Array.isArray(rows) ? rows[0] : null; } catch {}
      if (!user) return fail("This reset link is invalid or has expired. Request a new one.");
      // Single-use: the token's pv must still match the CURRENT password hash.
      const pv = (await sha256hex(user.password_hash || "")).slice(0, 16);
      if (pv !== claims.pv) return fail("This reset link has already been used. Request a new one.");
      const password_hash = await hashSitePassword(password);
      try { await fetch(`${SUPABASE_URL}/rest/v1/site_users?id=eq.${claims.sub}`, { method: "PATCH", headers: { ...svc, Prefer: "return=minimal" }, body: JSON.stringify({ password_hash }), signal: AbortSignal.timeout(8000) }); } catch { return fail("Couldn't reset your password. Please try again."); }
      const session = await signSiteToken(env, { sid: claims.sid, sub: user.id, em: user.email, slug: user.slug });
      return Response.json({ ok: true, token: session, email: user.email }, { headers: siteAuthCors });
    }
    // Owner lists a site's members (like the form inbox). RLS scopes to their JWT.
    if (url.pathname === "/api/site/members" && request.method === "GET") {
      const mUser = await authUser(request);
      if (!mUser) return UNAUTHED();
      const slug = (url.searchParams.get("slug") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90);
      const jwt = (request.headers.get("Authorization") || "").slice(7);
      const base = `${SUPABASE_URL}/rest/v1/site_users?select=email,created_at,last_login_at${slug ? ",slug&slug=eq." + encodeURIComponent(slug) : ",slug"}&order=created_at.desc&limit=500`;
      try {
        const r = await fetch(base, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + jwt }, signal: AbortSignal.timeout(10000) });
        const rows = await r.json().catch(() => []);
        return Response.json({ members: Array.isArray(rows) ? rows : [] });
      } catch { return Response.json({ members: [] }); }
    }

    // Deep security scan — Opus reviews the generated site's real code and
    // reports concrete findings. Metered through the credit ledger (charge only
    // on a successful scan, so a failed call costs nothing).
    if (url.pathname === "/api/site/scan" && request.method === "POST") {
      const scUser = await authUser(request);
      if (!scUser) return UNAUTHED();
      if (!env.ANTHROPIC_API_KEY) return Response.json({ error: "scan not configured" }, { status: 501 });
      const tlSc = tooLargeBody(request, 2_000_000); if (tlSc) return tlSc;
      let scb; try { scb = await request.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
      const scPages = Array.isArray(scb.pages) ? scb.pages.filter((p) => p && typeof p.html === "string").slice(0, 6) : [];
      if (!scPages.length) return Response.json({ ok: true, findings: [] });
      const SCAN_CREDITS = 8; // ~$0.064; bounds Opus cost with the input cap below.
      const scAuth = request.headers.get("Authorization") || "";
      let scBal; try { scBal = await readCredits(scAuth); } catch { return Response.json({ error: "scan unavailable" }, { status: 503 }); }
      if (!(scBal >= SCAN_CREDITS)) return Response.json({ error: "not enough credits", need: "credits" }, { status: 402 });
      let corpus = "";
      for (const p of scPages) {
        corpus += "\n\n===== PAGE " + (p.name || p.path || "/") + " (" + (p.path || "/") + ") =====\n" + String(p.html).slice(0, 40000);
        if (corpus.length > 140000) break;
      }
      const scanTool = {
        name: "report_findings",
        description: "Report security findings for the reviewed website code.",
        input_schema: { type: "object", properties: { findings: { type: "array", items: { type: "object", properties: {
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          title: { type: "string", description: "Short issue title" },
          detail: { type: "string", description: "What the issue is and how to fix it, in one or two sentences" },
          page: { type: "string", description: "Which page the issue is on" },
        }, required: ["severity", "title", "detail"] } } }, required: ["findings"] },
      };
      const scSystem = "You are a senior application-security engineer reviewing a single-file static website (HTML/CSS/JS) that will be hosted publicly on a shared domain. Report only REAL, concrete security issues actually present in the provided code — no style/UX/SEO advice, no hypotheticals, no false positives. Look for: DOM XSS (unescaped innerHTML/document.write/insertAdjacentHTML of dynamic or URL-derived data), forms that send data to an EXTERNAL endpoint (anything other than the same-origin /api/site/* endpoints), hardcoded secrets / API keys / tokens / passwords, insecure http:// resources (mixed content), dangerous eval()/new Function(), links with target=_blank missing rel=noopener (tabnabbing), open redirects from location = untrusted input, and any password field that posts to a non-auth endpoint. If the code is clean, return an empty findings array. Order findings by severity, most severe first.";
      let sr;
      try {
        sr = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: 3000, system: scSystem, tools: [scanTool], tool_choice: { type: "tool", name: "report_findings" }, messages: [{ role: "user", content: "Review this website for security issues:\n" + corpus }] }),
          signal: AbortSignal.timeout(150000),
        });
      } catch { return Response.json({ error: "scan failed" }, { status: 502 }); }
      if (!sr.ok) return Response.json({ error: "scan failed" }, { status: 502 });
      const sd = await sr.json().catch(() => ({}));
      let findings = [];
      try {
        const block = (sd.content || []).find((c) => c.type === "tool_use");
        if (block && block.input && Array.isArray(block.input.findings)) findings = block.input.findings.slice(0, 40);
      } catch {}
      let scAfter = scBal; try { const b = await useCredits(scAuth, SCAN_CREDITS); if (b >= 0) scAfter = b; } catch {}
      return Response.json({ ok: true, findings, cost: SCAN_CREDITS, balance: scAfter });
    }

    // Owner reads their published site's analytics (RPC verifies ownership).
    if (url.pathname === "/api/site/analytics" && request.method === "GET") {
      const aUser = await authUser(request);
      if (!aUser) return UNAUTHED();
      const slug = (url.searchParams.get("slug") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90);
      if (!slug) return Response.json({ ok: false });
      const jwt = (request.headers.get("Authorization") || "").slice(7);
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/site_analytics`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + jwt, "Content-Type": "application/json" },
          body: JSON.stringify({ p_slug: slug }),
          signal: AbortSignal.timeout(10000),
        });
        const d = await r.json().catch(() => ({ ok: false }));
        return Response.json(d && typeof d === "object" ? d : { ok: false });
      } catch { return Response.json({ ok: false }); }
    }

    // ── Collections ("Database"): PUBLIC displayable data the generated site both
    // writes and reads (testimonials, menu, guestbook, listings). Write is anon +
    // fail-soft like forms; read is public (that's the point — the site renders it).
    if (url.pathname === "/api/site/data" && request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" } });
    }
    if (url.pathname === "/api/site/data" && request.method === "POST") {
      const cors = { "Access-Control-Allow-Origin": "*" };
      const ok = () => Response.json({ ok: true }, { headers: cors });
      const tlD = tooLargeBody(request, 24000); if (tlD) return ok();
      let body; try { body = await request.json(); } catch { return ok(); }
      if (body && (body._hp || body.hp)) return ok();
      const slug = typeof body.slug === "string" ? body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90) : "";
      const collection = typeof body.collection === "string" ? body.collection.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) : "";
      const raw = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : {};
      if (raw._hp || raw.hp) return ok(); // honeypot lives in the record fields → drop bots
      const data = {}; let n = 0;
      for (const k of Object.keys(raw)) { if (n++ >= 30) break; const v = raw[k]; data[String(k).slice(0, 80)] = typeof v === "string" ? v.slice(0, 2000) : (typeof v === "number" || typeof v === "boolean" ? v : String(v).slice(0, 2000)); }
      delete data._hp; delete data.hp;
      if (!slug || !collection || !env.SUPABASE_SERVICE_KEY) return ok();
      const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY, "Content-Type": "application/json" };
      let site = null;
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/published_sites?slug=eq.${encodeURIComponent(slug)}&select=id,user_id&limit=1`, { headers: svc, signal: AbortSignal.timeout(10000) });
        const rows = await r.json().catch(() => []); site = Array.isArray(rows) ? rows[0] : null;
      } catch {}
      if (!site) return ok();
      try { // cap ≤500 records per (slug, collection) to bound abuse
        const c = await fetch(`${SUPABASE_URL}/rest/v1/site_collections?slug=eq.${encodeURIComponent(slug)}&collection=eq.${encodeURIComponent(collection)}&select=id`, { headers: { ...svc, Prefer: "count=exact", Range: "0-0" }, signal: AbortSignal.timeout(8000) });
        const total = parseInt(((c.headers.get("content-range") || "").split("/")[1] || "0"), 10) || 0;
        if (total >= 500) return ok();
      } catch {}
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/site_collections`, { method: "POST", headers: { ...svc, Prefer: "return=minimal" }, body: JSON.stringify({ published_site_id: site.id, owner_id: site.user_id, slug, collection, data }), signal: AbortSignal.timeout(10000) });
      } catch {}
      return ok();
    }
    if (url.pathname === "/api/site/data" && request.method === "GET") {
      const cors = { "Access-Control-Allow-Origin": "*" };
      const slug = (url.searchParams.get("slug") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90);
      const collection = (url.searchParams.get("collection") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));
      if (!slug || !collection || !env.SUPABASE_SERVICE_KEY) return Response.json({ records: [], total: 0 }, { headers: cors });
      const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY };
      // Query mode when any filter/search/sort/paging param is present — then we
      // pull the whole collection (≤500 cap) and query it in-Worker. Otherwise the
      // cheap "latest N" path stays untouched.
      const queried = url.searchParams.getAll("where").length > 0 || url.searchParams.get("q") || url.searchParams.get("sort") || (parseInt(url.searchParams.get("offset") || "0", 10) > 0);
      const fetchLimit = queried ? 500 : limit;
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/site_collections?slug=eq.${encodeURIComponent(slug)}&collection=eq.${encodeURIComponent(collection)}&select=data,created_at&order=created_at.desc&limit=${fetchLimit}`, { headers: svc, signal: AbortSignal.timeout(10000) });
        const rows = await r.json().catch(() => []);
        if (queried) return Response.json(applySiteQuery(rows, url.searchParams), { headers: cors });
        return Response.json({ records: Array.isArray(rows) ? rows : [], total: Array.isArray(rows) ? rows.length : 0 }, { headers: cors });
      } catch { return Response.json({ records: [], total: 0 }, { headers: cors }); }
    }
    // ── Secrets vault (owner only). Values are encrypted before storage and are
    // NEVER returned — the list is names + timestamps only; rotate = re-POST.
    if (url.pathname === "/api/site/secrets" && request.method === "POST") {
      const sUser = await authUser(request);
      if (!sUser) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY) return Response.json({ error: "secrets unavailable" }, { status: 501 });
      let sb2; try { sb2 = await request.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
      const slug = typeof sb2.slug === "string" ? sb2.slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90) : "";
      const name = typeof sb2.name === "string" ? sb2.name.trim().replace(/[^A-Za-z0-9_]/g, "").slice(0, 64) : "";
      const value = typeof sb2.value === "string" ? sb2.value : "";
      if (!slug || !name) return Response.json({ ok: false, error: "Give the secret a name (letters, numbers, underscore)." });
      if (!value) return Response.json({ ok: false, error: "The secret value can’t be empty." });
      if (value.length > 8000) return Response.json({ ok: false, error: "That value is too long." });
      const jwt = (request.headers.get("Authorization") || "").slice(7);
      // Prove the caller OWNS this site: a React build (sitesrc/<slug>.json.uid ===
      // caller) OR a legacy static site (a published_sites row under the caller's
      // own JWT — RLS scopes it to them). React sites never get a published_sites
      // row, so the sitesrc check is what lets them use secrets.
      let owns = false, publishedSiteId = null;
      try { const o = await env.SITES_BUCKET.get("sitesrc/" + slug + ".json"); if (o) { const j = JSON.parse(await o.text()); if (j && j.uid === sUser.id) owns = true; } } catch {}
      if (!owns) {
        try {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/published_sites?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + jwt, "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000) });
          const rows = await r.json().catch(() => []); if (Array.isArray(rows) && rows[0]) { owns = true; publishedSiteId = rows[0].id; }
        } catch {}
      }
      if (!owns) return Response.json({ ok: false, error: "Publish the site first." });
      const enc = await encryptSecret(env, value);
      const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY, "Content-Type": "application/json" };
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/site_secrets?on_conflict=owner_id,slug,name`, {
          method: "POST", headers: { ...svc, Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ published_site_id: publishedSiteId, owner_id: sUser.id, slug, name, value_encrypted: enc, updated_at: new Date().toISOString() }),
          signal: AbortSignal.timeout(10000),
        });
      } catch { return Response.json({ ok: false, error: "Couldn’t save the secret." }); }
      return Response.json({ ok: true, name });
    }
    if (url.pathname === "/api/site/secrets" && request.method === "GET") {
      const sUser = await authUser(request);
      if (!sUser) return UNAUTHED();
      const slug = (url.searchParams.get("slug") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90);
      const jwt = (request.headers.get("Authorization") || "").slice(7);
      const base = `${SUPABASE_URL}/rest/v1/site_secrets?select=name,created_at,updated_at${slug ? "&slug=eq." + encodeURIComponent(slug) : ""}&order=created_at.desc&limit=100`;
      try {
        const r = await fetch(base, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + jwt }, signal: AbortSignal.timeout(10000) });
        const rows = await r.json().catch(() => []);
        return Response.json({ secrets: Array.isArray(rows) ? rows : [] });
      } catch { return Response.json({ secrets: [] }); }
    }
    if (url.pathname === "/api/site/secrets" && request.method === "DELETE") {
      const sUser = await authUser(request);
      if (!sUser) return UNAUTHED();
      const slug = (url.searchParams.get("slug") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90);
      const name = (url.searchParams.get("name") || "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 64);
      if (!slug || !name) return Response.json({ ok: false });
      const jwt = (request.headers.get("Authorization") || "").slice(7);
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/site_secrets?slug=eq.${encodeURIComponent(slug)}&name=eq.${encodeURIComponent(name)}`, {
          method: "DELETE", headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + jwt, Prefer: "return=minimal" }, signal: AbortSignal.timeout(10000),
        });
      } catch {}
      return Response.json({ ok: true });
    }

    // Owner lists their site's collection records (RLS-scoped).
    if (url.pathname === "/api/site/collections" && request.method === "GET") {
      const cUser = await authUser(request);
      if (!cUser) return UNAUTHED();
      const slug = (url.searchParams.get("slug") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90);
      const jwt = (request.headers.get("Authorization") || "").slice(7);
      const base = `${SUPABASE_URL}/rest/v1/site_collections?select=collection,data,created_at${slug ? "&slug=eq." + encodeURIComponent(slug) : ""}&order=created_at.desc&limit=500`;
      try {
        const r = await fetch(base, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + jwt }, signal: AbortSignal.timeout(10000) });
        const rows = await r.json().catch(() => []);
        return Response.json({ records: Array.isArray(rows) ? rows : [] });
      } catch { return Response.json({ records: [] }); }
    }

    // ── Site functions ("Edge functions") ──────────────────────────────────
    // Runtime: the published site's JS calls its own declared functions here.
    // Public + fail-soft like /api/site/form, but each run is hard-bounded and
    // external calls are SSRF-guarded (see runSiteFunction). No credit charge —
    // abuse is bounded by per-run caps + a per-slug rate limit.
    if (url.pathname === "/api/site/fn" && request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" } });
    }
    if (url.pathname === "/api/site/fn" && request.method === "POST") {
      const cors = { "Access-Control-Allow-Origin": "*" };
      const tlFn = tooLargeBody(request, 24000); if (tlFn) return Response.json({ error: "too large" }, { status: 413, headers: cors });
      let body; try { body = await request.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400, headers: cors }); }
      const slug = typeof body.slug === "string" ? body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90) : "";
      const fnName = typeof body.fn === "string" ? body.fn.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) : "";
      const input = body.input && typeof body.input === "object" && !Array.isArray(body.input) ? body.input : {};
      if (!slug || !fnName) return Response.json({ error: "unknown function" }, { status: 404, headers: cors });
      if (!env.SUPABASE_SERVICE_KEY) return Response.json({ error: "functions unavailable" }, { status: 501, headers: cors });
      if (!fnRateOk(slug)) return Response.json({ error: "rate limited" }, { status: 429, headers: cors });
      try {
        const res = await invokeSiteFunctionByName(env, slug, fnName, input);
        if (res.notFound) return Response.json({ error: "unknown function" }, { status: 404, headers: cors });
        return Response.json(res.out && typeof res.out === "object" ? res.out : { result: res.out }, { headers: cors });
      } catch { return Response.json({ error: "function failed" }, { status: 500, headers: cors }); }
    }
    // Webhook trigger: an external service (Stripe, Zapier, …) POSTs its own JSON
    // to /api/site/hook/<slug>/<fn>; the whole body becomes the function's input.
    if (url.pathname.startsWith("/api/site/hook/") && (request.method === "POST" || request.method === "OPTIONS")) {
      const cors = { "Access-Control-Allow-Origin": "*" };
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" } });
      const parts = url.pathname.slice("/api/site/hook/".length).split("/");
      const slug = (parts[0] || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90);
      const fnName = (parts[1] || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
      if (!slug || !fnName) return Response.json({ error: "unknown function" }, { status: 404, headers: cors });
      if (!env.SUPABASE_SERVICE_KEY) return Response.json({ error: "functions unavailable" }, { status: 501, headers: cors });
      const tlH = tooLargeBody(request, 64000); if (tlH) return Response.json({ error: "too large" }, { status: 413, headers: cors });
      if (!fnRateOk(slug)) return Response.json({ error: "rate limited" }, { status: 429, headers: cors });
      // Read the RAW body (needed intact for signature verification), then load
      // the function so we can check whether it requires a verified signature.
      const rawBody = await request.text();
      const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY };
      let row = null;
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/site_functions?slug=eq.${encodeURIComponent(slug)}&name=eq.${encodeURIComponent(fnName)}&enabled=is.true&select=owner_id,published_site_id,spec&limit=1`, { headers: svc, signal: AbortSignal.timeout(8000) });
        const rows = await r.json().catch(() => []); row = Array.isArray(rows) ? rows[0] : null;
      } catch {}
      if (!row) return Response.json({ error: "unknown function" }, { status: 404, headers: cors });
      // Signature gate (Stripe): reject anything not signed with the site's
      // STRIPE_WEBHOOK_SECRET, so a forged event can never run the function.
      if (row.spec && row.spec.verify === "stripe") {
        const secrets = await loadSiteSecrets(env, row.owner_id, slug);
        const good = await verifyStripeSig(rawBody, request.headers.get("Stripe-Signature"), secrets.STRIPE_WEBHOOK_SECRET || "");
        if (!good) return Response.json({ error: "signature verification failed" }, { status: 400, headers: cors });
      }
      let input = {}; try { const raw = JSON.parse(rawBody); input = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : { body: raw }; } catch { input = {}; }
      try {
        const out = await runSiteFunction(env, row, input, slug);
        return Response.json(out && typeof out === "object" ? out : { result: out }, { headers: cors });
      } catch { return Response.json({ error: "function failed" }, { status: 500, headers: cors }); }
    }
    // Owner lists their site's declared functions (RLS-scoped, for the Cloud panel).
    if (url.pathname === "/api/site/functions" && request.method === "GET") {
      const fUser = await authUser(request);
      if (!fUser) return UNAUTHED();
      const slug = (url.searchParams.get("slug") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90);
      const jwt = (request.headers.get("Authorization") || "").slice(7);
      const base = `${SUPABASE_URL}/rest/v1/site_functions?select=name,spec,enabled,schedule_minutes,last_run,created_at,updated_at${slug ? "&slug=eq." + encodeURIComponent(slug) : ""}&order=created_at.desc&limit=100`;
      try {
        const r = await fetch(base, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + jwt }, signal: AbortSignal.timeout(10000) });
        const rows = await r.json().catch(() => []);
        return Response.json({ functions: Array.isArray(rows) ? rows : [] });
      } catch { return Response.json({ functions: [] }); }
    }
    // Owner deletes one of their functions (RLS delete policy scopes to them).
    if (url.pathname === "/api/site/functions" && request.method === "DELETE") {
      const fUser = await authUser(request);
      if (!fUser) return UNAUTHED();
      const slug = (url.searchParams.get("slug") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90);
      const name = (url.searchParams.get("name") || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
      if (!slug || !name) return Response.json({ ok: false });
      const jwt = (request.headers.get("Authorization") || "").slice(7);
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/site_functions?slug=eq.${encodeURIComponent(slug)}&name=eq.${encodeURIComponent(name)}`, {
          method: "DELETE", headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + jwt, Prefer: "return=minimal" }, signal: AbortSignal.timeout(10000),
        });
      } catch {}
      return Response.json({ ok: true });
    }

    // ── File uploads ────────────────────────────────────────────────────────
    // A published site lets visitors upload an image or PDF (listing photo,
    // avatar, resume). Public + fail-soft; stored in R2 under uploads/<slug>/,
    // served back from /u/<slug>/<file>. The site then saves the returned URL
    // into a collection to keep it. mime-allowlisted (no SVG/HTML → no XSS),
    // size + per-slug count capped.
    if (url.pathname === "/api/site/upload" && request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" } });
    }
    if (url.pathname === "/api/site/upload" && request.method === "POST") {
      const cors = { "Access-Control-Allow-Origin": "*" };
      if (!env.SITES_BUCKET) return Response.json({ error: "uploads unavailable" }, { status: 501, headers: cors });
      const tlU = tooLargeBody(request, 9_000_000); if (tlU) return Response.json({ error: "too large" }, { status: 413, headers: cors });
      let ub; try { ub = await request.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400, headers: cors }); }
      const slug = typeof ub.slug === "string" ? ub.slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90) : "";
      if (!slug) return Response.json({ error: "not live yet" }, { status: 400, headers: cors });
      if (!fnRateOk(slug)) return Response.json({ error: "rate limited" }, { status: 429, headers: cors });
      const m = typeof ub.data === "string" ? ub.data.match(/^data:([^;,]+);base64,(.+)$/s) : null;
      if (!m) return Response.json({ error: "send the file as a base64 data URL" }, { status: 400, headers: cors });
      const MIME_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf" };
      const mime = m[1].toLowerCase();
      const ext = MIME_EXT[mime];
      if (!ext) return Response.json({ error: "Only images (PNG, JPG, WebP, GIF) and PDF are allowed." }, { status: 415, headers: cors });
      let bytes;
      try { const bin = atob(m[2]); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); } catch { return Response.json({ error: "couldn’t read the file" }, { status: 400, headers: cors }); }
      if (bytes.length > 6_000_000) return Response.json({ error: "That file is too big — keep it under 6 MB." }, { status: 413, headers: cors });
      // Only store for a REAL site — a published React build (R2 sites/<slug>/) OR a
      // legacy static site (published_sites row). The R2 check is what lets React
      // apps, which never get a published_sites row, use uploads too.
      let siteExists = false;
      try { if (await env.SITES_BUCKET.head("sites/" + slug + "/index.html")) siteExists = true; } catch {}
      if (!siteExists && env.SUPABASE_SERVICE_KEY) {
        try {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/published_sites?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`, { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY }, signal: AbortSignal.timeout(8000) });
          const rows = await r.json().catch(() => []);
          if (Array.isArray(rows) && rows[0]) siteExists = true;
        } catch { siteExists = true; } // fail-open on a Supabase blip — don't block a real upload
      }
      if (!siteExists) return Response.json({ error: "not live yet" }, { status: 400, headers: cors });
      // Per-slug count cap (bounds abuse; R2 list is prefix-scoped).
      try {
        const listed = await env.SITES_BUCKET.list({ prefix: "uploads/" + slug + "/", limit: 300 });
        if (listed && Array.isArray(listed.objects) && listed.objects.length >= 300) return Response.json({ error: "upload limit reached for this site" }, { status: 429, headers: cors });
      } catch {}
      const id = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
      const key = "uploads/" + slug + "/" + id + "." + ext;
      try {
        await env.SITES_BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } });
      } catch { return Response.json({ error: "couldn’t save the file" }, { status: 502, headers: cors }); }
      return Response.json({ url: "https://isibi.ai/u/" + slug + "/" + id + "." + ext, name: typeof ub.name === "string" ? ub.name.slice(0, 120) : "", type: mime }, { headers: cors });
    }
    // Owner lists / deletes their site's uploaded files (R2). Ownership is proven
    // by reading published_sites under the caller's JWT (owner-only RLS).
    if (url.pathname === "/api/site/files" && (request.method === "GET" || request.method === "DELETE")) {
      const fUser = await authUser(request);
      if (!fUser) return UNAUTHED();
      if (!env.SITES_BUCKET) return Response.json({ files: [] });
      const slug = (url.searchParams.get("slug") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90);
      if (!slug) return Response.json(request.method === "GET" ? { files: [] } : { ok: false });
      const jwt = (request.headers.get("Authorization") || "").slice(7);
      let owns = false;
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/published_sites?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + jwt }, signal: AbortSignal.timeout(8000) });
        const rows = await r.json().catch(() => []); owns = Array.isArray(rows) && !!rows[0];
      } catch {}
      if (!owns) return Response.json(request.method === "GET" ? { files: [] } : { ok: false });
      if (request.method === "DELETE") {
        const file = (url.searchParams.get("file") || "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 80);
        if (file) { try { await env.SITES_BUCKET.delete("uploads/" + slug + "/" + file); } catch {} }
        return Response.json({ ok: true });
      }
      try {
        const listed = await env.SITES_BUCKET.list({ prefix: "uploads/" + slug + "/", limit: 300 });
        const files = ((listed && listed.objects) || []).map((o) => { const nm = o.key.split("/").pop(); return { name: nm, url: "https://isibi.ai/u/" + slug + "/" + nm, size: o.size, uploaded: o.uploaded }; })
          .sort((a, b) => new Date(b.uploaded || 0) - new Date(a.uploaded || 0));
        return Response.json({ files });
      } catch { return Response.json({ files: [] }); }
    }

    // Public form submissions from published sites (waitlist/contact). Anonymous
    // visitors POST here; we validate the slug and insert with the service key
    // (there is no client-writable policy). Fails SOFT (always ok:true) so a
    // visitor never sees an error, and only stores for a real published slug.
    if (url.pathname === "/api/site/form" && request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" } });
    }
    if (url.pathname === "/api/site/form" && request.method === "POST") {
      const cors = { "Access-Control-Allow-Origin": "*" };
      const ok = () => Response.json({ ok: true }, { headers: cors });
      const tlF = tooLargeBody(request, 16000); if (tlF) return ok();
      let body;
      try { body = await request.json(); } catch { return ok(); }
      const slug = typeof body.slug === "string" ? body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90) : "";
      const form = typeof body.form === "string" ? body.form.slice(0, 60) : "form";
      const raw = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : {};
      // Cap: ≤30 fields, keys ≤80, values ≤2k chars.
      const data = {}; let n = 0;
      for (const k of Object.keys(raw)) {
        if (n++ >= 30) break;
        const v = raw[k];
        data[String(k).slice(0, 80)] = typeof v === "string" ? v.slice(0, 2000) : (typeof v === "number" || typeof v === "boolean" ? v : String(v).slice(0, 2000));
      }
      if (data._hp || data.hp) return ok();                 // honeypot filled → bot, drop
      if (!slug || !env.SUPABASE_SERVICE_KEY) return ok();  // preview / no slug → don't store
      const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY, "Content-Type": "application/json" };
      let site = null;
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/published_sites?slug=eq.${encodeURIComponent(slug)}&select=id,user_id&limit=1`, { headers: svc, signal: AbortSignal.timeout(10000) });
        const rows = await r.json().catch(() => []);
        site = Array.isArray(rows) ? rows[0] : null;
      } catch {}
      if (!site) return ok();
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/site_form_submissions`, {
          method: "POST", headers: { ...svc, Prefer: "return=minimal" },
          body: JSON.stringify({ published_site_id: site.id, user_id: site.user_id, slug, form, data }),
          signal: AbortSignal.timeout(10000),
        });
      } catch {}
      return ok();
    }

    // Owner reads their published site's form submissions (RLS scopes to them).
    if (url.pathname === "/api/site/submissions" && request.method === "GET") {
      const subUser = await authUser(request);
      if (!subUser) return UNAUTHED();
      const slug = (url.searchParams.get("slug") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90);
      const jwt = (request.headers.get("Authorization") || "").slice(7);
      const base = `${SUPABASE_URL}/rest/v1/site_form_submissions?select=form,data,created_at${slug ? ",slug&slug=eq." + encodeURIComponent(slug) : ",slug"}&order=created_at.desc&limit=200`;
      try {
        const r = await fetch(base, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + jwt }, signal: AbortSignal.timeout(10000) });
        const rows = await r.json().catch(() => []);
        return Response.json({ submissions: Array.isArray(rows) ? rows : [] });
      } catch { return Response.json({ submissions: [] }); }
    }

    // Sonnet 5 director: chats, reads intent (rerun/revise/new), writes prompts.
    if (url.pathname === "/api/direct" && request.method === "POST") {
      const dirUser = await authUser(request);
      if (!dirUser) return UNAUTHED();
      if (!env.ANTHROPIC_API_KEY) {
        return Response.json({ error: "director not configured" }, { status: 501 });
      }
      const tl = tooLargeBody(request, 60_000_000); if (tl) return tl; // director carries up to 14 downscaled images (~12M chars max, capped below)
      let body;
      try { body = await request.json(); } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400 });
      }
      // "studio" was removed with the Studio editor — no client sends it; drop it
      // from the allowlist so a stray step:"studio" falls back to "ask" instead of
      // reaching the dead studio branch (2026-07-18).
      let step = ["compose", "revise", "error", "research"].includes(body.step) ? body.step : "ask";
      const kind = ["video", "image", "audio"].includes(body.kind) ? body.kind : "video";
      const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 2000) : "";
      if (!prompt) return Response.json({ error: "no prompt" }, { status: 400 });
      // The previous generation's prompt — lets the ask step spot feedback
      // ("slower", "fix the text") and the revise step edit surgically.
      const prevPrompt = typeof body.prevPrompt === "string" ? body.prevPrompt.trim().slice(0, 4000) : ""; // revise rewrites FROM this — clipping it loses the tail
      if (step === "revise" && !prevPrompt) step = "compose";
      // The Orchestrator is metered through the regular credit ledger at the same
      // $0.008/credit basis as generations. Charge AFTER validation (empty prompt)
      // and AFTER the research quota gate below, so a rejected request never
      // debits — but still before the Anthropic call, so useCredits row-locks the
      // ledger to gate a broke user and stop concurrent calls bursting past the
      // balance. A 402 makes the client fall back to raw prompting.
      const dirCredits = orchestratorCostMicros(
        step, ["low", "high", "ultra", "max"].includes(body.effort) ? body.effort : "medium") / 8000;
      // Research spends real money (web_search) and is directly callable, so its
      // own tighter daily cap is checked BEFORE the charge — a capped user is
      // told to wait, not debited.
      if (step === "research" && !(await useQuota(request, "research", 30))) return QUOTA_EXCEEDED();
      let dirBalance;
      try {
        dirBalance = await useCredits(request.headers.get("Authorization") || "", dirCredits);
      } catch {
        return Response.json({ error: "orchestrator unavailable", locked: true, need: "credits" }, { status: 402 });
      }
      if (dirBalance === -1) {
        return Response.json({ error: "not enough credits", locked: true, need: "credits", cost: dirCredits }, { status: 402 });
      }
      // The fee was debited above, BEFORE the Claude call — if that call then
      // fails (network, upstream error, unusable output), the user paid for
      // nothing. Every terminal failure path below reverses the fee via the
      // service-only credit_back RPC, so an upstream outage never eats credits.
      const refundFee = () => { const p = creditBack(env, dirUser.id, dirCredits); if (ctx && ctx.waitUntil) ctx.waitUntil(p); };
      // Raw pipeline error, for the explain-a-failure step.
      const errText = typeof body.error === "string" ? body.error.slice(0, 700) : "";
      // The chat's running creative brief — per-chat taste memory, maintained
      // by the composer and committed by the client on approval.
      const brief = kind !== "audio" && typeof body.brief === "string" ? body.brief.trim().slice(0, 600) : "";
      // Facts gathered by a prior web-search (research) step, folded into
      // prompt writing so "the newest X" is depicted as the real current thing.
      const webFacts = kind !== "audio" && typeof body.webFacts === "string" ? body.webFacts.trim().slice(0, 2000) : "";
      // Universal auto-learned taste: the user's durable creative preferences,
      // learned across ALL chats and applied to every generation. The composer
      // reads it and returns an evolved list; the client persists it globally.
      const memory = Array.isArray(body.memory)
        ? body.memory.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim().slice(0, 140)).slice(0, 15)
        : [];

      // ── Web-search research step ──────────────────────────────────────────
      // Fires only when the ask step judged the request depends on current
      // real-world facts. Uses Anthropic's server-side web_search tool to
      // gather them, then returns a short factual brief + its sources. The
      // compose step folds the brief in for accuracy. Charged per search
      // (~$0.01 each), so it is gated behind that judgment and capped by
      // max_uses; any failure degrades gracefully to "no facts".
      if (step === "research") {
        // (The research daily cap was already checked before the charge above.)
        const rHistory = Array.isArray(body.history)
          ? body.history
              .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.text === "string")
              .slice(-6)
              .map((h) => ({ role: h.role, content: h.text.slice(0, 400) }))
          : [];
        const rTurns = [];
        for (const h of rHistory) {
          const last = rTurns[rTurns.length - 1];
          if (last && last.role === h.role) last.content += "\n" + h.content;
          else rTurns.push({ ...h });
        }
        while (rTurns.length && rTurns[0].role !== "user") rTurns.shift();
        const askText = `Request: ${prompt}`;
        const lastR = rTurns[rTurns.length - 1];
        if (lastR && lastR.role === "user") lastR.content += "\n" + askText;
        else rTurns.push({ role: "user", content: askText });

        const rSystem = `You are the fact-checker for isibi, an AI ${kind} studio's prompt writer. The user's creative request depends on real-world facts that may have changed since your training. Use web_search to find the SPECIFIC, CURRENT facts needed to depict the subject accurately — the exact current product name and generation, notable design and visual details, colors or materials, key specs, and relevant dates. Keep it to 1-3 focused searches. Then reply with a SHORT factual brief: only the concrete facts that affect what to show, in a few plain sentences. No preamble, no markdown, and do NOT write a generation prompt.`;

        let searchMsgs = rTurns;
        let facts = "";
        const sources = [];
        // The web_search server loop can pause mid-search (stop_reason
        // "pause_turn"); resend the assistant turn unchanged to continue.
        for (let round = 0; round < 4; round++) {
          let rr;
          try {
            rr = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": env.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
              },
              body: JSON.stringify({
                model: "claude-sonnet-5",
                max_tokens: 1024,
                system: rSystem,
                tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
                messages: searchMsgs,
              }),
              signal: AbortSignal.timeout(120000),
            });
          } catch {
            refundFee(); // paid research that never ran — reverse the fee
            return Response.json({ facts: "", sources: [] });
          }
          const rdata = await rr.json().catch(() => ({}));
          if (!rr.ok) { refundFee(); return Response.json({ facts: "", sources: [] }); }
          const content = Array.isArray(rdata.content) ? rdata.content : [];
          for (const c of content) {
            if (c.type === "text" && typeof c.text === "string") facts += c.text;
            if (c.type === "web_search_tool_result" && Array.isArray(c.content)) {
              for (const s of c.content) {
                if (s && s.type === "web_search_result" && s.url) {
                  sources.push({ url: String(s.url).slice(0, 300), title: String(s.title || "").slice(0, 160) });
                }
              }
            }
          }
          if (rdata.stop_reason === "pause_turn") { searchMsgs = searchMsgs.concat([{ role: "assistant", content }]); continue; }
          break;
        }
        const seen = new Set();
        const uniqSources = [];
        for (const s of sources) { if (!seen.has(s.url)) { seen.add(s.url); uniqSources.push(s); } if (uniqSources.length >= 5) break; }
        return Response.json({ facts: facts.trim().slice(0, 2000), sources: uniqSources });
      }

      // Studio: the project's current shot list, summarized by the client.
      const shotsCtx = Array.isArray(body.shots)
        ? body.shots.slice(0, 40).map((s) => ({
            n: +s.n || 0,
            title: String(s.title || "").slice(0, 60),
            status: String(s.status || "").slice(0, 12),
            dur: +s.dur || 0,
            prompt: String(s.prompt || "").slice(0, 160),
            src: String(s.src || "").slice(0, 8),
          }))
        : [];
      const answers = Array.isArray(body.answers)
        ? body.answers.filter((a) => typeof a === "string").slice(0, 4).map((a) => a.slice(0, 200))
        : [];
      // Generation context so the director writes for the actual target:
      // which model, whether a start image / end frame is attached, clip length.
      const genModel = typeof body.model === "string" ? body.model.slice(0, 120) : "";
      // A user-safe display name for the target model — NEVER the raw provider
      // id (fal-ai/…): the ask step is shown to the user, so leaking the path
      // would name the provider (bug 2026-07-17). Maps to the same labels the UI
      // shows; unknown ids fall back to a generic phrase, never the raw string.
      const friendlyModelName = (id) => {
        if (/veo3\.1\/lite/.test(id)) return "Veo 3.1 Lite";
        if (/veo3\.1\/fast/.test(id)) return "Veo 3.1 Fast";
        if (/veo3\.1/.test(id)) return "Veo 3.1";
        if (/seedance-2\.0\/fast/.test(id)) return "Seedance 2.0 Fast";
        if (/seedance-2\.0\/mini/.test(id)) return "Seedance 2.0 Mini";
        if (/seedance/.test(id)) return "Seedance 2.0";
        if (/kling-video\/o3\/pro/.test(id)) return "Kling o3 Pro";
        if (/kling-video\/o3\/standard/.test(id)) return "Kling o3 Standard";
        if (/kling-video\/v3\/pro/.test(id)) return "Kling 3.0 Pro";
        if (/kling-video\/v3\/standard/.test(id)) return "Kling 3.0 Standard";
        if (/kling-video\/lipsync/.test(id)) return "Kling LipSync";
        if (/gemini/.test(id)) return "Gemini";
        if (/nano-banana/.test(id)) return "Nano Banana Pro";
        if (/gpt-image/.test(id)) return "GPT Image 2";
        if (/elevenlabs/.test(id)) return "the voice model";
        return "the selected model";
      };
      const genModelLabel = friendlyModelName(genModel);
      const hasImage = !!body.hasImage;
      const hasEnd = !!body.hasEnd;
      // How many images are attached for an image edit/combine (Nano/GPT take
      // several). >1 means the composer should describe EACH image's role,
      // referenced by position ("the first image", "the second image") — these
      // models bind by position, not by an @Image tag.
      // Image mode: edit base + refs. Video mode: reference-to-video refs
      // (client sends the count only on multi-ref reference runs).
      const imageCount = kind !== "audio" ? Math.min(16, Math.max(0, Math.round(+body.imageCount) || 0)) : 0;
      const hasClip = kind === "video" && !!body.hasClip;
      const hasAvatar = kind === "video" && !!body.hasAvatar;
      const hasAudio = kind === "video" && !!body.hasAudio;
      // On Seedance a clip is a @Video1 REFERENCE (reference-to-video), not an
      // edit source — so it takes the full from-scratch prompt writer, not the
      // short edit-instruction path.
      const clipIsSeedanceRef = hasClip && /seedance/.test(genModel);
      // On Veo a clip is an EXTEND (+7s continuation from the final frame) —
      // neither an edit nor a reference, so it gets its own continuation
      // writer: describe ONLY the new 7 seconds, never re-narrate the clip.
      const veoExtend = hasClip && !clipIsSeedanceRef && /veo/.test(genModel);
      const refCount = Math.min(9, Math.max(0, Math.round(+body.refCount) || 0));
      const elCount = Math.min(4, Math.max(0, Math.round(+body.elCount) || 0));
      // Kling multi-shot (shot-list) rides the text-to-video AND image-to-video
      // endpoints (schema-verified 2026-07-16) — so a start image / end frame
      // still allows shots. A clip routes to o3's edit endpoint (no
      // multi_prompt), so a clip disables them. When capable, the composer MAY
      // return a `shots` array instead of relying on one continuous prompt.
      const shotsCapable = kind === "video" &&
        /kling-video\/(?:o3\/pro|o3\/standard|v3\/pro|v3\/standard)\/text-to-video$/.test(genModel) &&
        !hasClip && !hasAvatar && !hasAudio &&
        // o3's reference endpoint takes multi_prompt too; v3 has no ref mode.
        (!refCount || /\/o3\//.test(genModel));
      // Director-driven knobs (owner's call: the AI sets these from the user's
      // words, no new UI). negative: only Kling v3 and Veo have a real
      // negative_prompt field. tune: ElevenLabs voice delivery. (Sound is NOT
      // director-driven — owner rule 2026-07-17, it follows the user's Sound
      // toggle only; soundCapable below is just the model's capability flag.)
      const soundCapable = kind === "video" && /seedance|kling-video\/(?:o3|v3)|veo/.test(genModel);
      const negCapable = kind === "video" && /kling-video\/v3|veo/.test(genModel);
      // cfg_scale exists only on Kling v3 (pro/standard) — o3's schema lacks it.
      const cfgCapable = kind === "video" && /kling-video\/v3/.test(genModel);
      // bitrate_mode exists on Seedance full + fast (not mini). Price-free.
      const bitrateCapable = kind === "video" && /^bytedance\/seedance/.test(genModel) && !/\/mini\//.test(genModel);
      const tuneCapable = kind === "audio" && /elevenlabs/.test(genModel);
      const tuneFull = tuneCapable && !/eleven-v3/.test(genModel); // v3 accepts stability only
      // The attached images themselves (downscaled by the client) so the
      // director can look at them — ALL of them, in panel order, or "edit
      // image 5" gets planned against image 1. Per-image ~2.8M base64 chars
      // (≈2MB binary) and ~12M total keep the API request bounded.
      const imageBlocks = [];
      if (kind !== "audio") {
        const list = Array.isArray(body.images) ? body.images.slice(0, 16)
          : body.image != null ? [body.image] : [];
        let total = 0;
        for (const s of list) {
          if (typeof s !== "string" || s.length > 2800000) continue;
          const m = s.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
          if (!m) continue;
          total += s.length;
          if (total > 12_000_000) break;
          imageBlocks.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
        }
      }
      const genDuration = Number.isFinite(+body.duration) ? Math.min(30, Math.max(1, Math.round(+body.duration))) : 0;
      const genRatio = typeof body.ratio === "string" ? body.ratio.slice(0, 10) : "";
      // Effort switch: how long and detailed the written prompt should be.
      const effort = ["low", "high", "ultra", "max"].includes(body.effort) ? body.effort : "medium";
      // Prompt-help mode (auto | plan) — the ask step never asks questions
      // anymore; qmode is reserved for the Plan-mode flow.
      const qmode = body.qmode === "auto" || body.qmode === "plan" ? body.qmode : "";
      void qmode;
      // Effort sets DEPTH, never a recipe: no level prescribes which areas to
      // cover, so two prompts at the same level read like two different
      // directors, not one template.
      // An EDIT re-renders media the model already has (a video clip, or a
      // source image being edited), so the effort/depth ladder — which drives
      // 100-330 word from-scratch treatments — does NOT apply. Any edit wants a
      // short, direct instruction stating only the change. This covers every
      // edit model (Kling o3 / Ray / Gemini / Veo v2v, plus image editing),
      // not just video-to-video. NB: a start image for image-TO-video is NOT an
      // edit — the model generates new motion, so that keeps the full ladder.
      const isEdit = (hasClip && !clipIsSeedanceRef) || (kind === "image" && hasImage);
      // Edits follow the effort dial too (owner's call, 2026-07-16) — but depth
      // on an edit means detailing the CHANGE, never re-describing the source
      // (that invites the model to repaint untouched content).
      const effortLine = isEdit
        ? (effort === "low"
          ? `\nThis is an EDIT of media the model already has. Effort: LOW — ONE plain sentence (~10-25 words) stating only the change. Never re-describe the source.`
          : effort === "medium"
          ? `\nThis is an EDIT of media the model already has — keep it SHORT: one or two plain sentences (~15-45 words) stating only the change. No elaborate treatment, no re-describing the source, no length padding.`
          : `\nThis is an EDIT of media the model already has. Effort: ${effort.toUpperCase()} — write a DETAILED edit instruction (~60-140 words): specify the change precisely (the new content's look, materials, palette, lighting and how it integrates with what stays — shadows, reflections, color spill, edge quality) and close by naming exactly what must remain untouched. All that detail goes on the CHANGE — never re-describe unchanged parts of the source, which invites the model to repaint them.`)
        : kind === "audio" ? "" : effort === "low"
        ? `\nEffort: LOW — a quick take. 1-2 tight sentences (30-50 words): the idea at its purest — subject, action, setting, one defining style note. Keep the non-negotiables (camera named, on-screen text pinned) and let the model improvise everything else.`
        : effort === "high"
        ? `\nEffort: HIGH — real craft, 120-180 words. Go deep on whatever THIS shot needs most — that might be light, motion, texture, framing, mood, timing, or something else entirely; you choose, the shot decides. Every sentence must add new concrete visual information. Never pad, and never run through a checklist.`
        : effort === "ultra"
        ? `\nEffort: ULTRA HIGH — 180-250 words of serious direction. Pick the few dimensions that matter most to this particular shot and develop them until they're vivid and specific; leave the rest to the model. Different requests deserve different obsessions — never write the same shape of prompt twice.`
        : effort === "max"
        ? `\nEffort: MAX — 250-330 words, the full director's treatment. Go as deep as this shot deserves, wherever it deserves it: whatever a great director would fixate on for THIS ${kind === "video" ? "scene" : "image"}, fixate on that. There is no required list of topics — two MAX prompts for two different ideas should read like two different directors at work. Depth over coverage: never pad, never template.`
        : `\nEffort: MEDIUM — one tight paragraph, roughly 60-100 words: enough direction to land the shot without over-constraining the model.`;

      // Different model families respond to different prompt styles.
      const familyHint = /seedance/.test(genModel)
        ? "The target model rewards precise cinematic shot language — explicit camera, lighting and texture terms."
        : /kling/.test(genModel)
        ? "The target model wants subject + action in plain direct sentences, and preserves stylized/2D art well when told to keep the art style exactly."
        : /veo|sora/.test(genModel)
        ? "The target model wants flowing natural sentences describing one clear continuous scene."
        : /hailuo|minimax/.test(genModel)
        ? "The target model adds motion aggressively — use calm, restrained motion words unless drama is wanted."
        : /grok/.test(genModel)
        ? "The target model does best with short, concrete prompts."
        : "";

      const ctxBits = [];
      if (genModel) ctxBits.push(`target model: ${genModelLabel}`);
      if (kind === "video" && genDuration && !veoExtend) ctxBits.push(`clip length: ${genDuration}s`);
      if (veoExtend) ctxBits.push("this run EXTENDS the attached clip by a fixed 7 seconds (any other duration setting does not apply)");
      if (genRatio) ctxBits.push(`aspect ratio: ${genRatio}`);
      if (kind !== "audio") {
        if (imageCount > 1) ctxBits.push(`${imageCount} reference images attached — ${kind === "image" ? "refer to each by position (the first image, the second image, …)" : "cite each as @Image1…@Image" + imageCount + " and use them all"}`);
        else ctxBits.push(hasImage ? "a start image IS attached" : "no start image attached");
        if (hasEnd) ctxBits.push("an end frame IS attached");
        const vidRefN = clipIsSeedanceRef ? Math.min(3, Math.max(1, Math.round(+body.vidRefCount) || 1)) : 0;
      const audRefN = clipIsSeedanceRef || (kind === "video" && /seedance/.test(genModel)) ? Math.min(3, Math.max(0, Math.round(+body.audRefCount) || 0)) : 0;
      if (hasClip) ctxBits.push(clipIsSeedanceRef ? (vidRefN > 1 ? `${vidRefN} video clips ARE attached as references — cite them as @Video1…@Video${vidRefN}` : "a video clip IS attached as a @Video1 reference") : veoExtend ? "a source video clip IS attached (extend: +7s continuation)" : "a source video clip IS attached (video-to-video edit)");
      if (audRefN > 1) ctxBits.push(`${audRefN} audio references attached — cite them as @Audio1…@Audio${audRefN}`);
        if (hasAvatar) ctxBits.push("an avatar face image IS attached");
        if (hasAudio) ctxBits.push("an audio track IS attached (lip-sync / soundtrack)");
        if (refCount) ctxBits.push(`${refCount} reference image${refCount > 1 ? "s" : ""} attached`);
      }
      const ctxLine = ctxBits.join(" · ");
      // Multi-image edit/combine guidance (Nano/GPT take several images). The
      // edit branch below is written for a single source; when >1 is attached,
      // tell the writer to describe each image's role by POSITION.
      const multiImgLine = imageCount > 1
        ? (kind === "image"
          ? `\n- ${imageCount} REFERENCE images are attached (the user's "Reference to image" row — references build a NEW image; there is no edit base, that would be a single "Edit image" instead). They are shown to you labeled "Image 1"…"Image ${imageCount}" in the panel's order — when the user says "image 5" they mean the one labeled Image 5; LOOK at it before describing it, and never assume it's the first one. Set the \`useImages\` field to the panel numbers this request involves, in the order you reference them — the model receives exactly those images in that order. Refer to them in the prompt by position IN THAT SELECTION ("the first image" = the first number in useImages), never by @Image tag. Describe the image to create and say clearly what to take from each reference. DEFAULT TO ALL of them — the user attached each reference on purpose, so an open brief means every attached image goes in. Narrow the selection ONLY when the user's own words single out specific images ("edit image 10", "just the product and the woman"); never drop references on your own judgment.`
          : `\n- ${imageCount} REFERENCE images are attached (the user's "Reference to video" row — each subject/identity carries into the generated scene). They are shown to you labeled "Image 1"…"Image ${imageCount}" in the panel's order — LOOK at each one before writing; when the user says "image 2" they mean the one labeled Image 2. Write ONE scene that features ALL of them, citing the tags @Image1…@Image${imageCount} where each subject appears and saying what each contributes ("@Image1's truck rolls past as @Image2's riders watch"). USE EVERY reference — the user attached each on purpose; leave one out ONLY when the user's own words exclude it, never on your own judgment.`)
        : "";
      // No image model here can output a real transparent (alpha) background —
      // files come back opaque, and a "transparent background" prompt only
      // paints a fake grey checkerboard INTO the picture. Steer to the closest
      // honest thing and make the reply say so.
      const transparencyLine = kind === "image"
        ? `\n- TRANSPARENCY LIMIT: no available model can produce a truly transparent (alpha) background — asking for one just paints a fake checkerboard pattern into the image. If the user asks for a transparent/no background, write the prompt for a clean solid pure-white seamless studio background (or another solid color they prefer) instead, and say in the reply that true transparency isn't possible here — they get a clean solid-background cutout.`
        : "";
      // References work differently per family. Seedance binds each reference by
      // an @-tag written INTO the prompt; Veo uses them holistically for identity.
      const refLine = (refCount && kind === "video")
        ? (/seedance|kling-video\/o3|gemini/.test(genModel)
          ? `\nThe user attached ${refCount} reference image${refCount > 1 ? "s" : ""} for a reference-to-video generation. This model binds references by tag: cite them in the prompt as ${Array.from({ length: refCount }, (_, i) => "@Image" + (i + 1)).join(", ")} (1-indexed, in order), weaving each tag naturally into the sentence where that subject or element should appear (e.g. "the character from @Image1 walks through @Image2"). Reference them by tag rather than re-describing them as if generating from scratch.${/kling/.test(genModel) ? " If you also return a `shots` list, cite the @ImageN tags inside the shot prompts the same way." : ""}`
          : `\nThe user attached ${refCount} reference image${refCount > 1 ? "s" : ""} to hold the subject's identity — write the scene their request describes; the references supply what the subject looks like, so don't over-specify the subject's appearance in words. The UI labels them @Image1…@Image${refCount} in order, so if the user's message cites @ImageN, that's the reference they mean — refer to it naturally in the prompt (e.g. "the subject from reference image ${refCount > 1 ? "N" : "1"}"), not by tag.`)
        : "";
      // Kling character elements (@ElementN): each holds a character/object's
      // IDENTITY across the video — different from style refs (@ImageN).
      const elLine = (elCount && kind === "video")
        ? `\nThe user attached ${elCount} character element${elCount > 1 ? "s" : ""} — image${elCount > 1 ? "s" : ""} of specific characters/objects whose exact identity must appear in the video. Cite them as ${Array.from({ length: elCount }, (_, i) => "@Element" + (i + 1)).join(", ")} (1-indexed, in order), weaving each tag into the sentence where that character acts (e.g. "@Element1 walks in and hands @Element2 the keys"). Don't re-describe their appearance — the tag carries it. If you return a \`shots\` list, cite the @ElementN tags inside the shot prompts the same way.`
        : "";
      // Seedance video reference (@Video1…@VideoN): clips whose motion/subject
      // carries into a fresh generated scene. Cite each by tag, like the image
      // refs — the guidance pluralizes to match the ctx line when >1 is staged
      // (else extra clips go uncited/inert). 2026-07-18.
      const vidRefLine = clipIsSeedanceRef
        ? (vidRefN > 1
          ? `\nThe user also attached ${vidRefN} VIDEO clips as references (labelled @Video1…@Video${vidRefN}). Seedance binds them by tag: weave EACH @VideoN into the prompt where that clip's motion, subject or framing should carry into the scene (e.g. "the trucks weave like @Video1, lit like @Video2"). Cite them by tag rather than re-describing the clips; the model receives all the footage — leave none uncited.`
          : `\nThe user also attached a VIDEO clip as a reference (labelled @Video1). Seedance binds it by tag: weave @Video1 into the prompt where that clip's motion, subject or framing should carry into the scene (e.g. "the trucks weave like @Video1"). Cite it by tag rather than re-describing the clip; the model receives the footage.`)
        : "";
      // Kling multi-shot: the model can render a cut sequence of distinct shots.
      const shotsLine = shotsCapable
        ? `\nMULTI-SHOT: this model can CUT between several shots in one video. If — and ONLY if — the user wants a sequence that cuts between distinct shots (a montage, a multi-beat ad, changing scenes/subjects), return the \`shots\` array: 2-5 shots, each a full self-contained prompt plus a 2-10s duration, repeating any recurring character/setting description WORD-FOR-WORD across shots so they stay consistent. For a single continuous shot, omit \`shots\` entirely and just write the one prompt.${hasImage || hasEnd ? " An attached start/end frame still applies — the sequence opens on the attached start image (write shot 1 to grow out of it) and/or lands on the end frame." : ""}`
        : "";
      // Recent conversation so the director remembers what was said.
      const history = Array.isArray(body.history)
        ? body.history
            .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.text === "string")
            .slice(-8)
            .map((h) => ({ role: h.role, content: h.text.slice(0, 400) }))
        : [];

      const briefLine = brief
        ? `\nThis chat's running creative brief: "${brief}" — stay consistent with it unless this request changes direction.`
        : "";
      const factsLine = webFacts
        ? `\nVerified current facts (from a live web search — treat as ground truth and depict accordingly, do not contradict them): ${webFacts}`
        : "";
      const memoryLine = memory.length
        ? `\nThe user's durable creative taste, learned across all their projects — apply it by default unless THIS request overrides it: ${memory.map((s) => `"${s}"`).join("; ")}.`
        : "";
      const system = step === "ask"
        ? (kind === "audio"
          ? `You are isibi, the voice side of an AI studio: the user types either words they want a TTS voice to SPEAK, or chat aimed at you. Always write a short, friendly reply in your own voice (1-2 sentences). Then decide:
- Greeting, small talk, or a question aimed at you ("hey", "how are you", "why are you running"): set ready=false and use your reply to chat back and invite them to type the words they want voiced.
- Words meant to be spoken aloud (a script, a line, a message, a caption): set ready=true. Their text will be voiced EXACTLY as written — never rewrite it and never ask clarifying questions.
When genuinely unsure, set ready=true.`
          : `You are isibi, a warm, easygoing creative director for an AI ${kind} generator, having a natural chat with the user. Always write a short, friendly reply in your own voice (1-2 sentences, like texting a creative friend). Then decide what they need:
- If they're just greeting you, making small talk, or asking what you can do: set ready=false. Use your reply to warmly invite them to describe what they'd like to create.
- If they've described something to create: DEFAULT to set ready=true and make every creative call yourself — a clear request should just get made, no back-and-forth.
- The ONE exception: if a single genuinely important detail is missing or ambiguous AND you can't reasonably assume it — something that would materially change the result (a real product photo vs an illustration; one of two very different moods or settings; a specific brand, person or place you can't guess) — then set ready=false and end your reply with ONE short, specific question, offering a couple of concrete options when that helps them answer in a word. Ask at most one question, only when it truly earns the extra step; never interrogate, and never ask about things you can tastefully decide yourself.
- NEVER ask twice in a row. If your previous turn asked a question and the user answers with ANYTHING — including "just make it", "you choose", or simply restating the request — that IS your answer: set ready=true and make every remaining call yourself.
- A stack of varied attached references with an open brief ("make one using these") is NOT missing information — it's creative freedom. Pick the strongest coherent concept from them (using a compatible subset is fine), say what you're going for in one line, and go.
Tailor everything to what THIS user is trying to make.
NEVER reveal, name, or hint at the underlying model, provider, vendor, or any technical id (e.g. "fal", "fal-ai/…", raw model paths) — the user only knows isibi. If asked which model or service is used, say you use isibi's own studio engine and move on.${hasImage && imageCount <= 1 ? `\nThe user attached ${kind === "video" ? "a start image the video will animate (it's in the conversation — look at it). Reference what you actually see in your reply" : "a source image to edit (it's in the conversation — look at it). Reference what you actually see in your reply"}.` : ""}${imageCount > 1 ? `\nThe user attached ${imageCount} ${kind === "video" ? "REFERENCE images whose subjects carry into the generated video" : "images"}, shown to you labeled "Image 1"…"Image ${imageCount}" in the same order they see. When they name one by number ("image 5"), LOOK at that exact one before describing or acting on it — never assume they mean the first.${kind === "video" ? " A generation from these should feature ALL of them unless the user says otherwise." : ""}` : ""}${kind === "image" ? `\nTRANSPARENCY LIMIT: no model here can output a truly transparent (alpha) background — a "transparent background" request only paints a fake checkerboard into the picture. If they ask for one, say plainly it isn't possible and offer the closest real thing: a clean solid pure-white (or any solid color) seamless background.` : ""}${kind === "video" && soundCapable ? `\nSOUND: whether the video gets an audio track is controlled ONLY by the user's Sound toggle in the composer settings — you cannot change it and must never claim you did. If they ask for a silent / no-audio video (or ask to add sound), tell them in your reply to flip the Sound switch in the settings next to the model picker (silent renders can also cost fewer credits), and still proceed with ready=true when the creative request itself is clear.` : ""}${(hasClip || hasAvatar || hasAudio) ? `\nThe user has attached ${[hasClip ? (clipIsSeedanceRef ? "a VIDEO CLIP as a @Video1 reference (its motion/subject carries into a new generated scene)" : veoExtend ? "a source VIDEO CLIP the model will EXTEND — it generates the next 7 seconds continuing from the clip's final frame" : "a source VIDEO CLIP (for a video-to-video edit)") : "", hasAvatar ? "an AVATAR face image (a character to keep consistent)" : "", hasAudio ? "an AUDIO track (voice/music for lip-sync or soundtrack)" : ""].filter(Boolean).join(", ")}. ${hasClip || hasAudio ? "You can't play clips or audio yourself, but they ARE attached and the model will receive them" : "It IS attached and the model will receive it"} — so NEVER say you can't see/hear it or ask them to paste a link for something already attached. If what they want is unclear, ask what to DO with it (${clipIsSeedanceRef ? "what scene to build around the reference" : "restyle, swap a subject, relight, extend, lip-sync"}), not for the file itself.` : ""}${prevPrompt ? `\nThe user's PREVIOUS generation ran with this prompt: "${prevPrompt.slice(0, 600)}". Read their message against it and pick ONE signal:
- rerun=true if they want that same generation run again UNCHANGED, however they phrase it ("try again", "run it back", "didn't come out, go again", "one more", "do that again") — use your reply to say you're running it again.
- revise=true if they want it CHANGED — feedback or a tweak on the result ("slower", "fix the text", "make it brighter", "again but at night") — use your reply to acknowledge the fix.
- both false if it's a brand-new idea or just chat.` : ""}${brief ? `\nThis chat's running creative brief: "${brief}" — use it to make replies specific to this project.` : ""}${memoryLine}
Also maintain the user's durable creative taste (the \`memory\` field): learn from what they SAY here, not only what they generate. If this message reveals a lasting preference — a look, format, subject, or a standing do/don't they gravitate to — fold it into the full updated memory list (deduped, ≤12 short phrases, no one-off project specifics); otherwise leave it unchanged or omit it.${ctxLine ? `\nContext: ${ctxLine}` : ""}`)
        : step === "studio"
        ? `You are isibi, the director of a shot-based video studio. The user's project is an ordered list of SHOTS — each shot is either one AI video generation (3-10s) or a slice of an imported video. You act by returning actions; the app executes them.

Current shots (JSON): ${JSON.stringify(shotsCtx)}
${brief ? `Project brief: "${brief}"` : "No project brief yet."}

Rules:
- When the user describes a film, ad or sequence: break it into 3-8 shots via one add_shots action. Each shot gets a short title, a duration (3-10s), and a full generation prompt following video craft: one continuous shot, explicit camera work, concrete visual language, on-screen text pinned as never changing.
- CONSISTENCY: describe each character and setting ONCE in the brief, then repeat those descriptions WORD-FOR-WORD in every shot prompt that features them — verbatim repetition is what keeps AI characters consistent across shots.
- Always return an updated brief (1-3 sentences: cast, setting, style) when shots are added or changed.
- update_shot (by n) changes prompt/title/duration. It also carries FREE on-device edits that render a real new clip in the browser (no credits, works on any ready shot — generated OR imported): trim {start,end} (seconds within the shot) to shorten it; speed (2 = twice as fast, 0.5 = slow motion, range 0.25-4); reframe ('9:16','1:1','4:5','16:9') to re-crop the aspect, e.g. '9:16' for vertical TikTok/Reels; text {content, position:'bottom'|'top'|'center'} to burn a short caption onto the shot. These act on the shot's existing video — use them when the user asks to cut/trim/speed up/slow down/make vertical/square/add a caption or title, and they do NOT require regeneration. Rewriting a generated shot's prompt, by contrast, means it must be regenerated — mention that.
- Export/download: the app stitches all ready shots into one film (Export button) entirely on-device, orientation-aware — the user doesn't need an action for it, but you can point them to Export when the film is ready. Use export_style {transition:'crossfade'|'dip'|'none', fade:bool} to set how the film is stitched when the user asks for transitions/crossfades/dissolves between shots or a fade in/out — it applies to the whole film at Export (default is hard cuts, no fade).
- generate (n, or "all" for every draft) ONLY when the user explicitly asks to generate/run/make the shots — generation costs money; never trigger it uninvited.
- reply: short and friendly, reference shots by number. If the user is just chatting or asking, reply with no actions.${ctxLine ? `\nContext: ${ctxLine}` : ""}`
        : step === "error"
        ? `You are isibi, a warm creative director for an AI ${kind} studio. The user's generation just failed. From the raw pipeline error, explain in 1-2 friendly plain-language sentences what went wrong and what to do next — no jargon, no error codes, never blame the user. NEVER name any backend provider, vendor, or platform the raw error mentions (fal, fal.ai, replicate, etc.) and never point the user to an external dashboard or billing page — the user only knows isibi; call the infrastructure "our render servers" and for balance/capacity problems say generations are briefly paused and to check back soon. NEVER say the user's account, credits, or balance ran out unless the raw error literally says "not enough credits" — platform balance problems are OUR infrastructure, not theirs, and misblaming the user's credits steers them to buy credits they don't need. If — and ONLY if — rewording the prompt could fix it (content filter, prompt rejected as invalid), also return fixedPrompt: the failed prompt minimally reworded to avoid the trigger while keeping the creative intent. For balance, quota, timeout or model-availability problems, return no fixedPrompt.${ctxLine ? `\nContext: ${ctxLine}` : ""}`
        : step === "revise"
        ? `You are the prompt writer for isibi, an AI ${kind} studio. The user generated a ${kind} with the previous prompt below and wants it adjusted. Rewrite the prompt applying ONLY what their feedback asks — keep every untouched part as close to word-for-word as possible, so the change is surgical, not a fresh rewrite. Return a single paragraph, nothing but the prompt.

Fix patterns:
- Mangled or morphing on-screen text → pin it harder: all text stays exactly as printed, never changing.
- Too much, too fast or wrong motion → name the camera explicitly and calm the action verbs.
- Style drift on an animated image → state the art style is preserved exactly, with no smoothing.
- Feels rushed or overstuffed → cut to one or two beats of motion${veoExtend ? " for the 7s extension" : genDuration ? ` for the ${genDuration}s clip` : ""}.${familyHint ? `
- ${familyHint}` : ""}

Previous prompt:
${prevPrompt}
${briefLine}${memoryLine}${refLine ? refLine + " Preserve the existing @ImageN tags exactly." : ""}
Context: ${ctxLine}`
        : kind === "video" && veoExtend
        ? `You are the continuation writer for isibi, an AI video studio. A source VIDEO CLIP is already attached and the model will EXTEND it — generating the NEXT 7 SECONDS that continue seamlessly from the clip's final frame. The model can already see the whole clip, so NEVER re-describe, re-narrate or re-establish anything that already happens in it — re-describing wastes the prompt on footage that already exists and makes the model try to replay those events, which causes glitchy, morphing extensions.

Write ONE paragraph describing ONLY the new 7 seconds of action: open from the exact state of the final frame ("from where he lands…", "as the car finishes turning…"), then one or two beats of NEW motion in the same tone, camera and art style as the clip — only state tone/camera/style when the user asks to CHANGE them. Any on-screen text stays exactly as printed. Never mention a total clip length — the extension is always 7 seconds of new footage. Phrase everything to pass strict automated content checkers (no visceral/fleshy or harm/impact wording when a neutral or comedic phrasing carries the same picture). Return nothing but the prompt.

Example of the register (never copy its content): "From where he lands in a heap, he slowly picks himself up, dusts off the dress, and strikes a triumphant little pose as the dust settles around him — same locked-off camera, same lighthearted cartoon tone."${familyHint ? `
- ${familyHint}` : ""}${effortLine}${briefLine}${memoryLine}
Context: ${ctxLine}`
        : kind === "video" && hasClip && !clipIsSeedanceRef
        ? `You are the edit writer for isibi, an AI video-to-video studio. A source VIDEO CLIP is already attached and the model will re-render THAT footage — this is an EDIT, not a new generation. The model can already see the clip, so never re-describe what's in it.

Write ONE direct instruction that states ONLY the change to apply: the new look, style, lighting, colour grade, or an element to swap. Name what to KEEP from the original vs. what to CHANGE. Its LENGTH follows the Effort line below — but at every effort the words go on the CHANGE, never on narrating the source footage. Return nothing but the instruction.

Examples of the register (never copy their content): "Restyle the footage into a polished, photoreal cinematic AI look — cleaner textures, warmer light — while keeping the exact framing, motion and timing." · "Keep everything as-is but relight the scene for golden-hour warmth." · "Swap the car for a red vintage convertible; leave the road, motion and background unchanged."${familyHint ? `
- ${familyHint}` : ""}${effortLine}${briefLine}${memoryLine}${refLine}
Context: ${ctxLine}`
        : kind === "video"
        ? `You are the prompt writer for isibi, an AI video studio. Using the conversation, the request and the user's picks, write ONE video-generation prompt: a single paragraph of concrete visual language — no lists, no headers, nothing but the prompt.

Craft rules:
- One continuous shot. Describe a single scene with continuous action — no cuts, montages or scene changes unless the user asked for them.
- Name the camera work explicitly (locked-off static, slow push-in, handheld, orbit). If the user wants a loop or a background, open with "Fixed camera, no camera movement" and keep all motion ambient and cyclical.
- Budget the action to the clip length${genDuration ? ` (${genDuration}s)` : ""}: one or two beats of motion, not a story arc — overstuffed prompts cause rushed, morphing results.
- Any visible text, logos or signage: state explicitly that they stay exactly as printed, never changing — video models mangle text that is allowed to move.
- Video models run STRICT automated content checkers that reject the whole render on trigger words, even in innocent prompts. Phrase everything to pass: skip gratuitously visceral or fleshy wording (grotesque, wet/slimy flesh, grafted body parts, gore adjectives) and words for harm or impact (violent falls, crushing, striking people) when a neutral or comedic phrasing carries the same picture — "lands in a soft comedic heap", not "slams into the ground".
${hasImage
  ? `- A start image IS attached (it's in the conversation — look at it): the model animates that image. Do NOT re-describe what is already in the picture (re-describing causes drift and morphing). Name its actual contents concretely as "the ..." ("the man leaning on the red car", not "the subject") and describe ONLY what moves and how, plus what must stay still. If the image has a distinct art style (anime, pixel art, illustration), say the style must be preserved exactly, with no smoothing.${hasEnd ? `
- An end frame IS attached: the clip must land back on that frame — keep the motion gentle and cyclical so the return feels natural, never a hard change of state.` : ""}`
  : `- No start image: paint the full scene — subject, action, setting, lighting, mood, in that order, each in concrete visual terms.`}${familyHint ? `
- ${familyHint}` : ""}

Example of the register (never copy its content): "Fixed camera, no camera movement. Steady rain falls on a neon-lit alley at night; puddles ripple, steam drifts from the food stall, the paper lantern sways gently. The cook flips noodles in one small motion. All signage stays exactly as printed. Cinematic, moody, photorealistic."
${effortLine}${briefLine}${factsLine}${memoryLine}${refLine}${elLine}${vidRefLine}${shotsLine}
Context: ${ctxLine}`
        : kind === "image" && hasImage
        ? `You are the edit writer for isibi, an AI image-editing studio. A source IMAGE is already attached (it's in the conversation — look at it) and the model will edit THAT picture — this is an EDIT, not a new generation. The model can already see it, so never re-describe the rest of the image.

Write ONE direct instruction that states ONLY the change to make: name the existing content concretely as "the ..." ("the red car", not "the subject") and say exactly what to change or add. Its LENGTH follows the Effort line below — but at every effort the words go on the CHANGE (and what must stay untouched), never on re-describing the rest of the picture. Return nothing but the instruction.

Examples of the register (never copy their content): "Change the sky behind the building to a dramatic orange sunset; leave everything else untouched." · "Turn the man's jacket red and add subtle rain on the window." · "Restyle the photo into a soft watercolour painting while keeping the composition exactly."${familyHint ? `
- ${familyHint}` : ""}${effortLine}${transparencyLine}${briefLine}${memoryLine}
Context: ${ctxLine}`
        : kind === "image"
        ? `You are the prompt writer for isibi, an AI image studio. Using the conversation, the request and the user's picks, write ONE image-generation prompt: a single paragraph — no lists, nothing but the prompt.

Craft rules:
- Name the medium and style explicitly (photograph, cinematic still, oil painting, anime, pixel art...) — unstated style yields generic digital art.
- Cover subject, composition and framing, lighting and palette, in concrete visual terms.
- If words should appear in the image, give them verbatim in quotes and say where they sit.
${familyHint ? `
- ${familyHint}` : ""}
${effortLine}${multiImgLine}${transparencyLine}${briefLine}${factsLine}${memoryLine}
Context: ${ctxLine}`
        : `You are the script writer for isibi, an AI text-to-speech voice studio. Your output is spoken ALOUD, verbatim, by a voice actor — so return ONLY what should be heard (the words and/or vocal sounds), nothing else: no quotes, no stage notes, no "make an audio of…", and NEVER repeat the user's instruction back to them.
- If the user gives words to say, return exactly those words, lightly cleaned and punctuated for natural delivery.
- If the user asks for a vocal SOUND rather than words (a scream, laugh, sob, gasp, sigh, whisper, moan), render it as a performable vocalization${/eleven-v3/.test(genModel) ? ` using ElevenLabs v3 audio tags in square brackets — e.g. a woman screaming → "[screams] Aaaaaahhh!", a laugh → "[laughs] Haha, no way!", a whisper → "[whispers] come closer…".` : ` written as onomatopoeia the voice can actually perform — e.g. a scream → "Aaaaaaahhhh!", a laugh → "Hahaha!".`}
- If their phrasing asks for a DELIVERY change, set the matching tool fields (${tuneFull ? "speed: 0.8 slow / 1.15 fast; stability: ~0.3 emotional, ~0.85 steady; style: 0.6-0.9 expressive" : "stability: ~0.3 emotional/varied, ~0.85 steady"}); omit them all when the user didn't ask.
Return just the line to be voiced — keep it to what should actually come out of the speaker.`;

      const userMsg = step === "ask"
        ? `Request: ${prompt}`
        : step === "revise"
        ? `Feedback on the previous generation: ${prompt}`
        : step === "error"
        ? `Failed generation prompt: ${prompt}\nRaw error: ${errText || "(no detail)"}`
        : step === "studio"
        ? `Request: ${prompt}`
        : `Request: ${prompt}\nPicks: ${answers.length ? answers.join("; ") : "(none)"}`;

      // Build the message list: prior turns (merged so roles alternate and the
      // list starts with a user turn), then the current request.
      const turns = [];
      for (const h of history) {
        const last = turns[turns.length - 1];
        if (last && last.role === h.role) last.content += "\n" + h.content;
        else turns.push({ ...h });
      }
      while (turns.length && turns[0].role !== "user") turns.shift();
      const lastTurn = turns[turns.length - 1];
      if (lastTurn && lastTurn.role === "user") lastTurn.content += "\n" + userMsg;
      else turns.push({ role: "user", content: userMsg });
      // Put the attached images on the final user turn so the director sees
      // them. With several, each is labeled with its panel position so "the
      // fifth image" means the same thing to the user, the director and fal.
      if (imageBlocks.length) {
        const last = turns[turns.length - 1];
        const parts = [];
        if (imageBlocks.length === 1) parts.push(imageBlocks[0]);
        else imageBlocks.forEach((b, i) => parts.push({ type: "text", text: "Image " + (i + 1) + ":" }, b));
        parts.push({ type: "text", text: last.content });
        last.content = parts;
      }

      // Force a tool call so Sonnet returns validated structured output.
      const tool = step === "ask"
        ? {
            name: "respond",
            description: "Reply to the user and flag what kind of request this is.",
            input_schema: {
              type: "object",
              properties: {
                reply: { type: "string", description: "a short, friendly conversational message in isibi's voice" },
                ready: { type: "boolean", description: "true if the user has given an actual thing to create; false for greetings or small talk" },
                revise: { type: "boolean", description: "true if the user is asking to adjust the previous generation rather than describing something new" },
                rerun: { type: "boolean", description: "true if the user wants the previous generation run again unchanged, in whatever words" },
                needsWeb: { type: "boolean", description: "true ONLY if depicting this accurately needs current, real-world facts you may not reliably know — the newest/latest named products, recent events, real specs, prices, dates, or specific real people/places; false for generic or imaginative creative requests" },
                memory: {
                  type: "array",
                  items: { type: "string" },
                  description: "The user's DURABLE creative taste, learned across ALL their chats — short standing preferences that should shape future work (e.g. 'Cinematic, filmic color grading', 'Prefers vertical 9:16', 'Warm, moody lighting', 'Minimal on-screen text', 'Works on skincare/beauty content'). Learn from what the user SAYS in conversation too, not just what they generate. Return the FULL updated list (not a delta): carry forward what was given, fold in any lasting preference this message reveals, dedupe/merge, and DROP anything about one specific project or subject. Each item one short phrase, at most 12. Omit or return the list unchanged when this message reveals nothing new about lasting taste (greetings, small talk, one-off requests).",
                },
              },
              required: ["reply", "ready"],
            },
          }
        : step === "studio"
        ? {
            name: "direct_studio",
            description: "Reply to the user and return the actions to apply to the shot list.",
            input_schema: {
              type: "object",
              properties: {
                reply: { type: "string", description: "short, friendly reply referencing shots by number" },
                brief: { type: "string", description: "updated 1-3 sentence project brief: cast and setting described once, style, mood" },
                actions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["add_shots", "update_shot", "remove_shot", "reorder", "generate", "export_style"] },
                      shots: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            prompt: { type: "string", description: "full generation prompt for this shot" },
                            duration: { type: "number", description: "seconds, 3-10" },
                          },
                          required: ["prompt"],
                        },
                      },
                      n: { description: "shot number (1-based), or the string 'all' for generate" },
                      title: { type: "string" },
                      prompt: { type: "string" },
                      duration: { type: "number" },
                      trim: { type: "object", properties: { start: { type: "number" }, end: { type: "number" } }, description: "shorten a shot to [start,end] seconds — renders a real cut on-device" },
                      speed: { type: "number", description: "retime a shot on-device: 2 = twice as fast, 0.5 = slow motion. Range 0.25-4" },
                      reframe: { type: "string", description: "re-crop a shot to this aspect ratio on-device, centered — one of '9:16','1:1','4:5','16:9'" },
                      text: { type: "object", description: "burn a caption onto a shot on-device", properties: { content: { type: "string", description: "the caption text, kept short (a line or two)" }, position: { type: "string", enum: ["bottom", "top", "center"] } } },
                      order: { type: "array", items: { type: "integer" }, description: "new order as current shot numbers" },
                      transition: { type: "string", enum: ["crossfade", "dip", "none"], description: "for export_style: how shots blend at Export — crossfade, dip (to black), or none (hard cuts)" },
                      fade: { type: "boolean", description: "for export_style: fade the film in from and out to black at its start/end" },
                    },
                    required: ["type"],
                  },
                },
              },
              required: ["reply"],
            },
          }
        : step === "error"
        ? {
            name: "explain",
            description: "Explain the failure to the user and optionally offer a fixed prompt.",
            input_schema: {
              type: "object",
              properties: {
                reply: { type: "string", description: "1-2 friendly plain-language sentences about what went wrong and what to do" },
                fixedPrompt: { type: "string", description: "only when rewording the prompt could fix the failure: the minimally reworded prompt" },
              },
              required: ["reply"],
            },
          }
        : {
            name: "write_prompt",
            description: "Return the final generation prompt, the chat's updated creative brief, and the user's updated durable taste memory.",
            input_schema: {
              type: "object",
              properties: {
                prompt: { type: "string" },
                brief: { type: "string", description: "1-3 sentence updated running creative brief for this chat — subject, style, mood, standing constraints; carry forward what still holds, fold in what this request adds" },
                memory: {
                  type: "array",
                  items: { type: "string" },
                  description: "The user's DURABLE creative taste, learned across ALL their projects — short standing preferences that should apply to future generations (e.g. 'Cinematic, filmic color grading', 'Prefers vertical 9:16', 'Warm, moody lighting', 'Minimal on-screen text'). Return the FULL updated list (not a delta): carry forward what was given, fold in any durable preference THIS request reveals, dedupe and merge near-duplicates, and DROP anything project- or subject-specific (that belongs in the brief, not here). Each item one short phrase. Keep it tight — at most 12 items. Omit or return the list unchanged if this request reveals nothing new about lasting taste.",
                },
                ...(shotsCapable ? {
                  shots: {
                    type: "array",
                    description: "OPTIONAL multi-shot sequence. ONLY return this when the user clearly wants a video that CUTS between several distinct shots (a montage, a commercial with separate beats, 'cut between X and Y', a scene that changes location/subject) — NOT for a single continuous shot (leave it out then). This model renders the shots as one video, cutting between them. Keep it to 2-5 shots; each needs a second or two to read, so avoid rapid-fire cuts. For each shot write a full self-contained prompt (camera, subject, action, setting, lighting), each under ~120 words — repeat recurring characters/settings WORD-FOR-WORD across shots so they stay consistent — and a duration in seconds (2-10). Still fill the top-level `prompt` with a one-paragraph summary of the whole sequence (used as a fallback and for later revisions).",
                    items: {
                      type: "object",
                      properties: {
                        prompt: { type: "string", description: "Full generation prompt for this one shot" },
                        duration: { type: "integer", description: "Shot length in seconds (2-10)" },
                      },
                      required: ["prompt", "duration"],
                    },
                  },
                  shotType: { type: "string", enum: ["intelligent"], description: "ONLY when the user asks the MODEL to decide the cut structure itself ('let it direct the cuts', 'auto shots', 'cut it however feels right'): 'intelligent'. Never alongside a `shots` list (an explicit list already directs the cuts). Omit otherwise." },
                } : {}),
                ...(cfgCapable ? {
                  cfg: { type: "number", description: "ONLY when the user asks for stricter or looser prompt adherence ('follow my prompt exactly' → ~0.8, 'take creative liberties / go loose' → ~0.2): CFG scale 0-1. Omit otherwise — the model default (0.5) is right for normal requests." },
                } : {}),
                ...(kind === "image" && imageCount > 1 ? {
                  useImages: { type: "array", items: { type: "integer" }, description: `Panel numbers of the attached images this prompt actually USES, in the order you reference them — [10] for "edit image 10", [2,1] for "put image 2's product into image 1's scene". The model receives EXACTLY these images in this order, so any position words in your prompt ("the first image") mean positions in THIS list. Sending unused images bloats the request and can get the whole render refused — omit this only when the prompt genuinely needs every attached image.` },
                } : {}),
                ...(bitrateCapable ? {
                  bitrate: { type: "string", enum: ["high"], description: "ONLY when the user asks for maximum quality / a crisp master / high bitrate: 'high' (same price, larger file). Omit otherwise." },
                } : {}),
                ...(negCapable ? {
                  negative: { type: "string", description: "ONLY when the user names concrete things to EXCLUDE from the video ('no people', 'avoid on-screen text', 'no rain'): a short comma-separated list of those things. Omit entirely otherwise — do not invent exclusions." },
                } : {}),
                ...(tuneCapable ? {
                  stability: { type: "number", description: "ONLY when the user's phrasing asks for a delivery change: voice stability 0-1 (low ~0.3 = more emotional variation, high ~0.85 = steady/newsreader). Omit when unasked." },
                  ...(tuneFull ? {
                    speed: { type: "number", description: "ONLY when asked to speak slower/faster: 0.7-1.2 (0.8 = noticeably slow, 1.15 = brisk). Omit when unasked." },
                    style: { type: "number", description: "ONLY when asked for more expressiveness/drama: style exaggeration 0-1 (0.6-0.9 = expressive). Omit when unasked." },
                  } : {}),
                } : {}),
              },
              required: ["prompt"],
            },
          };

      // Shape the ask-step tool output into the API payload.
      // Flags only — reply plus intent booleans.
      const shapeAsk = (parsed) => ({
        reply: String(parsed.reply || "").slice(0, 500),
        ready: !!parsed.ready,
        rerun: !!parsed.rerun && !!prevPrompt && kind !== "audio",
        revise: !parsed.rerun && !!parsed.revise && !!prevPrompt && kind !== "audio",
        needsWeb: !!parsed.needsWeb && kind !== "audio",
        // Taste learned from the conversation itself (never from voice scripts).
        memory: kind !== "audio" && Array.isArray(parsed.memory)
          ? parsed.memory.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim().slice(0, 140)).slice(0, 12)
          : undefined,
      });

      const wantStream = body.stream === true && step === "ask";
      // Model split (A/B-verified): Sonnet earns its price ONLY on High/Ultra/Max
      // creative prompt-writing (compose/revise). Everything else runs on Haiku —
      // the routing/classification ask step (fires on every message), the
      // low-stakes error/studio steps, and Low/Medium prompt-writing — where an
      // A/B showed Haiku matches Sonnet on correctness at a fraction of the cost.
      // (Research runs Sonnet on its own web-search path above.)
      const dirModel =
        (step === "compose" || step === "revise") && (effort === "high" || effort === "ultra" || effort === "max")
          ? "claude-sonnet-5"
          : "claude-haiku-4-5";
      let r;
      try {
        r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: dirModel,
            // The ask step has thinking off and writes a short reply, so 1500
            // is plenty. The prompt-writing steps run Sonnet with adaptive
            // thinking, which shares the budget with the tool output — and a
            // multi-shot compose (up to 5 full shot prompts + summary + brief +
            // memory) can legitimately run 4-5k output tokens, so 4000 could
            // truncate the tool JSON and lose the whole (already-charged) call.
            // max_tokens is a ceiling, not a target: unused tokens aren't billed.
            max_tokens: step === "ask" ? 1500 : 8000,
            // Chat replies should feel instant; on the Sonnet prompt-writing
            // steps thinking stays on (adaptive), where it earns its latency.
            // Haiku ignores the omission — it simply runs without thinking.
            ...(step === "ask" ? { thinking: { type: "disabled" } } : {}),
            ...(wantStream ? { stream: true } : {}),
            system,
            tools: [tool],
            tool_choice: { type: "tool", name: tool.name },
            messages: turns,
          }),
          signal: AbortSignal.timeout(120000),
        });
      } catch {
        refundFee(); // the Claude call never happened — reverse the fee
        return Response.json({ error: "director request failed" }, { status: 502 });
      }

      // Streaming ask: forward isibi's reply as it's written, then the
      // full parsed payload as a final "done" event.
      if (wantStream && r.ok && r.body) {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const enc = new TextEncoder();
        const send = (obj) => writer.write(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
        const pump = (async () => {
          const reader = r.body.getReader();
          const dec = new TextDecoder();
          let sse = "", partial = "", sent = 0;
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              sse += dec.decode(value, { stream: true });
              let idx;
              while ((idx = sse.indexOf("\n\n")) !== -1) {
                const line = sse.slice(0, idx).split("\n").find((l) => l.startsWith("data: "));
                sse = sse.slice(idx + 2);
                if (!line) continue;
                let ev;
                try { ev = JSON.parse(line.slice(6)); } catch { continue; }
                if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "input_json_delta") {
                  partial += ev.delta.partial_json || "";
                  const reply = extractReplyPrefix(partial);
                  if (reply.length > sent) { await send({ d: reply.slice(sent, 500) }); sent = Math.min(reply.length, 500); }
                }
              }
            }
            let parsed = null;
            try { parsed = JSON.parse(partial); } catch {}
            if (!parsed) await creditBack(env, dirUser.id, dirCredits); // paid, no usable output
            await send(parsed ? { done: shapeAsk(parsed) } : { error: "director no output" });
          } catch {
            await creditBack(env, dirUser.id, dirCredits); // stream broke — reverse the fee
            try { await send({ error: "stream failed" }); } catch {}
          } finally {
            try { await writer.close(); } catch {}
          }
        })();
        if (ctx && ctx.waitUntil) ctx.waitUntil(pump);
        return new Response(readable, {
          headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
        });
      }

      const data = await r.json().catch(() => ({}));
      if (!r.ok) { refundFee(); return Response.json({ error: "director error" }, { status: 502 }); }

      const parsed = (data.content || []).find((c) => c.type === "tool_use")?.input;
      if (!parsed) { refundFee(); return Response.json({ error: "director no output" }, { status: 502 }); }

      if (step === "ask") return Response.json(shapeAsk(parsed));
      if (step === "error") {
        return Response.json({
          reply: String(parsed.reply || "").slice(0, 500),
          prompt: parsed.fixedPrompt ? String(parsed.fixedPrompt).slice(0, 2000) : undefined,
        });
      }
      if (step === "studio") {
        return Response.json({
          reply: String(parsed.reply || "").slice(0, 600),
          brief: parsed.brief ? String(parsed.brief).slice(0, 600) : undefined,
          actions: (Array.isArray(parsed.actions) ? parsed.actions : []).slice(0, 20),
        });
      }
      return Response.json({
        // 4000, not 2000: a Max-effort prompt plus research facts overshoots
        // 2000 and was getting chopped mid-word ("…quietly luxurious, wit").
        // Downstream per-model caps still apply at generation time.
        prompt: String(parsed.prompt || prompt).slice(0, 4000),
        brief: parsed.brief ? String(parsed.brief).slice(0, 600) : undefined,
        // Evolved durable taste, same cap/sanitize as the inbound list. Absent
        // when the model returned nothing new — the client keeps what it has.
        memory: Array.isArray(parsed.memory)
          ? parsed.memory.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim().slice(0, 140)).slice(0, 12)
          : undefined,
        // Multi-shot list (Kling t2v only). Only returned when the composer made
        // a genuine sequence (≥2 shots); durations clamped to 2-10s, ≤5 shots.
        shots: shotsCapable && Array.isArray(parsed.shots) && parsed.shots.length >= 2
          ? parsed.shots
              .filter((s) => s && typeof s.prompt === "string" && s.prompt.trim())
              .map((s) => ({ prompt: s.prompt.trim().slice(0, 2500), duration: Math.min(10, Math.max(2, Math.round(+s.duration) || 5)) }))
              .slice(0, 5)
          : undefined,
        // Director-driven knobs — only ever the restrictive direction (things
        // to exclude / delivery tweaks), sanitized to safe ranges. Sound is
        // NOT here (owner rule 2026-07-17): it has a chatbox toggle, and the
        // chatbox settings are authoritative — the director never sets them.
        negative: negCapable && typeof parsed.negative === "string" && parsed.negative.trim()
          ? parsed.negative.trim().slice(0, 300)
          : undefined,
        shotType: shotsCapable && parsed.shotType === "intelligent" && !(Array.isArray(parsed.shots) && parsed.shots.length >= 2) ? "intelligent" : undefined,
        // Which attached images the prompt actually uses (1-based panel
        // numbers, reference order) — lets the client send ONLY those.
        useImages: (kind === "image" && imageCount > 1 && Array.isArray(parsed.useImages))
          ? [...new Set(parsed.useImages.map((n) => Math.round(+n)).filter((n) => Number.isFinite(n) && n >= 1 && n <= imageCount))].slice(0, 16)
          : undefined,
        cfg: cfgCapable && typeof parsed.cfg === "number" && Number.isFinite(parsed.cfg) ? Math.min(1, Math.max(0, parsed.cfg)) : undefined,
        bitrate: bitrateCapable && parsed.bitrate === "high" ? "high" : undefined,
        stability: tuneCapable && Number.isFinite(+parsed.stability) ? Math.min(1, Math.max(0, +parsed.stability)) : undefined,
        speed: tuneFull && Number.isFinite(+parsed.speed) ? Math.min(1.2, Math.max(0.7, +parsed.speed)) : undefined,
        style: tuneFull && Number.isFinite(+parsed.style) ? Math.min(1, Math.max(0, +parsed.style)) : undefined,
      });
    }

    // Cancels a queued/running fal job with the server-side key, so stopping
    // a generation can also stop the spend (queued jobs never bill).
    if (url.pathname === "/api/cancel" && request.method === "POST") {
      if (!(await authUser(request))) return UNAUTHED();
      let body;
      try { body = await request.json(); } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400 });
      }
      const target = typeof body.url === "string" ? body.url : "";
      if (!/^https:\/\/queue\.fal\.run\/[^?#]+\/requests\/[^/?#]+\/cancel$/.test(target)) {
        return Response.json({ error: "invalid url" }, { status: 400 });
      }
      if (!env.FAL_KEY) return Response.json({ error: "unavailable" }, { status: 503 });
      try {
        const r = await fetch(target, { method: "PUT", headers: { Authorization: `Key ${env.FAL_KEY}` }, signal: AbortSignal.timeout(10000) });
        const data = await r.text();
        return new Response(data || "{}", { status: r.status, headers: { "Content-Type": "application/json" } });
      } catch {
        return Response.json({ error: "cancel failed" }, { status: 502 });
      }
    }

    // Refund a generation that fal never billed us for (the render failed). We
    // re-verify the terminal failure with fal ourselves — the client can't claim
    // a refund for a job that actually completed — then credit back the exact
    // recorded charge, idempotently. Mirrors fal's billing: no bill, no charge.
    if (url.pathname === "/api/refund" && request.method === "POST") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      let body;
      try { body = await request.json(); } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400 });
      }
      const statusUrl = typeof body.statusUrl === "string" ? body.statusUrl : "";
      const m = statusUrl.match(/^https:\/\/queue\.fal\.run\/[^?#]+\/requests\/([A-Za-z0-9_-]+)\/status\b/);
      if (!m) return Response.json({ error: "invalid url" }, { status: 400 });
      const requestId = m[1];
      if (!env.FAL_KEY || !env.SUPABASE_SERVICE_KEY) return Response.json({ refunded: 0 });
      // Confirm with fal that the job terminally failed (fal didn't bill us).
      let status = "";
      try {
        const r = await fetch(statusUrl, { headers: { Authorization: `Key ${env.FAL_KEY}` }, signal: AbortSignal.timeout(10000) });
        const st = await r.json().catch(() => ({}));
        status = String(st.status || "").toUpperCase();
      } catch {
        return Response.json({ error: "verify failed" }, { status: 502 });
      }
      if (!["FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(status)) {
        // A job can report COMPLETED yet carry a client-error RESULT (e.g. a 422
        // input-validation failure): fal doesn't bill those either, but the
        // status check alone misses them. Only COMPLETED earns this second look
        // — IN_QUEUE / IN_PROGRESS are genuinely still running.
        if (status !== "COMPLETED") {
          return Response.json({ refunded: 0 });
        }
        try {
          const resultUrl = statusUrl.replace(/\/status\b.*$/, "");
          const rr = await fetch(resultUrl, { headers: { Authorization: `Key ${env.FAL_KEY}` }, signal: AbortSignal.timeout(10000) });
          // 2xx = real output (don't refund); 5xx / network = transient (don't
          // refund, it may still be retrievable); only a 4xx client error means
          // the render terminally failed validation → fall through and refund.
          if (rr.status < 400 || rr.status >= 500) {
            return Response.json({ refunded: 0 });
          }
        } catch {
          return Response.json({ refunded: 0 });
        }
      }
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/refund_charge`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: env.SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ p_request_id: requestId, p_user: user.id }),
          signal: AbortSignal.timeout(10000),
        });
        const refunded = r.ok ? (Number(await r.json()) || 0) : 0;
        return Response.json({ refunded });
      } catch {
        return Response.json({ error: "refund failed" }, { status: 502 });
      }
    }

    // Fetch a user-pasted link server-side (no CORS) for the gallery's
    // Import-from-link box. A direct image/video/audio URL comes back as
    // base64 + kind, which the client hands to the normal /api/save path (so
    // the paid gate, GB cap, magic-byte checks, and watermarking all apply
    // unchanged). An HTML page gets ONE hop: its og:image / twitter:image /
    // <link image_src>, then the same rules. SSRF-guarded via safeFetch.
    if (url.pathname === "/api/import/fetch" && request.method === "POST") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      let body;
      try { body = await request.json(); } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400 });
      }
      const target = String((body && body.url) || "").trim();
      if (!/^https?:\/\//i.test(target)) return Response.json({ error: "invalid url" }, { status: 400 });
      // Rate-limit the FREE server-side fetch proxy too (not just the paid AI
      // rescue) — it was unmetered, giving any authed user an unlimited
      // ~29MB-per-call fetch relay (2026-07-17). Generous daily cap; fail-open.
      if (!(await useQuota(request, "import", 120))) return QUOTA_EXCEEDED();
      // A real browser UA — stores and CDNs 403 (or wall) obviously-bot agents.
      const PAGE_HDRS = {
        "User-Agent": CHROME_UA,
        Accept: "text/html,application/xhtml+xml,image/avif,image/webp,image/*,video/*,audio/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      };
      // Sized to fit under /api/save's base64 ceilings (12M/40M/20M chars).
      const MAXES = { image: 8_500_000, video: 29_000_000, audio: 14_000_000 };
      const ctOf = (resp) => ((resp && resp.headers.get("content-type")) || "").split(";")[0].trim().toLowerCase();
      let r;
      try { r = await safeFetch(target, { headers: PAGE_HDRS, signal: AbortSignal.timeout(20000) }); } catch { r = null; }
      if (!r || !r.ok) return Response.json({ error: "couldn't reach that link" }, { status: 502 });
      let ct = ctOf(r);
      let aiBalance = null; // set when the paid AI rescue ran — client repaints the pill
      if (ct === "text/html" || ct === "application/xhtml+xml") {
        const html = new TextDecoder().decode(await readCapped(r, 3_000_000));
        const candidates = pageImageCandidates(html, r.url || target);
        // Work down the candidate list — one CDN can 403/throttle while the
        // next serves fine. One retry on 429/5xx (Shopify-style burst
        // throttling of a second hit from the same egress). Referer helps
        // hotlink-protected CDNs.
        const IMG_HDRS = { "User-Agent": CHROME_UA, Accept: "image/avif,image/webp,image/*,video/*,*/*;q=0.8" };
        const tryImage = async (cand, referer) => {
          for (let attempt = 0; attempt < 2; attempt++) {
            let ir;
            try { ir = await safeFetch(cand, { headers: referer ? { ...IMG_HDRS, Referer: referer } : IMG_HDRS, signal: AbortSignal.timeout(10000) }); } catch { ir = null; }
            if (ir && ir.ok) return ir;
            if (!(ir && (ir.status === 429 || ir.status >= 500))) return null; // 403/404 won't heal
            await new Promise((res) => setTimeout(res, 1000));
          }
          return null;
        };
        const pageHref = r.url || target;
        r = null;
        for (const cand of candidates) {
          r = await tryImage(cand, pageHref);
          if (r) break;
        }
        if (!r) {
          // ── The free path came up dry (bot wall, no image, or every CDN
          // refused) → the paid AI lookup, same escape hatch the product
          // scanner had (owner's call: auto-fallback, ✦3 shown up front on
          // the button, charged only when it actually runs, refunded on any
          // failure). Claude + web_search identifies what the page sells/
          // shows and returns OPEN image links. ──
          const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "";
          const walled = WALL_RE.test(title) || WALL_RE.test(html.slice(0, 6000));
          const freeFail = () => Response.json({
            error: candidates.length ? "couldn't fetch the page's image"
              : walled ? "that store blocks robots — save the image to your device and use ⤒ Import"
              : "no image found on that page",
          }, { status: 422 });
          if (!env.ANTHROPIC_API_KEY) return freeFail();
          // The whole import lands via /api/save, which refuses users with no
          // gallery storage (free/lapsed/top-up-only, cap 0). Charging ✦3 for
          // the AI rescue and THEN 402'ing on save would take money for an
          // image they can never keep. Gate the paid rescue behind entitlement
          // — a cap-0 user gets the upgrade block, uncharged. (Fails open if
          // the ledger is unreachable, so a real member is never wrongly blocked.)
          const impStore = await storageStatus(request);
          if (impStore && impStore.cap <= 0) return Response.json({ error: "free", reason: "free" }, { status: 402 });
          if (!(await useQuota(request, "scanai", 20))) return QUOTA_EXCEEDED();
          const AI_CR = 3;
          const auth = request.headers.get("Authorization") || "";
          let balance;
          try { balance = await readCredits(auth); }
          catch { return Response.json({ error: "credits check failed — try again in a moment" }, { status: 503 }); }
          if (!(balance >= AI_CR)) return Response.json({ error: "not enough credits", cost: AI_CR }, { status: 402 });
          let newBalance = null;
          try { newBalance = await useCredits(auth, AI_CR); }
          catch { return Response.json({ error: "credits check failed — try again in a moment" }, { status: 503 }); }
          // use_credits returns -1 when the ATOMIC deduction fails (a concurrent
          // spend drained the balance after the pre-check) — nothing was
          // charged, so bail WITHOUT the refund path, which would otherwise mint
          // +3 credits the user never paid (2026-07-17).
          if (!(newBalance >= 0)) return Response.json({ error: "not enough credits", cost: AI_CR }, { status: 402 });
          const refund = () => creditBack(env, user.id, AI_CR);
          const blockedHost = (() => { try { return new URL(target).hostname.toLowerCase(); } catch { return ""; } })();
          const lkSystem = `You are an image-lookup assistant. The user pasted a link whose page blocks robots (or shows no readable image). From the URL slug and site name, use web_search (1-2 focused searches) to identify the EXACT product or subject the page is about, then call report_image once with: name (concise title of what it is), image_urls — up to 3 candidate DIRECT image links (plain https URLs, no HTML pages; prefer the store's own image CDN like i5.walmartimages.com or m.media-amazon.com, then any other listing's photo; only URLs you actually saw in results, never guessed paths) — and page_urls: up to 2 OTHER pages showing this exact product/subject that serve robots (the brand's own website first, then small shops; NEVER the blocked site, and never Amazon/Walmart/Target/BestBuy/Costco — they all block robots too). Report only what you actually found. Always finish by calling report_image.`;
          let lkMsgs = [{ role: "user", content: `Blocked page URL: ${target}` }];
          let found = null;
          for (let round = 0; round < 4; round++) {
            let lr;
            try {
              lr = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
                body: JSON.stringify({
                  model: "claude-sonnet-5",
                  max_tokens: 700,
                  system: lkSystem,
                  tools: [
                    { type: "web_search_20250305", name: "web_search", max_uses: 2 },
                    { name: "report_image", description: "Report the identified image sources.", input_schema: { type: "object", properties: {
                      name: { type: "string" },
                      image_urls: { type: "array", items: { type: "string" }, description: "up to 3 direct https image links, best first" },
                      page_urls: { type: "array", items: { type: "string" }, description: "up to 2 https pages on other sites showing this exact product/subject that likely don't block robots" },
                    }, required: ["name"] } },
                  ],
                  messages: lkMsgs,
                }),
                signal: AbortSignal.timeout(90000),
              });
            } catch { await refund(); return Response.json({ error: "lookup failed — nothing charged" }, { status: 502 }); }
            const ld = await lr.json().catch(() => ({}));
            if (!lr.ok) { await refund(); return Response.json({ error: "lookup failed — nothing charged" }, { status: 502 }); }
            const content = Array.isArray(ld.content) ? ld.content : [];
            const call = content.find((c) => c.type === "tool_use" && c.name === "report_image");
            if (call && call.input && call.input.name) { found = call.input; break; }
            if (ld.stop_reason === "pause_turn") { lkMsgs = lkMsgs.concat([{ role: "assistant", content }]); continue; }
            break;
          }
          if (!found) { await refund(); return Response.json({ error: "couldn't identify that page's image — nothing charged" }, { status: 422 }); }
          const aiCands = (Array.isArray(found.image_urls) ? found.image_urls : [])
            .filter((s) => typeof s === "string" && /^https:\/\//i.test(s) && !JUNK_IMG_RE.test(s))
            .filter((s, i, a) => a.indexOf(s) === i)
            .slice(0, 4);
          for (const cand of aiCands) {
            r = await tryImage(cand, null);
            if (r && ctOf(r).startsWith("image/")) break;
            r = null;
          }
          // Direct image links out of a TEXT search are often stale or guessed
          // — rescue via the alternate PAGES Claude found (a brand's own site
          // usually serves robots fine), run through the normal extractor.
          if (!r) {
            const pages = (Array.isArray(found.page_urls) ? found.page_urls : [])
              .filter((s) => typeof s === "string" && /^https:\/\//i.test(s))
              .slice(0, 2);
            for (const pageUrl of pages) {
              let pu;
              try { pu = new URL(pageUrl); } catch { continue; }
              const pHost = pu.hostname.toLowerCase();
              if (hostIsBlocked(pHost) || pHost === blockedHost) continue;
              if (/(^|\.)(amazon|walmart|target|bestbuy|costco|samsclub|homedepot|lowes)\.[a-z.]+$/i.test(pHost)) continue;
              let pageHtml = "";
              let pageHref2 = pageUrl;
              try {
                const pr = await safeFetch(pu.toString(), { headers: PAGE_HDRS, signal: AbortSignal.timeout(10000) });
                if (!pr || !pr.ok) continue;
                pageHref2 = pr.url || pageUrl;
                pageHtml = new TextDecoder().decode(await readCapped(pr, 1_500_000));
              } catch { continue; }
              const pTitle = (pageHtml.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "";
              if (WALL_RE.test(pTitle) || WALL_RE.test(pageHtml.slice(0, 4000))) continue;
              // Sanity: the rescue page must actually be about the same thing —
              // one real word from the found name in the page's title.
              const tokens = String(found.name || "").toLowerCase().match(/[a-z0-9]{4,}/g) || [];
              if (tokens.length && !tokens.some((t) => pTitle.toLowerCase().includes(t))) continue;
              for (const cand of pageImageCandidates(pageHtml, pageHref2).slice(0, 2)) {
                r = await tryImage(cand, pageHref2);
                if (r && ctOf(r).startsWith("image/")) break;
                r = null;
              }
              if (r) break;
            }
          }
          if (!r) { await refund(); return Response.json({ error: "the AI couldn't rescue that link's image — nothing charged" }, { status: 422 }); }
          aiBalance = newBalance;
        }
        ct = ctOf(r);
      }
      let kind = ct.startsWith("image/") ? "image" : ct.startsWith("video/") ? "video" : ct.startsWith("audio/") ? "audio" : null;
      const cap = MAXES[kind || "image"];
      const bytes = await readCapped(r, cap + 1);
      // Past here a failure must refund the AI charge if one happened — the
      // user only pays for a rescue that actually delivers a file.
      if (bytes.length > cap) {
        if (aiBalance !== null) await creditBack(env, user.id, 3);
        return Response.json({ error: "too large", reason: "toobig" }, { status: 400 });
      }
      if (!kind) {
        // Ambiguous CT (octet-stream etc.) — sniff. /api/save re-validates by
        // magic bytes anyway, so this only decides which caps/kind to report.
        const isMp4 = bytes.length > 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
        const isWebm = bytes.length > 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
        kind = sniffImageType(bytes) ? "image" : (isMp4 || isWebm) ? "video" : null;
      }
      if (!kind) {
        if (aiBalance !== null) await creditBack(env, user.id, 3);
        return Response.json({ error: "that link isn't an image, video, or audio file" }, { status: 422 });
      }
      return Response.json(aiBalance === null ? { kind, data: b64FromBuffer(bytes) } : { kind, data: b64FromBuffer(bytes), ai: true, balance: aiBalance });
    }

    // Copies a finished fal output into Supabase Storage so chats keep a
    // permanent URL (fal links expire). Uploads with the caller's own JWT,
    // so storage RLS applies and no extra server secret is needed.
    if (url.pathname === "/api/save" && request.method === "POST") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
      // Backstop: this route takes the biggest client payloads (~40MB base64
      // video). Reject on content-length BEFORE request.json() buffers+parses
      // an arbitrarily large body (2026-07-17). The b64 branch caps at 20M
      // chars internally; ~56MB covers that plus JSON overhead.
      const tl = tooLargeBody(request, 56_000_000); if (tl) return tl;
      let body;
      try { body = await request.json(); } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400 });
      }
      const src = typeof body.url === "string" ? body.url : "";
      const b64 = typeof body.data === "string" ? body.data : "";
      let bytes = null;
      let ct;
      // Gallery storage gate. Saving is a subscription benefit: free, lapsed or
      // top-up-only users (cap 0) can't save; paid tiers are capped by GB
      // (Plus 10 GB / Pro 50 GB / Max 100 GB). storageStatus is null when the ledger is
      // unreachable → fail open (allow) so an outage can't break paid saves.
      const store = await storageStatus(request);
      if (store && store.cap === 0) {
        return Response.json({ error: "saving is a paid feature", reason: "free" }, { status: 402 });
      }
      if (b64 && body.kind === "video") {
        // Studio films are stitched client-side into a local blob, so they can't
        // be handed over as a fal URL — they arrive as base64. Same paid gate;
        // ~40MB base64 (~30MB video) cap. Validated by magic bytes so the bucket
        // stays media-only. MP4 (…ftyp…) / WebM (EBML) only.
        if (b64.length > 40_000_000) return Response.json({ error: "too large", reason: "toobig" }, { status: 400 });
        try {
          const bin = atob(b64);
          bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } catch {
          return Response.json({ error: "invalid data" }, { status: 400 });
        }
        const isMp4 = bytes.length > 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
        const isWebm = bytes.length > 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
        if (!isMp4 && !isWebm) return Response.json({ error: "not a video" }, { status: 400 });
        ct = isMp4 ? "video/mp4" : "video/webm";
      } else if (b64 && body.kind === "audio") {
        // Imported audio (the gallery's Import button) arrives as base64 —
        // MP3 / WAV / OGG / M4A only, validated by magic bytes like the video
        // path. ~20MB base64 (~15MB audio) cap.
        if (b64.length > 20_000_000) return Response.json({ error: "too large", reason: "toobig" }, { status: 400 });
        try {
          const bin = atob(b64);
          bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } catch {
          return Response.json({ error: "invalid data" }, { status: 400 });
        }
        const isMp3 = bytes.length > 3 && ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
        const isWav = bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
          bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;
        const isOgg = bytes.length > 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
        const isM4a = bytes.length > 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
        if (!isMp3 && !isWav && !isOgg && !isM4a) return Response.json({ error: "not audio" }, { status: 400 });
        ct = isMp3 ? "audio/mpeg" : isWav ? "audio/wav" : isOgg ? "audio/ogg" : "audio/mp4";
      } else if (b64) {
        // Client-watermarked image bytes (free accounts burn the mark in
        // before saving). Images only; ~12MB base64 cap.
        if (b64.length > 12_000_000) return Response.json({ error: "too large" }, { status: 400 });
        try {
          const bin = atob(b64);
          bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } catch {
          return Response.json({ error: "invalid data" }, { status: 400 });
        }
        // Verify the bytes are actually an image by magic number — the storage
        // bucket must not become arbitrary-file hosting. PNG / JPEG / WEBP only.
        const isPng = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
        const isJpg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        const isWebp = bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
          bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
        if (!isPng && !isJpg && !isWebp) {
          return Response.json({ error: "not an image" }, { status: 400 });
        }
        ct = isPng ? "image/png" : isJpg ? "image/jpeg" : "image/webp";
      } else {
        if (!/^https:\/\/([a-z0-9-]+\.)?fal\.media\//i.test(src)) {
          return Response.json({ error: "invalid url" }, { status: 400 });
        }
      }
      let media = null;
      if (!bytes) {
        try { media = await fetch(src, { signal: AbortSignal.timeout(20000) }); } catch {
          return Response.json({ error: "fetch failed" }, { status: 502 });
        }
        if (!media.ok || !media.body) {
          return Response.json({ error: "fetch failed" }, { status: 502 });
        }
        ct = (media.headers.get("content-type") || "application/octet-stream").split(";")[0];
      }
      // Free accounts get the "✦ isibi.ai" mark burned in server-side. The
      // decision is driven by SNIFFED magic bytes, never the client `kind` or
      // the upstream Content-Type (a fal image served as octet-stream must not
      // dodge the mark). Only content whose CT is clearly video/audio streams
      // without buffering; everything else is buffered and sniffed for free
      // users. Fails closed on watermark error rather than storing a clean image.
      const ctLower = (ct || "").toLowerCase();
      const clearlyNotImage = ctLower.startsWith("video/") || ctLower.startsWith("audio/");
      if (!clearlyNotImage && !(await isPaidUser(request))) {
        let raw = bytes;
        if (!raw) {
          try { raw = new Uint8Array(await media.arrayBuffer()); } catch { return Response.json({ error: "fetch failed" }, { status: 502 }); }
        }
        if (raw.length > 25_000_000) return Response.json({ error: "too large" }, { status: 400 });
        const imgType = sniffImageType(raw);
        if (imgType) {
          try {
            bytes = watermarkImageBytes(raw, await wmBadgeBytes(env, request));
            ct = "image/jpeg";
            media = null; // storing the watermarked bytes now, not the stream
          } catch {
            return Response.json({ error: "watermark failed" }, { status: 502 });
          }
        } else {
          // Ambiguous CT that isn't actually an image (e.g. a video served as
          // octet-stream) — store the buffered bytes as-is, no mark.
          bytes = raw; media = null;
        }
      }
      // Capacity gate for paid tiers (cap > 0). By here `bytes` holds the final
      // payload for the buffered paths (b64 upload, watermarked image); the
      // streaming path uses the upstream Content-Length, or buffers to measure it
      // when that's absent. The size is then reserved atomically so concurrent
      // saves can't overshoot the cap; the reservation is released after upload.
      let reservationId = null;
      if (store && store.cap > 0) {
        let newSize = bytes ? bytes.length : (Number(media && media.headers.get("content-length")) || 0);
        // Streaming save whose upstream sent no Content-Length (chunked): the size
        // reads as 0 and would skip the cap. Buffer it (bounded) so we can measure
        // and store the real bytes instead of the already-consumed stream.
        if (!bytes && media && newSize <= 0) {
          const HARD_MAX = 314_572_800; // 300MB absolute per-file ceiling
          const buffered = await readCapped(media, HARD_MAX + 1);
          media = null;
          if (buffered.length > HARD_MAX) {
            return Response.json({ error: "too large", reason: "toobig" }, { status: 400 });
          }
          bytes = buffered;
          newSize = buffered.length;
        }
        // Atomic reserve-then-write (MON-3): the ledger counts committed objects
        // PLUS live reservations under a per-user lock, so concurrent saves can't
        // each pass a stale check and overshoot the cap. null → ledger unreachable
        // → fail open (never block a paid save on a ledger hiccup).
        const resv = await storageReserve(request, newSize);
        if (resv && resv.ok === false) {
          return Response.json({
            error: resv.reason === "free" ? "saving is a paid feature" : "gallery storage full",
            reason: resv.reason || "full",
          }, { status: 402 });
        }
        reservationId = resv && resv.id ? resv.id : null;
      }
      const EXT = {
        "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
        "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
        "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg",
      };
      const kindExt = body.kind === "image" ? "png" : body.kind === "audio" ? "mp3" : "mp4";
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${EXT[ct] || kindExt}`;
      const token = (request.headers.get("Authorization") || "").slice(7);
      let up;
      try {
        up = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${path}`, {
          method: "POST",
          // Filenames are unique + immutable, so saved media can cache forever —
          // without this the browser re-downloaded multi-MB originals on every
          // refresh (the "images render again" the owner noticed).
          headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, "Content-Type": ct, "cache-control": "max-age=31536000" },
          body: bytes || media.body,
          signal: AbortSignal.timeout(30000),
        });
      } catch {
        if (ctx && ctx.waitUntil) ctx.waitUntil(storageRelease(request, reservationId)); else await storageRelease(request, reservationId);
        return Response.json({ error: "store failed" }, { status: 502 });
      }
      // Release the reservation now the upload settled: on success the object is
      // committed to storage.objects (counted there); on failure the space frees.
      if (ctx && ctx.waitUntil) ctx.waitUntil(storageRelease(request, reservationId)); else await storageRelease(request, reservationId);
      if (!up.ok) return Response.json({ error: "store failed" }, { status: 502 });
      return Response.json({ url: `${SUPABASE_URL}/storage/v1/object/public/media/${path}` });
    }

    // Mint an opaque stream token for a temporary provider media URL (free/
    // over-cap renders that can't be saved). Auth'd, provider-host-only — the
    // sealed token is what the client puts in the <video>/<audio> src.
    if (url.pathname === "/api/media-token" && request.method === "POST") {
      if (!(await authUser(request))) return UNAUTHED();
      let body;
      try { body = await request.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
      const src = typeof body.url === "string" ? body.url : "";
      const token = await sealMediaUrl(env, src);
      if (!token) return Response.json({ error: "invalid url" }, { status: 400 });
      return Response.json({ token });
    }

    // Stream a sealed provider media URL same-origin. NO auth — a media element
    // request carries no Authorization header, so the encrypted token IS the
    // capability (only URLs the server itself sealed decrypt). Range is
    // forwarded for seeking; only a safe header allowlist is passed back so no
    // provider-identifying header leaks.
    if (url.pathname.startsWith("/api/m/") && (request.method === "GET" || request.method === "HEAD")) {
      const raw = url.pathname.slice("/api/m/".length);
      let token = raw;
      try { token = decodeURIComponent(raw); } catch {}
      const target = await openMediaToken(env, token);
      if (!target) return new Response("Not found", { status: 404 });
      const upstreamHeaders = {};
      const range = request.headers.get("range");
      if (range) upstreamHeaders["range"] = range;
      let up;
      try {
        up = await fetch(target, { method: request.method, headers: upstreamHeaders, signal: AbortSignal.timeout(30000) });
      } catch {
        return new Response("Upstream error", { status: 502 });
      }
      const h = new Headers();
      for (const k of ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"]) {
        const v = up.headers.get(k);
        if (v) h.set(k, v);
      }
      if (!h.has("accept-ranges")) h.set("accept-ranges", "bytes");
      h.set("cache-control", "private, max-age=3600");
      h.set("x-content-type-options", "nosniff");
      return new Response(request.method === "HEAD" ? null : up.body, { status: up.status, headers: h });
    }

    // Proxies fal queue status/result URLs so the key stays server-side.
    if (url.pathname === "/api/video/poll" && request.method === "GET") {
      if (!(await authUser(request))) return UNAUTHED();
      const target = url.searchParams.get("url") || "";
      // Constrain to a fal request's own status/result path (like /api/cancel and
      // /api/refund do), not any URL under the host — so the key-bearing proxy
      // can't be pointed at arbitrary fal endpoints.
      if (!/^https:\/\/queue\.fal\.run\/[a-z0-9/_.-]+\/requests\/[a-z0-9-]+(?:\/status)?(?:\?[^\s]*)?$/i.test(target)) {
        return Response.json({ error: "invalid url" }, { status: 400 });
      }
      if (!env.FAL_KEY) return Response.json({ error: "unavailable" }, { status: 503 });
      try {
        const r = await fetch(target, { headers: { Authorization: `Key ${env.FAL_KEY}` }, signal: AbortSignal.timeout(30000) });
        return new Response(await r.text(), {
          status: r.status,
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        return Response.json({ error: "poll failed" }, { status: 502 });
      }
    }

    // An /api/* request that matched no route above is a real API miss (unknown
    // endpoint or wrong method) — return a JSON 404 instead of falling through to
    // the static asset handler, which would hand back the app's HTML shell and
    // read as a confusing 200/asset-404 to any API caller (2026-07-18).
    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
}
