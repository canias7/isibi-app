// Photon (WASM) for server-side image watermarking — the workerd build
// instantiates the wasm synchronously on import, so the functions are ready to
// call. Bundled by wrangler at deploy (see package.json).
import { PhotonImage, watermark, resize, SamplingFilter } from "@cf-wasm/photon";
import { Container, getContainer } from "@cloudflare/containers";
import { makeCache, memoize } from "./ttl-cache.mjs";
import { ensureSiteBackend as ensureSiteBackendPure } from "./site-provision.mjs";
import { lookupRoute, saveRoute, dropRoute } from "./site-routing.mjs";
import { neonConfigured, sqlQuery, sqlExec, createUserProject, createSiteDatabase, dropSiteDatabase, dropUserProject, connForDatabase, dbNameForSite } from "./site-db.mjs";
import { applySiteSchema, loadSiteSchema, parseSchemaSpec, normalizeSchema, sqlIdent, seedSiteRows } from "./site-schema.mjs";
import { handleSiteData } from "./site-data.mjs";
// The page generator's rules, tool schema and deterministic checks. Plain module
// so it can be tested outside the Worker — see test/page-gen.test.mjs.
import { PAGE_RULES, SITE_PAGES_TOOL, pagesPrompt, repairPrompt } from "./builder/page-gen.mjs";
import { publishPages } from "./builder/publish-pages.mjs";
import { verifyStripeSignature, mintFromEvent } from "./stripe-webhook.mjs";
import { selectPurchase, checkoutForm, LIVE_SUBSCRIPTION_STATUSES, falRequestId, refundVerdict, refundOnResultStatus } from "./billing.mjs";
import { toCents, depreciationSchedule, amortizationSchedule, investmentAnalysis, eoqCalc, breakevenCalc, demandForecast, installmentPlan, taxCalc, commissionCalc } from "./worker-finance.mjs";
// Game builder (Phase 3): same generate→build→publish pipeline, engine swapped for
// kaplay + a runtime smoke test. See builder-game/. Parser format is identical.
import { parseGeneratedFiles as parseGameFiles, GAME_RULES, GAME_ASSET_RULES, GAME_REVISE_RULES, gameFixRules, parseSpriteTokens, GAME_3D_RULES, game3DFixRules } from "./builder-game/game-gen.mjs";

// Game build-service container (Phase 3). The image (./builder-game/Dockerfile)
// bakes kaplay + a headless Chromium for the smoke test. Runs to zero after idle.
export class GameBuildContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "3m";
}

// Site build-service container. The image (./builder/Dockerfile) bakes the React
// template and its dependencies, so a per-site build is only `tsr generate` →
// `tsc --noEmit` → `vite build`. Runs to zero after idle, same as the game one.
export class SiteBuildContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "5m";
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
// WHICH duration a render is billed on. Several endpoints ignore the duration
// picker entirely, and getting this wrong is how a 15s Gemini edit billed $3.90
// while the button said 5s. Extracted from the request handler so it can be
// unit-tested: it used to be an inline ternary chain inside a 400-line branch,
// which meant the only way to check it was to spend money.
//
//  · extend-video      fal's schema pins the output at 7s ("const": "7s")
//  · Veo reference     schema pins it at 8s, and the input build forces "8s"
//  · Lite first&last   renders 8s whatever the picker says
//  · clip edits        o3/Gemini have NO duration input — fal renders and bills
//                      the WHOLE source clip, so the bill follows the measured
//                      length. Only the server's own byte measurement is
//                      trusted; unparseable bills the model's max, because a
//                      client-claimed duration could undercharge a long clip.
//  · multi-shot        one continuous render of the summed shot lengths
// Durations each model actually offers, mirroring MODEL_OPTS in chat.js and
// fal's own duration enums. The request handler's generic 1..20 gate accepted
// ANY of them for ANY model and billed it: a stale or hand-rolled client could
// ask Gemini for 15s, and Gemini is a proven silent clamper — it would render
// 10 and we would charge 15. Same shape as the 30s clip cap. Reject instead;
// nothing has been spent at that point.
// Kept in step with the client by test/backend/model-config.test.mjs.
const MODEL_DURATIONS = {
  "fal-ai/veo3.1": [4, 6, 8],
  "fal-ai/veo3.1/fast": [4, 6, 8],
  "fal-ai/veo3.1/lite": [4, 6, 8],
  "bytedance/seedance-2.0/text-to-video": [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  "bytedance/seedance-2.0/fast/text-to-video": [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  "bytedance/seedance-2.0/mini/text-to-video": [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  "fal-ai/kling-video/o3/pro/text-to-video": [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  "fal-ai/kling-video/o3/standard/text-to-video": [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  "fal-ai/kling-video/v3/pro/text-to-video": [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  "fal-ai/kling-video/v3/standard/text-to-video": [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  "google/gemini-omni-flash": [3, 4, 5, 6, 7, 8, 9, 10],
};

// True when the chosen endpoint discards the picker's duration: a clip edit or
// extend, reference-to-video, or first-&-last. billableDuration is what decides
// the charge for those, so durationError must not 400 on a figure fal never
// reads. Kept beside durationError because the pair is one decision.
function ignoresPickerDuration({ clip, refs, first, last }) {
  return !!clip || (Array.isArray(refs) && refs.length > 0) || (!!first && !!last);
}

// "" when the duration is one this model renders. Endpoints that ignore the
// picker entirely (extend, the clip edits, reference-to-video) are billed by
// billableDuration, not this — so a value they discard is not worth a 400.
function durationError(model, duration, endpointIgnoresDuration) {
  const allowed = MODEL_DURATIONS[model];
  if (!allowed || duration == null || endpointIgnoresDuration) return "";
  if (allowed.includes(duration)) return "";
  const list = allowed.length > 4
    ? `${allowed[0]}-${allowed[allowed.length - 1]} seconds`
    : `${allowed.join(", ")} seconds`;
  return `this model renders ${list} — ${duration}s is not one of them`;
}

function billableDuration({ endpoint, model, duration, useShots, shots, clip, clipSecondsReal }) {
  if (endpoint.includes("/extend-video")) return 7;
  if (model.includes("veo") && endpoint.includes("/reference-to-video")) return 8;
  if (model.endsWith("veo3.1/lite") && endpoint.includes("/first-last-frame")) return 8;
  const isClipEdit = !!clip &&
    (endpoint.includes("/video-to-video/edit") || endpoint.endsWith("gemini-omni-flash/edit"));
  if (isClipEdit) {
    const max = endpoint.includes("/video-to-video/edit") ? 15 : 30;
    return Math.min(max, Math.ceil(clipSecondsReal || max));
  }
  if (useShots) return (shots || []).reduce((t, s) => t + Number(s.duration), 0);
  return duration;
}

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

// Real duration of a video clip data URI — mp4/mov (moov→mvhd) and webm/mkv
// (EBML Info→Duration) — so billing measures the clip instead of trusting the
// client's claim. The clip slot accepts any video/* the browser can hold, and
// an unmeasurable container bills the consumer's never-undercharge maximum: a
// 5s webm on Gemini's clip edit used to bill the 30s cap (~6× over).
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
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const mp4 = durMp4(b, dv);
  if (mp4 != null) return mp4;
  return durWebm(b, dv);
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

// Matroska/WebM (EBML): Segment → Info → Duration, counted in TimecodeScale
// units (default 1 ms). Returns null when the file carries no Duration — a
// MediaRecorder capture often doesn't — so the caller keeps its maximum rather
// than inventing a figure it is about to bill.
function durWebm(b, dv) {
  if (b.length < 4) return null;
  if (b[0] !== 0x1a || b[1] !== 0x45 || b[2] !== 0xdf || b[3] !== 0xa3) return null; // EBML magic
  // An EBML variable-int: the first set bit marks its width (1-8 bytes). IDs
  // keep that marker (Segment really is 0x18538067); sizes drop it, and a size
  // whose value bits are all 1s means "unknown length".
  const vint = (off, isId) => {
    if (off >= b.length) return null;
    const first = b[off];
    if (!first) return null; // no marker in the first byte — not one we handle
    let len = 1;
    while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
    if (len > (isId ? 4 : 8) || off + len > b.length) return null;
    const mask = 0xff >> len;
    let val = isId ? first : first & mask;
    let unknown = (first & mask) === mask;
    for (let i = 1; i < len; i++) {
      val = val * 256 + b[off + i]; // * not << : a 4-byte ID overflows 32-bit ops
      if (b[off + i] !== 0xff) unknown = false;
    }
    return { val, len, unknown };
  };
  // Walk one level of children as visit(id, contentStart, contentEnd). Bails on
  // anything it can't size instead of guessing — a mis-skip would read garbage
  // as the duration, and this figure gets billed.
  const walk = (start, end, visit) => {
    let off = start;
    while (off < end) {
      const id = vint(off, true);
      if (!id) return;
      const size = vint(off + id.len, false);
      if (!size) return;
      const body = off + id.len + size.len;
      if (body > end) return;
      // Only the Segment may declare an unknown length (streamed files); it
      // then runs to the end of the buffer. Anything else: stop.
      if (size.unknown && id.val !== 0x18538067) return;
      // stop > off always (body is at least off+2 and body > end already
      // returned), so the walk cannot stall.
      const stop = size.unknown ? end : Math.min(body + size.val, end);
      if (visit(id.val, body, stop) === false) return;
      off = stop;
    }
  };
  let scale = 1000000; // TimecodeScale default: 1 ms in nanoseconds
  let ticks = 0;
  walk(0, b.length, (id, from, to) => {
    if (id !== 0x18538067) return; // Segment
    walk(from, to, (sid, sfrom, sto) => {
      if (sid !== 0x1549a966) return; // Info
      walk(sfrom, sto, (iid, ifrom, ito) => {
        if (iid === 0x2ad7b1) { // TimecodeScale (uint)
          let v = 0;
          for (let i = ifrom; i < ito; i++) v = v * 256 + b[i];
          if (v > 0) scale = v;
        } else if (iid === 0x4489) { // Duration (IEEE float, 4 or 8 bytes)
          if (ito - ifrom === 4) ticks = dv.getFloat32(ifrom);
          else if (ito - ifrom === 8) ticks = dv.getFloat64(ifrom);
        }
      });
      return false; // Info read — nothing after it matters
    });
    return false;
  });
  const secs = (ticks * scale) / 1e9;
  return Number.isFinite(secs) && secs > 0 ? secs : null;
}

// How long an attached clip may be, per model. These are the EDIT/EXTEND
// endpoints, where fal renders — and bills — the whole source clip, so this is
// a real-money guard and not only a UX one. Mirrors CLIP_LIMITS in chat.js,
// which rejects at attach; the server keeps its own copy because the client's
// is not a guarantee. An unlisted model keeps the old blanket 15s.
const CLIP_MAX_S = {
  // 10, MEASURED — not from fal's schema, which documents no cap at all. Hand a
  // 30s clip to gemini-omni-flash/edit and it returns the first 10s (at 24fps)
  // and reports success; fal's own status says COMPLETED, so /api/refund can't
  // see it either. We billed 30s and delivered 10. The earlier 30 here was a
  // guess copied from chat.js, never verified, and unreachable until the
  // Seedance guard was scoped — the first clip over 15s to actually reach fal
  // is what exposed it. Raise this only against a real render of that length.
  "google/gemini-omni-flash": 10,
  "fal-ai/veo3.1": 23,                               // extend: fal's 30s ceiling minus the 7s it adds
  "fal-ai/veo3.1/fast": 23,
  "fal-ai/kling-video/o3/pro/text-to-video": 15,     // video-to-video/edit
  "fal-ai/kling-video/o3/standard/text-to-video": 15,
  "fal-ai/kling-video/lipsync/audio-to-video": 10,
};
const CLIP_MAX_DEFAULT_S = 15.5;

// Gate an attached clip on length. The 15s figure is SEEDANCE's — fal caps its
// reference-to-video inputs at 15s combined across @Video1-3 — and it used to
// be applied to every model, which made Gemini's 30s edit and Veo's 23s extend
// unreachable: the client happily attached a 25s clip, quoted it, and the
// server 400'd. Each family now gets the ceiling its own endpoint takes.
// Returns an error string for the caller to 400 with, or "" when it may run.
// Tolerance matches fal's own 0.05s (and the client's), so a 30.03s clip that
// passes at attach doesn't die here.
function clipLengthError(model, clipSecs, combinedRefSecs) {
  if (model.startsWith("bytedance/")) {
    return combinedRefSecs > 15.5 ? "video references are capped at 15 seconds combined" : "";
  }
  const cap = CLIP_MAX_S[model] || CLIP_MAX_DEFAULT_S;
  // Unmeasurable (0) still passes — the billing basis falls back to the
  // consumer's own maximum, which is the never-undercharge behaviour.
  return clipSecs > cap + 0.05
    ? `this model takes clips up to ${cap} seconds — trim it and try again`
    : "";
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
      if (siteDbConfigured(env)) { try { const u = await siteBackendBySlug(env, slug); if (u) { d1uuid = u; d1schema = await loadSiteSchema(u); } } catch {} }
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
          const rows = await siteQuery(env, uuid, "SELECT * FROM " + sqlIdent(def.name) + " ORDER BY id DESC LIMIT ?", [lim]);
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
          if (use.length) { await siteQuery(env, uuid, "INSERT INTO " + sqlIdent(def.name) + " (" + use.map(sqlIdent).join(",") + ") VALUES (" + use.map(() => "?").join(",") + ")", use.map((c) => rec[c])); }
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
const SPRITE_IMG_MODEL = "fal-ai/nano-banana-pro";
const SPRITE_IMG_USD = 0.15;
const SPRITE_PLACEHOLDER_PNG = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAOUlEQVR4nO3OMQEAAAgDoK1/aM3g4QcJqE1mZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2f/9wADkQAB/YvcHwAAAABJRU5ErkJggg==";
function chromaKeyGreenToPng(bytes) {
  // Decode → strip near-green pixels to alpha 0 → re-encode PNG. Best-effort:
  // any Photon hiccup falls back to the original bytes (opaque, but a real image).
  try {
    const img = PhotonImage.new_from_byteslice(new Uint8Array(bytes));
    const w = img.get_width(), h = img.get_height();
    const px = img.get_raw_pixels(); // Uint8Array RGBA
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      if (g > 108 && r < 115 && b < 115 && g - r > 40 && g - b > 40) px[i + 3] = 0; // green screen → transparent
    }
    // De-spill + matte cleanup: the hard green key leaves a ~1px anti-aliased rim
    // (subject pixels that blended toward the green screen, so they read as a green/
    // light halo). Erode the matte by 1px to drop that outer ring, then neutralize any
    // residual green on the NEW edge (clamp green to max(r,b)). Edge-limited, so interior
    // colours are never touched and a genuinely green sprite body is left alone.
    const alphaAt = (x, y) => px[(y * w + x) * 4 + 3];
    const drop = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (alphaAt(x, y) === 0) continue;
      if ((x > 0 && alphaAt(x - 1, y) === 0) || (x < w - 1 && alphaAt(x + 1, y) === 0) ||
          (y > 0 && alphaAt(x, y - 1) === 0) || (y < h - 1 && alphaAt(x, y + 1) === 0)) drop[y * w + x] = 1;
    }
    for (let p = 0; p < w * h; p++) if (drop[p]) px[p * 4 + 3] = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (px[i + 3] === 0) continue;
      if ((x > 0 && alphaAt(x - 1, y) === 0) || (x < w - 1 && alphaAt(x + 1, y) === 0) ||
          (y > 0 && alphaAt(x, y - 1) === 0) || (y < h - 1 && alphaAt(x, y + 1) === 0)) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        if (g > r && g > b) px[i + 1] = Math.max(r, b); // neutralize green rim
      }
    }
    const out = new PhotonImage(px, w, h);
    const pngBytes = out.get_bytes(); // PNG
    let bin = ""; const u8 = new Uint8Array(pngBytes);
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin);
  } catch (e) {
    console.log("chroma-key failed:", e && e.message);
    let bin = ""; const u8 = new Uint8Array(bytes);
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin);
  }
}
async function genSpritePng(env, prompt) {
  // Green-screen prompt so the chroma-key has a clean edge; PNG + 1:1 for a sprite.
  const p = String(prompt || "game character").slice(0, 240) +
    ". Single centered subject, full body, bold clean video-game sprite art with a thick outline. The ENTIRE background is one flat solid chroma-key green (#00FF00), edge to edge, filling the whole frame — no scenery, no gradient, no shadow, no other colour behind the subject.";
  const r = await fetch(`https://fal.run/${SPRITE_IMG_MODEL}`, {
    method: "POST",
    headers: { Authorization: `Key ${env.FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: p, aspect_ratio: "1:1", resolution: "1K", output_format: "png", num_images: 1 }),
    signal: AbortSignal.timeout(120000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("sprite gen " + r.status);
  const url = d.images && d.images[0] && d.images[0].url;
  if (!url) throw new Error("sprite gen empty");
  const media = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const bytes = await media.arrayBuffer();
  return chromaKeyGreenToPng(bytes);
}
// Resolve @@SPRITE:…@@ tokens → bundled assets. Returns { files (tokens replaced
// with assets/<name>), assets ({name: base64}), charged (# real sprites) }.
async function injectGameAssets(files, env, budget) {
  const tokens = parseSpriteTokens(files); // token → prompt
  const list = [...tokens.entries()].slice(0, Math.max(0, budget || 5));
  const overflow = [...tokens.entries()].slice(Math.max(0, budget || 5));
  const assets = {}, pathByToken = {};
  let charged = 0;
  await Promise.all(list.map(async ([tok, prompt], i) => {
    const name = "sprite-" + i + ".png";
    try { assets[name] = await genSpritePng(env, prompt); charged++; }
    catch (e) { assets[name] = SPRITE_PLACEHOLDER_PNG; } // never break the game
    pathByToken[tok] = "assets/" + name;
  }));
  // Any sprites past the budget also map to a bundled placeholder so k.loadSprite works.
  overflow.forEach(([tok], j) => { const name = "sprite-x" + j + ".png"; assets[name] = SPRITE_PLACEHOLDER_PNG; pathByToken[tok] = "assets/" + name; });
  const out = {};
  for (const [path, src] of Object.entries(files)) {
    let s = src;
    for (const [tok, rel] of Object.entries(pathByToken)) s = s.split(tok).join(rel);
    s = s.replace(/@@SPRITE:[\s\S]*?@@/g, () => "assets/sprite-0.png"); // stray tokens → first sprite
    out[path] = s;
  }
  return { files: out, assets, charged };
}

// ---- Layer-2: per-site backend on Neon Postgres ---------------------------------
// Each built site that needs data/auth gets its OWN Postgres database — one Neon
// project per isibi user, one database inside it per site — so a query for site A
// can only ever reach site A's database. The slug→connection map lives in Supabase
// (site_backends, service-key writes). Requires ONE Worker secret: NEON_API_KEY.
// Provisioning and the query layer live in ./site-db.mjs.
//
// `db` here is a Neon connection string. It threads through the schema engine in
// the position D1's database UUID used to occupy.
function siteDbConfigured(env) { return neonConfigured(env); }
// Run SQL against ONE site's database. Returns the result rows.
// Always parameterize — never string-concat user input into `sql`.
async function siteQuery(env, db, sql, params) { return sqlQuery(db, sql, params); }
// Same as siteQuery but also reports how many rows the statement changed — used by
// scoped UPDATE/DELETE to tell "done" from "matched nothing" (e.g. a visitor trying
// to edit a row that isn't theirs → 0 changes).
async function siteExec(env, db, sql, params) { return sqlExec(db, sql, params); }
// Declared column type → Postgres type. TEXT/INTEGER/REAL/NUMERIC are spelled the
// same in both dialects, so only the aliases below need mapping.
function tableDef(spec, name) { return (spec && Array.isArray(spec.tables)) ? spec.tables.find((t) => t && String(t.name).toLowerCase() === String(name).toLowerCase()) : null; }
// Does this isibi user own the React site <slug>? Proven from the generated source's
// stored uid (sitesrc/<slug>.json), falling back to the D1 backend ledger.
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
    await siteQuery(env, uuid, "CREATE TABLE IF NOT EXISTS _metrics (day TEXT PRIMARY KEY, reqs INTEGER DEFAULT 0, errs INTEGER DEFAULT 0)");
    await siteQuery(env, uuid, "INSERT INTO _metrics (day,reqs,errs) VALUES (?,?,?) ON CONFLICT(day) DO UPDATE SET reqs=reqs+excluded.reqs, errs=errs+excluded.errs", [day, agg.reqs, agg.errs]);
  } catch {}
}
// Visitor analytics — a built app POSTs page views + custom events. Each event is
// written straight through as a tiny (day,event,path) counter upsert-increment in the
// site's own D1 `_analytics` (never raw per-event storage), via ctx.waitUntil so the
// visitor never waits. Written per-event (not buffered) so the counts are EXACT even at
// low traffic — unlike ops `_metrics`, product view-counts need to be trustworthy. The
// `_analytics` table is ensured once per isolate.
const _notifsReady = new Set();
async function ensureNotifications(env, uuid) {
  if (_notifsReady.has(uuid)) return;
  await siteQuery(env, uuid, "CREATE TABLE IF NOT EXISTS _notifications (id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, user_id INTEGER NOT NULL, type TEXT, text TEXT, link TEXT, read INTEGER DEFAULT 0, created_at TEXT)");
  _notifsReady.add(uuid);
}
async function createNotification(env, uuid, userId, n) {
  const uid = parseInt(userId, 10);
  if (!(uid > 0)) return false;
  await ensureNotifications(env, uuid);
  await siteQuery(env, uuid, "INSERT INTO _notifications (user_id,type,text,link,created_at) VALUES (?,?,?,?,?)", [uid, String(n.type || "").slice(0, 40), String(n.text || "").slice(0, 500), String(n.link || "").slice(0, 400), new Date().toISOString()]);
  return true;
}
// Invite-only signup — the owner can require a valid invite code to register.
// Flag in _meta ('invite_only'='1'); codes live in `_invites` (code, uses_left).
const _sbEnc = new TextEncoder();
function _b64(bytes) { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function _b64url(s) { return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
async function _hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", _sbEnc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, _sbEnc.encode(msg));
  return _b64(new Uint8Array(sig));
}
// TOTP (RFC 6238) for two-factor auth — standard authenticator-app codes (Google
// Authenticator, Authy, 1Password). Secret is base32; codes are 6 digits over a 30s step.
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
  ]) { try { await siteQuery(env, uuid, sql); } catch {} }
  _authExtrasDone.add(uuid);
}
// Ensure a site's D1 has the _users + _meta tables and a per-site signing secret.
async function initSiteAuth(env, uuid) {
  await siteQuery(env, uuid, "CREATE TABLE IF NOT EXISTS _users (id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, email TEXT UNIQUE NOT NULL, pass_salt TEXT NOT NULL, pass_hash TEXT NOT NULL, failed INTEGER DEFAULT 0, locked_until INTEGER, role TEXT DEFAULT 'user', verified INTEGER DEFAULT 0, verify_token TEXT, verify_exp INTEGER, created_at TEXT DEFAULT (now()))");
  await siteQuery(env, uuid, "CREATE TABLE IF NOT EXISTS _meta (k TEXT PRIMARY KEY, v TEXT)");
  await ensureAuthExtras(env, uuid);
  const rows = await siteQuery(env, uuid, "SELECT v FROM _meta WHERE k='auth_secret'");
  if (rows[0] && rows[0].v) return rows[0].v;
  const secret = _b64(crypto.getRandomValues(new Uint8Array(32)));
  await siteQuery(env, uuid, "INSERT INTO _meta (k,v) VALUES ('auth_secret', ?) ON CONFLICT (k) DO NOTHING", [secret]);
  const r2 = await siteQuery(env, uuid, "SELECT v FROM _meta WHERE k='auth_secret'");
  return (r2[0] && r2[0].v) || secret;
}
// Email a built-site visitor a signed 24h "verify your email" link (→ /verify). Sent
// through the platform mailer; fire-and-forget so signup/login never block on it. The
// mailer no-ops until GO_FARTHER_API_KEY is set as a Worker secret (same as reset).
// What one build costs the caller. The designer is a single Sonnet call with a
// small output, so this sits alongside the other orchestrator fees rather than
// being priced like a generation.
const SITE_BUILD_FEE = 2;

// A plain-English brief becomes an isibi.schema.json. Uses tool-use rather than
// asking for JSON in prose: the model must return an object matching the schema
// below, so there is nothing to parse out of a reply and nothing to repair.
const SITE_SCHEMA_TOOL = {
  name: "design_schema",
  description: "Design the database tables a site needs, as an isibi.schema.json.",
  input_schema: {
    type: "object",
    properties: {
      brand: { type: "string", description: "Short display name for the site." },
      slug: { type: "string", description: "url-safe-name, lowercase, hyphens only." },
      tables: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "snake_case table name." },
            access: {
              type: "string",
              enum: ["collect", "display"],
              description: "'display' = anyone can read it, nobody writes (menus, services, posts). 'collect' = anyone can submit, nobody reads it back (bookings, orders, enquiries).",
            },
            columns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { type: "string", enum: ["text", "integer", "real", "boolean", "json"] },
                  required: { type: "boolean" },
                  ref: { type: "string", description: "Name of a table this column points at." },
                },
                required: ["name", "type"],
              },
            },
            timestamps: { type: "boolean" },
            fts: { type: "boolean", description: "Enable full-text search over this table's text columns." },
          },
          required: ["name", "access", "columns"],
        },
      },
      // Starter content, and not a nicety: nothing can write to a `display` table
      // after the build — not even the owner — so whatever is not seeded here is
      // an empty list forever, and a form whose required Select reads that table
      // cannot be submitted by anyone.
      seed: {
        type: "object",
        description: "Starter rows for each 'display' table, keyed by table name: {\"services\": [{...}, {...}]}. " +
          "REQUIRED for every display table — a table left unseeded shows an empty list forever, because nothing can write to it after the build. " +
          "Write 3-6 realistic rows per table using only that table's declared columns. Make them plausible for this specific business, not placeholders: " +
          "real service names and real prices, not 'Item 1' / 0.00.",
        additionalProperties: { type: "array", items: { type: "object" } },
      },
    },
    required: ["brand", "slug", "tables", "seed"],
  },
};

async function designSiteSchema(env, brief) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      tools: [SITE_SCHEMA_TOOL],
      tool_choice: { type: "tool", name: "design_schema" },
      system: "You design the data model behind a small business website. Keep it to the few tables the site actually needs — usually one to four. " +
              "Use 'display' for content the business publishes and visitors read (services, menu items, posts). " +
              "Use 'collect' for anything a visitor submits — bookings, orders, enquiries, signups. Those are write-only on purpose: the visitor sends one in, " +
              "and only the business reads them, so customer names and phone numbers are never served back to the public. " +
              "Prefer few columns with obvious names. Turn on fts only where someone would genuinely search free text. " +
              "Then fill every 'display' table with 3-6 realistic starter rows in `seed`. This is not optional and it is not decoration: " +
              "nothing can write to a display table after the build, so an unseeded table is an empty list forever, and any form field that " +
              "chooses from it will have nothing to choose. Write content a real business would publish.",
      messages: [{ role: "user", content: brief }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) {
    const e = new Error("anthropic " + r.status);
    e.detail = (await r.text().catch(() => "")).slice(0, 300);
    throw e;
  }
  const j = await r.json();
  const use = (Array.isArray(j.content) ? j.content : []).find((b) => b && b.type === "tool_use");
  return (use && use.input) || null;
}

// Page generation is a much bigger call than the schema design — whole .tsx files
// rather than a handful of column names — so it is metered on what it actually
// used, like the game builder, instead of a flat fee sized for the worst case.
//
// Sized above what the pages themselves need: Sonnet 5 runs adaptive thinking
// when `thinking` is omitted, and max_tokens caps thinking AND the response
// together — so a budget tight around the files would spend part of itself
// reasoning and truncate the last one. (Truncation is caught below rather than
// published, but a truncated generation is a paid call that produced nothing.)
const SITE_PAGES_MAX_TOKENS = 24000;

// The pages themselves. Same tool-use shape as designSiteSchema directly above:
// the model fills in a tool whose input_schema IS the return type, so there is no
// prose to parse and no half-written file to repair out of a reply.
//
// The schema designed above is this step's INPUT, not something it may extend —
// a page can only read a table that already exists in the database, at the access
// level the database actually granted it.
//
// `fix` turns this into the repair pass: same rules, same tool, but the user turn
// carries what was written last time and everything wrong with it.
async function generateSitePages(env, brief, spec, brand, fix) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: SITE_PAGES_MAX_TOKENS,
      tools: [SITE_PAGES_TOOL],
      tool_choice: { type: "tool", name: "write_pages" },
      system: PAGE_RULES,
      messages: [{ role: "user", content: fix ? repairPrompt(brief, spec, fix.pages, fix.problems, brand) : pagesPrompt(brief, spec, brand) }],
    }),
    signal: AbortSignal.timeout(240000),
  });
  if (!r.ok) {
    const e = new Error("anthropic " + r.status);
    e.status = r.status;
    e.detail = (await r.text().catch(() => "")).slice(0, 300);
    throw e;
  }
  const j = await r.json();
  const usage = j.usage || {};
  const used = { usedIn: usage.input_tokens || 0, usedOut: usage.output_tokens || 0 };
  // A tool_use block cut off at max_tokens carries half-written JSON, which parses
  // into a page whose last file is truncated. Treat it as a failed generation
  // rather than shipping a file that ends mid-expression.
  if (j.stop_reason === "max_tokens") return { input: null, truncated: true, ...used };
  const use = (Array.isArray(j.content) ? j.content : []).find((b) => b && b.type === "tool_use");
  return { input: (use && use.input) || null, ...used };
}

// Placeholder published page. Deliberately plain: it reports what was actually
// created so a build is verifiable end to end before page generation exists.
function schemaPlaceholderPage(brand, spec) {
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tables = (spec.tables || []).map((t) => {
    const cols = (t.columns || []).map((c) => "<li><code>" + esc(typeof c === "string" ? c : c.name) + "</code></li>").join("");
    return "<section><h2>" + esc(t.name) + "</h2><p>" + esc(t.access === "user" ? "each visitor sees only their own rows" : "shared across visitors") +
           "</p><ul>" + cols + "</ul></section>";
  }).join("");
  return "<!doctype html><meta charset=utf-8><meta name=viewport content=\"width=device-width,initial-scale=1\">" +
    "<title>" + esc(brand) + "</title>" +
    "<style>body{font:16px/1.6 system-ui,sans-serif;max-width:46rem;margin:4rem auto;padding:0 1.5rem;color:#111}" +
    "h1{font-size:2rem;margin:0 0 .25rem}p.sub{color:#666;margin:0 0 2.5rem}" +
    "section{border:1px solid #e5e5e5;border-radius:10px;padding:1rem 1.25rem;margin:0 0 1rem}" +
    "h2{font-size:1.05rem;margin:0 0 .25rem}section p{color:#666;font-size:.9rem;margin:0 0 .5rem}" +
    "ul{margin:0;padding-left:1.1rem}code{background:#f5f5f5;padding:.1rem .35rem;border-radius:4px;font-size:.85rem}</style>" +
    "<h1>" + esc(brand) + "</h1><p class=sub>Database is live. These tables were created for this site.</p>" + tables;
}

function svcHeaders(env, extra) {
  return { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, ...(extra || {}) };
}

// The owner's Neon project row, or null. Reads the connection string, which
// carries a password — user_site_project has RLS on with NO policies, so only
// the service key can see this and it never reaches a browser.
async function userSiteProject(env, uid) {
  const g = await fetch(`${SUPABASE_URL}/rest/v1/user_site_project?uid=eq.${encodeURIComponent(uid)}&select=neon_project,neon_branch,neon_role,neon_conn`, { headers: svcHeaders(env) });
  const rows = await g.json().catch(() => []);
  return (Array.isArray(rows) && rows[0]) || null;
}

// slug → that site's Postgres connection string. Two lookups: the site row names
// a database, the owner's project row supplies the endpoint and credentials.
// slug → connection string, cached. This is TWO Supabase round trips (the
// backend row, then the owner's project) on the way to every single row a
// visitor reads, and the answer is immutable for the life of a site: a slug is
// claimed once and its database never moves. Only a DELETE changes it, and that
// invalidates explicitly below.
//
// Measured before caching: ~0.9s median for a six-row read, of which four
// sequential round trips were the request and three were this lookup plus the
// schema read. Cached, a warm isolate pays one.
const SITE_CONN_TTL_MS = 300_000;
const _connCache = makeCache({ ttlMs: SITE_CONN_TTL_MS, max: 500 });

// KV first, then the two Supabase calls. Supabase stays the source of truth —
// a KV miss falls back and backfills, so an unbound or empty namespace is slow,
// never wrong. Only the connection string is stored: it is fixed at build time,
// so KV's eventual consistency cannot make it stale. (The schema is NOT stored
// there — a revise changes it, and a minute of staleness would 404 the site's
// own new tables.)
const routeDeps = (env) => ({
  kv: env.SITE_ROUTES || null,
  fromSource: (slug) => siteBackendBySlugFresh(env, slug),
  onBackfillError: (e) => console.error("site route KV:", (e && e.message) || e),
});

const _resolveBackend = memoize(_connCache, async (slug, env) => lookupRoute(routeDeps(env), slug));

// Argument order is (env, slug) because that is what handleSiteData passes.
async function siteBackendBySlug(env, slug) { return _resolveBackend(slug, env); }

// Provision (or reuse) one site's database, returning its connection string.
// Called when a build starts, so a site has somewhere to put data the moment
// the generator declares a schema.
//
// The user's Neon PROJECT is created lazily on their first build rather than at
// signup: most accounts never build a site, and projects are a capped resource —
// provisioning per signup would spend the quota on people who never use it.
// An uncached slug lookup. siteBackendBySlug caches for five minutes, which is
// right on the request path and wrong here — see site-provision.mjs.
async function siteBackendBySlugFresh(env, slug) {
  const r = await siteBackendRowFresh(env, slug);
  return (r && r.conn) || null;
}

// The same lookup, keeping the OWNER. Everything that writes needs this: a
// connection string alone cannot answer "is this site mine?". Throws rather
// than returning null when the lookup itself fails, so a caller cannot mistake
// "Supabase is down" for "nobody owns this slug".
async function siteBackendRowFresh(env, slug) {
  const g = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(slug)}&select=neon_db,uid`, { headers: svcHeaders(env), signal: AbortSignal.timeout(12000) });
  if (!g.ok) throw Object.assign(new Error("site lookup failed"), { detail: g.status + " " + (await g.text().catch(() => "")).slice(0, 200) });
  const rows = await g.json();
  const row = Array.isArray(rows) && rows[0];
  if (!row) return null;
  if (!row.neon_db) return { conn: null, uid: row.uid };
  const proj = await userSiteProject(env, row.uid);
  return { conn: proj ? connForDatabase(proj.neon_conn, row.neon_db) : null, uid: row.uid };
}

// Provision (or reuse) one site's database, returning its connection string.
// The ordering and the failure paths live in site-provision.mjs, where they are
// tested; this supplies the real Neon and Supabase calls.
async function ensureSiteBackend(env, slug, uid) {
  const write = async (table, body) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: svcHeaders(env, { "content-type": "application/json", Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    // The result was previously not looked at, so a failed write left a Neon
    // project or database that nothing recorded.
    return r.ok ? { ok: true } : { ok: false, detail: (await r.text().catch(() => "")).slice(0, 300) };
  };
  const conn = await ensureSiteBackendPure({
    lookupSite: (s2) => siteBackendRowFresh(env, s2),
    lookupProject: (u) => userSiteProject(env, u),
    createProject: (u) => createUserProject(env, u),
    dropProject: async (id) => {
      console.error("dropping unrecorded neon project:", id);
      return dropUserProject(env, id);
    },
    saveProject: (u, proj) => write("user_site_project", { uid: u, ...proj }),
    createDatabase: (proj, s2) => createSiteDatabase(env, proj.neon_project, proj.neon_branch, proj.neon_role, s2),
    saveBackend: (s2, u, db) => write("site_backends", { slug: s2, uid: u, neon_db: db }),
    connFor: connForDatabase,
    dbNameFor: dbNameForSite,
  }, { slug, uid });
  // Publish the route so the first visitor read never touches Supabase. Purely
  // an optimisation — the lookup backfills on a miss anyway — so a failure here
  // must not fail a build that has otherwise succeeded.
  await saveRoute(routeDeps(env), slug, conn);
  return conn;
}
// Content-type for a served R2 object by its extension (React dist assets + pages).
const R2_MIME = { js: "text/javascript", mjs: "text/javascript", css: "text/css", svg: "image/svg+xml", json: "application/json", map: "application/json", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", txt: "text/plain", xml: "application/xml", webmanifest: "application/manifest+json", html: "text/html; charset=utf-8" };
// Keep the last few PUBLISHED builds so a bad deploy can be rolled back: each publish
// snapshots its whole dist as one JSON (builds/<slug>/<ts>.json); keep the newest 5,
// prune older. Best-effort — never blocks a publish.
async function writeGameDistToR2(env, slug, dist) {
  try { const old = await env.SITES_BUCKET.list({ prefix: "games/" + slug + "/" }); for (const o of (old.objects || [])) await env.SITES_BUCKET.delete(o.key); } catch {}
  for (const [rel, v] of Object.entries(dist || {})) {
    const safeRel = String(rel).replace(/[^a-z0-9/._-]/gi, "-");
    const ext = (safeRel.match(/\.([a-z0-9]{1,8})$/i) || [])[1] || "";
    const ct = R2_MIME[ext.toLowerCase()] || "application/octet-stream";
    let bodyOut;
    if (v && typeof v.t === "string") bodyOut = v.t;
    else if (v && typeof v.b === "string") { const bin = atob(v.b); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); bodyOut = u8; }
    else continue;
    await env.SITES_BUCKET.put("games/" + slug + "/" + safeRel, bodyOut, { httpMetadata: { contentType: ct } });
  }
}

// Every object a site has published. R2's list() returns at most 1000 keys per
// call, so this follows the cursor rather than stopping at the first page — a
// React dist is only a handful of objects, but a half-deleted site serves a
// shell whose assets 404, which is worse than not deleting at all.
async function deleteSitePrefix(env, slug) {
  let cursor, removed = 0;
  for (;;) {
    const page = await env.SITES_BUCKET.list({ prefix: "sites/" + slug + "/", cursor });
    for (const o of (page.objects || [])) { await env.SITES_BUCKET.delete(o.key); removed++; }
    // Stopping when there is no cursor as well as when the page is not truncated
    // is what makes this loop terminate unconditionally: a truncated page with no
    // cursor would otherwise re-request the same page forever and burn the
    // Worker's CPU budget, which is a worse failure than deleting one page short.
    if (!page.truncated || !page.cursor) return removed;
    cursor = page.cursor;
  }
}

// Publish a compiled site. The prefix is wiped first: vite hashes its asset file
// names, so without this every rebuild would leave the previous build's JS and CSS
// behind forever. Same {t}/{b} envelope the build service returns for the games.
async function writeSiteDistToR2(env, slug, dist) {
  try { await deleteSitePrefix(env, slug); } catch {}
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

// brief + schema → route files → `tsc --noEmit` + `vite build` in the container →
// the dist published to sites/<slug>/.
//
// The decisions — pay for a repair pass? was the repair an improvement? publish at
// all? — live in builder/publish-pages.mjs, which takes every side effect as an
// injected function so they can be driven against fakes in test/publish-pages.test.mjs.
// This is only the wiring that supplies the real ones.
async function buildAndPublishPages(env, { brief, spec, slug, brand, auth }) {
  const out = await publishPages({
    // A failed repair is swallowed by publishPages (the first attempt stands), so
    // it is logged here or nowhere. A failed FIRST attempt propagates and is
    // logged by the route, so logging it here too would only duplicate it.
    generate: async (fix) => {
      if (!fix) return generateSitePages(env, brief, spec, brand);
      try { return await generateSitePages(env, brief, spec, brand, fix); }
      catch (e) { console.error("page repair failed:", slug, (e && (e.detail || e.message))); throw e; }
    },
    compile: async (pages) => {
      const files = {};
      for (const p of pages) files[p.path] = p.source;
      const c = getContainer(env.SITE_BUILD_CONTAINER);
      const r = await c.fetch(new Request("http://build/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files, slug, title: brand }),
      }));
      return await r.json().catch(() => ({ ok: false, stage: "build", error: "the build service returned no JSON" }));
    },
    publish: (dist) => writeSiteDistToR2(env, slug, dist),
    readCredits: () => readCredits(auth),
    useCredits: (n) => useCredits(auth, n),
  }, { spec, slug });
  if (out.page !== "app" && out.error) console.error("site page build failed:", slug, out.stage, out.error);
  return out;
}

// Cheap, high-precision defect scan on a generated page — no JS execution, so it
// only flags things we're SURE are wrong: a truncated document, leftover lorem,
// nav links to pages that don't exist, and hotlinked external images (which the
// published-site CSP will block). Returns a list of plain-English problems; an
// empty list means "ship it, no fix pass" (so clean generations cost nothing extra).
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
      if (!slug || !token || !env.SUPABASE_SERVICE_KEY || !siteDbConfigured(env)) return page("Invalid link", "This verification link is invalid. Try requesting a new one from the app.", false);
      try {
        const uuid = await siteBackendBySlug(env, slug);
        if (!uuid) return page("Invalid link", "This verification link is invalid or has expired.", false);
        const secret = await initSiteAuth(env, uuid);
        const p = await verifySiteUserToken(secret, token);
        if (!p || p.purpose !== "verify" || p.slug !== slug || !p.sub) return page("Link expired", "This verification link is invalid or has expired. Request a new one from the app.", false);
        await siteQuery(env, uuid, "UPDATE _users SET verified=1, verify_token=NULL, verify_exp=NULL WHERE id=?", [p.sub]);
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

    // Serve a PUBLISHED game from R2: isibi.ai/g/<slug>/… — the compiled kaplay
    // dist (index.html + assets/*). Root/no-extension → index.html; a path with an
    // extension → that exact asset. Mirrors the /s/ React-site branch.
    {
      const gm = url.pathname.match(/^\/g\/([a-z0-9][a-z0-9-]{0,80})(?:\/(.*))?$/i);
      if (gm && env.SITES_BUCKET) {
        const slug = gm[1].toLowerCase();
        const rest = (gm[2] || "").replace(/\/+$/, "");
        const last = rest.split("/").pop() || "";
        const ext = (last.match(/\.([a-z0-9]{1,8})$/i) || [])[1];
        let key, ctype, immutable = false;
        if (rest === "") { key = "games/" + slug + "/index.html"; ctype = "text/html; charset=utf-8"; }
        else if (ext) { key = "games/" + slug + "/" + rest.replace(/[^a-z0-9/._-]/gi, "-"); ctype = R2_MIME[ext.toLowerCase()] || "application/octet-stream"; immutable = ext.toLowerCase() !== "html"; }
        else { key = "games/" + slug + "/index.html"; ctype = "text/html; charset=utf-8"; }
        const obj = await env.SITES_BUCKET.get(key);
        if (!obj) return new Response("Not found", { status: 404 });
        return new Response(obj.body, {
          headers: {
            "content-type": ctype,
            "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=60",
            "x-content-type-options": "nosniff",
          },
        });
      }
      if (gm) return new Response("Not found", { status: 404 });
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
      const clipTooLong = clipDataUri ? clipLengthError(model, clipSecondsReal, vrefCombinedSecs) : "";
      if (clipTooLong) {
        return Response.json({ error: clipTooLong }, { status: 400 });
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

      // That 1..20 accepts any duration for ANY model and then bills it. Gemini
      // is a proven silent clamper — asked for 15s it renders 10 and reports
      // COMPLETED, so the user pays 15 for 10. Hold each model to fal's own
      // enum. The exemption reads the DERIVED first/last/refs, i.e. the images
      // that survived validation, not whatever the body claimed. Placement is
      // load-bearing twice over: below `duration` (declared just above — using
      // it any earlier is a temporal dead zone that ReferenceErrors on every
      // video request) and above the fal submit and the ledger, so a 400 here
      // has cost nothing.
      if (genKind === "video") {
        const durBad = durationError(model, duration, ignoresPickerDuration({ clip, refs, first, last }));
        if (durBad) return Response.json({ error: durBad }, { status: 400 });
      }

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
      const billDuration = billableDuration({
        endpoint, model, duration, useShots, shots, clip, clipSecondsReal,
      });
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
      // The price list and the metadata placement live in billing.mjs, where
      // they are tested — see test/billing.test.mjs. selectPurchase uses hasOwn,
      // so `{"plan":"__proto__"}` is refused instead of resolving to
      // Object.prototype and sending Stripe `unit_amount: "undefined"`.
      const purchase = selectPurchase(body);
      if (!purchase) return Response.json({ error: "unknown plan" }, { status: 400 });
      const sub = purchase.kind === "plan"; // memberships are the only subscription
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
          const LIVE = LIVE_SUBSCRIPTION_STATUSES;
          for (const c of ((cd && cd.data) || [])) {
            const srr = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(c.id)}&status=all&limit=10`, { headers: sAuth, signal: AbortSignal.timeout(12000) });
            const sdd = await srr.json().catch(() => ({}));
            if (((sdd && sdd.data) || []).some((s) => LIVE.includes(s.status))) {
              return Response.json({ error: "already_subscribed", reason: "You already have an active membership. Manage or cancel it from Settings before changing plans." }, { status: 409 });
            }
          }
        } catch {} // Stripe unreachable → let the purchase proceed (fail open)
      }
      const form = checkoutForm(purchase, user);
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
      const LIVE = LIVE_SUBSCRIPTION_STATUSES;
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
      // The signature check is the only thing authenticating this route. It lives
      // in stripe-webhook.mjs so it can be tested — see test/stripe-webhook.test.mjs.
      // STRIPE_WEBHOOK_SECRET may hold several comma-separated secrets: during a
      // rotation Stripe signs with every active one, and accepting only the newest
      // would 400 legitimately paid invoices for the whole overlap window.
      const vr = await verifyStripeSignature({
        header: request.headers.get("Stripe-Signature"),
        raw,
        secrets: String(env.STRIPE_WEBHOOK_SECRET).split(",").map((x) => x.trim()).filter(Boolean),
      });
      if (!vr.ok) {
        console.error("stripe webhook rejected:", vr.reason);
        return Response.json({ error: "bad signature" }, { status: 400 });
      }

      let event;
      try { event = JSON.parse(raw); } catch {
        return Response.json({ error: "bad payload" }, { status: 400 });
      }

      // What this event should mint, if anything — the guards that stop a $0
      // proration invoice or an unpaid session from buying credits live in
      // mintFromEvent, where they are tested. `ref` is what makes it idempotent:
      // add_credits is UNIQUE on it, so a Stripe retry cannot double-credit.
      const mint = mintFromEvent(event);
      if (mint) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/add_credits`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
          body: JSON.stringify({
            target: mint.uid, amount: mint.credits, cents: mint.cents,
            purchase_ref: mint.ref, mint_key: env.CREDITS_MINT_SECRET,
          }),
          signal: AbortSignal.timeout(10000),
        });
        // Non-2xx → 500 so Stripe retries the delivery.
        if (!r.ok) return Response.json({ error: "credit grant failed" }, { status: 500 });

        // Memberships also carry a storage tier, on a rolling 32-day window — a
        // cancellation lapses to free once no invoice renews. set_plan MUST
        // succeed: swallowing it (bug 2026-07-17) returned 200, so Stripe never
        // retried and the paid customer's every save 402'd "free".
        if (mint.tier) {
          let planOk = false;
          try {
            const pr = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_plan`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
              body: JSON.stringify({
                target: mint.uid, p_tier: mint.tier,
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


    // ── Game builder (Phase 3) ────────────────────────────────────────────
    // Health probe for the game build-service container (mirrors site build-health).
    if (url.pathname === "/api/game/build-health" && request.method === "GET") {
      const ghUser = await authUser(request);
      if (!ghUser) return UNAUTHED();
      if (!env.GAME_BUILD_CONTAINER) return Response.json({ ok: false, error: "container binding not configured" }, { status: 501 });
      const t0 = Date.now();
      try {
        const c = getContainer(env.GAME_BUILD_CONTAINER);
        const r = await c.fetch(new Request("http://build/health", { method: "GET" }));
        const body = await r.text();
        return Response.json({ ok: r.ok, status: r.status, body: body.slice(0, 100), ms: Date.now() - t0 });
      } catch (e) {
        return Response.json({ ok: false, error: String(e && e.message || e).slice(0, 300), ms: Date.now() - t0 }, { status: 502 });
      }
    }
    // POST /api/game/build — Sonnet(GAME_RULES) → parseGameFiles → container
    // `vite build` + RUNTIME SMOKE TEST → Phase-4 auto-fix loop (compile AND
    // runtime failures) → publish to games/<slug>/ → live at /g/<slug>/. Metered
    // at Sonnet rates, charge-as-you-go. Kaplay games are pure client-side, so
    // there's no schema/backend provisioning (unlike the React app builder).
    if (url.pathname === "/api/game/build" && request.method === "POST") {
      const gu = await authUser(request);
      if (!gu) return UNAUTHED();
      if (!env.ANTHROPIC_API_KEY) return Response.json({ ok: false, error: "engine not configured" }, { status: 501 });
      if (!env.GAME_BUILD_CONTAINER || !env.SITES_BUCKET) return Response.json({ ok: false, error: "build service not configured" }, { status: 501 });
      const tlG = tooLargeBody(request, 200_000); if (tlG) return tlG;
      let gb; try { gb = await request.json(); } catch { return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
      const brief = typeof gb.brief === "string" ? gb.brief.trim().slice(0, 2000) : "";
      if (!brief) return Response.json({ ok: false, error: "no brief" }, { status: 400 });
      const engine = gb.engine === "3d" ? "3d" : "2d"; // Phase 7: Babylon 3D vs kaplay 2D
      const art = engine === "3d" ? "shapes" : (gb.art === "sprites" ? "sprites" : "shapes"); // 3D uses primitives, not AI sprites
      const auth = request.headers.get("Authorization") || "";
      const CREDIT_USD = 0.008, GB_MAX_OUT = 16000, GB_MODEL = "claude-sonnet-5";
      const RATE_IN = 3e-6, RATE_OUT = 15e-6;
      const gbCredits = (i, o) => Math.max(1, Math.ceil((i * RATE_IN + o * RATE_OUT) / CREDIT_USD));
      let bal0; try { bal0 = await readCredits(auth); } catch { bal0 = 0; }
      if (!(bal0 >= gbCredits(2500, GB_MAX_OUT))) return Response.json({ ok: false, error: "not enough credits", need: "credits" }, { status: 402 });
      const dumpFiles = (f) => Object.entries(f).map(([p, s]) => "===FILE: " + p + "===\n" + s).join("\n\n").slice(0, 90000);
      // The build STREAMS as NDJSON so the Studio shows it live (Claude-Code style):
      // {ev:"code"} carries source as the model writes it, {ev:"phase"} marks
      // generating→compiling→(fixing)→publishing, terminal {ev:"done"|"error"}.
      // Streaming also keeps the HTTP connection alive through the ~60s build so it
      // never trips a client/edge idle timeout. ctx.waitUntil keeps the writer alive.
      const enc = new TextEncoder();
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const emit = (o) => writer.write(enc.encode(JSON.stringify(o) + "\n")).catch(() => {});
      // Streaming Sonnet call; forwards text deltas to onDelta, returns full text + usage.
      const streamGen = async (system, user, onDelta) => {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({ model: GB_MODEL, max_tokens: GB_MAX_OUT, stream: true, system, messages: [{ role: "user", content: user }] }),
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
      const buildGame = async (files, assets, models) => {
        const c = getContainer(env.GAME_BUILD_CONTAINER);
        const t0 = Date.now();
        const br = await c.fetch(new Request("http://build/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files, assets: assets || undefined, models: models || undefined, smoke: true }) }));
        const bd = await br.json().catch(() => ({ ok: false, error: "build service returned no JSON" }));
        return { bd, buildMs: Date.now() - t0 };
      };
      // Batch code deltas so the client gets readable chunks, not a flood.
      let codeBuf = "";
      const flushCode = (force) => { if (codeBuf && (force || codeBuf.length >= 120)) { emit({ ev: "code", t: codeBuf }); codeBuf = ""; } };
      const onDelta = (d) => { codeBuf += d; flushCode(false); };
      const run = async () => {
        try {
          let cost = 0;
          emit({ ev: "phase", phase: "generating" });
          const genRules = engine === "3d" ? GAME_3D_RULES : (art === "sprites" ? GAME_ASSET_RULES : GAME_RULES);
          const g = await streamGen(genRules, "Build this game. Output ONLY the file blocks.\n\n" + brief, onDelta);
          flushCode(true);
          let files = parseGameFiles(g.text);
          if (!files["src/main.js"]) { emit({ ev: "error", msg: "the generated game came out incomplete — try again" }); return; }
          cost += gbCredits(g.usedIn, g.usedOut);
          try { await useCredits(auth, gbCredits(g.usedIn, g.usedOut)); } catch {}
          // Phase 6: generate + cut out the AI sprites, bundle them into the build.
          let gameAssets = {};
          if (art === "sprites" && env.FAL_KEY) {
            emit({ ev: "phase", phase: "arting" });
            const ga = await injectGameAssets(files, env, 5);
            files = ga.files; gameAssets = ga.assets || {};
            const sc = Math.max(0, ga.charged) * Math.max(1, Math.ceil(SPRITE_IMG_USD / CREDIT_USD));
            if (sc) { cost += sc; try { await useCredits(auth, sc); } catch {} }
          }
          let bd, buildMs, attempt = 0;
          for (;;) {
            emit({ ev: "phase", phase: attempt ? "fixing" : "compiling" });
            ({ bd, buildMs } = await buildGame(files, gameAssets, engine === "3d" ? [...new Set((JSON.stringify(files).match(/[a-z0-9_-]+\.glb/gi) || []).map((s) => s.toLowerCase()))] : null));
            const compileFail = !bd.ok;
            const runtimeFail = bd.ok && bd.smoke && !bd.smoke.passed;
            if (!compileFail && !runtimeFail) break;
            if (attempt >= 2) break;
            attempt++;
            emit({ ev: "phase", phase: "fixing" });
            const fixPrompt = engine === "3d"
              ? (game3DFixRules(compileFail ? { compile: true, list: [String(bd.error || "").slice(0, 3000)] } : bd.smoke.errors) + "\n\nCurrent files:\n\n" + dumpFiles(files))
              : (compileFail
                  ? ("The kaplay build FAILED to compile. Fix it and return the FULL corrected file blocks (only changed files). Output ONLY file blocks.\n\nBUILD ERROR:\n" + String(bd.error || "").slice(0, 3000) + "\n\nCurrent files:\n\n" + dumpFiles(files))
                  : (gameFixRules(bd.smoke.errors) + "\n\nCurrent files:\n\n" + dumpFiles(files)));
            let fg; try { fg = await streamGen(engine === "3d" ? GAME_3D_RULES : GAME_RULES, fixPrompt, onDelta); flushCode(true); } catch { break; }
            cost += gbCredits(fg.usedIn, fg.usedOut);
            try { await useCredits(auth, gbCredits(fg.usedIn, fg.usedOut)); } catch {}
            const fixed = parseGameFiles(fg.text);
            if (!Object.keys(fixed).length) break;
            Object.assign(files, fixed);
          }
          if (!bd.ok) { emit({ ev: "error", stage: "build", msg: String(bd.error || "build failed").slice(0, 600), fixed: attempt }); return; }
          emit({ ev: "phase", phase: "publishing" });
          const seed = ((brief.toLowerCase().match(/[a-z0-9]+/g) || ["game"]).slice(0, 3).join("-").slice(0, 40)) || "game";
          const slug = seed + "-" + crypto.randomUUID().slice(0, 6);
          await writeGameDistToR2(env, slug, bd.files);
          try { await env.SITES_BUCKET.put("gamesrc/" + slug + ".json", JSON.stringify({ files, assets: gameAssets, uid: gu.id, engine }), { httpMetadata: { contentType: "application/json" } }); } catch {}
          let balAfter; try { balAfter = await readCredits(auth); } catch { balAfter = bal0 - cost; }
          emit({ ev: "done", url: "/g/" + slug + "/", slug, buildMs, fixed: attempt, smoke: bd.smoke || null, cost, balance: balAfter });
        } catch (e) {
          emit({ ev: "error", msg: (e && e.status === 402) ? "not enough credits" : String(e && e.message || e).slice(0, 200), detail: (e && e.detail) || undefined });
        } finally {
          try { await writer.close(); } catch {}
        }
      };
      ctx.waitUntil(run());
      return new Response(readable, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
    }

    // POST /api/game/revise — iterate on an existing game ("make it faster", "add a
    // boss", "change the colours"). Loads the stashed source (gamesrc/<slug>.json),
    // applies Sonnet(GAME_REVISE_RULES) with the instruction, rebuilds in the
    // container with the smoke test + Phase-4 auto-fix loop, and REPUBLISHES to the
    // SAME slug so /g/<slug>/ stays stable. Turns the one-shot generator into a
    // studio. Same metering/guards as /api/game/build.
    if (url.pathname === "/api/game/revise" && request.method === "POST") {
      const gu = await authUser(request);
      if (!gu) return UNAUTHED();
      if (!env.ANTHROPIC_API_KEY) return Response.json({ ok: false, error: "engine not configured" }, { status: 501 });
      if (!env.GAME_BUILD_CONTAINER || !env.SITES_BUCKET) return Response.json({ ok: false, error: "build service not configured" }, { status: 501 });
      const tlR = tooLargeBody(request, 200_000); if (tlR) return tlR;
      let rv; try { rv = await request.json(); } catch { return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
      const slug = typeof rv.slug === "string" ? rv.slug.replace(/[^a-z0-9-]/gi, "").slice(0, 80) : "";
      const instruction = typeof rv.instruction === "string" ? rv.instruction.trim().slice(0, 2000) : "";
      if (!slug || !instruction) return Response.json({ ok: false, error: "missing slug or instruction" }, { status: 400 });
      // Load the stashed source; only the owner can revise their own game.
      let srcObj = null;
      try { const o = await env.SITES_BUCKET.get("gamesrc/" + slug + ".json"); if (o) srcObj = JSON.parse(await o.text()); } catch {}
      if (!srcObj || !srcObj.files || !srcObj.files["src/main.js"]) return Response.json({ ok: false, error: "couldn’t find that game’s source to edit" }, { status: 404 });
      if (srcObj.uid && srcObj.uid !== gu.id) return Response.json({ ok: false, error: "not your game" }, { status: 403 });
      const engine = srcObj.engine === "3d" ? "3d" : "2d"; // Phase 7: revise a 3D game with the Babylon rules
      const auth = request.headers.get("Authorization") || "";
      const CREDIT_USD = 0.008, GB_MAX_OUT = 16000, GB_MODEL = "claude-sonnet-5";
      const RATE_IN = 3e-6, RATE_OUT = 15e-6;
      const gbCredits = (i, o) => Math.max(1, Math.ceil((i * RATE_IN + o * RATE_OUT) / CREDIT_USD));
      let bal0; try { bal0 = await readCredits(auth); } catch { bal0 = 0; }
      if (!(bal0 >= gbCredits(2500, GB_MAX_OUT))) return Response.json({ ok: false, error: "not enough credits", need: "credits" }, { status: 402 });
      const dumpFiles = (f) => Object.entries(f).map(([p, s]) => "===FILE: " + p + "===\n" + s).join("\n\n").slice(0, 90000);
      // Streams NDJSON, same as /api/game/build (phase/code/done/error).
      const enc = new TextEncoder();
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const emit = (o) => writer.write(enc.encode(JSON.stringify(o) + "\n")).catch(() => {});
      const streamGen = async (system, user, onDelta) => {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({ model: GB_MODEL, max_tokens: GB_MAX_OUT, stream: true, system, messages: [{ role: "user", content: user }] }),
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
      const buildGame = async (files, assets, models) => {
        const c = getContainer(env.GAME_BUILD_CONTAINER);
        const t0 = Date.now();
        const br = await c.fetch(new Request("http://build/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files, assets: assets || undefined, models: models || undefined, smoke: true }) }));
        const bd = await br.json().catch(() => ({ ok: false, error: "build service returned no JSON" }));
        return { bd, buildMs: Date.now() - t0 };
      };
      let codeBuf = "";
      const flushCode = (force) => { if (codeBuf && (force || codeBuf.length >= 120)) { emit({ ev: "code", t: codeBuf }); codeBuf = ""; } };
      const onDelta = (d) => { codeBuf += d; flushCode(false); };
      const run = async () => {
        try {
          let cost = 0;
          let files = { ...srcObj.files };
          // Phase 6: the game's sprite PNGs are re-bundled from the stash so a revise
          // rebuild keeps its art (assets aren't in the source, they're bundled files).
          const gameAssets = (srcObj.assets && typeof srcObj.assets === "object") ? srcObj.assets : {};
          emit({ ev: "phase", phase: "generating" });
          const g = await streamGen(engine === "3d" ? GAME_3D_RULES : GAME_REVISE_RULES, "CHANGE REQUEST: " + instruction + "\n\nCurrent game files:\n\n" + dumpFiles(files), onDelta);
          flushCode(true);
          cost += gbCredits(g.usedIn, g.usedOut);
          try { await useCredits(auth, gbCredits(g.usedIn, g.usedOut)); } catch {}
          const changed = parseGameFiles(g.text);
          if (!Object.keys(changed).length) { emit({ ev: "error", msg: "the edit came back empty — try rephrasing" }); return; }
          Object.assign(files, changed);
          // A revise that emits a stray @@SPRITE@@ token (revise doesn't generate new
          // art) → point it at an existing bundled sprite so it never 404s.
          for (const p of Object.keys(files)) if (/@@SPRITE:/.test(files[p])) files[p] = files[p].replace(/@@SPRITE:[\s\S]*?@@/g, () => (gameAssets["sprite-0.png"] ? "assets/sprite-0.png" : ""));
          let bd, buildMs, attempt = 0;
          for (;;) {
            emit({ ev: "phase", phase: attempt ? "fixing" : "compiling" });
            ({ bd, buildMs } = await buildGame(files, gameAssets, engine === "3d" ? [...new Set((JSON.stringify(files).match(/[a-z0-9_-]+\.glb/gi) || []).map((s) => s.toLowerCase()))] : null));
            const compileFail = !bd.ok;
            const runtimeFail = bd.ok && bd.smoke && !bd.smoke.passed;
            if (!compileFail && !runtimeFail) break;
            if (attempt >= 2) break;
            attempt++;
            emit({ ev: "phase", phase: "fixing" });
            const fixPrompt = engine === "3d"
              ? (game3DFixRules(compileFail ? { compile: true, list: [String(bd.error || "").slice(0, 3000)] } : bd.smoke.errors) + "\n\nCurrent files:\n\n" + dumpFiles(files))
              : (compileFail
                  ? ("The kaplay build FAILED to compile. Fix it and return the FULL corrected file blocks (only changed files). Output ONLY file blocks.\n\nBUILD ERROR:\n" + String(bd.error || "").slice(0, 3000) + "\n\nCurrent files:\n\n" + dumpFiles(files))
                  : (gameFixRules(bd.smoke.errors) + "\n\nCurrent files:\n\n" + dumpFiles(files)));
            let fg; try { fg = await streamGen(engine === "3d" ? GAME_3D_RULES : GAME_RULES, fixPrompt, onDelta); flushCode(true); } catch { break; }
            cost += gbCredits(fg.usedIn, fg.usedOut);
            try { await useCredits(auth, gbCredits(fg.usedIn, fg.usedOut)); } catch {}
            const fixed = parseGameFiles(fg.text);
            if (!Object.keys(fixed).length) break;
            Object.assign(files, fixed);
          }
          if (!bd.ok) { emit({ ev: "error", stage: "build", msg: String(bd.error || "build failed").slice(0, 600), fixed: attempt }); return; }
          emit({ ev: "phase", phase: "publishing" });
          await writeGameDistToR2(env, slug, bd.files);
          try { await env.SITES_BUCKET.put("gamesrc/" + slug + ".json", JSON.stringify({ files, assets: gameAssets, uid: gu.id, engine }), { httpMetadata: { contentType: "application/json" } }); } catch {}
          let balAfter; try { balAfter = await readCredits(auth); } catch { balAfter = bal0 - cost; }
          emit({ ev: "done", url: "/g/" + slug + "/", slug, buildMs, fixed: attempt, smoke: bd.smoke || null, cost, balance: balAfter });
        } catch (e) {
          emit({ ev: "error", msg: (e && e.status === 402) ? "not enough credits" : String(e && e.message || e).slice(0, 200), detail: (e && e.detail) || undefined });
        } finally {
          try { await writer.close(); } catch {}
        }
      };
      ctx.waitUntil(run());
      return new Response(readable, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
    }

    // GET /api/game/source?slug=… — the stashed kaplay source for the Code view
    // (owner-only). Returns { ok, files: { "<path>": "<src>" } }.
    if (url.pathname === "/api/game/source" && request.method === "GET") {
      const gu = await authUser(request);
      if (!gu) return UNAUTHED();
      if (!env.SITES_BUCKET) return Response.json({ ok: false, error: "not configured" }, { status: 501 });
      const slug = (url.searchParams.get("slug") || "").replace(/[^a-z0-9-]/gi, "").slice(0, 80);
      if (!slug) return Response.json({ ok: false, error: "no slug" }, { status: 400 });
      let srcObj = null;
      try { const o = await env.SITES_BUCKET.get("gamesrc/" + slug + ".json"); if (o) srcObj = JSON.parse(await o.text()); } catch {}
      if (!srcObj || !srcObj.files) return Response.json({ ok: false, error: "no source" }, { status: 404 });
      if (srcObj.uid && srcObj.uid !== gu.id) return Response.json({ ok: false, error: "not your game" }, { status: 403 });
      return Response.json({ ok: true, files: srcObj.files });
    }

    // DELETE /api/game/delete?slug=… — remove a published game (owner-only): wipes
    // the served dist under games/<slug>/ AND the stashed source gamesrc/<slug>.json.
    if (url.pathname === "/api/game/delete" && request.method === "DELETE") {
      const gu = await authUser(request);
      if (!gu) return UNAUTHED();
      if (!env.SITES_BUCKET) return Response.json({ ok: false, error: "not configured" }, { status: 501 });
      const slug = (url.searchParams.get("slug") || "").replace(/[^a-z0-9-]/gi, "").slice(0, 80);
      if (!slug) return Response.json({ ok: false, error: "no slug" }, { status: 400 });
      // Owner check via the stashed source (if it exists). Missing source → treat as
      // already-gone, still clear any orphaned dist so the call is idempotent.
      try { const o = await env.SITES_BUCKET.get("gamesrc/" + slug + ".json"); if (o) { const s = JSON.parse(await o.text()); if (s && s.uid && s.uid !== gu.id) return Response.json({ ok: false, error: "not your game" }, { status: 403 }); } } catch {}
      try { const old = await env.SITES_BUCKET.list({ prefix: "games/" + slug + "/" }); for (const ob of (old.objects || [])) await env.SITES_BUCKET.delete(ob.key); } catch {}
      try { await env.SITES_BUCKET.delete("gamesrc/" + slug + ".json"); } catch {}
      return Response.json({ ok: true, slug });
    }

    // Public data API for published sites. Unauthenticated by design — a visitor
    // filling in a booking form has no account — so it is allow-listed against
    // the site's own declared schema and refuses anything owner-scoped.
    {
      const dataRes = await handleSiteData(env, request, url, siteBackendBySlug);
      if (dataRes) return dataRes;
    }

    // Website builder — provision this site's database and apply its declared
    // schema. Called when a build starts, so the generated site has somewhere to
    // put data from the first request. Idempotent: re-running for the same slug
    // reuses the database and re-applies the schema (all DDL here is additive
    // or IF NOT EXISTS), which is what a revise needs.
    //
    // The caller's Neon project is created on first build, not at signup.
    // The builder's send path. `chat.js` already posts {brief} here and expects
    // {slug, url, backend, brand} back, so the contract is the frontend's, not
    // a new one. A brief becomes an isibi.schema.json, which becomes real
    // Postgres tables in a database provisioned for the caller.
    //
    // This builds the DATA layer only — the page it publishes describes the
    // model it created. Generating the site itself is the next piece.
    if ((url.pathname === "/api/site/react-build" || url.pathname === "/api/site/build" || url.pathname === "/api/site/react-revise") && request.method === "POST") {
      const bu = await authUser(request);
      if (!bu) return UNAUTHED();
      if (!siteDbConfigured(env)) return Response.json({ ok: false, error: "site database not configured", need: "NEON_API_KEY" }, { status: 501 });
      if (!env.SUPABASE_SERVICE_KEY) return Response.json({ ok: false, error: "service key not configured" }, { status: 501 });
      if (!env.ANTHROPIC_API_KEY) return Response.json({ ok: false, error: "generator not configured" }, { status: 501 });

      const body = await request.json().catch(() => ({}));
      // Revise sends {slug, instruction} for an existing site; build sends
      // {brief}. Re-applying a schema is safe (all its DDL is additive or
      // IF NOT EXISTS), so both take the same path.
      const brief = String(body.brief || body.prompt || body.instruction || "").trim().slice(0, 4000);

      // A brief means "design the schema"; an explicit schema skips the model.
      let designed = null;
      if (!body.schema) {
        if (!brief) return Response.json({ ok: false, error: "no brief" }, { status: 400 });
        // Charge before the call, refund if it does not produce a usable schema —
        // the same shape the orchestrator steps use. use_credits is atomic and
        // returns a negative balance when the caller cannot afford it.
        let balanceAfter;
        try {
          balanceAfter = await useCredits(request.headers.get("Authorization") || "", SITE_BUILD_FEE);
        } catch {
          return Response.json({ ok: false, msg: "Credits check failed — try again in a moment." }, { status: 503 });
        }
        if (!(balanceAfter >= 0)) return Response.json({ ok: false, error: "not enough credits", need: "credits", cost: SITE_BUILD_FEE }, { status: 402 });

        try {
          designed = await designSiteSchema(env, brief);
        } catch (e) {
          await creditBack(env, bu.id, SITE_BUILD_FEE);
          console.error("schema design failed:", e && (e.detail || e.message));
          return Response.json({ ok: false, msg: "The designer is busy — try again in a moment." }, { status: 503 });
        }
        if (!designed || !Array.isArray(designed.tables) || !designed.tables.length) {
          await creditBack(env, bu.id, SITE_BUILD_FEE);
          return Response.json({ ok: false, msg: "That brief didn't describe anything to store — try naming what the site keeps track of." }, { status: 422 });
        }
      }

      const slug = String(body.slug || (designed && designed.slug) || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60)
        || ("site-" + Math.random().toString(36).slice(2, 8));

      // A site's slug is claimed by whoever built it first; a second user cannot
      // publish over someone else's site by guessing the name.
      // Fails CLOSED. This was `catch {}`, so a Supabase timeout turned "I cannot
      // tell who owns this" into "nobody does" — and the build went on to apply
      // its schema, seed rows and publish pages over an existing owner's site.
      // (ensureSiteBackend now enforces this too; belt and braces, because the
      // consequence is a cross-account write.)
      try {
        const owner = await siteBackendRowFresh(env, slug);
        if (owner && owner.uid && owner.uid !== bu.id) {
          return Response.json({ ok: false, error: "that name is taken" }, { status: 409 });
        }
      } catch (e) {
        console.error("ownership check failed:", slug, e && (e.detail || e.message));
        return Response.json({ ok: false, msg: "Couldn't check that name just now — try again in a moment." }, { status: 503 });
      }

      const spec = normalizeSchema(body.schema || designed || {});
      if (!spec.tables.length) return Response.json({ ok: false, error: "schema declares no tables" }, { status: 400 });

      let db;
      try {
        db = await ensureSiteBackend(env, slug, bu.id);
      } catch (e) {
        if (e && e.conflict) return Response.json({ ok: false, error: "that name is taken" }, { status: 409 });
        console.error("site provision failed:", slug, e && (e.detail || e.message));
        return Response.json({ ok: false, error: "could not provision the database", detail: String(e && (e.detail || e.message)).slice(0, 300) }, { status: 502 });
      }

      let made;
      try {
        made = await applySiteSchema(db, spec);
      } catch (e) {
        console.error("schema apply failed:", slug, e && (e.detail || e.message));
        return Response.json({ ok: false, error: "could not apply the schema", detail: String(e && (e.detail || e.message)).slice(0, 300) }, { status: 502 });
      }

      // Starter content for the display tables. Best-effort and non-fatal: a site
      // with a live database and an empty menu is still a site, but one WITH the
      // menu is the difference between a demo and something usable — nothing can
      // write to a display table after this point, not even the owner.
      let seeded = null;
      try {
        seeded = await seedSiteRows(db, spec, (designed && designed.seed) || body.seed);
        if (seeded && Object.keys(seeded.seeded).length) console.log("seeded:", slug, JSON.stringify(seeded.seeded));
        if (seeded && seeded.skipped.length) console.log("seed skipped:", slug, JSON.stringify(seeded.skipped.slice(0, 6)));
      } catch (e) { console.error("seeding failed:", slug, e && (e.detail || e.message)); }

      // Write the site's pages against the schema that was just created, compile
      // them, and publish the dist. The database is already live at this point, so
      // this stage cannot fail the build — it either publishes the real app or
      // falls through to the placeholder below.
      const brand = String((designed && designed.brand) || body.brand || slug).slice(0, 60);

      // Pages are generated against every table the site HAS, not just the ones
      // this request designed.
      //
      // A revise sends {slug, instruction}, and the instruction alone is what
      // the schema designer sees — so `spec` holds only the tables that
      // instruction mentioned. "Add a gallery" produced a spec of exactly one
      // table, and the generator then rewrote the whole site knowing only that:
      // a working barber shop came back as a page listing a gallery and nothing
      // else. applySiteSchema already MERGES into _meta (a revise cannot drop a
      // table), so the merged spec is the real picture — read it back and use it.
      let pageSpec = spec;
      try {
        const merged = await loadSiteSchema(db);
        if (merged && Array.isArray(merged.tables) && merged.tables.length >= spec.tables.length) pageSpec = merged;
      } catch (e) { console.error("merged schema read failed:", slug, e && e.message); }

      let pages = { page: "placeholder", files: [], notes: "", problems: [], cost: 0, buildMs: 0 };
      if (brief && env.SITE_BUILD_CONTAINER && env.SITES_BUCKET) {
        try {
          pages = await buildAndPublishPages(env, { brief, spec: pageSpec, slug, brand, auth: request.headers.get("Authorization") || "" });
        } catch (e) {
          console.error("page generation failed:", slug, (e && (e.detail || e.message)));
          pages.notes = "Your database is live, but writing the pages didn't work this time — send it again to retry.";
        }
      }

      // Publish something real at /s/<slug>/ so the preview is never a 404: if the
      // pages didn't land, the placeholder still reports the model that did.
      //
      // Only when nothing is published there yet, though. This route is also the
      // revise path, and a revise whose pages fail to compile must leave the site
      // that IS working alone — replacing it with the placeholder would take down
      // a live site to report a failure the response already reports.
      if (pages.page !== "app" && env.SITES_BUCKET) {
        try {
          const live = await env.SITES_BUCKET.head("sites/" + slug + "/index.html");
          if (!live) {
            await env.SITES_BUCKET.put("sites/" + slug + "/index.html", schemaPlaceholderPage(brand, spec), {
              httpMetadata: { contentType: "text/html; charset=utf-8" },
            });
          }
        } catch (e) { console.error("placeholder publish failed:", slug, e && e.message); }
      }

      // `schema` reports the access level chosen per table. It is what makes a
      // build verifiable from outside: a menu must come back `display` and an
      // enquiry form `collect`, and getting that wrong silently is exactly the
      // bug that shipped on 2026-07-27. `page` says which of the two things is
      // actually being served, so a fallback is never mistaken for a built site.
      const levels = (pageSpec.tables || spec.tables || []).map((t) => ({ name: t.name, access: t.access }));
      return Response.json({
        ok: true, slug, url: "/s/" + slug + "/", backend: true, brand, tables: made, schema: levels,
        // Rows per display table. An empty object means the site published with
        // empty lists — which reads as a working build and is not one.
        seeded: (seeded && seeded.seeded) || {},
        page: pages.page, files: pages.files, notes: pages.notes || undefined,
        problems: pages.problems.length ? pages.problems : undefined,
        cost: (designed ? SITE_BUILD_FEE : 0) + pages.cost, buildMs: pages.buildMs || undefined,
      });
    }

    // DELETE /api/site/<slug> — take a published site down: its files, its
    // database, and its registration.
    //
    // Without this a site could only ever be REPLACED, never removed. The
    // published dist lives in R2 and nothing deleted it, so a slug whose backend
    // row had gone kept serving a React shell whose every data call 404s — a
    // public, half-broken site at a guessable URL. The build smoke test hit that
    // on every run, which is how the gap surfaced.
    if (url.pathname.startsWith("/api/site/") && request.method === "DELETE") {
      const du = await authUser(request);
      if (!du) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY) return Response.json({ ok: false, error: "service key not configured" }, { status: 501 });
      const dslug = url.pathname.slice("/api/site/".length).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
      if (!dslug) return Response.json({ ok: false, error: "no slug" }, { status: 400 });

      // The backend row IS the ownership record. No row means there is nothing to
      // authorise against, so the caller is told it does not exist rather than
      // being allowed to delete files by guessing slugs.
      let srow;
      try {
        const g = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(dslug)}&select=uid`, { headers: svcHeaders(env) });
        const rows = await g.json().catch(() => []);
        srow = (Array.isArray(rows) && rows[0]) || null;
      } catch {
        return Response.json({ ok: false, error: "couldn't look that site up — try again in a moment" }, { status: 503 });
      }
      if (!srow) return Response.json({ ok: false, error: "no such site" }, { status: 404 });
      if (srow.uid !== du.id) return Response.json({ ok: false, error: "not your site" }, { status: 403 });

      // Forget the cached connection BEFORE anything is torn down. A warm isolate
      // holding a string that points at a dropped database is worse than a slow
      // lookup: it answers reads with a connection error instead of a 404.
      _connCache.delete(dslug);
      // And the edge route. KV propagates for up to a minute, so this has to go
      // BEFORE the database is dropped — a route outliving its database answers
      // reads with a connection error instead of an honest 404.
      await dropRoute(routeDeps(env), dslug);

      // Drop the site's database first — it is the only step that still needs the
      // row being deleted below. Best-effort: a database left behind costs money,
      // but failing the whole call over it would leave the published files up,
      // which is the thing the caller actually asked to take down.
      try {
        const proj = await userSiteProject(env, du.id);
        if (proj && proj.neon_project) await dropSiteDatabase(env, proj.neon_project, proj.neon_branch, dslug);
      } catch (e) { console.error("site db drop failed:", dslug, e && (e.detail || e.message)); }

      let removed = 0;
      try {
        if (env.SITES_BUCKET) removed = await deleteSitePrefix(env, dslug);
      } catch (e) {
        console.error("site files delete failed:", dslug, e && e.message);
        return Response.json({ ok: false, error: "couldn't remove the published files" }, { status: 502 });
      }

      // Registration goes last. While it exists the site is still findable and
      // still owned, so a failure above leaves something to retry against rather
      // than the orphan this route exists to prevent.
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(dslug)}`, { method: "DELETE", headers: svcHeaders(env) });
      } catch (e) { console.error("site row delete failed:", dslug, e && e.message); }

      return Response.json({ ok: true, slug: dslug, removed });
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
      // The Worker fetches this url with the platform's FAL_KEY attached, so it
      // must be fal's queue and nothing else. Pattern + verdicts live in
      // billing.mjs — see test/billing.test.mjs.
      const statusUrl = typeof body.statusUrl === "string" ? body.statusUrl : "";
      const requestId = falRequestId(statusUrl);
      if (!requestId) return Response.json({ error: "invalid url" }, { status: 400 });
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
      const verdict = refundVerdict(status);
      if (verdict === "no") return Response.json({ refunded: 0 });
      if (verdict === "inspect") {
        // COMPLETED can still carry a client-error RESULT (e.g. a 422 on input
        // validation); fal doesn't bill those, but the status alone misses them.
        try {
          const resultUrl = statusUrl.replace(/\/status\b.*$/, "");
          const rr = await fetch(resultUrl, { headers: { Authorization: `Key ${env.FAL_KEY}` }, signal: AbortSignal.timeout(10000) });
          if (!refundOnResultStatus(rr.status)) return Response.json({ refunded: 0 });
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
