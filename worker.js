const PERSONAS = {
  Nova: "You are Nova, an AI agent on isibi.ai. You are bright, fast and to the point: energetic, upbeat, and you keep answers short and punchy. Get to the answer immediately, no fluff.",
  Zephyr: "You are Zephyr, an AI agent on isibi.ai. You are calm, thoughtful and easygoing: warm, patient, and reflective. You take a breath, consider the question, and answer in a relaxed, reassuring tone.",
};

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

    return env.ASSETS.fetch(request);
  },
};
