// Photon (WASM) for server-side image watermarking — the workerd build
// instantiates the wasm synchronously on import, so the functions are ready to
// call. Bundled by wrangler at deploy (see package.json).
import { PhotonImage, watermark, resize, SamplingFilter } from "@cf-wasm/photon";

const VIDEO_MODELS = new Set([
  "bytedance/seedance-2.0/text-to-video",
  "bytedance/seedance-2.0/fast/text-to-video",
  "bytedance/seedance-2.0/mini/text-to-video",
  "fal-ai/kling-video/v3/pro/text-to-video",
  "fal-ai/kling-video/v3/standard/text-to-video",
  "xai/grok-imagine-video/text-to-video",
  "google/gemini-omni-flash",
  "fal-ai/veo3.1",
  "fal-ai/sora-2/text-to-video/pro",
  "fal-ai/kling-video/o3/pro/text-to-video",
  "fal-ai/minimax/hailuo-2.3/pro/text-to-video",
  "fal-ai/bytedance/omnihuman",
  "fal-ai/kling-video/lipsync/audio-to-video",
]);
const DEFAULT_VIDEO_MODEL = "bytedance/seedance-2.0/fast/text-to-video";
// Audio-driven lip-sync models take no text prompt — they run off attachments.
const PROMPTLESS_VIDEO = new Set([
  "fal-ai/bytedance/omnihuman",
  "fal-ai/kling-video/lipsync/audio-to-video",
]);

const IMAGE_MODELS = new Set([
  "fal-ai/flux-2-pro",
  "fal-ai/gemini-3-pro-image-preview",
  "fal-ai/bytedance/seedream/v4/text-to-image",
  "fal-ai/recraft/v3/text-to-image",
  "google/nano-banana-2",
  "fal-ai/nano-banana-pro",
  "openai/gpt-image-2",
  "fal-ai/flux/dev",
  "fal-ai/krea-2/turbo",
  "xai/grok-imagine-image",
]);
const DEFAULT_IMAGE_MODEL = "fal-ai/bytedance/seedream/v4/text-to-image";

// Image editing: attaching an image in Image mode routes to the model's
// edit / image-to-image endpoint. `multi` → image_urls[] vs a single image_url.
// Models not listed here don't offer editing (the picker is hidden for them).
const IMAGE_EDIT = {
  "google/nano-banana-2":                        { endpoint: "fal-ai/nano-banana-2/edit",              multi: true },
  "fal-ai/nano-banana-pro":                      { endpoint: "fal-ai/nano-banana-pro/edit",            multi: true },
  "openai/gpt-image-2":                          { endpoint: "openai/gpt-image-2/edit",                multi: true },
  "fal-ai/flux-2-pro":                           { endpoint: "fal-ai/flux-2-pro/edit",                 multi: true },
  "fal-ai/gemini-3-pro-image-preview":           { endpoint: "fal-ai/gemini-3-pro-image-preview/edit", multi: true },
  "fal-ai/bytedance/seedream/v4/text-to-image":  { endpoint: "fal-ai/bytedance/seedream/v4/edit",      multi: true },
  "fal-ai/flux/dev":                             { endpoint: "fal-ai/flux/dev/image-to-image",         multi: false },
  "fal-ai/recraft/v3/text-to-image":             { endpoint: "fal-ai/recraft/v3/image-to-image",       multi: false },
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
  "fal-ai/veo3.1":                                { s: { "720p": 0.40, "1080p": 0.40, "4k": 0.60 }, d: 8 },
  "fal-ai/sora-2/text-to-video/pro":              { s: { "720p": 0.30, "1080p": 0.50 }, d: 10 },
  "bytedance/seedance-2.0/text-to-video":         { s: { "480p": 0.14, "720p": 0.30, "1080p": 0.68, "4k": 1.59 }, d: 5 },
  "bytedance/seedance-2.0/fast/text-to-video":    { s: { "480p": 0.11, "720p": 0.24, "1080p": 0.55 }, d: 5 },
  "bytedance/seedance-2.0/mini/text-to-video":    { s: { "480p": 0.07, "720p": 0.155 }, d: 5 },
  "fal-ai/kling-video/o3/pro/text-to-video":      { s: { def: 0.14 }, d: 5 },
  "fal-ai/kling-video/v3/pro/text-to-video":      { s: { def: 0.168 }, d: 5 },
  "fal-ai/kling-video/v3/standard/text-to-video": { s: { def: 0.126 }, d: 5 },
  "fal-ai/minimax/hailuo-2.3/pro/text-to-video":  { flat: 0.49 },
  "xai/grok-imagine-video/text-to-video":         { s: { "480p": 0.05, "720p": 0.07, def: 0.07 }, d: 6 },
  "google/gemini-omni-flash":                     { s: { def: 0.13 }, d: 8 },
  "fal-ai/bytedance/omnihuman":                   { audioPerSec: 0.14 },  // fal bills by driving-audio length
  "fal-ai/kling-video/lipsync/audio-to-video":    { audioPer5s: 0.014 },  // fal bills per 5-second increment
};
const IMAGE_USD = {
  "fal-ai/flux-2-pro": 0.03,
  "fal-ai/gemini-3-pro-image-preview": 0.15,
  "fal-ai/bytedance/seedream/v4/text-to-image": 0.03,
  "fal-ai/recraft/v3/text-to-image": 0.04,
  "google/nano-banana-2": 0.08,
  "fal-ai/nano-banana-pro": 0.15,
  "openai/gpt-image-2": 0.12,
  "fal-ai/flux/dev": 0.025,
  "fal-ai/krea-2/turbo": 0.008,
  "xai/grok-imagine-image": 0.022,
};
const AUDIO_USD_PER_1K = {
  "fal-ai/elevenlabs/tts/eleven-v3": 0.10,
  "fal-ai/elevenlabs/tts/turbo-v2.5": 0.05,
  "fal-ai/elevenlabs/tts/multilingual-v2": 0.10,
};

// Audio-driven video models (OmniHuman, Kling LipSync) are billed by fal on
// the driving clip's real length, so we cap and charge by measured seconds.
const AUDIO_DRIVE_MAX_S = 60;

// Generation credits are now PURE fal cost — the director's Claude bill is no
// longer folded in here. AI usage is a separate paid product (the AI
// Orchestrator add-on), metered against its own $19.99 budget, so charging it
// again on the generation would double-bill.
function creditCost(kind, model, { duration, quality, num, chars, audioSeconds }) {
  let usd;
  if (kind === "image") usd = (IMAGE_USD[model] || 0.15) * (num || 1);
  else if (kind === "audio") usd = (Math.max(chars || 0, 40) / 1000) * (AUDIO_USD_PER_1K[model] || 0.10);
  else {
    const p = VIDEO_USD[model];
    const secs = Math.max(1, Math.min(AUDIO_DRIVE_MAX_S, Math.round(audioSeconds || 0)));
    if (!p) usd = 3; // unlisted video model: charge high, never undercharge
    else if (p.audioPerSec != null) usd = p.audioPerSec * secs;
    else if (p.audioPer5s != null) usd = p.audioPer5s * Math.ceil(secs / 5);
    else if (p.flat != null) usd = p.flat;
    else {
      // Unknown quality never undercharges: fall back to def, else the highest
      // listed tier (not 720p, which could be cheaper than what fal renders).
      const tiers = Object.values(p.s).filter((n) => typeof n === "number");
      const maxTier = tiers.length ? Math.max(...tiers) : 0.4;
      const rate = p.s[quality] != null ? p.s[quality] : p.s.def != null ? p.s.def : maxTier;
      usd = (rate != null ? rate : maxTier) * (duration || p.d || 5);
    }
  }
  return Math.max(1, Math.ceil(usd / CREDIT_USD));
}

// Read the TRUE length (seconds) out of an uploaded audio data URI, so the
// lip-sync charge matches what fal bills — fal bills by the real driving-audio
// length, and a tampered client could otherwise claim a short duration on a
// long clip and underpay (omnihuman is $0.14/s → ~$8 per 60s clip). Returns a
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
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co https://fal.media https://*.fal.media",
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
function briefErr(d) {
  if (typeof d === "string") return d.slice(0, 200);
  if (!d || typeof d !== "object") return undefined;
  const m = d.detail ?? d.error ?? d.message;
  if (typeof m === "string") return m.slice(0, 200);
  if (Array.isArray(m)) {
    const s = m.map((x) => x && (x.msg || x.message)).filter(Boolean).join("; ");
    return s ? s.slice(0, 200) : undefined;
  }
  return undefined;
}

function harden(res) {
  const h = new Headers(res.headers);
  h.set("Content-Security-Policy", CSP);
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
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

// Minimal HTML-entity decoder for scraped <meta>/<title> text.
function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;|&#0?39;|&#x27;/gi, "'").replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return ""; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ""; } });
}

// Pull a product's name / image / description / price out of a page's HTML.
// Priority: JSON-LD schema.org Product (the canonical block real stores embed)
// → OpenGraph/Twitter → microdata → <link image_src> → the best real <img>
// (handles lazy-load + srcset, skips site chrome). Returns the image as an
// ABSOLUTE url; the caller inlines it through safeFetch. Pure/no network, so
// it is unit-testable. `name` may be "" when the page has no title at all.
function extractProduct(html, pageUrl, host) {
  const u = pageUrl;
  // Guard empty input: new URL("", base) resolves to the base page URL, which
  // would otherwise sneak the page itself in as a bogus "image".
  const abs = (s) => { if (!s) return null; try { return new URL(s, u).toString(); } catch { return null; } };
  const ok = (s) => s && /^https?:\/\//i.test(s);
  const stripTags = (s) => decodeEntities(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const allMeta = (prop) => {
    const re = new RegExp('<meta[^>]+(?:property|name|itemprop)=["\\\']' + prop + '["\\\'][^>]*>', "ig");
    const out = []; let m;
    while ((m = re.exec(html)) && out.length < 8) {
      const c = m[0].match(/content=["']([^"']*)["']/i);
      if (c && c[1]) out.push(decodeEntities(c[1]).trim());
    }
    return out;
  };
  const meta = (prop) => allMeta(prop)[0] || "";

  // ── 1. JSON-LD schema.org Product ──
  const ld = { name: "", desc: "", image: "", price: "", currency: "" };
  {
    const imgOf = (v) => {
      if (!v) return "";
      if (typeof v === "string") return v;
      if (Array.isArray(v)) { for (const x of v) { const r = imgOf(x); if (r) return r; } return ""; }
      if (typeof v === "object") return imgOf(v.url || v.contentUrl);
      return "";
    };
    const priceOf = (offers) => {
      const o = Array.isArray(offers) ? offers[0] : offers;
      if (!o || typeof o !== "object") return {};
      const spec = o.priceSpecification && typeof o.priceSpecification === "object"
        ? (Array.isArray(o.priceSpecification) ? o.priceSpecification[0] : o.priceSpecification) : null;
      return {
        price: String(o.price || o.lowPrice || (spec && spec.price) || "").trim(),
        currency: String(o.priceCurrency || (spec && spec.priceCurrency) || "").trim(),
      };
    };
    const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/ig;
    let m, blocks = 0;
    while ((m = re.exec(html)) && blocks < 30) {
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
        const t = node["@type"];
        const isProduct = t === "Product" || (Array.isArray(t) && t.includes("Product"));
        if (!isProduct) continue;
        if (!ld.name && node.name) ld.name = String(node.name).trim();
        if (!ld.desc && node.description) ld.desc = stripTags(node.description);
        if (!ld.image) { const im = abs(imgOf(node.image)); if (ok(im)) ld.image = im; }
        if ((!ld.price || !ld.currency) && node.offers) {
          const p = priceOf(node.offers);
          if (!ld.price) ld.price = p.price || "";
          if (!ld.currency) ld.currency = p.currency || "";
        }
        if (ld.name && ld.image && ld.price) { stack.length = 0; break; }
      }
    }
  }

  const titleTag = decodeEntities((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "").trim();
  const site = (meta("og:site_name") || String(host || "").replace(/^www\./, "")).slice(0, 80);
  let name = (ld.name || meta("og:title") || meta("twitter:title") || titleTag).slice(0, 120);
  // Trim a trailing " | Store" / " - Store" site-name suffix off the title.
  if (site) {
    const siteEsc = site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    name = name.replace(new RegExp("\\s*[|\\-–—:·]\\s*" + siteEsc + "\\s*$", "i"), "").trim() || name;
  }
  const desc = (ld.desc || meta("og:description") || meta("twitter:description") || meta("description"))
    .replace(/\s+/g, " ").trim().slice(0, 300);

  // ── 2-5. Image, in priority order ──
  let image = ld.image
    || allMeta("og:image").concat(allMeta("og:image:secure_url"), allMeta("twitter:image")).map(abs).find(ok)
    || "";
  if (!image) { const mi = abs(meta("image")); if (ok(mi)) image = mi; }          // microdata itemprop=image
  if (!image) {
    const href = ((html.match(/<link[^>]+rel=["']image_src["'][^>]*>/i) || [])[0] || "").match(/href=["']([^"']+)["']/i);
    if (href) { const a = abs(href[1]); if (ok(a)) image = a; }
  }
  if (!image) {
    const junk = /sprite|logo|icon|placeholder|favicon|1x1|pixel|badge|spacer|blank|loading/i;
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
      if (!src || junk.test(src)) continue;
      const a = abs(src);
      if (ok(a)) { image = a; break; }
    }
  }

  const price = (ld.price || meta("product:price:amount") || meta("og:price:amount") || "").slice(0, 20);
  const currency = (ld.currency || meta("product:price:currency") || meta("og:price:currency") || "").slice(0, 8);
  return { name, site, image, desc, price, currency };
}

// ── SSRF guard for user-supplied URLs (product scan). Normalizes the host and
// rejects loopback / link-local / private / metadata targets across the usual
// encodings (bracketed IPv6, IPv4-mapped, decimal/octal/hex IPv4, trailing
// dot). Re-checked on every redirect hop by safeFetch. ──
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

// ── AI Orchestrator add-on ($19.99/mo, at cost, no roll-over) ────────────────
// The director (ask/compose/revise/research/error/studio) runs ONLY for members
// of this add-on. Because the per-call cost is deterministic (step+effort),
// orchestrator_reserve() checks entitlement + this month's budget AND charges the
// call in ONE row-locked step (rolls the month too) — so concurrent calls can't
// all pass a read-only gate before a separate debit lands and burst past budget.
// Fails CLOSED — an unverifiable caller falls back to raw prompting, so the paid
// feature never leaks on a ledger hiccup (raw still generates fine).
async function orchestratorReserve(request, micros) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/orchestrator_reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: request.headers.get("Authorization") || "" },
      body: JSON.stringify({ p_cost_micros: Math.round(micros > 0 ? micros : 0) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return false;
    return (await r.json()) === true;
  } catch { return false; }
}
// Estimated at-cost price of one director call, in micro-dollars (1e-6 USD).
// The budget is really an abuse ceiling ($19.99 ≈ thousands of calls), so a
// per-step estimate keyed to the model that runs it is close enough — Sonnet
// (High+) and web-search research cost most; Haiku steps are pennies.
function orchestratorCostMicros(step, effort) {
  if (step === "research") return 35000; // Sonnet + up to 4 web searches
  if ((step === "compose" || step === "revise") &&
      (effort === "high" || effort === "ultra" || effort === "max")) return 25000; // Sonnet
  if (step === "ask") return 3000; // Haiku, thinking off, ~1.5k tokens
  return 4000; // Haiku prompt-writing / error
}

// ── Video Editor add-on ($19.99/mo) ─────────────────────────────────────────
// Powers the Studio's chat director (the step:'studio' calls to /api/direct).
// Flat monthly subscription — no usage meter (the Studio director is Haiku).
// Fails CLOSED like the orchestrator gate.
async function videoEditorGate(request) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/video_editor_gate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: request.headers.get("Authorization") || "" },
      body: "{}",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return false;
    return (await r.json()) === true;
  } catch { return false; }
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

// The dashboard-created OAuth auth config for a toolkit (needs the Meta/Google
// app credentials). Prefer an enabled one; null if the user hasn't made it yet.
async function composioAuthConfigId(env, toolkit) {
  const r = await composioFetch(env, `/auth_configs?toolkit_slug=${encodeURIComponent(toolkit)}&limit=20`);
  if (!r.ok) return null;
  const items = (await r.json().catch(() => ({}))).items || [];
  const pick = items.find((a) => a.status === "ENABLED") || items[0];
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
    return harden(await handleRequest(request, env, ctx));
  },
};

async function handleRequest(request, env, ctx) {
    const url = new URL(request.url);

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
      const tl = tooLargeBody(request, 100_000_000); if (tl) return tl; // ~100MB backstop
      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400 });
      }
      const prompt =
        typeof body.prompt === "string" ? body.prompt.trim().slice(0, 2000) : "";
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
      const clip = dataVideo(body.clip);
      // Extra reference images beyond the first (multi-image models).
      const extraImages = Array.isArray(body.images)
        ? body.images.slice(0, 8).map(dataImage).filter(Boolean)
        : [];
      // Veo 3.1's dedicated image-input modes (mutually exclusive with i2v):
      //  first + last  → first-last-frame-to-video (2 frames)
      //  refs[]        → reference-to-video (subject consistency, ≤3)
      const first = dataImage(body.first);
      const last = dataImage(body.last);
      const refs = Array.isArray(body.refs)
        ? body.refs.slice(0, 9).map(dataImage).filter(Boolean)
        : [];

      let endpoint = model;
      const input = { prompt };

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
        delete input.prompt;
        input.text = prompt;
        const voice =
          typeof body.voice === "string" &&
          /^[A-Za-z][A-Za-z0-9 _-]{0,39}$/.test(body.voice)
            ? body.voice
            : null;
        if (voice) input.voice = voice;
      } else if (genKind === "video" && model === "fal-ai/bytedance/omnihuman") {
        // Audio-driven talking avatar: a portrait image + a voice clip.
        if (!image || !audio) {
          return Response.json({ error: "OmniHuman needs an image and an audio clip" }, { status: 400 });
        }
        delete input.prompt;
        input.image_url = image;
        input.audio_url = audio;
      } else if (genKind === "video" && model === "fal-ai/kling-video/lipsync/audio-to-video") {
        // Lip-sync an existing clip to a voice track.
        if (!clip || !audio) {
          return Response.json({ error: "Kling LipSync needs a video clip and an audio clip" }, { status: 400 });
        }
        delete input.prompt;
        input.video_url = clip;
        input.audio_url = audio;
      } else if (genKind === "video") {
        const isSeedance = model.startsWith("bytedance/");
        const isKling = model.includes("kling-video");
        const isKlingV3 = model.includes("kling-video/v3");
        const isKlingO3 = model.includes("kling-video/o3");
        const isGrok = model.includes("grok-imagine");
        const isVeo = model.includes("veo");
        const isSora = model.includes("sora");

        // The image-to-video endpoint id — Veo's base id has no "/text-to-video"
        // segment to swap, so it gets the suffix appended instead.
        const i2v = isVeo ? model + "/image-to-video" : model.replace("/text-to-video", "/image-to-video");
        // Start-image field name differs by family: Kling v3 wants start_image_url;
        // everyone else (Seedance, Kling o3, Grok, Veo, Sora, Hailuo) wants image_url.
        const startField = isKlingV3 ? "start_image_url" : "image_url";

        // Reference-to-video (hold a subject/identity across a fresh scene).
        // Seedance folds any driving audio + multi-image references in here;
        // Veo has its own reference endpoint (≤3 images, no audio).
        if (isSeedance && (refs.length || audio)) {
          endpoint = model.replace("/text-to-video", "/reference-to-video");
          const rImgs = (refs.length ? refs : [image].filter(Boolean)).slice(0, 9);
          // fal rule: a driving audio needs at least one image/video reference.
          if (audio && !rImgs.length) {
            return Response.json({ error: "Add a reference image along with the audio." }, { status: 400 });
          }
          if (rImgs.length) {
            input.image_urls = rImgs;
            // Seedance only uses a reference if the prompt cites it as @ImageN.
            // The director writes those tags; for a raw prompt without them,
            // append the tags so the uploaded images aren't silently ignored.
            if (typeof input.prompt === "string" && !/@Image\d/i.test(input.prompt)) {
              const tags = rImgs.map((_, i) => "@Image" + (i + 1)).join(", ");
              input.prompt = (input.prompt.trim() + ` Feature ${tags}.`).trim();
            }
          }
          if (audio) input.audio_urls = [audio];
        } else if (isVeo && refs.length) {
          endpoint = model + "/reference-to-video";
          input.image_urls = refs.slice(0, 3);
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

        // Reconcile @ImageN reference tags with the ACTUAL generation. Tags only
        // mean something for a Seedance reference-to-video; on a rerun/revise of
        // an old reference prompt (references already cleared), or a plan-mode
        // prompt whose reference set shrank, they'd be dangling noise pointing at
        // images that aren't there. Strip tags that don't map to a sent image.
        if (typeof input.prompt === "string" && /@(?:Image|Video|Audio)\d/i.test(input.prompt)) {
          const isRefGen = isSeedance && endpoint.includes("/reference-to-video");
          const refN = isRefGen && Array.isArray(input.image_urls) ? input.image_urls.length : 0;
          if (!isRefGen) {
            // Drop the appended "Feature @Image1, @Image2." clause and any inline tags.
            input.prompt = input.prompt
              .replace(/\s*\bFeature\s+@(?:Image|Video|Audio)\d+(?:\s*,\s*@(?:Image|Video|Audio)\d+)*\s*\.?/gi, "")
              .replace(/\s*@(?:Image|Video|Audio)\d+/gi, "");
          } else {
            // Reference gen: keep only tags that point at an attached reference.
            input.prompt = input.prompt.replace(/@(?:Image|Video|Audio)(\d+)/gi, (m, d) => (+d <= refN ? m : ""));
          }
          input.prompt = input.prompt.replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
        }

        if (duration) {
          // Veo wants "8s"; Seedance/Kling want a string enum; the rest an integer.
          if (isVeo) input.duration = duration + "s";
          else if (isSeedance || isKling) input.duration = String(duration);
          else input.duration = duration;
        }

        // Kling image-to-video is the only video endpoint without aspect_ratio.
        const isKlingI2V = isKling && endpoint.includes("/image-to-video");
        if (ratio && !isKlingI2V) input.aspect_ratio = ratio;

        // Video endpoints that accept a resolution.
        if (quality && (isSeedance || isGrok || isVeo || isSora)) input.resolution = quality;
      } else if ((image || avatar) && IMAGE_EDIT[model]) {
        // Image editing: route to the model's edit / image-to-image endpoint.
        // Size comes from the source image, so no aspect_ratio here.
        const edit = IMAGE_EDIT[model];
        endpoint = edit.endpoint;
        const urls = [image, avatar, ...extraImages].filter(Boolean).slice(0, 9);
        if (edit.multi) input.image_urls = urls;
        else input.image_url = urls[0];
      } else if (ratio) {
        // These families size output via an image_size enum; the rest take aspect_ratio.
        const usesImageSize =
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

      if (genKind === "image" && num && num > 1) input.num_images = num;

      // Driving-audio length for the audio-billed video models (fal charges by
      // it). The ground truth is the real length read out of the uploaded file
      // header, so the charge matches fal's regardless of what the client
      // claims. When the format can't be parsed we fall back to the client's
      // measured duration floored by a size-derived lower bound: a file of N
      // bytes can't be shorter than N*8 / (highest plausible bitrate for its
      // format), so a tampered short claim can't underpay a big clip.
      let audioSeconds = 0;
      if (model === "fal-ai/bytedance/omnihuman" || model === "fal-ai/kling-video/lipsync/audio-to-video") {
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

      const genCost = creditCost(genKind, model, {
        duration, quality, num, chars: genKind === "audio" ? prompt.length : 0,
        effort: typeof body.effort === "string" ? body.effort : "",
        // Only an explicit "off" waives the director surcharge — absent or
        // anything else charges it, so old clients never undercharge.
        director: body.director === "off" ? "off" : "on",
        audioSeconds,
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
      // us (the render fails). Best-effort with the service key (RLS-locked
      // table); a missed record just means no refund for that rare job. Fire and
      // forget so it never delays the generation response.
      if (env.SUPABASE_SERVICE_KEY && data.request_id) {
        const rec = fetch(`${SUPABASE_URL}/rest/v1/gen_charges`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: env.SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            Prefer: "resolution=ignore-duplicates",
          },
          body: JSON.stringify({ request_id: data.request_id, user_id: genUser.id, cost: genCost }),
          signal: AbortSignal.timeout(8000),
        }).catch(() => {});
        if (ctx && ctx.waitUntil) ctx.waitUntil(rec); else await rec;
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
    // AI Orchestrator add-on — a $19.99/mo subscription, priced AT COST (no
    // markup). Unlocks the director (chat/prompt-help/effort/research). Grants no
    // credits: it activates its own budget via set_orchestrator on invoice.paid.
    const ORCH = { cents: 1999, name: "isibi AI Orchestrator" };
    // Video Editor add-on — $19.99/mo subscription. Unlocks the Studio chat
    // director. Grants no credits; activates via set_video_editor on invoice.paid.
    const VE = { cents: 1999, name: "isibi Video Editor" };

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
      const orch = !plan && !topup && body.orchestrator ? ORCH : null;
      const ve = !plan && !topup && !orch && body.videoEditor ? VE : null;
      if (!plan && !topup && !orch && !ve) return Response.json({ error: "unknown plan" }, { status: 400 });
      const sub = plan || orch || ve; // all monthly subscriptions
      const form = new URLSearchParams({
        mode: sub ? "subscription" : "payment",
        success_url: "https://isibi.ai/?credits=added",
        cancel_url: "https://isibi.ai/",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String((plan || topup || orch || ve).cents),
      });
      if (sub) {
        form.set("line_items[0][price_data][recurring][interval]", "month");
        form.set("line_items[0][price_data][product_data][name]", sub.name);
        // Subscription metadata rides along on every invoice, so renewals know
        // who to grant and what (credits for a plan, orchestrator flag for the add-on).
        form.set("subscription_data[metadata][user_id]", user.id);
        if (plan) form.set("subscription_data[metadata][credits]", String(plan.credits));
        else if (orch) form.set("subscription_data[metadata][orchestrator]", "1");
        else form.set("subscription_data[metadata][video_editor]", "1");
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
        const isOrch = meta.orchestrator === "1" || meta.orchestrator === 1;
        const isVE = meta.video_editor === "1" || meta.video_editor === 1;
        const paid = inv && (inv.status === "paid" || inv.paid === true);
        // AI Orchestrator sub: activate/extend the add-on on a rolling 32-day
        // window (grants no credits). Lapses to raw once no invoice renews it.
        if (uid && isOrch && paid && inv.id) {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_orchestrator`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({
              target: uid,
              p_until: new Date(Date.now() + 32 * 86400000).toISOString(),
              mint_key: env.CREDITS_MINT_SECRET,
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (!r.ok) return Response.json({ error: "orchestrator grant failed" }, { status: 500 });
        } else if (uid && isVE && paid && inv.id) {
          // Video Editor sub: activate/extend on a rolling 32-day window.
          const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_video_editor`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({
              target: uid,
              p_until: new Date(Date.now() + 32 * 86400000).toISOString(),
              mint_key: env.CREDITS_MINT_SECRET,
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (!r.ok) return Response.json({ error: "video editor grant failed" }, { status: 500 });
        } else if (uid && credits > 0 && paid && inv.id) {
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
          try {
            await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_plan`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
              body: JSON.stringify({
                target: uid, p_tier: tier,
                p_until: new Date(Date.now() + 32 * 86400000).toISOString(),
                mint_key: env.CREDITS_MINT_SECRET,
              }),
              signal: AbortSignal.timeout(10000),
            });
          } catch {} // credits already granted; a plan-set hiccup shouldn't fail the webhook
        }
      }
      return Response.json({ received: true });
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

    // AI Orchestrator status for the client ({active, used, budget, resets_at}).
    if (url.pathname === "/api/orchestrator" && request.method === "GET") {
      if (!(await authUser(request))) return UNAUTHED();
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/orchestrator_status`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: request.headers.get("Authorization") || "" },
          body: "{}",
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) throw 0;
        return Response.json(await r.json());
      } catch {
        return Response.json({ error: "orchestrator unavailable" }, { status: 503 });
      }
    }

    // Video Editor status for the client ({active, resets_at}).
    if (url.pathname === "/api/video-editor" && request.method === "GET") {
      if (!(await authUser(request))) return UNAUTHED();
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/video_editor_status`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: request.headers.get("Authorization") || "" },
          body: "{}",
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) throw 0;
        return Response.json(await r.json());
      } catch {
        return Response.json({ error: "video editor unavailable" }, { status: 503 });
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
        const authConfigId = await composioAuthConfigId(env, toolkit);
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

    // Sonnet 5 director: chats, reads intent (rerun/revise/new), writes prompts.
    if (url.pathname === "/api/direct" && request.method === "POST") {
      if (!(await authUser(request))) return UNAUTHED();
      if (!env.ANTHROPIC_API_KEY) {
        return Response.json({ error: "director not configured" }, { status: 501 });
      }
      const tl = tooLargeBody(request, 60_000_000); if (tl) return tl; // director carries at most one image
      let body;
      try { body = await request.json(); } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400 });
      }
      let step = ["compose", "revise", "error", "studio", "research"].includes(body.step) ? body.step : "ask";
      // The director is a paid add-on, split by surface: the 'studio' step is the
      // Video Editor add-on's chat; every other step is the AI Orchestrator.
      // No active sub (or the orchestrator's monthly budget is spent) → 402 locked;
      // the client falls back to raw prompting / an upsell.
      const isStudio = step === "studio";
      // Non-studio steps meter against the monthly orchestrator budget. The cost
      // per call is deterministic (step+effort), so reserve it atomically at the
      // gate — check entitlement + budget AND charge in one locked step — rather
      // than debiting afterwards, which let concurrent calls all pass the check
      // before any debit landed and burst past the budget. (compose/revise cost
      // the same, so the pre-reassignment step value gives the right price.)
      const estMicros = isStudio ? 0 : orchestratorCostMicros(
        step, ["low", "high", "ultra", "max"].includes(body.effort) ? body.effort : "medium");
      if (!(isStudio ? await videoEditorGate(request) : await orchestratorReserve(request, estMicros))) {
        return Response.json({
          error: isStudio ? "video editor required" : "orchestrator required",
          locked: true, need: isStudio ? "video_editor" : "orchestrator",
        }, { status: 402 });
      }
      const kind = ["video", "image", "audio"].includes(body.kind) ? body.kind : "video";
      const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 2000) : "";
      if (!prompt) return Response.json({ error: "no prompt" }, { status: 400 });
      // The previous generation's prompt — lets the ask step spot feedback
      // ("slower", "fix the text") and the revise step edit surgically.
      const prevPrompt = typeof body.prevPrompt === "string" ? body.prevPrompt.trim().slice(0, 2000) : "";
      if (step === "revise" && !prevPrompt) step = "compose";
      // (The orchestrator budget was already reserved atomically at the gate
      // above — no separate debit step, which is what let bursts overspend.)
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
        // Each research call spends real money (web_search, ~$0.01/search,
        // up to max_uses per call), and the step is directly callable — so
        // it gets its own much tighter daily cap on top of the director one.
        if (!(await useQuota(request, "research", 30))) return QUOTA_EXCEEDED();
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
            return Response.json({ facts: "", sources: [] });
          }
          const rdata = await rr.json().catch(() => ({}));
          if (!rr.ok) return Response.json({ facts: "", sources: [] });
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
      const hasImage = !!body.hasImage;
      const hasEnd = !!body.hasEnd;
      const refCount = Math.min(9, Math.max(0, Math.round(+body.refCount) || 0));
      // The attached image itself (downscaled by the client) so the director
      // can look at it. ~2.8M chars of base64 ≈ 2MB binary, under API limits.
      let imageBlock = null;
      if (kind !== "audio" && typeof body.image === "string" && body.image.length < 2800000) {
        const m = body.image.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
        if (m) imageBlock = { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
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
      const effortLine = kind === "audio" ? "" : effort === "low"
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
      if (genModel) ctxBits.push(`target model: ${genModel}`);
      if (kind === "video" && genDuration) ctxBits.push(`clip length: ${genDuration}s`);
      if (genRatio) ctxBits.push(`aspect ratio: ${genRatio}`);
      if (kind !== "audio") {
        ctxBits.push(hasImage ? "a start image IS attached" : "no start image attached");
        if (hasEnd) ctxBits.push("an end frame IS attached");
        if (refCount) ctxBits.push(`${refCount} reference image${refCount > 1 ? "s" : ""} attached`);
      }
      const ctxLine = ctxBits.join(" · ");
      // References work differently per family. Seedance binds each reference by
      // an @-tag written INTO the prompt; Veo uses them holistically for identity.
      const refLine = (refCount && kind === "video")
        ? (/seedance/.test(genModel)
          ? `\nThe user attached ${refCount} reference image${refCount > 1 ? "s" : ""} for a reference-to-video generation. Seedance binds references by tag: cite them in the prompt as ${Array.from({ length: refCount }, (_, i) => "@Image" + (i + 1)).join(", ")} (1-indexed, in order), weaving each tag naturally into the sentence where that subject or element should appear (e.g. "the character from @Image1 walks through @Image2"). Reference them by tag rather than re-describing them as if generating from scratch.`
          : `\nThe user attached ${refCount} reference image${refCount > 1 ? "s" : ""} to hold the subject's identity — write the scene their request describes; the references supply what the subject looks like, so don't over-specify the subject's appearance in words.`)
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
- If they've described something to create: set ready=true. Never ask clarifying questions — make every creative call yourself.
Tailor everything to what THIS user is trying to make.${hasImage ? `\nThe user attached ${kind === "video" ? "a start image the video will animate (it's in the conversation — look at it). Reference what you actually see in your reply" : "a source image to edit (it's in the conversation — look at it). Reference what you actually see in your reply"}.` : ""}${prevPrompt ? `\nThe user's PREVIOUS generation ran with this prompt: "${prevPrompt.slice(0, 600)}". Read their message against it and pick ONE signal:
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
        ? `You are isibi, a warm creative director for an AI ${kind} studio. The user's generation just failed. From the raw pipeline error, explain in 1-2 friendly plain-language sentences what went wrong and what to do next — no jargon, no error codes, never blame the user. If — and ONLY if — rewording the prompt could fix it (content filter, prompt rejected as invalid), also return fixedPrompt: the failed prompt minimally reworded to avoid the trigger while keeping the creative intent. For balance, quota, timeout or model-availability problems, return no fixedPrompt.${ctxLine ? `\nContext: ${ctxLine}` : ""}`
        : step === "revise"
        ? `You are the prompt writer for isibi, an AI ${kind} studio. The user generated a ${kind} with the previous prompt below and wants it adjusted. Rewrite the prompt applying ONLY what their feedback asks — keep every untouched part as close to word-for-word as possible, so the change is surgical, not a fresh rewrite. Return a single paragraph, nothing but the prompt.

Fix patterns:
- Mangled or morphing on-screen text → pin it harder: all text stays exactly as printed, never changing.
- Too much, too fast or wrong motion → name the camera explicitly and calm the action verbs.
- Style drift on an animated image → state the art style is preserved exactly, with no smoothing.
- Feels rushed or overstuffed → cut to one or two beats of motion${genDuration ? ` for the ${genDuration}s clip` : ""}.${familyHint ? `
- ${familyHint}` : ""}

Previous prompt:
${prevPrompt}
${briefLine}${memoryLine}${refLine ? refLine + " Preserve the existing @ImageN tags exactly." : ""}
Context: ${ctxLine}`
        : kind === "video"
        ? `You are the prompt writer for isibi, an AI video studio. Using the conversation, the request and the user's picks, write ONE video-generation prompt: a single paragraph of concrete visual language — no lists, no headers, nothing but the prompt.

Craft rules:
- One continuous shot. Describe a single scene with continuous action — no cuts, montages or scene changes unless the user asked for them.
- Name the camera work explicitly (locked-off static, slow push-in, handheld, orbit). If the user wants a loop or a background, open with "Fixed camera, no camera movement" and keep all motion ambient and cyclical.
- Budget the action to the clip length${genDuration ? ` (${genDuration}s)` : ""}: one or two beats of motion, not a story arc — overstuffed prompts cause rushed, morphing results.
- Any visible text, logos or signage: state explicitly that they stay exactly as printed, never changing — video models mangle text that is allowed to move.
${hasImage
  ? `- A start image IS attached (it's in the conversation — look at it): the model animates that image. Do NOT re-describe what is already in the picture (re-describing causes drift and morphing). Name its actual contents concretely as "the ..." ("the man leaning on the red car", not "the subject") and describe ONLY what moves and how, plus what must stay still. If the image has a distinct art style (anime, pixel art, illustration), say the style must be preserved exactly, with no smoothing.${hasEnd ? `
- An end frame IS attached: the clip must land back on that frame — keep the motion gentle and cyclical so the return feels natural, never a hard change of state.` : ""}`
  : `- No start image: paint the full scene — subject, action, setting, lighting, mood, in that order, each in concrete visual terms.`}${familyHint ? `
- ${familyHint}` : ""}

Example of the register (never copy its content): "Fixed camera, no camera movement. Steady rain falls on a neon-lit alley at night; puddles ripple, steam drifts from the food stall, the paper lantern sways gently. The cook flips noodles in one small motion. All signage stays exactly as printed. Cinematic, moody, photorealistic."
${effortLine}${briefLine}${factsLine}${memoryLine}${refLine}
Context: ${ctxLine}`
        : kind === "image"
        ? `You are the prompt writer for isibi, an AI image studio. Using the conversation, the request and the user's picks, write ONE image-generation prompt: a single paragraph — no lists, nothing but the prompt.

Craft rules:
- Name the medium and style explicitly (photograph, cinematic still, oil painting, anime, pixel art...) — unstated style yields generic digital art.
- Cover subject, composition and framing, lighting and palette, in concrete visual terms.
- If words should appear in the image, give them verbatim in quotes and say where they sit.
${hasImage ? `- A source image IS attached (it's in the conversation — look at it): this is an EDIT. Describe only the change to make, naming existing content concretely as "the ..." — do not re-describe the rest of the picture.` : ""}${familyHint ? `
- ${familyHint}` : ""}
${effortLine}${briefLine}${factsLine}${memoryLine}
Context: ${ctxLine}`
        : `You are the prompt writer for isibi, an AI voice generator. Describe the delivery and tone for the spoken line in ONE short direction.`;

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
      // Put the attached image on the final user turn so the director sees it.
      if (imageBlock) {
        const last = turns[turns.length - 1];
        last.content = [imageBlock, { type: "text", text: last.content }];
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
            // thinking, which shares the budget with a 250-330-word Max prompt
            // — give them headroom so thinking can't truncate the tool output.
            // max_tokens is a ceiling, not a target: unused tokens aren't billed.
            max_tokens: step === "ask" ? 1500 : 4000,
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
            await send(parsed ? { done: shapeAsk(parsed) } : { error: "director no output" });
          } catch {
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
      if (!r.ok) return Response.json({ error: "director error" }, { status: 502 });

      const parsed = (data.content || []).find((c) => c.type === "tool_use")?.input;
      if (!parsed) return Response.json({ error: "director no output" }, { status: 502 });

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
        prompt: String(parsed.prompt || prompt).slice(0, 2000),
        brief: parsed.brief ? String(parsed.brief).slice(0, 600) : undefined,
        // Evolved durable taste, same cap/sanitize as the inbound list. Absent
        // when the model returned nothing new — the client keeps what it has.
        memory: Array.isArray(parsed.memory)
          ? parsed.memory.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim().slice(0, 140)).slice(0, 12)
          : undefined,
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
        return Response.json({ refunded: 0 }); // still running, completed, or unknown — nothing to refund
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

    // Copies a finished fal output into Supabase Storage so chats keep a
    // permanent URL (fal links expire). Uploads with the caller's own JWT,
    // so storage RLS applies and no extra server secret is needed.
    if (url.pathname === "/api/save" && request.method === "POST") {
      const user = await authUser(request);
      if (!user) return UNAUTHED();
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
      // (Plus 1 / Pro 5 / Max 10). storageStatus is null when the ledger is
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
          headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, "Content-Type": ct },
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

    // Proxies fal queue status/result URLs so the key stays server-side.
    if (url.pathname === "/api/video/poll" && request.method === "GET") {
      if (!(await authUser(request))) return UNAUTHED();
      const target = url.searchParams.get("url") || "";
      if (!target.startsWith("https://queue.fal.run/")) {
        return Response.json({ error: "invalid url" }, { status: 400 });
      }
      if (!env.FAL_KEY) return Response.json({ error: "unavailable" }, { status: 503 });
      try {
        const r = await fetch(target, { headers: { Authorization: `Key ${env.FAL_KEY}` }, signal: AbortSignal.timeout(15000) });
        return new Response(await r.text(), {
          status: r.status,
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        return Response.json({ error: "poll failed" }, { status: 502 });
      }
    }

    // Scan a product URL: fetch the page server-side (no CORS) and pull the
    // product's name + images from OpenGraph / product meta, so the Products
    // tab can create a product from a store link.
    if (url.pathname === "/api/product/scan" && request.method === "POST") {
      if (!(await authUser(request))) return UNAUTHED();
      // Each scan makes up to 2 server-side outbound fetches; gate it so a
      // logged-in user can't drive unbounded outbound requests through us.
      if (!(await useQuota(request, "scan", 60))) return QUOTA_EXCEEDED();
      let body;
      try { body = await request.json(); } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400 });
      }
      let target = typeof body.url === "string" ? body.url.trim() : "";
      if (!target) return Response.json({ error: "no url" }, { status: 400 });
      if (!/^https?:\/\//i.test(target)) target = "https://" + target;
      let u;
      try { u = new URL(target); } catch { return Response.json({ error: "invalid url" }, { status: 400 }); }
      if (u.protocol !== "http:" && u.protocol !== "https:") return Response.json({ error: "invalid url" }, { status: 400 });
      const host = u.hostname.toLowerCase();
      // SSRF guard — reject loopback / private / link-local / metadata across
      // encodings; safeFetch re-checks every redirect hop so a public host
      // can't 30x us onto an internal one.
      if (hostIsBlocked(host)) {
        return Response.json({ error: "blocked" }, { status: 400 });
      }
      let html = "";
      try {
        const r = await safeFetch(u.toString(), {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; isibiBot/1.0; +https://isibi.ai)", "Accept": "text/html,application/xhtml+xml" },
          signal: AbortSignal.timeout(8000),
        });
        if (!r || !r.ok) return Response.json({ error: "fetch failed" }, { status: 502 });
        const buf = await readCapped(r, 1_500_000); // stream + hard ceiling; arrayBuffer() would buffer a hostile multi-GB body first
        html = new TextDecoder("utf-8").decode(buf);
      } catch {
        return Response.json({ error: "fetch failed" }, { status: 502 });
      }
      const info = extractProduct(html, u, host);
      if (!info.name && !info.image) return Response.json({ error: "no product info" }, { status: 422 });
      // Inline the product image as a data URI: the app CSP blocks arbitrary
      // remote image hosts, and going through safeFetch keeps it SSRF-guarded.
      let imageData = "";
      if (info.image) {
        try {
          const ir = await safeFetch(info.image, { signal: AbortSignal.timeout(8000) });
          const ict = ((ir && ir.headers.get("content-type")) || "").split(";")[0].toLowerCase();
          if (ir && ir.ok && ict.startsWith("image/")) {
            const bytes = await readCapped(ir, 2_000_001); // one over the cap so an oversized image is rejected, not truncated into a corrupt data URI
            if (bytes.length && bytes.length <= 2_000_000) imageData = "data:" + ict + ";base64," + b64FromBuffer(bytes);
          }
        } catch {}
      }
      return Response.json({ name: info.name || info.site, site: info.site, image: imageData, desc: info.desc, price: info.price, currency: info.currency });
    }

    return env.ASSETS.fetch(request);
}
