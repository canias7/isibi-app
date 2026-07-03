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
  "fal-ai/flux/schnell",
  "fal-ai/krea-2/turbo",
  "xai/grok-imagine-image",
]);
const DEFAULT_IMAGE_MODEL = "fal-ai/flux/schnell";

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

export default {
  async fetch(request, env) {
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
        if ((avatar || audio) && isSeedance) {
          endpoint = model.replace("/text-to-video", "/reference-to-video");
          const refs = [image, avatar].filter(Boolean);
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
        const urls = [image, avatar].filter(Boolean);
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
      });
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
      const step = body.step === "compose" ? "compose" : "ask";
      const kind = ["video", "image", "audio"].includes(body.kind) ? body.kind : "video";
      const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 2000) : "";
      if (!prompt) return Response.json({ error: "no prompt" }, { status: 400 });
      const answers = Array.isArray(body.answers)
        ? body.answers.filter((a) => typeof a === "string").slice(0, 4).map((a) => a.slice(0, 200))
        : [];
      // Recent conversation so the director remembers what was said.
      const history = Array.isArray(body.history)
        ? body.history
            .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.text === "string")
            .slice(-8)
            .map((h) => ({ role: h.role, content: h.text.slice(0, 400) }))
        : [];

      const system = step === "ask"
        ? `You are Zephyr, a warm, easygoing creative director for an AI ${kind} generator, having a natural chat with the user. Always write a short, friendly reply in your own voice (1-2 sentences, like texting a creative friend). Then decide what they need:
- If they're just greeting you, making small talk, or asking what you can do: set ready=false and leave questions empty. Use your reply to warmly invite them to describe what they'd like to create.
- If they've described something to create but it's vague: set ready=true and add up to 3 natural clarifying questions, each with exactly 3 options (a short label + a few-word description). Phrase questions the way a friend would ask out loud ("How do you want it to feel?", "Where's this happening?"), NEVER terse labels like "Setting" or "Camera style".
- If they've already given a detailed creative request: set ready=true and leave questions empty — you have enough to generate.
Tailor everything to what THIS user is trying to make.`
        : `You are the prompt writer for Zephyr, an AI ${kind} generator. Turn the user's request and their picks into ONE vivid, specific ${kind}-generation prompt. ${kind === "video" ? "Cover subject, action, setting, lighting, camera and mood." : kind === "image" ? "Cover subject, style, composition and lighting." : "Describe the delivery and tone."}`;

      const userMsg = step === "ask"
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
        : {
            name: "write_prompt",
            description: "Return the final generation prompt.",
            input_schema: {
              type: "object",
              properties: { prompt: { type: "string" } },
              required: ["prompt"],
            },
          };

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
            system,
            tools: [tool],
            tool_choice: { type: "tool", name: tool.name },
            messages: step === "ask" ? turns : [{ role: "user", content: userMsg }],
          }),
        });
      } catch (e) {
        return Response.json({ error: "director request failed", detail: String(e) }, { status: 502 });
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return Response.json({ error: "director error", detail: data }, { status: 502 });

      const parsed = (data.content || []).find((c) => c.type === "tool_use")?.input;
      if (!parsed) return Response.json({ error: "director no output", detail: data }, { status: 502 });

      if (step === "ask") {
        const questions = (Array.isArray(parsed.questions) ? parsed.questions : [])
          .slice(0, 3)
          .map((q) => ({
            title: String(q.title || "").slice(0, 120),
            options: (Array.isArray(q.options) ? q.options : [])
              .slice(0, 3)
              .map((o) => ({ label: String(o.label || "").slice(0, 40), desc: String(o.desc || "").slice(0, 60) }))
              .filter((o) => o.label),
          }))
          .filter((q) => q.title && q.options.length);
        return Response.json({
          reply: String(parsed.reply || "").slice(0, 500),
          ready: !!parsed.ready,
          questions,
        });
      }
      return Response.json({ prompt: String(parsed.prompt || prompt).slice(0, 2000) });
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
  },
};
