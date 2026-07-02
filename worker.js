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
]);
const DEFAULT_VIDEO_MODEL = "bytedance/seedance-2.0/fast/text-to-video";

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

    if (url.pathname === "/api/video" && request.method === "POST") {
      if (!env.FAL_KEY) {
        return Response.json({ error: "video generation not configured" }, { status: 500 });
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400 });
      }
      const prompt =
        typeof body.prompt === "string" ? body.prompt.trim().slice(0, 2000) : "";
      if (!prompt) {
        return Response.json({ error: "no prompt" }, { status: 400 });
      }
      const model =
        !body.model || body.model === "auto" ? DEFAULT_VIDEO_MODEL : body.model;
      if (!VIDEO_MODELS.has(model)) {
        return Response.json({ error: "unknown model" }, { status: 400 });
      }
      const r = await fetch(`https://queue.fal.run/${model}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${env.FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
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
