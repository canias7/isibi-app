// A HELPER OF test/worker-memory.test.mjs (not a test itself): one of the Worker's routes, in a process of its own with a
// small heap, against a big chat, with R2 kept on disk (so nothing of the chat is in this process before the route reads it)
// and the machine's answers read from files as a network's would be. Prints one line of JSON: the route's status and what it
// said. `build <dir>` makes the data: a chat of some 20 MB as the machine saved it before 2026-11-14 (24 pictures in it), the
// same chat as it is saved since (each picture apart, named by its SHA-256), a call to Grok with all of it (20 MB), the live
// save's sending at its limit, a chat past the Worker's last-resort size, and a picture at the store's limit.
//   node worker-memory-route.mjs build <dir>
//   node --max-old-space-size=48 worker-memory-route.mjs run <dir> <route>
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, copyFileSync, createReadStream, statSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";

const HERE = new URL("..", import.meta.url).pathname;
const [MODE, DATA, ROUTE] = process.argv.slice(2);

/** The chat: 60 reads of some 30,000 characters (with an em dash and an ellipsis, as Coder's notes have), 24 pictures of 750 KB. */
function chatOf({ pics = 24, picChars = 750_000, textChars = 1_800_000 } = {}) {
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const pic = (i) => "data:image/png;base64," + Buffer.alloc(Math.floor(picChars * 0.75), i).toString("base64");
  const line = (i) => String(i).padStart(6) + "\tconst value_" + i + " = compute(" + i + "); // keep — it’s used…\n";
  const text = (n) => { let s = ""; for (let i = 0; s.length < n; i++) s += line(i); return s.slice(0, n); };
  const messages = [{ role: "user", content: "Please look at the screenshots and fix the layout." }];
  const rounds = 60, per = Math.floor(textChars / rounds);
  for (let r = 0, p = 0; r < rounds; r++) {
    messages.push({ role: "assistant", content: "", tool_calls: [call("read", { path: "src/file" + r + ".js" }, "r" + r)], tokens: 1000 + r });
    messages.push({ role: "tool", tool_call_id: "r" + r, content: text(per) });
    if (p < pics && r % 2 === 1) { const n = Math.min(2, pics - p); messages.push({ role: "user", appNote: true, readPics: true, content: "(Note from Coder's app, not the owner: the pictures your read opened, attached here in order.)", images: Array.from({ length: n }, (_, j) => pic(p + j)) }); p += n; }
  }
  messages.push({ role: "assistant", content: "Done — the layout is fixed." });
  return messages;
}
const apart = (messages, dir) => {
  mkdirSync(join(dir, "pics"), { recursive: true });
  return messages.map((m) => (Array.isArray(m.images) ? { ...m, images: m.images.map((u) => { const sha = createHash("sha256").update(u).digest("hex"); writeFileSync(join(dir, "pics", sha), u); return "coder-pic:" + sha; }) } : m));
};

if (MODE === "build") {
  mkdirSync(DATA, { recursive: true });
  const whole = chatOf();
  writeFileSync(join(DATA, "messages-inline.json"), JSON.stringify(whole));
  const saved = apart(whole, DATA);
  writeFileSync(join(DATA, "messages.json"), JSON.stringify(saved));
  const events = Array.from({ length: 200 }, (_, i) => ({ at: i, type: "result", id: "r" + i, output: "ok " + i }));
  const ended = (messages) => JSON.stringify({ running: false, events, next: events.length, result: { status: "done", messages: [...messages, { role: "user", content: "and now?" }, { role: "assistant", content: "Fine." }], rounds: 3, usage: [], summary: "Fine.", edited: [] } });
  writeFileSync(join(DATA, "state.json"), ended(saved));
  writeFileSync(join(DATA, "state-inline.json"), ended(whole));
  const input = whole.map((m) => (m.images ? { role: "user", content: [{ type: "input_text", text: m.content }, ...m.images.map((u) => ({ type: "input_image", image_url: u, detail: "auto" }))] } : { role: m.role === "tool" ? "user" : m.role, content: String(m.content || "") }));
  writeFileSync(join(DATA, "gate.json"), JSON.stringify({ model: "grok-4.7", instructions: "x".repeat(10000), input, tools: [], tool_choice: "auto" }));
  // The live save's sending, just under its limit (4 MB): the conversation without its pictures.
  const textOnly = chatOf({ pics: 0, textChars: 3_400_000 });
  writeFileSync(join(DATA, "live.json"), JSON.stringify({ from: 0, events: events.slice(0, 50), messages: textOnly, whole: true }));
  // A chat past the Worker's last-resort size (6 MB of text).
  writeFileSync(join(DATA, "messages-big.json"), JSON.stringify(chatOf({ pics: 0, textChars: 6_500_000 })));
  // A picture at the store's limit (12 MB).
  writeFileSync(join(DATA, "bigpic.txt"), "data:image/png;base64," + Buffer.alloc(9_437_100, 7).toString("base64"));
  process.stdout.write(JSON.stringify({ built: true }) + "\n");
  process.exit(0);
}

const W = HERE;
const R2 = join(DATA, "bucket-" + ROUTE + "-" + process.pid);
rmSync(R2, { recursive: true, force: true });
mkdirSync(R2, { recursive: true });
const fileOf = (k) => join(R2, encodeURIComponent(k));
const bucket = {
  async get(k) {
    const f = fileOf(k);
    if (!existsSync(f)) return null;
    return { size: statSync(f).size, text: () => readFile(f, "utf8"), get body() { return Readable.toWeb(createReadStream(f)); }, arrayBuffer: async () => { const b = await readFile(f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } };
  },
  async put(k, v) {
    if (v instanceof ReadableStream) { const out = []; for await (const c of v) out.push(Buffer.from(c)); await writeFile(fileOf(k), Buffer.concat(out)); }
    else await writeFile(fileOf(k), typeof v === "string" ? v : Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v));
  },
  async delete(k) { try { unlinkSync(fileOf(k)); } catch { /* gone */ } },
  async list({ prefix = "" } = {}) { return { objects: readdirSync(R2).map((x) => decodeURIComponent(x)).filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; },
};
const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket, XAI_API_KEY: "not-a-real-key" };
const UID = "user-1234567890abcdef", ID = "shop-mem1";
const key = (f) => "coder/" + UID + "/" + ID + "/" + f;
const { handleCoder } = await import(W + "src/coder-routes.mjs");
const { saveConnection } = await import(W + "src/coder-github.mjs");
const L = await import(W + "src/coder-live.mjs");
const G = await import(W + "src/coder-model-gate.mjs");
await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
const setMeta = (o) => bucket.put(key("meta.json"), JSON.stringify({ id: ID, repo: "ana/shop", base: "main", branch: "coder/" + ID, turn: 1, saved: 1, status: "idle", at: Date.now(), ...o }));
await setMeta({});
const inline = process.env.WM_INLINE === "1";
copyFileSync(join(DATA, ROUTE === "summary" ? "messages-big.json" : inline ? "messages-inline.json" : "messages.json"), fileOf(key("messages.json")));
for (const f of readdirSync(join(DATA, "pics"))) copyFileSync(join(DATA, "pics", f), fileOf(key("pics/" + f)));
await bucket.put(key("events.json"), JSON.stringify(Array.from({ length: 300 }, (_, i) => ({ at: i, type: "result", id: "r" + i, output: "ok " + i }))));
const box = () => ({ fetch: async (req) => {
  const u = new URL(req.url);
  if (u.pathname === "/turn") { if (req.body) for await (const _c of req.body) { /* read as a network would */ } return Response.json({ ok: true }); }
  if (u.pathname === "/state") return ROUTE === "end" ? new Response(Readable.toWeb(createReadStream(join(DATA, inline ? "state-inline.json" : "state.json"))), { headers: { "content-type": "application/json" } }) : Response.json({ status: "idle", events: [], running: false });
  if (u.pathname === "/push") return Response.json({ ok: true, pushed: true, changed: false });
  return Response.json({ ok: true });
} });
const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: UID, email: "me@x.y" }), container: box, summarize: async () => "THE SUMMARY" };
const go = (path, init = {}) => handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, deps);
const chat = UID + "/" + ID;
const fileBody = (f) => ({ body: Readable.toWeb(createReadStream(join(DATA, f))), duplex: "half", length: String(statSync(join(DATA, f)).size) });
let r = null, said = "";
if (ROUTE === "start" || ROUTE === "summary") r = await go("projects/" + ID + "/message", { method: "POST", body: JSON.stringify({ text: "next" }) });
else if (ROUTE === "end") { await setMeta({ status: "running", turn: 2 }); r = await go("projects/" + ID + "/state?since=0"); }
else if (ROUTE === "undo") { await setMeta({ commits: [{ sha: "abc1234", title: "fix", turn: 1 }] }); r = await go("projects/" + ID + "/undo", { method: "POST", body: "{}" }); }
else if (ROUTE === "rewind") { await setMeta({ turn: 2, marks: [{ turn: 1, ev: 0, msg: 0 }, { turn: 2, ev: 10, msg: 40 }] }); r = await go("projects/" + ID + "/rewind", { method: "POST", body: JSON.stringify({ turn: 2, chat: true }) }); }
else if (ROUTE === "get") { r = await go("projects/" + ID); const t = await r.clone().text(); said = "conversation in it: " + (t.includes("Please look at the screenshots") || t.includes("coder-pic:")); }
else if (ROUTE === "live" || ROUTE === "lost") {
  await setMeta({ status: "running", turn: 2, at: Date.now() - 3600_000 });
  const f = fileBody("live.json");
  r = await L.handleLive(new Request("https://coder.gofarther.dev" + L.LIVE_PATH, { method: "POST", body: f.body, duplex: f.duplex, headers: { "content-type": "application/json", "content-length": f.length, "x-coder-chat": chat, "x-coder-turn": "2", "x-coder-live": await L.livePass(env, chat, 2) } }), env);
  if (ROUTE === "lost" && r.ok) r = await go("projects/" + ID + "/state?since=0");
} else if (ROUTE === "gate") {
  await setMeta({ status: "running", turn: 2 });
  const until = String(Date.now() + 3600_000), f = fileBody("gate.json");
  let sent = 0;
  r = await G.handleModel(new Request("https://coder.gofarther.dev" + G.MODEL_PATH, { method: "POST", body: f.body, duplex: f.duplex, headers: { "content-type": "application/json", "content-length": f.length, "x-coder-chat": chat, "x-coder-turn": "2", "x-coder-until": until, "x-coder-model": await G.modelPass(env, chat, "2", until) } }), env, { fetchFn: async (u, init) => { sent = init.body.length; return Response.json({ output: [], usage: {} }); } });
  said = "passed on " + sent;
} else if (ROUTE === "picpost" || ROUTE === "picget") {
  await setMeta({ status: "running", turn: 2 });
  const hdr = { "x-coder-chat": chat, "x-coder-turn": "2", "x-coder-live": await L.livePass(env, chat, 2) };
  if (ROUTE === "picpost") { const f = fileBody("bigpic.txt"); r = await L.handleLivePic(new Request("https://coder.gofarther.dev" + L.LIVE_PIC_PATH, { method: "POST", body: f.body, duplex: f.duplex, headers: { ...hdr, "content-type": "text/plain", "content-length": f.length } }), env); }
  else { const sha = createHash("sha256").update(readFileSync(join(DATA, "bigpic.txt"))).digest("hex"); copyFileSync(join(DATA, "bigpic.txt"), fileOf(key("pics/" + sha))); r = await L.handleLivePic(new Request("https://coder.gofarther.dev" + L.LIVE_PIC_PATH + "?sha=" + sha, { method: "GET", headers: hdr }), env); let n = 0; for await (const c of r.body) n += c.length; said = "streamed " + n; }
}
const status = r ? r.status : 0;
if (!said && r && r.body && !r.bodyUsed) said = (await r.text()).slice(0, 120);
rmSync(R2, { recursive: true, force: true });
process.stdout.write(JSON.stringify({ route: ROUTE, status, said }) + "\n");
