// Photon (WASM) for server-side image watermarking — the workerd build
// instantiates the wasm synchronously on import, so the functions are ready to
// call. Bundled by wrangler at deploy (see package.json).
import { PhotonImage, watermark, resize, SamplingFilter } from "@cf-wasm/photon";
import { sendConfirmation, recipient, pickProvider } from "./site-mail.mjs";
import { sendSms } from "./site-sms.mjs";
import { dueJobs, runJob, jobOutcome } from "./site-jobs.mjs";
import { hostIsBlocked, blockedReason } from "./site-ssrf.mjs";
import { deliverWebhook, firesFor, signPayload, MAX_PER_MINUTE as WEBHOOK_PER_MIN } from "./site-webhooks.mjs";
import { takeToken, verify as turnstileVerify, TOKEN_FIELD as TURNSTILE_FIELD } from "./site-turnstile.mjs";
import { handleInbound, MAX_BODY as INBOUND_MAX_BODY, MAX_PER_MINUTE as INBOUND_PER_MIN } from "./site-inbound.mjs";
// `OWN_ZONES` is imported because `cfZoneId` reads it — it was not, and that is
// a ReferenceError on the FIRST line of that function, outside every try, so
// every Cloudflare custom-hostname call the platform made threw before it could
// reach the API. Invisible until the line ran, which is the whole class of bug
// `test/worker-imports.test.mjs` now covers.
import { OWN_ZONES, APP_ZONE, SITE_ZONE, normalizeHostname, isOwnHostname, isAppHostname, servedAtRoot, isPublishedSiteRequest, siteHostSlug, siteHostFor, siteUrlFor, siteOrigin, claimRefusal, dnsInstructions, readStatus } from "./site-domains.mjs";
import { checkDns, dnsSentence } from "./site-dns.mjs";
import { detectProvider, providerSentence } from "./site-registrar.mjs";
import { offerFor as dcOfferFor, applyUrl as dcApplyUrl, signQuery as dcSign, rsaSigner as dcSigner } from "./site-domain-connect.mjs";
import { callApi, apiFor, secretsNeeded, takeParams, MAX_PER_MINUTE as SITE_API_PER_MIN, MAX_TTL as SITE_API_MAX_TTL } from "./site-apis.mjs";
import { Container, getContainer } from "@cloudflare/containers";
import { makeCache, memoize } from "./ttl-cache.mjs";
import { makeLimiter, bucketKey, tooMany, WINDOW_MS } from "./rate-limit.mjs";
import { ensureSiteBackend as ensureSiteBackendPure } from "./site-provision.mjs";
import { lookupRoute, saveRoute, dropRoute } from "./site-routing.mjs";
import { handleOwnerData, handleOwnerTables, handleOwnerWrite, handleOwnerMembers, handleOwnerAnalytics, assertOwner } from "./site-owner.mjs";
import { handleUpload, handleUploadList, handleUploadDelete, handleVisitorUpload, MAX_UPLOAD_BYTES, MAX_VISITOR_UPLOAD_BYTES, sniffImage, uploadName, uploadKey, uploadUrl, uploadFileName } from "./site-uploads.mjs";
import { handleOwnerExport } from "./site-export.mjs";
import { notifyOwner, COOLDOWN_MS } from "./site-notify.mjs";
import { makeTrace } from "./builder/trace.mjs";
import { injectMeta, pageMeta, setTitle } from "./site-meta.mjs";
import { listSecrets, addSecret, deleteSecret, readSecret } from "./site-secrets.mjs";
import { normalizePayment, parseCart, priceCart, checkoutSessionArgs, formEncode, paidFromEvent } from "./site-payments.mjs";
import { rescopeCookie } from "./site-cookie.mjs";
import { drainTeardown } from "./site-teardown.mjs";
import { scrubSecrets, neonConfigured, sqlQuery, sqlExec, createUserProject, createSiteProject, enableNeonAuth, enableDataApi, createSiteDatabase, dropSiteDatabase, dropUserProject, connForDatabase, dbNameForSite } from "./site-db.mjs";
import { applySiteSchema, loadSiteSchema, parseSchemaSpec, normalizeSchema, sqlIdent, seedSiteRows, droppedFields } from "./site-schema.mjs";
// The page generator's rules, tool schema and deterministic checks. Plain module
// so it can be tested outside the Worker — see test/page-gen.test.mjs.
import { PAGE_RULES, SITE_PAGES_TOOL, pagesPrompt, briefForPages, briefWithLayout, pagesRequest, validatePages, lintPages, SITE_PAGES_MAX_TOKENS } from "./builder/page-gen.mjs";
// ALIASED, because worker.js already has an `IMAGE_USD` — the per-model price
// map for the image GENERATOR the customer drives directly. Imported under its
// own name the two collide, and the collision is invisible to `node --check` and
// to all 1,632 tests (nothing can import a Worker entrypoint); esbuild refuses
// it at deploy time and the deploy is the first thing that ever sees it.
import { publishPages, pageCredits, schemaSettlement, buildFloor, wasKilled, MIN_CREDITS, IMAGE_USD as SITE_PHOTO_USD } from "./builder/publish-pages.mjs";
import { imageBudget, budgetFor, imagesAffordable, planImages, applyImages, countImageSlots, imagePrompt, imageNote, IMAGE_ASPECT } from "./builder/site-images.mjs";
import { renderNote } from "./builder/site-render.mjs";
import { ASKABLE as SITE_TOKEN_NAMES, valueHint as siteTokenHint, mergeTokens, parseTokens, withContrast, tokenNote } from "./builder/site-tokens.mjs";
import { ASKABLE as SITE_STYLE_AXES, optionsFor as siteStyleOptions, axisHint as siteStyleHint, mergeStyle, parseStyle, styleNote, saidFor as styleSaid } from "./builder/site-style.mjs";
import { extractText, applyEdits } from "./builder/site-text.mjs";
import { runTextEdit, runDataEdit, renamePages, MAX_DATA_ROWS } from "./builder/site-apply.mjs";
import { runRulesEdit } from "./builder/site-rules.mjs";
import { runPictureEdit } from "./builder/site-picture.mjs";
import { runLogoEdit } from "./builder/site-logo.mjs";
import { topUpSeed, mergeSeed } from "./builder/site-seed.mjs";
import { resolveAccess, ACCESS_PRESETS, unguardedBookings } from "./site-access.mjs";
// The pair a `display` table resolves to. Named once, from the presets, so the
// data layer's gate cannot drift from the vocabulary again — it was compared
// against "anyone", which is a WRITE level, and matched nothing on any site.
const DISPLAY_PAIR = ACCESS_PRESETS.display;
import { mergeAddonPages, mergeAddonSchema, unlinkedPages, routeOf } from "./builder/site-addon.mjs";
import { archiveVersion, listVersions, rollbackVersion, deleteAllVersions, versionId, versionLabel } from "./site-versions.mjs";
import { takeOffline, putBackOnline } from "./site-live.mjs";
import { readLinkedPages, normalizeQueries, shouldSearch, contextBrief, contextSummary, contextSentence, attachments, MAX_QUERIES } from "./builder/site-context.mjs";
import { routeMessage, clarifiedBrief } from "./builder/site-ask.mjs";
import { modelsFor } from "./builder/build-models.mjs";
import { verifyStripeSignature, mintFromEvent } from "./stripe-webhook.mjs";
import { selectPurchase, checkoutForm, LIVE_SUBSCRIPTION_STATUSES, falRequestId, refundVerdict, refundOnResultStatus } from "./billing.mjs";
import { toCents, depreciationSchedule, amortizationSchedule, investmentAnalysis, eoqCalc, breakevenCalc, demandForecast, installmentPlan, taxCalc, commissionCalc } from "./worker-finance.mjs";
// Game builder (Phase 3): same generate→build→publish pipeline, engine swapped for
// kaplay + a runtime smoke test. See builder-game/. Parser format is identical.
import { parseGeneratedFiles as parseGameFiles, GAME_RULES, GAME_ASSET_RULES, GAME_REVISE_RULES, gameFixRules, parseSpriteTokens, GAME_3D_RULES, game3DFixRules } from "./builder-game/game-gen.mjs";
import { SHORTLIST, resolvePair } from "./builder/site-fonts.mjs";
import { THEME_SHORTLIST, themeFontPair } from "./builder/site-theme-registry.mjs";
import { currentStateNote, EDIT_RULE, EDIT_REQUIRED, mergeLook, movedFields } from "./builder/site-edit.mjs";
import { READY_FAMILIES, STRUCTURE_NAMES, familiesForPrompt, structuresForPrompt } from "./builder/site-layouts.mjs";

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

/**
 * Take up to `cost` credits, and report what was ACTUALLY taken.
 *
 * `use_credits` is a gate, not a till. Its WHERE clause is `balance >= cost`,
 * so a bill larger than the balance debits **zero** and returns -1 — it never
 * overdrafts and it never throws for insufficiency. Every call site that GATES
 * on it reads that -1 and refuses; every call site that SETTLES after the work
 * was already done used to discard it, which meant the platform silently
 * collected NOTHING whenever the bill outgrew the balance, and then reported
 * `charged: true` to the customer.
 *
 * It was the commonest path there is: a new account is granted 20 credits, the
 * deposit and the schema settlement leave ~11, and a warm pages call prices at
 * ~21 — so a first build published a real site, said "this attempt used
 * credits", and moved the ledger by nothing.
 *
 * So: ask for the bill; if the ledger refuses, read the balance and take what
 * is there. Two round trips ONLY on the short path — a caller who can pay in
 * full still costs exactly one call.
 *
 * The read-then-take race is deliberate and falls the safe way: if another
 * request spends in the gap, the second `use_credits` refuses again and this
 * returns 0. Under-collecting on a race is a rounding error; double-collecting
 * would be somebody's money.
 */
async function collectCredits(authHeader, cost) {
  const want = Math.max(0, Number(cost) || 0);
  if (!(want > 0)) return 0;
  if ((await useCredits(authHeader, want)) >= 0) return want;
  // Short. Take the balance down to zero rather than taking nothing at all.
  // Floored to the ledger's own precision (numeric(16,6)) — asking for more
  // decimal places than the column holds is another way to be told -1.
  const bal = Math.max(0, Number(await readCredits(authHeader)) || 0);
  const take = Math.floor(Math.min(want, bal) * 1e6) / 1e6;
  if (!(take > 0)) return 0;
  return (await useCredits(authHeader, take)) >= 0 ? take : 0;
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

/**
 * Give back `amount` credits, in chunks the RPC will accept.
 *
 * `credit_back` hard-caps a single call at 10 credits — a deliberate blast
 * radius on a service-role mint — and every caller passed the amount straight
 * through under a `Math.min(10, …)`, which silently KEPT anything above it. A
 * cold Opus schema call settles to 15, so the one path the rule says refunds in
 * full ("no tables at all: they are left with literally nothing") returned 10
 * and kept 5. The clamp read like dead headroom and was not.
 *
 * Bounded at five calls (50 credits), far above anything this path can produce,
 * so a bad amount cannot turn into a loop against the ledger.
 */
async function refundCredits(env, userId, amount) {
  let left = Math.max(0, Number(amount) || 0);
  for (let i = 0; i < 5 && left > 0; i++) {
    const chunk = Math.min(10, left);
    await creditBack(env, userId, chunk);
    left -= chunk;
  }
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
// Owner (Go Farther user) id for a built app, from the D1 backend ledger, then the source.
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
  // FRAMING TAKES TWO POLICIES AND THIS IS THE OTHER ONE. `frame-ancestors` on
  // the SITE says who may frame it; `frame-src` here, on the WORKSPACE, says
  // what the workspace may frame — and a preview needs both to agree. Fixing
  // only the site's half left the pane showing Chrome's "This content is
  // blocked. Contact the site owner to fix the issue.", which is the parent
  // page's refusal and reads exactly like the child's.
  //
  // It was `'self' blob:` and correct for as long as a preview was same-origin
  // (`gofarther.dev/s/<slug>/`) or a Blob URL. A site is on `<slug>.gofarther.app`
  // now, which is neither. Derived from SITE_ZONE rather than spelled out, so the
  // two cannot drift; the wildcard is one label deep, matching the one label
  // Universal SSL covers and the one `siteHostSlug` will resolve.
  "frame-src 'self' blob: https://*." + SITE_ZONE,
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

/**
 * The one part of a model API's error body that is safe to hand back.
 *
 * `detail` is deliberately never returned: a 400 can quote the request, and the
 * request contains the site's brief. But the provider's error *type* is a fixed
 * token from a small set that contains nothing of ours, and it is the difference
 * between "they are overloaded" and "the account that pays for this has no
 * balance" — which are the same "the designer is busy" to a caller today.
 *
 * Measured 2026-07-29: both CI suites went red at the same minute on `upstream:
 * 400` and it took a dig through a job log to learn why, because the reason was
 * logged in Cloudflare and thrown away in the response. The numeric status was
 * added for exactly that lesson and did not go far enough.
 *
 * `billing` is the one message that is checked rather than passed through. It
 * is a fixed provider string about OUR account, not about the request, and it
 * is the failure an operator can actually act on.
 */
function upstreamKind(detail) {
  let body = null;
  try { body = JSON.parse(String(detail || "")); } catch { return { type: null, billing: false }; }
  const err = body && body.error;
  const t = err && err.type;
  const msg = String((err && err.message) || "");
  return {
    // Shape-checked, not trusted: an unrecognised token is dropped rather than
    // echoed, so this can never become a channel for arbitrary upstream text.
    type: /^[a-z_]{1,40}$/.test(String(t)) ? String(t) : null,
    billing: /credit balance is too low|insufficient (?:credit|quota)|billing/i.test(msg),
  };
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
  let pathname = "", hostname = "";
  try { const u = new URL(request.url); pathname = u.pathname; hostname = u.hostname; } catch {}
  const sameOriginFrame = pathname.startsWith("/mkt/demo");
  // A published Website-Builder site (gofarther.dev/s/<slug>) is a real end-user
  // website — it needs its OWN inline <style>/<script>, Google Fonts, and the
  // Supabase-hosted images, so it gets a permissive website CSP, not the strict
  // app policy. Still same-origin-only for scripts/connect (no external code).
  // /preview/ = the builder's live draft preview: it renders the SAME generated
  // page in the workspace iframe, so it needs the identical website CSP (a
  // blob/srcdoc preview would inherit the strict app CSP and blank the page).
  //
  // DECIDED ON THE MOUNT, NOT THE RAW PATH — and reading only the path is what
  // broke every published site the day the site zone went live. `harden` is
  // handed the ORIGINAL request, while both hostname rewrites replace the
  // pathname with `/s/<slug>/…` INSIDE `handleRequest`. So a visit to
  // `<slug>.gofarther.app/` arrives here looking like `/`, misses this test, and
  // is served the platform's lockdown policy: `frame-ancestors 'none'`,
  // `X-Frame-Options: DENY`, and a `frame-src` with no map hosts in it. Measured
  // live on two real sites. It went from latent to total when `/s/<slug>/`
  // started redirecting away, because that was the one address with the right
  // headers and nobody lands on it any more.
  //
  // Asked the same way the router asks it, through the same helpers rather than
  // a second copy of the rule: a site-zone label, or a hostname that is not ours
  // at all (a custom domain). `servedAtRoot` keeps `/api/` and `/u/` on the app
  // policy exactly as the router leaves them unrewritten.
  const publishedSite = isPublishedSiteRequest(hostname, pathname);
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
      // Maps AND video. `VideoEmbed` is in the generator's component list and has
      // a documented signature, so the model is actively told to use it — and it
      // emits an iframe at youtube-nocookie / player.vimeo, neither of which was
      // on this list. It typechecked, bundled, published and rendered NOTHING:
      // this repo's signature failure shape, sitting live. Both are the
      // privacy-preserving hosts the component deliberately chose (no cookie on
      // a visitor who never pressed play), which is why they are safe to name.
      "frame-src 'self' https://www.openstreetmap.org https://www.google.com https://maps.google.com https://www.youtube-nocookie.com https://player.vimeo.com",
      "base-uri 'self'",
      // THE BUILDER'S PREVIEW IS NOW CROSS-ORIGIN, which `'self'` alone cannot
      // express. It was written when a site was served from `gofarther.dev/s/…`,
      // same-origin with the workspace framing it; a site lives on its own
      // registrable domain now, so `'self'` means only the site may frame the
      // site and the preview pane renders Chrome's "This content is blocked".
      // The platform is named explicitly rather than opened up — a customer's
      // site stays unframable by anybody else, which is the clickjacking answer.
      "frame-ancestors 'self' https://" + APP_ZONE + " https://www." + APP_ZONE,
    ].join("; "));
    // AND NO `X-Frame-Options` AT ALL, deliberately. It has no syntax for "self
    // plus one other origin" — `ALLOW-FROM` is dead in every current browser —
    // so any value here either blocks the preview or is ignored. `frame-ancestors`
    // is the expressive control and supersedes it per spec; DELETED rather than
    // left unset, because an upstream response carrying one would survive.
    h.delete("X-Frame-Options");
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
// JSON buffer, so the ask step can stream Go Farther's reply as Sonnet writes it.
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
// `hostIsBlocked` lives in `site-ssrf.mjs` now: the outbound webhook asks the
// same question, and a second copy drifts in the direction of one caller
// quietly permitting a host the other refuses.
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
// The "✦ gofarther.dev" badge PNG lives in public/; fetched once per isolate via the
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
    "You are the Media Agent for Zephyr (gofarther.dev) — a helpful assistant that manages the user's Instagram and YouTube accounts.",
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
    ctx.waitUntil(runScheduledSiteJobs(env, ctx));
    // Drain the Neon teardown queue. This side is the ONLY one that can: the
    // rows are written by a Postgres trigger as a project's record disappears,
    // and Postgres cannot call the Neon API.
    ctx.waitUntil(runNeonTeardown(env));
    // Finish custom-domain setup without the owner watching it. Same 2-minute
    // tick; the only side that can, since Cloudflare's certificate status is an
    // API call and nothing else in the system polls it.
    ctx.waitUntil(runDomainWatch(env));
  },
};

/**
 * FINISH CUSTOM-DOMAIN SETUP BY ITSELF.
 *
 * Without this the panel is honest and passive: it shows the truth whenever the
 * owner opens it, and does nothing whenever they do not. So the last step of
 * putting a business on its own domain is "keep coming back and refreshing" —
 * for something that completes on its own schedule, minutes to an hour later,
 * at a moment nobody can predict. Most people check twice and give up.
 *
 * So the cron watches instead, flips the row when Cloudflare says both halves
 * are done, and MAILS THE OWNER ONCE. The email is the actual feature: it is
 * what lets somebody add a domain, close the tab, and find out.
 *
 * OURS TO SEND, not bring-your-own. This goes to the Go Farther account holder
 * about their own account — the same class as the login code and the booking
 * notification, and nothing to do with a site mailing its visitors.
 *
 * SENT EXACTLY ONCE BY CONSTRUCTION, with no "notified" column to get out of
 * step: the mail is tied to the pending → live TRANSITION, and a row can only
 * make that transition once because the update that sends it is also the update
 * that stops it being pending.
 */
async function runDomainWatch(env) {
  if (!env.SUPABASE_SERVICE_KEY || !env.CLOUDFLARE_API_TOKEN) return;
  const rest = (path, init) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init, headers: svcHeaders(env, { "content-type": "application/json", ...((init || {}).headers || {}) }),
    signal: AbortSignal.timeout(12000),
  });
  let rows = [];
  try {
    // Only what is still in flight, oldest first, and BOUNDED — one stuck
    // domain must not starve the rest, and this shares a 2-minute tick with
    // three other jobs.
    const r = await rest("site_domains?status=eq.pending&cf_id=not.is.null&select=hostname,slug,uid,cf_id&order=created_at&limit=20");
    if (!r.ok) return;
    rows = await r.json().catch(() => []);
  } catch { return; }
  if (!Array.isArray(rows) || !rows.length) return;

  for (const row of rows) {
    const cf = await cfHostname(env, "GET", "/" + encodeURIComponent(row.cf_id));
    // A LOOKUP THAT FAILED IS NOT A DOMAIN THAT FAILED. Left pending, it is
    // tried again in two minutes; written as failed, the owner is told their
    // correct setup is broken because an API call timed out.
    if (!cf.ok) continue;
    const st = readStatus(cf.result);
    if (!st.live && !st.failed) {
      // Still in progress. `checked_at` alone, so the panel can show when we
      // last looked without the row pretending anything changed.
      await rest(`site_domains?hostname=eq.${encodeURIComponent(row.hostname)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ checked_at: new Date().toISOString() }),
      }).catch(() => {});
      continue;
    }
    const status = st.live ? "live" : "failed";
    // CONDITIONAL ON STILL BEING PENDING. Two isolates can run this tick, and
    // without `status=eq.pending` in the filter both would see the transition
    // and both would send the mail. This is the same claim-by-update the
    // booking-notification cooldown uses.
    const upd = await rest(`site_domains?hostname=eq.${encodeURIComponent(row.hostname)}&status=eq.pending`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status, checked_at: new Date().toISOString(), last_error: st.failed ? "Setup didn't complete — check the records and try removing and re-adding the domain." : null }),
    }).catch(() => null);
    const claimed = upd && upd.ok ? await upd.json().catch(() => []) : [];
    // Nobody claimed it means another isolate did. Nothing more to do here.
    if (!Array.isArray(claimed) || !claimed.length) continue;
    // The routing cache in THIS isolate now says the old thing; other PoPs heal
    // by expiry. Cheap and worth doing — this isolate just learned it is stale.
    hostRoutes.delete(row.hostname);
    if (status === "live") await mailDomainLive(env, row).catch(() => {});
  }
}

/** Tell the owner their domain is live. Best-effort — the domain works either way. */
async function mailDomainLive(env, row) {
  if (!env.EMAIL) return;
  let to = "";
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(row.uid)}`, { headers: svcHeaders(env), signal: AbortSignal.timeout(10000) });
    const u = await r.json().catch(() => null);
    to = (u && u.email) || "";
  } catch { return; }
  if (!to) return;
  // RE-NORMALISED, not escaped. `normalizeHostname` is the only way a value
  // reaches this table and it admits nothing but `[a-z0-9.-]`, so there is
  // no HTML-special character to escape — but running it again here means this
  // is true because it is CHECKED at the point of use, not because of what some
  // other file did earlier. A value that fails is not mailed about at all.
  const host = normalizeHostname(row.hostname);
  if (!host) return;
  await sendMail(env, {
    to,
    subject: host + " is live",
    html: '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#111">' +
      "<p>Your site is now live at <a href=\"https://" + host + "\" style=\"color:#111\"><b>" + host + "</b></a>.</p>" +
      "<p>The certificate is issued and renews automatically — there is nothing else to do.</p>" +
      "</div>",
  }).catch(() => {});
}

/**
 * Drain the Neon teardown queue — the cron half.
 *
 * The decisions (what counts as done, what must never count as done, how hard to
 * keep trying) live in site-teardown.mjs where they are tested against fakes.
 * This is the wiring only.
 */
async function runNeonTeardown(env) {
  if (!env.NEON_API_KEY || !env.SUPABASE_SERVICE_KEY) return;
  const rest = (path, init) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init, headers: svcHeaders(env, { "content-type": "application/json", ...((init || {}).headers || {}) }),
    signal: AbortSignal.timeout(12000),
  });
  try {
    const out = await drainTeardown({
      due: async (limit) => {
        const g = await rest(`neon_teardown?next_try_at=lte.${encodeURIComponent(new Date().toISOString())}` +
          `&select=id,project_id,attempts&order=next_try_at.asc&limit=${Number(limit) || 5}`);
        if (!g.ok) throw new Error("neon_teardown read " + g.status);
        return await g.json();
      },
      // The status is what the verdict turns on, so it is passed through rather
      // than collapsed into ok/not-ok — 404 and 403 mean opposite things here.
      drop: async (projectId) => {
        const r = await fetch(`https://console.neon.tech/api/v2/projects/${encodeURIComponent(projectId)}`, {
          method: "DELETE",
          headers: { Authorization: "Bearer " + env.NEON_API_KEY, accept: "application/json" },
          signal: AbortSignal.timeout(20000),
        });
        return { ok: r.ok, status: r.status };
      },
      forget: async (id) => {
        const d = await rest(`neon_teardown?id=eq.${Number(id)}`, { method: "DELETE" });
        if (!d.ok) throw new Error("neon_teardown delete " + d.status);
      },
      defer: async (id, attempts, sec, why) => {
        const d = await rest(`neon_teardown?id=eq.${Number(id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            attempts,
            last_error: String(why || "").slice(0, 300),
            next_try_at: new Date(Date.now() + Number(sec) * 1000).toISOString(),
          }),
        });
        if (!d.ok) throw new Error("neon_teardown defer " + d.status);
      },
    });
    // Only worth a line when something happened. A tick over an empty queue runs
    // every two minutes and would otherwise bury everything else in the log.
    if (out.attempted || out.errors.length) console.log("neon teardown:", JSON.stringify(out));
  } catch (e) { console.error("neon teardown failed:", (e && e.message) || e); }
}

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
      const material = new TextEncoder().encode((env.FAL_KEY || "Go Farther") + "|media-proxy-v1");
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
// Go Farther's own auth.users (the builder). Same-origin (gofarther.dev/s/… → gofarther.dev/api),
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
      const material = new TextEncoder().encode((env.SUPABASE_SERVICE_KEY || env.FAL_KEY || "Go Farther") + "|site-secrets-v1");
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
/**
 * Send one text through whichever provider the owner configured.
 *
 * Three shapes, kept as data rather than three code paths, because they differ
 * only in where the credential and the fields go. Twilio is form-encoded and
 * basic-auth'd; MessageBird and Vonage are JSON.
 *
 * NEVER THROWS — `sendSms` treats a falsy `ok` as a refusal and the booking has
 * already succeeded either way.
 */
async function postProviderSms(provider, key, secret, from, to, body) {
  let url, headers, payload, form = false;
  if (provider === "twilio") {
    url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(key)}/Messages.json`;
    headers = { Authorization: "Basic " + btoa(key + ":" + secret), "Content-Type": "application/x-www-form-urlencoded" };
    payload = new URLSearchParams({ From: from, To: to, Body: body }).toString();
    form = true;
  } else if (provider === "vonage") {
    url = "https://rest.nexmo.com/sms/json";
    headers = { "Content-Type": "application/json" };
    // Vonage carries its credential IN THE BODY rather than a header — the one
    // real irregularity here, and the reason this is a switch and not a table.
    payload = { api_key: key, api_secret: secret, from, to: to.replace(/^\+/, ""), text: body };
  } else {
    url = "https://rest.messagebird.com/messages";
    headers = { Authorization: "AccessKey " + key, "Content-Type": "application/json" };
    payload = { originator: from, recipients: [to], body };
  }
  try {
    const resp = await fetch(url, {
      method: "POST", headers,
      body: form ? payload : JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });
    const text = await readCapped(resp, 4096);
    // VONAGE ANSWERS 200 ON FAILURE. Its `messages[].status` is "0" for
    // success and a numeric error code otherwise, so trusting the HTTP status
    // here would report every rejected message as sent — and the owner would
    // be told their customer was texted when nobody was.
    if (provider === "vonage") {
      let j = null; try { j = JSON.parse(text); } catch { /* not json */ }
      const first = j && Array.isArray(j.messages) && j.messages[0];
      return { ok: !!(first && String(first.status) === "0"), status: resp.status };
    }
    return { ok: resp.status >= 200 && resp.status < 300, status: resp.status };
  } catch { return { ok: false, status: 0 }; }
}
// Register a site's scheduled jobs. Reuses the `site_functions` table, whose
// shape (slug, name, spec, schedule_minutes, last_run) is exactly a schedule
// registry — it was the eight-verb SPEC that was the wrong design, not the row.
//
// Upsert on (owner_id, slug, name); nothing is auto-deleted, so the runner
// re-reads the site's schema and skips a job the spec no longer declares.
async function persistSiteJobs(env, ownerId, slug, jobs) {
  if (!env.SUPABASE_SERVICE_KEY || !slug || !ownerId || !jobs.length) return;
  const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY, "Content-Type": "application/json" };
  const now = new Date().toISOString();
  const rows = jobs.slice(0, 8).map((j) => ({
    owner_id: ownerId, slug, name: j.name, spec: { fn: j.fn }, enabled: true,
    updated_at: now, schedule_minutes: j.everyMinutes,
  }));
  const r = await fetch(`${SUPABASE_URL}/rest/v1/site_functions?on_conflict=owner_id,slug,name`, {
    method: "POST", headers: { ...svc, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows), signal: AbortSignal.timeout(10000),
  });
  // Reported rather than swallowed: an unregistered job is a reminder that
  // never fires, and the owner has no way to tell from the site.
  if (!r.ok) throw new Error("site_functions upsert " + r.status);
}
// Drain the scheduled jobs that are due, on the existing 2-minute cron.
//
// A job is a SCHEDULE plus one model-written function returning the messages to
// send. That is the whole vocabulary — there is nothing here to extend when
// somebody wants a different kind of scheduled work, because they write
// different SQL. It replaces the eight-verb runner (`read save fetch ai email
// notify checkout respond`), which is deleted: a fixed menu means the model can
// only ever do what was imagined in advance.
async function runScheduledSiteJobs(env, ctx) {
  if (!env.SUPABASE_SERVICE_KEY) return;
  const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY };
  let rows = [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/site_functions?enabled=is.true&schedule_minutes=not.is.null&select=owner_id,slug,name,spec,schedule_minutes,last_run&limit=200`, { headers: svc, signal: AbortSignal.timeout(10000) });
    rows = await r.json().catch(() => []);
  } catch { return; }
  if (!Array.isArray(rows)) return;

  for (const row of dueJobs(rows, Date.now())) {
    const out = await runJob({
      // Stamped FIRST, inside runJob, and that ordering is load-bearing: stamped
      // after sending, a job that dies mid-batch is due again on the next tick
      // and mails everyone it already reached. Losing a run is recoverable;
      // sending a reminder four times is not.
      // A CONDITIONAL CLAIM, exactly the notify-cooldown pattern: one caller
      // wins the window, decided by the database rather than by two ticks
      // agreeing not to overlap. The WHERE re-states dueness (never run, or
      // last_run older than the schedule minus the 30s slack dueJobs allows),
      // so an overlapping tick that reads the same row as due loses here and
      // sends nothing. OWNER-SCOPED like every filter on this table now: slug
      // alone crosses tenants the day a freed slug is re-claimed and the model
      // reuses a job name. And r.ok is CHECKED — the old write was not, so a
      // Supabase in read-only mode (reads fine, writes 5xx) let the send
      // proceed unstamped and re-mail the whole batch every tick until writes
      // recovered. A claim that cannot be recorded is a claim lost.
      stamp: async (r2) => {
        const mins = parseInt(r2.schedule_minutes, 10) || 0;
        const cutoff = new Date(Date.now() - Math.max(0, mins * 60000 - 30000)).toISOString();
        try {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/site_functions?owner_id=eq.${encodeURIComponent(r2.owner_id)}&slug=eq.${encodeURIComponent(r2.slug)}&name=eq.${encodeURIComponent(r2.name)}&or=(last_run.is.null,last_run.lt.${encodeURIComponent(cutoff)})`, {
            method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
            body: JSON.stringify({ last_run: new Date().toISOString() }), signal: AbortSignal.timeout(8000),
          });
          if (!r.ok) return { won: false };
          const got = await r.json().catch(() => null);
          return { won: Array.isArray(got) && got.length > 0 };
        } catch { return { won: false }; }
      },
      // Re-read the SITE'S OWN schema rather than trusting the registry row.
      // Nothing auto-deletes a job, so a revise that drops one leaves the row
      // behind; the schema is what the site actually declares today, and a job
      // it no longer declares must stop running.
      // NAMED CAUSES, never a bare null. Three different situations used to
      // shape to null and all three wore the broken-SQL sentence in the
      // owner's panel — "the function didn't return a list" said of a database
      // that was unreachable, of a job a revise had dropped, and of a bad
      // name. And the JSON parse is fenced with a FIXED sentence: V8's
      // SyntaxError quotes ~26 characters of the input, so a malformed result
      // beginning with recipient data would have put a fragment of a
      // customer's address into last_result — a platform table (2026-08-13
      // audit). No error message from the parse ever leaves this function.
      callFn: async (fn) => {
        const conn = await siteNeonProject(env, row.slug);
        if (!conn) return { jobsSkip: "the site's database is unreachable" };
        const spec = await loadSiteSchema(conn);
        const declared = (spec && Array.isArray(spec.jobs) ? spec.jobs : []).some((j) => j && j.name === row.name && j.fn === fn);
        if (!declared) return { jobsSkip: "this job is no longer part of the site" };
        if (!/^[a-z][a-z0-9_]{0,40}$/.test(String(fn))) return { jobsSkip: "the function has an unusable name" };
        const got = await sqlQuery(conn, "SELECT " + sqlIdent(fn) + "() AS out");
        const v = got && got[0] && got[0].out;
        if (typeof v !== "string") return v;
        try { return JSON.parse(v); } catch { return { jobsSkip: "the function returned text that is not valid JSON" }; }
      },
      // ONE VAULT READER, SHARED. This was a hand-rolled third copy of
      // siteMailSecrets — same four names, same loop — and the shared
      // function's own header says why that must not exist: two readers of one
      // vault written out twice are two things that can disagree about which
      // key is live. A provider added there and forgotten here would tell an
      // owner "no provider key in Secrets" while their confirmations sent
      // fine on the same key (2026-08-13 audit).
      credentials: async () => {
        const conn = await siteNeonProject(env, row.slug);
        if (!conn) return null;
        const secrets = await siteMailSecrets(env, conn, row.slug)();
        const picked = pickProvider(secrets);
        // Bring-your-own: no key and no from address means no send, quietly.
        // Our own sender is never substituted — see site-mail.mjs.
        if (!picked || !secrets.EMAIL_FROM) return null;
        return { provider: picked.provider, key: picked.key, from: secrets.EMAIL_FROM };
      },
      send: ({ provider, key, from, to, subject, html }) => postProviderEmail(provider, key, from, to, subject, html),
      recipient,
    }, row);

    // It runs detached on a cron, so an unlogged failure is invisible forever.
    // A job that sent nothing because nothing was due is not news; anything else
    // is.
    if (!out.ok || out.failed || out.overflow) {
      console.error("job:", row.slug, out.name, JSON.stringify(out).slice(0, 300));
    } else if (out.sent) {
      console.log("job:", row.slug, out.name, "sent", out.sent);
    }

    // AND WHERE THE OWNER CAN SEE IT, which is the half that was missing. A
    // Cloudflare log is not a surface a small business has; without this row the
    // four outcomes `runJob` carefully separates are one silence, and a reminder
    // that never arrives is invisible to the customer AND to the owner.
    //
    // A SECOND WRITE, after the run rather than folded into `stamp`. That one
    // goes FIRST on purpose (see runJob) and must keep going first; losing this
    // note costs a line of history, while moving the stamp costs somebody four
    // copies of the same reminder. Best-effort for the same reason — the tick
    // must not fail over a diagnostic.
    // A LOST CLAIM WRITES NOTHING: the winning tick's outcome is the run's
    // record, and overwriting it with "skipped" every overlap would bury the
    // one line the owner reads. Owner-scoped like the stamp, or a freed slug
    // re-claimed by another account gets its history written by a stranger's
    // zombie row.
    if (out.skipped) continue;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/site_functions?owner_id=eq.${encodeURIComponent(row.owner_id)}&slug=eq.${encodeURIComponent(row.slug)}&name=eq.${encodeURIComponent(row.name)}`, {
        method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ last_result: jobOutcome(out).slice(0, 400) }), signal: AbortSignal.timeout(8000),
      });
    } catch (e) { console.error("job result write failed:", row.slug, out.name, e && e.message); }
  }
}

// ── Website Builder: server-side image generation ──
// The design pass emits <img data-gen="<photo prompt>" data-ar="16:9"> placeholders;
// we generate each with Nano Banana Pro (fal sync endpoint), host it in the user's
// Supabase storage, and swap the real URL in — real photography, not CSS art.
const SPRITE_IMG_MODEL = "fal-ai/nano-banana-pro";
// The photographs on a generated site. Named apart from the sprite model even
// though both are nano-banana-pro today: they are two different jobs with two
// different prompts, and `IMAGE_USD` in publish-pages.mjs is the price of THIS
// one — moving the sprite model would otherwise silently re-price every build.
const SITE_IMG_MODEL = "fal-ai/nano-banana-pro";
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
/**
 * One photograph for a generated site. Bytes, not base64.
 *
 * NOT `genSpritePng`, and the differences are all deliberate. A sprite is a
 * subject on a chroma-key background that then gets keyed out; a site photograph
 * is a photograph, so there is no green screen and no Photon pass. And it is
 * JPEG at 2K rather than PNG at 1K: a 2K PNG is several megabytes for a picture
 * that is going to be scaled into a card, and nano-banana-pro bills 1K and 2K at
 * the same base rate — 4K is the tier that doubles — so the larger size is free.
 *
 * Throws on every failure. The caller turns that into a placeholder; there is
 * nothing sensible to return here, and an empty buffer would sail through the
 * upload path and store zero bytes under a hash of nothing.
 */
async function genSitePhoto(env, prompt) {
  const r = await fetch(`https://fal.run/${SITE_IMG_MODEL}`, {
    method: "POST",
    headers: { Authorization: `Key ${env.FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, aspect_ratio: IMAGE_ASPECT, resolution: "2K", output_format: "jpeg", num_images: 1 }),
    signal: AbortSignal.timeout(120000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("photo " + r.status + " " + String((d && d.detail) || "").slice(0, 120));
  const url = d.images && d.images[0] && d.images[0].url;
  if (!url) throw new Error("photo returned no image");
  const media = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!media.ok) throw new Error("photo fetch " + media.status);
  return new Uint8Array(await media.arrayBuffer());
}

/**
 * The `images` dep `publishPages` calls: buy what the pages asked for, store it
 * where the owner's own uploads live, and hand back the pages with URLs in them.
 *
 * EVERY FAILURE IS PER-PICTURE. One image model timing out must not cost the
 * other five, and none of them may cost the build — an unresolved token becomes
 * an empty `src`, which is `SafeImage`'s designed placeholder. So each shot is
 * its own try/catch and the whole thing is wrapped again by the caller.
 *
 * Stored through `uploadKey`/`uploadUrl` from site-uploads.mjs rather than a
 * second copy of those two lines: `uploads/<slug>/` is deliberately NOT under
 * `sites/<slug>/`, which a publish wipes — so the pictures survive a revise and
 * appear in the owner's own image library, which is the whole reason a build
 * that later fails to compile has not simply burned the money.
 */
/**
 * One photograph, generated and stored under the site's own uploads.
 *
 * EXTRACTED SO THERE IS ONE COPY. The build path and the `picture` layer both
 * need generate → sniff → hash → put, and two copies of that drift: the sniff is
 * the only thing standing between an image model's answer and an SVG served
 * inline from our own origin, so a second copy that forgets it is a stored XSS.
 *
 * Returns the URL, or null. Never throws: a photograph that could not be made is
 * a slot left alone, not a failed edit.
 */
async function makeSitePhoto(env, slug, prompt) {
  try {
    const p = imagePrompt(prompt);
    if (!p) return null;
    const bytes = await genSitePhoto(env, p);
    const kind = sniffImage(bytes);
    if (!kind) return null;
    if (bytes.length > MAX_UPLOAD_BYTES) return null;
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const name = uploadName(hex, kind.ext);
    if (!name) return null;
    await env.SITES_BUCKET.put(uploadKey(slug, name), bytes, { httpMetadata: { contentType: kind.mime } });
    return uploadUrl(slug, name);
  } catch (e) {
    console.error("photo failed:", slug, e && e.message);
    return null;
  }
}

async function buySitePhotos(env, { slug, pages, budget, balance, reserve }) {
  let affordable = imagesAffordable(budget, { balance, reserve, usd: SITE_PHOTO_USD });
  // THE OWNER'S OWN IMAGE ALLOWANCE, respected rather than bypassed. Generated
  // photographs land in `uploads/<slug>/`, which is the same 200-file / 100 MB
  // library the upload route enforces caps on — and this path writes straight to
  // R2, so it neither checked the cap nor left room under it. A few revises of a
  // picture-led site could fill somebody's library with photographs they never
  // chose, and then their own uploads start being refused.
  //
  // Best-effort: an unreadable listing does NOT block the build (the pictures are
  // the decoration, the site is the product), it just skips the trim.
  try {
    const objs = await siteUploadList(env, slug);
    const room = Math.max(0, MAX_FILES_PER_SITE - objs.length);
    if (room < affordable) affordable = room;
  } catch (e) { console.error("upload headroom check failed:", slug, e && e.message); }
  const plan = planImages(pages, affordable);
  // `planned` is what the FAMILY asked for and `budget` is what the balance left
  // — they have to travel separately, or a site that could not afford its
  // pictures is indistinguishable from one that was never meant to have any.
  const planned = Math.max(0, Number(budget) || 0);
  // ONE WAY OUT, AND IT ALWAYS SWEEPS. This used to return `pages` untouched
  // when there was nothing to buy, and that shipped a live bug the same hour:
  // the tokens stayed in the source, `SafeImage` saw a truthy src, and the
  // published home page rendered a BROKEN IMAGE with its alt text showing.
  //
  // It bit on the commonest path there is. A new account is granted 20 credits
  // and a build costs about 21, so `affordable` is 0 and this branch is what
  // EVERY first build takes — the graceful-degradation path the whole feature
  // is designed around was the one path that degraded to a broken page.
  //
  // Measured, not reasoned: `build smoke` went red on "no console errors" and
  // the screenshot showed it. Nothing in the unit suite could — `applyImages`
  // was tested directly and correctly, and the bug was in not calling it.
  const done = (urls, rest) => ({ pages: applyImages(pages, urls), planned, budget: affordable, overflow: plan.overflow, ...rest });
  if (!plan.shots.length) return done(new Map(), { made: 0 });
  const urls = new Map();
  let failed = "";
  await Promise.all(plan.shots.map(async ({ token, prompt }) => {
    try {
      const p = imagePrompt(prompt);
      if (!p) return;
      const bytes = await genSitePhoto(env, p);
      // The same sniff the upload route runs, on bytes we did not choose either:
      // what comes back is whatever the image model sent, and the stored
      // content-type has to be the truth about it rather than what we asked for.
      const kind = sniffImage(bytes);
      if (!kind) throw new Error("not a picture");
      if (bytes.length > MAX_UPLOAD_BYTES) throw new Error("too big");
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      const name = uploadName(hex, kind.ext);
      if (!name) throw new Error("bad name");
      await env.SITES_BUCKET.put(uploadKey(slug, name), bytes, { httpMetadata: { contentType: kind.mime } });
      urls.set(token, uploadUrl(slug, name));
    } catch (e) {
      // Kept, not thrown. The build carries on with a placeholder for this one,
      // and the reason reaches the response — a site quietly missing its
      // pictures looks exactly like a site that was never meant to have any.
      failed = String((e && e.message) || e).slice(0, 120);
    }
  }));
  // WHAT WAS STORED, never what was planned. `made` is what the customer is
  // billed for, so it comes from the map that only a successful put writes into
  // — counting the shots would charge for an image model outage.
  return done(urls, {
    made: urls.size,
    ...(failed && urls.size < plan.shots.length ? { error: failed } : {}),
  });
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
// project per Go Farther user, one database inside it per site — so a query for site A
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
// Does this Go Farther user own the React site <slug>? Proven from the generated source's
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
// In-app notifications for a site's members. Kept: the `notify` step of the
// D1-era site-functions runner still calls this, and that runner is a separate
// feature from auth — removing it is a different decision from this one.
const _notifsReady = new Set();
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
// Newer _users columns (roles, email verification) added after some sites were
// created. ALTER them in once per site per warm isolate (the Set caches it, so this
// is not paid on every auth call); each ALTER is idempotent-by-catch. NEW sites get
// the columns from the CREATE below, so the ALTERs just no-op for them.
const _authExtrasDone = new Set();
// What one build costs the caller. The designer is a single Sonnet call with a
// small output, so this sits alongside the other orchestrator fees rather than
// being priced like a generation.
const SITE_BUILD_FEE = 2;

// A plain-English brief becomes an isibi.schema.json. Uses tool-use rather than
// asking for JSON in prose: the model must return an object matching the schema
// below, so there is nothing to parse out of a reply and nothing to repair.
// The shortlist the model may choose from, derived from site-fonts.mjs rather
// than restated: a name here that is not installed produces a site whose CSS
// points at a font that was never bundled, and it renders as the fallback.
const SITE_FONT_IDS = SHORTLIST.map((f) => f.id);

// A SHORTLIST, exactly as the fonts enum is one — 100 of the 500, spread across
// all 53 categories so the list can dress a bakery as well as a SaaS. All 500
// names cost ~1,525 tokens on every design call and the shortlist costs ~312;
// the same list carrying each theme's one-line label would cost ~7,019, which is
// the figure the fonts field refused when it declined to name 2,096 Fontsource
// families. The names carry their own meaning (`broadsheet`, `bauhaus`, `zine`).
//
// The other 400 are NOT lost: `resolveTheme` takes any of the 500, and the route
// falls back to `body.theme`, so a caller can name one directly. What the
// shortlist bounds is what the MODEL chooses between — the same bargain fonts
// made when it left 2,072 families off its own list.
const SITE_THEME_IDS = THEME_SHORTLIST;
// Derived, never restated: a family named here that site-layouts.mjs does not
// declare produces a directive of nothing, and the page prompt silently loses
// its layout while every test still passes.
// READY only, and it must stay that way: familiesForPrompt() describes ready
// families alone, so an enum of all of them offers the model a name it is told
// nothing about and whose layoutDirective resolves to null.
const SITE_FAMILY_IDS = READY_FAMILIES;
// The eight page ARRANGEMENTS. Derived like the rest; 8 names and their
// descriptions together cost ~195 tokens, so there is no shortlist to make.
const SITE_STRUCTURE_IDS = STRUCTURE_NAMES;

const SITE_SCHEMA_TOOL = {
  name: "design_schema",
  description: "Design the database tables a site needs, as an isibi.schema.json.",
  input_schema: {
    type: "object",
    properties: {
      brand: { type: "string", description: "Short display name for the site." },
      slug: { type: "string", description: "url-safe-name, lowercase, hyphens only." },
      jobs: {
        type: "array",
        description:
          "OPTIONAL scheduled work — the site doing something on a timer, with nobody there. THE CASE THIS EXISTS FOR: reminding tomorrow's " +
          "customers today, so they turn up. Also a weekly digest to the owner, or chasing an unpaid invoice. Skip it entirely for a site " +
          "that only takes enquiries. " +
          "Each job names a function you ALSO declare in `functions` with `internal: true`, taking NO arguments and returning `json` — an ARRAY of " +
          "{to, subject, body}, one per message to send. Return an empty array when there is nothing to do, which is most runs. " +
          "The function is ordinary SQL, so decide whatever you like inside it: who is due, what it says, joined to anything on the site. " +
          "The site owner pastes their own email provider key in Settings; until they do, the job runs and sends nothing. " +
          "Minimum interval is 15 minutes and anything shorter is rounded up to it — for a day-before reminder use 1440.",
        items: {
          type: "object",
          required: ["name", "fn", "everyMinutes"],
          properties: {
            name: { type: "string", description: "lowercase identifier, e.g. remind_tomorrow" },
            fn: { type: "string", description: "The internal function returning the messages, e.g. bookings_due_tomorrow" },
            everyMinutes: { type: "integer", description: "How often to run. 1440 = daily, 60 = hourly. Minimum 15." },
          },
        },
      },
      apis: {
        type: "array",
        description:
          "OPTIONAL third-party APIs this site reads at request time. Use one ONLY when the brief needs live data that is " +
          "not in this site's own database and is not fixed at build time: today's exchange rate, a courier's delivery " +
          "slots, a supplier's stock level, the weather for an outdoor venue. Do NOT use it for anything a table can hold.\n\n" +
          "Write the WHOLE request and put `{{SECRET_NAME}}` wherever a credential belongs — the site OWNER stores that " +
          "value in Secrets and it is substituted server-side, so no key is ever in the page. Name the secret after the " +
          "service, e.g. `{{WEATHER_KEY}}`. Anything a page needs to vary goes in `params` and is written `{{param.x}}`; " +
          "values are URL-encoded, and a parameter not listed is ignored. A page then calls `useApi(\"<name>\", {x})`. " +
          "The response comes back exactly as the service sent it, so write the page against that service's real shape. " +
          "Set `cacheSeconds` to how long the answer stays good — an exchange rate is 3600, a stock level maybe 30 — " +
          "because every uncached read spends the owner's own quota.",
        items: {
          type: "object",
          required: ["name", "url"],
          properties: {
            name: { type: "string", description: "lowercase identifier the page calls by, e.g. exchange_rates" },
            url: { type: "string", description: "https only. e.g. https://api.example.com/v1/latest?base={{param.base}}&key={{RATES_KEY}}" },
            // A POST HERE IS STILL A READ, and the caching is why that has to
            // be said. `normalizeApi` gives every declaration a 60-second
            // window by default and `cacheKey` is slug|name|params — no method,
            // no body — so a declared POST is sent ONCE and then answered from
            // the store for a minute without contacting the service at all.
            //
            // Right for what this exists for: plenty of read endpoints require
            // POST (GraphQL, some search and pricing APIs), and caching them is
            // the whole point, since every uncached read spends the OWNER's own
            // quota. Wrong the moment the POST does something — the first call
            // lands, the next few silently do not, and it starts working again
            // a minute later, which reads as the third party being flaky rather
            // than as us not calling them.
            //
            // Not fixed by refusing to cache POSTs: that breaks the legitimate
            // case and puts the owner's quota back on every page view. Fixed by
            // saying the thing the model cannot infer from "POST only".
            method: { type: "string", enum: ["GET", "POST"],
              description: "GET unless the service's READ endpoint requires POST (GraphQL, some search and pricing APIs). " +
                "NEVER use this to make something happen on the other side — send a message, place an order, reserve a slot. " +
                "Every answer here is cached, so the request is made once and then answered from the store until the window " +
                "expires: an action would run sometimes and not others. Outbound actions belong in a database function." },
            headers: { type: "object", description: "e.g. {\"Authorization\":\"Bearer {{RATES_KEY}}\"}" },
            body: { type: "string", description: "POST only. The request body, with the same {{SECRET}} and {{param.x}} placeholders." },
            params: { type: "array", items: { type: "string" }, description: "Names a page may pass. Anything else is dropped." },
            cacheSeconds: { type: "integer", description: "0-3600. How long one answer stays good. Every uncached read costs the owner." },
          },
        },
      },
      functions: {
        type: "array",
        description:
          "OPTIONAL Postgres functions this site needs, called from a page by name. Use one ONLY when a page must do " +
          "something a table's access level cannot express. THE CASE THIS EXISTS FOR: a `collect` table is write-only, so " +
          "the customer who booked can never see their booking again. Give it a column " +
          "{name:'claim_token', type:'text', default:'uuid'} — `default:'uuid'` is the reserved token that fills it with a " +
          "random uuid, and the column is TEXT, so the function's argument is type 'text' too — plus a function taking that " +
          "token and returning exactly the matching row, then " +
          "the site can offer a link back to it. Declare a SECOND to cancel by the same token, and — for anything with a " +
          "date, a time or a quantity in it — a THIRD to CHANGE it: same token argument plus one argument per field the " +
          "customer may move, doing an UPDATE ... WHERE claim_token = tok. Without that third one the only way to shift an " +
          "appointment is to cancel and rebook, which on a table with `unique` or `noOverlap` means giving up the slot before " +
          "getting the new one. Change only the fields you took arguments for; never let it move status or the token itself. " +
          "Skip all of this for a " +
          "plain contact form, which nobody returns to. Bodies are plain SQL over this site's own tables.\n\n" +
          // WHEN A SLOT HOLDS MORE THAN ONE PERSON. `unique` gives a capacity of
          // exactly one and `maxRows` caps the WHOLE table — so "12 places in
          // this class", "8 tables at 7pm", "30 pitches" was inexpressible, on a
          // platform whose commonest site is a booking site. The substrate could
          // already do it (a function is SECURITY DEFINER, so it writes into a
          // table the caller cannot; `useRpcAction` calls it from a page) and
          // nothing said so — the same dead-at-the-last-link shape this file
          // keeps recording, arriving as a missing sentence rather than missing
          // code. THE LOCK IS NOT OPTIONAL: a bare count-then-insert lets two
          // people both see 11 of 12 and both book, which is the exact bug
          // `unique` exists to prevent, reintroduced by the thing meant to
          // generalise it.
          "A SLOT THAT HOLDS MORE THAN ONE PERSON. `unique` on a booking table means a capacity of exactly ONE, " +
          "and `maxRows` caps the whole table. When the brief says a class, a session, a table or a pitch holds " +
          "N people, neither fits — so make the booking go through a function instead of straight into the table. " +
          "Declare the table `write: \"none\"` so nothing can insert around it, and one function taking the " +
          "customer's details plus whichever columns identify the slot. In the body: take " +
          "`pg_advisory_xact_lock(hashtext(<the slot's identity>))` FIRST, then count the rows already in that " +
          "slot, `RAISE EXCEPTION 'fully booked'` if it is at capacity, and INSERT otherwise. The lock is what " +
          "makes it true — without it two people both see the last place and both get it, which is the double " +
          "booking this is here to stop. Put the capacity where the brief puts it: a number on the class row when " +
          "each class has its own, or a literal when the whole business has one number.\n\n" +
          "RECEIVING DATA FROM ANOTHER SYSTEM. A function named `hook_<something>` taking exactly one jsonb argument and " +
          "marked internal:true is reachable at POST /api/db/<slug>/hook/<something>, behind a shared secret the OWNER " +
          "stores. Use it when the brief says another system sends this site data — a supplier's stock feed, a booking " +
          "platform syncing appointments, an order marked shipped, a form service like Typeform or Zapier. The body does " +
          "whatever the payload means: INSERT, UPDATE, or nothing. Make it IDEMPOTENT — senders retry, so declare a unique " +
          "column for the sender's own event/order id and use ON CONFLICT DO NOTHING, or the same delivery lands twice. " +
          "The `hook_` prefix is what makes it reachable; without it the function stays private to the platform.",
        items: {
          type: "object",
          required: ["name", "returns", "body"],
          properties: {
            name: { type: "string", description: "lowercase identifier, e.g. booking_by_claim" },
            // THE TWO HALVES OF THIS TOOL SPOKE DIFFERENT TYPE LANGUAGES. A
            // column may be text/integer/real/boolean/json; an argument was
            // offered seven types no column can ever be. A body compares its
            // arguments to columns, so `{name:"d", type:"date"}` against a
            // TEXT `slot_date` is `operator does not exist: text = date` — the
            // function fails to CREATE, and the page's lookup is silently not
            // there. Non-fatal and reported in `functionErrors`, so the site
            // still builds without the capability it was asked for.
            //
            // The tool already knew this trap: its own example warned that a
            // claim token is TEXT "not uuid". Somebody hit the uuid version and
            // documented that one case; the date, numeric and bigint versions
            // were left open.
            //
            // NARROWED IN WHAT IS OFFERED, NOT IN WHAT IS ACCEPTED. `date` and
            // `timestamptz` are gone from this enum because NO column is ever
            // either, so they can only be right via an explicit cast nothing
            // asks for. The engine's own allow-list still takes them, so a
            // schema stored before today re-applies on a revise exactly as it
            // did — narrowing that too would break existing sites to tidy a
            // prompt. `uuid` and `jsonb` STAY and are not oversights: `owner_id`
            // and `team_id` really are UUID, and a `hook_*` handler takes
            // exactly one jsonb payload.
            //
            // `integer` joins `int` because that is the word the columns use,
            // and the engine has always accepted both — offering one spelling
            // while the other half of the tool uses the other is the mismatch
            // in miniature.
            args: {
              type: "array",
              description: "Arguments, matched to the COLUMN each one is compared against. What a declared column really is in Postgres: " +
                "`text` is TEXT · `integer` is INTEGER · `real` is REAL · `boolean` is INTEGER 0/1, NOT boolean · `json` is TEXT, NOT jsonb. " +
                "The columns the platform adds: `id` is INTEGER, `owner_id` and `team_id` are UUID, and `created_at` and every other " +
                "timestamp is TEXT in 'YYYY-MM-DD HH:MM:SS'. " +
                "THERE IS NO DATE COLUMN — a date or a time lives in a TEXT column, so an argument matching one is `text`. " +
                "A claim lookup takes one: {name:'tok', type:'text'} — the claim_token column is TEXT, so the argument matching it is text, not uuid.",
              items: {
                type: "object",
                required: ["name", "type"],
                properties: {
                  name: { type: "string" },
                  type: { type: "string", enum: ["text", "int", "integer", "bigint", "numeric", "boolean", "uuid", "json", "jsonb"] },
                },
              },
            },
            returns: { type: "string", description: "'setof <table>' for rows of a table this schema declares, else one of void/text/int/bigint/numeric/boolean/uuid/date/timestamptz/json/jsonb." },
            body: { type: "string", description: "The SQL body only — no CREATE FUNCTION, no $$ wrapper. e.g. SELECT * FROM bookings WHERE claim_token = tok" },
            internal: { type: "boolean", description:
              "Set true when the function is for the PLATFORM to call, never a page — a `confirm: {fn}` message builder, or a `hook_*` inbound webhook handler. " +
              "An internal function gets no EXECUTE grant, so no visitor can call it. That matters: it takes a row id and returns somebody's " +
              "email address and message, so left callable a stranger reads any customer's confirmation by guessing a number. " +
              "Leave it off for anything a page calls by name, like a claim lookup." },
          },
        },
      },
      tables: {
        type: "array",
        // THE ARRAY ITSELF SAID NOTHING. 36% of this tool's ~11,250 tokens sit
        // inside `items`, and the field the whole site hangs off had no
        // description of its own — the only sentence framing the decision was
        // in the system block, one layer away from where the answer is written.
        // Says what a table IS, and gives the two axes as the thing to decide,
        // since the pair is now the general form and `access` the shorthand.
        description:
          "The things this site has to REMEMBER — one table per kind of thing. A site that is only words needs none; " +
          "a barber shop needs two (the services it offers, the bookings it takes). Usually one to four. " +
          "For each one, decide who may READ it and who may WRITE to it: that pair is enforced in the database itself, " +
          "so a table nobody may read cannot leak however the pages are written. " +
          "Name it for the thing it holds, in the plural — `services`, `bookings`, `listings`.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "snake_case table name." },
            // REMOVING A FEATURE, without destroying what it collected.
      retired: {
        type: "boolean",
        description:
          "Set TRUE only when the message asks to REMOVE this table's feature from the site (\"drop the gallery\", " +
          "\"we don't take enquiries any more\"). The table and every row in it are KEPT — the owner can still read " +
          "and export them — but nothing on the site can reach it any more. Set FALSE to put a removed feature " +
          "back. LEAVE IT OUT ENTIRELY otherwise — omitting it keeps whatever the table already was, and saying " +
          "false on a table nobody asked about would restore something the owner removed.",
      },
      access: {
              type: "string",
              enum: ["collect", "display", "user", "feed", "admin"],
              description:
                "'display' = anyone reads it, nobody writes (menus, services, opening hours). " +
                "'collect' = anyone submits, nobody reads it back (bookings, orders, enquiries). " +
                "'user' = PRIVATE PER MEMBER: a signed-in visitor reads and writes only their own rows (saved recipes, my orders, a personal journal). " +
                "'feed' = SHARED, MEMBER-AUTHORED: every signed-in member reads all rows and writes their own (reviews, comments, a community board). " +
                "'admin' = SHARED, READ-ONLY FROM THE SITE: signed-in members read it and NOBODY writes it from a published page — the business maintains those rows from its Go Farther dashboard (announcements, staff notices). Pick it only when members should SEE something they never edit. " +
                "The last three require the visitor to have an account on the site — use them ONLY when the brief actually asks for members, sign-in, or 'their own' anything. A shop that just needs a menu and a booking form must not have them. " +
                "THESE FIVE ARE SHORTHANDS FOR A read/write PAIR. When none of them is the shape you need, set `read` and `write` instead and leave this out.",
            },
            // READ AND WRITE, SEPARATELY — the five names above cover 5 of the 16
            // combinations, and the missing ones are ordinary. A marketplace built
            // 2026-08-10 had no browsable page because "members post it, the public
            // reads it" is not one of the five: the designer correctly followed
            // "anything a visitor keeps as theirs" to `user`, and produced a site
            // whose every listing was invisible to the visitors it existed for.
            read: {
              type: "string",
              enum: ["none", "own", "members", "public"],
              description:
                "Who may READ this table, when the five shorthands do not fit. " +
                "'public' = anyone, signed in or not. 'members' = any signed-in member sees every row. " +
                "'own' = a signed-in member sees only their own rows. 'none' = nobody reads it from a page. " +
                "USE 'public' WITH write 'own' FOR ANYTHING VISITORS POST AND OTHER VISITORS BROWSE — a marketplace, classifieds, a directory, a job board, public reviews, a community wall. " +
                "That combination has no shorthand and is the one most often needed: without it the listings are invisible and the site has no page worth opening.",
            },
            write: {
              type: "string",
              enum: ["none", "own", "members", "anyone"],
              description:
                "Who may WRITE to this table, when the five shorthands do not fit. " +
                "'anyone' = any visitor with no account (a booking form). 'own' = a signed-in member writes rows that become theirs and edits only those. " +
                "'members' = any signed-in member may edit any row. 'none' = nothing on the published site writes to it; the business maintains it from its dashboard. " +
                "Note 'anyone' can never be combined with read 'own' — an anonymous visitor has no identity for a row to be 'theirs', so it resolves to read 'none'.",
            },
            // FOUR OF OUR OWN FEATURES THAT NOTHING COULD ASK FOR. Every one is
            // SQL this engine already writes — a unique index, a trigger, a
            // policy clause — and none had a slot on this form, so no site the
            // builder has ever made could have them. Audited before exposing:
            // `sequence`, `checks`, `audit`, `history` and `version` were left
            // out because they are NOT reachable end to end (a column nothing
            // stamps, a table nothing reads, a lock the client never sends), and
            // offering those would be the same dead-feature trap one layer up.
            oncePerUser: {
              type: "array",
              items: { type: "string" },
              description:
                "Columns that may hold only ONE row per signed-in member — usually just [] with no columns, meaning one row per member full stop. " +
                "ONE REVIEW PER CUSTOMER, one application per job, one vote per person, one booking per member per class. " +
                "A second attempt is refused by the database with a duplicate error the page turns into a sentence. Only on a table members write.",
            },
            enforceRefs: {
              type: "boolean",
              description:
                "Refuse a row whose `ref` column names a parent that does not exist. A booking for an event that was deleted, an order line for a product that is gone. " +
                "Turn it on for any table whose rows point at another table's rows — it is what stops the site filling with orphans nobody can explain.",
            },
            expires: {
              type: "boolean",
              description:
                "Give the table an `expires_at` column, and HIDE every row past it from every read, automatically. " +
                "A limited offer, a job advert that closes, an event listing that should stop showing the day after. " +
                "The owner sets the date from their dashboard; no page has to remember to filter, and one left unset never expires.",
            },
            scheduled: {
              type: "boolean",
              description:
                "Give the table a `publish_at` column, and HIDE every row until that time. " +
                "A post that goes live on Tuesday, a menu that changes at the weekend, a price list that starts next month. " +
                "The owner sets it from their dashboard; a row with none is live immediately.",
            },
            columns: {
              type: "array",
              // A picture is a `text` column holding a URL, and its NAME is what
              // decides whether the platform will accept a file for it — a
              // visitor may only upload to a table that declares one. Measured
              // 2026-07-28: across seven generated sites the designer put image
              // columns on `display` tables every time and on a `collect` table
              // never, so the upload path could not fire on a single one of them.
              description:
                "A picture is a 'text' column whose value is a URL — name it photo, image_url, avatar, logo, cover or hero_image. " +
                "Put one on a 'display' table when the site shows pictures it owns (a menu item, a product, a team member); the owner fills these in after the build. " +
                "Put one on a 'collect' or member table ONLY when the brief says the VISITOR sends a picture (a photo with their review, a reference image with their enquiry) — that is what lets the form accept a file at all.",
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
            // These are enforced by real Postgres constraints and have been since
            // the schema engine was written — and until 2026-07-28 the designer
            // could not emit ANY of them, so no generated site had one. Measured
            // live that day: two customers booked the same 14:00 slot on a
            // generated barber shop and both were accepted.
            unique: {
              type: "array",
              description:
                "Groups of columns that must be unique together, enforced by a real index (a violation is a 409, not a duplicate row). " +
                "USE THIS ON ANY BOOKING OR RESERVATION TABLE — without it two customers can take the same slot, which is the single most damaging bug a booking site can have. " +
                "A group is an array of column names: [[\"appointment_date\",\"appointment_time\"]] means nobody can book that date+time twice. " +
                "A group may instead be {\"columns\":[...], \"where\":\"status:eq:confirmed\"} so only rows in that state hold the slot — otherwise a CANCELLED booking occupies it forever.",
              // One consistent object shape. This was `items: {}` — an empty
              // schema, meant to allow both [["a","b"]] and [{columns,where}] —
              // and the API REJECTED the whole tool for it, so every build with
              // a brief answered "the designer is busy". Live for three merges.
              // The parser accepts the object form, so one shape is enough.
              items: {
                type: "object",
                properties: {
                  columns: { type: "array", items: { type: "string" }, description: "The columns that must be unique together." },
                  where: { type: "string", description: "Optional, as \"column:eq:value\" — only rows matching it hold the slot." },
                },
                required: ["columns"],
              },
            },
            uniqueCI: {
              type: "array",
              description: "Columns unique ignoring case — use for an email column, so Ada@x.com and ada@x.com cannot both sign up. Array of column names.",
              items: { type: "string" },
            },
            maxRows: {
              type: "integer",
              description: "Cap how many rows this table may ever hold. Worth setting on a public form (a giveaway with 500 places, a class with 20 seats); a full table answers 409 rather than growing forever.",
            },
            // `mask` USED TO BE HERE and was removed 2026-08-04, deliberately —
            // it is not a gap to fill back in.
            //
            // It promised field-level redaction: a phone shown as "••••1234" to
            // a reader who may not see it in full. `maskFields()` enforced that
            // on the read path in `site-data.mjs`, and that file was DELETED on
            // 2026-07-30 when reads moved to Neon's Data API. So the Worker is
            // no longer on the read path and has nothing to redact on the way
            // out; the function survived with zero callers, and the tool went on
            // offering the guarantee. A table declaring it served the raw value
            // to every reader, silently.
            //
            // It cannot move into the database as specified either: `mask` names
            // OUR application roles ("staff"), and Postgres knows `anonymous`
            // and `authenticated`. Column-level GRANTs express that coarser
            // split, but they make `select=*` fail outright — and `select=*` is
            // what every read this platform makes sends.
            //
            // So: a feature that lies, or no feature. Same call, for the same
            // reason, that pulled `teamRead` and `teamScope` out of this tool
            // when their enforcement went. Restoring it means building the
            // enforcement FIRST — test/declarable-enforced.test.mjs fails if it
            // comes back without one.
            // A team is a Neon Auth ORGANIZATION now, so the owner sets teams up
            // through Better Auth rather than through any route of ours. Offered
            // here again because a flag the designer cannot declare is a feature
            // that does nothing — which this one was, at five separate layers.
            teamScope: {
              type: "boolean",
              description:
                "Share this table across a TEAM: everyone in the same team reads and edits the same rows, and a write records who made it. " +
                "USE THIS FOR AN INTERNAL TOOL where colleagues work the same records — a CRM's deals, a shared job list, a client roster. " +
                "Only meaningful with access 'user'. Do NOT use it for a customer-facing members area, where one customer must never see another's rows. " +
                "A member who is not in a team sees only their own rows, so a site is safe before any team exists.",
            },
            publicView: {
              type: "object",
              description:
                "A named, PII-filtered projection of this table that ANYONE may read, even though the table itself is not readable. " +
                // THE CASE THAT DECIDES WHETHER THE SITE CAN EXIST, and it was
                // missing. This description named only the booking slot — an
                // optional enhancement — so a marketplace brief ("people post
                // their own events to sell") produced `events` as a `user` table
                // with no publicView, which is 401 signed out and own-rows-only
                // signed in. Measured live 2026-08-10: nobody could browse a
                // single listing, page generation had no home page it could
                // honestly write, and the build came back with no pages at all.
                "REQUIRED WHEN VISITORS POST ROWS THAT OTHER VISITORS MUST BROWSE — a marketplace, classifieds, a directory, a listings site. " +
                "Without it there is NO browsable page: a \"user\" table is 401 to a signed-out visitor and own-rows-only to a signed-in one, so nobody can ever see a listing. " +
                "Publish what a buyer needs (title, price, date, location, category) and leave out the rest. " +
                "ALSO USE IT WITH A BOOKING TABLE so the page can grey out slots that are already taken: publicView {\"columns\":[\"appointment_date\",\"appointment_time\"]} publishes WHEN people have booked and nothing about WHO. " +
                "Name only the columns a stranger may see — never a name, email, phone or note. `id` and `owner_id` are refused outright. " +
                "Add \"where\":[\"status:eq:confirmed\"] when the table has a status, so a cancelled row stops occupying the slot.",
              properties: {
                columns: { type: "array", items: { type: "string" }, description: "The only columns published. No wildcard." },
                where: { type: "array", items: { type: "string" }, description: "Filters as \"column:eq:value\" or \"column:ne:value\"." },
                limit: { type: "integer", description: "Most rows returned at once (default 500, max 2000)." },
              },
            },
            noOverlap: {
              type: "object",
              description:
                "Prevents overlapping INTERVALS, for bookings whose length varies (a 60-minute colour at 10:00 must block a 30-minute trim at 10:30 — `unique` would let both in, because they are different times). " +
                "REQUIRES start and end to be INTEGER columns, e.g. minutes from midnight: declare start_min/end_min as integers alongside whatever text time you display. " +
                "If either is not an integer column the constraint is SILENTLY SKIPPED, so use plain `unique` unless you have actually declared the integers.",
              properties: {
                start: { type: "string", description: "Integer column where the interval starts." },
                end: { type: "string", description: "Integer column where it ends." },
                on: { type: "array", items: { type: "string" }, description: "Columns that scope it — e.g. [\"appointment_date\"] or [\"room\"]." },
              },
            },
            confirm: {
              type: "object",
              description:
                "EMAIL THE PERSON WHO SUBMITTED, as soon as they submit — a booking confirmation, an order receipt, an enquiry acknowledgement. " +
                "Declare it on a `collect` table whose form asks for an email address, which is nearly every booking or enquiry form. " +
                "`to` must be one of THIS table's own columns, the one holding the visitor's address. " +
                "`subject` and `body` may use {column} to insert any value from the row they just submitted — e.g. \"Booked, {customer_name}\". " +
                "`body` is HTML; keep it short and plain, and never ask them to reply with card details or a password. " +
                "The site owner pastes their own email provider key (Resend, SendGrid or Postmark) in Settings — until they do, nothing is sent and the form still works normally. " +
                "Do NOT declare this to notify the OWNER: they are told about every submission already.",
              properties: {
                fn: { type: "string", description:
                  "OPTIONAL, and the more capable form. Instead of to/subject/body, name a function you ALSO declare in `functions` with `internal: true`, " +
                  "taking one bigint argument (the new row's id) and returning `json` shaped {to, subject, body}. " +
                  "Use it whenever the message depends on anything beyond the row itself — join the stylist's name, count the customer's previous bookings to greet a regular, " +
                  "say something different for a Saturday. `internal: true` matters: without it the function is callable by any visitor, who could then read anyone's confirmation by guessing an id." },
                to: { type: "string", description: "The column on this table holding the visitor's email address — e.g. \"customer_email\". Omit when using `fn`." },
                subject: { type: "string", description: "Subject line. {column} is replaced from the submitted row." },
                body: { type: "string", description: "Short HTML body. {column} is replaced from the submitted row." },
              },
              // Nothing is required: `fn` and the to/subject/body trio are
              // alternatives, and a schema tool cannot express "one or the
              // other". Which arrived is decided by normalizeConfirm, and a
              // half-declaration of either is refused there rather than
              // half-applied.
            },
            sms: {
              type: "object",
              description:
                "TEXT THE PERSON WHO SUBMITTED. The same idea as `confirm` and a separate declaration, so a table may have either or both — " +
                "an emailed receipt AND a texted reminder. Declare it on a `collect` table whose form asks for a PHONE NUMBER. " +
                "Worth it where a text is read and an email is not: a booking confirmation for a barber, a garage or a restaurant, " +
                "an appointment reminder, an order-is-ready message. " +
                "`to` must be one of THIS table's own columns. `body` is PLAIN TEXT — no HTML, no links unless they matter — and " +
                "{column} inserts a value from the submitted row. Keep it under 160 characters: a text is billed per 160-character segment. " +
                "The site owner pastes their own Twilio, MessageBird or Vonage credentials in Settings, plus the number or sender name to send from; " +
                "until they do, nothing is sent and the form still works normally. " +
                "The visitor's number must be given in full international form (+44…, +1…) — ask for it that way on the form, because a local number cannot be sent to. " +
                "Do NOT declare this for a plain contact form, and do not declare it for marketing: every message costs the owner money and unsolicited texts are regulated.",
              properties: {
                fn: { type: "string", description:
                  "OPTIONAL, and the more capable form. Instead of to/body, name a function you ALSO declare in `functions` with `internal: true`, " +
                  "taking one bigint argument (the new row's id) and returning `json` shaped {to, body}. Use it when the message depends on anything " +
                  "beyond the row — the stylist's name, the slot time formatted properly, a different message for a first-time customer. " +
                  "`internal: true` matters: without it any visitor could call it and read anyone's phone number by guessing an id." },
                to: { type: "string", description: "The column on this table holding the visitor's phone number — e.g. \"mobile\". Omit when using `fn`." },
                body: { type: "string", description: "Short plain-text message. {column} is replaced from the submitted row." },
              },
            },
            payment: {
              type: "object",
              description:
                "The visitor PAYS BY CARD when they submit this table. Declare it ONLY when the brief says money changes hands online — an online shop, paid tickets, a deposit. " +
                "A shop that takes orders and invoices later, or a barber shop that is paid in the chair, does NOT declare this. " +
                "The table stays `collect`; it gains payment_status / payment_ref / amount_total / currency / paid_at, all set by the platform — never declare those columns yourself and never put them on a form. " +
                "`from` must name a `display` table on this same site whose rows carry the prices, because the total is computed from THOSE rows on the server: the browser only ever says which row and how many. " +
                "The site owner pastes their own Stripe key in Settings; until they do, the checkout answers politely that payments are not set up yet.",
              properties: {
                from: { type: "string", description: "The `display` table holding the priced items, e.g. \"products\" or \"tickets\"." },
                price: { type: "string", description: "The column on that table holding the price, as a plain decimal like \"12.50\". Default \"price\"." },
                name: { type: "string", description: "The column holding the item name shown on the Stripe page. Default \"name\"." },
                currency: { type: "string", description: "Three-letter ISO code, lowercase — \"gbp\", \"eur\", \"usd\". Pick the one the business actually trades in." },
              },
              required: ["from"],
            },
          },
          // `access` IS NOT REQUIRED, AND IT USED TO BE — the tool contradicted
          // itself. Its own description ends "when none of them is the shape you
          // need, set `read` and `write` instead and LEAVE THIS OUT", so a model
          // doing exactly what it is told produced an invalid tool call, and one
          // satisfying the schema had to name a preset it had just been told did
          // not fit. It resolves that by picking the nearest preset — which is
          // how a marketplace ends up with private listings, the failure the
          // read/write pair was added to prevent.
          //
          // THE COST, STATED: a table declaring neither `access` nor a pair is
          // now possible, and `coerceTable` gives it the collect shape — write
          // only, readable by nobody. That is the fail-safe direction and the
          // reason this is safe to relax: the wrong answer is an invisible menu,
          // which the owner sees at once and a revise fixes, rather than a
          // `collect` table of customer phone numbers served to the public.
          required: ["name", "columns"],
        },
      },
      // Starter content, and not a nicety: nothing can write to a `display` table
      // after the build — not even the owner — so whatever is not seeded here is
      // an empty list forever, and a form whose required Select reads that table
      // cannot be submitted by anyone.
      // Goes in the published page's head. Until 2026-07-28 a generated site had
      // a <title> and nothing else, so sharing its link on WhatsApp, iMessage or
      // Slack showed a bare URL — and for a small business that link IS the
      // marketing.
      description: {
        type: "string",
        description:
          "One sentence describing the business, as it should appear under the name in a Google result or a shared-link preview. " +
          "Write it for a customer, not a developer: what it is, where, and what someone can do here — 'Skin fades and hot-towel shaves in Lisbon. Book online.' " +
          "Under 160 characters. No quotes, no line breaks.",
      },
      seed: {
        type: "object",
        // MEASURED: THE DESIGNER LEFT THIS OUT ON TWO CONSECUTIVE BUILDS, and
        // being in `required` did not stop it — a required field means the KEY
        // is present, so `seed: {}` satisfies the schema perfectly. The three
        // silent shapes are absent, `{}`, and an empty array, and only the
        // first is even a violation.
        //
        // IT IS ALSO THE SECOND-LARGEST THING THIS TOOL ASKS FOR: measured on a
        // reconstructed answer, `seed` is ~41% of the designer's output tokens
        // against `tables`' 47%, and it was carrying 526 characters of
        // instruction against `family`'s 10,990 for 1% of the output. That is
        // the sharpest cost-to-guidance mismatch in the tool, and it is the one
        // field with a failure anybody has actually seen. Longer is close to
        // free — this rides in the cached prefix — so the fix is words.
        description: "Starter rows for each 'display' table, keyed by table name: {\"services\": [{...}, {...}]}. " +
          "REQUIRED for every display table — a table left unseeded shows an empty list forever, because nothing can write to it after the build. " +
          "Write 3-6 realistic rows per table using only that table's declared columns. Make them plausible for this specific business, not placeholders: " +
          "real service names and real prices, not 'Item 1' / 0.00.\n" +
          "THIS IS NOT OPTIONAL AND IT IS NOT DECORATION. There is no route by which a display table is ever filled " +
          "in later: no page can write to it, no form can, the platform has no importer, and the owner editing rows " +
          "by hand in their dashboard is the only way — so an empty table is what the customer's site SHIPS with. " +
          "A price list with nothing in it is a business that looks closed. Worse, any form field that chooses from " +
          "that table renders with ZERO options, so nobody can submit it at all: an unseeded `services` table means " +
          "the booking form is dead, not merely bare.\n" +
          "COUNT YOUR OWN TABLES BEFORE YOU FINISH. Every table you declared with a public read and no public write " +
          "needs a key here. An empty object, an empty array, or a missing key are all the same outcome as not " +
          "answering — the schema accepts them and the site ships broken. If a table genuinely has no starter " +
          "content to write, it should not have been a display table.",
        additionalProperties: { type: "array", items: { type: "object" } },
      },
      // The typeface. Declared as an ENUM rather than free text, so an invalid
      // font is impossible instead of something a lint has to catch afterwards —
      // and so the whole list costs ~300 characters rather than the ~7,500 tokens
      // that naming all 2,096 Fontsource families would add to every generation.
      // Anything outside this list is still reachable later, by name, through the
      // fetch path in site-fonts.mjs.
      fonts: {
        type: "object",
        description:
          "OPTIONAL, AND USUALLY LEAVE IT OUT. Every theme already carries a typeface pairing chosen to go with it — " +
          "the one you pick above brings its own, and that is what the site gets when this is absent. Setting it anyway " +
          "means overriding a considered pair with a guess.\n" +
          "Set it ONLY when the brief asks for something about the type that the theme would not give: a named " +
          "typeface, or an explicit instruction about the feel of the lettering. Then pick for the BUSINESS, not for " +
          "fashion — a law firm or a restaurant can carry a serif, a gym or a studio wants a confident sans, a plain " +
          "sans is right for most. The two may be the same. A display serif set as the body face is tiring to read at " +
          "14px — pair it with a sans instead.",
        properties: {
          heading: { type: "string", enum: SITE_FONT_IDS, description: "Face for h1-h4." },
          body: { type: "string", enum: SITE_FONT_IDS, description: "Face for everything else." },
        },
        required: ["heading", "body"],
      },
      // The LOOK, as an enum for the same reason the typeface is one: a name
      // outside this list would render as the untouched template while the
      // response claimed a theme, which is the failure shape the font write
      // exists to end.
      theme: {
        type: "string",
        enum: SITE_THEME_IDS,
        description:
          "The site's visual world. Pick for the TRADE and its mood, not for novelty — the name says what it is " +
          "(broadsheet, bauhaus, zine, apothecary). A barber shop and a law firm want different worlds; " +
          "most businesses want a quiet one. This sets colour, type feeling, corners, borders and shadows together.",
      },
      // ONE COLOUR, CHANGED — the thing a revise could not do at all.
      //
      // Anchoring the look in `_meta` stopped "make the background yellow"
      // re-rolling a barber shop into a different site, and left the customer
      // unable to change the background AT ALL: every token comes from a theme
      // in the registry, and none of the 500 is "the one you have, but yellow".
      // This is the escape hatch, and it rides on a call that already reads the
      // instruction and already returns structured output, so it costs no extra
      // model call — the same reasoning as `needsWeb`.
      //
      // OMITTED unless the instruction really is about a colour. The look is
      // otherwise the theme's business, and a designer that patches tokens
      // "while it is here" is the re-roll arriving one property at a time.
      tokens: {
        type: "object",
        description:
          "ONLY when the message asks for a specific COLOUR or CORNER change to an existing site (\"make the background " +
          "yellow\", \"the buttons should be green\", \"round the corners more\", \"square corners please\"). Omit it " +
          "entirely otherwise — on a first build, and on any revise about content, pages or layout. Colours are HEX " +
          "(#rrggbb); `radius` is a length. Set the surface only; the readable text colour on top of it is worked out " +
          "for you, so do not set a *-foreground unless the customer named that colour too.",
        // THE HINT IS DERIVED PER TOKEN, not one line for all of them. `radius`
        // takes a LENGTH and every other name takes a colour; described as
        // "#rrggbb" it would be asked for in hex, refused by the parser, and
        // reported to the customer as a colour we could not use.
        // AND WHERE A NAME MEANS TWO THINGS, SAY SO. `border` is on both this
        // list and `style` below — here it is the line's COLOUR, there its
        // weight — so "make the borders thicker" can land in the wrong slot,
        // be refused for not being a colour, and come back to the customer as
        // "ask again with a hex code", which is advice that cannot work.
        // DERIVED from the overlap rather than naming `border`, so a name that
        // gains a twin later is disambiguated without anybody remembering.
        properties: Object.fromEntries(SITE_TOKEN_NAMES.map((t) => [t, {
          type: "string",
          description: siteTokenHint(t)
            + (SITE_STYLE_AXES.includes(t) ? " — the COLOUR only; for its weight or style use `style." + t + "`" : ""),
        }])),
      },
      // THE REST OF THE LOOK — the twelve decisions a theme makes that are not
      // colours, and that until now no customer could reach. Ask for square
      // buttons and one of two things happened: nothing, or the whole theme was
      // swapped looking for one that has them, which changes the colours and the
      // fonts and the spacing too — one thing asked for, a different site given.
      //
      // AN ENUM PER AXIS, not a free string, so an option the engine would
      // refuse is impossible rather than merely dropped. The options and their
      // descriptions are DERIVED from the theme engine's own constants (see
      // builder/site-style.mjs): a restated list drifts, and the direction it
      // drifts in is describing something to the model that is then refused and
      // reported to the customer as a change that did not happen. ~508 tokens,
      // in the cached block.
      style: {
        type: "object",
        description:
          "ONLY when the message asks for a specific LOOK change to an existing site that is not a colour — " +
          "\"square buttons\", \"make it feel more spacious\", \"bigger text\", \"lose the shadows\", " +
          "\"thinner icons\". Omit it entirely otherwise — on a first build the theme already decides all of " +
          "these, and on any revise about content, pages or layout. Name only the axes the customer actually " +
          "asked about; anything left out keeps whatever the site wears today.",
        properties: Object.fromEntries(SITE_STYLE_AXES.map((a) => [a, {
          type: "string",
          enum: siteStyleOptions(a),
          description: siteStyleHint(a),
        }])),
      },
      // The SHAPE. Distinct from the theme on purpose: a theme decides how a
      // site looks, a family decides what its pages ARE and in what order.
      family: {
        type: "string",
        enum: SITE_FAMILY_IDS,
        // DERIVED, not a hand-written sample. This described four of the 26 and
        // left the other 22 to be picked from a bare name — the same
        // restated-instead-of-derived trap that makes a list drift from the
        // module it describes. `familiesForPrompt` is site-layouts.mjs's own
        // one-line-per-family blurb, and each line carries the trades it suits,
        // which is what actually makes the choice accurate. ~954 tokens.
        description:
          "The kind of site this is: it decides what the PAGES are, not what they look like. " +
          "Each line is a family and the trades it covers — match the brief's own words against " +
          "those trades, and where none is exact pick the family whose trades are nearest. " +
          "How the pages are then arranged is not your problem here; that is sent to the step " +
          "that writes them.\n\n" + familiesForPrompt(),
      },
      // The third axis: a family says what the PAGES are, a structure says how one
      // is arranged. `store` on card-grid and `store` on sidebar are the same
      // pages in genuinely different shapes.
      //
      // OPTIONAL, UNLIKE THE OTHER THREE, and deliberately. Every family already
      // declares a sensible default — a store browses (card-grid), a firm reads
      // (editorial), a departures board is a terminal — so a skipped answer is a
      // good answer here. The fonts field is required because skipping it means
      // no typeface was chosen at all; skipping this one means "the shape this
      // kind of site usually takes", which is right far more often than not.
      structure: {
        type: "string",
        enum: SITE_STRUCTURE_IDS,
        description:
          "How the pages are ARRANGED — optional. Every family already has a sensible default, so leave this out " +
          "unless the brief asks for a shape that is not the usual one for this kind of site.\n\n" + structuresForPrompt(),
      },
      // WHAT LANGUAGE THE SITE IS WRITTEN IN, which nothing could say until
      // 2026-08-12 — the template hardcodes `<html lang="en">`, so a peluquería
      // in Madrid published as English and Chrome offered its own customers a
      // translation into English of a page that was already Spanish.
      //
      // DERIVED FROM THE BRIEF RATHER THAN ASKED FOR. A person describing their
      // business in Spanish is not going to be asked which language they want;
      // the brief is the answer, and this is the one step that has read it.
      lang: {
        type: "string",
        description:
          "The language THE SITE'S OWN PAGES are written in, as a BCP-47 tag — `es`, `fr`, `pt-BR`, `de`. " +
          "Read it from the brief: the language the customer wrote to you in is almost always the language " +
          "their customers read. It is NOT the language of this conversation and NOT where the business is — " +
          "a Welsh café writing to you in English gets `en`. Leave it out only if you genuinely cannot tell.",
      },
      // THE WEB-SEARCH GATE, RIDING ON A CALL THAT ALREADY HAPPENS. Searching
      // costs real money per search and is worth it on a small minority of
      // briefs, so it has to be gated — and the obvious way to gate it, a small
      // classifier call, is a third model call on every build to answer "no"
      // almost every time. This step already reads the brief and already returns
      // structured output, so the gate is two extra fields and costs nothing.
      //
      // Both are OPTIONAL and absent means no. A build that answers nothing here
      // behaves exactly as the platform did before the feature existed, which is
      // the right default for the overwhelming majority of sites.
      needsWeb: {
        type: "boolean",
        description:
          "Does writing this site's CONTENT require facts you may not have, or that may have changed since your training? " +
          "Almost always NO. A barber shop, a café, a plumber, a gym — their content is the brief plus the owner's own prices, " +
          "and no search helps. Say YES only when the pages must state something real and current that the brief does not " +
          "supply: this season's fixtures, a live specification, a regulation, an event's dates, a named product's actual " +
          "details. Do NOT say yes merely because a real company is mentioned, and never to check a fact you would only " +
          "restate as marketing copy.",
      },
      webQueries: {
        type: "array",
        description:
          "Only when needsWeb is true: 1-3 specific search queries. Write what you would type into a search box, not a " +
          "sentence — 'Six Nations 2026 fixtures dates' rather than 'please find the fixtures'.",
        items: { type: "string" },
      },
    },
    // `fonts` IS DELIBERATELY NOT HERE. It was required, so the model answered it
    // on every build from a prose hint — while the theme it had just picked
    // already carried a curated, validated pair that nothing read. Optional, the
    // ordinary build inherits the theme's own pairing and the two cannot
    // disagree; a brief with an opinion about type still overrides it.
    required: ["brand", "slug", "tables", "seed", "description", "theme", "family"],
  },
};

/**
 * The schema call's budget.
 *
 * Was 2000, chosen when the tool returned a brand, a slug and a few column
 * names. `seed` became a REQUIRED field on 2026-07-28 — 3-6 realistic rows for
 * every display table — and `description` with it, so the response is several
 * times the size it was sized for. Sonnet 5 also runs adaptive thinking when
 * `thinking` is omitted, and max_tokens caps thinking AND the response together,
 * so part of that budget is spent before a single row is written. Same reasoning
 * as SITE_PAGES_MAX_TOKENS below, which was sized for it and this was not.
 */
const SITE_SCHEMA_MAX_TOKENS = 8000;

/**
 * One Messages API call, body in, parsed response out.
 *
 * Added for the router (`/api/site/route`), which is the first builder call
 * whose whole request is composed in a plain module — `askRequest` returns the
 * body and this posts it. The two older calls build their bodies inline and
 * keep their own bespoke error handling; they are not moved onto this, because
 * rewriting the two paths that carry every build to share a helper with one new
 * caller is a change with all of the risk on the wrong side.
 *
 * A TIMEOUT HERE, unlike the two builder calls. The reasoning that removed
 * theirs — the tokens are billed whether or not we listen, so cutting off means
 * paying in full and handing the customer a failure — does not transfer: this
 * call runs BEFORE a build, a slow one delays the work rather than being the
 * work, and 700 max_tokens on Haiku that has not answered in 20 seconds is not
 * going to.
 */
async function anthropicMessages(env, body) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) {
    const e = new Error("anthropic " + r.status);
    e.status = r.status;
    e.detail = (await r.text().catch(() => "")).slice(0, 300);
    throw e;
  }
  return r.json();
}

// `model` comes from `modelsFor(body.picker)` — the composer's Builder control,
// which chose nothing at all until 2026-08-08. Defaulted here only so this can
// never send `model: undefined` and 400 the whole builder; the caller passing
// it is what a test asserts, because a default that quietly wins is how a picker
// goes back to being decoration.
// `current` is the site as it stands, on an EDIT only — absent on every first
// build, which is why a build's request is byte-identical to what it always
// sent. When it is present the model is shown the current values and told to
// return ONLY what this change alters, and the tool's `required` list is emptied
// for the same reason: a required field is one the model must answer, and
// answering it is exactly what moves a value nobody asked to move.
async function designSiteSchema(env, brief, model = modelsFor().design, current = null, files = []) {
  // The request is built FIRST and the usage below is stamped from `req.model`,
  // so what we bill and what we sent cannot disagree — the same by-construction
  // discipline as pricing from one table instead of two.
  const req = {
      model,
      max_tokens: SITE_SCHEMA_MAX_TOKENS,
      // CACHED, the way pagesRequest already caches PAGE_RULES. This call carries
      // ~6,800 input tokens of tool schema and system text that are byte-identical
      // on every build, and it was paying full price for all of it every time —
      // while the PAGE call, three and a half times bigger, was a cache read.
      // The small call was the expensive one. cache_control on the LAST tool
      // covers the tool block; the system block carries its own.
      tools: [{ ...SITE_SCHEMA_TOOL, cache_control: { type: "ephemeral" } }],
      tool_choice: { type: "tool", name: "design_schema" },
      system: [{ type: "text", cache_control: { type: "ephemeral" }, text: "You design the data model behind a small business website. Keep it to the few tables the site actually needs — usually one to four. " +
              "Use 'display' for content the business publishes and visitors read (services, menu items, posts). " +
              "Use 'collect' for anything a visitor submits — bookings, orders, enquiries, signups. Those are write-only on purpose: the visitor sends one in, " +
              "and only the business reads them, so customer names and phone numbers are never served back to the public. " +
              "Prefer few columns with obvious names. Turn on fts only where someone would genuinely search free text. " +
              "If the brief mentions accounts, signing in, members, or anything a visitor keeps as 'theirs', give that data a 'user' table (or 'feed' when members are meant to see each other's) — visitor accounts are real and the pages can build a sign-in. " +
              "Do NOT invent a signups/members table to hold accounts: the platform stores those itself, so a table for emails and passwords is both unnecessary and unusable. " +
              "Then fill every 'display' table with 3-6 realistic starter rows in `seed`. This is not optional and it is not decoration: " +
              "nothing can write to a display table after the build, so an unseeded table is an empty list forever, and any form field that " +
              "chooses from it will have nothing to choose. Write content a real business would publish." }],
      // THE STATE AND THE RULE RIDE IN THE USER MESSAGE, never the cached blocks
      // above: both vary per site, and a per-site byte in the cached prefix
      // misses the ~10,800-token cache on every build. Same reasoning as the
      // layout directive and the attachments.
      // THE ATTACHED FILES, WHICH THE DESIGNER NEVER SAW.
      //
      // `attachments()` has always split the composer's files into content
      // blocks (images, PDFs) and plain text, and only the PAGE call was handed
      // the blocks. Text was folded into the brief and reached here; a picture
      // or a PDF did not. So a caf\u00e9 owner attaching their menu as a PDF got a
      // menu table the model INVENTED, because seed rows are written HERE and
      // this is the one call that never saw the menu.
      //
      // The recorded reason not to do this was that it "means paying for those
      // tokens on the flat-fee schema call" \u2014 and that reason expired on
      // 2026-08-08, when the fee became a DEPOSIT that `schemaSettlement` trues
      // up against real usage. The tokens are now billed for what they are.
      //
      // Placed exactly where `pagesRequest` places them: in the USER message,
      // after both cached blocks, so an attachment does not miss the ~10,800-token
      // cache; and BEFORE the text within that message, the order the API is
      // documented to work best in. With no files the content stays a plain
      // STRING, so no request that does not use the feature changes shape.
      messages: [{ role: "user", content: (() => {
        const text = current ? brief + currentStateNote(current) + EDIT_RULE : brief;
        const blocks = Array.isArray(files) ? files.filter(Boolean) : [];
        return blocks.length ? [...blocks, { type: "text", text }] : text;
      })() }],
  };
  // Emptied on an edit, and only on an edit. `required` is a static part of the
  // tool, so this is the one place it can vary per call.
  if (current) req.tools = [{ ...req.tools[0], input_schema: { ...SITE_SCHEMA_TOOL.input_schema, required: EDIT_REQUIRED } }];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(req),
    // NO TIMEOUT ON EITHER BUILDER CALL (owner's call, 2026-08-04). A timeout
    // here does not save anything: the tokens are generated and billed to us
    // whether or not we are still listening, so cutting the connection means
    // paying in full and handing the customer a failure. The schema call was
    // 60s and the page call 240s against a 24,000-token ceiling, which a large
    // generation goes straight past — so the cap was most likely to fire on
    // exactly the elaborate site somebody most wanted.
    //
    // "No timeout" means the platform's, not none: Cloudflare still bounds the
    // request, and a genuinely hung upstream ends there rather than hanging on
    // forever. What changes is that a SLOW answer is now allowed to finish.
  });
  if (!r.ok) {
    const e = new Error("anthropic " + r.status);
    // Carried so the caller can say WHICH failure this was. The builder's main
    // path has now gone down twice behind one unchanging "the designer is busy",
    // and both times the only way to tell a transient overload from a request we
    // are getting wrong was to read Cloudflare's logs.
    e.status = r.status;
    e.detail = (await r.text().catch(() => "")).slice(0, 300);
    throw e;
  }
  const j = await r.json();
  // A tool_use block cut off at max_tokens carries half-written JSON, so `input`
  // is a partial schema — usually missing `seed`, sometimes missing `tables`
  // entirely. Returning it silently made the caller answer "that brief didn't
  // describe anything to store", which blames the person who wrote a perfectly
  // good brief for a budget we set. Same check the pages call makes.
  if (j.stop_reason === "max_tokens") {
    const e = new Error("schema truncated at max_tokens");
    e.truncated = true;
    throw e;
  }
  const use = (Array.isArray(j.content) ? j.content : []).find((b) => b && b.type === "tool_use");
  // USAGE, WHICH THIS CALL THREW AWAY UNTIL 2026-08-04.
  //
  // It returned `use.input` and nothing else, so the only paid step in the build
  // that was NOT metered was also the only one nobody could measure. It is
  // billed a flat SITE_BUILD_FEE, and whether that fee is right — and whether
  // the prompt cache added here is earning its 1.25x write premium or just
  // paying it — are both questions this field answers and nothing else could.
  //
  // THE SAME FOUR KINDS, in the same shape as the pages call directly below, so
  // `pageCredits` prices it without a second table. Summing them is what
  // overcharged a warm build by 35% once already.
  const u = (j && j.usage) || {};
  return {
    input: (use && use.input) || null,
    usage: {
      in: u.input_tokens || 0,
      out: u.output_tokens || 0,
      cacheRead: u.cache_read_input_tokens || 0,
      cacheWrite: u.cache_creation_input_tokens || 0,
      // WHICH COLUMN OF THE RATE TABLE THIS IS PRICED AT. Read back off the
      // request rather than off the parameter, so the model we bill for is the
      // model we sent even if the two ever stop being the same expression.
      model: req.model,
    },
  };
}


// Bytes read from a page a user linked in their brief. Generous — a marketing
// page with inlined styles is routinely several hundred KB, and `pageText`
// throws almost all of it away — but bounded, because the far end chooses how
// much to send us.
const SITE_LINK_BYTES = 1_500_000;

/**
 * Fetch one page the user pointed at, for `readLinkedPages`.
 *
 * The whole of the safety here is `safeFetch`, which is the same SSRF guard the
 * gallery importer and the outbound webhook use: it refuses loopback, RFC1918,
 * CGNAT and the cloud metadata address across every encoding of them, and
 * re-checks on each redirect hop. A URL out of a brief is exactly as
 * attacker-chosen as one out of the import box, so it gets exactly the same
 * treatment and not a second, gentler copy of it.
 *
 * Never throws, and distinguishes the three outcomes a caller can say something
 * useful about: unreachable (no status), refused (a status), and read.
 */
async function siteReadUrl(url) {
  let r;
  try {
    r = await safeFetch(url, {
      // A real browser UA, for the reason the importer needs one: a plain fetch
      // agent is walled by a large share of the sites somebody would actually
      // ask us to look at, and being walled reads as "your site is broken".
      headers: {
        "User-Agent": CHROME_UA,
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9",
      },
      // BOUNDED, because this sits on the critical path of a build the customer
      // is watching. A slow site must cost them twelve seconds, not a timeout of
      // the whole request.
      signal: AbortSignal.timeout(12000),
    });
  } catch { return { ok: false }; }
  // safeFetch answers null for a blocked host, a non-http scheme, or a redirect
  // chain that ran too long. No status, so the caller says "we couldn't reach
  // it" — which is true and does not tell a prober which hosts we refuse.
  if (!r) return { ok: false };
  if (!r.ok) return { ok: false, status: r.status };
  const contentType = ((r.headers.get("content-type") || "").split(";")[0] || "").trim().toLowerCase();
  let body = "";
  try { body = new TextDecoder().decode(await readCapped(r, SITE_LINK_BYTES)); }
  catch { return { ok: false, status: r.status }; }
  return { ok: true, status: r.status, contentType, body };
}

/**
 * Look up current facts for a brief that needs them.
 *
 * Gated by `needsWeb` on the schema designer's own output, so this call does not
 * happen on the overwhelming majority of builds — see the tool description for
 * why the gate lives there rather than in a classifier call of its own.
 *
 * Returns usage as well as facts, because a search is billed BOTH in tokens and
 * per search, and the caller has to be able to charge for it. `searches` comes
 * from the API's own `server_tool_use` count rather than from the number of
 * queries we asked for — the model decides how many it actually runs, and
 * billing on our request instead of its behaviour would be a guess.
 *
 * Never throws. Research is an enhancement to a build that can succeed without
 * it, and the lesson this codebase keeps relearning is that losing the whole
 * thing over one optional step is the more expensive failure.
 */
async function siteWebResearch(env, brief, queries) {
  const empty = { facts: "", sources: [], usage: null, searches: 0 };
  const qs = normalizeQueries(queries);
  if (!qs.length || !env.ANTHROPIC_API_KEY) return empty;

  const system = "You are researching for a website builder. The pages about to be written need real, current facts that " +
    "the brief does not supply. Run the searches you are given, then reply with a SHORT factual brief: only concrete facts " +
    "that will appear on the site — names, dates, numbers, specifications — in plain sentences. No preamble, no markdown, " +
    "no marketing language, and do not write any page copy or suggest a layout. If the searches find nothing solid, say so " +
    "in one sentence rather than filling the gap.";

  let msgs = [{
    role: "user",
    content: "SITE BRIEF\n" + String(brief || "").slice(0, 2000) +
      "\n\nSEARCH FOR\n" + qs.map((q, i) => (i + 1) + ". " + q).join("\n"),
  }];
  let facts = "";
  const sources = [];
  // RESEARCH DOES NOT FOLLOW THE BUILDER PICKER, deliberately. It is a factual
  // lookup — run these searches, report what came back — which is the step in a
  // build where the model matters least, and the server-side search tool is
  // versioned per model, so moving it is a way to break searching entirely in
  // exchange for nothing anybody would see. Named here rather than inline so the
  // rate column and the request cannot disagree.
  const RESEARCH_MODEL = "claude-sonnet-5";
  const usage = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0, searches: 0, model: RESEARCH_MODEL };

  // The server-side search loop can pause mid-run (stop_reason "pause_turn");
  // the continuation is the assistant turn resent unchanged.
  for (let round = 0; round < 4; round++) {
    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: RESEARCH_MODEL,
          max_tokens: 1200,
          system,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_QUERIES + 1 }],
          messages: msgs,
        }),
        signal: AbortSignal.timeout(120000),
      });
    } catch { break; }
    if (!r.ok) break;
    const j = await r.json().catch(() => null);
    if (!j) break;
    const u = j.usage || {};
    usage.in += u.input_tokens || 0;
    usage.out += u.output_tokens || 0;
    usage.cacheRead += u.cache_read_input_tokens || 0;
    usage.cacheWrite += u.cache_creation_input_tokens || 0;
    // THE API'S OWN COUNT of searches actually performed. A search is $0.01 and
    // is invisible in the token numbers, so without this a searching build
    // under-reports its cost by more than the tokens came to.
    usage.searches += (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
    const content = Array.isArray(j.content) ? j.content : [];
    for (const c of content) {
      if (c && c.type === "text" && typeof c.text === "string") facts += c.text;
      if (c && c.type === "web_search_tool_result" && Array.isArray(c.content)) {
        for (const s of c.content) {
          if (s && s.type === "web_search_result" && s.url) {
            sources.push({ url: String(s.url).slice(0, 300), title: String(s.title || "").slice(0, 160) });
          }
        }
      }
    }
    if (j.stop_reason === "pause_turn") { msgs = msgs.concat([{ role: "assistant", content }]); continue; }
    break;
  }

  const seen = new Set();
  const uniq = [];
  for (const s of sources) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    uniq.push(s);
    if (uniq.length >= 6) break;
  }
  // Usage is returned even when nothing came back: tokens were spent whether or
  // not the answer was useful, and reporting zero would hide a search that ran
  // and found nothing.
  return { facts: facts.trim().slice(0, 2500), sources: uniq, usage, searches: usage.searches };
}

// The pages themselves. Same tool-use shape as designSiteSchema directly above:
// the model fills in a tool whose input_schema IS the return type, so there is no
// prose to parse and no half-written file to repair out of a reply.
//
// The schema designed above is this step's INPUT, not something it may extend —
// a page can only read a table that already exists in the database, at the access
// level the database actually granted it.
//
// ONE call per build. There is no repair pass — see builder/publish-pages.mjs
// for the measurement it was removed on.
async function generateSitePages(env, brief, spec, brand, family, attachments, model, priorPages, mode, target) {
  // One definition, shared with the eval harness — see pagesRequest. Restating
  // it here would mean the harness tunes against a different request from the
  // one production runs. Held in a const so the usage below can be stamped with
  // the model that was actually sent.
  const req = pagesRequest({ brief, spec, brand, family, attachments, model, priorPages, mode, target });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(req),
    // No timeout — see designSiteSchema. This is the call it mattered most for:
    // three pages against a 24,000-token ceiling is the one that runs long.
  });
  if (!r.ok) {
    const e = new Error("anthropic " + r.status);
    e.status = r.status;
    e.detail = (await r.text().catch(() => "")).slice(0, 300);
    throw e;
  }
  const j = await r.json();
  const usage = j.usage || {};
  // CACHED TOKENS ARE REPORTED SEPARATELY AND WERE NOT BEING COUNTED. The
  // Anthropic API excludes cache hits from `input_tokens` and returns them as
  // `cache_read_input_tokens` / `cache_creation_input_tokens` — and PAGE_RULES,
  // the thing cache_control exists for, is ~18,300 tokens. So the meter saw a few
  // hundred input tokens on a call that really carried nineteen thousand, and on
  // a COLD cache the creation tokens bill at 1.25x and were invisible.
  //
  // Counted at face value rather than reweighted: a credit is 1/8000 of a dollar
  // of MODEL spend, and pretending a cache read costs a tenth would mean the
  // ledger tracks a different number from the invoice. Reweighting belongs in the
  // rate, not in the token count, and today the rate is one number.
  // THE FOUR KINDS, KEPT APART. Summing them into one `usedIn` is what made
  // pageCredits price a cache read at the fresh rate — ten times over, on the
  // largest input component — and overcharge a warm build by 35%. They are
  // priced 1x / 5x / 0.1x / 1.25x and only the caller can tell them apart.
  const used = {
    usage: {
      in: usage.input_tokens || 0,
      out: usage.output_tokens || 0,
      cacheRead: usage.cache_read_input_tokens || 0,
      cacheWrite: usage.cache_creation_input_tokens || 0,
      // The rate column, off the request that was sent. Under `auto` this call
      // is Sonnet while the designer above it is Opus, so a build's two usage
      // objects are priced from two different rows and must never be merged.
      model: req.model,
    },
  };
  // A tool_use block cut off at max_tokens carries half-written JSON, which parses
  // into a page whose last file is truncated. Treat it as a failed generation
  // rather than shipping a file that ends mid-expression.
  if (j.stop_reason === "max_tokens") return { input: null, truncated: true, ...used };
  const use = (Array.isArray(j.content) ? j.content : []).find((b) => b && b.type === "tool_use");
  // WHY THERE ARE NO PAGES, when there are none. Measured live 2026-08-04: a
  // build spent 9,810 output tokens and 22 credits, `validatePages` got null, and
  // the response could say only "the generator didn't produce a usable page" —
  // which does not distinguish a model that answered in prose from one that
  // called the tool with an empty argument. Third layer in a row where a failure
  // could not name itself; the pages are gone the moment this returns, so the
  // answer has to be captured here or not at all.
  //
  // `stop_reason` and the block TYPES only — never the text, which is
  // model-written prose about a customer's brief.
  const shape = use ? null : {
    stopReason: String(j.stop_reason || "").slice(0, 40),
    blocks: (Array.isArray(j.content) ? j.content : []).map((b) => String(b && b.type)).slice(0, 6),
  };
  return { input: (use && use.input) || null, ...(shape ? { shape } : {}), ...used };
}

// Placeholder published page. Deliberately plain: it reports what was actually
// created so a build is verifiable end to end before page generation exists.
function schemaPlaceholderPage(brand, spec) {
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tables = (spec.tables || []).map((t) => {
    const cols = (t.columns || []).map((c) => "<li><code>" + esc(typeof c === "string" ? c : c.name) + "</code></li>").join("");
    // Every access level, not "user vs everything else". A `collect` table is
    // WRITE-ONLY — calling it "shared across visitors" on the owner's fallback
    // page says the opposite of what it does, and this page is the only thing a
    // failed build leaves them.
    const says = {
      display: "anyone can read this",
      collect: "visitors submit to this; only you can read it",
      user: "each visitor sees only their own rows",
      feed: "signed-in visitors read all of it, and write their own",
      admin: "signed-in visitors read it; only an admin writes it",
    }[String(t.access || "collect").toLowerCase()] || "visitors submit to this; only you can read it";
    return "<section><h2>" + esc(t.name) + "</h2><p>" + esc(says) +
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

// Argument order is (env, slug), which is what every caller here uses.
async function siteBackendBySlug(env, slug) { return _resolveBackend(slug, env); }

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
  const g = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(slug)}&select=neon_db,uid,brief`, { headers: svcHeaders(env), signal: AbortSignal.timeout(12000) });
  if (!g.ok) throw Object.assign(new Error("site lookup failed"), { detail: g.status + " " + (await g.text().catch(() => "")).slice(0, 200) });
  const rows = await g.json();
  const row = Array.isArray(rows) && rows[0];
  if (!row) return null;
  if (!row.neon_db) return { conn: null, uid: row.uid, brief: row.brief || "" };
  // By SLUG. One Neon project per SITE since 2026-07-29 — keyed by the owner, a
  // user's second site would resolve to their FIRST site's project, which is
  // exactly the isolation the change was made to get.
  const proj = await siteNeonProject(env, slug);
  return { conn: proj ? connForDatabase(proj.neon_conn, row.neon_db) : null, uid: row.uid, brief: row.brief || "" };
}

/**
 * A site's Neon project, by slug.
 *
 * `site_project` rather than a column on `site_backends`, and that separation is
 * the whole point: `site_backends` has an own-read RLS policy, so a signed-in
 * user can read their own rows over the REST API — and `neon_conn` carries a
 * PASSWORD. This table has RLS on with NO policies, so only the service key can
 * see it, the same protection `user_site_project` has and for the same reason.
 */
async function siteNeonProject(env, slug) {
  const g = await fetch(
    `${SUPABASE_URL}/rest/v1/site_project?slug=eq.${encodeURIComponent(String(slug || "").toLowerCase())}` +
    "&select=neon_project,neon_branch,neon_role,neon_conn&limit=1",
    { headers: svcHeaders(env), signal: AbortSignal.timeout(12000) });
  // Throws rather than answering null: "Supabase is down" must not read as
  // "this site has no project", which on the write path would create another.
  if (!g.ok) throw Object.assign(new Error("site project lookup failed"), { detail: g.status + " " + (await g.text().catch(() => "")).slice(0, 200) });
  const rows = await g.json().catch(() => []);
  return (Array.isArray(rows) && rows[0]) || null;
}

// Provision (or reuse) one site's database, returning its connection string.
// The ordering and the failure paths live in site-provision.mjs, where they are
// tested; this supplies the real Neon and Supabase calls.
async function ensureSiteBackend(env, slug, uid, brief, mark) {
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
  // CLAIMS, not upserts, for the two slug-keyed tables. merge-duplicates is
  // what made the slug race silent (2026-08-13 audit): two overlapping first
  // builds of one free name both passed the pre-check, both created a Neon
  // project, and the second saveProject UPSERT overwrote the winner's
  // connection row — the winner's live site then pointed at the loser's
  // project, and the loser's project was orphaned with no teardown entry (the
  // queue trigger is BEFORE DELETE; an upsert UPDATE never fires it).
  // ignore-duplicates + return=representation makes the insert atomic on the
  // PK: a full representation means the row is ours, an empty one means
  // somebody else already holds the slug. site-provision.mjs decides what
  // losing means at each site — converge at the project, refuse at the slug.
  const claim = async (table, body) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: svcHeaders(env, { "content-type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" }),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return { ok: false, detail: (await r.text().catch(() => "")).slice(0, 300) };
    const rows = await r.json().catch(() => null);
    return { ok: true, claimed: Array.isArray(rows) && rows.length > 0 };
  };
  // A REAL BINDING, not just a property on the deps object.
  //
  // `saveAuthInfo` and `saveDataInfo` call `lookupProject(slug)` in their
  // bodies, and it existed ONLY as a key in the literal below — so the bare
  // identifier was a ReferenceError on the first line of both, on every build of
  // every site, caught by the best-effort catch around them and silent. That is
  // why `_meta` held nothing but `schema`, and why fixing `.conn` on the NEXT
  // line changed nothing: the line was never reached. Measured 2026-08-04 by
  // making build smoke read the row instead of reasoning about it.
  const lookupProject = (s2) => siteNeonProject(env, s2);
  const conn = await ensureSiteBackendPure({
    lookupSite: (s2) => siteBackendRowFresh(env, s2),
    lookupProject,
    // Where a swallowed best-effort failure goes. Without it a site can be a
    // shell and nothing anywhere says why.
    warn: (m) => console.error(m),
    // Optional. The build route passes its trace so a COLD provision (create the
    // project, poll, create the database, poll, enable auth, enable the Data
    // API) is distinguishable from a WARM one, which is a single lookup.
    mark,
    createProject: (s2) => createSiteProject(env, s2),
    // Identity is Neon's now. Idempotent, and run on the reuse path too —
    // see site-provision.mjs for why enabling only at creation is a trap.
    enableAuth: (proj, dbName) => enableNeonAuth(env, proj.neon_project, proj.neon_branch, dbName),
    // Stored in the SITE's own _meta, not in Supabase: it is per-site, it is only
    // ever read on a request that already holds that connection, and it goes when
    // the site does.
    saveAuthInfo: async (dbName, info) => {
      // `.neon_conn`, NOT `.conn`. `siteNeonProject` returns the raw Supabase row
      // and there is no `conn` column on it, so this read `undefined`,
      // `connForDatabase` threw on `new URL(undefined)`, and the catch around
      // this call swallowed it — silently, on every build, since the day it was
      // written. Neither `auth_info` nor `data_api` has ever been written to any
      // site's `_meta`, which is every generated site answering 501 no_backend
      // on every read, every form and every sign-in. Line ~3080 gets it right.
      const proj = await lookupProject(slug);
      if (!proj || !proj.neon_conn) throw new Error("no project connection recorded for " + slug);
      const conn = connForDatabase(proj.neon_conn, dbName);
      await sqlQuery(conn, "CREATE TABLE IF NOT EXISTS _meta (k TEXT PRIMARY KEY, v TEXT)");
      await sqlQuery(conn, "INSERT INTO _meta (k,v) VALUES ('auth_info', ?) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v",
        [JSON.stringify(info).slice(0, 20000)]);
    },
    // THE DATA API, AND IT WAS THE HALF THAT WAS NEVER PLUGGED IN. `enableDataApi`
    // was written, documented "FATAL, like enableNeonAuth", and had ZERO callers;
    // site-provision.mjs was already shaped for it and guards with
    // `if (deps.enableData)`, so a missing dep was a SILENT skip — a green build
    // every time. The consequence ran all the way to the visitor: nothing wrote
    // `_meta.data_api`, so `siteDataBase` resolved null and every read and every
    // form on every generated site answered 501 no_backend. With the Worker's own
    // row routes deleted this IS the site's backend, so the site was a shell.
    //
    // Eighth instance in this repo of built-tested-on-disk-and-reachable-by-
    // nothing, and the first one where the guard existed and the dep did not.
    enableData: (proj, dbName) => enableDataApi(env, proj.neon_project, proj.neon_branch, dbName),
    // Same store and same reasoning as the auth endpoint: per-site, read only on
    // a request that already holds that connection, and gone when the site is.
    // The KEY is what `siteDataBase` reads — `siteServiceBase(db, "data_api")` —
    // so it is spelled once here and once there and a test holds them together.
    saveDataInfo: async (dbName, info) => {
      // `.neon_conn`, NOT `.conn`. `siteNeonProject` returns the raw Supabase row
      // and there is no `conn` column on it, so this read `undefined`,
      // `connForDatabase` threw on `new URL(undefined)`, and the catch around
      // this call swallowed it — silently, on every build, since the day it was
      // written. Neither `auth_info` nor `data_api` has ever been written to any
      // site's `_meta`, which is every generated site answering 501 no_backend
      // on every read, every form and every sign-in. Line ~3080 gets it right.
      const proj = await lookupProject(slug);
      if (!proj || !proj.neon_conn) throw new Error("no project connection recorded for " + slug);
      const conn = connForDatabase(proj.neon_conn, dbName);
      await sqlQuery(conn, "CREATE TABLE IF NOT EXISTS _meta (k TEXT PRIMARY KEY, v TEXT)");
      await sqlQuery(conn, "INSERT INTO _meta (k,v) VALUES ('data_api', ?) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v",
        [JSON.stringify(info).slice(0, 20000)]);
    },
    dropProject: async (id) => {
      console.error("dropping unrecorded neon project:", id);
      return dropUserProject(env, id);
    },
    // CLAIMS, not upserts. Both tables are keyed by slug, and merge-duplicates
    // is what made the slug race silent (2026-08-13 audit): two overlapping
    // first builds of one free name both passed the pre-check, both created a
    // Neon project, and the second saveProject UPSERT overwrote the winner's
    // connection row — so the winner's live site pointed at the loser's
    // project, and the loser's project was orphaned with no teardown entry
    // (the queue trigger is BEFORE DELETE; an upsert UPDATE never fires it).
    // ignore-duplicates + return=representation makes the insert atomic on the
    // PK: a full representation means the row is ours, an empty one means
    // somebody else already holds the slug — and site-provision.mjs decides
    // what losing means at each of the two sites.
    saveProject: (s2, u, proj) => claim("site_project", { slug: s2, uid: u, ...proj }),
    createDatabase: (proj, s2) => createSiteDatabase(env, proj.neon_project, proj.neon_branch, proj.neon_role, s2),
    // The brief rides along on the row that claims the slug. ensureSiteBackend
    // returns early when the slug already has a database, so saveBackend runs
    // exactly once per site — which is what keeps a revise's one-line
    // instruction from overwriting the brief the site was built from.
    saveBackend: (s2, u, db) => claim("site_backends", { slug: s2, uid: u, neon_db: db, brief: String(brief || "").slice(0, 4000) || null }),
    connFor: connForDatabase,
    dbNameFor: dbNameForSite,
    // WHICH SERVICE ENDPOINTS THE SITE LACKS, asked through the SAME reader
    // the proxy uses (`siteServiceBase`) — the heal and the 501 must not be
    // two opinions about what "recorded" means. Deliberately NOT the memoized
    // caches (`siteAuthBase`/`siteDataBase`): those can hold a stale null for
    // ten minutes, and the write path deciding whether to heal must read the
    // truth. A read that throws is caught in the module and heals nothing —
    // a database blip must not read as "missing".
    missingServices: async (conn2) => {
      const out = [];
      if (!(await siteServiceBase(conn2, "auth_info"))) out.push("auth");
      if (!(await siteServiceBase(conn2, "data_api"))) out.push("data");
      return out;
    },
  }, { slug, uid });
  // Publish the route so the first visitor read never touches Supabase. Purely
  // an optimisation — the lookup backfills on a miss anyway — so a failure here
  // must not fail a build that has otherwise succeeded.
  await saveRoute(routeDeps(env), slug, conn);
  mark?.("route");
  return conn;
}



// The public data API's throttle. Separate table from the auth one so a site
// being hammered with reads cannot evict the counters holding a brute force
// back.
const _dataLimiter = makeLimiter({ windowMs: WINDOW_MS, max: 20000 });
// Tighter than a form post: an upload costs storage, not a row.
const VISITOR_UPLOADS_PER_MIN = 5;
// Sign-in attempts per source per site. Higher than the upload cap because a real
// person legitimately retries a password, and low enough that credential stuffing
// through our proxy is not free. Better Auth throttles on its own side too; this
// is about not being the open front door to it.
const AUTH_PROXY_PER_MIN = 20;
// Checkouts per source per site. A real customer starts one, maybe two if they
// go back and change the basket; nobody legitimately starts ten a minute. Each
// one writes an order row AND calls Stripe on the owner's account, so an
// unlimited version fills their orders list with pending rows and burns their
// API rate limit — an attack on the shop, using their own credentials.
const CHECKOUT_PER_MIN = 6;
// Data reads per source per site. A page legitimately renders several lists, so
// this is generous — the budget it protects is Neon compute, and RLS is what
// protects the rows.
const DATA_PROXY_PER_MIN = 300;

// The signing key for claim tokens, from the site's own per-site secret in
// `_meta`. It was shared with session tokens until 2026-07-30; sessions are Neon
// Auth's now, so a claim is the only kind left and this is its only reader. The
// derivation is deliberately unchanged — claim links sit in confirmation emails
// for ninety days and altering it would silently void every one already sent.












/**
 * Where this site's Neon Auth server lives.
 *
 * Recorded at build time from the provisioning response. The field NAME in that
 * response is the one thing here not measured against a real project, so this
 * tries the plausible names and then falls back to the first https URL in the
 * body — a provisioning answer for an auth service contains exactly one, and a
 * heuristic that finds it is better than a hard-coded key that silently finds
 * nothing. Tighten it once a real build has logged the shape.
 */
const _siteAuthBase = makeCache({ ttlMs: 600_000, max: 500 });
const siteAuthBase = memoize(_siteAuthBase, async (db) => siteServiceBase(db, "auth_info"));
/**
 * A short-lived anonymous token for the site's Data API.
 *
 * Neon Auth mints it (`GET <auth base>/token/anonymous`), so there is no signing
 * key here and nothing to rotate. Cached well inside its lifetime: these are
 * deliberately short-lived, and a stale one is a 401 on a visitor's first read.
 *
 * NEVER CACHES A FAILURE — `makeCache.set` refuses null — so a site whose auth
 * server was briefly unreachable is slow rather than broken for the whole TTL.
 * The reason is logged, because a missing token is invisible from outside: the
 * request simply goes out bare and Neon answers 400, which is the failure this
 * whole function exists to stop.
 */
const _siteAnonToken = makeCache({ ttlMs: 120_000, max: 500 });
const siteAnonToken = memoize(_siteAnonToken, async (db) => {
  const base = await siteAuthBase(db);
  if (!base) return null;
  const r = await fetch(base + "/token/anonymous", {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  const text = await r.text().catch(() => "");
  if (!r.ok) {
    console.error("anon token: " + r.status + " " + text.slice(0, 200));
    return null;
  }
  let j = null;
  try { j = JSON.parse(text); } catch { /* reported below */ }
  // The field name is the one thing here not measured against a real project, so
  // the plausible names are tried and then any JWT-shaped string in the body.
  const tok = j && (j.token || j.access_token || j.accessToken || j.jwt);
  if (typeof tok === "string" && tok) return tok;
  const found = /\b(ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/.exec(text);
  if (found) return found[1];
  console.error("anon token: no token in the response: " + text.slice(0, 200));
  return null;
});

const _siteDataBase = makeCache({ ttlMs: 600_000, max: 500 });
const siteDataBase = memoize(_siteDataBase, async (db) => siteServiceBase(db, "data_api"));

async function siteServiceBase(db, key) {
  const rows = await sqlQuery(db, "SELECT v FROM _meta WHERE k=?", [key]);
  if (!rows[0] || !rows[0].v) return null;
  let info; try { info = JSON.parse(rows[0].v); } catch { return null; }
  const named = info && (info.auth_url || info.url || info.endpoint || info.base_url ||
    (info.auth && (info.auth.url || info.auth.endpoint)));
  const pick = (o, depth = 0) => {
    if (typeof o === "string") return /^https:\/\//.test(o) ? o : null;
    if (!o || typeof o !== "object" || depth > 3) return null;
    for (const v of Object.values(o)) { const hit = pick(v, depth + 1); if (hit) return hit; }
    return null;
  };
  const url = typeof named === "string" && /^https:\/\//.test(named) ? named : pick(info);
  return url ? String(url).replace(/\/+$/, "") : null;
}

/**
 * The published site's sign-in, PROXIED through this Worker rather than called
 * directly from the page.
 *
 * Three things fall out of proxying, and each is why it is done this way:
 *
 *   - the page never learns the auth endpoint or any key, so nothing has to be
 *     decided about what is safe to publish into a static bundle;
 *   - it is SAME-ORIGIN. A published site is served from gofarther.dev, so a direct
 *     call would need CORS on Neon's side and a cross-site cookie in the browser,
 *     which is the configuration most likely to work in development and fail in
 *     Safari;
 *   - the URL the client uses is unchanged (`/api/db/<slug>/auth/...`), so the
 *     generated pages do not have to know that identity moved at all.
 *
 * The response is passed through as-is. Whatever Better Auth answers is what the
 * client sees, including its errors — a proxy that reinterprets them is a second
 * place where "wrong password" has to be spelled, and the two drift.
 */
/**
 * A visitor paying by card, with the SITE OWNER'S own Stripe key.
 *
 * The order of operations is the security model, so it is worth stating:
 *
 *   1. the table must DECLARE `payment` — otherwise this endpoint is a way to
 *      insert into any collect table while bypassing its rate limit
 *   2. the basket is reduced to {id, qty} and NOTHING else the client sent
 *   3. the total is computed from the site's OWN rows
 *   4. the row is written with that total, at status `pending`
 *   5. only then is Stripe called
 *
 * The row exists BEFORE the customer reaches Stripe on purpose. Written on the
 * webhook instead, a customer who paid while the callback was lost would have
 * no order at all and the owner would hold money with nothing to ship against.
 * A pending row that never completes is the recoverable direction.
 */
async function handleCheckout({ env, conn, slug, body, origin, schema }) {
  const tables = (schema && Array.isArray(schema.tables) ? schema.tables : []);
  const table = tables.find((t) => t && String(t.name).toLowerCase() === String(body.table || "").toLowerCase());
  // 404 rather than 400 for a table that is not payable: whether a given table
  // takes card payments is not something this endpoint should confirm to
  // somebody enumerating names.
  const payment = table && normalizePayment(table);
  if (!table || !payment) return Response.json({ error: "that isn't something you can pay for here" }, { status: 404 });

  const cart = parseCart(body);
  if (!cart.ok) return Response.json({ error: cart.error }, { status: 400 });

  const priced = await priceCart({
    readRows: async (from, ids) => {
      // `from` and the two column names came through normalizePayment's
      // identifier check, and `from` is additionally required to be a table
      // this site DECLARED — a payment block naming `_secrets` would otherwise
      // read the vault. The ids are bound parameters.
      if (!tables.some((t) => String(t.name).toLowerCase() === from)) {
        throw Object.assign(new Error("payment.from names no declared table"), { detail: from });
      }
      const ph = ids.map(() => "?").join(",");
      return sqlQuery(conn, `SELECT id, ${sqlIdent(payment.name)}, ${sqlIdent(payment.price)} FROM ${sqlIdent(from)} WHERE id IN (${ph})`, ids);
    },
  }, { payment, items: cart.items });
  if (!priced.ok) return Response.json({ error: priced.error }, { status: priced.status || 409 });

  // The owner's key. Absent is the ordinary case for a site whose owner has not
  // set payments up yet, and it deserves a plain answer rather than a 500.
  let key = null;
  try {
    key = await readSecret({ get: async (_s, name) => {
      const rows = await sqlQuery(conn, "SELECT cipher FROM _secrets WHERE name=?", [name]);
      return (rows && rows[0] && rows[0].cipher) || null;
    } }, env, { slug, name: "STRIPE_SECRET_KEY" });
  } catch (e) {
    // A key that will not decrypt is NOT the same as no key, and must not read
    // as one: calling Stripe with an empty key tells a customer with a good
    // card that their payment failed.
    console.error("checkout key:", slug, e && e.message);
    return Response.json({ error: "payments are not available on this site right now" }, { status: 503 });
  }
  if (!key) return Response.json({ error: "this shop hasn't finished setting up payments yet" }, { status: 503 });

  // The customer's own fields — name, address, notes — filtered to the columns
  // this table DECLARED, the way the data API does. The payment columns are not
  // in that list (the schema engine strips them), so a body claiming
  // payment_status cannot reach the row.
  const declared = new Set((table.columns || []).map((c) => String(typeof c === "string" ? c : c.name).toLowerCase()));
  const fields = {};
  for (const [k, v] of Object.entries(body.fields || {})) {
    const low = String(k).toLowerCase();
    if (declared.has(low) && v != null && typeof v !== "object") fields[low] = String(v).slice(0, 2000);
  }

  const cols = ["payment_status", "amount_total", "currency", ...Object.keys(fields)];
  const vals = ["pending", priced.total, priced.currency, ...Object.values(fields)];
  const ins = await sqlQuery(
    conn,
    `INSERT INTO ${sqlIdent(table.name)} (${cols.map(sqlIdent).join(",")}) VALUES (${cols.map(() => "?").join(",")}) RETURNING id`,
    vals,
  );
  const orderId = ins && ins[0] && ins[0].id;
  if (!orderId) throw new Error("order row was not created");

  // Both URLs are built HERE from the site's own origin and never taken from
  // the body. A caller-supplied success_url is an open redirect on our domain,
  // and the obvious use of one is a payment page that returns the customer to
  // somewhere that looks like the shop and asks for the card again.
  //
  // WHERE THE SITE IS MOUNTED ON THE ORIGIN THE CUSTOMER CAME FROM, which is not
  // always `/s/<slug>/`. On the site zone and on a custom domain the site IS the
  // root, so the old line built `<slug>.gofarther.app/s/<slug>/` — a path that is
  // then prefixed again by the hostname rewrite and 404s. Somebody would have
  // paid and been returned to a not-found page, which is the worst place on the
  // platform for this bug to be.
  //
  // A CUSTOM DOMAIN RETURNS TO ITSELF. An owner who paid for their own domain
  // must not have a paying customer bounced onto ours at the one moment they are
  // deciding whether the shop is real.
  const base = isAppHostname(new URL(origin).hostname)
    ? siteUrlFor(slug, origin)
    : origin.replace(/\/+$/, "") + "/";
  const args = checkoutSessionArgs({
    slug, table: table.name, orderId,
    lines: priced.lines, currency: priced.currency,
    successUrl: `${base}?paid=${orderId}`,
    cancelUrl: `${base}?cancelled=${orderId}`,
    email: fields.email || fields.customer_email || null,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // Stripe replays a retried request rather than charging twice. Keyed on
      // the order row, which is unique per attempt.
      "Idempotency-Key": `isibi-${slug}-${table.name}-${orderId}`,
    },
    body: formEncode(args),
    signal: AbortSignal.timeout(15000),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.url) {
    // The owner's problem, not the customer's: log what Stripe said, tell the
    // customer something true and useless to an attacker. The order row stays,
    // pending, so the owner can see the attempt.
    console.error("stripe checkout:", slug, res.status, out && out.error && out.error.message);
    return Response.json({ error: "we couldn't start that payment — please try again" }, { status: 502 });
  }
  // Best-effort: the customer is already on their way to Stripe and must not be
  // blocked by our bookkeeping. Without it the webhook still finds the row, by
  // the id in client_reference_id.
  try { await sqlExec(conn, `UPDATE ${sqlIdent(table.name)} SET payment_ref=? WHERE id=?`, [String(out.id || ""), orderId]); }
  catch (e) { console.error("checkout ref:", slug, e && e.message); }

  return Response.json({ ok: true, url: out.url, orderId });
}

async function proxySiteService(env, request, url, slug, path, which, ctx) {
  const db = await siteBackendBySlug(env, slug);
  if (!db) return Response.json({ error: "no such site" }, { status: 404 });
  let base;
  try { base = which === "data" ? await siteDataBase(db) : await siteAuthBase(db); }
  catch { return Response.json({ error: "couldn't reach that just now" }, { status: 503 }); }
  // Not configured is 501 and not 500: the site was built before its auth
  // endpoint was recorded, which a rebuild fixes, and saying so is more use than
  // a generic failure. "A rebuild fixes it" was FALSE until 2026-08-14 — the
  // reuse path called zero deps, so no rebuild ever re-ran the enables or the
  // saves — and is true now because ensureSiteBackend heals missing endpoints
  // on that path, asking this same reader (`siteServiceBase`) whether one is
  // missing.
  if (!base) return Response.json({ error: "this site's backend is not set up yet", code: "no_backend" }, { status: 501 });

  const target = base + "/" + path + (url.search || "");
  const headers = new Headers();
  // Only what the auth server needs. Forwarding the whole header set would carry
  // cookies for gofarther.dev into a third party.
  // `prefer` carries PostgREST's return=representation, which is how an insert
  // answers with the row it created rather than an empty body.
  for (const h of ["content-type", "authorization", "accept", "prefer", "cookie"]) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  // ORIGIN, SET RATHER THAN FORWARDED — and without it NO GENERATED SITE COULD
  // SIGN ANYBODY UP. Measured live 2026-08-04, first run of `member smoke`:
  // `400 MISSING_ORIGIN — "Origin header is required when callbackURL is not an
  // absolute URL"`, on every auth call that is not a plain GET.
  //
  // The header was dropped by the allow-list above, whose reasoning is sound and
  // is about COOKIES: forwarding everything would carry gofarther.dev's cookies to a
  // third party. `Origin` is not a cookie, it is the caller's identity, and the
  // caller here really is this Worker.
  //
  // SET, not forwarded, on purpose. Forwarding trusts whatever the client sent —
  // and this endpoint is public, so that is an attacker-chosen value reaching
  // Better Auth's trusted-origins check. A caller cannot influence this.
  //
  // AND IT IS THE UPSTREAM'S OWN ORIGIN, NOT OURS — which is the fix for a live
  // break, measured 2026-08-11. It used to be `url.origin` (i.e.
  // `https://gofarther.dev`), and Better Auth answered every sign-up and every
  // sign-in with `403 INVALID_ORIGIN`: 33/2 passing the day before, 21/12 after,
  // with nothing in our own diff touching this path. The whole member tier —
  // `user`, `feed`, `admin` — dead on every published site.
  //
  // Better Auth's documented default is that it "trusts the base URL of your app
  // (i.e. baseURL)" and NOTHING else, and Neon's trusted-domain list is a CONSOLE
  // setting per project. A platform that provisions a project per site can never
  // tick that box, so depending on it was depending on a default we do not own —
  // and one that evidently moved. The upstream's own origin is trusted by
  // construction, needs no configuration, and cannot drift.
  //
  // The CSRF protection this check exists for is a browser concept and buys
  // nothing here: the caller is this Worker, server to server, and the value is
  // still ours to set rather than the client's to choose. The real gate on this
  // endpoint is the rate limiter above it.
  let upstreamOrigin = url.origin;
  try { upstreamOrigin = new URL(base).origin; } catch { /* keep ours; a base we cannot parse is one we cannot improve on */ }
  headers.set("origin", upstreamOrigin);
  // A VISITOR HAS NO TOKEN, AND NEON WILL NOT SERVE A REQUEST WITHOUT ONE.
  //
  // Measured 2026-08-04: every public read answered
  // `400 missing authentication credentials: required authorization bearer token
  // in JWT format`. Neon's Data API always runs a request as a Postgres role
  // chosen from the JWT, and the unauthenticated role — `anonymous` — "still
  // uses a JWT, but no user sign-in is required". There is no no-header path.
  //
  // Nothing is signed here: Neon Auth issues the token, so this needs no key and
  // no rotation. It is fetched only for the DATA proxy and only when the caller
  // sent nothing, so a signed-in member's own token is never replaced.
  if (which === "data" && !headers.has("authorization")) {
    const anon = await siteAnonToken(db).catch(() => null);
    if (anon) headers.set("authorization", "Bearer " + anon);
  }
  // Read once and keep it: the notify below needs the row that was submitted,
  // and a Request body can only be consumed a single time.
  let sent = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();

  // KEEPING BOTS OUT, BEFORE THE ROW EXISTS.
  //
  // Verified after the insert is a spam filter that files the spam first, so
  // this sits ahead of the upstream write and can refuse it outright. It is the
  // only thing on this path that can — everything else here (notify, confirm,
  // webhook) runs after the row is safe.
  if (which === "data" && request.method === "POST") {
    const gate = await turnstileGate(env, request, { slug, db, path, sent });
    if (gate.refused) {
      // `message`, not `error`: that is the field `rows.ts` reads to show a
      // visitor what went wrong, so a refusal says something rather than
      // rendering "request failed (403)". The `code` is ours and unknown to
      // `humanPgError`, which falls through to the message by design.
      return Response.json({ message: gate.refused, code: "turnstile" }, { status: 403 });
    }
    if (gate.sent !== undefined) sent = gate.sent;
  }
  try {
    const r = await fetch(target, {
      method: request.method,
      headers,
      body: sent,
      // A redirect is followed here rather than handed to the page: the client is
      // an XHR and cannot act on a 302 from a cross-origin hop.
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    const body = await r.text();

    // TELL THE OWNER A BOOKING ARRIVED.
    //
    // `notifyOwnerOfSubmission` lost its trigger point when `site-data.mjs` was
    // deleted on 2026-07-30 and had ZERO callers after it — so a barber shop took
    // an appointment and the only way to find out was to log into Go Farther and look.
    //
    // The note left behind said this needed a Postgres trigger writing to a queue
    // table plus the 2-minute cron, "because there is no `http` extension to call
    // out from Neon". That was written on the assumption the Worker had left the
    // write path. It has not: THIS PROXY IS THE WRITE PATH — every insert a
    // published site makes comes through here. So the hook is one branch, with no
    // trigger, no queue table and no cron.
    //
    // Fire-and-forget under waitUntil, and it can only ever no-op: the row is
    // already in Postgres and a broken mailer must not look like a broken form.
    // `shouldNotify` decides — POST to a `collect` table and nothing else — and
    // the cooldown is claimed in the database, so many isolates send one email.
    if (which === "data" && request.method === "POST" && r.status >= 200 && r.status < 300) {
      try {
        const table = String(path).split("/")[0].toLowerCase();
        const spec = await loadSiteSchema(db);
        const def = (spec && spec.tables || []).find((t) => String(t.name).toLowerCase() === table);
        if (def) {
          // The response when the caller asked for the row back, else what they
          // sent. Either is the submission; the request body is the reliable one.
          let row = null;
          try { const j = JSON.parse(body); row = Array.isArray(j) ? j[0] : j; } catch { /* not json */ }
          if (!row) { try { row = JSON.parse(sent || "null"); } catch { row = null; } }
          // `db` travels with it now: the notification goes out on the SITE'S own
          // mail key, read from the site's own vault, so it needs the same
          // connection the confirmation one line below already takes.
          notifyOwnerOfSubmission(env, ctx, { slug, db, table, access: def.access, method: "POST", row: row || {} });
          // And the other direction: confirm to the PERSON WHO SUBMITTED, on the
          // owner's own provider key. Same hook, one branch over — the Worker is
          // already on this path, which is why this can fire on the booking
          // rather than up to two minutes later on a cron.
          confirmSubmitter(env, ctx, { slug, db, def, row: row || {} });
          // …and by text, if the site declared one. Independent of the mail
          // above: a site may declare either or both, and one provider being
          // misconfigured must not silently take the other with it.
          smsSubmitter(env, ctx, { slug, db, def, row: row || {} });
          // And outward, if the site declared it. Same branch again: the row
          // exists, the visitor has their answer, and anything else that wants
          // to know is somebody else's server.
        }
      } catch (e) { console.error("notify hook:", slug, e && e.message); }
    }

    // …AND OUTWARD, ON EVERY ACTION THE TABLE DECLARED — not only inserts.
    //
    // A SEPARATE BLOCK, deliberately. The notification above is POST-to-`collect`
    // by design: it means "a stranger filled in your form". A webhook is not that
    // — the schema has always let a table declare `created`, `updated` and
    // `deleted`, and the first cut of this emitted `created` and nothing else. So
    // a site declaring `webhooks: true` got two thirds of nothing, silently, on a
    // flag it was allowed to set. That is the same declared-and-dead shape this
    // file documents over and over, and it was reintroduced here within hours of
    // being written down twice.
    //
    // On PATCH the row is the representation the caller asked for, or what they
    // sent. On DELETE there is no row at all — PostgREST identifies it in the
    // QUERY STRING — so the filter is what goes on the wire, and it is sent as
    // `filter` rather than dressed up as `data`: a receiver must be able to tell
    // "this row, with these values" from "whatever matched this".
    if (which === "data" && r.status >= 200 && r.status < 300) {
      const action = request.method === "POST" ? "created"
        : request.method === "PATCH" || request.method === "PUT" ? "updated"
        : request.method === "DELETE" ? "deleted" : null;
      if (action) {
        try {
          const table = String(path).split("/")[0].toLowerCase();
          const spec = await loadSiteSchema(db);
          const def = (spec && spec.tables || []).find((t) => String(t.name).toLowerCase() === table);
          if (def) {
            let row = null;
            if (action === "deleted") {
              row = { filter: String(url.search || "").replace(/^\?/, "").slice(0, 500) };
            } else {
              try { const j = JSON.parse(body); row = Array.isArray(j) ? j[0] : j; } catch { /* not json */ }
              if (!row) { try { row = JSON.parse(sent || "null"); } catch { row = null; } }
            }
            emitWebhook(env, ctx, { slug, db, def, table, action, row: row || {} });
          }
        } catch (e) { console.error("webhook hook:", slug, e && e.message); }
      }
    }

    return new Response(body, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") || "application/json",
        // PostgREST reports the total row count here when asked for it, and a
        // paginated list is useless without it.
        ...(r.headers.get("content-range") ? { "content-range": r.headers.get("content-range") } : {}),
        // THE TWO AUTH HEADERS, WITHOUT WHICH MEMBER ACCOUNTS CANNOT WORK AT ALL.
        // Both are answers, not cookies, and both were being dropped here — so a
        // published page could sign somebody in and then had no way to act as
        // them. Measured live 2026-08-04 and confirmed against both vendors'
        // documentation rather than guessed:
        //
        //   `set-auth-token` — Better Auth's bearer plugin: "After a successful
        //   sign-in, you'll receive a session token in the response headers."
        //   THIS, not the body's `token`, is what `get-session` accepts. Sending
        //   the body value got `200` with a null session — a signed-in visitor
        //   who reads as signed out, on every generated site.
        //
        //   `set-auth-jwt` — Neon's Data API: "Call GET /get-session and copy the
        //   JWT from the Set-Auth-Jwt response header." A Better Auth session
        //   token is NOT a JWT, and the Data API answers `400 not a valid JWT
        //   encoding` — so every `user`, `feed` and `admin` read and write failed.
        //
        // The request-side allow-list above is about protecting gofarther.dev's
        // cookies. These are the auth server's own answers to its own caller, and
        // withholding them just breaks the caller.
        // WHAT THE AUTH SERVER ACTUALLY SENT, names only, and only when asked.
        //
        // Two fixes were built on documentation and both were wrong: the JWT is
        // not an endpoint, and `set-auth-token` never arrives — so Better Auth's
        // bearer plugin is not on in Neon's managed deployment. The client-side
        // diagnostic could only show OUR response, which is rebuilt here, so it
        // could not tell "the server did not send it" from "we dropped it".
        //
        // Gated on a request header so a public endpoint's normal response is
        // unchanged, and NAMES only — a session cookie and a JWT are both
        // credentials, and this reaches a public CI log.
        ...(request.headers.get("x-isibi-debug") === "headers"
          ? { "x-isibi-upstream": [...r.headers.keys()].join(",").slice(0, 500) } : {}),
        // THE SESSION COOKIE, RESCOPED — and without it member accounts cannot
        // work at all. Measured 2026-08-04 by asking the auth server what it
        // sends: SIGN-IN answers with `set-cookie` and nothing else, so Neon's
        // managed Better Auth is COOKIE-based; the bearer plugin is off, which
        // is why `set-auth-token` never appeared and two fixes built on it were
        // wrong. With the cookie dropped here the session died at birth, so
        // `get-session` answered `200 null` and there was never a JWT to hand
        // the Data API.
        //
        // TWO REWRITES, and the second is a security matter, not tidiness:
        //
        //   `Domain` is stripped, or the browser refuses a cookie scoped to the
        //   auth server's host when it arrives from gofarther.dev.
        //
        //   `Path` is pinned to this site's own prefix. Every published site is
        //   served from the SAME origin, so a cookie at `Path=/` would be sent
        //   to every other site on gofarther.dev — one barber shop's customer session
        //   travelling to a stranger's site. Scoped here it reaches this slug's
        //   auth and data calls and nothing else.
        //
        // HttpOnly / Secure / SameSite are left exactly as the auth server set
        // them: those are its decisions about its own credential.
        ...(rescopeCookie(r.headers.get("set-cookie"), "/api/db/" + slug + "/")
          ? { "set-cookie": rescopeCookie(r.headers.get("set-cookie"), "/api/db/" + slug + "/") } : {}),
        ...(r.headers.get("set-auth-token") ? { "set-auth-token": r.headers.get("set-auth-token") } : {}),
        ...(r.headers.get("set-auth-jwt") ? { "set-auth-jwt": r.headers.get("set-auth-jwt") } : {}),
      },
    });
  } catch (e) {
    console.error("site " + which + " proxy failed:", slug, path, e && e.message);
    return Response.json({ error: "couldn't reach that just now" }, { status: 503 });
  }
}










// Everything stored under a site's upload prefix, with WHO put it there.
//
// `customMetadata` has to be asked for explicitly on a list — without `include`
// R2 returns only key and size, and every visitor upload would look like one of
// the owner's, which is exactly the distinction the visitor allowance is
// counted on.
async function siteUploadList(env, slug) {
  const out = [];
  let cursor;
  for (;;) {
    const page = await env.SITES_BUCKET.list({ prefix: "uploads/" + slug + "/", cursor, include: ["customMetadata"] });
    for (const o of (page.objects || [])) {
      out.push({ key: o.key, size: o.size, visitor: !!(o.customMetadata && o.customMetadata.visitor) });
    }
    // Same termination rule as deleteSitePrefix: a truncated page with no
    // cursor would otherwise loop forever.
    if (!page.truncated || !page.cursor) return out;
    cursor = page.cursor;
  }
}

// Tell the owner a booking arrived. Detached — the submission already succeeded.
//
// The cooldown is claimed in the DATABASE, not in an isolate: Cloudflare runs
// many isolates per colo, and a per-isolate memory would let a hammered form
// send one email from each of them. This is a single conditional UPDATE, so
// exactly one caller wins a window and everyone else in it does nothing.
async function claimNotify(env, slug) {
  const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const q = `slug=eq.${encodeURIComponent(slug)}&notify=is.true&or=(notified_at.is.null,notified_at.lt.${cutoff})`;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?${q}&select=uid,notified_at`, {
    method: "PATCH",
    headers: svcHeaders(env, { "content-type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify({ notified_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error("claim " + r.status);
  const rows = await r.json().catch(() => []);
  const row = Array.isArray(rows) && rows[0];
  // No row means either notifications are off or another isolate got there
  // first. Both are "do nothing", and neither is an error.
  return row ? { ok: true, owner_uid: row.uid } : { ok: false };
}

// The Go Farther account that owns the site. auth.users is not reachable through
// PostgREST, so this is the GoTrue admin endpoint with the service key.
async function ownerEmail(env, uid) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(uid)}`, {
    headers: svcHeaders(env),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error("owner lookup " + r.status);
  const u = await r.json().catch(() => ({}));
  return (u && u.email) || null;
}

/**
 * Send one email from the Worker, through Cloudflare Email Service.
 *
 * The BINDING, not the REST API — so there is no token to mint, keep in GitHub
 * Actions, upload each deploy, or rotate. `env.EMAIL` is undefined until Email
 * Sending is enabled on the account and gofarther.dev is a verified sending domain, so
 * this reports that rather than throwing an unhelpful TypeError at a call site
 * that only wanted to send a notification.
 *
 * `text` is sent alongside `html` deliberately: a message with no plain-text part
 * scores worse with spam filters, and a booking notification landing in junk is
 * the same as not sending it.
 */
async function sendMail(env, { to, subject, html, text }) {
  if (!env.EMAIL) throw new Error("mail not configured: no EMAIL binding");
  return env.EMAIL.send({
    from: env.EMAIL_FROM || "Go Farther <login@gofarther.dev>",
    to, subject, html,
    text: text || String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000),
  });
}

// Email the submitter their confirmation, using the SITE OWNER'S provider key
// out of that site's own vault. Fire-and-forget under `waitUntil`, exactly like
// the owner notification beside it: the booking already succeeded, and a broken
// mailer must never be indistinguishable from a broken form.
//
// `recentlySent` is per-isolate and SAID to be best-effort — the real control on
// this path is the write rate limit, since reaching this code at all costs an
// insert into the owner's own table, which they can see.
const confirmSeen = new Map();
// The same, for text messages, and deliberately a SEPARATE map. Both are keyed
// by recipient, and an address and a phone number are different recipients even
// for the same person — shared, an emailed confirmation would suppress the text
// that was the whole reason for declaring both.
const smsSeen = new Map();
// The site's webhook configuration, decrypted, cached ~60s per isolate.
//
// WHY THIS EXISTS AT ALL. Every emitting insert used to cost TWO sequential
// Postgres round trips plus two key derivations and two AES-GCM decrypts, on the
// write path, per event — and per-table routing would have made that four. That
// is the wrong direction for the one feature whose cost scales with a site's
// traffic rather than with its size.
//
// ONE query for the whole set rather than one per name, which is also what makes
// caching possible: per-name reads cannot be memoized as a unit, and the routing
// fallback needs to see which names exist before it can choose between them.
//
// The staleness is REAL and bounded: an owner who repoints their webhook waits up
// to a minute. That is the same trade `loadSiteSchema` already makes at 15s, and
// the cheaper direction — a booking delivered to the old destination for one
// minute is recoverable, while a round trip per booking forever is not.
// 15s, MATCHING `loadSiteSchema`, and the reason is the one that file already
// gives: invalidation here is ISOLATE-LOCAL, so every other isolate heals only
// by expiry, and the TTL is therefore the real worst case for a configuration
// change — not the explicit delete, which only helps the isolate that happened
// to serve the write.
//
// Measured: at 60s a run repointed the destination and the next booking landed
// on a different isolate, which served the previous URL and reported it refused.
// An owner changing their webhook hits exactly that, and "I changed it and it
// still goes to the old place" is the kind of thing that gets reported as data
// loss rather than as staleness.
//
// The cost of the shorter window is one extra query per site per 15s under
// sustained traffic, which is nothing against the four round trips per event
// this cache exists to remove.
const webhookCfg = makeCache({ ttlMs: 15_000, max: 500 });
// SLUG FIRST, and that ordering is load-bearing rather than style. `memoize`
// keys on the FIRST argument, so `(env, db, slug)` would key every site on the
// same `env` object and serve one site's destination and signing secret to every
// other one. Every other memoized caller here puts the identity-bearing argument
// first for exactly this reason.
const _webhookSecrets = memoize(webhookCfg, async (slug, env, db) => {
  const map = {};
  let rows = [];
  // LIKE on the name, so a site with twelve destinations is still one read.
  try { rows = await sqlQuery(db, "SELECT name, cipher FROM _secrets WHERE name LIKE 'WEBHOOK%'", []); } catch { return map; }
  for (const r of (rows || []).slice(0, 32)) {
    const name = r && r.name;
    if (!name) continue;
    // One unreadable row must not stop the others being found — the same call
    // `confirmSubmitter` makes for its four names.
    try {
      const v = await readSecret({ get: async () => r.cipher }, env, { slug, name });
      if (v) map[name] = v;
    } catch { /* skip */ }
  }
  return map;
});

/**
 * NEVER CACHE A MISS, which is the rule `siteBackendBySlug` already follows —
 * "a slug that does not resolve is usually one whose build is still finishing".
 *
 * Measured, not theorised: a run submitted three bookings before the owner had
 * stored a destination, which cached `{}` for sixty seconds; the secret was then
 * stored and the next booking read the cached empty set and reported "no
 * WEBHOOK_URL in Secrets". For an owner that is worse than a test failure — they
 * paste a URL, submit their own form to check, and see nothing happen, which is
 * exactly the moment they conclude the feature is broken.
 *
 * So a configuration with no destination is dropped from the cache immediately.
 * It costs one read per event only on sites that never configured one, and those
 * sites do not reach here at all — `firesFor` refuses first.
 */
async function webhookSecrets(slug, env, db) {
  const map = await _webhookSecrets(slug, env, db);
  if (!map || !Object.keys(map).some((k) => k.startsWith("WEBHOOK_URL"))) webhookCfg.delete(slug);
  return map;
}

// One site's outbound deliveries per minute, per isolate. Bounded and cleared
// wholesale rather than kept as a cache: this only has to stop the cheap flood.
const webhookHits = new Map();

// The site's Turnstile secret, if it has one.
//
// THIS ONE CACHES THE MISS, WHICH IS THE OPPOSITE OF THE RULE ABOVE, and the
// difference is worth stating. `webhookSecrets` is reached only by a site that
// DECLARED webhooks, so re-reading on a miss costs those few sites one query.
// This gate has no declaration in front of it — it is an owner toggle, not a
// schema flag — so every form submission on every site would pay a SQL round
// trip forever to be told the overwhelmingly common answer: not configured.
//
// The staleness that buys is bounded at 15 seconds and invalidated on the write
// that changes it, and it fails in the harmless direction on both edges: for 15
// seconds after switching ON, spam is accepted (which is the status quo), and
// after switching OFF, real submissions are refused — which is why the delete
// path clears this cache as well as the webhook one.
const turnstileCfg = makeCache({ ttlMs: 15_000, max: 500 });

/**
 * The real side effects for an inbound webhook, supplied to `site-inbound.mjs`
 * the way `publish-pages.mjs` and `site-provision.mjs` take theirs.
 *
 * ON THE OWNER CONNECTION, and that is what makes a hook function safe to leave
 * ungranted. It is declared `internal`, so `functionSql` REVOKEs EXECUTE from
 * PUBLIC and hands it to neither Data API role — meaning the ONLY way to reach
 * it is this route, behind the shared secret. The owner connection bypasses
 * grants, so the function loses nothing by having none.
 */
function inboundDeps(env, slug, db) {
  return {
    loadSchema: () => loadSiteSchema(db),
    loadSecrets: async (names) => {
      const map = {};
      for (const name of names) {
        try {
          const rows = await sqlQuery(db, "SELECT cipher FROM _secrets WHERE name=?", [name]);
          const cipher = rows && rows[0] && rows[0].cipher;
          if (!cipher) continue;
          // One unreadable row must not stop the other being found — the same
          // call `confirmSubmitter` makes for its four names.
          const v = await readSecret({ get: async () => cipher }, env, { slug, name });
          if (v) map[name] = v;
        } catch { /* absent */ }
      }
      return map;
    },
    // The name is re-checked against the schema by `functionFor` before it gets
    // here, and quoted on the way in regardless: a stored schema is only as
    // good as whatever last wrote it, and this is the boundary.
    callFn: async (name, payload) => {
      const rows = await sqlQuery(db, "SELECT " + sqlIdent(name) + "(?::jsonb) AS out", [JSON.stringify(payload)]);
      const out = rows && rows[0] && rows[0].out;
      return typeof out === "string" ? JSON.parse(out) : (out ?? null);
    },
    throttle: async (key) => _dataLimiter.hit("inbound|" + key, INBOUND_PER_MIN),
    log: (...a) => console.error(...a),
  };
}

// One cache for every site's third-party reads. Per isolate, so a busy site on
// a busy PoP is well served and a quiet one still pays the owner's quota now and
// then — the honest description, and it is the same limitation `ttl-cache`
// carries everywhere else here. The declaration's own TTL decides how long an
// entry lives, so this only bounds how MANY are kept.
// The OUTER window is the longest a declaration may ask for, so it bounds
// memory and never silently shortens a declared hour to a minute; the entry
// carries its own `until`, which is what actually decides. Written the other way
// round — a 60s cache under a `cacheSeconds: 3600` declaration — the declaration
// would be quietly ignored and the owner's quota spent sixty times over.
const siteApiCache = makeCache({ ttlMs: SITE_API_MAX_TTL * 1000, max: 2000 });

/**
 * The real side effects for a third-party read.
 *
 * ONLY THE SECRETS THIS DECLARATION NAMES are decrypted — the rest of the vault
 * is never touched, which is the same discipline `confirmSubmitter` follows for
 * its four names, and it matters more here because the answer travels out to a
 * third party.
 */
async function siteApiDeps(env, slug, db, api) {
  const secrets = {};
  for (const name of secretsNeeded(api)) {
    try {
      const rows = await sqlQuery(db, "SELECT cipher FROM _secrets WHERE name=?", [name]);
      const cipher = rows && rows[0] && rows[0].cipher;
      if (!cipher) continue;
      const v = await readSecret({ get: async () => cipher }, env, { slug, name });
      if (v) secrets[name] = v;
    } catch { /* absent — `callApi` refuses rather than sending an empty one */ }
  }
  return {
    secrets,
    fetch: (u, init) => fetch(u, init),
    blockedReason: (u) => blockedReason(u),
    cacheGet: async (k) => {
      const e = siteApiCache.get(k);
      return e && e.until > Date.now() ? e.v : null;
    },
    // The declaration's TTL, not the cache's: a rate that is good for an hour
    // and a stock level that is good for ten seconds are the same feature, and
    // only the declaration knows which this is.
    cacheSet: async (k, v, ms) => { siteApiCache.set(k, { v, until: Date.now() + ms }); },
  };
}

// ── Cloudflare for SaaS: the provider half of custom domains ────────────────
//
// The API token is the one wrangler already deploys with, uploaded to the
// Worker as a secret so this can call it at runtime. It needs
// `SSL and Certificates: Edit` on the zone; without that Cloudflare answers a
// permission error, which is REPORTED rather than swallowed — a domain that
// silently never registers is the worst outcome here, because the owner is
// staring at DNS they have already set correctly.
const CF_API = "https://api.cloudflare.com/client/v4";
// OUR Domain Connect template identity. `DC_PROVIDER` is the zone we publish
// under and `DC_SERVICE` names the template; together they are the path a
// provider looks the template up by, and both have to match what is registered
// in the Domain Connect Templates repository. A mismatch is a 404 at the
// provider's end, which is why they are named once here rather than inline.
const DC_PROVIDER = "gofarther.dev";
const DC_SERVICE = "site";
// The label our public key is published under, as a TXT record at
// `<DC_KEY_ID>.<syncPubKeyDomain>` — so `_dck1.gofarther.dev`. Providers fetch
// it to verify the signature; rotating means publishing a second label and
// changing this, never editing the record in place, or every link already in
// flight stops verifying.
const DC_KEY_ID = "_dck1";
// Where Cloudflare for SaaS sends custom-hostname traffic. Overridable, with a
// default rather than a hard requirement: an unset value would make every DNS
// instruction we hand out wrong in a way the owner cannot detect.
const saasTarget = (env) => String(env.SAAS_FALLBACK_ORIGIN || "saas.gofarther.dev");

// The zone id, resolved from its NAME and cached for the isolate.
//
// Looked up rather than stored as a secret: it is derivable from the token we
// already have, and one fewer secret is one fewer thing to be wrong at 3am.
// Cached because it never changes for the life of the zone.
const zoneIds = makeCache({ ttlMs: 3600_000, max: 8 });
async function cfZoneId(env) {
  const name = OWN_ZONES[0];
  const hit = zoneIds.get(name);
  if (hit) return hit;
  if (!env.CLOUDFLARE_API_TOKEN) return null;
  try {
    const r = await fetch(`${CF_API}/zones?name=${encodeURIComponent(name)}`, {
      headers: { Authorization: "Bearer " + env.CLOUDFLARE_API_TOKEN },
      signal: AbortSignal.timeout(10000),
    });
    const j = await r.json().catch(() => null);
    const id = j && j.success && Array.isArray(j.result) && j.result[0] && j.result[0].id;
    if (id) zoneIds.set(name, id);
    return id || null;
  } catch { return null; }
}

/**
 * One call to the custom-hostnames API.
 *
 * Returns `{ok, result, error}` and never throws. The provider's own message is
 * kept for the OWNER — unlike a Postgres error, a Cloudflare one says things
 * like "this hostname is already registered on another zone", which is exactly
 * what somebody needs to know and cannot work out from a generic failure.
 */
async function cfHostname(env, method, path, body) {
  const zone = await cfZoneId(env);
  if (!zone) return { ok: false, error: "custom domains are not configured on this platform yet" };
  try {
    const r = await fetch(`${CF_API}/zones/${zone}/custom_hostnames${path || ""}`, {
      method,
      headers: { Authorization: "Bearer " + env.CLOUDFLARE_API_TOKEN, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json().catch(() => null);
    if (j && j.success) return { ok: true, result: j.result };
    const first = j && Array.isArray(j.errors) && j.errors[0];
    return { ok: false, status: r.status, error: (first && first.message) || ("Cloudflare answered " + r.status) };
  } catch (e) {
    // The NAME, never the message: the request carries the API token.
    return { ok: false, error: "couldn't reach Cloudflare (" + String((e && e.name) || "error") + ")" };
  }
}

// hostname → slug, for a published site on the owner's own domain.
//
// FIVE MINUTES, matching `siteBackendBySlug`, and for the same reason: a
// domain's site is fixed for the life of the mapping, and this sits on the
// visitor path of every request to every custom domain.
const hostRoutes = makeCache({ ttlMs: 300_000, max: 2000 });

/**
 * Which site answers on this hostname?
 *
 * NEVER CACHES A MISS — the rule `siteBackendBySlug` already follows. An
 * unresolved hostname here is almost always one whose DNS has just started
 * pointing at us while the row is seconds old, and remembering the miss would
 * keep a brand-new domain dark for five minutes at exactly the moment the owner
 * is refreshing it to see whether it worked.
 *
 * A LOOKUP FAILURE IS NOT AN ABSENCE. Supabase being unreachable answers null
 * here the same as "no such domain", which is the honest thing a caller can do
 * about it — but it must not be written into the cache as though it were an
 * answer, so the miss rule covers both.
 */
async function siteForHostname(env, hostname) {
  const host = normalizeHostname(hostname);
  if (!host || isOwnHostname(host)) return null;
  const hit = hostRoutes.get(host);
  if (hit) return hit;
  if (!env.SUPABASE_SERVICE_KEY) return null;
  let slug = null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/site_domains?hostname=eq.${encodeURIComponent(host)}&status=eq.live&select=slug&limit=1`,
      { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const rows = await r.json().catch(() => []);
    slug = (Array.isArray(rows) && rows[0] && rows[0].slug) || null;
  } catch { return null; }
  // `set` refuses null on its own, so this is belt and braces rather than the
  // guard — but stating it here is what stops somebody "simplifying" the
  // branch later and reintroducing a cached miss.
  if (slug) hostRoutes.set(host, slug);
  return slug;
}

/**
 * Forget everything this isolate remembers about a site's Secrets.
 *
 * ONE function rather than two `.delete` calls at each of the two write paths,
 * because the failure mode is a third cache added later and wired into the save
 * path but not the delete one — which is invisible until somebody removes a
 * secret and it keeps working. Isolate-local, like every invalidation here;
 * other PoPs heal by expiry.
 */
function forgetSiteConfig(slug) {
  webhookCfg.delete(slug);
  turnstileCfg.delete(slug);
}
// SLUG FIRST — `memoize` keys on the first argument, so `(env, db, slug)` keys
// every site on one `env` object and hands one site's secret to another.
//
// BOTH NAMES IN ONE READ, and they are a pair rather than two features: the
// SITE key is public and has to reach the page for a widget to exist at all,
// and the SECRET verifies what that widget produced. Read separately they would
// be two queries and two caches that can disagree about whether this site is
// protected.
const turnstileConfig = memoize(turnstileCfg, async (slug, env, db) => {
  const out = { secret: "", siteKey: "" };
  let rows = [];
  try { rows = await sqlQuery(db, "SELECT name, cipher FROM _secrets WHERE name LIKE 'TURNSTILE%'", []); }
  catch { return out; }
  for (const r of (rows || []).slice(0, 4)) {
    const name = r && r.name;
    const field = name === "TURNSTILE_SECRET" ? "secret" : name === "TURNSTILE_SITE_KEY" ? "siteKey" : null;
    if (!field) continue;
    // A value that will not decrypt reads as absent, which fails OPEN — the
    // same direction `site-turnstile.mjs` takes for a broken secret, and for
    // the same reason: the owner's mistake must not close their contact form.
    try { out[field] = (await readSecret({ get: async () => r.cipher }, env, { slug, name })) || ""; }
    catch { /* absent */ }
  }
  return out;
});

/**
 * Decide whether this submission may reach Postgres, and hand back the body
 * with the challenge token removed.
 *
 * SCOPED TO `collect`, deliberately. A `user`/`feed` write comes from a member
 * who is already signed in, through `rows.ts`, which sends no token — so
 * applying this there would refuse every member write on the site the moment
 * the owner switched it on. `collect` is the public form, which is the thing
 * that gets spammed and the thing the widget is on.
 */
async function turnstileGate(env, request, { slug, db, path, sent }) {
  let body = null;
  try { body = JSON.parse(sent || "null"); } catch { return {}; }
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const had = TURNSTILE_FIELD in body;
  const { token, row } = takeToken(body);
  // STRIPPED WHETHER OR NOT THIS SITE IS CONFIGURED, and on every table. The
  // field can never be a real column — the schema engine's column names cannot
  // contain a hyphen — so removing it is always safe, and leaving it in makes
  // PostgREST refuse the insert for an unknown column. A page that still has
  // the widget after the owner deleted the secret would otherwise have every
  // submission fail.
  const out = had ? { sent: JSON.stringify(row) } : {};

  // THE TOGGLE IS ASKED FIRST, on purpose. It is absent for almost every site,
  // so on a cold isolate an unprotected form pays one lookup here rather than a
  // schema read as well.
  const { secret } = await turnstileConfig(slug, env, db);
  if (!secret) return out;

  const table = String(path).split("/")[0].toLowerCase();
  let def = null;
  try {
    const spec = await loadSiteSchema(db);
    def = (spec && spec.tables || []).find((t) => String(t.name).toLowerCase() === table) || null;
  } catch { return out; }
  if (!def || String(def.access || "").toLowerCase() !== "collect") return out;

  const verdict = await turnstileVerify({
    post: (u, form) => fetch(u, {
      method: "POST",
      body: form,
      // A third party on the path a customer waits on. Bounded, and an
      // expiry reads as "unknown", which lets the booking through.
      signal: AbortSignal.timeout(5000),
    }),
  }, {
    secret,
    token,
    // CF-Connecting-IP ONLY. The `X-Forwarded-For` fallback used elsewhere in
    // this file is client-settable, and here that would let a caller choose the
    // reputation Cloudflare scores their token against.
    ip: request.headers.get("CF-Connecting-IP") || "",
  });
  if (verdict.state === "unknown") console.error("turnstile:", slug, verdict.reason);
  if (verdict.ok) return out;
  return { ...out, refused: "That didn't look like it came from a person. Please try again." };
}

/**
 * Fire the site's declared webhook. Detached, never awaited by the response —
 * a receiver being slow must not be something a customer waits on.
 *
 * The destination and signing secret come from the SITE'S OWN Neon vault, the
 * same door the Stripe key and the mail key come through. Two names, decrypted
 * lazily and never returned to a caller.
 */
function emitWebhook(env, ctx, { slug, db, def, table, action, row }) {
  const p = (async () => {
    const out = await deliverWebhook({
      firesFor: (a) => firesFor(def, a),
      loadSecrets: () => webhookSecrets(slug, env, db),
      blockedReason: (u) => blockedReason(u),
      sign: (secret, body, ts) => signPayload(secret, body, ts),
      tooMany: async (s) => {
        const now = Date.now();
        const b = webhookHits.get(s);
        if (!b || now >= b.resetAt) { webhookHits.set(s, { n: 1, resetAt: now + 60000 }); return false; }
        // The expiry is FIXED at the first hit and never re-stamped — the bug
        // `authThrottle` had, where a blocked caller extended their own window
        // and never recovered.
        b.n++;
        if (webhookHits.size > 5000) webhookHits.clear();
        return b.n > WEBHOOK_PER_MIN;
      },
      // `redirect: "manual"` so a 3xx is a result rather than another hop —
      // following one would reopen the host question after it was answered.
      post: (url, init) => fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(5000) }),
    }, { slug, table, action, row, now: Date.now() });
    // RECORDED, not only logged.
    //
    // Everything about a webhook is invisible from outside: it runs detached, so
    // the caller gets no answer, and its only other trace was a console.error
    // nobody can read — not the owner whose integration silently stopped, and
    // not a test trying to establish whether it works. Debugging something that
    // reports nothing is how this feature stayed unfalsifiable through three
    // rounds; the owner's version of that is worse, because they find out from a
    // customer.
    //
    // One row in the site's own `_meta`, overwritten each time. Not a log: a log
    // needs pruning, and the question an owner actually has is "is it working
    // right now", which the last attempt answers completely.
    //
    // Skipped for the two quiet outcomes — no URL, and a table that does not
    // emit — because those are the resting state of most sites and writing them
    // would put a database round trip on every insert on the platform to record
    // that nothing happened.
    // RECORDED FOR EVERY OUTCOME ONCE THE TABLE EMITS. The first version also
    // skipped "no WEBHOOK_URL", on the reasoning that an unconfigured site is
    // the common case — and that is true, but it made the single most useful
    // diagnostic invisible: a site that HAS a destination and cannot read it
    // looks identical to one that never set one. Only "this table does not emit"
    // is skipped now, which is the genuine resting state of the platform and the
    // one that would put a write on every insert everywhere.
    if (out.reason !== "table does not emit this action") {
      if (!out.sent) console.error("webhook:", slug, table, action, out.reason || "", out.status || "");
      // Best-effort, and it must not throw: the delivery already happened or
      // already failed, and losing the note is strictly better than turning it
      // into a second failure.
      try {
        await sqlQuery(db, "INSERT INTO _meta (k,v) VALUES ('webhook_last', ?) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v",
          [JSON.stringify({
            at: new Date().toISOString(), table, action,
            ok: !!out.sent, status: out.status || 0,
            reason: out.reason || null, signed: !!out.signed,
            // Which WEBHOOK* names the vault returned — the difference between
            // "never configured", "read came back empty" and "would not decrypt".
            found: out.found || null,
          })]);
      } catch (e) { console.error("webhook note:", slug, e && e.message); }
    }
  })();
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(p); else p.catch(() => {});
}

function confirmSubmitter(env, ctx, { slug, db, def, row }) {
  const p = (async () => {
    const out = await sendConfirmation({
      // From the SITE'S OWN Neon vault, the same door the checkout key comes
      // through — and the SAME reader the owner notification uses, so the two
      // cannot disagree about which key is live.
      loadSecrets: siteMailSecrets(env, db, slug),
      send: ({ provider, key, from, to, subject, html }) => postProviderEmail(provider, key, from, to, subject, html),
      recentlySent: async (s2, to) => {
        const k = s2 + "|" + to, now = Date.now();
        const at = confirmSeen.get(k);
        if (at && now - at < 600000) return true;          // 10 minutes
        if (confirmSeen.size > 5000) confirmSeen.clear();  // bounded, not a cache
        return false;
      },
      markSent: async (s2, to) => { confirmSeen.set(s2 + "|" + to, Date.now()); },
      // Run the model's own confirmation builder. It gets the row id and returns
      // {to, subject, body} as json, computed from anything on the site — so the
      // MESSAGE is model-written per site, and the platform still owns only the
      // key and the connection.
      //
      // Called on the OWNER connection, which is why the function needs no
      // EXECUTE grant and must not have one: granted to `anonymous` it reads any
      // customer's confirmation by guessing a row id.
      callFn: async (name, rowId) => {
        if (rowId == null) return null;
        // The name reaches SQL, so it is re-checked here rather than trusted
        // from `_meta` — a stored schema is only as good as whatever last wrote
        // it, and this is the boundary.
        if (!/^[a-z][a-z0-9_]{0,40}$/.test(String(name))) return null;
        const rows = await sqlQuery(db, "SELECT " + sqlIdent(name) + "(?) AS out", [rowId]);
        const out = rows && rows[0] && rows[0].out;
        return typeof out === "string" ? JSON.parse(out) : out;
      },
    }, { def, row, slug });
    // It runs detached, so nothing else would ever see why it did not send. The
    // uninteresting reasons — no key, nothing declared — stay quiet.
    if (!out.sent && !["no confirm declared", "no provider key in Secrets", "not a collect table"].includes(out.reason)) {
      console.error("confirm:", slug, out.reason, out.error || out.status || "");
    }
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(p); else p.catch(() => {});
}

/**
 * …and by text message, on the owner's own SMS account.
 *
 * A SEPARATE CALL rather than a channel inside `confirmSubmitter`, because a
 * site may want either or both — an emailed receipt AND a texted reminder — and
 * because folding them together means one provider being down or misconfigured
 * silently takes the other with it. They are independent failures and they
 * report independently.
 *
 * Same never-throws contract: the booking already succeeded.
 */
function smsSubmitter(env, ctx, { slug, db, def, row }) {
  const p = (async () => {
    const out = await sendSms({
      // Only the names this channel needs, decrypted lazily and never returned
      // to a caller — the same door the mail key and the Stripe key come
      // through.
      loadSecrets: async () => {
        const get = async (_s, name) => {
          const rows = await sqlQuery(db, "SELECT cipher FROM _secrets WHERE name=?", [name]);
          return (rows && rows[0] && rows[0].cipher) || null;
        };
        const map = {};
        for (const name of ["TWILIO_SID", "TWILIO_TOKEN", "MESSAGEBIRD_KEY", "VONAGE_KEY", "VONAGE_SECRET", "SMS_FROM"]) {
          try { const v = await readSecret({ get }, env, { slug, name }); if (v) map[name] = v; } catch { /* skip */ }
        }
        return map;
      },
      send: ({ provider, key, secret, from, to, body }) => postProviderSms(provider, key, secret, from, to, body),
      // A SEPARATE COOLDOWN LEDGER from the mail one, and deliberately: they are
      // keyed by recipient, and an address and a phone number are different
      // recipients even for the same person. Sharing the map would let an email
      // confirmation suppress the text that was the point of declaring both.
      recentlySent: async (s2, to) => {
        const k = s2 + "|" + to, now = Date.now();
        const at = smsSeen.get(k);
        if (at && now - at < 600000) return true;      // 10 minutes
        if (smsSeen.size > 5000) smsSeen.clear();      // bounded, not a cache
        return false;
      },
      markSent: async (s2, to) => { smsSeen.set(s2 + "|" + to, Date.now()); },
      // The model's own builder, on the OWNER connection — which is why the
      // function needs no EXECUTE grant and must not have one: granted to
      // `anonymous` it reads any customer's phone number by guessing a row id.
      callFn: async (name, rowId) => {
        if (rowId == null) return null;
        if (!/^[a-z][a-z0-9_]{0,40}$/.test(String(name))) return null;
        const rows = await sqlQuery(db, "SELECT " + sqlIdent(name) + "(?) AS out", [rowId]);
        const out2 = rows && rows[0] && rows[0].out;
        return typeof out2 === "string" ? JSON.parse(out2) : out2;
      },
    }, { def, row, slug });
    if (!out.sent && !["no sms declared", "no provider key in Secrets", "not a collect table"].includes(out.reason)) {
      console.error("sms:", slug, out.reason);
    }
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(p); else p.catch(() => {});
}
// THE SITE'S OWN MAIL PROVIDER, OUT OF THE SITE'S OWN VAULT.
//
// ONE copy, shared by the owner notification and the visitor confirmation. Two
// readers of one vault written out twice are two things that can disagree about
// which key is live, which is this codebase's most repeated failure.
//
// Only the four names that matter are decrypted; the rest of the vault is never
// touched. A key that will not decrypt is skipped rather than thrown on — one
// unreadable row must not stop the others being found.
function siteMailSecrets(env, db, slug) {
  return async () => {
    const get = async (_s, name) => {
      const rows = await sqlQuery(db, "SELECT cipher FROM _secrets WHERE name=?", [name]);
      return (rows && rows[0] && rows[0].cipher) || null;
    };
    const map = {};
    for (const name of ["RESEND_KEY", "SENDGRID_KEY", "POSTMARK_KEY", "EMAIL_FROM"]) {
      try { const v = await readSecret({ get }, env, { slug, name }); if (v) map[name] = v; } catch { /* skip */ }
    }
    return map;
  };
}

// Tell the site's owner a submission arrived — ON THE OWNER'S OWN KEY.
//
// THE BOUNDARY, AND IT HAS NO EXCEPTION (owner's call 2026-08-09): our
// Cloudflare sender is for Supabase login and nothing else. Everything a
// published site sends — the confirmation to the visitor, the SMS, and this
// notification to the owner — goes out on the key that site's owner pasted into
// Secrets, on their own domain.
//
// It used to send on `env.EMAIL`, so every booking on every published site spent
// our own 200/day quota — the quota the login code depends on. One busy site
// could have stopped people signing in to the platform. That is gone: the only
// thing on our sender now is the login code, so the cap is a platform concern
// with a platform-sized denominator instead of one that scales with customers.
//
// A site with no mail key configured therefore gets no notification. That is the
// same condition the visitor confirmation one branch over already lives under,
// which is the point — one rule, not two — and the owner still sees every
// submission in the Data panel.
function notifyOwnerOfSubmission(env, ctx, payload) {
  if (!env.SUPABASE_SERVICE_KEY || !payload || !payload.db) return;
  const p = (async () => {
    const out = await notifyOwner({
      claim: (s2) => claimNotify(env, s2),
      // Supabase, because this is looking up WHO to write to — our own record of
      // our own customer's address. It says nothing about which sender is used.
      emailOf: (uid) => ownerEmail(env, uid),
      send: async ({ to, subject, html }) => {
        const secrets = await siteMailSecrets(env, payload.db, payload.slug)();
        const picked = pickProvider(secrets);
        const from = String(secrets.EMAIL_FROM || "").trim();
        // NAMED, NOT SWALLOWED. `notifyOwner` turns a throw into a reason and the
        // caller logs it, so an owner who has pasted no key can be told which
        // half is missing instead of wondering why nothing arrives.
        if (!picked) throw new Error("no mail provider key in this site's Secrets");
        if (!from) throw new Error("no EMAIL_FROM in this site's Secrets");
        return postProviderEmail(picked.provider, picked.key, from, to, subject, html);
      },
    }, payload);
    // It runs detached, so nothing else would ever see why it did not send.
    if (!out.sent && out.error) console.error("submission notify:", payload.slug, out.reason, out.error);
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(p); else p.catch(() => {});
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
async function deleteSitePrefix(env, slug, keep) {
  const spare = keep instanceof Set ? keep : null;
  const prefix = "sites/" + slug + "/";
  let cursor, removed = 0;
  for (;;) {
    const page = await env.SITES_BUCKET.list({ prefix, cursor });
    for (const o of (page.objects || [])) {
      // `keep` is what the build just wrote. Sweeping everything else is how a
      // republish drops the previous build's hashed assets without there ever
      // being a moment when the site is not fully published.
      if (spare && spare.has(o.key.slice(prefix.length))) continue;
      await env.SITES_BUCKET.delete(o.key); removed++;
    }
    // Stopping when there is no cursor as well as when the page is not truncated
    // is what makes this loop terminate unconditionally: a truncated page with no
    // cursor would otherwise re-request the same page forever and burn the
    // Worker's CPU budget, which is a worse failure than deleting one page short.
    if (!page.truncated || !page.cursor) return removed;
    cursor = page.cursor;
  }
}

/**
 * R2 plumbing for site-versions.mjs. One place, so the archive, the rollback and
 * the delete sweep cannot disagree about where a version lives.
 *
 * `copy` is a read-then-put: R2's binding has no server-side copy, so a version
 * really is a second set of bytes. That is the cost of the design — ~10 builds
 * of a small dist — and it is why MAX_VERSIONS exists.
 */
/**
 * WHERE A SITE'S PAGE SOURCE LIVES, so a revise can edit it.
 *
 * `source/<slug>/pages.json`, and the prefix matters: `/s/<slug>/` serves out of
 * `sites/<slug>/`, so anything written there is PUBLIC. A site's own TSX is not
 * something to hand to its visitors.
 *
 * Best-effort in both directions. A failed write costs the next revise its
 * anchor — which is exactly today's behaviour, so it can never be worse than
 * what it replaces — and a failed read is the same.
 */
const SOURCE_KEY = (slug) => "source/" + String(slug).toLowerCase() + "/pages.json";

async function saveSiteSource(env, slug, pages) {
  if (!env.SITES_BUCKET) return false;
  const list = (Array.isArray(pages) ? pages : [])
    .filter((p) => p && typeof p.path === "string" && typeof p.source === "string")
    .map((p) => ({ path: p.path, source: p.source }));
  if (!list.length) return false;
  try {
    await env.SITES_BUCKET.put(SOURCE_KEY(slug), JSON.stringify(list), {
      httpMetadata: { contentType: "application/json" },
    });
    return true;
  } catch (e) { console.error("source save failed:", slug, e && e.message); return false; }
}

async function loadSiteSource(env, slug) {
  if (!env.SITES_BUCKET) return null;
  try {
    const o = await env.SITES_BUCKET.get(SOURCE_KEY(slug));
    if (!o) return null;
    const v = JSON.parse(await o.text());
    return Array.isArray(v) && v.length ? v : null;
  } catch (e) { console.error("source read failed:", slug, e && e.message); return null; }
}

function versionDeps(env) {
  return {
    list: async (prefix) => {
      const out = []; let cursor;
      for (;;) {
        const page = await env.SITES_BUCKET.list({ prefix, cursor });
        for (const o of (page.objects || [])) out.push({ key: o.key, size: o.size });
        if (!page.truncated || !page.cursor) return out;
        cursor = page.cursor;
      }
    },
    copy: async (from, to) => {
      const obj = await env.SITES_BUCKET.get(from);
      if (!obj) return;
      await env.SITES_BUCKET.put(to, await obj.arrayBuffer(),
        { httpMetadata: { contentType: obj.httpMetadata && obj.httpMetadata.contentType } });
    },
    remove: (key) => env.SITES_BUCKET.delete(key),
    put: (key, text, ct) => env.SITES_BUCKET.put(key, text, { httpMetadata: { contentType: ct } }),
    read: async (key) => { const o = await env.SITES_BUCKET.get(key); return o ? await o.text() : null; },
  };
}

/**
 * Publish a compiled site — WRITE FIRST, THEN SWEEP. Never the other way round.
 *
 * THIS USED TO DELETE THE WHOLE PREFIX AND THEN WRITE, which left a window —
 * the wipe plus ~20 sequential R2 puts — where the live site was partly or
 * entirely missing. Anyone loading it in that window got 404s, on a public URL,
 * every time the owner revised.
 *
 * It is worse than it sounds because a generated site is CODE-SPLIT: one lazily
 * loaded chunk per route. So a visitor whose home page loaded BEFORE a republish
 * gets a 404 the moment they click through to another page — the chunk that page
 * needs was deleted and not yet rewritten. Measured against a real published
 * site 2026-08-08; that is the "this page didn't load" a customer reported.
 *
 * Safe in this order because vite content-hashes asset names: a new build's
 * assets have new names, so writing them cannot clash with the ones being
 * served. `index.html` goes LAST — it is the pointer, so flipping it after its
 * assets exist is what makes the switch atomic from a visitor's side. Then the
 * sweep removes whatever the new build does not use.
 */
async function writeSiteDistToR2(env, slug, dist, meta) {
  const wrote = new Set();
  // index.html last: it names the new bundle, so nothing may see it until the
  // bundle it points at is fully written.
  const entries = Object.entries(dist || {})
    .sort((a, b) => (/^index\.html$/i.test(a[0]) ? 1 : 0) - (/^index\.html$/i.test(b[0]) ? 1 : 0));
  for (const [rel, v] of entries) {
    // The head belongs to the built dist, which the model never sees, so the
    // share tags go in here. Only ever a no-op on anything unexpected — a site
    // published without a description is a far smaller problem than one
    // published broken.
    //
    // EVERY HTML FILE, not just index.html, and that is not cosmetic. Each route
    // is prerendered to its own document now, and this block writes the
    // `<meta name="site-slug">` tag that `siteSlug()` reads. On a CUSTOM DOMAIN
    // there is no `/s/<slug>/` in the path, so that tag is the only thing telling
    // a page which site's API to talk to — leave it off a prerendered page and a
    // visitor landing directly on /book reads a DIFFERENT site's data, silently.
    //
    // Per-page title and description come from what the page itself rendered
    // (`pageMeta`), so a booking page pasted into WhatsApp previews as the
    // booking page. The home page keeps the site-level description, which the
    // designer wrote for exactly this purpose.
    if (/\.html$/i.test(String(rel)) && v && typeof v.t === "string" && meta) {
      const home = /^index\.html$/i.test(String(rel));
      try {
        const pm = pageMeta(v.t, meta, { home });
        v.t = injectMeta(v.t, pm);
        if (!home) v.t = setTitle(v.t, pm.brand);
      } catch (e) { console.error("meta inject failed:", slug, rel, e && e.message); }
    }
    const safeRel = String(rel).replace(/[^a-z0-9/._-]/gi, "-");
    const ext = (safeRel.match(/\.([a-z0-9]{1,8})$/i) || [])[1] || "";
    const ct = R2_MIME[ext.toLowerCase()] || "application/octet-stream";
    let bodyOut;
    if (v && typeof v.t === "string") bodyOut = v.t;
    else if (v && typeof v.b === "string") { const bin = atob(v.b); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); bodyOut = u8; }
    else continue;
    await env.SITES_BUCKET.put("sites/" + slug + "/" + safeRel, bodyOut, { httpMetadata: { contentType: ct } });
    wrote.add(safeRel);
  }
  // AND ONLY NOW the previous build's leftovers. Best-effort: a failed sweep
  // costs storage, while a failed write would cost the site — so this can never
  // be allowed to throw past a publish that has already succeeded.
  try { await deleteSitePrefix(env, slug, wrote); } catch (e) { console.error("sweep failed:", slug, e && e.message); }
  return wrote.size;
}

/**
 * A font the site asked for that is not one of the 24 installed, downloaded here.
 *
 * The WORKER does this rather than the container, because the Worker certainly
 * has network at request time and that is not something to assume of a build
 * container. The bytes ride to the build as base64 — a woff2 is 13-22 KB
 * measured, so the request grows by tens of kilobytes, not megabytes.
 *
 * Fails SOFT and returns nothing: the pair has already fallen back to a face
 * that IS installed, so a font we could not reach costs a typeface rather than a
 * site. Bounded by a timeout, because this is a third party on the build path.
 */
async function fetchSiteFonts(pair) {
  const out = {};
  for (const slot of ["heading", "body"]) {
    const f = pair && pair[slot];
    if (!f || f.source !== "fetch" || out[f.id]) continue;
    try {
      const meta = await fetch(f.url, { signal: AbortSignal.timeout(8000) });
      if (!meta.ok) continue;
      const j = await meta.json();
      const variants = j && j.variants;
      if (!variants) continue;
      // The heaviest weight a variable face publishes is still one file; for a
      // static face take the regular. Latin only — the subset a generated site
      // renders, and the reason a fetch is smaller than the npm package.
      const weight = variants["400"] ? "400" : Object.keys(variants).sort()[0];
      const url = weight && variants[weight] && variants[weight].normal
        && variants[weight].normal.latin && variants[weight].normal.latin.url;
      if (!url || !url.woff2) continue;
      const file = await fetch(url.woff2, { signal: AbortSignal.timeout(8000) });
      if (!file.ok) continue;
      const buf = new Uint8Array(await file.arrayBuffer());
      if (buf.length < 4 || buf.length > 2_000_000) continue;
      let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      out[f.id] = btoa(bin);
      if (j.category) f.kind = j.category === "monospace" ? "mono" : (j.category === "serif" ? "serif" : "sans");
    } catch (e) {
      console.error("font fetch failed:", f.id, String((e && e.message) || e).slice(0, 120));
    }
  }
  return out;
}

// brief + schema → route files → `tsc --noEmit` + `vite build` in the container →
// the dist published to sites/<slug>/.
//
// The decisions — pay for a repair pass? was the repair an improvement? publish at
// all? — live in builder/publish-pages.mjs, which takes every side effect as an
// injected function so they can be driven against fakes in test/publish-pages.test.mjs.
// This is only the wiring that supplies the real ones.
/**
 * The picture a link preview shows: the first thing the owner uploaded.
 *
 * EXTRACTED BECAUSE THERE ARE TWO PUBLISH PATHS AND ONLY ONE HAD IT. A build
 * derived this inline; the free text edit — which recompiles and republishes the
 * same site — never did, so fixing a typo silently stripped the site's preview
 * image. The same divergence dropped its description. Two implementations of
 * "publish this site" is how the second one quietly lacks what the first has,
 * which is the whole argument for one spine.
 *
 * ON THE SITE'S OWN DOMAIN, not the platform's. This is what WhatsApp and Slack
 * show when a customer shares the shop, so pointing it at the tool the business
 * happens to have been built with is the most visible place that leak can
 * appear. `siteOrigin`, not `siteUrlFor` — uploads hang off the origin, and
 * appending them to a site's home-page URL is the shape that already 404'd every
 * image on the platform once.
 *
 * Best-effort in both directions: no bucket, no uploads or a failed list all
 * mean a smaller card, never a failed publish.
 */
/**
 * THE SHARED SPINE: take a site's page source, compile it, publish it.
 *
 * No model call, no designer, no schema — source in, published site out. This is
 * the half of a build that every path needs and the half an EDIT needs on its
 * own: compile-and-publish sat at the END of a line built for creating a site
 * from nothing, so the only way to reach it was to walk all of it, which is why
 * "make the background yellow" cost the same ~28 credits as "build me a site".
 *
 * EXTRACTED FROM THE FREE TEXT EDIT, WHICH WAS ALREADY THE SECOND COPY. The
 * build path has its own, and the two had silently diverged: this one titled the
 * site with its SLUG, dropped its og:description and dropped its preview image,
 * because `injectMeta` replaces its fenced block and a field not passed is a
 * field removed. Nothing caught it — both paths compiled, both published, and
 * only reading them side by side showed it. One spine is the answer to that, and
 * the reason to do it before the cheap edit path rather than after.
 *
 * THE LOOK IS READ HERE, NOT PASSED IN, on purpose. A recompile that is handed a
 * look can be handed the WRONG one, and the failure is silent — the site comes
 * back re-themed by a caller that meant nothing by it. Reading the stored value
 * means the only way to change a site's look is to change what is stored.
 *
 * A FAILED COMPILE LEAVES THE LIVE SITE ALONE, and that is the whole contract of
 * the failure path: publishing a broken bundle to fix a typo is the trade nobody
 * would make. Returns `{ok:false, error, detail}` and touches nothing.
 */
/**
 * What to tell the owner when a recompile failed.
 *
 * ONE SENTENCE, NOT FIVE. Every lane that publishes through `recompileAndPublish`
 * had its own wording, and all of them blamed the customer's change — which is
 * right for a type error and wrong for our container being drained mid-deploy.
 * Measured 2026-08-11: a colour change answered `tsc was killed by SIGTERM` and
 * the owner was told their look "didn't compile".
 *
 * `pub.ours` is set only when the container was KILLED twice, which is a signal
 * that the process never got to judge the code at all.
 */
function compileMsg(pub, theirs) {
  return (pub && pub.ours)
    ? "That didn't go through — our build service was restarting. Try again in a moment; nothing was charged."
    : theirs;
}

async function recompileAndPublish(env, { slug, pages, label }) {
  let look = null, tokens = null, style = null, logo = "";
  try {
    // `siteBackendBySlug` RETURNS THE CONNECTION STRING, not a record. This read
    // `conn && conn.conn`, which is `undefined` for a string — so the `_meta`
    // read below never ran, `look` and `tokens` stayed null, and every publish
    // through this function shipped with NO theme, NO colour overrides, the
    // default font pair, and the site's SLUG as its title in place of its brand.
    //
    // That is precisely the divergence this function was extracted to END: the
    // free text-edit route used to carry its own copy which dropped three fields
    // of the published meta, and one wrong property access put it straight back,
    // worse. Every other caller in this file uses the return value directly.
    const db = await siteBackendBySlug(env, slug);
    if (db) {
      const rows = await sqlQuery(db, "SELECT k, v FROM _meta WHERE k IN ('site_look','site_tokens','site_style','site_logo')");
      for (const r of rows || []) {
        if (r.k === "site_look" && r.v) look = JSON.parse(r.v);
        if (r.k === "site_tokens" && r.v) tokens = JSON.parse(r.v);
        // READ HERE OR EVERY RECOMPILE UNDOES IT, exactly as `site_logo` below.
        // The container merges this into the theme on EVERY build — it has to,
        // or one site's look decisions leak onto the next — so a path that does
        // not send the stored patch sends nothing, and nothing means the theme's
        // own defaults. A customer who asked for square buttons and then changed
        // one word of copy would have watched them go round again.
        if (r.k === "site_style" && r.v) style = JSON.parse(r.v);
        // ITS OWN KEY, NOT A FIELD ON `site_look`, and that is load-bearing.
        // `mergeLook` builds its output from `EDIT_FIELDS` alone, so anything
        // else stored on that object is DROPPED by the next look edit — a
        // customer changing a colour would silently lose their logo. Stored
        // beside `site_tokens`, which is a separate concern for the same reason.
        if (r.k === "site_logo" && typeof r.v === "string") logo = r.v;
      }
    }
  } catch (e) { console.error("recompile look read failed:", slug, e && e.message); }

  const pair = resolvePair((look && look.fonts) || {});
  const fontFiles = await fetchSiteFonts(pair);
  const files = {};
  for (const p of pages || []) files[p.path] = p.source;

  // A DRAINED CONTAINER IS NOT THE CUSTOMER'S BROKEN CODE, and this path treated
  // it as exactly that. Measured live 2026-08-11, in the middle of a deploy: a
  // colour change answered `tsc was killed by SIGTERM (no output)` eight seconds
  // in, and the owner was told "That look didn't compile, so your site is
  // untouched" — their change blamed for our rollout, with no retry.
  //
  // The build path has had `wasKilled` and one more attempt since 2026-08-09.
  // This is the SHARED SPINE — every edit layer and the addon publish through it
  // — and it had neither. Every deploy we do is a window in which a customer's
  // cheapest change fails and reads as their fault.
  //
  // ONE RETRY, and only for a kill. A genuine type error is deterministic: trying
  // again buys 20-40 seconds of container time to fail identically. A kill is a
  // signal that the process never got to judge the code at all, which is the one
  // failure worth repeating.
  const compile = async () => {
    try {
      const c = getContainer(env.SITE_BUILD_CONTAINER);
      const rr = await c.fetch(new Request("http://build/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files, slug, title: (look && look.brand) || slug,
          // THE SITE'S OWN LANGUAGE, out of the same stored look as everything
          // else here. Absent on every site built before 2026-08-12, and
          // `applyIdentity` leaves the attribute alone rather than guessing —
          // an old site keeps `en` until something tells it otherwise.
          lang: (look && look.lang) || null,
          logo,
          fonts: { heading: pair.heading.id, body: pair.body.id },
          theme: (look && look.theme) || null,
          tokens: Object.keys(tokens || {}).length ? withContrast(tokens) : undefined,
          style: Object.keys(style || {}).length ? style : undefined,
          fontFiles: Object.keys(fontFiles).length ? fontFiles : undefined,
        }),
      }));
      return JSON.parse(await rr.text().catch(() => "")) || {};
    } catch (e) {
      return { ok: false, error: String((e && e.message) || "the build service did not answer") };
    }
  };
  let built = await compile();
  let killed = false;
  if ((!built || built.ok !== true) && wasKilled(built && built.error)) {
    killed = true;
    built = await compile();
  }
  if (!built || built.ok !== true || !built.files) {
    // AND IT SAYS WHOSE FAULT IT WAS. `killed` is the difference between "your
    // change has an error in it" and "our container went away twice" — and the
    // caller turns that into the sentence the owner reads.
    return {
      ok: false, error: "compile", ours: killed && wasKilled(built && built.error),
      detail: String((built && built.error) || "").slice(0, 200),
    };
  }

  // THE SAME META A BUILD PUBLISHES. Every field here is one this path was
  // missing when it was a second copy.
  const wrote = await writeSiteDistToR2(env, slug, built.files, {
    brand: (look && look.brand) || slug,
    description: (look && look.description) || undefined,
    image: await siteOgImage(env, slug),
    url: siteUrlFor(slug, "https://" + APP_ZONE),
    slug,
  });
  try {
    await archiveVersion(versionDeps(env), {
      slug,
      id: versionId(Date.now(), Math.random().toString(36).slice(2)),
      label: label || "Rebuilt",
      files: Object.keys(built.files || {}).map((rel) => String(rel).replace(/[^a-z0-9/._-]/gi, "-")),
    });
  } catch (e) { console.error("archive failed:", slug, e && e.message); }
  // LAST, AND ONLY ON SUCCESS. The stored source is what the next edit reads, so
  // writing it before the compile is proved would hand the next edit a version
  // that does not build.
  await saveSiteSource(env, slug, pages);
  return { ok: true, files: wrote, look };
}

async function siteOgImage(env, slug) {
  try {
    if (!env.SITES_BUCKET) return null;
    const objs = await siteUploadList(env, slug);
    // OWNER UPLOADS ONLY — no `|| objs[0]` fallback. That fallback fired
    // exactly when the library held ONLY visitor uploads, which is a common
    // state (no photograph has ever been generated and most owners upload
    // nothing) — so on any site whose form accepts a picture, a stranger's
    // upload became the business's WhatsApp/Slack/Facebook preview image on
    // the next publish (2026-08-13 audit). The `.find` shows owner-preference
    // was the intent; the fallback silently undid it in the one case where it
    // mattered. No image beats an uncurated stranger's image: the card
    // degrades to `summary`, which site-meta already handles.
    const first = objs.find((o) => o && !o.visitor);
    if (!first) return null;
    return siteOrigin(slug, "https://" + APP_ZONE) + "/u/" + slug + "/" + first.key.split("/").pop();
  } catch (e) { console.error("og image lookup failed:", slug, e && e.message); return null; }
}

async function buildAndPublishPages(env, { brief, spec, slug, brand, auth, siteDescription, ogImage, fonts, theme, tokens, style, family, structure, lang, logo, attachments, priorUsage, model, revise, changeNote, priorPages, mark }) {
  // Resolved once, before any model call: the pair always lands on something
  // installed, so a build never waits on a font it cannot get.
  const fontPair = resolvePair(fonts || {});
  // A face that is not bundled is DOWNLOADED here, before any model call. It is
  // network time inside what looked like pure setup, and on a build using two
  // unbundled families it is the whole gap between `og` and the generation.
  const fontFiles = await fetchSiteFonts(fontPair);
  try { mark?.("fonts"); } catch { /* a trace must never break a build */ }
  // HOW MANY PHOTOGRAPHS THIS SITE MAY HAVE, derived once from the family's own
  // page set. It is stated to the model BEFORE generation and cut down to what
  // the balance carries AFTER it, and those cannot be the same number: what a
  // build costs is only known once it has happened, and telling the model "none"
  // on a guess would lose the pictures from a customer who could afford them.
  // Over-stating it costs nothing — an unbought token is a placeholder.
  //
  // A REVISE OF A SITE THAT ALREADY SHOWS PHOTOGRAPHS BUYS NONE. It re-derives
  // the same budget from the same family and the model writes fresh
  // descriptions, so nothing matches what was bought last time — a customer
  // revising a 5-photo agency site paid ~94 credits in NEW photographs on every
  // revise, for pictures they already owned, and orphaned the originals. Even
  // "fix a typo" bought one, because the directive actively asks for a token.
  //
  // Zero rather than "reuse what is there", deliberately: the photographs are in
  // `uploads/<slug>/`, which is the owner's own image library and survives a
  // publish, so they are not lost — but matching a NEW description to an OLD
  // file is a guess, and a wrong guess puts the wrong picture on the page.
  //
  // BUT A REVISE IS NOT THE SAME QUESTION AS "the site has pictures", which is
  // what this used to assume. Images are bought AFTER the pages validate, so a
  // first build whose generation returns nothing never reaches them — and from
  // then on every attempt is a revise, because a revise is decided by ownership.
  // Such a site could never get a photograph however many times it was rebuilt.
  // `budgetFor` asks the honest question instead, off the prior pages that are
  // already loaded here.
  const imgBudget = budgetFor(family, { revise, priorPages, slug });
  const out = await publishPages({
    // Throws on failure, and the route logs it. There is no second attempt to
    // swallow one, so nothing needs logging here.
    generate: async () => {
      // The family reaches the model as a DIRECTIVE appended to the brief, not
      // as a bare name: `layoutDirective` is where site-layouts.mjs states the
      // hero, the body and the primary action for that family, and a name on
      // its own would leave the model to guess all three.
      //
      // COMPOSED IN page-gen.mjs, not here. Inline, the eval could not reach it
      // and sent the bare brief — ~287 tokens of layout that every real build
      // carries and no sample ever did, so the compile rate described a prompt
      // the platform does not send.
      return generateSitePages(env, briefWithLayout({ brief, family, structure, images: imgBudget }), spec, brand, family, attachments, model, priorPages);
    },
    // Runs between the lint and the compile, on the pages the model actually
    // wrote. `publishPages` supplies the two numbers only it knows — the balance
    // it read before generating and what the generation really cost — and
    // site-images.mjs owns the rule that turns them into a count.
    images: (pages, { balance, reserve }) =>
      buySitePhotos(env, { slug, pages, budget: imgBudget, balance, reserve }),
    compile: async (pages) => {
      const files = {};
      for (const p of pages) files[p.path] = p.source;
      const c = getContainer(env.SITE_BUILD_CONTAINER);
      const r = await c.fetch(new Request("http://build/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files, slug, title: brand,
          // WHAT LANGUAGE THE PAGES ARE IN, from the designer's reading of the
          // brief. `<html lang>` was hardcoded `en` on every site the platform
          // has ever published; the container refuses anything that is not a
          // well-formed tag, so a model that answers with a country name is a
          // site that keeps the attribute it had.
          lang: lang || null,
          // A first build has none and sends "", which is what the container
          // writes anyway. A REVISE carries the stored one — see `priorLogo`,
          // without which every revise would quietly take the logo off.
          logo: logo || "",
          fonts: { heading: fontPair.heading.id, body: fontPair.body.id },
          // Passed by NAME, resolved inside the container against the same
          // registry the enum came from. Sending the resolved object instead
          // would put a second copy of the theme on the wire and let the two
          // drift; the name is the whole contract.
          theme: theme || null,
          // THE SITE'S OWN COLOURS, written after the theme inside the
          // container — later wins, and that IS the override. Sent resolved
          // rather than by name, unlike the theme: there is no registry to
          // resolve against, these ARE the values. `withContrast` runs here so
          // what is stored stays what the customer asked for and the readable
          // text colour follows whatever the surface currently is.
          tokens: Object.keys(tokens || {}).length ? withContrast(tokens) : undefined,
          // THE REST OF THE LOOK, sent as the axes the customer named rather
          // than as a resolved theme. The container merges them INTO the theme
          // before rendering it — every axis emitter already reads its value off
          // that object, so all twelve generate correctly, including the three
          // that emit ordinary rules no later-wins patch could reach.
          style: Object.keys(style || {}).length ? style : undefined,
          fontFiles: Object.keys(fontFiles).length ? fontFiles : undefined }),
      }));
      // THE STATUS AND THE BODY, NOT JUST "no JSON". Parsing straight to JSON and
      // swallowing the failure threw away everything the container said: a 500
      // with a stack trace, a 502 from
      // the runtime, an OOM kill and an empty 200 all reported the same seven
      // words. Measured 2026-08-04 — build smoke reached this branch with a
      // generation that had SUCCEEDED, and the response could not say why the
      // container did not answer. Exactly the `detail: "{}"` lesson, a third
      // layer down; the body is read as TEXT so a non-JSON answer survives.
      const raw = await r.text().catch(() => "");
      try { return JSON.parse(raw); }
      catch {
        return {
          ok: false,
          stage: "build",
          error: "the build service answered " + r.status + " with " +
            (raw ? "no JSON: " + raw.slice(0, 300) : "an empty body"),
        };
      }
    },
    publish: async (dist, pages) => {
      const wrote = await writeSiteDistToR2(env, slug, dist, {
        brand, description: siteDescription, image: ogImage,
        // THE PUBLIC ADDRESS, which is what a link preview and a search result
        // show — so it has to be the one a customer would hand out, not the one
        // that happens to be convenient to build. `siteUrlFor` answers the
        // `<slug>.gofarther.app` form once that zone is live and the `/s/<slug>/`
        // one until then, from the single switch in site-domains.mjs.
        url: siteUrlFor(slug, "https://" + APP_ZONE),
        // WHICH SITE THIS IS, so the bundle can address its own API from a custom
        // domain — where there is no `/s/<slug>/` in the path to read it from.
        slug,
      });
      // ARCHIVE THE BUILD THAT JUST WENT LIVE, so it can be rolled back to.
      //
      // AFTER the publish and never allowed to fail it: the site is already up
      // by this point, so a failed archive costs a rollback point, while
      // throwing here would trade a working site for a bookkeeping entry. Same
      // rule as the meta injection and the sweep above it.
      try {
        await archiveVersion(versionDeps(env), {
          slug,
          id: versionId(Date.now(), Math.random().toString(36).slice(2)),
          // WHAT THE BUILD WAS, not what the site is called. Labelled with the
          // brand, every row in the list read "Sharp Fade Barbers" and the only
          // thing telling three builds apart was the timestamp — which makes
          // the list nearly useless for the one question it is opened to
          // answer: which of these do I want back. A revise is named by the
          // change the customer asked for, in their own words.
          label: versionLabel({ revise, changeNote, brand }),
          files: Object.keys(dist || {}).map((rel) => String(rel).replace(/[^a-z0-9/._-]/gi, "-")),
        });
      } catch (e) { console.error("archive failed:", slug, e && e.message); }
      // AND THE SOURCE THAT PRODUCED IT, so the next revise is an edit rather
      // than a rewrite. After the publish and never allowed to fail it, for the
      // same reason the archive is not: the site is already live, and losing
      // this costs the next revise its anchor — which is exactly the behaviour
      // it replaces.
      await saveSiteSource(env, slug, pages);
      return wrote;
    },
    readCredits: () => readCredits(auth),
    useCredits: (n) => collectCredits(auth, n),
    // What the web-research step already spent, so it is billed by the same rule
    // as generation: charged when a real app publishes, free when the customer
    // ends up with the placeholder.
  }, { spec, slug, priorUsage });
  if (out.page !== "app" && out.error) console.error("site page build failed:", slug, out.stage, out.error);
  return out;
}

// Cheap, high-precision defect scan on a generated page — no JS execution, so it
// only flags things we're SURE are wrong: a truncated document, leftover lorem,
// nav links to pages that don't exist, and hotlinked external images (which the
// published-site CSP will block). Returns a list of plain-English problems; an
// empty list means "ship it, no fix pass" (so clean generations cost nothing extra).
/**
 * Take one published site down: its edge route, its Neon project, its files,
 * its domains, and its registration — in that order, each for its own reason.
 *
 * EXTRACTED FROM THE ROUTE so the account-deletion path can reach it. It used
 * to live inline in `DELETE /api/site/<slug>`, which meant the only way to
 * remove a site was one HTTP request at a time — and the client's "delete my
 * account" called `/api/site/backend/delete-all`, a route that does not exist.
 * So every published site of a deleted account became a permanent orphan: the
 * ownership row cascades away with the user, and `DELETE /api/site/<slug>`
 * answers 404 without one, which is exactly the state CLAUDE.md says needs an
 * operator running sweep-orphan-site.yml by hand.
 *
 * Returns a Response, so the single-site route stays a one-liner and the
 * bulk path can read the status without a second copy of any of this.
 */
async function deleteSiteFor(env, uid, dslug) {
  if (!env.SUPABASE_SERVICE_KEY) return Response.json({ ok: false, error: "service key not configured" }, { status: 501 });
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
    if (srow.uid !== uid) return Response.json({ ok: false, error: "not your site" }, { status: 403 });

    // Forget the cached connection BEFORE anything is torn down. A warm isolate
    // holding a string that points at a dropped database is worse than a slow
    // lookup: it answers reads with a connection error instead of a 404.
    _connCache.delete(dslug);
    // And the edge route. KV propagates for up to a minute, so this has to go
    // BEFORE the database is dropped — a route outliving its database answers
    // reads with a connection error instead of an honest 404.
    await dropRoute(routeDeps(env), dslug);

    // Drop the site's whole PROJECT, not just its database.
    //
    // This is what one-project-per-site buys (2026-07-29): deleting a site
    // deletes the project, so nothing of it is left sharing a home with its
    // owner's other sites. Under the old per-user layout the project had to
    // survive — its siblings lived in it — and a dropped database left an
    // empty, billed project behind that only an operator could clear. That is
    // exactly the leftover this session had to leave in place by hand.
    //
    // Best-effort on the DROP but NOT on the record: a project left behind
    // costs money, and failing the whole call over it would leave the
    // published files up, which is the thing the caller actually asked to take
    // down. So the drop is tried, and the row is only removed if it worked —
    // a row with no project is a 404 the owner can retry, while a project with
    // no row is invisible and bills forever.
    let projectDropped = false;
    try {
      const proj = await siteNeonProject(env, dslug);
      if (proj && proj.neon_project) {
        await dropUserProject(env, proj.neon_project);
        projectDropped = true;
      } else {
        // Nothing recorded to drop. Legacy sites provisioned under the
        // per-user layout still have their database inside a shared project,
        // so fall back to dropping just that.
        const legacy = await userSiteProject(env, uid);
        if (legacy && legacy.neon_project) await dropSiteDatabase(env, legacy.neon_project, legacy.neon_branch, dslug);
        projectDropped = true;
      }
    } catch (e) { console.error("site project drop failed:", dslug, e && (e.detail || e.message)); }

    let removed = 0;
    try {
      if (env.SITES_BUCKET) removed = await deleteSitePrefix(env, dslug);
    } catch (e) {
      console.error("site files delete failed:", dslug, e && e.message);
      return Response.json({ ok: false, error: "couldn't remove the published files" }, { status: 502 });
    }

    // The archive goes too — the same leak `neon_teardown` exists to stop, one
    // resource over: `versions/<slug>/` is up to ten whole builds, and nothing
    // else would ever find it once the ownership row is gone.
    //
    // AFTER the live prefix and best-effort, deliberately. The published files
    // are what the caller asked to take down, so a failure here must not answer
    // an error and tell them their site is still up when it is not; the cost of
    // being wrong in this direction is R2 storage, and in the other direction a
    // site the owner believes is live.
    let versionsRemoved = 0;
    try {
      if (env.SITES_BUCKET) versionsRemoved = await deleteAllVersions(versionDeps(env), { slug: dslug });
    } catch (e) { console.error("site versions delete failed:", dslug, e && e.message); }

    // THE SITE'S SCHEDULED JOBS. Left behind, each one is a ZOMBIE the cron
    // picks up forever: a stamp write, a project lookup and a last_result
    // write per period, for a site that no longer exists (2026-08-13 audit —
    // nothing else deletes these rows; they are keyed by slug, not by uid, so
    // they do not cascade with the account either). BEFORE the registration
    // row, deliberately: if this delete fails the site still exists and the
    // owner's retry of the whole route runs it again, whereas after the row
    // is gone a failed cleanup is permanent — `DELETE /api/site/<slug>`
    // answers 404 with no row to authorise against. By slug alone, not
    // owner+slug: any row wearing this slug is a zombie once the site is
    // gone, whoever wrote it.
    let jobsRemoved = 0;
    try {
      const jr = await fetch(`${SUPABASE_URL}/rest/v1/site_functions?slug=eq.${encodeURIComponent(dslug)}`, {
        method: "DELETE", headers: svcHeaders(env, { Prefer: "return=representation" }), signal: AbortSignal.timeout(10000),
      });
      const jrows = await jr.json().catch(() => null);
      jobsRemoved = Array.isArray(jrows) ? jrows.length : 0;
    } catch (e) { console.error("site jobs delete failed:", dslug, e && e.message); }

    // Registration goes last. While it exists the site is still findable and
    // still owned, so a failure above leaves something to retry against rather
    // than the orphan this route exists to prevent.
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(dslug)}`, { method: "DELETE", headers: svcHeaders(env) });
    } catch (e) { console.error("site row delete failed:", dslug, e && e.message); }

    // The project record goes unconditionally now, and that is safe because of
    // the trigger: deleting this row ENQUEUES the project into `neon_teardown`,
    // so the cron finishes the job whether the inline drop above worked or not.
    // Keeping the row on failure was the right answer only while there was
    // nowhere to hand the work to — it left the site half-deleted and needed an
    // operator. The queue is strictly better: the record is never lost, and the
    // caller's site really is gone.
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/site_project?slug=eq.${encodeURIComponent(dslug)}`, { method: "DELETE", headers: svcHeaders(env) });
    } catch (e) { console.error("site project row delete failed:", dslug, e && e.message); }

    // AND THE OWNER'S CUSTOM DOMAINS. Left behind, each one is a hostname
    // still registered on our zone — BILLED PER HOSTNAME by Cloudflare for
    // SaaS — pointing at a site that no longer exists, and its row cascades
    // with the account rather than with the site, so nothing else would ever
    // find it. The same leak `neon_teardown` exists to stop, one resource
    // over.
    //
    // Cloudflare first and the row second, the same order as everything else
    // here: the row is the only record of the registration. Best-effort, and
    // NOT allowed to fail the delete — the site itself is already gone by
    // this point, and answering an error would tell the caller their site
    // survived when it did not.
    let domainsReleased = 0;
    try {
      const dr = await fetch(`${SUPABASE_URL}/rest/v1/site_domains?slug=eq.${encodeURIComponent(dslug)}&select=hostname,cf_id`, { headers: svcHeaders(env), signal: AbortSignal.timeout(10000) });
      for (const row of (await dr.json().catch(() => [])).slice(0, 20)) {
        if (row.cf_id) { const d = await cfHostname(env, "DELETE", "/" + encodeURIComponent(row.cf_id)); if (!d.ok && d.status !== 404) continue; }
        await fetch(`${SUPABASE_URL}/rest/v1/site_domains?hostname=eq.${encodeURIComponent(row.hostname)}`, { method: "DELETE", headers: svcHeaders(env) });
        hostRoutes.delete(row.hostname);
        domainsReleased++;
      }
    } catch (e) { console.error("domain release failed:", dslug, e && e.message); }

    return Response.json({ ok: true, slug: dslug, removed, versionsRemoved, projectDropped, domainsReleased });
}

async function handleRequest(request, env, ctx) {
    const url = new URL(request.url);

    // A PUBLISHED SITE ON THE OWNER'S OWN DOMAIN.
    //
    // Cloudflare for SaaS routes a registered custom hostname to this zone, so
    // the request arrives here with `Host: sharpfadebarbers.com` and a path of
    // `/`. Everything that serves that site already exists — it is the `/s/…`
    // branch far below — so this rewrites the path and lets the rest of the
    // Worker run exactly as it does today.
    //
    // FIRST, AND FREE WHEN THE HOST IS OURS. It is on every request to the
    // whole platform, so the hot path is one string comparison against the
    // zone list and no I/O whatsoever. `isOwnHostname` covers `gofarther.dev`,
    // `www.` and every subdomain, which is every hostname the app itself is
    // ever served on.
    //
    // `/api/*` IS DELIBERATELY LEFT ALONE. A published bundle calls its own API
    // same-origin, so on a custom domain that is
    // `sharpfadebarbers.com/api/db/<slug>/data/…`; the route matchers key on
    // the pathname and never the host, so they already work. Rewriting those
    // into `/s/<slug>/api/…` would break every one of them.
    // EVERY PUBLISHED SITE HAS AN AUTOMATIC ADDRESS: `<slug>.gofarther.app`.
    //
    // The same rewrite as the custom-domain branch below and deliberately the
    // same shape, but it needs NO lookup — the slug is in the hostname, so this
    // costs one string comparison and no I/O, where a custom domain costs a KV
    // read or a Supabase round trip. That matters because it is the address
    // every site gets by default and a custom domain is the exception.
    //
    // `/api/*` IS LEFT ALONE for the reason spelled out below: a published
    // bundle calls its own API same-origin, so on this zone that is
    // `<slug>.gofarther.app/api/db/<slug>/data/…`, and the route matchers key on
    // the pathname and never the host.
    // ONE PUBLIC ADDRESS PER SITE (owner's call 2026-08-09).
    //
    // `/s/<slug>/` stays as the INTERNAL address — it is what both rewrites
    // below produce and what the R2 lookup keys on, so it cannot go away — but
    // it is no longer an address to give anybody. A site with a pretty hostname
    // answers there and sends everybody to it.
    //
    // Two addresses serving byte-identical HTML is a real cost, not a tidiness
    // one: a search engine sees duplicate content and splits the ranking between
    // them, and every person who copies a link has to be given the right one of
    // two. It is also how the `/u/` bug survived — every automated check loaded
    // sites at `/s/<slug>/`, the one mount where uploads happened to work, so
    // nothing exercised the address customers are actually sent to.
    //
    // DECIDED BEFORE THE REWRITES AND KEYED ON THE ORIGINAL HOSTNAME, which is
    // the whole correctness argument. Those rewrites REPLACE the pathname with
    // `/s/<slug>/…`, so a request that arrived on the site zone looks identical
    // to one that arrived here by the time they are done — redirecting on the
    // path alone would bounce every site-zone request straight back to itself,
    // forever. `isAppHostname` is false for both the site zone and a custom
    // domain, so neither can reach this.
    //
    // A CUSTOM DOMAIN MUST NEVER LAND HERE for a second reason: an owner who
    // paid for `sharpfadebarbers.com` would have their visitors thrown onto our
    // hostname, which is the opposite of what they bought.
    //
    // Skipped when the slug has no pretty host — the zone dark, or a slug the
    // build filter allows and DNS does not (a leading or trailing hyphen). Those
    // sites keep `/s/<slug>/` and lose nothing, and offering an address that
    // cannot resolve would be worse than offering none.
    if (isAppHostname(url.hostname)) {
      const sm2 = url.pathname.match(/^\/s\/([a-z0-9][a-z0-9-]{0,80})(\/.*)?$/i);
      const pretty = sm2 && siteHostFor(sm2[1].toLowerCase());
      // 301 rather than 302: the point of the change is to tell crawlers which
      // of the two is canonical, and a temporary redirect does not consolidate
      // anything. The blast radius of that permanence is small because the panel
      // has shown only the pretty address since the zone went live — the callers
      // still using `/s/` are ours.
      if (pretty) return Response.redirect("https://" + pretty + (sm2[2] || "/") + url.search, 301);
    }

    const zoneSlug = siteHostSlug(url.hostname);
    if (zoneSlug && !servedAtRoot(url.pathname)) {
      url.pathname = "/s/" + zoneSlug + (url.pathname === "/" ? "/" : url.pathname);
      request = new Request(url.toString(), request);
    } else if (!zoneSlug && isOwnHostname(url.hostname) && !isAppHostname(url.hostname)
               && !url.pathname.startsWith("/api/")) {
      // The site zone's apex and its reserved labels — `gofarther.app` itself,
      // `www.`, `api.` and the rest. They are ours, so the branch below skips
      // them, and serving the whole workspace here would put the builder on a
      // second domain and split every sign-in cookie between the two.
      //
      // A redirect rather than a 404: somebody typing the bare domain wants the
      // product, and this is the only thing at that address worth showing them.
      //
      // `/api/` is excluded from the redirect as well as from the rewrite. A 301
      // on a POST is followed inconsistently — some clients re-send the body,
      // some turn it into a GET — so an API call that lands here answers for
      // itself through the ordinary router instead of being bounced.
      return Response.redirect("https://" + APP_ZONE + url.pathname + url.search, 301);
    }

    if (!isOwnHostname(url.hostname) && !servedAtRoot(url.pathname)) {
      const mapped = await siteForHostname(env, url.hostname);
      // A hostname Cloudflare routed to us with no row is a domain that was
      // removed, or one still being set up. 404 rather than falling through to
      // the app: serving the Go Farther workspace on a customer's domain is a
      // far more confusing outcome than a plain not-found.
      if (!mapped) return new Response("Not found", { status: 404 });
      url.pathname = "/s/" + mapped + (url.pathname === "/" ? "/" : url.pathname);
      request = new Request(url.toString(), request);
    }

    // Old full-app snapshots (public/demo-hero*) are kept in the repo as
    // reference but must NOT be served — they're pre-scrub clones that name the
    // provider and run against the live backend (owner 2026-07-18: keep the
    // files, stop serving them). The `-2`/`-3` numbered variants MUST be covered
    // too — demo-hero-2 is a full-app clone that still names the provider. Only
    // /demo-hero*; the marketing /mkt/demo* cascade is a different path, stays live.
    if (/^\/demo-hero(-\d+)?(\/|$)/i.test(url.pathname)) {
      return new Response("Not found", { status: 404 });
    }


    // Serve a PUBLISHED Website-Builder site from R2: gofarther.dev/s/<slug>/<page>.
    // STATIC sites: each page is one HTML object (rest with no extension → .html).
    // REACT sites: the compiled dist. A path WITH an extension (assets/x.js|css,
    // images, fonts) serves that exact object with its real content-type; an
    // extensionless one serves the page prerendered at that route if there is
    // one, and otherwise falls back to the app shell, which routes on the client.
    // Both shapes coexist under sites/<slug>/… ; only the key/content-type differ.
    {
      const sm = url.pathname.match(/^\/s\/([a-z0-9][a-z0-9-]{0,80})(?:\/(.*))?$/i);
      if (sm && env.SITES_BUCKET) {
        const slug = sm[1].toLowerCase();
        // A BARE /s/<slug> WITH NO TRAILING SLASH SERVED A BLANK PAGE. It answered
        // 200 with the right HTML — and that HTML references its bundle
        // RELATIVELY (`./assets/index-x.js`, which is what Vite emits), so from
        // `/s/hey` the browser resolves it to `/s/assets/index-x.js` and gets a
        // 404. The document loads, the script and stylesheet do not, and the
        // visitor sees white.
        //
        // It matters because `/s/hey` is how a person writes the link. Nothing in
        // the product produces the slashless form — the build response, the share
        // panel and the iframe all carry the slash — so this was only ever
        // reachable by somebody typing or pasting it, which is exactly what an
        // owner does when they tell a customer where their site is.
        //
        // `sm[2]` is undefined for `/s/hey` and "" for `/s/hey/`, so this is the
        // one case it fires on. The query survives, and so does any fragment —
        // the browser carries it across a redirect itself. That used to be the
        // load-bearing part, because the app routed on the hash; it routes on
        // real paths now and the redirect matters for a plainer reason: from
        // `/s/hey` the shell's own relative asset URLs resolve to `/s/assets/…`.
        if (sm[2] === undefined) {
          url.pathname = "/s/" + slug + "/";
          return Response.redirect(url.toString(), 301);
        }
        const rest = (sm[2] || "").replace(/\/+$/, "");
        const last = rest.split("/").pop() || "";
        const ext = (last.match(/\.([a-z0-9]{1,8})$/i) || [])[1];
        let key, ctype, immutable = false;
        if (rest === "") { key = "sites/" + slug + "/index.html"; ctype = "text/html; charset=utf-8"; }
        else if (ext) { key = "sites/" + slug + "/" + rest.replace(/[^a-z0-9/._-]/gi, "-"); ctype = R2_MIME[ext.toLowerCase()] || "application/octet-stream"; immutable = ext.toLowerCase() !== "html"; }
        else { key = "sites/" + slug + "/" + rest.replace(/[^a-z0-9/_-]/gi, "-") + ".html"; ctype = "text/html; charset=utf-8"; }
        let obj = await env.SITES_BUCKET.get(key);
        // THE SPA FALLBACK, AND IT IS WHAT MAKES REAL ADDRESSES POSSIBLE AT ALL.
        //
        // Without it, `/s/<slug>/book` looks for `book.html`, which vite never
        // emits, and 404s. That single 404 is why the template ran on
        // `createHashHistory()` and why every page of every published site had
        // the SAME address: a fragment never reaches a server, so search engines
        // saw one page per site, every shared link previewed the home page, and
        // `logSiteHit` recorded every view in the site's life as "/".
        //
        // ONLY FOR AN EXTENSIONLESS PATH, and that restriction is the whole
        // safety of it. A missing JS chunk must keep answering 404 — hand it
        // `index.html` instead and the browser gets HTML where it expected a
        // module, which fails later, somewhere else, with an error nobody can
        // read back to a deleted file. (That exact confusion is what a publish
        // race produces, so it is a real shape, not a hypothetical one.)
        //
        // A site that does not exist still 404s: the fallback is the app shell,
        // so with no shell there is nothing to fall back TO.
        if (!obj && !ext && rest !== "") {
          obj = await env.SITES_BUCKET.get("sites/" + slug + "/index.html");
          if (obj) { ctype = "text/html; charset=utf-8"; immutable = false; }
        }
        if (!obj) return new Response("Not found", { status: 404 });
        // The REAL path, which is the point: served through the fallback this is
        // `/book` rather than `/`, so per-page traffic becomes measurable for the
        // first time — the analytics panel needed no change, it was being fed one
        // value forever.
        if (request.method === "GET" && ctype.startsWith("text/html")) logSiteHit(env, ctx, slug, "/" + rest, request); // count real page views (not assets)

        // ── WHERE THE APP'S ASSETS REALLY ARE ────────────────────────────────
        //
        // vite builds with `base: "./"`, so the shell asks for
        // `./assets/index-<hash>.js`. A browser resolves that against the
        // DIRECTORY of the current URL — which is right at `/s/<slug>/book`
        // (`./` is `/s/<slug>/`) and WRONG at `/s/<slug>/shop/item`, where it
        // becomes `/s/<slug>/shop/assets/…` and every asset 404s. Route paths
        // may nest (`SAFE_PATH` allows it and the tool documents the directory
        // form), so that is a real shape, not a hypothetical one.
        //
        // ONLY THE WORKER CAN FIX THIS, which is why it is here and not at
        // publish time: the same bytes are served at `/s/<slug>/` on our domain
        // and at `/` on the owner's custom domain — the Host rewrite above turns
        // the second into the first — so no value baked into the file is correct
        // in both. `isOwnHostname` is what tells them apart, and it is the only
        // place that knows.
        //
        // Relative `base` is kept rather than replaced with an absolute one for
        // exactly the same reason: an absolute `/s/<slug>/` would 404 on every
        // custom domain.
        // ONE response below, so the header block cannot drift between an HTML
        // path and an asset path — only the BODY differs.
        let served = obj.body;
        if (ctype.startsWith("text/html")) {
          // `isAppHostname` AND NOT `isOwnHostname`, and the difference is the
          // whole bug this line can have. `isOwnHostname` covers both zones now,
          // so it is true for `<slug>.gofarther.app` — which would prefix every
          // asset with `/s/<slug>/` on a mount whose root is `/`, and every
          // script and stylesheet on every site on the new zone would 404.
          // Only the workspace serves a site under a path.
          const mountRoot = isAppHostname(url.hostname) ? "/s/" + slug + "/" : "/";
          served = (await obj.text()).replace(/(\s(?:src|href))="\.\//g, '$1="' + mountRoot);
        }
        return new Response(served, {
          headers: {
            "content-type": ctype,
            "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=60",
            "x-content-type-options": "nosniff",
            // WHY A PUBLIC FILE NEEDS A CORS HEADER, which reads as pointless
            // until you know what breaks: the builder's preview frame is
            // sandboxed WITHOUT `allow-same-origin`, so its origin is `null` and
            // every subresource it asks for is cross-origin. Vite emits the
            // bundle as `<script type="module" crossorigin>`, and a module script
            // is ALWAYS fetched in CORS mode — so with no header the script and
            // the stylesheet were both blocked and the preview was a white
            // rectangle. Measured: same site, two iframes, the only difference
            // being `allow-same-origin`.
            //
            // The alternative was adding `allow-same-origin` to the frame, and it
            // is the wrong one. These sites are served from gofarther.dev, so a
            // same-origin frame would give model-written page code read access to
            // the owner's own session in localStorage. The sandbox is deliberate;
            // this opens the file, not the origin.
            //
            // `*` is honest here — every object under /s/ is already served to
            // anybody who asks, with no credentials involved.
            "access-control-allow-origin": "*",
          },
        });
      }
      if (sm) return new Response("Not found", { status: 404 });
    }

    // Serve a PUBLISHED game from R2: gofarther.dev/g/<slug>/… — the compiled kaplay
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

    // Serve a builder DRAFT preview: gofarther.dev/preview/<uid>/<nonce>. The workspace
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

    // Serve a visitor-uploaded file from R2: gofarther.dev/u/<slug>/<file>. Public,
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
    // building) from R2: gofarther.dev/a/<siteId>/<file>. Same shape as /u/.
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

    // A SITE's own Stripe telling us one of its orders was paid. Separate from
    // /api/stripe/webhook, which is Go Farther's own billing: different account,
    // different signing secret, and mixing them would mean one handler deciding
    // whether an event mints platform credits or marks a barber shop's order.
    //
    // Unauthenticated, like the platform one and for the same reason — Stripe
    // cannot hold a session. What authenticates it is the HMAC over the raw
    // body, verified against THIS SITE'S OWN webhook secret, which the owner
    // pasted in. So a signature valid for one shop proves nothing about another.
    if (url.pathname.startsWith("/api/stripe/site/") && request.method === "POST") {
      const wm = url.pathname.match(/^\/api\/stripe\/site\/([a-z0-9][a-z0-9-]{0,80})$/i);
      if (wm) {
        const wslug = wm[1].toLowerCase();
        const wconn = await siteBackendBySlug(env, wslug);
        // 200 on an unknown slug, deliberately. Stripe retries a non-2xx for
        // days and disables an endpoint that keeps failing; a deleted site
        // whose owner left the endpoint registered would otherwise generate
        // retries forever. There is nothing to do and nothing was lost.
        if (!wconn) return Response.json({ ok: true, ignored: "no such site" });
        // The RAW body, not a parsed one: the signature is over exact bytes and
        // re-serialising JSON changes them.
        const raw = await request.text();
        let secret = null;
        try {
          secret = await readSecret({ get: async (_s, name) => {
            const rows = await sqlQuery(wconn, "SELECT cipher FROM _secrets WHERE name=?", [name]);
            return (rows && rows[0] && rows[0].cipher) || null;
          } }, env, { slug: wslug, name: "STRIPE_WEBHOOK_SECRET" });
        } catch (e) { console.error("wh secret:", wslug, e && e.message); }
        // FAILS CLOSED. Without the secret we cannot tell Stripe from anyone
        // else who found the URL, and this endpoint's whole job is to mark
        // things as paid.
        if (!secret) return Response.json({ error: "not configured" }, { status: 503 });
        const ver = await verifyStripeSignature({
          header: request.headers.get("Stripe-Signature") || "",
          raw, secrets: [secret], nowMs: Date.now(),
        });
        if (!ver.ok) return Response.json({ error: "bad signature" }, { status: 400 });
        let event = null;
        try { event = JSON.parse(raw); } catch { return Response.json({ error: "bad body" }, { status: 400 }); }
        const paid = paidFromEvent(event);
        if (!paid) return Response.json({ ok: true, ignored: true });
        // The event names its own slug, and it must be THIS one. The signature
        // already proves the sender holds this site's secret, so this is belt
        // and braces — but the alternative is a slug from a request body
        // reaching a connection lookup, and that is never worth leaving open.
        if (paid.slug !== wslug) return Response.json({ ok: true, ignored: "slug mismatch" });
        try {
          const sch = await loadSiteSchema(wconn);
          const t = (sch && Array.isArray(sch.tables) ? sch.tables : []).find((x) => String(x.name).toLowerCase() === paid.table && normalizePayment(x));
          if (!t) return Response.json({ ok: true, ignored: "not a payable table" });
          // Idempotent, and that is required rather than tidy: Stripe delivers
          // at least once and retries anything it does not get a 2xx for, so the
          // same event arrives more than once as a matter of course. The WHERE
          // makes a second delivery a no-op instead of a second `paid_at`.
          await sqlExec(
            wconn,
            `UPDATE ${sqlIdent(t.name)} SET payment_status='paid', payment_ref=?, paid_at=to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS') WHERE id=? AND payment_status<>'paid'`,
            [paid.ref, paid.orderId],
          );
        } catch (e) {
          // A 500 here makes Stripe retry, which is what we want: the money is
          // real and the row must eventually catch up.
          console.error("wh apply:", wslug, e && (e.detail || e.message));
          return Response.json({ error: "could not record that payment" }, { status: 500 });
        }
        return Response.json({ ok: true });
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
        // DECLARED OUTSIDE THE TRY, so the catch below can refund it. Inside,
        // `cost` is not in scope there — a `ReferenceError` on the one path that
        // gives a customer their credits back, which is this file's own most
        // repeated bug arriving in the fix for it.
        let cost = 0;
        try {
          emit({ ev: "phase", phase: "generating" });
          const genRules = engine === "3d" ? GAME_3D_RULES : (art === "sprites" ? GAME_ASSET_RULES : GAME_RULES);
          const g = await streamGen(genRules, "Build this game. Output ONLY the file blocks.\n\n" + brief, onDelta);
          flushCode(true);
          let files = parseGameFiles(g.text);
          if (!files["src/main.js"]) { emit({ ev: "error", msg: "the generated game came out incomplete — try again" }); return; }
          cost += gbCredits(g.usedIn, g.usedOut);
          try { await collectCredits(auth, gbCredits(g.usedIn, g.usedOut)); } catch {}
          // Phase 6: generate + cut out the AI sprites, bundle them into the build.
          let gameAssets = {};
          if (art === "sprites" && env.FAL_KEY) {
            emit({ ev: "phase", phase: "arting" });
            const ga = await injectGameAssets(files, env, 5);
            files = ga.files; gameAssets = ga.assets || {};
            const sc = Math.max(0, ga.charged) * Math.max(1, Math.ceil(SPRITE_IMG_USD / CREDIT_USD));
            if (sc) { cost += sc; try { await collectCredits(auth, sc); } catch {} }
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
            try { await collectCredits(auth, gbCredits(fg.usedIn, fg.usedOut)); } catch {}
            const fixed = parseGameFiles(fg.text);
            if (!Object.keys(fixed).length) break;
            Object.assign(files, fixed);
          }
          if (!bd.ok) {
            // OUR CONTAINER, OUR COST. The charges above are collected the
            // moment each generation returns, before anything is compiled, and
            // nothing here gave them back — so a container drained mid-bundle,
            // or one that answered "build service returned no JSON" because it
            // never started, kept 20-30 credits and delivered no game. There
            // was no refund on ANY failure branch of either game route, and
            // `/api/refund` covers fal jobs only, so it could never be undone.
            //
            // `build` IS AN OUR-FAULT STAGE by the platform's own rule, which
            // the site builder states and this route never adopted: nothing in
            // the error text separates a drained container from a genuine
            // bundler error, and being wrong toward free costs an occasional
            // real failure while being wrong the other way bills somebody for
            // our rollout. Through `refundCredits`, which chunks past
            // `credit_back`'s 10-credit cap — a full generation is well past it.
            await refundCredits(env, gu.id, cost).catch(() => {});
            emit({ ev: "error", stage: "build", msg: String(bd.error || "build failed").slice(0, 600), fixed: attempt, refunded: cost });
            return;
          }
          emit({ ev: "phase", phase: "publishing" });
          const seed = ((brief.toLowerCase().match(/[a-z0-9]+/g) || ["game"]).slice(0, 3).join("-").slice(0, 40)) || "game";
          const slug = seed + "-" + crypto.randomUUID().slice(0, 6);
          await writeGameDistToR2(env, slug, bd.files);
          try { await env.SITES_BUCKET.put("gamesrc/" + slug + ".json", JSON.stringify({ files, assets: gameAssets, uid: gu.id, engine }), { httpMetadata: { contentType: "application/json" } }); } catch {}
          let balAfter; try { balAfter = await readCredits(auth); } catch { balAfter = bal0 - cost; }
          emit({ ev: "done", url: "/g/" + slug + "/", slug, buildMs, fixed: attempt, smoke: bd.smoke || null, cost, balance: balAfter });
        } catch (e) {
          // A THROW AFTER THE CHARGE IS OURS TOO — `writeGameDistToR2` failing,
          // the R2 put, anything past the last generation. The customer has no
          // game and no way to ask for the credits back.
          //
          // Never on a 402: that IS the ledger refusing, so nothing was taken
          // and "refunding" it would be minting credits out of a failure to pay.
          if (cost > 0 && !(e && e.status === 402)) await refundCredits(env, gu.id, cost).catch(() => {});
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
        // DECLARED OUTSIDE THE TRY, so the catch below can refund it. Inside,
        // `cost` is not in scope there — a `ReferenceError` on the one path that
        // gives a customer their credits back, which is this file's own most
        // repeated bug arriving in the fix for it.
        let cost = 0;
        try {
          let files = { ...srcObj.files };
          // Phase 6: the game's sprite PNGs are re-bundled from the stash so a revise
          // rebuild keeps its art (assets aren't in the source, they're bundled files).
          const gameAssets = (srcObj.assets && typeof srcObj.assets === "object") ? srcObj.assets : {};
          emit({ ev: "phase", phase: "generating" });
          const g = await streamGen(engine === "3d" ? GAME_3D_RULES : GAME_REVISE_RULES, "CHANGE REQUEST: " + instruction + "\n\nCurrent game files:\n\n" + dumpFiles(files), onDelta);
          flushCode(true);
          cost += gbCredits(g.usedIn, g.usedOut);
          try { await collectCredits(auth, gbCredits(g.usedIn, g.usedOut)); } catch {}
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
            try { await collectCredits(auth, gbCredits(fg.usedIn, fg.usedOut)); } catch {}
            const fixed = parseGameFiles(fg.text);
            if (!Object.keys(fixed).length) break;
            Object.assign(files, fixed);
          }
          if (!bd.ok) {
            // OUR CONTAINER, OUR COST. The charges above are collected the
            // moment each generation returns, before anything is compiled, and
            // nothing here gave them back — so a container drained mid-bundle,
            // or one that answered "build service returned no JSON" because it
            // never started, kept 20-30 credits and delivered no game. There
            // was no refund on ANY failure branch of either game route, and
            // `/api/refund` covers fal jobs only, so it could never be undone.
            //
            // `build` IS AN OUR-FAULT STAGE by the platform's own rule, which
            // the site builder states and this route never adopted: nothing in
            // the error text separates a drained container from a genuine
            // bundler error, and being wrong toward free costs an occasional
            // real failure while being wrong the other way bills somebody for
            // our rollout. Through `refundCredits`, which chunks past
            // `credit_back`'s 10-credit cap — a full generation is well past it.
            await refundCredits(env, gu.id, cost).catch(() => {});
            emit({ ev: "error", stage: "build", msg: String(bd.error || "build failed").slice(0, 600), fixed: attempt, refunded: cost });
            return;
          }
          emit({ ev: "phase", phase: "publishing" });
          await writeGameDistToR2(env, slug, bd.files);
          try { await env.SITES_BUCKET.put("gamesrc/" + slug + ".json", JSON.stringify({ files, assets: gameAssets, uid: gu.id, engine }), { httpMetadata: { contentType: "application/json" } }); } catch {}
          let balAfter; try { balAfter = await readCredits(auth); } catch { balAfter = bal0 - cost; }
          emit({ ev: "done", url: "/g/" + slug + "/", slug, buildMs, fixed: attempt, smoke: bd.smoke || null, cost, balance: balAfter });
        } catch (e) {
          // A THROW AFTER THE CHARGE IS OURS TOO — `writeGameDistToR2` failing,
          // the R2 put, anything past the last generation. The customer has no
          // game and no way to ask for the credits back.
          //
          // Never on a 402: that IS the ledger refusing, so nothing was taken
          // and "refunding" it would be minting credits out of a failure to pay.
          if (cost > 0 && !(e && e.status === 402)) await refundCredits(env, gu.id, cost).catch(() => {});
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

    // Visitor accounts for a published site. These live in the SITE's own Neon
    // database, not in Supabase: the schema engine stamps `owner_id INTEGER` on
    // every `user`/`feed` table, so an account id has to be an integer from that
    // same database — and it keeps Supabase off the visitor path entirely, which
    // is the whole point of the routing work. Deleting a site takes its members
    // with it, because they were never anywhere else.

    // A visitor attaching a photo to a form. Unauthenticated for the same reason
    // the rest of /api/db is: a customer booking a haircut has no account.
    //
    // Which makes this a public endpoint that accepts arbitrary bytes and serves
    // them back from gofarther.dev, so the answer to "may I?" is narrow: the table
    // must be one a visitor can WRITE and must DECLARE somewhere to put a
    // picture. A barber shop whose booking form is six text fields accepts
    // nothing, which is the answer for most sites — and is what keeps this from
    // being open image hosting for anyone who knows a slug.
    // A published site's DATA, forwarded to its Neon Data API.
    //
    // Our own row routes were deleted 2026-07-30 (owner's call: Neon only, not
    // both). What is left is transport — this forwards and nothing else. There is
    // no access logic here, no schema allow-list and no scoping: the site's RLS
    // policies decide every one of those, which is the whole point of the move.
    //
    // Proxied rather than called from the page for the same three reasons the auth
    // proxy is: the bundle holds no URL and no key, it is same-origin so there is
    // no CORS and no cross-site cookie, and a generated page's URLs do not change.
    if (url.pathname.startsWith("/api/db/") && url.pathname.includes("/data/")) {
      const dm = url.pathname.match(/^\/api\/db\/([a-z0-9][a-z0-9-]{0,80})\/data\/([a-z0-9_][a-z0-9/._-]{0,79})$/i);
      if (dm) {
        const [, dslug2, dpath] = dm;
        const slug = dslug2.toLowerCase();
        const hit = _dataLimiter.hit(
          bucketKey({ ip: request.headers.get("CF-Connecting-IP") || "", slug, table: "data", method: request.method }),
          DATA_PROXY_PER_MIN,
        );
        if (!hit.ok) {
          const t = tooMany(hit);
          return Response.json(t.body, { status: t.status, headers: t.headers });
        }
        return proxySiteService(env, request, url, slug, dpath, "data", ctx);
      }
    }

    // A PUBLISHED SITE READING SOMEBODY ELSE'S API.
    //
    // Live delivery slots, today's exchange rate, a supplier's stock level, the
    // weather for an outdoor venue. Here for the usual two reasons: the key
    // cannot be in a public bundle and Postgres has no HTTP client.
    //
    // ONE PRIMITIVE, NOT A LIST OF INTEGRATIONS. The site declares the whole
    // request with `{{SECRET}}` placeholders; the Worker substitutes them out of
    // the site's own vault. A courier and a currency feed are the same feature.
    if (url.pathname.startsWith("/api/db/") && url.pathname.includes("/api/")) {
      const am2 = url.pathname.match(/^\/api\/db\/([a-z0-9][a-z0-9-]{0,80})\/api\/([a-z][a-z0-9_-]{0,40})$/i);
      if (am2) {
        if (request.method !== "GET") return Response.json({ error: "method not allowed" }, { status: 405 });
        const slug = am2[1].toLowerCase();
        const aname = am2[2].toLowerCase().replace(/-/g, "_");
        // THIS SPENDS THE OWNER'S THIRD-PARTY QUOTA on behalf of anyone who
        // finds the URL, so the limit is not a formality. Before any lookup.
        const ahit = _dataLimiter.hit(
          bucketKey({ ip: request.headers.get("CF-Connecting-IP") || "", slug, table: "extapi", method: "GET" }),
          SITE_API_PER_MIN,
        );
        if (!ahit.ok) {
          const t = tooMany(ahit);
          return Response.json(t.body, { status: t.status, headers: t.headers });
        }
        const adb = await siteBackendBySlug(env, slug);
        if (!adb) return Response.json({ error: "no such connection" }, { status: 404 });
        const spec = await loadSiteSchema(adb).catch(() => null);
        const api = apiFor(spec, aname);
        if (!api) return Response.json({ error: "no such connection" }, { status: 404 });
        const params = takeParams(api, url.searchParams);
        const out = await callApi(await siteApiDeps(env, slug, adb, api), { slug, api, params });
        // The owner's half of the story goes to the log, never to the visitor:
        // `missing` names a secret and `refused` names a destination.
        if (out.missing || out.refused) console.error("site api:", slug, aname, out.missing || out.refused);
        // ONLY status and body. `out` also carries those two fields, and
        // returning the whole object would put the name of the site's own
        // credential into a public response.
        return Response.json(out.body, { status: out.status });
      }
    }

    // SOMEBODY ELSE'S SYSTEM PUSHING DATA INTO A PUBLISHED SITE.
    //
    // The mirror of the outbound webhook: that one told the world something
    // happened here, this one lets the world tell the site. It exists in the
    // platform for the same two reasons everything else on this list does — it
    // needs an HTTP endpoint, which Postgres cannot serve, and it needs a shared
    // secret, which a public bundle cannot hold.
    //
    // What it does with the payload is NOT the platform's business: it is handed
    // to `hook_<name>(payload jsonb)`, a function the model wrote at build time.
    // No field mapping here, no menu of verbs.
    if (url.pathname.startsWith("/api/db/") && url.pathname.includes("/hook/")) {
      const hm = url.pathname.match(/^\/api\/db\/([a-z0-9][a-z0-9-]{0,80})\/hook\/([a-z][a-z0-9_-]{0,40})$/i);
      if (hm) {
        // POST only, and 405 rather than 404: a sender misconfigured to GET
        // should learn that, where a stranger guessing names should not.
        if (request.method !== "POST") return Response.json({ error: "method not allowed" }, { status: 405 });
        const slug = hm[1].toLowerCase();
        const hname = hm[2].toLowerCase().replace(/-/g, "_");
        const hdb = await siteBackendBySlug(env, slug);
        if (!hdb) return Response.json({ error: "no such hook" }, { status: 404 });
        // READ THE RAW BYTES. An HMAC is over exactly what was sent, and
        // re-serialising a parse changes key order and whitespace — every real
        // signature would fail while every hand-built test payload passed.
        const raw = await request.text();
        const out = await handleInbound(inboundDeps(env, slug, hdb), {
          slug, name: hname, headers: request.headers, body: raw,
          // CF-Connecting-IP only: the `X-Forwarded-For` fallback used
          // elsewhere is client-settable, so a caller varying it mints a fresh
          // rate-limit bucket per request.
          ip: request.headers.get("CF-Connecting-IP") || "",
        });
        return Response.json(out.body, {
          status: out.status,
          headers: out.retryAfter ? { "retry-after": String(out.retryAfter) } : undefined,
        });
      }
    }

    // THE ONE PART OF SPAM PROTECTION THAT IS MEANT TO BE PUBLIC.
    //
    // Turnstile's SITE key belongs in the page — that is how the widget is
    // designed, and it is why only half of this is ours. Serving it from here
    // rather than baking it into the bundle means switching protection on takes
    // effect on the next page load instead of needing a rebuild, which costs a
    // model call and credits.
    //
    // It answers `{}` for the overwhelming majority of sites, which is what
    // makes the widget inert until an owner configures one. The SECRET is never
    // returned and is never even asked for on this path.
    if (url.pathname.startsWith("/api/db/") && url.pathname.endsWith("/turnstile")) {
      const tm = url.pathname.match(/^\/api\/db\/([a-z0-9][a-z0-9-]{0,80})\/turnstile$/i);
      if (tm) {
        if (request.method !== "GET") return Response.json({ error: "method not allowed" }, { status: 405 });
        const slug = tm[1].toLowerCase();
        // Rate limited like every other public /api/db dispatch. A cache miss
        // here is a SQL read plus a decrypt, so "it is only a public key" is not
        // a reason to leave it unbounded. Shares the read budget, since that
        // budget exists to protect Neon compute.
        const thit = _dataLimiter.hit(
          bucketKey({ ip: request.headers.get("CF-Connecting-IP") || "", slug, table: "turnstile", method: "GET" }),
          DATA_PROXY_PER_MIN,
        );
        if (!thit.ok) {
          const t = tooMany(thit);
          return Response.json(t.body, { status: t.status, headers: t.headers });
        }
        const tdb = await siteBackendBySlug(env, slug);
        if (!tdb) return Response.json({}, { status: 404 });
        let key = "";
        try { key = (await turnstileConfig(slug, env, tdb)).siteKey || ""; } catch { /* unconfigured */ }
        // Cached at the edge as well: it changes about once in the life of a
        // site, and every visitor to every page asks for it.
        return Response.json(key ? { siteKey: key } : {}, { headers: { "cache-control": "public, max-age=60" } });
      }
    }

    // A published site's sign-in. Public by the same reasoning as the rest of
    // /api/db — a customer booking a haircut has no Go Farther account — and gated by
    // a per-source rate limit, because it is an unauthenticated endpoint that
    // reaches a third party and costs a password hash on their side.
    if (url.pathname.startsWith("/api/db/") && url.pathname.includes("/auth/")) {
      const am = url.pathname.match(/^\/api\/db\/([a-z0-9][a-z0-9-]{0,80})\/auth\/([a-z0-9][a-z0-9/._-]{0,79})$/i);
      if (am) {
        const [, aslug, apath] = am;
        const slug = aslug.toLowerCase();
        // CF-Connecting-IP only. The X-Forwarded-For fallback the rest of this
        // file uses is client-settable, so honouring it lets one caller mint a
        // fresh bucket per request and defeats the limit entirely.
        const hit = _dataLimiter.hit(
          bucketKey({ ip: request.headers.get("CF-Connecting-IP") || "", slug, table: "auth", method: "POST" }),
          AUTH_PROXY_PER_MIN,
        );
        if (!hit.ok) {
          const t = tooMany(hit);
          return Response.json(t.body, { status: t.status, headers: t.headers });
        }
        return proxySiteService(env, request, url, slug, apath, "auth");
      }
    }

    // A visitor paying by card. Public and unauthenticated for the same reason
    // the rest of /api/db is: somebody buying a knife has no account here.
    //
    // This is the ONLY way a row in a payable table can be created — grantsFor
    // gives such a table no public INSERT — so everything that decides what is
    // owed happens on this side of the wire.
    if (url.pathname.startsWith("/api/db/") && url.pathname.endsWith("/checkout")) {
      const cm = url.pathname.match(/^\/api\/db\/([a-z0-9][a-z0-9-]{0,80})\/checkout$/i);
      if (cm) {
        if (request.method !== "POST") return Response.json({ error: "method not allowed" }, { status: 405 });
        const cslug = cm[1].toLowerCase();
        // Before the body is read and before anything is looked up: this
        // endpoint reaches Stripe, so an unlimited one spends someone else's
        // rate budget from our origin. CF-Connecting-IP only — the
        // X-Forwarded-For fallback used elsewhere is client-settable and would
        // let one caller mint a fresh bucket per request.
        const chit = _dataLimiter.hit(
          bucketKey({ ip: request.headers.get("CF-Connecting-IP") || "", slug: cslug, table: "checkout", method: "POST" }),
          CHECKOUT_PER_MIN,
        );
        if (!chit.ok) { const t = tooMany(chit); return Response.json(t.body, { status: t.status, headers: t.headers }); }
        const cconn = await siteBackendBySlug(env, cslug);
        if (!cconn) return Response.json({ error: "no such site" }, { status: 404 });
        try {
          return await handleCheckout({
            env, conn: cconn, slug: cslug,
            body: await request.json().catch(() => ({})),
            origin: url.origin,
            schema: await loadSiteSchema(cconn),
          });
        } catch (e) {
          // Never echoed: a Stripe error can quote the request, and the request
          // carries the site's own line items; a Postgres error quotes the
          // statement. Logged so a failing shop is diagnosable from our side.
          console.error("checkout:", cslug, e && (e.detail || e.message));
          return Response.json({ error: "we couldn't start that payment — please try again" }, { status: 502 });
        }
      }
    }

    if (url.pathname.startsWith("/api/db/") && url.pathname.endsWith("/uploads")) {
      const vm = url.pathname.match(/^\/api\/db\/([a-z0-9][a-z0-9-]{0,80})\/uploads$/i);
      if (vm) {
        if (request.method !== "POST") return Response.json({ error: "method not allowed" }, { status: 405 });
        if (!env.SITES_BUCKET) return Response.json({ error: "storage not configured" }, { status: 501 });
        const vslug = vm[1].toLowerCase();
        const conn = await siteBackendBySlug(env, vslug);
        if (!conn) return Response.json({ error: "no such site" }, { status: 404 });
        // Checked before the body is read: a flood should not get us to buffer
        // megabytes before being told no.
        const cl = Number(request.headers.get("content-length") || 0);
        if (cl && cl > MAX_VISITOR_UPLOAD_BYTES) return Response.json({ error: "that image is too big — keep it under 2 MB", code: "too_big" }, { status: 413 });
        try {
          const vr = await handleVisitorUpload({
            tableFor: async (s2, t) => {
              const spec = await loadSiteSchema(conn);
              return (spec && Array.isArray(spec.tables) ? spec.tables : [])
                .find((x) => x && String(x.name).toLowerCase() === String(t || "").toLowerCase()) || null;
            },
            throttle: async (key) => _dataLimiter.hit(key, VISITOR_UPLOADS_PER_MIN),
            hash: async (bytes) => {
              const d = await crypto.subtle.digest("SHA-256", bytes);
              return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
            },
            list: (s2) => siteUploadList(env, s2),
            put: (key, bytes, ct, meta) => env.SITES_BUCKET.put(key, bytes, { httpMetadata: { contentType: ct }, ...(meta ? { customMetadata: meta } : {}) }),
          }, {
            slug: vslug,
            table: url.searchParams.get("table"),
            // CF-Connecting-IP only — X-Forwarded-For is client-settable, so
            // honouring it would let one caller mint a fresh bucket per request.
            ip: request.headers.get("CF-Connecting-IP") || "",
            bytes: new Uint8Array(await request.arrayBuffer()),
          });
          return Response.json(vr.body, { status: vr.status });
        } catch (e) {
          console.error("visitor upload failed:", vslug, (e && (e.stack || e.message)) || e);
          return Response.json({ error: "couldn't store that just now" }, { status: 500 });
        }
      }
    }


    // IS THIS A QUESTION OR A BUILD? Asked before every builder message, because
    // until 2026-08-08 nothing asked at all: `siteSend` had one decision in it
    // and every message on an existing site ran a full revise. "can you read a
    // URL?" cost ~21 credits AND rewrote the customer's pages.
    //
    // Charged on measured usage like every other model call — this is the
    // "every time a model is used, charge for it" rule, and a routing call is
    // not exempt from it for being cheap. ~0.3 credits.
    //
    // NEVER 5xx. A failure here answers `intent: "build"` with a 200, so the
    // client proceeds down the path that already works. This route is an
    // optimisation in front of a working pipeline and must not become a way for
    // the pipeline to stop running.
    if (url.pathname === "/api/site/route" && request.method === "POST") {
      const ru = await authUser(request, env);
      if (!ru) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
      // Same backstop as the build route, sized for what this carries: a
      // message, a brief, a names-only digest and a QA list. 2MB is ~50x the
      // largest real payload seen.
      { const tlR2 = tooLargeBody(request, 2_000_000); if (tlR2) return tlR2; }
      let rb = {};
      try { rb = await request.json(); } catch { rb = {}; }
      const auth = request.headers.get("Authorization") || "";
      // BEFORE the model call, and the only thing that can refuse it. A balance
      // read rather than a debit: the charge is settled afterwards on real usage,
      // and a call this small does not warrant the deposit-and-settle dance the
      // schema call needs.
      //
      // A ZERO BALANCE AND AN UNREADABLE ONE ARE DIFFERENT ANSWERS, and reading
      // them as one turned every ledger blip into "nobody may ask a question".
      // It was `catch { rBal = 0 }`, so an unreachable Supabase looked exactly
      // like an empty account: the router was skipped, the message became a
      // build, and that build then failed on its own gate against the same
      // unreadable ledger — so a question got an error about credits instead of
      // an answer, for a reason that had nothing to do with either.
      //
      // This one call fails OPEN, deliberately, against the usual rule. The
      // rule exists to stop an expensive model call being made for somebody who
      // cannot pay; this is the cheapest call in the platform (~$0.0026) and
      // `collectCredits` below already tolerates a ledger that will not answer.
      // Nothing expensive escapes either way — the build behind it still meets
      // its own gate, which still fails closed.
      let rBal = null;
      try { const n = await readCredits(auth); rBal = Number.isFinite(n) ? n : null; } catch { rBal = null; }
      if (rBal !== null && !(rBal > 0)) {
        // Out of credits is not a reason to refuse to BUILD — the build path has
        // its own gate and its own 402, with a message about the thing they were
        // actually trying to do. Falling through keeps one place that says
        // "you're out of credits" instead of two that can disagree.
        return Response.json({ ok: true, intent: "build", cost: 0 });
      }
      const routed = await routeMessage(
        { send: (req) => anthropicMessages(env, req) },
        {
          message: rb.message,
          site: rb.site,
          // THE CLARIFY GATE, and it is deliberately the SERVER's and not the
          // client's. `firstBuild` says a project has no pages yet; `qa` is what
          // has already been asked and answered this round. Both arrive in the
          // body, so both are caller-controlled — which is exactly why
          // `routeMessage` spends the budget in arithmetic rather than believing
          // anybody. A caller that lies about `qa` gets fewer questions, never
          // more.
          firstBuild: rb.firstBuild === true,
          brief: rb.brief,
          qa: rb.qa,
          // THE MESSAGE IS AN ANSWER TO OUR OWN QUESTION — a clicked option, or
          // a typed reply while one is live. It closes "ask" off as an outcome,
          // because answering somebody's third button press with "tell me about
          // your business" is a dead end, and it shipped as one. Strictly
          // `=== true`, like `firstBuild` beside it: nothing merely truthy off a
          // public body changes how a paid call is read.
          answering: rb.answering === true,
          // A FILE CAME WITH THE MESSAGE. Same effect as `answering` — "ask" is
          // closed off, "clarify" is not — and a separate flag because it is a
          // different fact. Before this, an attachment skipped the routing call
          // altogether, so a first build with a logo attached was never asked
          // anything, against the rule that every new project gets one question.
          attached: rb.attached === true,
          // DOES THIS PROJECT ALREADY HAVE A SITE — the flag that opens `edit`
          // and `addon` at all, and the one that stops a colour change on a live
          // site costing a full rewrite of every page.
          //
          // TAKEN ON TRUST HERE, DELIBERATELY, because a routing answer is not a
          // permission. Neither direction of a lie is worth a round trip: claim
          // a site that is not yours and the edit route's `assertOwner` answers
          // 404 and the client falls back to the build it would have run anyway;
          // claim you have none and you rebuild your own site with your own
          // credits, which is exactly what happened before these rungs existed.
          //
          // ONE OWNERSHIP MECHANISM, NOT TWO THAT CAN DISAGREE — the rule this
          // file already follows for analytics. A first draft verified it here
          // as well and was WRONG in a way nothing would have caught:
          // `siteBackendBySlug` returns the connection STRING, so reading a
          // `.uid` off it is always undefined and the two new rungs would have
          // been silently unreachable for every customer.
          hasSite: rb.hasSite === true,
        },
      );
      let rCost = 0;
      // Billed only when the model actually answered. `routeMessage` returns a
      // null usage on the failure path precisely so this reads the same way the
      // build path does: our fault, our cost.
      if (routed.usage) {
        rCost = pageCredits(routed.usage);
        try { rCost = await collectCredits(auth, rCost); } catch { rCost = 0; /* never fail a route over the ledger */ }
      }
      return Response.json({
        ok: true,
        intent: routed.intent,
        answer: routed.intent === "ask" ? routed.answer : undefined,
        // WHICH LAYER, AND WHICH PAGE — and without them the entire edit lane is
        // unreachable. Measured live 2026-08-11, first run of `edit smoke`:
        // `intent=edit layer=undefined`. `readEdit` decides the layer, this
        // response dropped it, `siteEdit` posted `layer: ''`, and the edit route
        // could dispatch to none of its four branches. Four layers, a router
        // that picks between them correctly, and one missing field between them.
        //
        // The wiring layer for the tenth recorded time, and the reason the live
        // run exists: 2091 unit tests all passed, because every one of them
        // drives `readRouting` directly and worker.js cannot be imported.
        layer: routed.intent === "edit" ? routed.layer : undefined,
        page: routed.intent === "edit" ? routed.page : undefined,
        // AND WHETHER THE PAGE IS BEING TAKEN AWAY — the SAME BUG as the two
        // fields above it, in the same object, found the same way, and never
        // added when they were. `readEdit` sets `remove: true`, `public/chat.js`
        // reads `d.remove === true` and posts it on, and this response dropped
        // it in between: BOTH HALVES CORRECT, the wire cut.
        //
        // So page deletion has been unreachable in the product since it shipped,
        // and `rmRoute.remove` was `undefined` on every live run no matter what
        // the model answered. Five prompt rewrites tonight were chasing a field
        // that could not have arrived — and from outside, "the model did not set
        // it" and "we did not forward it" are the same `undefined`.
        //
        // The wiring layer for the ELEVENTH recorded time in this file.
        //
        // The `intent === "edit"` half is BELT-AND-BRACES and says so rather
        // than being deleted or pretended-to-be-tested: `readEdit` is the only
        // thing that sets `remove`, and it only runs on the edit path, so a
        // mutation removing this gate changes no answer and survives the suite.
        // Kept because its two siblings above are gated the same way and because
        // it holds by a property of another function one file over — the shape
        // this repo keeps a note for instead of a false assertion.
        remove: routed.intent === "edit" && routed.remove === true ? true : undefined,
        // The question to put in front of the build, already cleaned into
        // something renderable — two to four options, deduped, capped. The
        // client shows it verbatim rather than re-deciding anything, so there is
        // one place that judges whether a question is usable.
        question: routed.intent === "clarify" ? routed.question : undefined,
        cost: rCost,
        usage: routed.usage || undefined,
        // WAS THIS A DECISION OR A FALLBACK? `routeMessage` computes failed:true
        // when the routing model itself threw, and this response dropped it — so
        // an Anthropic outage answered {ok:true, intent:"addon"} wearing the
        // exact costume of a real routing answer, and CLAUDE.md records the
        // diagnosis cost of exactly that (2026-08-12: a billing outage read as a
        // router bug). This route never 5xxs by design, which makes a response
        // field the ONLY possible signal. Absent on success, so a working
        // route's response is byte-identical to before (2026-08-13 audit).
        failed: routed.failed === true || undefined,
      });
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
      // THE TRACE, started BEFORE the auth check rather than after it. `authUser`
      // is a round trip to GoTrue — a real network call on every build — and
      // starting the trace below it put that call outside `totalMs` entirely, so
      // the reported total was not the time the caller actually waited.
      // Costs two Date.now() calls a step and cannot throw — see builder/trace.mjs.
      const tr = makeTrace();
      const bu = await authUser(request);
      if (!bu) return UNAUTHED();
      if (!siteDbConfigured(env)) return Response.json({ ok: false, error: "site database not configured", need: "NEON_API_KEY" }, { status: 501 });
      if (!env.SUPABASE_SERVICE_KEY) return Response.json({ ok: false, error: "service key not configured" }, { status: 501 });
      if (!env.ANTHROPIC_API_KEY) return Response.json({ ok: false, error: "generator not configured" }, { status: 501 });
      // CAPPED BEFORE BUFFERING, like every other body-taking route — this one
      // was the exception (2026-08-13 audit): /api/direct, /api/save and even
      // the unauthenticated visitor upload all check Content-Length first,
      // while the priciest route on the platform buffered and JSON-parsed
      // whatever arrived, up to the plan limit, inside a 128MB isolate whose
      // other occupants are other customers' requests. Legitimate build
      // payloads top out ~12MB (three images and a PDF); 24MB is double that.
      { const tlB = tooLargeBody(request, 24_000_000); if (tlB) return tlB; }
      tr.at("auth");
      const body = await request.json().catch(() => ({}));
      tr.at("body");
      // Revise sends {slug, instruction} for an existing site; build sends
      // {brief}. Re-applying a schema is safe (all its DDL is additive or
      // IF NOT EXISTS), so both take the same path.
      // WHAT THEY WERE ASKED BEFORE THE BUILD, folded back in. `clarifiedBrief`
      // is a no-op when nothing was asked, which is every revise and every build
      // that went straight through — so this changes no request that did not use
      // the feature. Composed HERE and not in the composer, because the composer
      // cannot import the module and a second copy of a prompt fragment is two
      // things that can disagree about what the designer reads.
      const brief = clarifiedBrief(
        String(body.brief || body.prompt || body.instruction || "").trim().slice(0, 4000),
        body.qa,
      ).slice(0, 5000);

      // WHICH MODELS THIS BUILD RUNS ON — the composer's Builder picker, which
      // was sent on every build from the day it shipped and read here on none of
      // them. Resolved ONCE, before either call, so the designer and the pages
      // cannot end up on models chosen by two different readings of one field.
      // An unknown value resolves to the default; see `modelsFor`.
      //
      // `body.effort` stays unread, on purpose (owner's call): the Effort control
      // is visible and inert, and this comment is the difference between that
      // being a decision and looking like an oversight.
      const models = modelsFor(body.picker);

      // WHAT THE USER ATTACHED, sorted into what the model can be shown
      // (images, PDFs), what it can be told (text files, folded into the brief),
      // and what it cannot be given at all. The composer has always sent these
      // and nothing has ever read them — see `attachments` for what that meant
      // in practice, and for why the third pile has to be reported rather than
      // dropped.
      const attached = attachments(body.images);

      // READING THE LINKS IN THE BRIEF. No model call, so no gate: if there is a
      // URL in there, somebody meant us to look at it.
      //
      // BEFORE the designer, deliberately. A linked page is mostly evidence
      // about what a site STORES — a menu, a price list, a booking form — and
      // the designer is the step that decides the tables. Reading it afterwards
      // would leave the schema guessing from the domain name, which is the
      // failure this whole change exists to fix.
      //
      // The cost is that it sits on the critical path: at most two fetches,
      // twelve seconds each, and only on a brief that contains a link.
      let linked = [];
      if (brief) {
        try { linked = await readLinkedPages(brief, { readUrl: siteReadUrl }); }
        catch (e) { console.error("link read failed:", e && e.message); linked = []; }
        if (linked.length) tr.at("links", { n: linked.length, ok: linked.filter((p) => p.ok).length });
      }
      // What the DESIGNER sees. Page generation gets this plus the researched
      // facts, which do not exist yet.
      // The designer sees the linked pages AND any attached text file: a menu or
      // a price list is evidence about what the site STORES, which is the
      // question this next step answers.
      const briefWithLinks = (linked.some((p) => p.ok) || attached.texts.length)
        ? contextBrief(brief, { pages: linked, files: attached.texts })
        : brief;

      // A brief means "design the schema"; an explicit schema skips the model.
      let designed = null, seedUsage = null, seedTopUp = null;
      // OUT HERE BESIDE `designed`, AND FOR THE SAME REASON — it is read at the
      // look merge, hundreds of lines below the block that fills it in. Declared
      // inside that block it is a ReferenceError on every build, which is the
      // `vidRefN` failure exactly: `node --check` passes, esbuild passes, and no
      // test can import a Worker entrypoint. Caught here by the scope scanner
      // written after that one, on the first run — "declared at 8562, block
      // closes at 8639, read at 8878".
      let editState = null;
      // NOW BILLED ON — owner's call 2026-08-08, "every time a model is used it
      // needs to charge on our price model". This used to say "MEASURED, NOT
      // BILLED ON", which was the right caution at the time (a measurement
      // should not quietly become a price change) and the measurement is what
      // made the decision possible.
      let schemaUsage = null;
      // What the schema step actually took, after settling the deposit below.
      // Reported separately from the pages cost because they are different calls
      // to different models, and one number cannot answer which one moved.
      let schemaCost = 0;
      if (!body.schema) {
        if (!brief) return Response.json({ ok: false, error: "no brief" }, { status: 400 });
        // A DEPOSIT, NOT THE PRICE. Taken before the call because `use_credits`
        // is atomic and row-locking and is the only thing that stops an empty
        // account starting a paid model call — a plain balance read races. Once
        // the call returns, `schemaSettlement` trues it up against what the call
        // really consumed: the fee is a gate, the usage is the bill. Refunded in
        // full if the call produces nothing usable, exactly as before.
        let balanceAfter;
        try {
          balanceAfter = await useCredits(request.headers.get("Authorization") || "", SITE_BUILD_FEE);
        } catch {
          return Response.json({ ok: false, msg: "Credits check failed — try again in a moment." }, { status: 503 });
        }
        if (!(balanceAfter >= 0)) return Response.json({ ok: false, error: "not enough credits", need: "credits", cost: SITE_BUILD_FEE }, { status: 402 });
        // ENOUGH FOR THE WHOLE BUILD, not just for the deposit — the gap the
        // Builder picker fell straight into. `use_credits` returns the balance
        // AFTER taking the fee, so this is the real ledger value and needs no
        // second read that could race; a concurrent build slipping past it just
        // lands in the old behaviour rather than in something new.
        //
        // Refunds the deposit, because nothing has been spent yet: this is a
        // refusal, not a failure. The message names the cheaper picker, since
        // "top up" is not the only way out and is the less useful one.
        const floor = buildFloor(models.design);
        if (balanceAfter + SITE_BUILD_FEE < floor) {
          await creditBack(env, bu.id, SITE_BUILD_FEE);
          return Response.json({
            ok: false,
            error: "not enough credits",
            need: "credits",
            cost: floor,
            msg: models.picker === "opus"
              ? "An Opus build needs about " + floor + " credits and you have " +
                (balanceAfter + SITE_BUILD_FEE) + ". Switch the Builder to Sonnet 5, or top up."
              : "A build needs about " + floor + " credits and you have " +
                (balanceAfter + SITE_BUILD_FEE) + ".",
          }, { status: 402 });
        }
        // The credit gate is a Supabase round trip and it was folded into the
        // model call's time, which is the one number here nobody should be
        // guessing about.
        tr.at("gate");

        // WHAT THE SITE IS NOW — read BEFORE the model call, because it is an
        // input to it. An edit was never told it was an edit: the designer got
        // `body.instruction` and nothing else, believed it was designing from
        // scratch, and returned a brand and a description invented from a
        // fragment which then became the <title> and the link preview.
        //
        // ON AN EDIT ONLY, and gated on the caller naming a slug we can resolve.
        // A first build has nothing to read and adds no round trip.
        //
        // BEST-EFFORT, AND FAILING MEANS "NOT INSTRUCTED". `editState` staying
        // null is what makes `mergeLook` keep the OLD precedence below — so a
        // Neon blip degrades to exactly the behaviour that shipped before this,
        // rather than to a designer that was never told to omit and whose answer
        // now wins. The interlock is the point; see site-edit.mjs.
        const editSlug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
        if (editSlug) {
          try {
            const conn = await siteNeonProject(env, editSlug);
            if (conn) {
              const rows = await sqlQuery(conn, "SELECT k, v FROM _meta WHERE k IN ('site_look','schema')");
              let stored = null, storedSchema = null;
              for (const r of rows || []) {
                if (r.k === "site_look" && r.v) stored = JSON.parse(r.v);
                if (r.k === "schema" && r.v) storedSchema = JSON.parse(r.v);
              }
              if (stored) {
                editState = {
                  ...stored,
                  tables: (storedSchema && Array.isArray(storedSchema.tables) ? storedSchema.tables : [])
                    .map((t) => t && t.name).filter(Boolean),
                };
              }
            }
          } catch (e) { console.error("edit state read failed:", editSlug, e && e.message); }
        }

        try {
          const dz = await designSiteSchema(env, briefWithLinks, models.design, editState, attached.blocks);
          designed = dz && dz.input;
          schemaUsage = (dz && dz.usage) || null;
          tr.at("design", schemaUsage ? { out: schemaUsage.out, in: schemaUsage.in } : undefined);
          // STARTER ROWS THE DESIGNER DID NOT WRITE. `seed` is a required field
          // on its tool and the model omits it anyway — measured on two
          // consecutive builds — and nothing noticed, so the site published with
          // an empty price list and a booking form whose Service select had no
          // options at all. Permanently: nothing can write to a `display` table
          // after this point.
          //
          // HERE, NOT AT THE SEEDING STEP, for two reasons. It is before the
          // settlement, so the one deposit trues up against BOTH calls instead
          // of a second charge with its own rounding; and it is before
          // provisioning, so a build that never gets a database has not paid for
          // rows it will not use. `designed.tables` is the right thing to read
          // even on a revise — a revise declares only what it is changing, which
          // is exactly the set that could contain a new unfilled table.
          if (designed) {
            const top = await topUpSeed(
              { send: (req) => anthropicMessages(env, req) },
              { brief: briefWithLinks, spec: designed, seed: designed.seed },
            );
            if (top.gaps.length) {
              seedTopUp = { gaps: top.gaps, filled: Object.keys(top.rows) };
              // NOT the route's `slug` — that const is declared ~140 lines
              // below, so naming it here is a temporal-dead-zone ReferenceError
              // thrown on EXACTLY the branch this module exists for (a build
              // whose designer skipped the seed), landing in the design catch
              // as a 503 wearing a model-outage message. Found by the
              // 2026-08-13 audit; it had never fired live only because no run
              // yet had a gap. The log names the site from what is in hand.
              console.log("seed top-up:", (body && body.slug) || (designed && designed.slug) || "?", JSON.stringify(seedTopUp));
            }
            if (Object.keys(top.rows).length) designed = { ...designed, seed: mergeSeed(designed.seed, top.rows) };
            seedUsage = top.usage;
            if (top.usage) tr.at("seedrows", { out: top.usage.out, in: top.usage.in });
          }
          // SETTLE THE DEPOSIT. Positive: the call cost more than the fee, take
          // the difference. Negative: it cost less, give the difference back —
          // bounded by the deposit itself, so it can never exceed `credit_back`'s
          // 10-credit ceiling however the price table moves. Neither is allowed
          // to fail the build: the schema is in hand and the database is about to
          // be built on it, and losing that over a ledger round trip would be a
          // far more expensive failure than a credit in either direction.
          const settle = schemaSettlement([schemaUsage, seedUsage], SITE_BUILD_FEE);
          schemaCost = SITE_BUILD_FEE + settle;
          if (settle > 0) {
            // COLLECT, not just ask. `use_credits` refuses a bill larger than
            // the balance and debits zero, so the settlement has to report what
            // it really took or `schemaCost` becomes a number nobody was charged.
            try { schemaCost = SITE_BUILD_FEE + await collectCredits(request.headers.get("Authorization") || "", settle); }
            catch { schemaCost = SITE_BUILD_FEE; /* keep the build */ }
          } else if (settle < 0) {
            await creditBack(env, bu.id, Math.min(SITE_BUILD_FEE, -settle));
          }
        } catch (e) {
          await creditBack(env, bu.id, SITE_BUILD_FEE);
          console.error("schema design failed:", e && (e.detail || e.message));
          // `upstream` is the numeric status from the model API and nothing else
          // — never `detail`, which echoes back parts of the request. It is the
          // difference between "they are overloaded, retry" (429/529) and "we
          // are sending something they reject" (400), and without it a total
          // outage of the builder's main path is indistinguishable from a busy
          // minute. This one hid for three merges behind exactly that.
          const kind = upstreamKind(e && e.detail);
          return Response.json({
            ok: false,
            msg: e && e.truncated
              ? "That brief needs more room than the designer had — try describing fewer things to store."
              // Named, because it is the one failure here that no amount of
              // retrying fixes and that somebody can actually go and act on.
              : kind.billing
                ? "The site builder is temporarily unavailable — this is on us, not your brief."
                : "The designer is busy — try again in a moment.",
            stage: "design",
            upstream: (e && e.status) || null,
            // The provider's own error TYPE, shape-checked. Never its message,
            // which a 400 can fill with the request.
            upstreamType: kind.type,
            // THE ERROR'S CLASS, WHICH IS THE ONLY THING THAT SPEAKS WHEN THERE
            // WAS NO HTTP RESPONSE AT ALL. `upstream` and `upstreamType` are
            // both read off a response body, so a `fetch` that throws — a
            // network fault, a DNS blip, an aborted connection — leaves BOTH
            // null and the reply says nothing whatsoever about what happened.
            // Measured 2026-08-12: a run failed here twice against a Worker
            // byte-identical to one that had passed eleven minutes earlier, and
            // the response could not distinguish "the network dropped" from "we
            // threw". The class can: a `TypeError` is the fetch, anything else
            // is ours.
            //
            // A NAME IS A CLASS AND CANNOT BE A SECRET — the same rule the owner
            // data route states for its own catch. The message is withheld from
            // every class but `ReferenceError`, whose message is always
            // "<name> is not defined": a programmer bug, never request data, and
            // the single most valuable string this repo has ever put in a
            // response (it is how `OWN_ZONES` was found).
            kind: String((e && e.name) || "Error").slice(0, 40),
            why: (e && e.name) === "ReferenceError" ? String((e && e.message) || "").slice(0, 120) : undefined,
            billing: kind.billing || undefined,
            truncated: !!(e && e.truncated),
          }, { status: 503 });
        }
        // A DESIGNER THAT DECLARED NO TABLES IS NOT AUTOMATICALLY AN ERROR — see
        // the one refusal below, after the ownership lookup. It used to be
        // refused right here, and that made a look-only revise impossible.
      } else {
        // AN EXPLICIT SCHEMA SKIPS THE MODEL CALL, NOT THE AFFORDABILITY CHECK.
        //
        // The deposit and `buildFloor` both live in the branch above, and
        // provisioning runs after it either way — so anyone signed in who posted
        // their own `schema` reached `ensureSiteBackend` with NO credit check at
        // all. `publishPages` still refuses to generate below its own floor, so
        // what was free is the NEON PROJECT: a capped, billed resource, one per
        // site, against a platform-wide cap of 100. Repeat with fresh slugs and
        // builds stop working for everybody.
        //
        // A BALANCE READ, NOT A DEPOSIT, and the difference is deliberate. No
        // model call happens on this path, so there is nothing to hold money
        // against; the only thing worth stopping is provisioning on an empty
        // account. A read can race a concurrent build, which is the same
        // exposure this path had in full a moment ago and bounded to one.
        // `MIN_CREDITS`, NOT `buildFloor`, and the difference is the point.
        // `buildFloor` = a cold designer call at this picker's rates PLUS the
        // generation floor — and no designer call happens on this path, so
        // charging for one would refuse a build that costs strictly less than
        // an ordinary one. `MIN_CREDITS` is the amount `publishPages` already
        // requires before it will generate at all, which is the real downstream
        // requirement and comfortably inside a new account's grant of 20 (both
        // `confirm smoke` and `member smoke` build this way on a fresh account
        // and must keep passing).
        const floor = MIN_CREDITS;
        const bal = await readCredits(request.headers.get("Authorization") || "").catch(() => null);
        // FAILS CLOSED. An unreadable ledger is the shape that made this free in
        // the first place — "cannot tell" must not mean "go ahead" on the one
        // path that provisions a capped resource.
        if (bal === null || bal < floor) {
          return Response.json({
            ok: false,
            error: "not enough credits",
            need: "credits",
            cost: floor,
            msg: bal === null
              ? "Couldn't check your balance just now — try again in a moment."
              : "A build needs about " + floor + " credits and you have " + bal + ".",
          }, { status: 402 });
        }
      }

      // WEB RESEARCH, STARTED HERE AND AWAITED MUCH LATER — the gap is the point.
      //
      // Everything between this line and the page generation is Neon: creating a
      // project, applying the schema, seeding rows, reading the merged schema
      // back. That is seconds of waiting on somebody else's API, and a search
      // running alongside it is free in wall-clock terms. Awaited where it is
      // needed instead, it would add its own latency to a build the customer is
      // watching, for a step most builds skip entirely.
      //
      // Gated on the designer's own `needsWeb`, so an explicit-schema build (no
      // designer, no gate) never searches — which is correct: that path is the
      // test harness sending a schema it already knows.
      //
      // `.catch` is attached IMMEDIATELY rather than at the await. An unhandled
      // rejection in the interval would be an unhandled rejection, and this is a
      // best-effort enhancement — the build must survive it.
      const researchPromise = shouldSearch(designed)
        ? siteWebResearch(env, brief, designed.webQueries).catch((e) => {
            console.error("web research failed:", e && e.message);
            return null;
          })
        : null;

      const slug = String(body.slug || (designed && designed.slug) || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60)
        || ("site-" + Math.random().toString(36).slice(2, 8));

      // A site's slug is claimed by whoever built it first; a second user cannot
      // publish over someone else's site by guessing the name.
      // Fails CLOSED. This was `catch {}`, so a Supabase timeout turned "I cannot
      // tell who owns this" into "nobody does" — and the build went on to apply
      // its schema, seed rows and publish pages over an existing owner's site.
      // (ensureSiteBackend now enforces this too; belt and braces, because the
      // consequence is a cross-account write.)
      let priorBrief = "";
      // IS THIS SLUG ALREADY A SITE OF THIS CALLER'S — i.e. is this a revise?
      // Read off the same row as the ownership check, so it costs nothing, and
      // it is the OWNERSHIP that decides rather than the stored brief: a site
      // built before `brief` was recorded is still a revise, and treating it as
      // a first build would re-buy every photograph on it.
      let existing = false;
      try {
        const owner = await siteBackendRowFresh(env, slug);
        if (owner && owner.uid && owner.uid !== bu.id) {
          // REFUNDED. The schema call has already happened and been settled by
          // this point, so a refusal here leaves the customer with no database,
          // no site and a real charge — and the client is told they were not
          // charged. Same reasoning as the no-tables path: this returns before
          // anything is provisioned, so they are left with literally nothing.
          await refundCredits(env, bu.id, Math.max(0, schemaCost));
          return Response.json({ ok: false, error: "that name is taken", cost: 0, msg: "That site name is taken by another account. Say a different name in your next message — e.g. \"call it sunset-cuts\" — and I\u2019ll build it under that." }, { status: 409 });
        }
        // Free — this lookup already happens for the ownership check.
        existing = !!(owner && owner.uid);
        priorBrief = (owner && owner.brief) || "";
      } catch (e) {
        console.error("ownership check failed:", slug, e && (e.detail || e.message));
        await refundCredits(env, bu.id, Math.max(0, schemaCost));
        return Response.json({ ok: false, msg: "Couldn't check that name just now — try again in a moment.", cost: 0 }, { status: 503 });
      }

      // A Supabase round trip, and it was folded into a mark named `normalize`
      // — which is in-process and instant. A step name that hides a network call
      // is worse than no step at all: it attributes the wait to the wrong thing.
      tr.at("owner");

      const spec = normalizeSchema(body.schema || designed || {});
      tr.at("normalize");
      // A BOOKING TABLE WITH NOTHING STOPPING A DOUBLE BOOKING, named rather
      // than discovered by a customer. Making the four constraints declarable
      // on 2026-07-28 fixed availability and not USE — nothing checks that a
      // table shaped like a booking came back carrying one, which is the same
      // shape as `seed` being skipped on two builds this week. No model call
      // and no I/O: it reads the spec that is already in hand.
      const unguarded = unguardedBookings(spec);
      if (unguarded.length) console.warn("unguarded booking table:", slug, unguarded.join(","));
      // WHAT THE DESIGNER REACHED FOR AND WE DO NOT HAVE. `coerceTable` is an
      // allow-list, so a field the tool never offered is dropped without a
      // trace — which is the right protection and also throws away the only
      // evidence about what this platform is MISSING that does not come from
      // somebody guessing. Eleven schema features were built by guessing and
      // ended up reachable by nothing; a count of real reaches is what replaces
      // that. Read off the RAW answer, before the allow-list, because after it
      // there is nothing left to read. Names only, never values.
      const reached = droppedFields(body.schema || designed || {});
      if (reached.length) console.warn("designer reached for:", slug, reached.join(","));
      // NO TABLES IS ONLY AN ERROR ON A FIRST BUILD.
      //
      // This refusal used to sit before the ownership lookup, where `existing`
      // is not known yet — so it fired on every revise that named no table, and
      // "make the background yellow" answered 422 and changed nothing. That is
      // the exact instruction token overrides were built for: the designer sees
      // only the instruction on a revise, so a look-only change CORRECTLY
      // declares nothing to store, and the site's real schema is already in
      // `_meta` where the merge leaves it untouched. Measured live 2026-08-09 —
      // the smoke run's revise came back 422 with the whole feature dead.
      //
      // On a first build it is still the right answer, and it is still a refund:
      // this returns before anything is provisioned, so the customer is left
      // with literally nothing, and "charge for what you use" was never meant to
      // mean charging for an empty hand. The refund is what was ACTUALLY taken,
      // not the flat fee — once the deposit settles to real usage those are two
      // different numbers, and refunding the fee would quietly keep the
      // settlement on a build that 422s.
      if (!spec.tables.length && !existing) {
        await refundCredits(env, bu.id, Math.max(0, schemaCost));
        // A caller that sent its own schema gets the machine answer; a customer
        // whose brief the designer could make nothing of gets the sentence.
        return body.schema
          ? Response.json({ ok: false, error: "schema declares no tables", cost: 0 }, { status: 400 })
          : Response.json({ ok: false, msg: "That brief didn't describe anything to store — try naming what the site keeps track of.", cost: 0 }, { status: 422 });
      }

      let db;
      try {
        db = await ensureSiteBackend(env, slug, bu.id, brief, (n) => tr.at("prov:" + n));
        tr.at("provision");
      } catch (e) {
        if (e && e.conflict) {
          await refundCredits(env, bu.id, Math.max(0, schemaCost));
          return Response.json({ ok: false, error: "that name is taken", cost: 0, msg: "That site name is taken by another account. Say a different name in your next message — e.g. \"call it sunset-cuts\" — and I\u2019ll build it under that." }, { status: 409 });
        }
        console.error("site provision failed:", slug, e && e.status, e && (e.detail || e.message));
        // REFUNDED, BECAUSE THIS FAILURE IS OURS AND THEY ARE LEFT WITH NOTHING.
        //
        // Only the `conflict` branch above used to give the money back, so a
        // Neon outage, a dead key or a project quota answered 502 and KEPT the
        // settled schema charge — 9 credits cold Sonnet, 15 Opus, out of a new
        // account's grant of 20. Every sibling refusal on this route refunds,
        // with the stated reason that the caller is left with literally nothing;
        // a provisioning failure leaves them in exactly that state, and
        // infrastructure being down is an our-fault stage by `ourFault`'s own
        // list. During an outage each retry cost half a grant for nothing.
        await refundCredits(env, bu.id, Math.max(0, schemaCost));
        // THE STATUS IS THE DIAGNOSIS. A dead key (401), a plan or permission
        // limit (403), a project quota (422) and Neon being down (5xx) all read
        // identically without it, and each needs a completely different fix —
        // which is exactly how build smoke spent a run reporting `detail: "{}"`
        // and no way to tell which had happened.
        return Response.json({
          ok: false,
          error: "could not provision the database",
          upstream: (e && e.status) || null,
          // WHICH call failed. site-provision.mjs stamps a stage on every one of
          // its throws and this dropped it, so "enable_auth" and
          // "enable_data_api" — two different Neon endpoints — were reported
          // identically.
          stage: (e && e.stage) || null,
          detail: scrubSecrets(String((e && (e.detail || e.message)) || "")).slice(0, 300),
          cost: 0,
        }, { status: 502 });
      }

      let made;
      try {
        made = await applySiteSchema(db, spec);
        tr.at("schema", { tables: (spec.tables || []).length });
      } catch (e) {
        console.error("schema apply failed:", slug, e && (e.detail || e.message));
        // REFUNDED FOR THE SAME REASON as the provisioning failure above: this
        // is our schema engine failing against a database we just made, not
        // anything the customer wrote, and `ourFault` treats an unclassified
        // stage as ours by design. They are left with an empty database and no
        // site — technically an artifact, practically nothing.
        await refundCredits(env, bu.id, Math.max(0, schemaCost));
        // SCRUBBED, like the provisioning detail one branch up and unlike this
        // line until now. A Postgres or Neon error can quote the statement, and
        // the statement is built from the connection the vault handed us.
        return Response.json({
          ok: false,
          error: "could not apply the schema",
          detail: scrubSecrets(String((e && (e.detail || e.message)) || "")).slice(0, 300),
          cost: 0,
        }, { status: 502 });
      }

      // Register the site's scheduled jobs. Best-effort and non-fatal for the
      // same reason seeding is: a site whose reminders are not registered still
      // works, and failing the build here would throw away a live database over
      // background work. Declared jobs OVERWRITE by (slug, name); none are
      // auto-deleted, so a revise that drops a job leaves it registered — which
      // is why the runner re-reads the schema and skips a job the spec no longer
      // declares, rather than trusting the row.
      try {
        const jobs = Array.isArray(spec.jobs) ? spec.jobs : [];
        if (jobs.length) {
          // `bu.id`, NOT `uid` — which was never bound in this scope and threw a
          // ReferenceError straight into the catch below, so NOT ONE JOB HAS
          // EVER REGISTERED. Dead at the last link with every layer above it
          // correct, and silent because this block is best-effort by design.
          await persistSiteJobs(env, bu.id, slug, jobs);
          tr.at("jobs", { n: jobs.length });
        }
      } catch (e) { console.error("jobs persist:", slug, e && e.message); }

      // Starter content for the display tables. Best-effort and non-fatal: a site
      // with a live database and an empty menu is still a site, but one WITH the
      // menu is the difference between a demo and something usable — nothing can
      // write to a display table after this point, not even the owner.
      let seeded = null;
      try {
        seeded = await seedSiteRows(db, spec, (designed && designed.seed) || body.seed);
        tr.at("seed");
        if (seeded && Object.keys(seeded.seeded).length) console.log("seeded:", slug, JSON.stringify(seeded.seeded));
        if (seeded && seeded.skipped.length) console.log("seed skipped:", slug, JSON.stringify(seeded.skipped.slice(0, 6)));
      } catch (e) { console.error("seeding failed:", slug, e && (e.detail || e.message)); }

      // Write the site's pages against the schema that was just created, compile
      // them, and publish the dist. The database is already live at this point, so
      // this stage cannot fail the build — it either publishes the real app or
      // falls through to the placeholder below.

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
      // Merge, do not replace. `spec` is this request's schema and carries the
      // FULL column objects (type, required, refs); `_meta` carries every table
      // the site has but stores columns as plain names. Taking _meta wholesale
      // threw away the type information for the tables just designed, and the
      // generator was told they had no columns.
      let pageSpec = spec;
      try {
        const stored = await loadSiteSchema(db);
        if (stored && Array.isArray(stored.tables) && stored.tables.length) {
          const byName = new Map();
          for (const t of stored.tables) if (t && t.name) byName.set(String(t.name).toLowerCase(), t);
          for (const t of (spec.tables || [])) if (t && t.name) byName.set(String(t.name).toLowerCase(), t); // richer wins
          pageSpec = { ...spec, tables: [...byName.values()] };
        }
      } catch (e) { console.error("merged schema read failed:", slug, e && e.message); }

      // ── THE SITE'S LOOK, REMEMBERED ────────────────────────────────────────
      //
      // A revise sends only the instruction, so the designer sees a few words
      // and names a theme, a family and a font pair from THOSE — meaning "fix a
      // typo" could re-roll a booking-first barber shop into whatever family
      // nearest-matches that sentence, with different fonts and a different
      // theme. The fallback chain says `(designed && …) || (body && …)`, and the
      // comment above it claims the body half is what anchors the look — but the
      // client has never sent `body.theme`, `body.family` or `body.fonts`, so
      // that half has always been undefined and the anchor did not exist.
      //
      // Kept in the site's OWN `_meta`, beside `auth_info`: the connection is
      // already open here, it is written once per look, and it goes when the site
      // goes. Best-effort in both directions — losing it re-rolls the look, which
      // is exactly today's behaviour, so it can never be worse than what it
      // replaces.
      let priorLook = null, priorTokens = null, priorStyle = null, priorLogo = "";
      if (priorBrief) {
        try {
          const rows = await sqlQuery(db, "SELECT k, v FROM _meta WHERE k IN ('site_look','site_tokens','site_style','site_logo')");
          for (const r of rows || []) {
            if (r.k === "site_look" && r.v) priorLook = JSON.parse(r.v);
            if (r.k === "site_tokens" && r.v) priorTokens = JSON.parse(r.v);
            if (r.k === "site_style" && r.v) priorStyle = JSON.parse(r.v);
            // READ HERE OR A REVISE TAKES THE LOGO OFF. The container writes
            // `site-brand.ts` on EVERY build — it has to, or one site's logo
            // leaks onto the next — so a build path that does not send the
            // stored value sends nothing, and nothing means empty. A customer
            // who attached a logo and then asked for any page change would have
            // watched it disappear, with no error and nothing to point at.
            if (r.k === "site_logo" && typeof r.v === "string") priorLogo = r.v;
          }
        } catch (e) { console.error("look read failed:", slug, e && e.message); }
      }
      // THE DESIGNER STILL WINS ON A FIRST BUILD, and on a revise whose
      // instruction really is about the look: `designed` is only consulted here
      // when nothing was stored, so a revise keeps what the site already wears.
      // Changing a theme deliberately is a rebuild, which is the honest answer —
      // a re-theme is not a small edit and should not happen by accident.
      // RESOLVED FIRST, because the font fallback below depends on it. The pair
      // has to come from the theme this site is ACTUALLY getting — falling back
      // to `designed.theme` when a stored one won would recommend fonts for a
      // theme the site is not wearing, which is a worse mismatch than the one
      // this fixes.
      // STORED-UNLESS-NAMED, which is the owner's rule made mechanical: an edit
      // changes exactly what was asked for and nothing else. `instructed` is the
      // interlock — the designer's answer only outranks the stored value when
      // the designer was actually TOLD to omit what it is keeping, which is what
      // `editState` above records. Unread state, a first build, or an older
      // caller all fall back to the previous precedence, so the failure
      // direction is "the edit did not take" rather than "the site re-themed
      // itself". See builder/site-edit.mjs.
      const merged = mergeLook(priorLook, designed, body, { instructed: !!editState });
      const lookTheme = merged.theme;
      const look = {
        theme: lookTheme,
        family: merged.family,
        structure: merged.structure,
        // …AND THE THEME'S OWN RECOMMENDATION IS THE LAST RESORT.
        //
        // Every theme carries a curated `fonts` pair, validated against the same
        // 24-font shortlist the designer picks from — and it was read by
        // NOTHING: `themeCss` emits no `font-family`, and every reader here took
        // the designer's separate pick. So `broadsheet`, which is designed around
        // a serif, would happily render in whatever was chosen independently from
        // a prose hint, and every test passed.
        //
        // LAST, not first: a brief that really asks for a feel must still win,
        // and a revise must keep the fonts the site already wears. This only
        // decides the case where nobody expressed a preference — which is now the
        // ordinary case, since `fonts` stopped being a required field.
        fonts: merged.fonts || themeFontPair(lookTheme),
        // THE TWO THAT MOVED WHEN NOBODY ASKED, now stored like the rest.
        //
        // Neither had an anchor at all: `brand` was `designed.brand || slug` and
        // `description` was `designed.description || priorBrief`, so on an edit
        // a designer that had seen only "fix the typo" decided what the site was
        // called. It became the <title>, the og:title and the og:description,
        // while the pages kept the real name — so the tab and the link preview
        // disagreed with the page. They are the two most visible strings on the
        // site and they were the only two with nothing holding them.
        brand: merged.brand,
        description: merged.description,
      };
      // WRITTEN ON EVERY BUILD, not only the first.
      //
      // It was `if (!priorLook)`, which was correct while the look could never
      // change after a first build — anchoring made the stored value permanent,
      // so re-writing it was a no-op. Now an edit CAN move any of these, and
      // writing only on the first build would apply the change once and forget
      // it, so the next edit would resurrect the old look. The value written is
      // the MERGED one, which is stored-unless-named, so this cannot drift.
      try {
        await sqlQuery(db, "INSERT INTO _meta (k,v) VALUES ('site_look', ?) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v", [JSON.stringify(look)]);
      } catch (e) { console.error("look write failed:", slug, e && e.message); }
      // What this edit actually moved, for the trace: a customer who asks for
      // one thing and gets four changed cannot see that from the site, and
      // neither can anybody reading a log. Derived from the merge rather than
      // from what the model mentioned, so it reports the CHANGE.
      const lookMoved = priorLook ? movedFields(priorLook, look) : [];
      if (lookMoved.length) tr.at("look", { moved: lookMoved.join(",") });

      // OFF THE MERGED LOOK, not re-derived. This was declared ~4,600 characters
      // earlier as `(designed && designed.brand) || body.brand || slug`, which is
      // where the rename came from: no stored value was consulted because none
      // was kept. Moved down rather than given its own fallback chain, so there
      // is ONE answer to "what is this site called" and it is the same one the
      // stored look holds.
      const brand = String(look.brand || body.brand || slug).slice(0, 60);

      // ── AND THE ONE COLOUR THEY ASKED TO CHANGE ────────────────────────────
      //
      // ACCUMULATED, never replaced: a revise names only what it is changing,
      // so a yellow background asked for today and a blue accent asked for
      // tomorrow have to both survive — a replacing merge hands back the
      // theme's own background on the second revise, which reads as the first
      // instruction being forgotten.
      //
      // `withContrast` is applied at the point of USE rather than here, so what
      // is stored is only ever what the customer actually asked for; the
      // derived text colour follows whatever the surface is at build time.
      // Written on EVERY build that has one, unlike the look above, because
      // this is the thing being changed.
      const siteTokens = mergeTokens(priorTokens, designed && designed.tokens);
      const tokenAsk = parseTokens(designed && designed.tokens);
      if (Object.keys(siteTokens).length) {
        try {
          await sqlQuery(db, "INSERT INTO _meta (k,v) VALUES ('site_tokens', ?) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v", [JSON.stringify(siteTokens)]);
        } catch (e) { console.error("token write failed:", slug, e && e.message); }
      }

      // ── AND THE REST OF THE LOOK THEY ASKED TO CHANGE ──────────────────────
      //
      // Accumulated for the same reason and written the same way: square
      // buttons asked for today and airy spacing tomorrow both have to survive.
      // Its OWN `_meta` key rather than a field on `site_look`, because
      // `mergeLook` rebuilds its output from `EDIT_FIELDS` alone and would drop
      // anything else stored there — the reason `site_tokens` and `site_logo`
      // are separate keys too.
      const siteStyle = mergeStyle(priorStyle, designed && designed.style);
      const styleAsk = parseStyle(designed && designed.style);
      if (Object.keys(siteStyle).length) {
        try {
          await sqlQuery(db, "INSERT INTO _meta (k,v) VALUES ('site_style', ?) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v", [JSON.stringify(siteStyle)]);
        } catch (e) { console.error("style write failed:", slug, e && e.message); }
      }

      tr.at("merge");

      // The research that has been running alongside every Neon call above.
      // `null` on every path that did not search, and on one that searched and
      // failed — both mean the same thing here: write the pages without it.
      const researched = researchPromise ? await researchPromise : null;
      if (researchPromise) tr.at("research", researched ? { searches: researched.searches } : undefined);
      // ONE SUMMARY, used twice: it goes on the response so the client can say
      // what was and was not read, and its usage is what gets billed. Built from
      // the same two objects both times, so the sentence a customer reads and
      // the credits they are charged can never describe different work.
      const context = contextSummary({
        pages: linked,
        facts: (researched && researched.facts) || "",
        sources: (researched && researched.sources) || [],
        searches: (researched && researched.searches) || 0,
        skipped: attached.skipped,
        converted: attached.converted,
      });

      let pages = { page: "placeholder", files: [], notes: "", problems: [], cost: 0, buildMs: 0 };
      if (brief && env.SITE_BUILD_CONTAINER && env.SITES_BUCKET) {
        try {
          // A revise gets the brief the site was BUILT from as well as the
          // instruction — see briefForPages. The merged schema says what the
          // site has; this says what it is for.
          // The one-line description for the head. A revise sends no brief, so
          // the designer writes none — fall back to the brief the site was built
          // from rather than publishing a page with nothing under its name.
          // OFF THE MERGED LOOK, for the same reason as `brand` above: this was
          // `designed.description || …`, so an edit rewrote the site's link
          // preview out of the instruction. `priorBrief` stays as the last
          // resort for sites built before the description was ever stored.
          const siteDescription = String(look.description || body.description || priorBrief || brief || "").slice(0, 300);
          // A picture for the link preview: the first thing the owner uploaded,
          // if anything. Best-effort — a missing one just means a small card.
          const ogImage = await siteOgImage(env, slug);
          tr.at("og");
          pages = await buildAndPublishPages(env, {
            // The linked pages and the researched facts ride on the brief, which
            // both model calls already take — so neither had to learn a new
            // shape. `briefForPages` composes the revise anchor first; the
            // context wraps whatever that produced.
            brief: contextBrief(briefForPages({ brief, priorBrief }), {
              pages: linked,
              facts: (researched && researched.facts) || "",
              sources: (researched && researched.sources) || [],
              files: attached.texts,
            }),
            spec: pageSpec, slug, brand,
            // A REVISE, and the signal is free: `existing` is read off
            // site_backends during the ownership check and is true exactly when
            // this slug has already been built. No new field on the request, and
            // nothing a client can claim.
            //
            // OWNERSHIP, NOT THE STORED BRIEF. This was `!!priorBrief`, which is
            // the same answer for every site built since the brief started being
            // recorded and the WRONG one for anything older — a revise on such a
            // site read as a first build and would have re-bought every
            // photograph on it at ~19 credits each.
            revise: existing,
            // THE SITE AS IT STANDS, so a revise EDITS it rather than writing
            // every page again from the brief. Read only on a revise — a first
            // build has nothing to edit — and best-effort, because losing it
            // costs the anchor and nothing else.
            priorPages: priorBrief ? await loadSiteSource(env, slug) : null,
            // WHAT THE CUSTOMER TYPED THIS TURN, for the Versions list alone.
            // The composed `brief` above is the anchor plus the change plus the
            // linked pages plus the researched facts — thousands of characters,
            // and the change is buried in the middle of it. This is the raw
            // sentence, which is the only thing that names the build usefully.
            changeNote: brief,
            siteDescription, ogImage,
            attachments: attached.blocks,
            priorUsage: (researched && researched.usage) || null,
            model: models.pages,
            // THE STORED LOOK WINS ON A REVISE — see `look` above. The chain
            // that used to be here read `(designed) || (body)`, and the body half
            // has never been sent by the client, so a revise re-rolled theme,
            // family and fonts from the instruction alone.
            fonts: look.fonts,
            theme: look.theme,
            tokens: siteTokens,
            style: siteStyle,
            family: look.family,
            structure: look.structure,
            // Out of the same merged look as the other five, so a revise that
            // does not mention the language keeps it — the field is on
            // `EDIT_FIELDS`, which is what makes "absent means unchanged" true
            // of it without a second rule here.
            lang: look.lang,
            // Read straight off `_meta` rather than through `mergeLook`: the
            // logo is not something a designer can name, so it has no business
            // in `EDIT_FIELDS` and would be dropped by that merge if it were.
            logo: priorLogo,
            auth: request.headers.get("Authorization") || "",
            mark: (n) => tr.at(n),
          });
        } catch (e) {
          console.error("page generation failed:", slug, (e && (e.detail || e.message)));
          // Returned, not only logged — the same lesson `publish-pages.mjs`
          // learned. Until 2026-07-29 this branch reported `stage:-, error:-`
          // and a note, so a total outage of the generator was indistinguishable
          // from the model writing an unusable page, and telling them apart
          // needed a Cloudflare log. Measured: both CI suites red on an upstream
          // 400 for forty minutes with nothing in any response to say why.
          const kind = upstreamKind(e && e.detail);
          pages.stage = "generate";
          pages.upstream = (e && e.status) || null;
          pages.upstreamType = kind.type;
          if (kind.billing) pages.billing = true;
          pages.error = kind.billing
            ? "the model account has no balance"
            : String((e && e.message) || "page generation threw").slice(0, 200);
          pages.notes = kind.billing
            ? "Your database is live. Writing the pages is temporarily unavailable — this is on us, not your brief."
            : "Your database is live, but writing the pages didn't work this time — send it again to retry.";
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
      // SPLIT, not one number. `pages` was the model call, the container compile
      // and ~20 R2 puts together — the majority of a build's wall clock with no
      // way to attribute it.
      // DERIVED FROM WHAT THE BUILD REPORTS — actually derived now. The first
      // "derived" version was still a hand-picked name list, and the 2026-08-13
      // audit caught it already missing a field that existed the day it was
      // written (`preMs`): its own comment promised "a timing the container
      // starts reporting shows up here without anybody editing this", and that
      // was false. The rule is now the SHAPE — any numeric `*Ms` field on the
      // build result is a timing and is traced — so the promise finally holds.
      //
      // A step that cannot say it happened is indistinguishable from one that
      // did not, which is this file's most-repeated failure.
      tr.at("pages", Object.fromEntries([
        ["credits", pages.cost || 0],
        ...Object.keys(pages)
          .filter((k) => /Ms$/.test(k) && typeof pages[k] === "number")
          .map((k) => [k, pages[k]]),
      ]));

      // `schema` reports the access level chosen per table. It is what makes a
      // build verifiable from outside: a menu must come back `display` and an
      // enquiry form `collect`, and getting that wrong silently is exactly the
      // bug that shipped on 2026-07-27. `page` says which of the two things is
      // actually being served, so a fallback is never mistaken for a built site.
      const traced = tr.done();
      // One line, once, so a build's shape is visible in the log too. Bounded to
      // 900 characters by `line()`.
      console.log("build trace", slug, traced.totalMs + "ms", "|", tr.line());
      const levels = (pageSpec.tables || spec.tables || []).map((t) => ({ name: t.name, access: t.access }));
      return Response.json({
        ok: true, slug, url: "/s/" + slug + "/", backend: true, brand, tables: made, schema: levels,
        // Read off the array explicitly: JSON.stringify would drop them from
        // `tables`, which is how a site could declare a function, have it fail,
        // and report success.
        functions: (made.functions && made.functions.length) ? made.functions : undefined,
        functionErrors: made.functionErrors || undefined,
        // Rows per display table. An empty object means the site published with
        // empty lists — which reads as a working build and is not one.
        seeded: (seeded && seeded.seeded) || {},
        // WHY NOTHING WAS SEEDED, when nothing was. The reason existed only as a
        // `console.log` in Cloudflare, so a build that published a site with an
        // empty menu gave the caller no way to tell "the designer wrote no seed
        // rows" from "we refused to seed the table it named" — and answering that
        // question about a real failing build cost a guess, because the site had
        // already been deleted by the time it was asked. Sixth recorded instance
        // of a failure that could not name itself. Bounded, like the log line.
        seedSkipped: (seeded && seeded.skipped.length) ? seeded.skipped.slice(0, 6) : undefined,
        // WHETHER THE DESIGNER HAD TO BE COVERED FOR, and for which tables. A
        // build where this is absent is one where `seed` arrived complete; a
        // build where `gaps` is non-empty and `filled` is shorter is one where
        // the top-up ran and did not fully succeed, which is the state a menu
        // is still empty in. Undefined when there were no gaps, so a build the
        // designer got right answers exactly as it did before.
        seedTopUp: seedTopUp || undefined,
        // A BOOKING TABLE ANYONE CAN DOUBLE-BOOK. Not fatal and deliberately
        // not a refusal: the site works, and for a business that genuinely
        // takes unlimited sign-ups this is the right schema. It is here so the
        // omission is VISIBLE at build time rather than discovered by two
        // customers turning up for the same 14:00, which is how it was found
        // the first time. Undefined when clean, so a correct build's response
        // is byte-identical to before.
        unguarded: unguarded.length ? unguarded.slice(0, 6) : undefined,
        // FIELDS THE DESIGNER DECLARED THAT THE TOOL DOES NOT OFFER. Not an
        // error and not shown to the customer — their site is unaffected, since
        // these were dropped exactly as they always were. It is here so that
        // after twenty real builds "do we need another capability?" is a count
        // instead of an opinion. Undefined when clean, so a build where the
        // designer stayed inside the tool answers as it did before.
        reached: reached.length ? reached : undefined,
        // WHAT WAS READ FOR THIS BUILD, and what could not be. The whole reason
        // link-reading exists is that the old behaviour — a URL in the brief
        // that nothing fetched — was invisible: the model inferred a business
        // from the domain name and the customer got a plausible invention with
        // no sign a fetch had not happened. A read that fails silently would
        // reproduce exactly that, so the failures travel as far as the
        // successes, all the way into the chat message.
        //
        // Omitted entirely on the ordinary build that linked nothing and
        // searched nothing, so this adds no noise to the common case.
        context: (context.read.length || context.failed.length || context.searched || context.skipped || context.converted) ? context : undefined,
        // THE SAME THING AS A SENTENCE, composed HERE rather than in the client.
        // The client is a plain script and cannot import this module, so a
        // sentence built there would be a second copy of this logic that drifts
        // — and the direction it drifts in is a build that read nothing while
        // still claiming it did. One function, one answer, rendered verbatim.
        contextNote: contextSentence(context) || undefined,
        page: pages.page, files: pages.files, notes: pages.notes || undefined,
        problems: pages.problems.length ? pages.problems : undefined,
        // THE PHOTOGRAPHS, and this field is how "no pictures" stops being
        // ambiguous. A site with `{made:0, budget:0}` was never meant to have
        // any; `{made:0, budget:3, error:"photo 402"}` wanted three and could not
        // buy them; `{made:0, budget:0, overflow:4}` could not afford them. Those
        // are three completely different situations that look identical on the
        // published page, because all three render the same placeholder.
        //
        // It is also the only place the image spend is visible — it is folded
        // into `cost` with the tokens, by design, and a customer whose build
        // jumped from 21 credits to 78 deserves to see why.
        images: pages.images || undefined,
        // THE SAME THING AS A SENTENCE, composed here for the reason
        // `contextNote` is: the client is a plain script and cannot import the
        // module that decides it, so a second copy there would eventually claim
        // photographs that were never made.
        imagesNote: imageNote(pages.images) || undefined,
        // WHICH COLOUR MOVED, and which one could not. Same shape and same
        // reasoning as the two notes above it: the client cannot import the
        // module that decides this, and a colour silently not applied reads as
        // the builder being broken rather than as a request that did not land.
        // Reports THIS build's ask, not the accumulated patch — saying "changed
        // the background" on a revise that only touched the text is worse than
        // saying nothing.
        tokensNote: tokenNote(tokenAsk.tokens, tokenAsk.dropped) || undefined,
        styleNote: styleNote(styleAsk.style, styleAsk.dropped) || undefined,
        // WHICH PAGE CAME BACK AS A STUB. One bad file no longer costs the whole
        // site — it is replaced by a placeholder page and the rest publishes — so
        // there is now an outcome between "your site" and "the data model", and
        // this is the only thing that names it. Composed in the module for the
        // same reason as the three above.
        salvageNote: pages.salvageNote || undefined,
        salvaged: (pages.salvaged && pages.salvaged.length) ? pages.salvaged : undefined,
        // WHAT THE PAGES LOOK LIKE, which nothing else in this response can say.
        // Every other check is textual — a real page can be blank, throw on load
        // or paint text nobody can read and pass all of them. Reporting only: it
        // never refuses a publish, so a site with findings is a site that is
        // live and has something worth a second look.
        //
        // Omitted when the check found nothing, so a clean build's response is
        // byte-identical to what it was before this existed — and kept when it
        // could not RUN (`ok:false`), because a harness that silently reports
        // nothing reads exactly like a site with nothing wrong.
        render: (pages.render && (pages.render.ok === false || (pages.render.findings || []).length)) ? pages.render : undefined,
        // …and the same thing as a sentence, composed in the module for the
        // reason all four notes above it are.
        renderNote: renderNote(pages.render) || undefined,
        // Per-route prerender skips, same discipline as `render` one line up:
        // absent on a clean build, carried when a page lost its snapshot —
        // which used to be invisible in production (2026-08-13 audit).
        prerenderSkipped: pages.prerenderSkipped || undefined,
        // WHY it fell back, when it did. publish-pages.mjs has returned these
        // since it was extracted and nothing passed them on, so a build that
        // published the placeholder said only "placeholder" — the caller (and
        // the smoke test) could not tell a compile error from a lint refusal
        // from a credit floor. It is the owner's own build; there is nothing
        // here they should not see.
        stage: pages.page === "app" ? undefined : (pages.stage || undefined),
        // `error`/`cited` survive a SALVAGED build too. The module keeps the
        // first failure's error and cited lines precisely because they are "the
        // only record of what the generator got wrong" — and this gate then
        // stripped both on every salvaged build, because a salvage answers
        // page === "app" (2026-08-13 audit). The pages are gone the moment the
        // build returns, so without these the stubbed page's actual failure is
        // undiagnosable. `stage` stays outcome-only: a salvaged build did not
        // END at the typecheck.
        error: (pages.page === "app" && !pages.salvageNote) ? undefined : (pages.error ? String(pages.error).slice(0, 300) : undefined),
        // The SOURCE LINES that error points at. `error` is `file(line,col)` and
        // a message, and the pages themselves are gone the moment the build
        // returns — only the eval saves them — so a compile failure could only
        // be diagnosed by guessing what the model wrote at that line. A whole
        // round went on inferring one TS2344 from its file and column.
        cited: ((pages.page === "app" && !pages.salvageNote) || !(pages.cited && pages.cited.length)) ? undefined : pages.cited,
        cost: schemaCost + pages.cost, buildMs: pages.buildMs || undefined,
        // WHAT THE BUILD ACTUALLY DID, step by step, with the time each took.
        //
        // Returned rather than only logged — the lesson `publish-pages.mjs` and
        // the `stage`/`error`/`cited` fields all learned the hard way. A log
        // line lives in Cloudflare for a while and is gone; this reaches the
        // caller, the smoke test, and anyone debugging a slow build.
        //
        // Numbers only, by construction: `makeTrace` refuses anything that is
        // not a finite number, so a connection string cannot end up here.
        trace: traced.steps,
        totalMs: traced.totalMs,
        // THE SCHEMA CALL'S REAL COST, which is now also what it is billed. The
        // three fields are kept apart on purpose: `schemaUsage` is the four token
        // kinds, `schemaCredits` is what they price to, and `schemaCost` is what
        // was actually taken after the deposit settled. They agree today and the
        // point of reporting all three is that a disagreement is visible — a
        // settlement that silently failed shows up as the last two diverging
        // rather than as nothing at all.
        schemaUsage: schemaUsage || undefined,
        schemaCredits: schemaUsage ? pageCredits(schemaUsage) : undefined,
        schemaCost: designed ? schemaCost : undefined,
        // Whether the pages call was billed, and — when it was not — that this
        // was because the failure was ours rather than because the rule is
        // "placeholders are free". A caller cannot infer it from `cost`, since a
        // free pages call and a cheap one both leave the schema charge behind.
        charged: pages.charged,
        // The PAGES call's four token kinds. It is metered on exactly these and
        // reported only the credit total, so the expensive call was the one
        // whose cache behaviour could not be seen.
        pagesUsage: pages.usage || undefined,
        // The digest of the template the build container actually used.
        templateId: pages.templateId || undefined,
        // WHICH MODELS RAN, and the picker they were resolved from. The RESOLVED
        // picker, never `body.picker` — echoing back what was sent would report
        // a typo as if it had been honoured, which is exactly the state this
        // control spent its whole life in. Two usage objects on this response can
        // now be priced from two different rows, and this is the field that says
        // which is which.
        models: { picker: models.picker, design: models.design, pages: models.pages },
      });
    }

    // GET /api/site/<slug>/rows[/<table>] — the OWNER reading their own site.
    //
    // A different door from /api/db: that one is the published site's public API,
    // where the caller is a visitor with no Go Farther account. This one is
    // authenticated by the owner's Go Farther session, and it can read anything in
    // their own site — including `collect` tables, which the public API refuses
    // by design. That refusal is why, until now, a barber shop took bookings
    // nobody could ever see.
    //
    // Reading is handleOwnerData/handleOwnerTables; writing is handleOwnerWrite,
    // which is what finally lets a café correct a price without rebuilding the
    // whole site — nothing could write to a `display` table after the build, not
    // even the person whose menu it was. `/members` is the one place `_users` is
    // named, and it names its columns so no password hash can leave.
    //
    // THERE IS ONE LIST OF OWNER ROUTES AND IT IS THE `if (om || mm || …)`
    // BELOW. This gate is deliberately just the prefix.
    //
    // It used to carry a SECOND list — `includes("/rows") || includes("/members")
    // || …` — naming the same routes a different way, and `/versions` and `/text`
    // were added to the matchers, to the dispatch condition and to `ownerSlug`
    // without being added here. So both were unreachable end to end: the block
    // their handlers sit in could not be entered at all, and every request fell
    // through to the router's 404 at the bottom. THAT IS THE `dm2` BUG A THIRD
    // TIME, one layer further out, and the guard written for it could not see
    // this layer — `test/api-auth.test.mjs` checked matchers against the inner
    // condition and never looked above it. It now asserts this gate stays a bare
    // prefix, because two lists of the same thing is what keeps failing here.
    //
    // Falling through is safe: everything in the block lives inside that inner
    // `if`, so a path matching none of the matchers does nothing and carries on
    // to the branches below. The site-delete branch is no longer at risk from
    // that (it once matched any DELETE under /api/site/ and now matches exactly
    // /api/site/<slug>, no deeper), so ordering no longer decides anything.
    if (url.pathname.startsWith("/api/site/")) {
      const om = url.pathname.match(/^\/api\/site\/([a-z0-9][a-z0-9-]{0,80})\/rows(?:\/([a-z_][a-z0-9_]{0,40})(?:\/([0-9]{1,18}))?)?$/i);
      // A member id is a UUID now, not the sequential integer this used to match.
      const mm = url.pathname.match(/^\/api\/site\/([a-z0-9][a-z0-9-]{0,80})\/members(?:\/([0-9a-f-]{36}))?$/i);
      const an = url.pathname.match(/^\/api\/site\/([a-z0-9][a-z0-9-]{0,80})\/analytics$/i);
      const uf = url.pathname.match(/^\/api\/site\/([a-z0-9][a-z0-9-]{0,80})\/uploads(?:\/([A-Za-z0-9._-]{1,80}))?$/i);
      const xp = url.pathname.match(/^\/api\/site\/([a-z0-9][a-z0-9-]{0,80})\/export$/i);
      const nt = url.pathname.match(/^\/api\/site\/([a-z0-9][a-z0-9-]{0,80})\/notify$/i);
      // Off the web and back, at the same address. The panel had an Unpublish
      // button for months that POSTed `/api/site/unpublish` — a route with ZERO
      // occurrences in this file — and told the owner to try again when it
      // 404'd. Its neighbours were no better: `/api/site/publish` posted the
      // D1-era `p.html` page format, deleted 2026-07-27.
      const lv = url.pathname.match(/^\/api\/site\/([a-z0-9][a-z0-9-]{0,80})\/offline$/i);
      // The owner's own domains. The hostname in the path is matched loosely
      // here and normalised properly by `normalizeHostname` before it is used
      // for anything — this pattern only has to stop a path traversal.
      const dm2 = url.pathname.match(/^\/api\/site\/([a-z0-9][a-z0-9-]{0,80})\/domains(?:\/([a-z0-9.-]{1,253}))?$/i);
      // The owner's own API keys. A DELETE names the secret in the path, and the
      // name is matched with the SAME alphabet normalizeSecretName produces, so
      // anything that could not have been stored cannot even reach the handler.
      const sk = url.pathname.match(/^\/api\/site\/([a-z0-9][a-z0-9-]{0,80})\/secrets(?:\/([A-Za-z][A-Za-z0-9_]{0,63}))?$/i);
      // Published versions: the list, and the restore. `restore` is a fixed word
      // rather than an id in the path — the id arrives in the body and is
      // shape-checked by `isVersionId` before it can address an object.
      const vr = url.pathname.match(/^\/api\/site\/([a-z0-9][a-z0-9-]{0,80})\/versions(\/restore)?$/i);
      const tx = url.pathname.match(/^\/api\/site\/([a-z0-9][a-z0-9-]{0,80})\/text$/i);
      // THE EDIT LANE. Change what the site already has, and nothing else.
      //
      // Its own route rather than a mode on the build handler, deliberately: the
      // guarantee "an edit never touches the schema" is worth having as a
      // property of the CODE PATH — nothing reachable from here can call
      // `applySiteSchema`, `seedSiteRows` or the page generator — rather than as
      // a rule somebody has to keep remembering inside a 700-line handler.
      const ed = url.pathname.match(/^\/api\/site\/([a-z0-9][a-z0-9-]{0,80})\/edit$/i);
      // THE ADDON LANE. Add what the site does not have, keep everything it
      // does. Its own route for the same reason the edit lane has one: what a
      // rung may touch is worth being a property of the code path.
      const ad = url.pathname.match(/^\/api\/site\/([a-z0-9][a-z0-9-]{0,80})\/addon$/i);
      // WHAT THE SITE'S SCHEDULED WORK HAS ACTUALLY BEEN DOING.
      //
      // `runJob` has always computed an honest four-way outcome and every caller
      // put it in a Cloudflare log, which is not a surface a small business has.
      // So "sent 14 reminders", "your SQL is broken", "you never pasted a mail
      // key" and "nothing was due" were one silence — and for a reminder that is
      // the worst possible failure, because the customer does not know they were
      // meant to get one either.
      const jb = url.pathname.match(/^\/api\/site\/([a-z0-9][a-z0-9-]{0,80})\/jobs$/i);
      // EVERY owner-scoped matcher above has to appear here, and `dm2` did not —
      // so `/api/site/<slug>/domains` was dispatched by nothing and fell through
      // to the 404 at the bottom of the router. Custom domains were unreachable
      // end to end: the panel called it, Cloudflare was configured for it, and
      // the answer was always 404. The `if (dm2)` handler below sits INSIDE this
      // block, which is why it looked gated and was simply dead.
      //
      // A 404 is also what `assertOwner` answers for a slug that is not yours,
      // so from outside the two are indistinguishable — which is how this
      // survived a live probe until the dispatch was read.
      // `test/api-auth.test.mjs` holds the list against the matchers now.
      if (om || mm || an || uf || xp || nt || lv || sk || dm2 || vr || tx || ed || ad || jb) {
        const ou = await authUser(request);
        if (!ou) return UNAUTHED();
        const ownerSlug = (om || mm || an || uf || xp || nt || lv || sk || dm2 || vr || tx || ed || ad || jb)[1].toLowerCase();
        const ownerDeps = {
          ownerOf: async (s2) => {
            const g = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(s2)}&select=uid`, { headers: svcHeaders(env), signal: AbortSignal.timeout(12000) });
            if (!g.ok) throw Object.assign(new Error("site lookup failed"), { detail: g.status });
            const rows = await g.json();
            return (Array.isArray(rows) && rows[0] && rows[0].uid) || null;
          },
          dbFor: (s2) => siteBackendBySlug(env, s2),
          loadSchema: (conn) => loadSiteSchema(conn),
          query: (conn, sql, args) => sqlQuery(conn, sql, args),
          exec: (conn, sql, args) => sqlExec(conn, sql, args),
          ident: sqlIdent,
          nowSql: () => "to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')",
          // Traffic lives in Supabase, not the site's database. The aggregation
          // is an RPC because count-distinct and a seven-day generate_series are
          // not things a REST filter can express; it is service_role-only, and
          // the caller was authorised above.
          readAnalytics: async (s2) => {
            const g = await fetch(`${SUPABASE_URL}/rest/v1/rpc/site_analytics`, {
              method: "POST",
              headers: svcHeaders(env, { "content-type": "application/json" }),
              body: JSON.stringify({ p_slug: s2 }),
              signal: AbortSignal.timeout(12000),
            });
            if (!g.ok) throw new Error("analytics rpc " + g.status);
            return g.json();
          },
        };
        // Anything thrown below reaches the owner as a bare Cloudflare 1101 with
        // no body otherwise — the same trap the PBKDF2 cap fell into.
        try {
          let r;
          // ── PUBLISHED VERSIONS ────────────────────────────────────────────
          //
          // The list, and putting one back. Behind `assertOwner` like every
          // other route in this block; a slug that is not yours answers 404
          // rather than 403, because the slug space is public and a 403 confirms
          // which names are taken.
          if (ed) {
            // ── THE EDIT LANE ─────────────────────────────────────────────
            //
            // Two layers live here and neither runs the page generator, which
            // is the entire saving. `text` lifts the strings out of the stored
            // source, has a Haiku call pick which change, and puts them back.
            // `look` moves theme, fonts, colours, corners, the name and the
            // description — all of which the CONTAINER applies, so the pages
            // are recompiled untouched.
            //
            // EVERYTHING THAT CANNOT BE DONE HERE ESCALATES WITH A 200. This
            // route sits below `addon` and `build` on a ladder, so its failure
            // answer is not an error the customer sees — it is `escalate:true`
            // and the client walks up to the next rung. A 4xx here would show
            // somebody a refusal for a change that is perfectly possible one
            // step up.
            if (!env.SITES_BUCKET) return Response.json({ ok: false, error: "storage not configured" }, { status: 501 });
            if (request.method !== "POST") return Response.json({ ok: false, error: "method not allowed" }, { status: 405 });
            const g = await assertOwner(ownerDeps, ownerSlug, ou.id);
            if (g.error) return Response.json(g.error.body, { status: g.error.status });

            const eb = await request.json().catch(() => ({}));
            const eLayer = String((eb && eb.layer) || "");
            const eInstruction = String((eb && eb.instruction) || "").trim().slice(0, 2000);
            const eAuth = request.headers.get("Authorization") || "";
            // ONE shape for every "I cannot do this, try the rung above".
            const escalate = (reason, extra) =>
              Response.json({ ok: false, escalate: true, reason, cost: 0, ...(extra || {}) });
            if (!eInstruction) return escalate("empty");
            if (!env.ANTHROPIC_API_KEY) return escalate("unconfigured");

            // THE STORED SOURCE IS THE WHOLE PREMISE. Without it there is
            // nothing to edit — a site built before the source was kept — and
            // the rung above regenerates from scratch, which is exactly right.
            const eSrc = await loadSiteSource(env, ownerSlug);
            if (!eSrc || !eSrc.length) return escalate("no-source");

            // Charged only when the change actually PUBLISHED, the same rule
            // `publishPages` follows: a lane that failed and left the site
            // untouched has delivered nothing to bill for.
            //
            // VARIADIC, because the picture layer has a second thing to bill:
            // a generated photograph is real fal spend at IMAGE_USD and is
            // priced by the same one table. `pageCredits` takes several parts
            // and rounds ONCE, so passing them is the whole fix — summing two
            // calls would charge twice for the rounding, which is the bug the
            // addon lane had.
            const eCharge = async (usage, ...more) => {
              const parts = [usage, ...more].filter(Boolean);
              if (!parts.length) return 0;
              try { return await collectCredits(eAuth, pageCredits(...parts)); } catch { return 0; }
            };

            // OUR MODEL CALL DIED — ONE ANSWER, FOR ALL FOUR LANES.
            //
            // Every lane carries the thrown error back as `reason: "send"`, and
            // each of them used to fold it into a flat 422 "that change couldn't
            // be saved — try again", which is wrong twice: the status says the
            // customer's request was at fault when it was ours, and a BILLING
            // outage is the one failure nothing retries past, so "try again in a
            // moment" spends somebody's evening on it.
            //
            // Same shape the look layer and the build route already answer with,
            // so a lane that goes down reports identically wherever it sits on
            // the ladder. 503, never escalated: the rung above calls the same
            // provider and would fail the same way, at ~25 credits.
            const modelDown = (e, what) => {
              console.error("edit model call failed:", ownerSlug, eLayer, e && e.message);
              const k = upstreamKind(e && e.detail);
              return Response.json({
                ok: false, error: "send", cost: 0,
                msg: k.billing
                  ? "The site builder is temporarily unavailable — this is on us, not your change."
                  : (what || "That didn't go through — try again in a moment."),
                upstream: (e && e.status) || null,
                upstreamType: k.type,
                billing: k.billing || undefined,
                kind: String((e && e.name) || "Error").slice(0, 40),
              }, { status: 503 });
            };

            if (eLayer === "data") {
              // ── THE CONTENT THE SITE STORES ─────────────────────────────
              //
              // The cheapest layer there is, and the one the audit was missing:
              // a generated site keeps its menu and its prices in a `display`
              // table and renders them with `useRows`, so those words are NOT in
              // the page source and no page-facing layer could ever reach them.
              // Before this, "change the price of a haircut to £25" fell through
              // edit, addon and build and came back ~25 credits later unchanged.
              //
              // NOTHING IS RECOMPILED AND NOTHING IS REPUBLISHED. The published
              // bundle reads these rows at runtime, so the change is live the
              // moment it commits.
              const ddb = await siteBackendBySlug(env, ownerSlug);
              if (!ddb) return escalate("no-backend");
              let dSpec = null;
              try {
                const rows = await sqlQuery(ddb, "SELECT v FROM _meta WHERE k = 'schema'");
                if (rows && rows[0] && rows[0].v) dSpec = JSON.parse(rows[0].v);
              } catch (e) { console.error("data edit schema read failed:", ownerSlug, e && e.message); }
              if (!dSpec) return escalate("no-meta");

              // `display` TABLES ONLY, and that is a boundary rather than a
              // shortcut. A `collect` table holds customers' bookings and
              // enquiries — the visitor's data, not the owner's content — and
              // "cancel John's booking" is not a sentence to hand a model. The
              // Data panel is where those are changed, with the row on screen.
              const dTables = [];
              for (const t of (dSpec.tables || [])) {
                if (!t || !t.name) continue;
                // `public`, NOT `anyone` — and getting that word wrong made the
                // whole layer dead. Measured live 2026-08-11: every data edit
                // answered `no-data`, because `READ_LEVELS` is
                // ["none","own","members","public"] and "anyone" is a WRITE
                // level. So the condition was false for every table on every
                // site, and the cheapest lane on the platform could never find a
                // single row to change.
                //
                // Asserted against `ACCESS_PRESETS.display` rather than spelled
                // out, so the two cannot disagree again: this IS the display
                // preset, and naming it is what makes that true by construction.
                const pair = resolveAccess(t);
                if (pair.read !== DISPLAY_PAIR.read || pair.write !== DISPLAY_PAIR.write) continue;
                const cols = (Array.isArray(t.columns) ? t.columns : [])
                  .map((c) => (typeof c === "string" ? c : c && c.name)).filter(Boolean);
                try {
                  const rows = await sqlQuery(ddb, "SELECT * FROM \"" + String(t.name).replace(/"/g, "") + "\" ORDER BY id LIMIT " + MAX_DATA_ROWS);
                  dTables.push({ name: t.name, columns: cols, rows: rows || [] });
                } catch (e) { console.error("data edit row read failed:", ownerSlug, t.name, e && e.message); }
              }

              const dOut = await runDataEdit({
                send: (req) => anthropicMessages(env, req),
                // ONE STATEMENT PER CHANGE, parameterised, with the table name
                // taken from the DECLARED schema rather than from the model —
                // it is the only part that cannot be a bound parameter.
                apply: async (c) => {
                  const name = String(c.table).replace(/"/g, "");
                  // A REMOVAL. The id has already been checked against the rows
                  // the model was shown, so it cannot name one it never saw.
                  if (c.remove) {
                    await sqlQuery(ddb, "DELETE FROM \"" + name + "\" WHERE id = ?", [c.id]);
                    return true;
                  }
                  const cols = Object.keys(c.values);
                  if (c.id === undefined) {
                    const marks = cols.map(() => "?").join(", ");
                    await sqlQuery(ddb, "INSERT INTO \"" + name + "\" (" + cols.map((k) => '"' + k.replace(/"/g, "") + '"').join(", ") + ") VALUES (" + marks + ")", cols.map((k) => c.values[k]));
                    return true;
                  }
                  const sets = cols.map((k) => '"' + k.replace(/"/g, "") + '" = ?').join(", ");
                  await sqlQuery(ddb, "UPDATE \"" + name + "\" SET " + sets + " WHERE id = ?", [...cols.map((k) => c.values[k]), c.id]);
                  return true;
                },
                // WHAT THE LAST EDIT DELETED, carried by the client because it
                // is the only party that still has it — the row is gone from the
                // table, so `dataDigest` cannot mention it and "put it back" had
                // no referent at all. Taken on trust and SHOWN to the model, never
                // written: whatever comes back still goes through
                // `readDataChanges`, which admits only declared tables, declared
                // columns and scalar values.
              }, { instruction: eInstruction, tables: dTables, recent: (eb && eb.recent) || null });

              if (!dOut.ok) {
                // A model that read the rows and matched none does NOT escalate:
                // the rungs above cannot change a row either, so sending them up
                // spends ~25 credits to fail differently. Said plainly instead,
                // with the one thing the owner can actually do about it.
                if (!dOut.escalate) {
                  if (dOut.reason === "send") return modelDown(dOut.error, "I couldn't reach the model that makes that change — try again in a moment.");
                  return Response.json({
                    ok: false, error: dOut.reason, cost: 0,
                    msg: dOut.reason === "no-match"
                      ? "I couldn't match that to anything the site stores — say which list it's in and I'll have another go."
                      : "That change couldn't be saved — try again.",
                  }, { status: 422 });
                }
                return escalate(dOut.reason);
              }
              return Response.json({
                ok: true, layer: "data",
                // `was` RIDES BACK ON A REMOVAL, and it is the only undo a
                // deleted row has: pages are archived on every publish and can
                // be restored, rows are not. With the contents in the thread,
                // putting one back is one sentence.
                applied: dOut.applied.map((c) => (c.remove
                  ? { table: c.table, id: c.id, removed: true, was: c.was || null }
                  : { table: c.table, id: c.id, columns: Object.keys(c.values) })),
                failed: dOut.failed,
                cost: await eCharge(dOut.usage), usage: dOut.usage,
              });
            }
            if (eLayer === "rules") {
              // ── WHAT THE SITE DOES WITH WHAT PEOPLE SUBMIT ──────────────
              //
              // The schema was WRITE-ONCE until this existed, and it was the
              // largest hole in the ladder. Measured through the real
              // normaliser: the addon lane merges with `normalizeSchema`, whose
              // rule is "first declaration wins, later ones contribute COLUMNS",
              // so a table on a live site could gain a column and nothing else —
              // `confirm DROPPED · payment DROPPED · noOverlap DROPPED`, and
              // dropped SILENTLY, which is worse than refused.
              //
              // So "email the customer when they book", "stop two people taking
              // one slot" and "let people browse without signing in" were all
              // impossible on any site that already existed, and the last of
              // those has already cost a whole build: a marketplace whose every
              // listing was private came out as the placeholder.
              //
              // NOTHING IS RECOMPILED AND NOTHING IS REPUBLISHED. Every rule
              // here is enforced in Postgres or read out of `_meta` on the
              // request path, so no page source changes and no visitor
              // re-downloads anything.
              const rdb = await siteBackendBySlug(env, ownerSlug);
              if (!rdb) return escalate("no-backend");
              let rSpec = null;
              try { rSpec = await loadSiteSchema(rdb); }
              catch (e) { console.error("rules edit schema read failed:", ownerSlug, e && e.message); }
              if (!rSpec || !Array.isArray(rSpec.tables) || !rSpec.tables.length) return escalate("no-meta");

              // EVERY TABLE, unlike the data layer's `display`-only list. A rule
              // is about who may reach a table and what it refuses, and the
              // tables that most need one — a booking list, an enquiry form —
              // are exactly the `collect` ones the data layer will not touch.
              // Nothing here reads a ROW, so no customer's data is shown to a
              // model: the digest is names, columns, types and rules.
              const rOut = await runRulesEdit({
                send: (req) => anthropicMessages(env, req),
                // ONE APPLY FOR THE MERGED SPEC. `applySiteSchema` re-emits
                // every table's REVOKEs, grants and policies in order, which is
                // what makes a pair change and a `retired` take effect on a
                // table that already exists — and it persists `_meta` itself, so
                // there is no second write that could disagree with the DDL.
                apply: async (spec) => { await applySiteSchema(rdb, normalizeSchema(spec)); return true; },
              }, { instruction: eInstruction, tables: rSpec.tables });

              if (!rOut.ok) {
                if (!rOut.escalate) {
                  if (rOut.reason === "send") return modelDown(rOut.error, "I couldn't reach the model that sets that rule — try again in a moment.");
                  return Response.json({
                    ok: false, error: rOut.reason, cost: await eCharge(rOut.usage), usage: rOut.usage,
                    // A REFUSAL IS SAID IN FULL. `rulesReply` is the one place
                    // that turns a refused rule into words, and a no-match that
                    // silently reads as "nothing happened" is how a booking
                    // table that still takes double bookings looks like success.
                    msg: rOut.reason === "no-match"
                      ? rOut.msg
                      : "That change couldn't be saved — try again.",
                  }, { status: 422 });
                }
                return escalate(rOut.reason);
              }
              return Response.json({
                ok: true, layer: "rules", applied: rOut.applied, refused: rOut.refused || [],
                msg: rOut.msg, cost: await eCharge(rOut.usage), usage: rOut.usage,
              });
            }
            if (eLayer === "picture") {
              // ── A PHOTOGRAPH ON A PAGE THAT ALREADY EXISTS ──────────────
              //
              // Pictures were bought at BUILD time and after that nothing could
              // touch them: a revise buys none (it re-derives the same budget
              // against fresh descriptions, so ~94 credits of NEW photographs
              // for ones the owner already had) and no lane could swap one. So
              // "use a photo of MY shop instead" had no path at all.
              //
              // THE FREE HALF IS THE USEFUL HALF TODAY. Every `SafeImage` on
              // every published site is drawing its placeholder, because the
              // image balance has never been funded — so the owner's OWN
              // photographs, which need no image model, are what actually fills
              // them, and are better than a made-up one for a business that has
              // them.
              // A WORKING BALANCE, DECREMENTED AS PHOTOGRAPHS ARE BOUGHT.
              //
              // This was read once and never moved, so the per-picture
              // affordability check below could not bind across a batch: an
              // account with 20 credits passed the same check three times and
              // bought three photographs it could afford one of. The comment on
              // that check already said a batch that can afford two of three
              // must buy the two; nothing implemented it.
              let balance = await readCredits(eAuth).catch(() => 0);
              const pOut = await runPictureEdit({
                send: (req) => anthropicMessages(env, req),
                // The owner's upload library, named the way they see it.
                library: async () => (await siteUploadList(env, ownerSlug))
                  .map((o) => ({ name: uploadFileName(o.key), url: uploadUrl(ownerSlug, uploadFileName(o.key)) }))
                  .filter((f) => f.name),
                // ONE PHOTOGRAPH AT A TIME, priced against the real balance
                // before each. Checked per picture rather than once up front
                // because each one is ~19 credits: a batch that can afford two
                // of three must buy the two, and the third is reported.
                generate: async (describe) => {
                  if (!imagesAffordable(1, { balance, usd: SITE_PHOTO_USD })) return null;
                  const made = await makeSitePhoto(env, ownerSlug, describe);
                  // Only a photograph that really landed costs anything, so the
                  // working balance moves on success and not on the attempt —
                  // the same rule the build path's `made` count follows.
                  if (made) balance -= SITE_PHOTO_USD / CREDIT_USD;
                  return made;
                },
              }, { instruction: eInstruction, pages: eSrc });

              if (!pOut.ok) {
                if (!pOut.escalate) {
                  if (pOut.reason === "send") return modelDown(pOut.error, "I couldn't reach the model that picks the picture — try again in a moment.");
                  return Response.json({
                    ok: false, error: pOut.reason, cost: await eCharge(pOut.usage), usage: pOut.usage,
                    // The module writes this — it is the only thing that knows
                    // which slot could not be filled and why.
                    msg: pOut.msg || "That change couldn't be made — try again.",
                  }, { status: 422 });
                }
                return escalate(pOut.reason);
              }
              const pPub = await recompileAndPublish(env, {
                slug: ownerSlug, pages: pOut.pages,
                label: versionLabel({ revise: true, changeNote: eInstruction }),
              });
              if (!pPub.ok) {
                return Response.json({
                  ok: false, error: "compile", cost: 0,
                  msg: compileMsg(pPub, "That picture change didn't compile, so your site is untouched."),
                  detail: pPub.detail,
                }, { status: 422 });
              }
              // THE PHOTOGRAPHS ARE BILLED, WHICH THEY WERE NOT.
              //
              // This charged `pageCredits(usage)` over model tokens only, so a
              // generated photograph — $0.15 of real fal spend, ~19 credits, and
              // the exact charge the BUILD path applies for the identical
              // picture — cost the customer nothing. "Add three photos of the
              // shop" was about $0.45 to us and roughly one credit to them.
              // Latent only while the image balance is empty and `generate`
              // returns null; the day it is funded it is live money.
              //
              // Counted from `made`, not from what was asked for: a photograph
              // that failed or was never affordable was never bought. Priced
              // through the SAME variadic call as the tokens so the two land on
              // one bill with one rounding.
              const pImages = pOut.made.length ? { images: pOut.made.length } : null;
              return Response.json({
                ok: true, layer: "picture", msg: pOut.msg,
                changed: pOut.changed, files: pPub.files,
                used: pOut.used.length, made: pOut.made.length, failed: pOut.failed,
                cost: await eCharge(pOut.usage, pImages), usage: pOut.usage,
              });
            }
            if (eLayer === "logo") {
              // ── THE BUSINESS'S OWN ARTWORK IN ITS OWN HEADER ────────────
              //
              // Until now `SiteHeader` took `brand: string` and there was no
              // image slot anywhere in the frame, so a business with a logo
              // could not use it on the site we built them.
              //
              // NO MODEL CALL AT ALL, on either path. The attachment IS the
              // choice — nothing has to be matched against anything — so this
              // costs only the routing call that already happened plus a
              // container run, and it rewrites no page: the URL is read at
              // COMPILE time out of `_meta`, so every page gets the logo
              // without a line of page source changing.
              const ldb = await siteBackendBySlug(env, ownerSlug);
              if (!ldb) return escalate("no-backend");
              // UP TO 3 ARRIVE AND ONLY THE FIRST IS USED — the composer allows
              // three, and a business has one logo. Taking the first is the only
              // non-arbitrary choice; asking which would be a question about
              // something they can simply send again.
              const eImages = Array.isArray(eb && eb.images) ? eb.images.slice(0, 3) : [];
              const lOut = await runLogoEdit({
                sniff: sniffImage,
                // The same content-hashed library every other upload lands in,
                // so it obeys the owner's own file allowance and goes when the
                // site goes.
                store: async ({ bytes, kind }) => {
                  if (!env.SITES_BUCKET) return null;
                  const digest = await crypto.subtle.digest("SHA-256", bytes);
                  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
                  const name = uploadName(hex, kind.ext);
                  if (!name) return null;
                  await env.SITES_BUCKET.put(uploadKey(ownerSlug, name), bytes, { httpMetadata: { contentType: kind.mime } });
                  return uploadUrl(ownerSlug, name);
                },
                // ITS OWN `_meta` KEY, never a field on `site_look`: that object
                // is rebuilt from `EDIT_FIELDS` by `mergeLook`, so a logo stored
                // on it would be dropped by the next colour change.
                save: async ({ logo }) => {
                  await sqlQuery(ldb, "INSERT INTO _meta (k,v) VALUES ('site_logo', ?) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v", [String(logo || "")]);
                },
                publish: () => recompileAndPublish(env, {
                  slug: ownerSlug, pages: eSrc,
                  label: versionLabel({ revise: true, changeNote: eInstruction }),
                }),
              }, { images: eImages, remove: eb && eb.remove === true });

              if (!lOut.ok) {
                // NEVER ESCALATED. The rung above is a full revise, which cannot
                // put a logo in a header either — it would spend ~27 credits
                // rewriting pages and end with the same missing logo, which
                // reads as the builder ignoring what was asked. A refusal here
                // is the honest answer and it says what to do instead.
                return Response.json({
                  ok: false, error: lOut.reason, cost: 0, msg: lOut.msg,
                }, { status: 422 });
              }
              return Response.json({
                ok: true, layer: "logo", msg: lOut.msg,
                removed: !!lOut.removed, url: lOut.url || "", files: lOut.files,
                cost: 0, usage: null,
              });
            }
            if (eLayer === "text") {
              const out = await runTextEdit({ send: (req) => anthropicMessages(env, req) },
                { instruction: eInstruction, pages: eSrc });
              // `escalate` false with `ok` false is the one case that is NOT a
              // rung problem: the stored source moved under us, and the lane
              // above would be working from the same copy. Retrying fixes it.
              if (!out.ok) {
                if (!out.escalate) {
                  // A MODEL OUTAGE IS NOT A STALE EDIT. The 409 below says the
                  // site moved under the offsets and to send it again, which is
                  // exactly wrong advice when the provider is down or unpaid —
                  // and would be the message on every text edit for the whole
                  // outage.
                  if (out.reason === "send") return modelDown(out.error, "I couldn't reach the model that picks the wording — try again in a moment.");
                  return Response.json({
                    ok: false, error: out.reason, cost: 0,
                    msg: "Your site changed while that was being edited — send it again.",
                  }, { status: 409 });
                }
                return escalate(out.reason);
              }
              const pub = await recompileAndPublish(env, {
                slug: ownerSlug, pages: out.pages,
                label: versionLabel({ revise: true, changeNote: eInstruction }),
              });
              // A FAILED COMPILE LEAVES THE LIVE SITE ALONE, and is not
              // escalated: the rung above would rewrite pages the owner never
              // asked to have rewritten, to fix a typo.
              if (!pub.ok) {
                return Response.json({
                  ok: false, error: "compile", cost: 0,
                  msg: compileMsg(pub, "That wording didn't compile, so your site is untouched — try shorter wording."),
                  detail: pub.detail,
                }, { status: 422 });
              }
              return Response.json({
                ok: true, layer: "text", applied: out.applied, files: pub.files,
                changed: out.edits.map((e) => e.to).slice(0, 8),
                cost: await eCharge(out.usage), usage: out.usage,
              });
            }

            if (eLayer === "look") {
              // The connection STRING, used directly — see recompileAndPublish,
              // where reading a `.conn` off it silently disabled the whole look.
              const edb = await siteBackendBySlug(env, ownerSlug);
              if (!edb) return escalate("no-backend");
              let priorLook = null, priorTokens = null, priorStyle = null, eSchema = null;
              try {
                const rows = await sqlQuery(edb, "SELECT k, v FROM _meta WHERE k IN ('site_look','site_tokens','site_style','schema')");
                for (const r of rows || []) {
                  if (r.k === "site_look" && r.v) priorLook = JSON.parse(r.v);
                  if (r.k === "site_tokens" && r.v) priorTokens = JSON.parse(r.v);
                  if (r.k === "site_style" && r.v) priorStyle = JSON.parse(r.v);
                  if (r.k === "schema" && r.v) eSchema = JSON.parse(r.v);
                }
              } catch (e) { console.error("edit look read failed:", ownerSlug, e && e.message); return escalate("no-meta"); }
              if (!priorLook) return escalate("no-look");

              // The designer, told what the site is now and told to return ONLY
              // what this change moves. Same call the build uses, same edit
              // rule — there is no second designer for edits.
              let designed = null, dUsage = null;
              try {
                const d = await designSiteSchema(env, eInstruction, modelsFor(eb && eb.picker).design, {
                  ...priorLook,
                  tables: ((eSchema && eSchema.tables) || []).map((t) => t && t.name).filter(Boolean),
                });
                designed = d.input; dUsage = d.usage;
              } catch (e) {
                // The model is down or unpaid. Our fault, our cost — and the
                // rung above will fail the same way, so this is reported rather
                // than escalated into a second bill for the same outage. The
                // SAME `upstreamKind` shape the build route answers with: a
                // billing failure is the one nothing retries past, and telling
                // somebody to try again spends their evening on it.
                console.error("edit design failed:", ownerSlug, e && e.message);
                const eKind = upstreamKind(e && e.detail);
                return Response.json({
                  ok: false, error: "design", cost: 0,
                  msg: eKind.billing
                    ? "The site builder is temporarily unavailable — this is on us, not your change."
                    : "The designer is busy — try again in a moment.",
                  upstream: (e && e.status) || null,
                  upstreamType: eKind.type,
                  billing: eKind.billing || undefined,
                }, { status: 503 });
              }

              const merged = mergeLook(priorLook, designed, {}, { instructed: true });
              const moved = movedFields(priorLook, merged);
              const nextTokens = mergeTokens(priorTokens, designed && designed.tokens);
              const tokensMoved = JSON.stringify(nextTokens) !== JSON.stringify(priorTokens || {});
              const nextStyle = mergeStyle(priorStyle, designed && designed.style);
              const styleAsk = parseStyle(designed && designed.style);
              const styleMoved = JSON.stringify(nextStyle) !== JSON.stringify(priorStyle || {});

              // WHAT THIS LANE CAN HONESTLY MOVE, AND WHAT IT ONLY APPEARS TO.
              //
              // The container is handed `theme`, `tokens` and `fonts`, so those
              // really do change a site that is merely recompiled. `family` and
              // `structure` are layout decisions the PAGES were written against
              // and the container never sees — storing a new one here would
              // change nothing a visitor could see while reporting success, and
              // would leave the stored look disagreeing with the pages it
              // describes. "Make it look like a newspaper" is a real request and
              // it belongs one rung up, where pages are rewritten.
              const needsPages = moved.filter((k) => k === "family" || k === "structure");
              if (needsPages.length) return escalate("needs-pages", { moved: needsPages });
              // COUNTED AS A CHANGE, or "square buttons" escalates to a ~27-credit
              // page rewrite that cannot put square buttons on anything either —
              // the rung above recompiles from the same stored look. The whole
              // point of this lane is that a look change costs one cheap call.
              if (!moved.length && !tokensMoved && !styleMoved) return escalate("no-change");

              try {
                await sqlQuery(edb, "INSERT INTO _meta (k,v) VALUES ('site_look', ?) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v",
                  [JSON.stringify({ ...merged, fonts: merged.fonts || themeFontPair(merged.theme) })]);
                if (Object.keys(nextTokens).length) {
                  await sqlQuery(edb, "INSERT INTO _meta (k,v) VALUES ('site_tokens', ?) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v",
                    [JSON.stringify(nextTokens)]);
                }
                if (Object.keys(nextStyle).length) {
                  await sqlQuery(edb, "INSERT INTO _meta (k,v) VALUES ('site_style', ?) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v",
                    [JSON.stringify(nextStyle)]);
                }
              } catch (e) {
                // Nothing has been published yet, so the site is exactly as it
                // was. Reported rather than escalated: a write that failed once
                // will fail for the bigger lane too.
                console.error("edit look write failed:", ownerSlug, e && e.message);
                return Response.json({ ok: false, error: "store", cost: 0, msg: "That change couldn't be saved — try again." }, { status: 503 });
              }

              // A RENAME IS THE ONE THING HERE THAT IS ALSO ON THE PAGES. Every
              // other field in `EDIT_FIELDS` is read from `_meta` at compile
              // time; the brand is ALSO a literal in every page's source
              // (`<SiteChrome name="…">`, headings, copy), so storing it alone
              // changed the browser tab and the link preview and left every
              // visible heading saying the old name — reported as done. No model
              // call: `renamePages` reuses the free text editor's own extractor,
              // so it rewrites prose a visitor reads and never an import path,
              // a route id or a URL.
              let eSrcOut = eSrc, renamed = 0;
              if (moved.includes("brand") && priorLook && priorLook.brand && merged.brand) {
                const rn = renamePages(eSrc, priorLook.brand, merged.brand);
                eSrcOut = rn.pages; renamed = rn.applied;
              }
              // THE PAGES OTHERWISE GO BACK UNTOUCHED. `recompileAndPublish`
              // reads the look it was just handed out of `_meta` rather than
              // taking it as an argument, which is what makes "store, then
              // recompile" the whole of this layer.
              // Labelled by the CHANGE, in the customer's own words — the one
              // question the versions panel is opened to answer. `versionLabel`
              // already does exactly this for a revise; a second labeller here
              // would be a second thing that can disagree about what to call a
              // build.
              const pub = await recompileAndPublish(env, {
                slug: ownerSlug, pages: eSrcOut,
                label: versionLabel({ revise: true, changeNote: eInstruction }),
              });
              if (!pub.ok) {
                return Response.json({
                  ok: false, error: "compile", cost: 0,
                  msg: compileMsg(pub, "That look didn't compile, so your site is untouched."),
                  detail: pub.detail,
                }, { status: 422 });
              }
              return Response.json({
                ok: true, layer: "look", moved, tokens: tokensMoved ? Object.keys(nextTokens) : [],
                // PLAIN NAMES, not the axis keys. The client joins this straight
                // into its sentence and cannot import the module that knows what
                // `display` means, so raw keys would print "Updated the look —
                // display" about a change to the heading colour.
                style: styleMoved ? Object.keys(nextStyle).map(styleSaid) : [],
                // AND WHAT WAS ASKED FOR AND REFUSED, which the list above cannot
                // carry: an axis that was dropped moved nothing, so a customer
                // told only what changed reads the silence as the builder being
                // broken rather than as a request that did not land.
                styleNote: styleNote(styleAsk.style, styleAsk.dropped) || undefined,
                renamed, files: pub.files, cost: await eCharge(dUsage), usage: dUsage,
              });
            }

            if (eLayer === "page") {
              // ── ONE PAGE, ONE MODEL CALL ────────────────────────────────
              //
              // The cheapest generation there is: only this page's source goes
              // into the prompt and only this page comes back, where a revise
              // pays to re-emit every page of the site to move one section.
              //
              // THE FILE IS FOUND THROUGH `routeOf`, the same function the addon
              // lane uses to name a route — rather than a second path-to-route
              // mapping here, which is two things that can disagree about what
              // `src/routes/shop/index.tsx` is called.
              const wantRoute = String((eb && eb.page) || "").trim().toLowerCase();
              const target = eSrc.find((p) => p && routeOf(p.path) === wantRoute);
              // The router checks this against the digest already; it can still
              // be wrong about a site whose digest carried no pages. A page we
              // cannot find is an ADDON — they are asking for one that is not
              // there — which is exactly what the rung above does.
              if (!target) return escalate("no-page", { page: wantRoute });

              // ── TAKING THE PAGE AWAY, WITH NO MODEL CALL AT ALL ───────────
              //
              // THREE ATTEMPTS AT PERSUASION FAILED, and the measurements are why
              // this is here rather than in a prompt. Asked to delete a page, the
              // pages model rewrites the site and never sets the field that
              // deletes one — with the instruction directly under the header, the
              // tool description leading on it, and the schema constraint that
              // once made the honest answer impossible removed. Ruled out on the
              // way: the block is not being truncated, since every one of the 100
              // family exemplars fits under `MAX_PRIOR_CHARS` (max 50,646 against
              // 90,000). It is seeing the words.
              //
              // So the decision moves to the ROUTER, which is already equipped
              // for it: it has just resolved this page against the site's real
              // list. Deleting is then a MERGE, not a generation — ~0.3 credits
              // and a recompile, against the ~28 a rewrite costs, on the one
              // operation that should be the cheapest thing the platform does.
              //
              // `mergeAddonPages` does the deciding, unchanged, so the guards are
              // the ones already tested: never the home page, and never a page
              // another page still links to. That second refusal is the whole
              // reason a model is still sometimes needed — and when it fires this
              // escalates to the addon lane, which can rewrite the linkers.
              if (eb && eb.remove === true) {
                const cut = mergeAddonPages(eSrc, [], [target.path]);
                if (!cut.ok) {
                  // A page something still links to needs the links taken out
                  // first, and that DOES need a model. Up the ladder, with the
                  // sentence the merge already composed.
                  if (cut.msg) return Response.json({ ok: false, error: cut.reason, cost: 0, msg: cut.msg.trim() }, { status: 422 });
                  return escalate(cut.reason, { page: wantRoute });
                }
                const cutPub = await recompileAndPublish(env, {
                  slug: ownerSlug, pages: cut.pages,
                  label: versionLabel({ revise: true, changeNote: eInstruction }),
                });
                if (!cutPub.ok) {
                  return Response.json({
                    ok: false, error: "compile", cost: 0,
                    msg: compileMsg(cutPub, "Taking that page out left the site not compiling, so nothing changed."),
                    detail: cutPub.detail,
                  }, { status: 422 });
                }
                // NO `cost`, because nothing was generated. The routing call that
                // decided this was already charged where every routing call is.
                return Response.json({
                  ok: true, layer: "page", page: wantRoute, removed: cut.removed,
                  files: cutPub.files, cost: 0,
                });
              }

              const eDb = await siteBackendBySlug(env, ownerSlug);
              let eSpec = null, eLook2 = null;
              try {
                const rows = await sqlQuery(eDb, "SELECT k, v FROM _meta WHERE k IN ('site_look','schema')");
                for (const r of rows || []) {
                  if (r.k === "schema" && r.v) eSpec = JSON.parse(r.v);
                  if (r.k === "site_look" && r.v) eLook2 = JSON.parse(r.v);
                }
              } catch (e) { console.error("page edit meta read failed:", ownerSlug, e && e.message); }
              if (!eSpec || !eLook2) return escalate("no-meta");

              const eModels = modelsFor(eb && eb.picker);
              let eGen = null;
              try {
                // Same as the addon lane: a stated zero, because the absence of
                // one is not an instruction and the model writes tokens anyway.
                eGen = await generateSitePages(env, briefWithLayout({ brief: eInstruction, images: 0 }),
                  eSpec, eLook2.brand || ownerSlug, eLook2.family || null, [], eModels.pages, eSrc, "page", target.path);
              } catch (e) {
                console.error("page edit generate failed:", ownerSlug, e && e.message);
                const pKind = upstreamKind(e && e.detail);
                return Response.json({
                  ok: false, error: "generate", cost: 0,
                  msg: pKind.billing
                    ? "The site builder is temporarily unavailable — this is on us, not your change."
                    : "The builder is busy — try again in a moment.",
                  upstream: (e && e.status) || null, upstreamType: pKind.type, billing: pKind.billing || undefined,
                }, { status: 503 });
              }

              // `knownRoutes`: the site's own stored pages, so the dangling-link
              // rewrite stops treating every UNCHANGED page as nonexistent — a
              // one-page edit used to have its correct <Link to="/book"> pointed
              // at "/" and the customer told their live page did not exist
              // (2026-08-13 audit, reproduced with the real module).
              const pValid = validatePages(eGen && eGen.input, {
                partial: true,
                knownRoutes: (eSrc || []).map((p) => routeOf(p && p.path)).filter(Boolean),
              });
              const pSlots = countImageSlots(pValid.pages);
              pValid.pages = applyImages(pValid.pages, {});
              // Same as the addon lane: the shape check is not the lint, and the
              // lint is the one that matters.
              const pProblems = pValid.problems.concat(lintPages(pValid.pages, eSpec));
              // ONLY THE PAGE THAT WAS ASKED FOR. A page edit that returns a
              // different file is not a page edit, and taking it would let one
              // instruction rewrite a page the customer never named. The prompt
              // says so too; this is the half that cannot be talked out of it.
              const wrote = (pValid.pages || []).find((p) => p.path === target.path);
              if (!wrote || wrote.source === target.source) {
                return escalate(wrote ? "no-change" : "no-page-back", { problems: pProblems.slice(0, 4) });
              }
              const pPages = eSrc.map((p) => (p.path === target.path ? { path: p.path, source: wrote.source } : p));

              const pPub = await recompileAndPublish(env, {
                slug: ownerSlug, pages: pPages,
                label: versionLabel({ revise: true, changeNote: eInstruction }),
              });
              if (!pPub.ok) {
                return Response.json({
                  ok: false, error: "compile", cost: 0,
                  msg: compileMsg(pPub, "That change didn't compile, so your site is untouched — try describing it differently."),
                  detail: pPub.detail,
                }, { status: 422 });
              }
              return Response.json({
                ok: true, layer: "page", page: wantRoute,
                photos: pSlots,
                ignored: (pValid.pages || []).filter((p) => p.path !== target.path).map((p) => p.path).slice(0, 4),
                problems: pProblems.slice(0, 4),
                files: pPub.files, cost: await eCharge(eGen && eGen.usage), usage: eGen && eGen.usage,
              });
            }

            // A LAYER NOBODY IMPLEMENTS escalates rather than pretending, so the
            // change still happens — one rung up, at the price of a rung up.
            return escalate("layer");
          }
          if (ad) {
            // ── THE ADDON LANE ────────────────────────────────────────────
            //
            // The rung between edit and build: add a page the site does not
            // have, or a table it has no table for, and KEEP everything it
            // does. A build would answer the same request by rewriting all five
            // pages that were fine.
            //
            // WHAT MAKES IT CHEAPER IS WHAT COMES BACK. The prompt still
            // carries the whole site — input is ~5% of a warm build and rides
            // in the cache — but the model returns only the new page and the
            // pages it had to touch to make it reachable, and `mergeAddonPages`
            // folds that over the rest. Output is ~87% of the bill.
            if (!env.SITES_BUCKET) return Response.json({ ok: false, error: "storage not configured" }, { status: 501 });
            if (request.method !== "POST") return Response.json({ ok: false, error: "method not allowed" }, { status: 405 });
            const ga = await assertOwner(ownerDeps, ownerSlug, ou.id);
            if (ga.error) return Response.json(ga.error.body, { status: ga.error.status });

            const ab = await request.json().catch(() => ({}));
            const aInstruction = String((ab && ab.instruction) || "").trim().slice(0, 2000);
            const aAuth = request.headers.get("Authorization") || "";
            // Same shape as the edit lane's: this rung has one above it too.
            const aEscalate = (reason, extra) =>
              Response.json({ ok: false, escalate: true, reason, cost: 0, ...(extra || {}) });
            if (!aInstruction) return aEscalate("empty");
            if (!env.ANTHROPIC_API_KEY) return aEscalate("unconfigured");

            const aSrc = await loadSiteSource(env, ownerSlug);
            if (!aSrc || !aSrc.length) return aEscalate("no-source");
            const adb = await siteBackendBySlug(env, ownerSlug);
            if (!adb) return aEscalate("no-backend");

            let aLook = null, aSpec = null;
            try {
              const rows = await sqlQuery(adb, "SELECT k, v FROM _meta WHERE k IN ('site_look','schema')");
              for (const r of rows || []) {
                if (r.k === "site_look" && r.v) aLook = JSON.parse(r.v);
                if (r.k === "schema" && r.v) aSpec = JSON.parse(r.v);
              }
            } catch (e) { console.error("addon meta read failed:", ownerSlug, e && e.message); return aEscalate("no-meta"); }
            if (!aLook || !aSpec) return aEscalate("no-meta");

            const aModels = modelsFor(ab && ab.picker);
            // THE DESIGNER, IN EDIT MODE. It declares only a table this change
            // genuinely needs — `site-edit.mjs`'s absent-means-unchanged rule —
            // so most addons come back with none and the schema step no-ops.
            let aDesigned = null, aDesignUsage = null;
            try {
              const d = await designSiteSchema(env, aInstruction, aModels.design, {
                ...aLook,
                tables: ((aSpec && aSpec.tables) || []).map((t) => t && t.name).filter(Boolean),
              });
              aDesigned = d.input; aDesignUsage = d.usage;
            } catch (e) {
              console.error("addon design failed:", ownerSlug, e && e.message);
              const aKind = upstreamKind(e && e.detail);
              return Response.json({
                ok: false, error: "design", cost: 0,
                msg: aKind.billing
                  ? "The site builder is temporarily unavailable — this is on us, not your change."
                  : "The designer is busy — try again in a moment.",
                upstream: (e && e.status) || null, upstreamType: aKind.type, billing: aKind.billing || undefined,
              }, { status: 503 });
            }

            // A NEW TABLE, IF THIS CHANGE NEEDS ONE. No provisioning: the site
            // has a database already, and every statement the engine emits is
            // additive or IF NOT EXISTS, so applying a merged spec to a live
            // database adds what is new and leaves what is there. Seeding is
            // best-effort and skips a table that already has rows, exactly as
            // it does on a revise.
            let aTables = [], aAltered = [], aSeeded = null, aSeedUsage = null, aSeedTopUp = null;
            if (aDesigned && Array.isArray(aDesigned.tables) && aDesigned.tables.length) {
              // A TABLE THE SITE ALREADY HAS CAN NOW BE ALTERED, narrowly. The
              // concat this replaces fed `normalizeSchema`, whose dedup is
              // first-declaration-wins — so `payment` and `publicView` on an
              // existing table were dropped silently and a site built without a
              // price could never start taking money. `mergeAddonSchema` keeps
              // the columns-only behaviour that was right and adds those two;
              // `access` stays the site's own, because the tool COMPELS it.
              // THE WHOLE DESIGNED SPEC, not just its tables. Passing
              // `{tables}` alone dropped `functions`, `apis` and `jobs` before
              // `normalizeSchema` ever saw them — measured — which is the entire
              // "the model writes the backend" tier unreachable on any site
              // after its first build: no inbound webhook handler, no
              // confirmation computed by SQL, no third-party read.
              const folded = mergeAddonSchema(aSpec.tables || [], aDesigned);
              aAltered = folded.altered;
              const merged = normalizeSchema(folded.spec);
              // THE SEED NET, on the lane that ADDS display tables to LIVE
              // sites. The build path grew this on 2026-08-12 (the designer
              // omits its own required `seed` — measured twice) and this lane
              // was left one step short of the same promise: a customer asking
              // "add a specials menu" paid ~25 credits for a page over a
              // permanently-empty table, reported as success (2026-08-14
              // audit). NARROWED TO THE TABLES THIS ADDON ADDED — a
              // re-declared existing table is skipped by seedSiteRows when it
              // already has rows, so buying rows for one spends a Haiku call
              // on rows that are immediately discarded.
              let aSeed = aDesigned.seed;
              const aTop = await topUpSeed(
                { send: (req) => anthropicMessages(env, req) },
                { brief: aInstruction, spec: { ...aDesigned, tables: (aDesigned.tables || []).filter((t) => t && folded.added.includes(t.name)) }, seed: aSeed },
              );
              if (aTop.gaps.length) {
                aSeedTopUp = { gaps: aTop.gaps, filled: Object.keys(aTop.rows) };
                console.log("addon seed top-up:", ownerSlug, JSON.stringify(aSeedTopUp));
              }
              if (Object.keys(aTop.rows).length) aSeed = mergeSeed(aSeed, aTop.rows);
              aSeedUsage = aTop.usage;
              try {
                await applySiteSchema(adb, merged);
                // WHAT WAS CREATED, not what was NAMED. This read every table
                // the designer mentioned, which was harmless while an existing
                // one could not be touched and became a lie the moment it could:
                // "made a bookings table" for a booking table the site has had
                // since it was built.
                aTables = folded.added;
                aSpec = (await loadSiteSchema(adb).catch(() => null)) || merged;
              } catch (e) {
                console.error("addon schema apply failed:", ownerSlug, e && (e.detail || e.message));
                return Response.json({ ok: false, error: "schema", cost: 0, msg: "That change needed a new table and it couldn't be created — your site is untouched." }, { status: 502 });
              }
              // THE REPORT IS KEPT, not discarded — `{seeded, skipped}` is the
              // only thing that can say why a new table arrived empty, and the
              // old bare `await` threw it away, so the failure could not name
              // itself here any more than it could on the build path.
              try { aSeeded = await seedSiteRows(adb, merged, aSeed); }
              catch (e) { console.error("addon seeding failed:", ownerSlug, e && e.message); }
            }

            // ONE PAGE CALL, in addon mode. `priorPages` is the whole site so
            // the model can edit a nav entry; `mode` is what makes it return
            // only what it touched.
            let aGen = null;
            try {
              // `images: 0` IS AN INSTRUCTION AND ITS ABSENCE IS NOT. Neither
              // this lane nor the edit lane buys photographs — the rule a revise
              // already follows — and `site-images.mjs`'s own comment names
              // exactly what happens without a stated zero: "a model with no
              // instruction writes image tokens anyway". An unbought token
              // publishes as the literal text `@@IMG:a barber chair@@`: a broken
              // image AND a visible leak of how the site was made.
              aGen = await generateSitePages(env, briefWithLayout({ brief: aInstruction, images: 0 }),
                aSpec, aLook.brand || ownerSlug, aLook.family || null, [], aModels.pages, aSrc, "addon");
            } catch (e) {
              console.error("addon generate failed:", ownerSlug, e && e.message);
              const aKind = upstreamKind(e && e.detail);
              return Response.json({
                ok: false, error: "generate", cost: 0,
                msg: aKind.billing
                  ? "The site builder is temporarily unavailable — this is on us, not your change."
                  : "The builder is busy — try again in a moment.",
                upstream: (e && e.status) || null, upstreamType: aKind.type, billing: aKind.billing || undefined,
              }, { status: 503 });
            }

            // `knownRoutes` for the same reason as the page-edit lane: without
            // the stored site's routes, every unchanged page reads as
            // nonexistent and correct links into them are rewritten to "/".
            const aValid = validatePages(aGen && aGen.input, {
              partial: true,
              knownRoutes: (aSrc || []).map((p) => routeOf(p && p.path)).filter(Boolean),
            });
            // AND SWEPT ANYWAY, belt and braces. The directive is what SHOULD stop a
            // token being written; this is what stops one reaching a customer's site
            // if it is written regardless. The build path has both, and the one time
            // this repo relied on the model alone it shipped a broken image on the
            // first live site it made.
            const aSlots = countImageSlots(aValid.pages);
            aValid.pages = applyImages(aValid.pages, {});
            // AND LINTED. `validatePages` checks the SHAPE — a path, a Route
            // export, no duplicates. `lintPages` is the one that catches the
            // class of page that typechecks, bundles and then 403s or renders
            // wrong: a table the schema never declared, a `collect` table being
            // listed, a component that does not exist, an invented prop, a `#/`
            // link, a demo chart full of a stranger's invented numbers — and the
            // literal colour that would make the look layer silently do nothing.
            //
            // It ran ONLY in the build path, so both lanes that generate pages
            // were publishing without any of it. It does not block publishing,
            // by design; what it does is report, and reporting nothing was the
            // bug.
            const aProblems = aValid.problems.concat(lintPages(aValid.pages, aSpec));
            // `remove` IS OPTIONAL ON THE TOOL and the build prompt never mentions
            // it, so no build request changes shape. Only the addon prompt
            // explains it, and only this lane reads it.
            const aRemove = (aGen && aGen.input && Array.isArray(aGen.input.remove)) ? aGen.input.remove : [];
            const aMerge = mergeAddonPages(aSrc, aValid.pages, aRemove);
            // A CONSIDERED REFUSAL DOES NOT CLIMB THE LADDER. Escalation is for
            // "this lane could not answer" — the rung above rewrites the whole
            // site, which is expensive and does work. "Remove the home page" has
            // an answer, and sending it up rebuilds a customer's site, for ~25
            // credits, in reply to a request that should have been one sentence.
            if (!aMerge.ok && aMerge.msg) {
              return Response.json({ ok: false, error: aMerge.reason, cost: 0, msg: aMerge.msg.trim() }, { status: 422 });
            }
            // NOTHING USABLE CAME BACK — escalate rather than report success.
            if (!aMerge.ok) return aEscalate(aMerge.reason, { problems: aProblems.slice(0, 4) });

            const aPub = await recompileAndPublish(env, {
              slug: ownerSlug, pages: aMerge.pages,
              label: versionLabel({ revise: true, changeNote: aInstruction }),
            });
            // A FAILED COMPILE LEAVES THE LIVE SITE ALONE. Not escalated: the
            // rung above would rewrite pages the owner never asked about, to
            // recover from a page this one wrote.
            if (!aPub.ok) {
              return Response.json({
                ok: false, error: "compile", cost: 0,
                msg: compileMsg(aPub, "That addition didn't compile, so your site is untouched — try describing it differently."),
                detail: aPub.detail,
              }, { status: 422 });
            }

            // Charged after the publish, on measured usage, from the one price
            // table — the same rule every other model call follows.
            let aCost = 0;
            try {
              // VARIADIC, NOT TWO CALLS ADDED. `pageCredits` takes several
              // usages precisely so they land on one bill with ONE rounding and
              // ONE 1-credit floor — its own comment says adding
              // separately-rounded results "would charge twice for the
              // rounding". Measured against the real module: a typical
              // Haiku-design + Sonnet-pages pair billed 20 summed against 19
              // priced together, and two tiny calls billed 2 against 1. Every
              // addon on the platform overpaid one to two credits.
              // The seed top-up rides the same variadic call: one bill, one
              // rounding, one floor — a third separately-rounded charge is the
              // exact overbilling this call was rewritten to end.
              const bill = pageCredits(aDesignUsage, aGen && aGen.usage, aSeedUsage);
              aCost = await collectCredits(aAuth, bill);
            } catch { aCost = 0; }
            return Response.json({
              ok: true,
              added: aMerge.added, changed: aMerge.changed, removed: aMerge.removed, kept: aMerge.kept,
              reverted: aMerge.reverted,
              photos: aSlots,
              tables: aTables, altered: aAltered,
              // What the seeding DID, the build response's own three fields:
              // rows per table, why a table was passed over, and whether the
              // net had to buy rows the designer omitted. Absent when the
              // addon declared no tables, so an ordinary page addon's response
              // is byte-identical to before.
              seeded: aSeeded ? aSeeded.seeded : undefined,
              seedSkipped: (aSeeded && aSeeded.skipped && aSeeded.skipped.length) ? aSeeded.skipped.slice(0, 6) : undefined,
              seedTopUp: aSeedTopUp || undefined,
              unlinked: unlinkedPages(aMerge.pages, aMerge.added),
              problems: aProblems.slice(0, 4),
              files: aPub.files, cost: aCost,
            });
          }
          if (tx) {
            // ── CHANGING THE WORDS, WITH NO MODEL CALL ────────────────────
            //
            // A typo in a heading used to cost a full revise — a model call, a
            // container compile, ~21 credits — because the words are not in the
            // database, they are in the page source, and nothing could reach
            // them. Now that a build stores the source it produced, an owner can
            // edit the text directly: the same container compiles it and the
            // same publish path ships it, and no model is asked anything.
            //
            // FREE IN CREDITS, NOT IN TIME. The container still has to build,
            // which is the honest thing to tell the customer.
            if (!env.SITES_BUCKET) return Response.json({ ok: false, error: "storage not configured" }, { status: 501 });
            const g = await assertOwner(ownerDeps, ownerSlug, ou.id);
            if (g.error) return Response.json(g.error.body, { status: g.error.status });

            const src = await loadSiteSource(env, ownerSlug);
            if (!src) {
              // A site built before the source was stored has nothing to edit.
              // Said plainly rather than answered with an empty list, which
              // reads as "this page has no words on it".
              return Response.json({
                ok: false, error: "no-source",
                msg: "This site was built before text editing existed. Its next change will make the words editable.",
              }, { status: 409 });
            }

            if (request.method === "GET") {
              return Response.json({
                ok: true,
                pages: src.map((p) => ({ path: p.path, items: extractText(p.source) })),
              });
            }
            if (request.method !== "POST") return Response.json({ ok: false, error: "method not allowed" }, { status: 405 });

            const tb = await request.json().catch(() => ({}));
            const ed = applyEdits(src, Array.isArray(tb && tb.edits) ? tb.edits.slice(0, 200) : []);
            if (!ed.ok) return Response.json({ ok: false, error: ed.error }, { status: 400 });

            // THE SHARED SPINE — compile, publish, archive, store the source.
            // This block WAS that code, inline, and it was the second copy: the
            // build path has its own, and the two had quietly disagreed about
            // three fields of the published meta. See `recompileAndPublish`.
            const out = await recompileAndPublish(env, {
              slug: ownerSlug, pages: ed.pages, label: "Edited the wording",
            });
            // A FAILED COMPILE LEAVES THE LIVE SITE ALONE. The words came from
            // the owner, so a refusal here is theirs to correct — publishing a
            // broken bundle to fix a typo is the trade nobody would make.
            if (!out.ok) {
              return Response.json({
                ok: false, error: "compile",
                msg: compileMsg(out, "That change didn't compile, so your site is untouched — try shorter wording."),
                detail: out.detail,
              }, { status: 422 });
            }

            return Response.json({ ok: true, applied: ed.applied, files: out.files, cost: 0 });
          }
          if (vr) {
            if (!env.SITES_BUCKET) return Response.json({ ok: false, error: "storage not configured" }, { status: 501 });
            // `g.error` IS A PLAIN `{status, body}`, NOT A `Response` —
            // `site-owner.mjs`'s own `json()` builds it that way. Returned
            // straight out of the handler it is not a Response at all, so every
            // REFUSAL would 500 while the success path worked perfectly: the
            // `dm2` bug inverted, from the same misread of the same contract.
            const g = await assertOwner(ownerDeps, ownerSlug, ou.id);
            if (g.error) return Response.json(g.error.body, { status: g.error.status });
            if (!vr[2] && request.method === "GET") {
              return Response.json({ ok: true, versions: await listVersions(versionDeps(env), { slug: ownerSlug }) });
            }
            if (vr[2] && request.method === "POST") {
              const vb = await request.json().catch(() => ({}));
              // THE SHAPE CHECK LIVES IN `rollbackVersion`, NOT HERE. It runs
              // there before any I/O, so a copy at this layer buys nothing and
              // is a second place the rule can drift — the `hasPublicView`
              // lesson. Proved rather than assumed: a mutation deleting a check
              // here changed nothing observable, which is what an inert guard
              // looks like. `isVersionId` is still imported and used by the
              // module; `id` reaches it as whatever the caller sent.
              const rb = await rollbackVersion(versionDeps(env), { slug: ownerSlug, id: vb && vb.id });
              if (!rb.ok) return Response.json({ ok: false, error: rb.error || "rollback failed" }, { status: rb.status || 500 });
              return Response.json({ ok: true, id: rb.id, files: rb.files, swept: rb.swept, url: "/s/" + ownerSlug + "/" });
            }
            return Response.json({ ok: false, error: "method not allowed" }, { status: 405 });
          }
          if (dm2) {
            // THE OWNER'S OWN DOMAINS.
            //
            // `r` IS A PLAIN `{body, status}`, NEVER A `Response`. This whole
            // block ends in `return Response.json(r.body, {status: r.status})`,
            // so a real Response assigned here has its `.body` read as a
            // ReadableStream: the GET serialised to `{}` with a 200 and the POST
            // threw into the catch as a 500 — after the row had already been
            // inserted. Every DIRECT `return Response.json(...)` below is fine
            // and worked throughout, which is exactly what made it confusing:
            // the refusals answered correctly and only the successes were wrong.
            //
            // Behind `assertOwner` like every other route here, which is what
            // stops somebody attaching a domain to a site that is not theirs.
            const dslug = dm2[1].toLowerCase();
            // `assertOwner` answers `{}` on success and `{error: <Response>}` on
            // failure — there is NO `ok` field. This read `!g.ok`, which is true
            // on success as well, so the route answered 404 to everybody
            // including the rightful owner. Second dead layer in one feature:
            // the dispatch above made it reachable, and this made it useless.
            const g = await assertOwner(ownerDeps, dslug, ou.id);
            if (g.error) return Response.json(g.error.body, { status: g.error.status });
            const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY, "Content-Type": "application/json" };
            const rest = (q, init) => fetch(`${SUPABASE_URL}/rest/v1/site_domains${q}`, { ...(init || {}), headers: { ...svc, ...((init || {}).headers || {}) }, signal: AbortSignal.timeout(10000) });

            if (request.method === "GET") {
              const rr = await rest(`?slug=eq.${encodeURIComponent(dslug)}&select=hostname,status,cf_id,last_error,created_at&order=created_at`);
              const rows = await rr.json().catch(() => []);
              // LIVE STATUS, not the stored one. The row says what we last knew;
              // Cloudflare knows whether the certificate came through, and an
              // owner refreshing this page is asking exactly that. Best-effort
              // per row, so one unreachable lookup does not empty the list.
              // HOISTED OUT OF THE LOOP: importing an RSA key is not free, and
              // this built one PER DOMAIN to produce the same signer every time.
              //
              // It also makes the answer observable. Without `signing`, a panel
              // showing no button cannot distinguish "your DNS provider does not
              // support this" from "this platform has no signing key" — and the
              // second is our fault, not the owner's. That ambiguity is how a
              // missing key stays missing.
              const dcSign1 = env.DOMAIN_CONNECT_KEY ? await dcSigner(env.DOMAIN_CONNECT_KEY) : null;
              const out = [];
              for (const row of (Array.isArray(rows) ? rows : []).slice(0, 20)) {
                const item = { hostname: row.hostname, status: row.status, error: row.last_error || null, ...dnsInstructions(row.hostname, saasTarget(env)) };
                if (row.cf_id) {
                  const cf = await cfHostname(env, "GET", "/" + encodeURIComponent(row.cf_id));
                  if (cf.ok) {
                    const st = readStatus(cf.result);
                    item.stage = st.stage; item.live = st.live; item.pending = st.pending; item.failed = st.failed;
                    // Write back only on a CHANGE, so a listing does not cost a
                    // write per row per refresh.
                    const want = st.live ? "live" : st.failed ? "failed" : "pending";
                    if (want !== row.status) {
                      await rest(`?hostname=eq.${encodeURIComponent(row.hostname)}`, {
                        method: "PATCH", headers: { Prefer: "return=minimal" },
                        body: JSON.stringify({ status: want, checked_at: new Date().toISOString() }),
                      }).catch(() => {});
                      item.status = want;
                    }
                  } else { item.stage = "couldn't check just now"; }
                }
                // WHAT THE DOMAIN ACTUALLY POINTS AT, RIGHT NOW.
                //
                // "Waiting for DNS" is true and useless — it is the same
                // sentence whether they have not touched their registrar,
                // typed the record on the wrong name, or done it correctly
                // four minutes ago. Those need different responses.
                //
                // Only while it is unresolved: a live domain resolves to us by
                // definition, and spending two lookups to confirm what the
                // certificate already proves is a slower panel for nothing.
                if (item.status !== "live") {
                  const dnsDeps = { fetch: (u, i) => fetch(u, i) };
                  // Two independent lookups, run TOGETHER rather than in
                  // sequence: neither needs the other's answer, and a panel
                  // listing three domains would otherwise pay for six round
                  // trips one after another.
                  const [chk, who] = await Promise.all([
                    checkDns(dnsDeps, { hostname: row.hostname, target: saasTarget(env) }),
                    detectProvider(dnsDeps, row.hostname),
                  ]);
                  item.dns = chk.state;
                  item.dnsNote = dnsSentence(chk, saasTarget(env));
                  // WHO HOLDS THEIR DNS. "Add a CNAME at whoever you bought the
                  // domain from" is the sentence that loses people — they do
                  // not always know who that is, and the page is four clicks
                  // deep behind a name like "Manage Zones". The nameservers say
                  // exactly who, publicly, with no credential from anybody.
                  const note = providerSentence(who);
                  if (note) item.providerNote = note;
                  if (who.provider) { item.provider = who.provider.name; item.providerUrl = who.provider.dns || null; }

                  // ONE-CLICK SETUP, where the provider supports Domain Connect.
                  //
                  // The owner goes to THEIR provider, who signs them in and
                  // shows them exactly what will change. We never hold a
                  // credential for their DNS and never touch it — the button is
                  // a link, and that is the entire integration.
                  //
                  // Only offered while DNS is still wrong: once it points here
                  // there is nothing left for the provider to apply, and a
                  // "set it up" button on a finished domain invites somebody to
                  // redo work that is already done.
                  if (chk.state !== "ok") {
                    // The registrable domain, not the hostname — the discovery
                    // record and the template both live on the zone.
                    const parts = row.hostname.split(".");
                    const zone = parts.slice(-2).join(".");
                    const sub = parts.slice(0, -2).join(".");
                    // WHICH GROUP OF THE TEMPLATE THIS HOSTNAME WANTS.
                    //
                    // Two records in two groups — an APEXCNAME for the bare
                    // domain, a CNAME for `www` — and one-click applies
                    // exactly one of them. Any OTHER subdomain has no group,
                    // so it gets the copyable records instead: the template
                    // would have to carry a CNAME at `@`, which the standard's
                    // own schema refuses unless a host is mandatory, and
                    // making it mandatory is what would lose the apex.
                    const dcGroup = sub === "" ? "apex" : sub === "www" ? "www" : null;
                    const offer = dcGroup
                      ? await dcOfferFor(dnsDeps, zone).catch(() => ({ supported: false }))
                      : { supported: false, otherSubdomain: true };
                    if (offer.supported) {
                      const built = dcApplyUrl(offer.settings, {
                        provider: DC_PROVIDER, serviceId: DC_SERVICE,
                        domain: zone, groupId: dcGroup,
                        params: { target: saasTarget(env) },
                      });
                      // SIGNED OR NOT OFFERED AT ALL.
                      //
                      // The template declares `syncPubKeyDomain`, so providers
                      // will REQUIRE a signature and an unsigned link is
                      // refused at their end. Falling back to an unsigned one
                      // would be a button that always fails; falling back to
                      // nothing leaves the copyable records, which work.
                      //
                      // It is also the security property: unsigned, anybody
                      // could build an apply URL under our provider name
                      // pointing a stranger's domain wherever they liked.
                      const signed = built && dcSign1 ? await dcSign({ sign: dcSign1 }, built.query, DC_KEY_ID) : null;
                      if (signed) { item.oneClick = built.base + "?" + signed; item.oneClickProvider = offer.provider; }
                    } else if (offer.asyncOnly) {
                      // Said rather than folded into silence: their provider
                      // does support this, through a sign-in we have not built.
                      item.oneClickBlocked = "asyncOnly";
                    } else if (offer.otherSubdomain) {
                      // Also said rather than silent, and for the same reason:
                      // the records below are the answer, and an owner who
                      // sees nothing assumes the feature is broken.
                      item.oneClickBlocked = "subdomain";
                    }
                  }
                }
                out.push(item);
              }
              r = { body: { ok: true, domains: out, target: saasTarget(env), signing: !!dcSign1 }, status: 200 };
            } else if (request.method === "POST") {
              const b = await request.json().catch(() => ({}));
              const refusal = claimRefusal(b && b.hostname);
              if (refusal) return Response.json({ ok: false, error: refusal }, { status: 400 });
              const host = normalizeHostname(b.hostname);
              // TAKEN IS 409, AND IT IS CHECKED HERE AS WELL AS BY THE PRIMARY
              // KEY. The key is what makes it true under a race; this is what
              // makes the answer say something useful rather than surfacing a
              // Postgres conflict.
              const ex = await rest(`?hostname=eq.${encodeURIComponent(host)}&select=slug,uid`);
              const exRows = await ex.json().catch(() => []);
              if (Array.isArray(exRows) && exRows[0]) {
                const mine = exRows[0].slug === dslug && exRows[0].uid === ou.id;
                return Response.json({ ok: false, error: mine ? "That domain is already on this site." : "That domain is already in use." }, { status: 409 });
              }
              // THE ROW FIRST, THEN CLOUDFLARE. Registered first and recorded
              // second, a lost response leaves a hostname live on our zone that
              // we have no record of and will therefore never clean up — and
              // Cloudflare for SaaS is billed per hostname.
              const ins = await rest("", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ hostname: host, slug: dslug, uid: ou.id }) });
              if (!ins.ok) return Response.json({ ok: false, error: "couldn't record that domain just now" }, { status: 503 });
              const cf = await cfHostname(env, "POST", "", {
                hostname: host,
                // TXT validation, so an owner never has to serve a file from a
                // site that is not pointing at us yet — which is the state they
                // are in when they add the domain.
                ssl: { method: "txt", type: "dv", settings: { min_tls_version: "1.2" } },
              });
              if (!cf.ok) {
                // The row is KEPT and carries the reason. Deleted, the owner
                // sees their domain vanish with an error and no way to retry
                // the same name without wondering whether it half-registered.
                await rest(`?hostname=eq.${encodeURIComponent(host)}`, {
                  method: "PATCH", headers: { Prefer: "return=minimal" },
                  body: JSON.stringify({ status: "failed", last_error: String(cf.error).slice(0, 300) }),
                }).catch(() => {});
                return Response.json({ ok: false, error: cf.error }, { status: 502 });
              }
              await rest(`?hostname=eq.${encodeURIComponent(host)}`, {
                method: "PATCH", headers: { Prefer: "return=minimal" },
                body: JSON.stringify({ cf_id: cf.result && cf.result.id, last_error: null }),
              }).catch(() => {});
              const st = readStatus(cf.result);
              r = { body: { ok: true, hostname: host, status: "pending", stage: st.stage, pending: st.pending, target: saasTarget(env), ...dnsInstructions(host, saasTarget(env)) }, status: 200 };
            } else if (request.method === "DELETE" && dm2[2]) {
              const host = normalizeHostname(dm2[2]);
              if (!host) return Response.json({ ok: false, error: "not found" }, { status: 404 });
              // SCOPED TO THIS SITE, so a valid owner of one site cannot remove
              // a domain from another.
              const rr = await rest(`?hostname=eq.${encodeURIComponent(host)}&slug=eq.${encodeURIComponent(dslug)}&select=cf_id`);
              const rows = await rr.json().catch(() => []);
              if (!Array.isArray(rows) || !rows[0]) return Response.json({ ok: false, error: "not found" }, { status: 404 });
              // CLOUDFLARE FIRST, THEN THE ROW — the same order and the same
              // reason as `DELETE /api/site/<slug>`: the row is the only record
              // of the registration, so losing it while the hostname is still
              // registered leaves a billed resource nobody can find. A 404 from
              // Cloudflare is already-gone, which is success here.
              let dropped = true;
              if (rows[0].cf_id) {
                const del = await cfHostname(env, "DELETE", "/" + encodeURIComponent(rows[0].cf_id));
                dropped = del.ok || del.status === 404;
              }
              if (!dropped) return Response.json({ ok: false, error: "couldn't release that domain just now — try again" }, { status: 502 });
              await rest(`?hostname=eq.${encodeURIComponent(host)}&slug=eq.${encodeURIComponent(dslug)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
              // This isolate's routing memory is now wrong; other PoPs heal by
              // expiry, exactly like every other invalidation here.
              hostRoutes.delete(host);
              r = { body: { ok: true }, status: 200 };
            } else {
              return Response.json({ error: "method not allowed" }, { status: 405 });
            }
          } else if (sk) {
            // The owner's own API keys. Every value goes through site-secrets.mjs,
            // which is the only place one is ever decrypted; nothing here can
            // return one, and a test asserts this branch never mentions a value.
            const sslug = sk[1].toLowerCase();
            const g = await assertOwner(ownerDeps, sslug, ou.id);
            if (g.error) return Response.json(g.error.body, { status: g.error.status });
            // Resolved AFTER the gate, so a stranger guessing slugs never costs
            // a backend lookup. Fails closed: without a connection we cannot say
            // what a site holds, and answering "no secrets" would read as an
            // empty vault and invite somebody to re-add a key they already have.
            const sconn = await siteBackendBySlug(env, sslug);
            if (!sconn) return Response.json({ error: "publish the site first — then it can hold secrets" }, { status: 409 });
            const vault = {
              list: async () => {
                const rows = await sqlQuery(sconn, "SELECT name, hint, created_at FROM _secrets ORDER BY name");
                // A hint that will not parse is dropped, not thrown on: it is a
                // display nicety, and losing the whole list because one row's
                // hint is malformed would hide the key an owner came to rotate.
                return (rows || []).map((r) => { let hint = {}; try { hint = JSON.parse(r.hint || "{}") || {}; } catch { /* shown without it */ } return { name: r.name, created_at: r.created_at, hint }; });
              },
              get: async (_s, name) => {
                const rows = await sqlQuery(sconn, "SELECT cipher FROM _secrets WHERE name=?", [name]);
                return (rows && rows[0] && rows[0].cipher) || null;
              },
              put: async (_s, name, cipher, hint) => {
                await sqlExec(sconn, "INSERT INTO _secrets (name, cipher, hint) VALUES (?,?,?) ON CONFLICT (name) DO UPDATE SET cipher=excluded.cipher, hint=excluded.hint", [name, cipher, JSON.stringify(hint || {})]);
              },
              remove: async (_s, name) => {
                const r = await sqlExec(sconn, "DELETE FROM _secrets WHERE name=?", [name]);
                return { removed: !!(r && r.changes) };
              },
            };
            try {
              if (request.method === "GET") {
                const listed = await listSecrets(vault, { slug: sslug });
                // The last webhook attempt rides along with the names, because
                // this route IS the webhook configuration surface — an owner
                // looking at WEBHOOK_URL is exactly the person asking whether it
                // works. Additive: the panel reads `.secrets` and is untouched.
                // Best-effort, because a missing note must not fail the listing.
                try {
                  const sdb = await siteBackendBySlug(env, sslug);
                  if (sdb) {
                    const rows = await sqlQuery(sdb, "SELECT v FROM _meta WHERE k='webhook_last'", []);
                    const v = rows && rows[0] && rows[0].v;
                    if (v) listed.webhook = typeof v === "string" ? JSON.parse(v) : v;
                  }
                } catch { /* the names are the answer either way */ }
                return Response.json(listed);
              }
              if (request.method === "POST") {
                const sb = await request.json().catch(() => ({}));
                const r = await addSecret(vault, env, { slug: sslug, name: sb.name, value: sb.value });
                // The owner just changed the configuration, so anything this
                // isolate remembered is wrong. Without this they wait out the TTL
                // — and the moment they are most likely to submit their own form
                // to check is the sixty seconds immediately after saving.
                // Isolate-local, like every other invalidation here: other PoPs
                // heal by expiry.
                if (r && r.ok) forgetSiteConfig(sslug);
                return Response.json(r.ok ? { ok: true, name: r.name, replaced: r.replaced } : { ok: false, error: r.error }, { status: r.ok ? 200 : (r.status || 400) });
              }
              if (request.method === "DELETE") {
                // The name comes from the PATH, never a body: a DELETE with a
                // body is not something every client sends, and the matcher
                // above has already constrained the alphabet.
                const d = await deleteSecret(vault, { slug: sslug, name: sk[2] });
                // REMOVING a secret is the direction that matters more than
                // adding one: a cached Turnstile secret outliving its deletion
                // refuses real submissions on a form whose widget has gone.
                if (d && d.ok) forgetSiteConfig(sslug);
                return Response.json(d);
              }
              return Response.json({ error: "method not allowed" }, { status: 405 });
            } catch (e) {
              // The message is never echoed — a Postgres error can quote the
              // statement, and the statement binds the ciphertext.
              console.error("secrets:", e && (e.detail || e.message));
              return Response.json({ ok: false, error: "couldn't reach the secret store just now" }, { status: 503 });
            }
          } else if (lv) {
            // OFF THE WEB, AND BACK, AT THE SAME ADDRESS.
            //
            // The one removal that worked before this was `DELETE
            // /api/site/<slug>`, which drops the Neon database and every booking
            // in it. Between "live" and "destroyed" there was nothing — no
            // answer for a refit, a seasonal closure, or a site built before
            // launch.
            //
            // `site-live.mjs` owns the decision and REFUSES when nothing could
            // put the site back, so this cannot turn a reversible action into a
            // permanent one. Nothing here touches the database: the rows, the
            // members, the secrets and the domains all survive untouched, which
            // is the half the owner is anxious about.
            const lslug = lv[1].toLowerCase();
            const g = await assertOwner(ownerDeps, lslug, ou.id);
            if (g.error) return Response.json(g.error.body, { status: g.error.status });
            if (request.method !== "POST") return Response.json({ error: "method not allowed" }, { status: 405 });
            const lb = await request.json().catch(() => ({}));
            const liveDeps = {
              versions: ({ slug }) => listVersions(versionDeps(env), { slug }),
              // The stored page source — the second, independent way back. Read
              // as a COUNT rather than kept, so a large site does not pull its
              // whole source into memory to answer a yes/no question.
              hasSource: async ({ slug }) => {
                const src = await loadSiteSource(env, slug).catch(() => null);
                return !!(src && src.length);
              },
              wipe: ({ slug }) => deleteSitePrefix(env, slug),
              rollback: ({ slug, id }) => rollbackVersion(versionDeps(env), { slug, id }),
              recompile: async ({ slug }) => {
                const src = await loadSiteSource(env, slug).catch(() => null);
                if (!src || !src.length) return { ok: false };
                return recompileAndPublish(env, { slug, pages: src, label: "Back online" });
              },
            };
            // `on: true` means OFFLINE, matching the route's name — the same
            // shape `/notify {on}` uses, so the two read alike.
            const out = lb.on === false
              ? await putBackOnline(liveDeps, { slug: lslug })
              : await takeOffline(liveDeps, { slug: lslug });
            return Response.json(out, { status: out.ok ? 200 : (out.reason === "no-way-back" ? 409 : 503) });
          } else if (jb) {
            // WHAT THE SCHEDULED WORK HAS BEEN DOING — and the OFF SWITCH.
            // This used to be read-only, its comment claiming "turning one off
            // is a revise"; the 2026-08-13 audit proved no revise can do it:
            // _meta.jobs is a union-merge nothing ever removes an entry from,
            // the rules lane's CLEARABLE is exactly confirm/sms, and nothing
            // anywhere wrote enabled:false — so an owner asking "stop the
            // weekly digest" had NO path that did not also kill their booking
            // confirmations or the whole site. The runner has filtered
            // `enabled=is.true` all along; this is the one write that flag was
            // waiting for. POST {name, enabled} — owner-gated, owner-scoped,
            // and honest about a name that matches nothing.
            const jslug = jb[1].toLowerCase();
            const g = await assertOwner(ownerDeps, jslug, ou.id);
            if (g.error) return Response.json(g.error.body, { status: g.error.status });
            if (request.method === "POST") {
              let jbody = {};
              try { jbody = await request.json(); } catch { jbody = {}; }
              const jname = String((jbody && jbody.name) || "");
              if (!/^[a-z][a-z0-9_]{0,60}$/i.test(jname)) return Response.json({ error: "bad name" }, { status: 400 });
              // A REAL BOOLEAN, nothing merely truthy — `enabled: "false"`
              // would switch a job ON while the owner was switching it off,
              // the normalizeRole lesson on the field that sends mail.
              if (typeof (jbody && jbody.enabled) !== "boolean") return Response.json({ error: "bad enabled" }, { status: 400 });
              const w = await fetch(`${SUPABASE_URL}/rest/v1/site_functions?owner_id=eq.${encodeURIComponent(ou.id)}&slug=eq.${encodeURIComponent(jslug)}&name=eq.${encodeURIComponent(jname)}&schedule_minutes=not.is.null`, {
                method: "PATCH", headers: svcHeaders(env, { "content-type": "application/json", Prefer: "return=representation" }),
                body: JSON.stringify({ enabled: jbody.enabled }), signal: AbortSignal.timeout(10000),
              });
              if (!w.ok) return Response.json({ error: "unavailable" }, { status: 503 });
              const wr = await w.json().catch(() => null);
              // Zero rows matched = no such scheduled job on this site. Saying
              // ok would be a toggle that reports success while switching
              // nothing — this file's most-recorded failure, on the one
              // control whose whole point is stopping mail.
              if (!Array.isArray(wr) || !wr.length) return Response.json({ error: "no such job" }, { status: 404 });
              return Response.json({ ok: true, name: jname, enabled: jbody.enabled === true });
            }
            if (request.method !== "GET") return Response.json({ error: "method not allowed" }, { status: 405 });
            const q = await fetch(`${SUPABASE_URL}/rest/v1/site_functions?slug=eq.${encodeURIComponent(jslug)}&schedule_minutes=not.is.null&select=name,schedule_minutes,enabled,last_run,last_result&order=name.asc&limit=20`,
              { headers: svcHeaders(env), signal: AbortSignal.timeout(10000) });
            // A READ THAT FAILED IS NOT "THIS SITE HAS NO JOBS", which is the
            // one wrong answer here that matters: it reads as the feature not
            // existing, and the owner stops looking. Same call `analytics`
            // makes — never zeros on an unreadable ledger.
            if (!q.ok) return Response.json({ error: "unavailable" }, { status: 503 });
            const jrows = await q.json().catch(() => null);
            if (!Array.isArray(jrows)) return Response.json({ error: "unavailable" }, { status: 503 });
            return Response.json({
              jobs: jrows.map((j) => ({
                name: String(j.name || ""),
                everyMinutes: Number(j.schedule_minutes) || 0,
                enabled: j.enabled !== false,
                lastRun: j.last_run || null,
                // NULL rather than a cheerful default. A job that has never run
                // and a job whose last run sent nothing are different facts, and
                // inventing a sentence for the first is how a brand-new site
                // reads as working before it ever has.
                lastResult: typeof j.last_result === "string" ? j.last_result : null,
              })),
            });
          } else if (nt) {
            // The off switch. Email the owner did not ask for, with no way to
            // stop it, is not something to ship.
            const nslug = nt[1].toLowerCase();
            const g = await assertOwner(ownerDeps, nslug, ou.id);
            if (g.error) return Response.json(g.error.body, { status: g.error.status });
            if (request.method === "GET") {
              const q = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(nslug)}&select=notify`, { headers: svcHeaders(env), signal: AbortSignal.timeout(10000) });
              const rows = await q.json().catch(() => []);
              return Response.json({ notify: !!(Array.isArray(rows) && rows[0] && rows[0].notify) });
            }
            if (request.method !== "POST") return Response.json({ error: "method not allowed" }, { status: 405 });
            const nb = await request.json().catch(() => ({}));
            const on = !!nb.on;
            const q = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(nslug)}`, {
              method: "PATCH",
              headers: svcHeaders(env, { "content-type": "application/json", Prefer: "return=minimal" }),
              body: JSON.stringify({ notify: on }),
              signal: AbortSignal.timeout(10000),
            });
            if (!q.ok) return Response.json({ error: "couldn't save that just now" }, { status: 503 });
            return Response.json({ ok: true, notify: on });
          } else if (xp) {
            if (request.method !== "GET") return Response.json({ error: "method not allowed" }, { status: 405 });
            const xr = await handleOwnerExport({
              gate: (s2, u2) => assertOwner(ownerDeps, s2, u2),
              dbFor: ownerDeps.dbFor, loadSchema: ownerDeps.loadSchema,
              query: ownerDeps.query, ident: ownerDeps.ident,
            }, {
              slug: xp[1].toLowerCase(), uid: ou.id,
              table: url.searchParams.get("table"), format: url.searchParams.get("format"),
            });
            // A file, not JSON — the body is already the CSV or the JSON text,
            // and the headers carry the download name.
            if (xr.raw) return new Response(xr.body, { status: xr.status, headers: xr.headers });
            return Response.json(xr.body, { status: xr.status });
          } else if (uf) {
            const uslug = uf[1].toLowerCase();
            // The gate is site-owner.mjs's, so a picture is exactly as protected
            // as a row: fails closed, 404 rather than 403.
            const udeps = {
              gate: (s2, u2) => assertOwner(ownerDeps, s2, u2),
              // NOT sha256hex — that one takes a string and would TextEncode a
              // 5 MB image into a ~20 MB decimal string before hashing it.
              // Digest the bytes themselves.
              hash: async (bytes) => {
                const d = await crypto.subtle.digest("SHA-256", bytes);
                return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
              },
              list: async (s2) => siteUploadList(env, s2),
              put: (key, bytes, ct, meta) => env.SITES_BUCKET.put(key, bytes, { httpMetadata: { contentType: ct }, ...(meta ? { customMetadata: meta } : {}) }),
              remove: (key) => env.SITES_BUCKET.delete(key),
            };
            if (!env.SITES_BUCKET) return Response.json({ error: "storage not configured" }, { status: 501 });
            if (request.method === "GET" && !uf[2]) r = await handleUploadList(udeps, { slug: uslug, uid: ou.id });
            else if (request.method === "DELETE" && uf[2]) r = await handleUploadDelete(udeps, { slug: uslug, uid: ou.id, file: uf[2] });
            else if (request.method === "POST" && !uf[2]) {
              // Raw bytes, not base64 and not multipart: base64 inflates a photo
              // by a third for no benefit, and the declared type is ignored
              // anyway — only the leading bytes decide what this is.
              const cl = Number(request.headers.get("content-length") || 0);
              if (cl && cl > MAX_UPLOAD_BYTES) return Response.json({ error: "that image is too big — keep it under 5 MB", code: "too_big" }, { status: 413 });
              const buf = await request.arrayBuffer();
              r = await handleUpload(udeps, { slug: uslug, uid: ou.id, bytes: new Uint8Array(buf) });
            } else return Response.json({ error: "method not allowed" }, { status: 405 });
          } else if (an) {
            if (request.method !== "GET") return Response.json({ error: "method not allowed" }, { status: 405 });
            r = await handleOwnerAnalytics(ownerDeps, { slug: an[1].toLowerCase(), uid: ou.id });
          } else if (mm) {
            const [, mslug, mid] = mm;
            r = await handleOwnerMembers(ownerDeps, {
              slug: mslug.toLowerCase(), uid: ou.id, method: request.method,
              memberId: mid, params: Object.fromEntries(url.searchParams),
              // PATCH is the only way a role or a suspension is ever set.
              body: request.method === "PATCH" ? await request.json().catch(() => ({})) : {},
            });
          } else if (request.method === "GET") {
            const [, oslug, otable] = om;
            const params = Object.fromEntries(url.searchParams);
            r = otable
              ? await handleOwnerData(ownerDeps, { slug: oslug.toLowerCase(), table: otable, uid: ou.id, params })
              : await handleOwnerTables(ownerDeps, { slug: oslug.toLowerCase(), uid: ou.id });
          } else {
            const [, oslug, otable, orow] = om;
            if (!otable) return Response.json({ error: "no table" }, { status: 400 });
            const body = request.method === "DELETE" ? {} : await request.json().catch(() => ({}));
            r = await handleOwnerWrite(ownerDeps, {
              slug: oslug.toLowerCase(), table: otable, uid: ou.id,
              method: request.method, rowId: orow, body,
            });
          }
          return Response.json(r.body, { status: r.status });
        } catch (e) {
          console.error("owner data failed:", url.pathname, request.method, (e && (e.stack || e.message)) || e);
          // THE ERROR'S NAME, NEVER ITS MESSAGE — the same rule `cfHostname`
          // states for its own catch, and for the same reason: these requests
          // carry the service key and a provider message can quote the request.
          // A name is a class (`TypeError`, `SyntaxError`) and cannot be a
          // secret. Added because a bare "something went wrong" made three
          // different faults in one route indistinguishable, and the only way
          // to tell them apart was a Cloudflare log nobody could reach from
          // where the failure was seen.
          // A ReferenceError's message is always "<name> is not defined" — a
          // programmer bug, never request data — so that ONE class carries its
          // message. Every other error keeps only its class name, because a
          // provider message can quote a request that holds the service key.
          const kind = String((e && e.name) || "Error").slice(0, 40);
          const why = kind === "ReferenceError" ? String((e && e.message) || "").slice(0, 120) : undefined;
          return Response.json({ error: "Something went wrong reaching your site's data.", kind, why }, { status: 500 });
        }
      }
    }

    // DELETE /api/site/<slug> — take a published site down: its files, its
    // database, and its registration.
    //
    // Without this a site could only ever be REPLACED, never removed. The
    // published dist lives in R2 and nothing deleted it, so a slug whose backend
    // row had gone kept serving a React shell whose every data call 404s — a
    // public, half-broken site at a guessable URL. The build smoke test hit that
    // on every run, which is how the gap surfaced.
    // Exactly /api/site/<slug>, no deeper. It used to match any DELETE under
    // /api/site/ and strip the path down to a slug, so /api/site/cafe/rows/x/4
    // arrived here as the slug "caferowsx4" — harmless only by luck. A row
    // delete is a different request from taking the whole site down.
    // DELETE /api/site/<slug> — take a published site down. The work is in
    // `deleteSiteFor`, shared with the account-deletion sweep.
    if (/^\/api\/site\/[a-z0-9][a-z0-9-]{0,80}$/i.test(url.pathname) && request.method === "DELETE") {
      const du = await authUser(request);
      if (!du) return UNAUTHED();
      return await deleteSiteFor(env, du.id, url.pathname.slice("/api/site/".length).toLowerCase());
    }

    // POST /api/site/delete-all — every site this account owns, taken down.
    //
    // THE ORDER MATTERS MORE HERE THAN ANYWHERE. `site_backends.uid` has ON
    // DELETE CASCADE against `auth.users`, so the moment the account goes the
    // ownership rows go with it — and `deleteSiteFor` refuses a slug with no row
    // (correctly: that is what stops anyone deleting files by guessing names).
    // So the sites have to come down BEFORE the account, or every one of them is
    // a permanent orphan serving at a public URL with nothing left that can
    // authorise removing it. The client used to call `/api/site/backend/delete-all`,
    // which has never existed; the 404 was swallowed as best-effort and the
    // account was deleted anyway.
    //
    // The caller's OWN rows, read server-side rather than trusting a list of
    // slugs from the client — a client list is both incomplete (sites built on
    // another device are not in this browser's localStorage) and untrusted.
    if (url.pathname === "/api/site/delete-all" && request.method === "POST") {
      const au = await authUser(request);
      if (!au) return UNAUTHED();
      if (!env.SUPABASE_SERVICE_KEY) return Response.json({ ok: false, error: "service key not configured" }, { status: 501 });
      let slugs = [];
      try {
        const g = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?uid=eq.${encodeURIComponent(au.id)}&select=slug`, { headers: svcHeaders(env), signal: AbortSignal.timeout(10000) });
        if (!g.ok) throw new Error("list " + g.status);
        slugs = (await g.json().catch(() => [])).map((r) => String(r && r.slug || "").toLowerCase()).filter(Boolean);
      } catch (e) {
        // FAILS LOUD, and the caller must not proceed to delete the account on
        // it. "I could not read your sites" is the one answer that must never be
        // mistaken for "you have none" — that mistake is what orphans them.
        return Response.json({ ok: false, error: "couldn't list your sites — try again in a moment" }, { status: 503 });
      }
      const done = [], failed = [];
      // Bounded, and sequential: each delete drops a Neon project and walks an
      // R2 prefix, so firing fifty at once is a good way to be rate-limited into
      // a half-finished sweep. 50 is far above any real account.
      for (const slug of slugs.slice(0, 50)) {
        try {
          const r = await deleteSiteFor(env, au.id, slug);
          (r.status === 200 ? done : failed).push(slug);
        } catch { failed.push(slug); }
      }
      // 207 when some survived, so the client can refuse to delete the account
      // over a partial sweep rather than reading `ok` and carrying on.
      return Response.json({ ok: failed.length === 0, deleted: done, failed, total: slugs.length },
        { status: failed.length ? 207 : 200 });
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

        const rSystem = `You are the fact-checker for Go Farther, an AI ${kind} studio's prompt writer. The user's creative request depends on real-world facts that may have changed since your training. Use web_search to find the SPECIFIC, CURRENT facts needed to depict the subject accurately — the exact current product name and generation, notable design and visual details, colors or materials, key specs, and relevant dates. Keep it to 1-3 focused searches. Then reply with a SHORT factual brief: only the concrete facts that affect what to show, in a few plain sentences. No preamble, no markdown, and do NOT write a generation prompt.`;

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
      // DECLARED HERE, BESIDE THE FLAG IT READS, and that is the fix rather than
      // a tidy-up. `vidRefN` used to be declared inside the `if (kind !== "audio")`
      // block below and read again ~40 lines AFTER that block closed, so every
      // director call with a Seedance clip attached threw
      // `ReferenceError: vidRefN is not defined` — after the fee was debited and
      // outside every try/catch, so the fee was never reversed and the client's
      // `catch { return localAsk(text) }` swallowed it. The whole Seedance
      // video-reference feature had been dead and silently charging since it
      // shipped. `node --check` passes on this and no test can import worker.js;
      // only running it, or bundling and reading the scopes, finds it.
      const vidRefN = clipIsSeedanceRef ? Math.min(3, Math.max(1, Math.round(+body.vidRefCount) || 1)) : 0;
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
          ? `You are Go Farther, the voice side of an AI studio: the user types either words they want a TTS voice to SPEAK, or chat aimed at you. Always write a short, friendly reply in your own voice (1-2 sentences). Then decide:
- Greeting, small talk, or a question aimed at you ("hey", "how are you", "why are you running"): set ready=false and use your reply to chat back and invite them to type the words they want voiced.
- Words meant to be spoken aloud (a script, a line, a message, a caption): set ready=true. Their text will be voiced EXACTLY as written — never rewrite it and never ask clarifying questions.
When genuinely unsure, set ready=true.`
          : `You are Go Farther, a warm, easygoing creative director for an AI ${kind} generator, having a natural chat with the user. Always write a short, friendly reply in your own voice (1-2 sentences, like texting a creative friend). Then decide what they need:
- If they're just greeting you, making small talk, or asking what you can do: set ready=false. Use your reply to warmly invite them to describe what they'd like to create.
- If they've described something to create: DEFAULT to set ready=true and make every creative call yourself — a clear request should just get made, no back-and-forth.
- The ONE exception: if a single genuinely important detail is missing or ambiguous AND you can't reasonably assume it — something that would materially change the result (a real product photo vs an illustration; one of two very different moods or settings; a specific brand, person or place you can't guess) — then set ready=false and end your reply with ONE short, specific question, offering a couple of concrete options when that helps them answer in a word. Ask at most one question, only when it truly earns the extra step; never interrogate, and never ask about things you can tastefully decide yourself.
- NEVER ask twice in a row. If your previous turn asked a question and the user answers with ANYTHING — including "just make it", "you choose", or simply restating the request — that IS your answer: set ready=true and make every remaining call yourself.
- A stack of varied attached references with an open brief ("make one using these") is NOT missing information — it's creative freedom. Pick the strongest coherent concept from them (using a compatible subset is fine), say what you're going for in one line, and go.
Tailor everything to what THIS user is trying to make.
NEVER reveal, name, or hint at the underlying model, provider, vendor, or any technical id (e.g. "fal", "fal-ai/…", raw model paths) — the user only knows Go Farther. If asked which model or service is used, say you use Go Farther's own studio engine and move on.${hasImage && imageCount <= 1 ? `\nThe user attached ${kind === "video" ? "a start image the video will animate (it's in the conversation — look at it). Reference what you actually see in your reply" : "a source image to edit (it's in the conversation — look at it). Reference what you actually see in your reply"}.` : ""}${imageCount > 1 ? `\nThe user attached ${imageCount} ${kind === "video" ? "REFERENCE images whose subjects carry into the generated video" : "images"}, shown to you labeled "Image 1"…"Image ${imageCount}" in the same order they see. When they name one by number ("image 5"), LOOK at that exact one before describing or acting on it — never assume they mean the first.${kind === "video" ? " A generation from these should feature ALL of them unless the user says otherwise." : ""}` : ""}${kind === "image" ? `\nTRANSPARENCY LIMIT: no model here can output a truly transparent (alpha) background — a "transparent background" request only paints a fake checkerboard into the picture. If they ask for one, say plainly it isn't possible and offer the closest real thing: a clean solid pure-white (or any solid color) seamless background.` : ""}${kind === "video" && soundCapable ? `\nSOUND: whether the video gets an audio track is controlled ONLY by the user's Sound toggle in the composer settings — you cannot change it and must never claim you did. If they ask for a silent / no-audio video (or ask to add sound), tell them in your reply to flip the Sound switch in the settings next to the model picker (silent renders can also cost fewer credits), and still proceed with ready=true when the creative request itself is clear.` : ""}${(hasClip || hasAvatar || hasAudio) ? `\nThe user has attached ${[hasClip ? (clipIsSeedanceRef ? "a VIDEO CLIP as a @Video1 reference (its motion/subject carries into a new generated scene)" : veoExtend ? "a source VIDEO CLIP the model will EXTEND — it generates the next 7 seconds continuing from the clip's final frame" : "a source VIDEO CLIP (for a video-to-video edit)") : "", hasAvatar ? "an AVATAR face image (a character to keep consistent)" : "", hasAudio ? "an AUDIO track (voice/music for lip-sync or soundtrack)" : ""].filter(Boolean).join(", ")}. ${hasClip || hasAudio ? "You can't play clips or audio yourself, but they ARE attached and the model will receive them" : "It IS attached and the model will receive it"} — so NEVER say you can't see/hear it or ask them to paste a link for something already attached. If what they want is unclear, ask what to DO with it (${clipIsSeedanceRef ? "what scene to build around the reference" : "restyle, swap a subject, relight, extend, lip-sync"}), not for the file itself.` : ""}${prevPrompt ? `\nThe user's PREVIOUS generation ran with this prompt: "${prevPrompt.slice(0, 600)}". Read their message against it and pick ONE signal:
- rerun=true if they want that same generation run again UNCHANGED, however they phrase it ("try again", "run it back", "didn't come out, go again", "one more", "do that again") — use your reply to say you're running it again.
- revise=true if they want it CHANGED — feedback or a tweak on the result ("slower", "fix the text", "make it brighter", "again but at night") — use your reply to acknowledge the fix.
- both false if it's a brand-new idea or just chat.` : ""}${brief ? `\nThis chat's running creative brief: "${brief}" — use it to make replies specific to this project.` : ""}${memoryLine}
Also maintain the user's durable creative taste (the \`memory\` field): learn from what they SAY here, not only what they generate. If this message reveals a lasting preference — a look, format, subject, or a standing do/don't they gravitate to — fold it into the full updated memory list (deduped, ≤12 short phrases, no one-off project specifics); otherwise leave it unchanged or omit it.${ctxLine ? `\nContext: ${ctxLine}` : ""}`)
        : step === "studio"
        ? `You are Go Farther, the director of a shot-based video studio. The user's project is an ordered list of SHOTS — each shot is either one AI video generation (3-10s) or a slice of an imported video. You act by returning actions; the app executes them.

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
        ? `You are Go Farther, a warm creative director for an AI ${kind} studio. The user's generation just failed. From the raw pipeline error, explain in 1-2 friendly plain-language sentences what went wrong and what to do next — no jargon, no error codes, never blame the user. NEVER name any backend provider, vendor, or platform the raw error mentions (fal, fal.ai, replicate, etc.) and never point the user to an external dashboard or billing page — the user only knows Go Farther; call the infrastructure "our render servers" and for balance/capacity problems say generations are briefly paused and to check back soon. NEVER say the user's account, credits, or balance ran out unless the raw error literally says "not enough credits" — platform balance problems are OUR infrastructure, not theirs, and misblaming the user's credits steers them to buy credits they don't need. If — and ONLY if — rewording the prompt could fix it (content filter, prompt rejected as invalid), also return fixedPrompt: the failed prompt minimally reworded to avoid the trigger while keeping the creative intent. For balance, quota, timeout or model-availability problems, return no fixedPrompt.${ctxLine ? `\nContext: ${ctxLine}` : ""}`
        : step === "revise"
        ? `You are the prompt writer for Go Farther, an AI ${kind} studio. The user generated a ${kind} with the previous prompt below and wants it adjusted. Rewrite the prompt applying ONLY what their feedback asks — keep every untouched part as close to word-for-word as possible, so the change is surgical, not a fresh rewrite. Return a single paragraph, nothing but the prompt.

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
        ? `You are the continuation writer for Go Farther, an AI video studio. A source VIDEO CLIP is already attached and the model will EXTEND it — generating the NEXT 7 SECONDS that continue seamlessly from the clip's final frame. The model can already see the whole clip, so NEVER re-describe, re-narrate or re-establish anything that already happens in it — re-describing wastes the prompt on footage that already exists and makes the model try to replay those events, which causes glitchy, morphing extensions.

Write ONE paragraph describing ONLY the new 7 seconds of action: open from the exact state of the final frame ("from where he lands…", "as the car finishes turning…"), then one or two beats of NEW motion in the same tone, camera and art style as the clip — only state tone/camera/style when the user asks to CHANGE them. Any on-screen text stays exactly as printed. Never mention a total clip length — the extension is always 7 seconds of new footage. Phrase everything to pass strict automated content checkers (no visceral/fleshy or harm/impact wording when a neutral or comedic phrasing carries the same picture). Return nothing but the prompt.

Example of the register (never copy its content): "From where he lands in a heap, he slowly picks himself up, dusts off the dress, and strikes a triumphant little pose as the dust settles around him — same locked-off camera, same lighthearted cartoon tone."${familyHint ? `
- ${familyHint}` : ""}${effortLine}${briefLine}${memoryLine}
Context: ${ctxLine}`
        : kind === "video" && hasClip && !clipIsSeedanceRef
        ? `You are the edit writer for Go Farther, an AI video-to-video studio. A source VIDEO CLIP is already attached and the model will re-render THAT footage — this is an EDIT, not a new generation. The model can already see the clip, so never re-describe what's in it.

Write ONE direct instruction that states ONLY the change to apply: the new look, style, lighting, colour grade, or an element to swap. Name what to KEEP from the original vs. what to CHANGE. Its LENGTH follows the Effort line below — but at every effort the words go on the CHANGE, never on narrating the source footage. Return nothing but the instruction.

Examples of the register (never copy their content): "Restyle the footage into a polished, photoreal cinematic AI look — cleaner textures, warmer light — while keeping the exact framing, motion and timing." · "Keep everything as-is but relight the scene for golden-hour warmth." · "Swap the car for a red vintage convertible; leave the road, motion and background unchanged."${familyHint ? `
- ${familyHint}` : ""}${effortLine}${briefLine}${memoryLine}${refLine}
Context: ${ctxLine}`
        : kind === "video"
        ? `You are the prompt writer for Go Farther, an AI video studio. Using the conversation, the request and the user's picks, write ONE video-generation prompt: a single paragraph of concrete visual language — no lists, no headers, nothing but the prompt.

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
        ? `You are the edit writer for Go Farther, an AI image-editing studio. A source IMAGE is already attached (it's in the conversation — look at it) and the model will edit THAT picture — this is an EDIT, not a new generation. The model can already see it, so never re-describe the rest of the image.

Write ONE direct instruction that states ONLY the change to make: name the existing content concretely as "the ..." ("the red car", not "the subject") and say exactly what to change or add. Its LENGTH follows the Effort line below — but at every effort the words go on the CHANGE (and what must stay untouched), never on re-describing the rest of the picture. Return nothing but the instruction.

Examples of the register (never copy their content): "Change the sky behind the building to a dramatic orange sunset; leave everything else untouched." · "Turn the man's jacket red and add subtle rain on the window." · "Restyle the photo into a soft watercolour painting while keeping the composition exactly."${familyHint ? `
- ${familyHint}` : ""}${effortLine}${transparencyLine}${briefLine}${memoryLine}
Context: ${ctxLine}`
        : kind === "image"
        ? `You are the prompt writer for Go Farther, an AI image studio. Using the conversation, the request and the user's picks, write ONE image-generation prompt: a single paragraph — no lists, nothing but the prompt.

Craft rules:
- Name the medium and style explicitly (photograph, cinematic still, oil painting, anime, pixel art...) — unstated style yields generic digital art.
- Cover subject, composition and framing, lighting and palette, in concrete visual terms.
- If words should appear in the image, give them verbatim in quotes and say where they sit.
${familyHint ? `
- ${familyHint}` : ""}
${effortLine}${multiImgLine}${transparencyLine}${briefLine}${factsLine}${memoryLine}
Context: ${ctxLine}`
        : `You are the script writer for Go Farther, an AI text-to-speech voice studio. Your output is spoken ALOUD, verbatim, by a voice actor — so return ONLY what should be heard (the words and/or vocal sounds), nothing else: no quotes, no stage notes, no "make an audio of…", and NEVER repeat the user's instruction back to them.
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
                reply: { type: "string", description: "a short, friendly conversational message in Go Farther's voice" },
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
                      // Typed because a property without one is a schema the API
                      // can refuse. This tool is unreachable — "studio" is not in
                      // the step allowlist — so it was never sent and never
                      // noticed; typed anyway rather than exempted, since a
                      // guard with an exemption list rots.
                      n: { type: "string", description: "shot number (1-based) as a string, or 'all' for generate" },
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

      // Streaming ask: forward Go Farther's reply as it's written, then the
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
      // Free accounts get the "✦ gofarther.dev" mark burned in server-side. The
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
