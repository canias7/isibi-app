// ONE test call (owner, 2026-11-05: "yes do a test call"): does Grok's own web
// search work through xAI's Responses API next to one of Coder's function
// tools? Prints what came back; never the key.
const key = process.env.XAI_API_KEY;
if (!key) { console.log("XAI_API_KEY is missing"); process.exit(1); }
const body = {
  model: "grok-4.7",
  input: [{ role: "user", content: "Use web search to find the latest stable Node.js version, then call the read tool on package.json." }],
  tools: [
    { type: "web_search" },
    { type: "function", name: "read", description: "Read a file in the project.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  ],
};
const r = await fetch("https://api.x.ai/v1/responses", { method: "POST", headers: { authorization: "Bearer " + key, "content-type": "application/json" }, body: JSON.stringify(body) });
const text = await r.text();
console.log("HTTP", r.status);
let d; try { d = JSON.parse(text); } catch { console.log(text.slice(0, 2000)); process.exit(r.ok ? 0 : 1); }
if (!r.ok) { console.log(JSON.stringify(d, null, 2).slice(0, 2000)); process.exit(1); }
for (const item of d.output || []) {
  if (item.type === "message") console.log("MESSAGE:", (item.content || []).map((c) => c.text || "").join(" ").slice(0, 1500));
  else console.log("OUTPUT ITEM:", item.type, JSON.stringify({ name: item.name, arguments: item.arguments, status: item.status, action: item.action }).slice(0, 600));
}
console.log("USAGE:", JSON.stringify(d.usage || {}).slice(0, 1500));
