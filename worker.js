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
  "fal-ai/bytedance/omnihuman":                   { flat: 1.40 },  // fal bills on audio length; ~10s assumed
  "fal-ai/kling-video/lipsync/audio-to-video":    { flat: 0.042 }, // three 5-second increments
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

function creditCost(kind, model, { duration, quality, num, chars }) {
  let usd;
  if (kind === "image") usd = (IMAGE_USD[model] || 0.15) * (num || 1);
  else if (kind === "audio") usd = (Math.max(chars || 0, 40) / 1000) * (AUDIO_USD_PER_1K[model] || 0.10);
  else {
    const p = VIDEO_USD[model];
    if (!p) usd = 3; // unlisted video model: charge high, never undercharge
    else if (p.flat != null) usd = p.flat;
    else {
      const rate = p.s[quality] != null ? p.s[quality] : p.s.def != null ? p.s.def : p.s["720p"];
      usd = (rate != null ? rate : 0.4) * (duration || p.d || 5);
    }
  }
  return Math.max(1, Math.ceil(usd / CREDIT_USD));
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
  });
  if (!r.ok) throw new Error("credits rpc " + r.status);
  return Number(await r.json());
}

// Resolve the caller's Supabase access token to a user, or null if missing/invalid.
async function authUser(request) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!r.ok) return null;
    const user = await r.json();
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}

const UNAUTHED = () => Response.json({ error: "sign in required" }, { status: 401 });

// Baseline security headers on every response (audit item). script/style keep
// 'unsafe-inline' because the UI relies on inline on* handlers and style=""
// attributes; img/media/connect allow Supabase Storage + fal.media (generated
// media) plus data:/blob: (attachment thumbnails and blob downloads).
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co https://fal.media https://*.fal.media",
  "media-src 'self' blob: https://*.supabase.co https://fal.media https://*.fal.media",
  "connect-src 'self' https://*.supabase.co https://fal.media https://*.fal.media",
].join("; ");

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
// JSON buffer, so the ask step can stream Zephyr's reply as Sonnet writes it.
function extractReplyPrefix(buf) {
  const m = buf.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!m) return "";
  let s = m[1];
  if (/(?:^|[^\\])(?:\\\\)*\\$/.test(s)) s = s.slice(0, -1); // trailing half escape
  s = s.replace(/\\u[0-9a-fA-F]{0,3}$/, ""); // incomplete \uXXXX
  try { return JSON.parse('"' + s + '"'); } catch { return ""; }
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
      if (!(await authUser(request))) return UNAUTHED();
      if (!env.FAL_KEY) {
        return Response.json({ error: "generation not configured" }, { status: 500 });
      }
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
        ? body.images.map(dataImage).filter(Boolean).slice(0, 8)
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
        const isGrok = model.includes("grok-imagine");
        const isVeo = model.includes("veo");
        const isSora = model.includes("sora");

        // Route by attachment. Params below match each family's fal schema:
        //  Seedance i2v: image_url + end_image_url; ref2v: image_urls[] + audio_urls[]
        //  Kling i2v: start_image_url + end_image_url (NO aspect_ratio/resolution)
        //  Grok i2v: image_url only (no end frame)
        //  Gemini: text-to-video only, no image input
        // Audio input only exists on Seedance reference-to-video, so any audio
        // attachment routes there (carrying along a reference image if present).
        if ((avatar || audio || extraImages.length) && isSeedance) {
          endpoint = model.replace("/text-to-video", "/reference-to-video");
          const refs = [image, avatar, ...extraImages].filter(Boolean).slice(0, 9);
          // fal rule: reference audio requires at least one image/video ref.
          if (audio && !refs.length) {
            return Response.json({ error: "Seedance needs a reference image along with the audio — add an image too" }, { status: 400 });
          }
          if (refs.length) input.image_urls = refs;
          if (audio) input.audio_urls = [audio];
        } else if (image) {
          const isKlingO3 = model.includes("kling-video/o3");
          // Veo's base id has no "/text-to-video" to swap, so append the suffix.
          endpoint = isVeo
            ? model + "/image-to-video"
            : model.replace("/text-to-video", "/image-to-video");
          if (isKling && !isKlingO3) {
            // Kling v3 image-to-video uses start_image_url.
            input.start_image_url = image;
            if (end) input.end_image_url = end;
          } else {
            // Seedance / Grok / Veo / Sora / Kling o3 all use image_url.
            input.image_url = image;
            // End frame only exists on Seedance and Kling o3.
            if (end && (isSeedance || isKlingO3)) input.end_image_url = end;
          }
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

      // Everything validated — charge credits, then spend fal money.
      // Fail closed: if the ledger can't be reached, we don't generate.
      const genCost = creditCost(genKind, model, {
        duration, quality, num, chars: genKind === "audio" ? prompt.length : 0,
      });
      let balanceAfter;
      try {
        balanceAfter = await useCredits(request.headers.get("Authorization") || "", genCost);
      } catch {
        return Response.json({ error: "credits check failed — try again in a moment" }, { status: 503 });
      }
      if (!(balanceAfter >= 0)) {
        return Response.json({ error: "not enough credits", cost: genCost }, { status: 402 });
      }

      const r = await fetch(`https://queue.fal.run/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${env.FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.request_id) {
        return Response.json(
          { error: "submit failed", detail: data },
          { status: 502 }
        );
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

    // ── Credit packs: $1 = 100 credits (25% over the $0.008 cost basis) ──
    // Checkout creates a Stripe session; the webhook (signature-verified)
    // mints the credits idempotently. Both no-op cleanly until the Stripe
    // secrets are configured.
    const PACKS = {
      "5": { cents: 500, credits: 500 },
      "15": { cents: 1500, credits: 1500 },
      "40": { cents: 4000, credits: 4000 },
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
      const pack = PACKS[String(body.pack)];
      if (!pack) return Response.json({ error: "unknown pack" }, { status: 400 });
      const form = new URLSearchParams({
        mode: "payment",
        success_url: "https://isibi.ai/?credits=added",
        cancel_url: "https://isibi.ai/",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(pack.cents),
        "line_items[0][price_data][product_data][name]": pack.credits.toLocaleString("en-US") + " isibi credits",
        "metadata[user_id]": user.id,
        "metadata[credits]": String(pack.credits),
      });
      if (user.email) form.set("customer_email", user.email);
      try {
        const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.url) return Response.json({ error: "checkout failed" }, { status: 502 });
        return Response.json({ url: data.url });
      } catch {
        return Response.json({ error: "checkout failed" }, { status: 502 });
      }
    }

    if (url.pathname === "/api/stripe/webhook" && request.method === "POST") {
      if (!env.STRIPE_WEBHOOK_SECRET || !env.CREDITS_MINT_SECRET) {
        return Response.json({ error: "not configured" }, { status: 501 });
      }
      const raw = await request.text();
      // Stripe-Signature: t=<unix>,v1=<hmac-sha256 hex of "<t>.<raw body>">
      const parts = {};
      for (const p of (request.headers.get("Stripe-Signature") || "").split(",")) {
        const i = p.indexOf("=");
        if (i > 0) parts[p.slice(0, i).trim()] = p.slice(i + 1).trim();
      }
      const t = Number(parts.t);
      if (!t || Math.abs(Date.now() / 1000 - t) > 300 || !parts.v1) {
        return Response.json({ error: "bad signature" }, { status: 400 });
      }
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw", enc.encode(env.STRIPE_WEBHOOK_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
      );
      const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${raw}`));
      const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
      if (hex !== parts.v1) return Response.json({ error: "bad signature" }, { status: 400 });

      let event;
      try { event = JSON.parse(raw); } catch {
        return Response.json({ error: "bad payload" }, { status: 400 });
      }
      if (event.type === "checkout.session.completed") {
        const s = event.data && event.data.object;
        const uid = s && s.metadata && s.metadata.user_id;
        const credits = s && s.metadata ? Number(s.metadata.credits) : 0;
        if (uid && credits > 0 && s.payment_status === "paid" && s.id) {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/add_credits`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
            body: JSON.stringify({
              target: uid, amount: credits, cents: s.amount_total || 0,
              purchase_ref: s.id, mint_key: env.CREDITS_MINT_SECRET,
            }),
          });
          // Non-2xx → 500 so Stripe retries the delivery.
          if (!r.ok) return Response.json({ error: "credit grant failed" }, { status: 500 });
        }
      }
      return Response.json({ received: true });
    }

    // Current credit balance (creates the row with the signup grant on first touch).
    if (url.pathname === "/api/credits" && request.method === "GET") {
      if (!(await authUser(request))) return UNAUTHED();
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_credits`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: request.headers.get("Authorization") || "",
          },
          body: "{}",
        });
        if (!r.ok) throw 0;
        return Response.json({ balance: Number(await r.json()) });
      } catch {
        return Response.json({ error: "credits unavailable" }, { status: 503 });
      }
    }

    // Sonnet 5 director: turns a request into A/B/C questions, then a final prompt.
    if (url.pathname === "/api/direct" && request.method === "POST") {
      if (!(await authUser(request))) return UNAUTHED();
      if (!env.ANTHROPIC_API_KEY) {
        return Response.json({ error: "director not configured" }, { status: 501 });
      }
      let body;
      try { body = await request.json(); } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400 });
      }
      let step = ["compose", "revise", "error", "studio"].includes(body.step) ? body.step : "ask";
      const kind = ["video", "image", "audio"].includes(body.kind) ? body.kind : "video";
      const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 2000) : "";
      if (!prompt) return Response.json({ error: "no prompt" }, { status: 400 });
      // The previous generation's prompt — lets the ask step spot feedback
      // ("slower", "fix the text") and the revise step edit surgically.
      const prevPrompt = typeof body.prevPrompt === "string" ? body.prevPrompt.trim().slice(0, 2000) : "";
      if (step === "revise" && !prevPrompt) step = "compose";
      // Raw pipeline error, for the explain-a-failure step.
      const errText = typeof body.error === "string" ? body.error.slice(0, 700) : "";
      // The chat's running creative brief — per-chat taste memory, maintained
      // by the composer and committed by the client on approval.
      const brief = kind !== "audio" && typeof body.brief === "string" ? body.brief.trim().slice(0, 600) : "";
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
      const effortLine = kind === "audio" ? "" : effort === "low"
        ? `\nEffort: LOW — the user wants a quick take. Keep the prompt to 1-2 tight sentences (30-50 words): subject, action, setting, one style cue. Keep the non-negotiables (camera named, on-screen text pinned) but skip fine detail — let the model improvise the rest.`
        : effort === "high"
        ? `\nEffort: HIGH — the user wants real craft. Write 120-180 words: precise composition and camera work, lighting, palette, texture, atmosphere, and the timing of each beat. Every sentence must add new concrete visual information — detail, never filler.`
        : effort === "ultra"
        ? `\nEffort: ULTRA HIGH — 180-250 words. Everything a HIGH prompt covers (camera, lighting, palette, texture, atmosphere, beat timing), plus: name the lens and framing (wide or long, centered or thirds, negative space); build the scene in explicit layers — a foreground element, the subject, a living background${kind === "video" ? " — so camera moves read three-dimensional" : ""}; direct the subject's expression and body language; ${kind === "video" ? "give every motion weight and momentum; " : ""}add background life; and call one deliberate color grade. Every sentence must add new concrete visual information — detail, never filler.`
        : effort === "max"
        ? `\nEffort: MAX — 250-330 words, the full director's treatment. Everything ULTRA HIGH covers, plus: film stock or medium emulation, era and season${kind === "video" ? `, speed treatment if it serves the shot (slow motion, timelapse), and what the opening and closing frames each hold. If the target model generates audio (Veo, Sora), direct the soundscape too — ambience, two or three key sounds, any spoken line` : ", and where the viewer's eye lands first, second and third"}. Touch every area a director could — but never pad: if an area adds nothing to THIS shot, spend those words deepening the ones that do.`
        : `\nEffort: MEDIUM — one tight paragraph, roughly 60-100 words: enough craft to direct the shot without over-constraining the model.`;

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
      }
      const ctxLine = ctxBits.join(" · ");
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
      const system = step === "ask"
        ? (kind === "audio"
          ? `You are Zephyr, the voice side of an AI studio: the user types either words they want a TTS voice to SPEAK, or chat aimed at you. Always write a short, friendly reply in your own voice (1-2 sentences). Then decide:
- Greeting, small talk, or a question aimed at you ("hey", "how are you", "why are you running"): set ready=false and use your reply to chat back and invite them to type the words they want voiced.
- Words meant to be spoken aloud (a script, a line, a message, a caption): set ready=true. Their text will be voiced EXACTLY as written — never rewrite it and never ask clarifying questions.
Leave questions empty either way. When genuinely unsure, set ready=true.`
          : `You are Zephyr, a warm, easygoing creative director for an AI ${kind} generator, having a natural chat with the user. Always write a short, friendly reply in your own voice (1-2 sentences, like texting a creative friend). Then decide what they need:
- If they're just greeting you, making small talk, or asking what you can do: set ready=false and leave questions empty. Use your reply to warmly invite them to describe what they'd like to create.
- If they've described something to create: set ready=true. Questions are the exception, not the routine — most requests should get NONE; make the creative calls yourself. Only ask (1-2 max, each with exactly 3 options: a short label + a few-word description) when the request leaves a decision so open you can't write a good prompt without it — no clear subject, or a fork that changes the whole result. When you do ask, phrase it the way a friend would out loud ("How do you want it to feel?"), NEVER terse labels like "Setting" or "Camera style".
Tailor everything to what THIS user is trying to make.${hasImage ? `\nThe user attached ${kind === "video" ? "a start image the video will animate (it's in the conversation — look at it). Ask about motion, mood or camera, referencing what you actually see; never ask what the scene looks like" : "a source image to edit (it's in the conversation — look at it). Ask about the change they want, referencing what you actually see; never ask what's already in the picture"}.` : ""}${prevPrompt ? `\nThe user's PREVIOUS generation ran with this prompt: "${prevPrompt.slice(0, 600)}". Read their message against it and pick ONE signal:
- rerun=true if they want that same generation run again UNCHANGED, however they phrase it ("try again", "run it back", "didn't come out, go again", "one more", "do that again") — leave questions empty and use your reply to say you're running it again.
- revise=true if they want it CHANGED — feedback or a tweak on the result ("slower", "fix the text", "make it brighter", "again but at night") — leave questions empty and use your reply to acknowledge the fix.
- both false if it's a brand-new idea or just chat.` : ""}${brief ? `\nThis chat's running creative brief: "${brief}" — use it to make questions and replies specific to this project.` : ""}${ctxLine ? `\nContext: ${ctxLine}` : ""}`)
        : step === "studio"
        ? `You are Zephyr, the director of a shot-based video studio. The user's project is an ordered list of SHOTS — each shot is either one AI video generation (3-10s) or a slice of an imported video. You act by returning actions; the app executes them.

Current shots (JSON): ${JSON.stringify(shotsCtx)}
${brief ? `Project brief: "${brief}"` : "No project brief yet."}

Rules:
- When the user describes a film, ad or sequence: break it into 3-8 shots via one add_shots action. Each shot gets a short title, a duration (3-10s), and a full generation prompt following video craft: one continuous shot, explicit camera work, concrete visual language, on-screen text pinned as never changing.
- CONSISTENCY: describe each character and setting ONCE in the brief, then repeat those descriptions WORD-FOR-WORD in every shot prompt that features them — verbatim repetition is what keeps AI characters consistent across shots.
- Always return an updated brief (1-3 sentences: cast, setting, style) when shots are added or changed.
- update_shot (by n) changes prompt/title/duration; use trim {start,end} (seconds within the shot) to shorten imported slices. Rewriting a generated shot's prompt means it must be regenerated — mention that.
- generate (n, or "all" for every draft) ONLY when the user explicitly asks to generate/run/make the shots — generation costs money; never trigger it uninvited.
- reply: short and friendly, reference shots by number. If the user is just chatting or asking, reply with no actions.${ctxLine ? `\nContext: ${ctxLine}` : ""}`
        : step === "error"
        ? `You are Zephyr, a warm creative director for an AI ${kind} studio. The user's generation just failed. From the raw pipeline error, explain in 1-2 friendly plain-language sentences what went wrong and what to do next — no jargon, no error codes, never blame the user. If — and ONLY if — rewording the prompt could fix it (content filter, prompt rejected as invalid), also return fixedPrompt: the failed prompt minimally reworded to avoid the trigger while keeping the creative intent. For balance, quota, timeout or model-availability problems, return no fixedPrompt.${ctxLine ? `\nContext: ${ctxLine}` : ""}`
        : step === "revise"
        ? `You are the prompt writer for Zephyr, an AI ${kind} studio. The user generated a ${kind} with the previous prompt below and wants it adjusted. Rewrite the prompt applying ONLY what their feedback asks — keep every untouched part as close to word-for-word as possible, so the change is surgical, not a fresh rewrite. Return a single paragraph, nothing but the prompt.

Fix patterns:
- Mangled or morphing on-screen text → pin it harder: all text stays exactly as printed, never changing.
- Too much, too fast or wrong motion → name the camera explicitly and calm the action verbs.
- Style drift on an animated image → state the art style is preserved exactly, with no smoothing.
- Feels rushed or overstuffed → cut to one or two beats of motion${genDuration ? ` for the ${genDuration}s clip` : ""}.${familyHint ? `
- ${familyHint}` : ""}

Previous prompt:
${prevPrompt}
${briefLine}
Context: ${ctxLine}`
        : kind === "video"
        ? `You are the prompt writer for Zephyr, an AI video studio. Using the conversation, the request and the user's picks, write ONE video-generation prompt: a single paragraph of concrete visual language — no lists, no headers, nothing but the prompt.

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
${effortLine}${briefLine}
Context: ${ctxLine}`
        : kind === "image"
        ? `You are the prompt writer for Zephyr, an AI image studio. Using the conversation, the request and the user's picks, write ONE image-generation prompt: a single paragraph — no lists, nothing but the prompt.

Craft rules:
- Name the medium and style explicitly (photograph, cinematic still, oil painting, anime, pixel art...) — unstated style yields generic digital art.
- Cover subject, composition and framing, lighting and palette, in concrete visual terms.
- If words should appear in the image, give them verbatim in quotes and say where they sit.
${hasImage ? `- A source image IS attached (it's in the conversation — look at it): this is an EDIT. Describe only the change to make, naming existing content concretely as "the ..." — do not re-describe the rest of the picture.` : ""}${familyHint ? `
- ${familyHint}` : ""}
${effortLine}${briefLine}
Context: ${ctxLine}`
        : `You are the prompt writer for Zephyr, an AI voice generator. Describe the delivery and tone for the spoken line in ONE short direction.`;

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
            description: "Reply to the user and, when it's a creative request, ask clarifying questions.",
            input_schema: {
              type: "object",
              properties: {
                reply: { type: "string", description: "a short, friendly conversational message in Zephyr's voice" },
                ready: { type: "boolean", description: "true if the user has given an actual thing to create; false for greetings or small talk" },
                revise: { type: "boolean", description: "true if the user is asking to adjust the previous generation rather than describing something new" },
                rerun: { type: "boolean", description: "true if the user wants the previous generation run again unchanged, in whatever words" },
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "the natural, conversational question" },
                      options: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: { label: { type: "string" }, desc: { type: "string" } },
                          required: ["label"],
                        },
                      },
                    },
                    required: ["title", "options"],
                  },
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
                      type: { type: "string", enum: ["add_shots", "update_shot", "remove_shot", "reorder", "generate"] },
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
                      trim: { type: "object", properties: { start: { type: "number" }, end: { type: "number" } } },
                      order: { type: "array", items: { type: "integer" }, description: "new order as current shot numbers" },
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
            description: "Return the final generation prompt and the chat's updated creative brief.",
            input_schema: {
              type: "object",
              properties: {
                prompt: { type: "string" },
                brief: { type: "string", description: "1-3 sentence updated running creative brief for this chat — subject, style, mood, standing constraints; carry forward what still holds, fold in what this request adds" },
              },
              required: ["prompt"],
            },
          };

      // Shape the ask-step tool output into the API payload.
      // Voice mode never asks clarifying questions — the words are literal.
      const shapeAsk = (parsed) => ({
        reply: String(parsed.reply || "").slice(0, 500),
        ready: !!parsed.ready,
        rerun: !!parsed.rerun && !!prevPrompt && kind !== "audio",
        revise: !parsed.rerun && !!parsed.revise && !!prevPrompt && kind !== "audio",
        questions: (Array.isArray(parsed.questions) ? parsed.questions : [])
          .slice(0, kind === "audio" ? 0 : 2)
          .map((q) => ({
            title: String(q.title || "").slice(0, 120),
            options: (Array.isArray(q.options) ? q.options : [])
              .slice(0, 3)
              .map((o) => ({ label: String(o.label || "").slice(0, 40), desc: String(o.desc || "").slice(0, 60) }))
              .filter((o) => o.label),
          }))
          .filter((q) => q.title && q.options.length),
      });

      const wantStream = body.stream === true && step === "ask";
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
            model: "claude-sonnet-5",
            max_tokens: 1500,
            // Chat replies should feel instant; thinking stays on for the
            // prompt-writing steps, where it earns its latency.
            ...(step === "ask" ? { thinking: { type: "disabled" } } : {}),
            ...(wantStream ? { stream: true } : {}),
            system,
            tools: [tool],
            tool_choice: { type: "tool", name: tool.name },
            messages: turns,
          }),
        });
      } catch (e) {
        return Response.json({ error: "director request failed", detail: String(e) }, { status: 502 });
      }

      // Streaming ask: forward Zephyr's reply as it's written, then the
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
      if (!r.ok) return Response.json({ error: "director error", detail: data }, { status: 502 });

      const parsed = (data.content || []).find((c) => c.type === "tool_use")?.input;
      if (!parsed) return Response.json({ error: "director no output", detail: data }, { status: 502 });

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
      const r = await fetch(target, { method: "PUT", headers: { Authorization: `Key ${env.FAL_KEY}` } });
      const data = await r.text();
      return new Response(data || "{}", { status: r.status, headers: { "Content-Type": "application/json" } });
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
      if (!/^https:\/\/([a-z0-9-]+\.)?fal\.media\//i.test(src)) {
        return Response.json({ error: "invalid url" }, { status: 400 });
      }
      const media = await fetch(src);
      if (!media.ok || !media.body) {
        return Response.json({ error: "fetch failed" }, { status: 502 });
      }
      const ct = (media.headers.get("content-type") || "application/octet-stream").split(";")[0];
      const EXT = {
        "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
        "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
        "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg",
      };
      const kindExt = body.kind === "image" ? "png" : body.kind === "audio" ? "mp3" : "mp4";
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${EXT[ct] || kindExt}`;
      const token = (request.headers.get("Authorization") || "").slice(7);
      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, "Content-Type": ct },
        body: media.body,
      });
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
      const r = await fetch(target, {
        headers: { Authorization: `Key ${env.FAL_KEY}` },
      });
      return new Response(await r.text(), {
        status: r.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return env.ASSETS.fetch(request);
}
