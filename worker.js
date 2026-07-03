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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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

      const system = step === "ask"
        ? `You are Zephyr, a warm, easygoing creative director for an AI ${kind} generator, chatting with the user. Read their request. If it's already detailed enough to make something great, reply with {"questions":[]}. Otherwise ask up to 3 natural, conversational questions — phrased the way a friendly collaborator actually talks out loud (e.g. "How do you want it to feel?", "Where's this happening?", "Who's in it?"), NEVER terse category labels like "Setting", "Camera style" or "Dog breed". Tailor every question to what THIS user is trying to make. Each question has exactly 3 options; each option is a short label plus a few-word description. Respond with ONLY JSON of the form {"questions":[{"title":"<the natural question>","options":[{"label":"<short choice>","desc":"<few words>"}]}]}. No prose, no markdown.`
        : `You are the prompt writer for Zephyr, an AI ${kind} generator. Turn the user's request and their picks into ONE vivid, specific ${kind}-generation prompt. ${kind === "video" ? "Cover subject, action, setting, lighting, camera and mood." : kind === "image" ? "Cover subject, style, composition and lighting." : "Describe the delivery and tone."} Respond with ONLY JSON {"prompt":"..."}. No prose, no markdown.`;

      const userMsg = step === "ask"
        ? `Request: ${prompt}`
        : `Request: ${prompt}\nPicks: ${answers.length ? answers.join("; ") : "(none)"}`;

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
            max_tokens: step === "ask" ? 700 : 500,
            system,
            messages: [{ role: "user", content: userMsg }],
          }),
        });
      } catch (e) {
        return Response.json({ error: "director request failed", detail: String(e) }, { status: 502 });
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return Response.json({ error: "director error", detail: data }, { status: 502 });

      let txt = (data.content?.[0]?.text || "").trim()
        .replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      let parsed;
      try { parsed = JSON.parse(txt); } catch {
        return Response.json({ error: "director parse failed" }, { status: 502 });
      }

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
        return Response.json({ questions });
      }
      return Response.json({ prompt: String(parsed.prompt || prompt).slice(0, 2000) });
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
