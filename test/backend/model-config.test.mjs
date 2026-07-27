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
// A 1s clip used to be accepted here — Gemini was the only clip model with no
// floor, and fal caps every other Gemini endpoint at 3..10s.
t.eq(CLIP_LIMITS["google/gemini-omni-flash"].minDur, 3, "Gemini refuses clips under 3s");
const noFloor = clipModels.filter((id) => CLIP_LIMITS[id] && !CLIP_LIMITS[id].minDur && !/veo/.test(id));
t.eq(noFloor.join(",") || "none", "none", "every clip model except Veo (fal documents no floor) has a minimum duration");

// --- Audio caps exist wherever an audio slot is offered ---
const audioModels = Object.keys(MODEL_OPTS).filter((id) => (MODEL_OPTS[id].caps || {}).audio);
t.eq(audioModels.filter((id) => !AUDIO_LIMITS[id]).join(",") || "none",
  "none", "every audio-taking model has an AUDIO_LIMITS entry");

// --- Durations: the worker's own table must equal the picker's ---
// The handler used to gate body.duration on a generic 1..20 for EVERY model and
// bill whatever it let through — so Gemini could be asked for 15s and billed
// for it while fal rendered 10. MODEL_DURATIONS now mirrors the picker, and
// these assertions are what keep the two copies honest.
const MODEL_DURATIONS = table(worker, "MODEL_DURATIONS");
const durBad = [];
for (const [id, o] of Object.entries(MODEL_OPTS)) {
  const offered = o.durations || null;
  const served = MODEL_DURATIONS[id] || null;
  if (!offered && !served) continue;
  if (!offered || !served) { durBad.push(`${id}: picker ${offered ? "has" : "none"}, worker ${served ? "has" : "none"}`); continue; }
  if (offered.join(",") !== served.join(",")) durBad.push(`${id}: picker [${offered}] vs worker [${served}]`);
}
t.eq(durBad.join(" | ") || "none", "none", "every model's duration list matches between picker and worker");
t.eq(MODEL_DURATIONS["fal-ai/veo3.1"].join(","), "4,6,8", "Veo is held to fal's 4s/6s/8s enum");
t.eq(MODEL_DURATIONS["google/gemini-omni-flash"].join(","), "3,4,5,6,7,8,9,10", "Gemini is held to fal's 3..10");
// The validator itself: a duration off the list is refused before any spend.
// Lifted from worker.js by brace-matching, walking past the parameter list
// first — ignoresPickerDuration destructures in its SIGNATURE, so the first "{"
// after the name is the params object, not the body.
function fn(name) {
  const at = worker.indexOf(`\nfunction ${name}(`);
  if (at < 0) throw new Error(`worker.js has no function ${name}`);
  let p = 0, i = worker.indexOf("(", at);
  for (; i < worker.length; i++) { if (worker[i] === "(") p++; else if (worker[i] === ")" && --p === 0) break; }
  let d = 0;
  for (let j = worker.indexOf("{", i); j < worker.length; j++) {
    if (worker[j] === "{") d++;
    else if (worker[j] === "}" && --d === 0) return worker.slice(at, j + 1);
  }
  throw new Error(`unterminated ${name}`);
}
const api = new Function(
  `const MODEL_DURATIONS = ${lit(worker, "MODEL_DURATIONS")};\n${fn("durationError")}\n${fn("ignoresPickerDuration")}` +
  "\nreturn { durationError, ignoresPickerDuration };",
)();
// A throw is a failure, not a reason to stop: dropping the unlisted-model guard
// makes LipSync explode, and that must read as one failed assertion rather than
// abort the other forty.
const durFn = (...a) => { try { return api.durationError(...a); } catch (e) { return `THREW: ${e.message}`; } };
// "refuses" means a message a user can act on — a thrown exception is not a
// refusal, it's a 500.
const refuses = (...a) => { const r = durFn(...a); return typeof r === "string" && !!r && !r.startsWith("THREW"); };
t.eq(durFn("google/gemini-omni-flash", 8, false), "", "Gemini accepts 8s");
t.ok(refuses("google/gemini-omni-flash", 15, false), "Gemini refuses 15s — fal would render 10 and we would bill 15");
t.ok(refuses("fal-ai/veo3.1", 5, false), "Veo refuses 5s — its enum is 4/6/8");
t.eq(durFn("fal-ai/veo3.1", 5, true), "", "…unless the endpoint ignores the picker (extend, refs, first-&-last)");
t.eq(durFn("fal-ai/kling-video/lipsync/audio-to-video", 9, false), "", "LipSync has no duration input, so nothing to police");
t.eq(durFn("fal-ai/veo3.1", null, false), "", "no duration supplied → nothing to check");

// The exemption itself. Asserting only durationError would leave this half
// untested, and an exemption that is always true silently disables the gate.
const ign = (o) => { try { return api.ignoresPickerDuration(o); } catch (e) { return `THREW: ${e.message}`; } };
const REQ = { clip: null, refs: [], first: null, last: null };
t.eq(ign({ ...REQ }), false, "a plain text-to-video is held to the picker");
t.eq(ign({ ...REQ, clip: "https://fal.media/x.mp4" }), true, "a clip edit/extend is exempt");
t.eq(ign({ ...REQ, refs: ["img"] }), true, "reference-to-video is exempt");
t.eq(ign({ ...REQ, first: "a", last: "b" }), true, "first-&-last is exempt");
t.eq(ign({ ...REQ, first: "a" }), false, "a first frame ALONE is plain i2v — still held to the picker");
t.eq(ign({ ...REQ, last: "b" }), false, "…and so is a last frame alone");
t.eq(ign({ ...REQ, refs: [] }), false, "a refs array emptied by validation does not exempt");

// --- Wiring: run the handler's own statements, not a paraphrase of them ------
// Lifting durationError and asserting it in isolation says nothing about the
// call site, and the call site is where this went wrong TWICE: the gate was
// placed above `const duration`, a temporal dead zone that ReferenceErrors on
// every video request. node --check can't see it and a unit test on the lifted
// function can't either. So execute the real slice — from the first/last
// derivation through the gate — with the handler's collaborators stubbed. A
// gate that drifts above any const it reads throws here.
const posAfter = (needle, from) => worker.indexOf(needle, from || 0);
const gateAt = posAfter("const durBad = durationError(");
t.ok(gateAt > 0, "the video handler still calls durationError (a gate nobody calls is not a gate)");
// Building and running the slice are separate failures, and neither may abort
// the file: the position assertions below are what catch a gate that moved too
// LATE, and a mutation that does that also breaks the slice.
let run = null;
try {
  const sliceFrom = posAfter("const first = dataImage(body.first)");
  const sliceTo = posAfter("\n      }", gateAt) + 8;
  const slice = new Function(
    "body", "model", "prompt", "genKind", "clip", "dataImage", "Response",
    `const MODEL_DURATIONS = ${lit(worker, "MODEL_DURATIONS")};\n${fn("durationError")}\n${fn("ignoresPickerDuration")}\n` +
      worker.slice(sliceFrom, sliceTo) + "\nreturn null;",
  );
  run = (o) => slice(
    o.body || {}, o.model, "a prompt", o.genKind || "video", o.clip || null,
    (x) => (typeof x === "string" && x ? x : null),
    { json: (payload, init) => ({ payload, status: init.status }) },
  );
} catch (e) {
  t.ok(false, `the handler slice around the duration gate no longer parses on its own — ${e.message}`);
}
const R = (o) => { try { return run ? run(o) : "SLICE UNAVAILABLE"; } catch (e) { return `THREW: ${e.message}`; } };
t.eq(R({ model: "google/gemini-omni-flash", body: { duration: 8 } }), null, "the shipped handler passes Gemini an 8s request through");
t.eq((R({ model: "google/gemini-omni-flash", body: { duration: 15 } }) || {}).status, 400,
  "…and 400s a 15s one, in the handler, before fal is touched");
t.eq((R({ model: "fal-ai/veo3.1", body: { duration: 5 } }) || {}).status, 400, "Veo 400s a 5s request");
t.eq(R({ model: "fal-ai/veo3.1", body: { duration: 5 }, clip: "https://fal.media/x.mp4" }), null, "…but an extend, which discards it, goes through");
t.eq(R({ model: "fal-ai/veo3.1", body: { duration: 5, refs: ["data:image/png;base64,AA"] } }), null, "…as does reference-to-video");
t.eq(R({ model: "fal-ai/veo3.1", body: { duration: 5, first: "data:image/png;base64,AA", last: "data:image/png;base64,BB" } }), null, "…and first-&-last");
t.eq((R({ model: "fal-ai/veo3.1", body: { duration: 5, first: "data:image/png;base64,AA" } }) || {}).status, 400,
  "a first frame alone is plain i2v and stays policed");
t.eq(R({ model: "fal-ai/veo3.1", body: { duration: 5 }, genKind: "image" }), null, "image requests are untouched");

// Execution proves it isn't too EARLY; position is the only way to prove it
// isn't too late — after a submit or a debit, a 400 has already cost money.
const submitAt = worker.indexOf("await fetch(`https://queue.fal.run/${endpoint}`");
const debitAt = worker.indexOf("await useCredits(");
t.ok(submitAt > 0 && debitAt > 0, "the submit and debit call sites are still recognisable");
t.ok(gateAt > 0 && gateAt < submitAt, "the gate runs before the job is submitted");
t.ok(gateAt > 0 && gateAt < debitAt, "…and before the ledger is debited");

// Every model the picker offers a duration for must have a price basis for it.
const priceless = Object.keys(MODEL_OPTS).filter((id) => !VIDEO_USD[id]);
t.eq(priceless.join(",") || "none", "none", "every model with options has a server price");

t.done();
