// Clip-duration measurement — the billing basis for every render that has no
// duration input (Gemini/o3 clip edits, LipSync, Seedance video references).
// fal bills the WHOLE source clip there, so the worker byte-measures it and an
// unmeasurable container falls back to the model's maximum. A webm used to be
// unmeasurable: a 5s screen recording on Gemini's clip edit billed the 30s cap,
// ~6× over. These tests lift the REAL parsers out of worker.js so they cannot
// drift from what ships.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeTally } from "./harness.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const t = makeTally("Clip duration (billing basis)");
const src = readFileSync(join(ROOT, "worker.js"), "utf8");

// Pull a top-level function out of worker.js by brace-matching, so the test
// runs the shipped bytes rather than a copy that can rot.
function lift(name) {
  const start = src.indexOf(`\nfunction ${name}(`);
  if (start < 0) throw new Error(`worker.js has no function ${name}`);
  let depth = 0, i = src.indexOf("{", start);
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return src.slice(start, j + 1);
  }
  throw new Error(`unterminated ${name}`);
}
const api = new Function(
  "atob",
  ["videoDurationFromDataUri", "durMp4", "durWebm"].map(lift).join("\n") +
    "\nreturn { videoDurationFromDataUri, durMp4, durWebm };",
)(globalThis.atob);

const bytes = (p) => new Uint8Array(readFileSync(join(ROOT, p)));
const dvOf = (b) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const uri = (b, mime) => `data:${mime};base64,` + Buffer.from(b).toString("base64");

// --- Anchor: the same source encoded twice, read by two independent parsers ---
// public/login-bg.{mp4,webm} are the same clip. durMp4 (unchanged, already
// trusted for billing) and durWebm (new) must agree — that agreement is what
// makes the EBML parser trustworthy; the synthetic cases below only probe
// structure.
const mp4 = bytes("public/login-bg.mp4");
const webm = bytes("public/login-bg.webm");
const mp4Secs = api.durMp4(mp4, dvOf(mp4));
const webmSecs = api.durWebm(webm, dvOf(webm));
t.eq(mp4Secs, 9.625, `durMp4 reads login-bg.mp4 (${mp4Secs}s)`);
t.eq(webmSecs, 9.625, `durWebm reads login-bg.webm (${webmSecs}s)`);
t.eq(webmSecs, mp4Secs, "both containers of one source measure identically");

// --- Dispatch: videoDurationFromDataUri routes each container to its parser ---
t.eq(api.videoDurationFromDataUri(uri(mp4, "video/mp4")), 9.625, "data URI → mp4 parser");
t.eq(api.videoDurationFromDataUri(uri(webm, "video/webm")), 9.625, "data URI → webm parser (was null → billed the max)");
t.eq(api.videoDurationFromDataUri(uri(webm, "video/x-matroska")), 9.625, "mkv-labelled EBML measures too (parse is by magic, not mime)");

// --- The billing consequence, using the worker's own formula ---
// worker.js: clipBillSecs = Math.min(clipEditMax, Math.ceil(clipSecondsReal || clipEditMax))
const bill = (secs, max) => Math.min(max, Math.ceil(secs || max));
t.eq(bill(api.videoDurationFromDataUri(uri(webm, "video/webm")), 30), 10, "a 9.6s webm bills 10s on Gemini's clip edit");
t.eq(bill(0, 30), 30, "an unmeasurable clip still bills the 30s maximum (never undercharge)");
t.eq(
  Math.ceil(bill(9.625, 30) * 0.13 / 0.008) < Math.ceil(bill(0, 30) * 0.13 / 0.008) / 2,
  true,
  "measuring it costs the user less than half the old maximum charge",
);

// --- Structure: a minimal EBML writer, exercising the paths real files vary on ---
const SEGMENT = [0x18, 0x53, 0x80, 0x67], INFO = [0x15, 0x49, 0xa9, 0x66];
const SCALE = [0x2a, 0xd7, 0xb1], DURATION = [0x44, 0x89], CLUSTER = [0x1f, 0x43, 0xb6, 0x75];
const size4 = (n) => [0x10 | ((n >> 24) & 0x0f), (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const el = (id, payload) => [...id, ...size4(payload.length), ...payload];
const f64 = (v) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); return [...b]; };
const f32 = (v) => { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, v); return [...b]; };
const uintBytes = (v) => { const out = []; do { out.unshift(v % 256); v = Math.floor(v / 256); } while (v > 0); return out; };
const header = el([0x1a, 0x45, 0xdf, 0xa3], []);
const doc = (children, { unknownSize = false } = {}) =>
  new Uint8Array(unknownSize ? [...header, ...SEGMENT, 0xff, ...children] : [...header, ...el(SEGMENT, children)]);
const info = (parts) => el(INFO, parts);
const read = (b) => api.durWebm(b, dvOf(b));

t.eq(read(doc(info([...el(DURATION, f64(5000))]))), 5, "default 1ms TimecodeScale: 5000 ticks = 5s");
t.eq(read(doc(info([...el(SCALE, uintBytes(1000000)), ...el(DURATION, f64(12500))]))), 12.5, "explicit TimecodeScale");
t.eq(read(doc(info([...el(SCALE, uintBytes(1000000000)), ...el(DURATION, f64(7))]))), 7, "a 1-second TimecodeScale is honoured");
t.eq(read(doc(info([...el(DURATION, f32(8000))]))), 8, "Duration may be a 4-byte float");
t.eq(read(doc(info([...el(SCALE, uintBytes(1000000))]))), null, "no Duration element → null (MediaRecorder captures)");
t.eq(read(doc(info([...el(DURATION, f64(0))]))), null, "a zero Duration is not a measurement");
t.eq(read(doc(info([...el(DURATION, f64(6000))]), { unknownSize: true })), 6, "a streamed Segment (unknown size) still measures");
t.eq(read(doc([...el(CLUSTER, [1, 2, 3]), ...info([...el(DURATION, f64(4000))])])), 4, "Info found after an earlier sized element");
// Only the Segment may declare an unknown length. Walking past any other one's
// true end reads whatever follows as its content — here a stray Duration that
// is not this Info's — and that figure would be billed. Bail instead.
t.eq(
  read(doc([...INFO, 0xff, ...el(SCALE, uintBytes(1000000)), ...el(DURATION, f64(99000))])),
  null,
  "an unknown-size Info bails rather than adopting a following element's duration",
);

// --- Refusals: never invent a figure that is about to be billed ---
t.eq(read(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])), null, "non-EBML bytes → null");
t.eq(read(webm.slice(0, 8)), null, "a truncated header → null, no throw");
t.eq(read(new Uint8Array([...header, ...SEGMENT, 0x00])), null, "an unreadable size → null");
t.eq(api.videoDurationFromDataUri("https://example.com/clip.webm"), null, "a hosted URL is not measurable");
t.eq(api.videoDurationFromDataUri("data:video/webm,notbase64"), null, "a non-base64 data URI → null");
t.eq(api.durMp4(webm, dvOf(webm)), null, "the mp4 parser rejects a webm (so the dispatch order is safe)");
t.eq(read(mp4), null, "the webm parser rejects an mp4");



// --- Clip LENGTH gate ---------------------------------------------------
// The 15s figure is Seedance's reference-to-video cap. It used to be applied to
// every model, so Gemini's 30s edit and Veo's 23s extend were unreachable —
// the client attached the clip, quoted a price, and the server 400'd.
// Both constants come out of worker.js too — hard-coding 15.5 here would let
// the shipped default drift away from what this file claims to check.
const capsSrc = src.slice(
  src.indexOf("const CLIP_MAX_S ="),
  src.indexOf("\n", src.indexOf("const CLIP_MAX_DEFAULT_S =")),
);
const gate = new Function(`${capsSrc}\n${lift("clipLengthError")}\nreturn clipLengthError;`)();

// 10s is MEASURED: a 30s clip comes back as the first 10s, reported COMPLETED,
// billed as 30. Not in fal's schema, which documents no cap.
t.eq(gate("google/gemini-omni-flash", 10, 10), "", "Gemini takes its measured 10s");
t.eq(gate("google/gemini-omni-flash", 10.03, 10.03), "", "0.05s tolerance matches fal's and the client's");
t.ok(gate("google/gemini-omni-flash", 30, 30), "Gemini refuses 30s — it would silently return 10s and bill 30");
t.ok(gate("google/gemini-omni-flash", 11, 11), "…and refuses even 11s, one second over what it delivers");
t.eq(gate("fal-ai/veo3.1", 23, 23), "", "Veo extend takes its 23s input");
t.ok(gate("fal-ai/veo3.1", 24, 24), "Veo extend refuses 24s");
t.eq(gate("fal-ai/kling-video/o3/pro/text-to-video", 15, 15), "", "o3 edit keeps its 15s");
t.ok(gate("fal-ai/kling-video/o3/pro/text-to-video", 16, 16), "o3 edit refuses 16s");
t.ok(gate("fal-ai/kling-video/lipsync/audio-to-video", 11, 11), "LipSync refuses 11s");
t.eq(gate("bytedance/seedance-2.0/text-to-video", 15, 15), "", "Seedance keeps its 15s combined-reference cap");
t.ok(gate("bytedance/seedance-2.0/text-to-video", 9, 20), "Seedance measures the COMBINED references, not slot #1 alone");
t.eq(gate("bytedance/seedance-2.0/text-to-video", 20, 12), "", "…and only the combined figure — a long slot #1 with short extras is fine");
t.eq(gate("google/gemini-omni-flash", 0, 0), "", "an unmeasurable clip passes and bills the maximum instead");
t.ok(gate("some/unlisted-model", 20, 20), "an unlisted model keeps the old blanket 15s (no new cost hole)");

t.done();
