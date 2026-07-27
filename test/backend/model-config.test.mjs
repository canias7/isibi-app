// Model configuration parity — the client and the worker each carry their own
// copy of every model's price, clip cap and capability set, and NOTHING made
// them agree. That is how Gemini shipped a 30s clip cap the model didn't honour
// and a 15.5s server guard that made it untestable: three places said 30, the
// one gate that decided said 15.5, and no test compared them.
//
// These assertions read the REAL tables out of both files, so a number can only
// change in one place if this fails.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeTally } from "./harness.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const t = makeTally("Model config parity");
const worker = readFileSync(join(ROOT, "worker.js"), "utf8");
const client = readFileSync(join(ROOT, "public", "chat.js"), "utf8");

// Lift an object literal by name, brace-matched, and evaluate it. MODEL_OPTS
// spreads the shared *_OPTS consts and uses range(), so those come along too —
// evaluating the real source is the whole point, a hand-copied table would rot.
function lit(src, name) {
  const at = src.indexOf(`const ${name} = {`);
  if (at < 0) throw new Error(`missing table ${name}`);
  let depth = 0, out = "";
  for (let i = src.indexOf("{", at); i < src.length; i++) {
    out += src[i];
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  return out;
}
const SHARED = ["SEEDANCE_OPTS", "KLING_OPTS"]
  .filter((n) => client.includes(`const ${n} = {`))
  .map((n) => `const ${n} = ${lit(client, n)};`)
  .join("\n");
function table(src, name) {
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const pre = src === client ? SHARED : "";
  // Voice/ratio lists reference consts we don't need for cap or price parity —
  // stub them so the literal evaluates without dragging in half of chat.js.
  const KLS_VOICES = [];
  const ELEVEN_VOICES = [];
  return new Function("range", "KLS_VOICES", "ELEVEN_VOICES",
    `${pre}\nreturn ${lit(src, name)};`)(range, KLS_VOICES, ELEVEN_VOICES);
}

const VIDEO_USD = table(worker, "VIDEO_USD");
const IMAGE_USD = table(worker, "IMAGE_USD");
const AUDIO_USD = table(worker, "AUDIO_USD_PER_1K");
const GPT_W = table(worker, "GPT_PRICE");
const CLIP_MAX_S = table(worker, "CLIP_MAX_S");

const VIDEO_PRICE = table(client, "VIDEO_PRICE");
const IMAGE_PRICE = table(client, "IMAGE_PRICE");
const AUDIO_PRICE = table(client, "AUDIO_PRICE");
const GPT_C = table(client, "GPT_PRICE");
const CLIP_LIMITS = table(client, "CLIP_LIMITS");
const AUDIO_LIMITS = table(client, "AUDIO_LIMITS");
const MODEL_OPTS = table(client, "MODEL_OPTS");
const MODEL_LISTS = table(client, "MODEL_LISTS");

// --- The allowlists are the source of truth for which models exist ---
const allow = (name) => {
  const at = worker.indexOf(`const ${name} = new Set([`);
  const end = worker.indexOf("]);", at);
  return worker.slice(at, end).match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
};
const VIDEO_MODELS = allow("VIDEO_MODELS");
const IMAGE_MODELS = allow("IMAGE_MODELS");

t.eq(VIDEO_MODELS.length, 12, `worker allows 12 video models (${VIDEO_MODELS.length})`);
t.eq(MODEL_LISTS.video.length, VIDEO_MODELS.length, "the picker lists exactly the allowed video models");
t.eq(MODEL_LISTS.video.filter((m) => !VIDEO_MODELS.includes(m.id)).map((m) => m.id).join(",") || "none",
  "none", "no picker entry is missing from the worker allowlist");
t.eq(VIDEO_MODELS.filter((id) => !MODEL_LISTS.video.some((m) => m.id === id)).join(",") || "none",
  "none", "no allowed model is missing from the picker");
t.eq(MODEL_LISTS.image.filter((m) => !IMAGE_MODELS.includes(m.id)).map((m) => m.id).join(",") || "none",
  "none", "image picker matches the image allowlist");

// --- Price parity: every model, every tier, both directions ---
let priceBad = [];
for (const id of VIDEO_MODELS) {
  const w = VIDEO_USD[id], c = VIDEO_PRICE[id];
  if (!w || !c) { priceBad.push(`${id}: missing`); continue; }
  for (const tbl of ["s", "aoff", "v2s"]) {
    const a = w[tbl] || {}, b = c[tbl] || {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[k] !== b[k]) priceBad.push(`${id}.${tbl}.${k}: worker ${a[k]} vs client ${b[k]}`);
    }
  }
  if (w.videoPer5s !== c.videoPer5s) priceBad.push(`${id}.videoPer5s`);
}
t.eq(priceBad.join(" | ") || "none", "none", "every video price matches between worker and client");

t.eq(Object.keys(IMAGE_USD).filter((k) => IMAGE_USD[k] !== IMAGE_PRICE[k]).join(",") || "none",
  "none", "image prices match");
t.eq(Object.keys(AUDIO_USD).filter((k) => AUDIO_USD[k] !== AUDIO_PRICE[k]).join(",") || "none",
  "none", "audio prices match");
t.eq(JSON.stringify(GPT_W), JSON.stringify(GPT_C), "GPT Image 2 tier pricing matches");

// --- Clip caps: the Gemini class of bug ---
// Every model whose picker offers a clip slot must be validated on BOTH sides,
// and the two numbers must be the same one.
const clipModels = Object.keys(MODEL_OPTS).filter((id) => (MODEL_OPTS[id].caps || {}).clip);
t.ok(clipModels.length >= 8, `models offering a clip slot (${clipModels.length})`);

const noClient = clipModels.filter((id) => !CLIP_LIMITS[id]);
t.eq(noClient.join(",") || "none", "none", "every clip-taking model has a client CLIP_LIMITS entry");

// Seedance treats a clip as a reference and is governed by the combined 15s
// rule rather than a per-model ceiling, so it is exempt from CLIP_MAX_S.
const needsServerCap = clipModels.filter((id) => !id.startsWith("bytedance/"));
const noServer = needsServerCap.filter((id) => !CLIP_MAX_S[id]);
t.eq(noServer.join(",") || "none", "none", "every non-Seedance clip model has a server CLIP_MAX_S entry");

const mismatched = needsServerCap
  .filter((id) => CLIP_LIMITS[id] && CLIP_MAX_S[id] !== CLIP_LIMITS[id].maxDur)
  .map((id) => `${id}: server ${CLIP_MAX_S[id]} vs client ${CLIP_LIMITS[id].maxDur}`);
t.eq(mismatched.join(" | ") || "none", "none", "server clip cap equals the client's for every model");

// A cap the server enforces but the picker never offers is dead config.
const orphanCaps = Object.keys(CLIP_MAX_S).filter((id) => !clipModels.includes(id));
t.eq(orphanCaps.join(",") || "none", "none", "no CLIP_MAX_S entry for a model that takes no clip");

// --- Gemini specifically: 10 is MEASURED, and must not drift back up ---
t.eq(CLIP_MAX_S["google/gemini-omni-flash"], 10, "Gemini's clip cap is the measured 10s, not the old 30");
t.eq(CLIP_LIMITS["google/gemini-omni-flash"].maxDur, 10, "…and the client agrees");

// --- Audio caps exist wherever an audio slot is offered ---
const audioModels = Object.keys(MODEL_OPTS).filter((id) => (MODEL_OPTS[id].caps || {}).audio);
t.eq(audioModels.filter((id) => !AUDIO_LIMITS[id]).join(",") || "none",
  "none", "every audio-taking model has an AUDIO_LIMITS entry");

// --- Durations the picker offers must be ones the server will accept ---
// worker.js gates body.duration on 1..20 and bills whatever it lets through.
const durBad = [];
for (const [id, o] of Object.entries(MODEL_OPTS)) {
  for (const d of o.durations || []) {
    if (!(d >= 1 && d <= 20)) durBad.push(`${id}: offers ${d}s, server accepts 1-20`);
  }
}
t.eq(durBad.join(" | ") || "none", "none", "no model offers a duration the server would reject");

// Every model the picker offers a duration for must have a price basis for it.
const priceless = Object.keys(MODEL_OPTS).filter((id) => !VIDEO_USD[id]);
t.eq(priceless.join(",") || "none", "none", "every model with options has a server price");

t.done();
