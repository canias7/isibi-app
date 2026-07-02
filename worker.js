const PERSONAS = {
  Nova: "You are Nova, the website builder agent on isibi.ai. You help users plan and build websites: structure, copy, design direction, and working HTML/CSS/JS when asked. Personality: bright, fast and to the point — short, punchy answers, zero fluff. When a user describes a site, propose a crisp plan (pages, sections, style) and build exactly what they ask for.",
  Zephyr: "You are Zephyr, the video generator agent on isibi.ai. You help users create videos: concepts, scripts, storyboards, shot lists, camera and style directions, and polished generation prompts. Personality: calm, thoughtful and easygoing — warm, patient, reflective. Actual video rendering is coming soon; you craft everything needed so the vision is ready to generate.",
};

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

// Audio mode is voice generation (text-to-speech).
const AUDIO_MODELS = new Set([
  "fal-ai/elevenlabs/tts/eleven-v3",
  "fal-ai/elevenlabs/tts/turbo-v2.5",
  "fal-ai/elevenlabs/tts/multilingual-v2",
]);
const DEFAULT_AUDIO_MODEL = "fal-ai/elevenlabs/tts/eleven-v3";

// Tried in order; if a model gets deprecated the next one takes over.
const MODELS = [
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/meta/llama-3.2-3b-instruct",
  "@cf/meta/llama-3.1-8b-instruct-fp8",
];
let modelIndex = 0;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400 });
      }

      const system = PERSONAS[body.agent];
      if (!system) {
        return Response.json({ error: "unknown agent" }, { status: 400 });
      }

      const history = (Array.isArray(body.messages) ? body.messages : [])
        .filter(
          (m) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string"
        )
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

      if (!history.length) {
        return Response.json({ error: "no messages" }, { status: 400 });
      }

      let lastErr;
      for (let i = modelIndex; i < MODELS.length; i++) {
        try {
          const result = await env.AI.run(MODELS[i], {
            messages: [{ role: "system", content: system }, ...history],
            max_tokens: 512,
          });
          modelIndex = i;
          return Response.json({ reply: result.response });
        } catch (err) {
          lastErr = err;
        }
      }
      return Response.json(
        { error: "AI request failed", detail: String(lastErr) },
        { status: 502 }
      );
    }

    const genKind =
      url.pathname === "/api/video" ? "video" :
      url.pathname === "/api/image" ? "image" :
      url.pathname === "/api/audio" ? "audio" : null;
    if (genKind && request.method === "POST") {
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
          if (isSeedance) {
            endpoint = model.replace("/text-to-video", "/image-to-video");
            input.image_url = image;
            if (end) input.end_image_url = end;
          } else if (isKling) {
            endpoint = model.replace("/text-to-video", "/image-to-video");
            input.start_image_url = image;
            if (end) input.end_image_url = end;
          } else if (isGrok) {
            endpoint = model.replace("/text-to-video", "/image-to-video");
            input.image_url = image;
          }
          // Gemini has no image-to-video endpoint: the image is ignored.
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
      } else if (image || avatar) {
        if (endpoint === "google/nano-banana-2") endpoint = "fal-ai/nano-banana-2/edit";
        else if (endpoint === "fal-ai/nano-banana-pro") endpoint = "fal-ai/nano-banana-pro/edit";
        const urls = [image, avatar].filter(Boolean);
        input.image_urls = urls;
        input.image_url = urls[0];
        if (ratio && !model.startsWith("fal-ai/flux/")) input.aspect_ratio = ratio;
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

    // Proxies fal queue status/result URLs so the key stays server-side.
    if (url.pathname === "/api/video/poll" && request.method === "GET") {
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
