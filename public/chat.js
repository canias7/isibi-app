const DEFAULT_MODELS = {
  video: 'bytedance/seedance-2.0/fast/text-to-video',
  image: 'fal-ai/nano-banana-pro',
  audio: 'fal-ai/elevenlabs/tts/eleven-v3',
};

// ElevenLabs preset voices (accepted by name on fal).
const VOICES = ['Rachel', 'Aria', 'Sarah', 'Laura', 'Charlotte', 'Alice', 'Matilda', 'Jessica', 'Lily', 'Roger', 'George', 'Callum', 'Liam', 'Will', 'Brian', 'Daniel'];

// Option ranges verified against fal's OpenAPI schemas.
// caps: which attachments the model actually supports (image = start frame /
// image-to-video, end = end/tail frame, avatar = reference-to-video).
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
// Kling LipSync text-mode voices — the curated English subset of fal's
// voice_id enum (the rest are Chinese-language voices). Mirrored in the worker.
const KLS_VOICES = [
  { id: 'reader_en_m-v1', label: 'Narrator' },
  { id: 'commercial_lady_en_f-v1', label: 'Commercial' },
  { id: 'uk_man2', label: 'UK Man' },
  { id: 'uk_boy1', label: 'UK Boy' },
  { id: 'uk_oldman3', label: 'UK Elder' },
  { id: 'ai_kaiya', label: 'Kaiya' },
  { id: 'oversea_male1', label: 'Casual Male' },
];
const SEEDANCE_OPTS = {
  durations: range(4, 15), defDur: 5,
  ratios: ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'], defRatio: '16:9',
  resolutions: ['480p', '720p'], defRes: '720p',
  // image-to-video, first-&-last (start+end frames), and reference-to-video
  // (≤9 image refs + a driving audio + a @Video1 clip reference). References are
  // cited as @ImageN / @Video1 / @Audio1 in the prompt — the director writes the
  // tags, the worker appends them for raw prompts.
  caps: { image: true, flf: true, ref: 9, audio: true, clip: true },
};
const KLING_OPTS = {
  durations: range(3, 15), defDur: 5,
  ratios: ['16:9', '9:16', '1:1'], defRatio: '16:9',
  // v3 i2v: start+end frames + character elements (@ElementN — fal only takes
  // elements on i2v, so they need a start image; enforced at send).
  caps: { image: true, flf: true, el: 4 },
};
const MODEL_OPTS = {
  'bytedance/seedance-2.0/text-to-video': { ...SEEDANCE_OPTS, resolutions: ['480p', '720p', '1080p', '4k'], defRes: '720p' },
  'bytedance/seedance-2.0/fast/text-to-video': SEEDANCE_OPTS,
  // Mini also has reference-to-video (verified on fal 2026-07-15): image_urls +
  // video_urls + audio_urls, same @-tag binding as the bigger tiers — capped at 720p.
  'bytedance/seedance-2.0/mini/text-to-video': { ...SEEDANCE_OPTS },
  'fal-ai/kling-video/v3/pro/text-to-video': KLING_OPTS,
  'fal-ai/kling-video/v3/standard/text-to-video': KLING_OPTS,
  'google/gemini-omni-flash': {
    durations: range(3, 10), defDur: 8,
    ratios: ['16:9', '9:16'], defRatio: '16:9',
    // image: start frame → image-to-video (its own fal endpoint, no end frame).
    // clip: attach a video → conversational edit (swap/relight/stabilize/bg).
    caps: { image: true, end: false, avatar: false, clip: true },
  },
  'fal-ai/veo3.1': {
    durations: [4, 6, 8], defDur: 8,
    ratios: ['16:9', '9:16'], defRatio: '16:9',
    resolutions: ['720p', '1080p', '4k'], defRes: '720p',
    // Veo 3.1's three image-input endpoints as separate rows: image-to-video
    // (1), first-&-last frame (2), reference-to-video (≤3). clip → extend an
    // existing clip (continue/lengthen it).
    caps: { image: true, end: false, avatar: false, flf: true, ref: 3, clip: true },
  },
  // Veo 3.1 Fast — the same five endpoints and shapes as full Veo, ~2.7× cheaper.
  'fal-ai/veo3.1/fast': {
    durations: [4, 6, 8], defDur: 8,
    ratios: ['16:9', '9:16'], defRatio: '16:9',
    resolutions: ['720p', '1080p', '4k'], defRes: '720p',
    caps: { image: true, end: false, avatar: false, flf: true, ref: 3, clip: true },
  },
  // Luma Ray 3.2 — i2v takes image_url + end_image_url (start/end frames),
  // so both the single-image and first-&-last rows apply; no reference mode.
  // hdr: native-HDR render (2× price; +EXR sidecar 3×; 720p/1080p, 5s only).
  // loop: seamless-loop render (free; 5s, non-HDR, no end frame).
  // v2v: attach a video clip to re-render it (video-to-video, edit-mode dial).
  // kf: up to 64 keyframe images pinned along the timeline (evenly spaced).
  'luma/agent/ray/v3.2/text-to-video': {
    durations: [5, 10], defDur: 5,
    ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], defRatio: '16:9',
    resolutions: ['540p', '720p', '1080p'], defRes: '720p',
    hdr: true, loop: true, v2v: true,
    caps: { image: true, flf: true, kf: 64, clip: true },
  },
  // o3 (pro + standard): i2v start+end frames · reference-to-video (≤4 image
  // refs cited as @Image1-4 in the prompt, optionally with start/end frames) ·
  // clip → video-to-video edit (re-render, keeps source audio).
  'fal-ai/kling-video/o3/pro/text-to-video': {
    durations: range(3, 15), defDur: 5,
    ratios: ['16:9', '9:16', '1:1'], defRatio: '16:9',
    caps: { image: true, flf: true, ref: 4, el: 4, clip: true },
  },
  'fal-ai/kling-video/o3/standard/text-to-video': {
    durations: range(3, 15), defDur: 5,
    ratios: ['16:9', '9:16', '1:1'], defRatio: '16:9',
    caps: { image: true, flf: true, ref: 4, el: 4, clip: true },
  },
  // Lip-sync (audio-driven) models: no prompt, no duration/ratio/quality —
  // duration comes from the audio. OmniHuman = portrait + voice; Kling
  // LipSync = a source clip + voice.
  'fal-ai/bytedance/omnihuman': {
    noPrompt: true,
    hint: 'Add a portrait image + an audio clip — I’ll lip-sync them',
    caps: { image: true, end: false, avatar: false, audio: true },
  },
  // v1.5: same portrait+voice flow, plus a resolution tier (billed the same)
  // and optional typed text that guides the motion/emotion.
  'fal-ai/bytedance/omnihuman/v1.5': {
    noPrompt: true,
    hint: 'Add a portrait + an audio clip — optional text guides the motion',
    resolutions: ['720p', '1080p'], defRes: '1080p',
    caps: { image: true, end: false, avatar: false, audio: true },
  },
  // Attach a clip + a voice track → audio-driven lip-sync; attach a clip and
  // just TYPE the words instead → Kling voices them itself (pick the voice in
  // Settings). Same per-5s pricing either way.
  'fal-ai/kling-video/lipsync/audio-to-video': {
    noPrompt: true,
    hint: 'Add a video clip + audio — or type the words and pick a voice',
    voices: KLS_VOICES.map((v) => v.id), defVoice: 'reader_en_m-v1',
    voiceLabels: Object.fromEntries(KLS_VOICES.map((v) => [v.id, v.label])),
    voicePreview: false, // ElevenLabs previews don't apply to Kling voice ids
    caps: { image: false, end: false, avatar: false, audio: true, clip: true },
  },
};
const IMAGE_OPTS = { ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'], defRatio: '1:1' };
// Per-model ratio lists (verified against each fal schema): Nano Banana Pro
// accepts the full 10-ratio enum; GPT Image 2 sizes via image_size, so it keeps
// only the five ratios that map to its named presets. ('auto' is deliberately
// excluded — the worker's d:d gate drops it and the chat placeholder needs a
// concrete aspect.)
const IMAGE_RATIOS = {
  // 'auto' lets Nano pick the ratio from the prompt (text-to-image) and, on the
  // edit endpoint, keeps the SOURCE image's shape — so it's the safe default for
  // edits (a concrete ratio reframes/outpaints instead).
  'fal-ai/nano-banana-pro': ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '21:9'],
  'openai/gpt-image-2': ['1:1', '16:9', '9:16', '4:3', '3:4'],
};
// Per-model default aspect. Nano defaults to 'auto' (model picks / keeps source);
// everything else keeps the square default.
const IMAGE_DEF_RATIO = { 'fal-ai/nano-banana-pro': 'auto' };
// Per-model image quality/resolution switcher (reuses the video resolution
// section). Nano Banana Pro → Resolution 2K/4K (2K free default, 4K 2×). GPT
// Image 2 → Quality low/medium/high (high default) — quality swings fal's price
// hugely (low ≈ 1 credit vs high ≈ 28), so this is a real cost lever. Each
// entry: { label (section title), def, opts: [[value, chipLabel], …] }.
const IMAGE_RES = {
  'fal-ai/nano-banana-pro': { label: 'Resolution', def: '2K',   opts: [['2K', '2K'], ['4K', '4K']] },
  'openai/gpt-image-2':     { label: 'Quality',    def: 'high', opts: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']] },
};
// Image models that support editing (attach an image). MULTI ones take more
// than one image (so they also get the +Avatar reference picker).
const IMAGE_EDIT_MODELS = new Set([
  'fal-ai/nano-banana-pro', 'openai/gpt-image-2',
]);
const IMAGE_MULTI_MODELS = new Set([
  'fal-ai/nano-banana-pro', 'openai/gpt-image-2',
]);
// Models whose fal schema accepts num_images (verified against the OpenAPI docs).
const IMAGE_NUM_MODELS = new Set([
  'fal-ai/nano-banana-pro', 'openai/gpt-image-2',
]);
// Audio (voice) generation: no frames/ratio/resolution — a voice + the words to speak.
// audio:true surfaces the "+ Audio" upload picker (e.g. a clip to clone from later).
const AUDIO_OPTS = { voices: VOICES, defVoice: 'Rachel', caps: { image: false, end: false, avatar: false, audio: true } };

let duration = 5;
let ratio = '16:9';
let quality = '720p';
let voice = 'Rachel';
let numImages = 1; // per-image billing — always defaults back to 1
let gptSize = '1K'; // GPT Image 2 output resolution tier (1K/2K/4K)
// Each mode remembers its own model, so switching modes doesn't reset the pick.
const selectedModels = { ...DEFAULT_MODELS };
let model = selectedModels.video;
let mode = 'video';


const MODEL_LISTS = {
  video: [
    { id: 'fal-ai/veo3.1', label: 'Veo 3.1', note: 'Google · audio · extend', group: 'veo' },
    { id: 'fal-ai/veo3.1/fast', label: 'Veo 3.1 Fast', note: 'Google · cheaper · audio', group: 'veo' },
    { id: 'luma/agent/ray/v3.2/text-to-video', label: 'Ray 3.2', note: 'Luma · HDR · edit' },
    { id: 'bytedance/seedance-2.0/text-to-video', label: 'Seedance 2.0', note: 'audio', group: 'seedance' },
    { id: 'bytedance/seedance-2.0/fast/text-to-video', label: 'Seedance 2.0 Fast', note: 'audio', group: 'seedance' },
    { id: 'bytedance/seedance-2.0/mini/text-to-video', label: 'Seedance 2.0 Mini', note: 'cheapest · audio', group: 'seedance' },
    { id: 'fal-ai/kling-video/o3/pro/text-to-video', label: 'Kling o3 Pro', note: 'newest · edit', group: 'kling' },
    { id: 'fal-ai/kling-video/o3/standard/text-to-video', label: 'Kling o3 Standard', note: 'cheaper · edit', group: 'kling' },
    { id: 'fal-ai/kling-video/v3/pro/text-to-video', label: 'Kling 3.0 Pro', note: 'audio', group: 'kling' },
    { id: 'fal-ai/kling-video/v3/standard/text-to-video', label: 'Kling 3.0 Standard', note: 'audio', group: 'kling' },
    { id: 'fal-ai/kling-video/lipsync/audio-to-video', label: 'Kling LipSync', note: 'lip-sync', group: 'kling' },
    { id: 'google/gemini-omni-flash', label: 'Gemini Omni Flash', note: 'audio · edit' },
    { id: 'fal-ai/bytedance/omnihuman', label: 'OmniHuman', note: 'lip-sync', group: 'omnihuman' },
    { id: 'fal-ai/bytedance/omnihuman/v1.5', label: 'OmniHuman 1.5', note: 'lip-sync · 1080p', group: 'omnihuman' },
  ],
  image: [
    { id: 'fal-ai/nano-banana-pro', label: 'Nano Banana Pro', note: 'Google · flagship' },
    { id: 'openai/gpt-image-2', label: 'GPT Image 2', note: 'typography' },
  ],
  audio: [
    { id: 'fal-ai/elevenlabs/tts/eleven-v3', label: 'ElevenLabs v3', note: 'expressive' },
    { id: 'fal-ai/elevenlabs/tts/turbo-v2.5', label: 'ElevenLabs Turbo', note: 'fast' },
    { id: 'fal-ai/elevenlabs/tts/multilingual-v2', label: 'ElevenLabs Multilingual', note: '29 langs' },
  ],
};
// Families collapsed into one picker row (hover → side flyout with the variants).
// `variant` derives the short name shown on the parent when one is selected.
const GROUP_META = {
  seedance:  { label: 'Seedance 2.0', variant: (l) => l.replace(/^Seedance 2\.0\s*/, '').trim() || 'Standard' },
  kling:     { label: 'Kling',        variant: (l) => l.replace(/^Kling\s*/, '').trim() },
  veo:       { label: 'Veo 3.1',      variant: (l) => l.replace(/^Veo 3\.1\s*/, '').trim() || 'Standard' },
  omnihuman: { label: 'OmniHuman',    variant: (l) => l.replace(/^OmniHuman\s*/, '').trim() || '1.0' },
};

const modelMenu = document.getElementById('modelMenu');

const attachments = { image: null, avatar: null, end: null, audio: null, clip: null, ffirst: null, flast: null };
// Extra reference images beyond the first (multi-image models only).
const extraImages = [];
// Veo reference-to-video images (its own row, capped per model at caps.ref).
const refList = [];
// Kling character elements (@Element1-4): one frontal image per character.
const elList = [];
// Ray keyframes (≤64 images pinned along the clip's timeline, evenly spaced).
const kfList = [];
const ATTACH_LABELS = {
  image: '<span class="plus-big">+</span>',
  avatar: '<span class="plus-big">+</span>',
  audio: '+ Audio',
  clip: '+ Video clip',
  end: '<span class="plus-big">+</span>',
  ffirst: '<span class="plus-big">+</span><span class="slot-lab">First frame</span>',
  flast: '<span class="plus-big">+</span><span class="slot-lab">Last frame</span>',
};

function attachBtn(kind) {
  return document.getElementById('btn' + kind[0].toUpperCase() + kind.slice(1));
}

// Read an image file as a data URI, auto-conforming oversized ones: anything
// past the 8MB payload budget is redrawn at ≤3840px (the 4K-class ceiling —
// no model uses more pixels) and re-encoded as JPEG, stepping quality down
// until it fits. Our OWN 4K Nano outputs are 15-25MB PNGs, so without this
// the generate → re-attach → edit loop rejected the app's own files.
// Returns null only when the image can't be decoded/shrunk at all.
const IMG_BYTE_CAP = 8 * 1024 * 1024;
async function readImageConformed(file) {
  const raw = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(file); });
  if (typeof raw !== 'string') return null;
  if (file.size <= IMG_BYTE_CAP) return raw; // small enough — keep the original bytes
  const img = new Image();
  const loaded = await new Promise((ok) => { img.onload = () => ok(true); img.onerror = () => ok(false); img.src = raw; });
  if (!loaded || !img.width) return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  for (let edge = 3840; edge >= 1280; edge = Math.round(edge * 0.75)) {
    const scale = Math.min(1, edge / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.92, 0.85, 0.78]) {
      const out = canvas.toDataURL('image/jpeg', q);
      if (out.length <= IMG_BYTE_CAP * 1.34) return out; // data URI ≈ bytes × 1.34
    }
  }
  return null;
}
function tooBigMsg() { alert("Couldn't shrink that image enough — try a smaller file."); }

function onAttach(kind, inputEl) {
  const file = inputEl.files[0];
  inputEl.value = '';
  if (!file) return;
  // Images auto-conform (downscale/re-encode) below; clips and audio can't be
  // recompressed in the browser, so they keep a hard cap under the Worker's
  // base64 ceilings (data URI ≈ size × 1.34).
  if (kind === 'clip' || kind === 'audio') {
    if (file.size > 20 * 1024 * 1024) {
      alert('File too big — max 20 MB.');
      return;
    }
  } else {
    readImageConformed(file).then((uri) => {
      if (!uri) { tooBigMsg(); return; }
      attachments[kind] = uri;
      if (IMG_KINDS.includes(kind)) measureAttachedImage(kind, uri);
      renderAttach(kind);
      if (kind === 'image') {
        clearImageInputsExcept('image');
        renderExtraImages(); // the "+ Add image" tile appears once a main image is in
      } else if (kind === 'ffirst' || kind === 'flast') clearImageInputsExcept('flf');
      updateSendPrice();
    });
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    attachments[kind] = reader.result;
    if (kind === 'audio') {
      awName = (file.name || 'audio').replace(/[<>&"]/g, '');
      awSize = file.size || 0; awType = file.type || ''; // for per-model size/format limits
      if (awPlayer) { try { awPlayer.pause(); } catch (e) {} awPlayer = null; } // re-pick: drop the old clip's player
      awDur = 0; awPeaks = null; awDecoding = true; // clear the previous clip's duration/waveform until awDecode resolves — a send in this window must not bill the old length
      awDecode(reader.result);
    }
    if (kind === 'clip') { clipMeta = { dur: 0, w: 0, h: 0, type: file.type || '', name: file.name || 'clip' }; readClipMeta(reader.result); renderRefChips(); }
    // Image slots: measure dimensions and bounce anything the model hard-caps
    // (Kling: ≥300px, aspect 0.40–2.50) with the exact reason.
    if (IMG_KINDS.includes(kind)) measureAttachedImage(kind, reader.result);
    renderAttach(kind);
    // Keep the image-input modes mutually exclusive (see clearImageInputsExcept).
    if (kind === 'image') clearImageInputsExcept('image');
    else if (kind === 'ffirst' || kind === 'flast') clearImageInputsExcept('flf');
    // Any attachment can move the price: a clip flips into video-to-video, and a
    // start image / first-last frame flips Ray onto its cheaper i2v tier (and 5s).
    updateSendPrice();
  };
  reader.readAsDataURL(file);
}

// Attached video-clip metadata (duration + pixel size), read so a v2v edit can
// be checked against the target model's limits BEFORE it's submitted/charged —
// fal 422s (and used to still bill us) when the clip is out of spec.
let clipMeta = null;
function readClipMeta(dataUri) {
  const v = document.createElement('video');
  v.preload = 'metadata';
  v.muted = true;
  v.onloadedmetadata = () => {
    // Bail if this clip was swapped out while its metadata loaded — otherwise a
    // slow clip A's late callback would stamp its duration/dims onto clip B's
    // meta (wrong validation + wrong LipSync price).
    if (!clipMeta || attachments.clip !== dataUri) return;
    clipMeta.dur = v.duration || 0;
    clipMeta.w = v.videoWidth || 0;
    clipMeta.h = v.videoHeight || 0;
    try { v.src = ''; } catch (e) {}
    // Validate against the current model RIGHT NOW — an out-of-spec clip gets
    // rejected at attach (slot cleared + a message saying what to fix), not
    // discovered at send. The send-time check stays as the backstop for a
    // model switched AFTER attaching.
    const bad = clipIssue();
    if (bad) {
      attachments.clip = null;
      clipMeta = null;
      renderAttach('clip');
      updateSendPrice();
      addMsg('agent', '⚠️ ' + bad);
      return;
    }
    // Passed the basic checks — probe fps and quietly conform it if the model
    // requires a range the clip misses (see normalizeClipFps), and downscale
    // an over-resolution reference clip into the model's pixel band.
    normalizeClipFps();
    normalizeClipArea();
  };
  v.onerror = () => {}; // leave zeros — validation treats unknown as "can't verify", not a hard block
  v.src = dataUri;
}
// Per-model clip requirements for video-to-video edits, verified against each
// endpoint's fal OpenAPI schema (2026-07). Models absent here (Ray, Gemini)
// document no hard clip limits — anything they still reject is caught by the
// terminal-4xx auto-refund path.
const CLIP_LIMITS = {
  // kling-video/o3/pro/video-to-video/edit: mp4/mov, 3-15s, 720-3840px, 24-60fps, ≤200MB
  'fal-ai/kling-video/o3/pro/text-to-video': { minDur: 3, maxDur: 15, minPx: 720, maxPx: 3840, formats: ['mp4', 'mov'], fps: [24, 60] },
  'fal-ai/kling-video/o3/standard/text-to-video': { minDur: 3, maxDur: 15, minPx: 720, maxPx: 3840, formats: ['mp4', 'mov'], fps: [24, 60] },
  // veo3.1/extend-video: 720p/1080p in 16:9|9:16, input clip up to 8s
  'fal-ai/veo3.1': { maxDur: 8, minPx: 720, maxPx: 1920 },
  'fal-ai/veo3.1/fast': { maxDur: 8, minPx: 720, maxPx: 1920 },
  // kling-video/lipsync/audio-to-video: mp4/mov, 2-10s, 720-1920px, ≤100MB
  'fal-ai/kling-video/lipsync/audio-to-video': { minDur: 2, maxDur: 10, minPx: 720, maxPx: 1920, formats: ['mp4', 'mov'] },
  // gemini-omni-flash/edit renders (and fal bills) the WHOLE source clip and
  // its schema documents no cap — 30s is OUR cap so an edit can't silently
  // bill minutes of footage; billing assumes the same 30s max.
  'google/gemini-omni-flash': { maxDur: 30 },
  // Seedance @Video1 reference: mp4/mov, 2-15s, <50MB total, and a pixel-AREA
  // band of ~480p-720p (schema: "between ~480p (640x640) and ~720p (834x1112)"
  // — an area constraint: 0.41-0.93MP; 1280×720 fits, 1080p doesn't). Clips
  // over the band are downscaled on-device for free (normalizeClipArea);
  // under-band clips are rejected (upscaling can't add detail fal needs).
  // The clip is a REFERENCE (reference-to-video), not a re-render.
  'bytedance/seedance-2.0/text-to-video': { minDur: 2, maxDur: 15, minArea: 409600, maxArea: 927408, formats: ['mp4', 'mov'] },
  'bytedance/seedance-2.0/fast/text-to-video': { minDur: 2, maxDur: 15, minArea: 409600, maxArea: 927408, formats: ['mp4', 'mov'] },
  'bytedance/seedance-2.0/mini/text-to-video': { minDur: 2, maxDur: 15, minArea: 409600, maxArea: 927408, formats: ['mp4', 'mov'] },
};
// Check the attached clip against the current model's limits. Returns an error
// string to show the user, or '' when it's fine (or can't be verified).
function clipIssue() {
  if (mode !== 'video' || !attachments.clip) return '';
  const lim = CLIP_LIMITS[model];
  if (!lim || !clipMeta) return '';
  const { dur, w, h, type } = clipMeta;
  const fmtOk = !type || !lim.formats || lim.formats.some((f) => type.includes(f) || (f === 'mov' && type.includes('quicktime')));
  if (!fmtOk) return 'This model needs an ' + lim.formats.join(' or ') + ' clip. Re-export your video as MP4 and attach it again.';
  if (dur) {
    if (dur < lim.minDur) return 'That clip is ' + dur.toFixed(1) + 's — this model needs at least ' + lim.minDur + 's. Attach a longer clip.';
    // fal's own tolerance is 0.05s (its 422 says "maximum is 15.05 seconds") —
    // mirror it exactly. A looser grace here let a 15.3s clip pass this check
    // and die at fal's, which is how the whole 422 saga stayed hidden.
    if (dur > lim.maxDur + 0.05) return 'That clip is ' + dur.toFixed(2) + 's — this model maxes out at ' + lim.maxDur + 's (strict). Trim it to ' + lim.maxDur + 's or less and attach again.';
  }
  const shortSide = w && h ? Math.min(w, h) : 0;
  const longSide = w && h ? Math.max(w, h) : 0;
  if (lim.minPx && shortSide && shortSide < lim.minPx) return 'That clip is ' + w + '×' + h + ' — this model needs at least ' + lim.minPx + 'p on the short side. Use a higher-resolution clip.';
  if (lim.maxPx && longSide && longSide > lim.maxPx) return 'That clip is ' + w + '×' + h + ' — this model caps at ' + lim.maxPx + 'px. Use a smaller clip.';
  // Pixel-AREA floor (Seedance reference clips): below ~480p there isn't enough
  // detail for fal to reference — reject; ABOVE the band is handled by the free
  // on-device downscale (normalizeClipArea), so it's not an error here.
  if (lim.minArea && w && h && w * h < lim.minArea) return 'That clip is ' + w + '×' + h + ' — this model needs at least ~480p (' + lim.minArea.toLocaleString() + ' pixels per frame). Use a higher-resolution clip.';
  return '';
}

// ── Frame-rate conform (on-device, free) ──
// Some models hard-require an fps range (Kling o3 edit: 24-60) that fal
// enforces strictly — a 23.98fps download (most YouTube/film content) is
// rejected. A browser <video> can't report fps, so we probe with the on-device
// ffmpeg engine and, when out of range, quietly re-encode to the nearest bound.
// Serialized by token so a re-attach mid-conform can't clobber the newer clip.
let _clipFpsToken = 0;
async function normalizeClipFps() {
  const lim = CLIP_LIMITS[model];
  if (!lim || !lim.fps || mode !== 'video' || !attachments.clip) return;
  if (clipMeta && clipMeta.fpsOk) return; // already probed/conformed for this clip
  if (typeof sbFFProbeFps !== 'function' || !sbFFSupported()) return; // engine unavailable → fal's error net catches it
  const myToken = ++_clipFpsToken;
  const src = attachments.clip;
  let fps = 0;
  try { fps = await sbFFProbeFps(src, { mime: (clipMeta && clipMeta.type) || '' }); } catch { return; }
  if (myToken !== _clipFpsToken || attachments.clip !== src) return; // clip changed while probing
  if (!fps) return; // couldn't read — leave it to the error net
  const [lo, hi] = lim.fps;
  if (fps >= lo && fps <= hi) { if (clipMeta) clipMeta.fpsOk = true; return; }
  const target = fps < lo ? lo : hi;
  const note = addMsg('agent typing', 'Your clip is ' + fps.toFixed(2) + ' fps — this model needs ' + lo + '–' + hi + '. Conforming it to ' + target + ' fps on-device (free)');
  try {
    const blob = await sbFFFps(src, target, { mime: (clipMeta && clipMeta.type) || '' });
    const dataUri = await new Promise((ok, err) => {
      const r = new FileReader();
      r.onload = () => ok(r.result); r.onerror = err;
      r.readAsDataURL(blob);
    });
    note.remove();
    if (myToken !== _clipFpsToken || attachments.clip !== src) return; // user swapped clips mid-encode
    attachments.clip = dataUri;
    if (clipMeta) { clipMeta.type = 'video/mp4'; clipMeta.fpsOk = true; }
    renderAttach('clip');
    addMsg('agent', '⚙️ Fixed the frame rate: ' + fps.toFixed(2) + ' → ' + target + ' fps, re-encoded on-device (free). Ready to go.');
  } catch {
    note.remove();
    addMsg('agent', '⚠️ Your clip is ' + fps.toFixed(2) + ' fps and this model needs ' + lo + '–' + hi + ' fps — I couldn’t convert it here, so please re-export it at ' + lo + ' fps and attach again.');
  }
}

// ── Pixel-area conform (on-device, free) ──
// Seedance hard-caps reference clips at ~720p worth of pixels (area band in
// CLIP_LIMITS). A 1080p/4K phone clip would bounce at fal — instead, quietly
// downscale it on-device to fit the band, same free-conform pattern as the
// fps fix. Serialized by token so a re-attach mid-encode can't clobber the
// newer clip.
let _clipAreaToken = 0;
async function normalizeClipArea() {
  const lim = CLIP_LIMITS[model];
  if (!lim || !lim.maxArea || mode !== 'video' || !attachments.clip) return;
  if (!clipMeta || !clipMeta.w || !clipMeta.h) return; // dims unknown — fal's error net catches it
  const area = clipMeta.w * clipMeta.h;
  if (area <= lim.maxArea) return; // already inside the band
  if (typeof sbFFScale !== 'function' || !sbFFSupported()) return; // engine unavailable
  const myToken = ++_clipAreaToken;
  const src = attachments.clip;
  const note = addMsg('agent typing', 'Your clip is ' + clipMeta.w + '×' + clipMeta.h + ' — this model caps reference clips near 720p. Downscaling it on-device (free)');
  try {
    // Target just under the cap so rounding to even dims can't tip back over.
    const blob = await sbFFScale(src, clipMeta.w, clipMeta.h, lim.maxArea - 8000, { mime: clipMeta.type || '' });
    const dataUri = await new Promise((ok, err) => {
      const r = new FileReader();
      r.onload = () => ok(r.result); r.onerror = err;
      r.readAsDataURL(blob);
    });
    note.remove();
    if (myToken !== _clipAreaToken || attachments.clip !== src) return; // user swapped clips mid-encode
    attachments.clip = dataUri;
    // Re-read the conformed clip's real dims/duration (also re-validates).
    clipMeta = { dur: clipMeta.dur, w: 0, h: 0, type: 'video/mp4', name: clipMeta.name };
    readClipMeta(dataUri);
    renderAttach('clip');
    updateSendPrice();
    addMsg('agent', '⚙️ Downscaled your clip to fit this model’s reference band — re-encoded on-device (free). Ready to go.');
  } catch {
    note.remove();
    if (myToken !== _clipAreaToken || attachments.clip !== src) return;
    addMsg('agent', '⚠️ Your clip is ' + clipMeta.w + '×' + clipMeta.h + ' and this model caps reference clips near 720p — I couldn’t convert it here, so please re-export it at 720p or smaller and attach again.');
  }
}

// ── Image attachment limits ──
// Kling (o3 + v3) hard-caps every image input: ≥300×300px, aspect 0.40–2.50
// (10MB — already under the 8MB attach cap). Measured at attach; re-checked on
// model switch. Other families document no hard dims (Seedance 30MB only).
const IMG_KINDS = ['image', 'end', 'ffirst', 'flast'];
const imgMeta = {}; // kind → {w, h}
function imageLimitsFor() {
  return /kling-video/.test(model) ? { minPx: 300, arLo: 0.40, arHi: 2.50 } : null;
}
function imageAttachIssue(kind) {
  const lim = imageLimitsFor();
  const m = imgMeta[kind];
  if (!lim || !m || !m.w || !m.h) return '';
  if (m.w < lim.minPx || m.h < lim.minPx) return 'That image is ' + m.w + '×' + m.h + ' — this model needs at least ' + lim.minPx + '×' + lim.minPx + '. Use a bigger image.';
  const ar = m.w / m.h;
  if (ar < lim.arLo || ar > lim.arHi) return 'That image is ' + m.w + '×' + m.h + ' (aspect ' + ar.toFixed(2) + ') — this model accepts 0.40–2.50 (between 2:5 tall and 5:2 wide). Crop it closer to square.';
  return '';
}
function measureAttachedImage(kind, dataUri) {
  const img = new Image();
  img.onload = () => {
    if (attachments[kind] !== dataUri) return; // replaced while loading — don't stamp stale dims
    imgMeta[kind] = { w: img.naturalWidth, h: img.naturalHeight };
    const bad = imageAttachIssue(kind);
    if (bad) {
      attachments[kind] = null;
      delete imgMeta[kind];
      renderAttach(kind);
      addMsg('agent', '⚠️ ' + bad);
    }
  };
  img.onerror = () => {}; // unreadable → treated as unverifiable, error net catches
  img.src = dataUri;
}

// ── Audio slot: waveform bars (Wispr-Flow style, design B) ──
const AW_N = 40;
let awPeaks = null, awDur = 0, awName = '', awPlayer = null, awDecoding = false;
let awSize = 0, awType = ''; // attached audio's bytes + mime, for per-model limits

// Per-model driving-audio limits (lip-sync / Seedance audio refs), verified
// against each endpoint's fal schema. Duration in seconds, size in MB.
const AUDIO_LIMITS = {
  // lipsync/audio-to-video: .mp3 only, 2-60s, ≤5MB
  'fal-ai/kling-video/lipsync/audio-to-video': { minDur: 2, maxDur: 60, maxMB: 5, formats: ['mp3', 'mpeg'] },
  // omnihuman: audio must be under 30s
  'fal-ai/bytedance/omnihuman': { maxDur: 30 },
  'fal-ai/bytedance/omnihuman/v1.5': { maxDur: 30 },
  // seedance reference audio: MP3/WAV, ≤15s combined, ≤15MB per file
  'bytedance/seedance-2.0/text-to-video': { maxDur: 15, maxMB: 15, formats: ['mp3', 'mpeg', 'wav'] },
  'bytedance/seedance-2.0/fast/text-to-video': { maxDur: 15, maxMB: 15, formats: ['mp3', 'mpeg', 'wav'] },
  'bytedance/seedance-2.0/mini/text-to-video': { maxDur: 15, maxMB: 15, formats: ['mp3', 'mpeg', 'wav'] },
};
// Check the attached audio against the current model's limits (fal 422s a
// wrong-format / too-big / too-long driving track). Returns an error string or ''.
function audioIssue() {
  if (mode !== 'video' || !attachments.audio) return '';
  const lim = AUDIO_LIMITS[model];
  if (!lim) return '';
  if (lim.formats && awType && !lim.formats.some((f) => awType.includes(f))) {
    const names = lim.formats.filter((f) => f !== 'mpeg').join('/').toUpperCase();
    return 'This model needs ' + names + ' audio — convert your file and attach it again.';
  }
  if (lim.maxMB && awSize && awSize > lim.maxMB * 1024 * 1024) {
    return 'That audio is ' + (awSize / 1048576).toFixed(1) + ' MB — this model caps at ' + lim.maxMB + ' MB. Use a smaller or compressed file.';
  }
  if (awDur) {
    if (lim.minDur && awDur < lim.minDur) return 'That audio is ' + awDur.toFixed(1) + 's — this model needs at least ' + lim.minDur + 's.';
    if (lim.maxDur && awDur > lim.maxDur + 0.05) return 'That audio is ' + Math.round(awDur) + 's — this model caps at ' + lim.maxDur + 's. Trim it and attach again.';
  }
  return '';
}

// Decorative envelope for the empty slot; replaced by the real waveform once decoded.
function awPlaceholder(lo) {
  return Array.from({ length: AW_N }, (_, i) =>
    lo + (1 - lo) * Math.abs(Math.sin(i * 1.7)) * Math.sin((i / AW_N) * Math.PI));
}

function awBarsHtml(peaks, lit) {
  let s = '<span class="aw-bars' + (lit ? ' lit' : '') + '">';
  peaks.forEach((p) => { s += '<i style="height:' + Math.max(6, Math.round(p * 64)) + 'px"></i>'; });
  return s + '</span>';
}

// Decode the attached clip and reduce it to AW_N peak buckets.
async function awDecode(dataUrl) {
  let actx = null;
  try {
    const buf = await (await fetch(dataUrl)).arrayBuffer();
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const audio = await actx.decodeAudioData(buf);
    const ch = audio.getChannelData(0);
    const step = Math.max(1, Math.floor(ch.length / AW_N));
    const peaks = [];
    for (let i = 0; i < AW_N; i++) {
      let m = 0;
      for (let j = i * step; j < (i + 1) * step && j < ch.length; j += 40) m = Math.max(m, Math.abs(ch[j]));
      peaks.push(m);
    }
    const top = Math.max(...peaks, 0.01);
    awPeaks = peaks.map((p) => Math.pow(p / top, 0.7));
    awDur = audio.duration;
  } catch { awPeaks = null; awDur = 0; }
  finally { if (actx) { try { actx.close(); } catch {} } } // always release the context, even on a decode failure (browsers cap ~6)
  awDecoding = false;
  renderAttach('audio');
  updateSendPrice(); // lip-sync models bill by clip length — re-quote now that awDur is known
  // Reject an out-of-spec track at attach (wrong format / too big / too long)
  // with the exact reason, instead of a charge-and-422 at send.
  const bad = audioIssue();
  if (bad) {
    attachments.audio = null;
    awDur = 0; awPeaks = null; awSize = 0; awType = '';
    renderAttach('audio');
    updateSendPrice();
    addMsg('agent', '⚠️ ' + bad);
  }
}

// Live visualization: while playing, an analyser drives the bars with the
// actual audio; on pause/end they settle back to the decoded waveform.
let awCtx = null, awAnalyser = null, awRaf = 0, awWired = false;

function awStartViz() {
  if (!awPlayer) return;
  if (!awWired) {
    if (!awCtx) awCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = awCtx.createMediaElementSource(awPlayer);
    awAnalyser = awCtx.createAnalyser();
    awAnalyser.fftSize = 128;
    src.connect(awAnalyser);
    awAnalyser.connect(awCtx.destination);
    awWired = true;
  }
  awCtx.resume();
  const data = new Uint8Array(awAnalyser.frequencyBinCount);
  const loop = () => {
    if (!awPlayer || awPlayer.paused) return;
    awAnalyser.getByteFrequencyData(data);
    const bars = document.querySelectorAll('#rowAudio .aw-bars i');
    bars.forEach((b, i) => {
      const v = data[Math.floor((i / bars.length) * data.length * 0.75)] / 255;
      b.style.height = Math.max(6, Math.round(6 + Math.pow(v, 1.4) * 58)) + 'px';
    });
    awRaf = requestAnimationFrame(loop);
  };
  cancelAnimationFrame(awRaf);
  awRaf = requestAnimationFrame(loop);
}

function awStopViz() {
  cancelAnimationFrame(awRaf);
  const peaks = awPeaks || awPlaceholder(0.25);
  document.querySelectorAll('#rowAudio .aw-bars i').forEach((b, i) => {
    b.style.height = Math.max(6, Math.round(peaks[i] * 64)) + 'px';
  });
}

function awIcon() {
  const b = document.querySelector('.aw-play');
  if (b) b.textContent = awPlayer && !awPlayer.paused ? '❚❚' : '▶';
}

function awToggle(ev) {
  ev.stopPropagation();
  if (!attachments.audio) return;
  if (awPlayer && !awPlayer.paused) awPlayer.pause();
  else {
    if (!awPlayer) {
      awPlayer = new Audio(attachments.audio);
      awPlayer.onplay = () => { awStartViz(); awIcon(); };
      awPlayer.onpause = () => { awStopViz(); awIcon(); };
      awPlayer.onended = () => { awStopViz(); awIcon(); };
    }
    awPlayer.play().catch(() => {}); // a clip the browser can't decode shouldn't throw
  }
  awIcon();
}

function renderAudioSlot(btn) {
  if (attachments.audio) {
    btn.classList.add('has');
    const dur = Math.round(awDur || 0);
    const meta = (awName || 'audio') + (dur ? ' · ' + Math.floor(dur / 60) + ':' + String(dur % 60).padStart(2, '0') : '');
    btn.innerHTML = awBarsHtml(awPeaks || awPlaceholder(0.25), true)
      + '<span class="aw-play">▶</span>'
      + '<span class="aw-meta">' + meta + '</span>'
      + '<span class="x">×</span>';
    const play = btn.querySelector('.aw-play'); if (play) play.onclick = awToggle;
    const clr = btn.querySelector('.x'); if (clr) clr.onclick = (e) => clearAttach(e, 'audio');
  } else {
    btn.classList.remove('has');
    cancelAnimationFrame(awRaf);
    if (awPlayer) { awPlayer.pause(); awPlayer = null; }
    awWired = false; awAnalyser = null;
    awPeaks = null; awDur = 0; awName = '';
    btn.innerHTML = awBarsHtml(awPlaceholder(0.15), false) + '<span class="plus-big">+</span>';
  }
}

function renderAttach(kind) {
  const btn = attachBtn(kind);
  if (!btn) return;
  if (kind === 'audio') {
    renderAudioSlot(btn);
  } else if (attachments[kind]) {
    btn.classList.add('has');
    const preview = kind === 'clip'
      ? '<span class="audio-chip">🎬 clip</span>'
      : '<img src="' + esc(attachments[kind]) + '" alt="" />';
    // With several images attached, badge the main one as "1/<cap>" so the user
    // sees which image is #1 (the composer refers to images by position) and how
    // many the model can take. Only shown once there's more than one image.
    const imgCap = ((currentOpts() || {}).caps || {}).maxImages || 1;
    const num = (kind === 'image' && extraImages.length) ? '<span class="slot-num">1/' + imgCap + '</span>' : '';
    btn.innerHTML = preview + num + '<span class="x">×</span>';
    const clr = btn.querySelector('.x'); if (clr) clr.onclick = (e) => clearAttach(e, kind);
  } else {
    btn.classList.remove('has');
    btn.innerHTML = ATTACH_LABELS[kind];
  }
  const cnt = document.getElementById('cnt' + kind[0].toUpperCase() + kind.slice(1));
  if (cnt) {
    const n = kind === 'image'
      ? (attachments.image ? 1 : 0) + extraImages.length
      : (attachments[kind] ? 1 : 0);
    cnt.textContent = n ? '· ' + n : '';
  }
  // The first-&-last row shares one counter across its two frame slots.
  if (kind === 'ffirst' || kind === 'flast') {
  }
  // Attaching/removing a clip (video-to-video) or a source image (image edit)
  // flips whether this is an edit, where the effort picker no longer applies —
  // refresh its locked state.
  if (kind === 'clip' || kind === 'image') renderEffortLock();
  if (kind === 'image') renderMaskState(); // the GPT inpainting button follows the image
  updateApCounts(); // every single-slot change repaints the row headers' n/cap
}

function clearAttach(ev, kind) {
  ev.stopPropagation();
  attachments[kind] = null;
  // Removing the main image promotes the first extra ref so none orphan,
  // and the add-more slot re-renders (it keys off the main image).
  if (kind === 'image') {
    if (extraImages.length) attachments.image = extraImages.shift();
    renderExtraImages();
  }
  if (kind === 'audio') { awDur = 0; awPeaks = null; awSize = 0; awType = ''; }
  if (kind === 'clip') { clipMeta = null; renderRefChips(); } // dropping the clip exits v2v billing / clears the @Video1 chip
  delete imgMeta[kind];
  renderAttach(kind);
  updateSendPrice(); // any removal can move the tier/duration (esp. Ray i2v ↔ t2v)
}

// Show only the panel rows the current model actually supports (same rules
// as the old inline pickers), and clear anything a model can't use.
// Every attach-row header shows filled/cap ("0/14", "1/2") for the CURRENT
// model, so the limits are visible before anything is attached.
function updateApCounts() {
  const caps = (currentOpts() && currentOpts().caps) || {};
  const set = (id, n, cap) => { const el = document.getElementById(id); if (el) el.textContent = cap ? n + '/' + cap : ''; };
  set('cntImage', (attachments.image ? 1 : 0) + extraImages.length, caps.image ? (caps.maxImages || 1) : 0);
  set('cntAvatar', attachments.avatar ? 1 : 0, caps.avatar ? 1 : 0);
  set('cntAudio', attachments.audio ? 1 : 0, caps.audio ? 1 : 0);
  set('cntClip', attachments.clip ? 1 : 0, caps.clip ? 1 : 0);
  set('cntEnd', attachments.end ? 1 : 0, caps.end ? 1 : 0);
  set('cntFlf', (attachments.ffirst ? 1 : 0) + (attachments.flast ? 1 : 0), caps.flf ? 2 : 0);
  set('cntRef', refList.length, caps.ref || 0);
  set('cntEl', elList.length, caps.el || 0);
  set('cntKf', kfList.length, caps.kf || 0);
}

function updateAttachVisibility() {
  closeApInfo(); // rows are about to be re-shown/hidden — a tooltip pointing at one mustn't linger
  const caps = (currentOpts() && currentOpts().caps) || {};
  // No slots for this model → hide the whole panel, don't leave an empty box.
  const anySlot = !!(caps.image || caps.avatar || caps.audio || caps.clip || caps.end || caps.flf || caps.ref || caps.kf);
  const panel = document.getElementById('attachPanel');
  if (panel) panel.style.display = anySlot ? '' : 'none';
  [['image', caps.image], ['avatar', caps.avatar], ['audio', caps.audio], ['clip', caps.clip], ['end', caps.end]].forEach(([kind, ok]) => {
    const btn = attachBtn(kind);
    if (!btn) return;
    btn.style.display = ok ? '' : 'none';
    const row = document.getElementById('row' + kind[0].toUpperCase() + kind.slice(1));
    if (row) row.style.display = ok ? '' : 'none';
    // Clear an attachment the new model can't use — and its cached metadata, so
    // a later price/validation read can't trust a dead clip's/image's numbers.
    if (!ok && attachments[kind]) {
      attachments[kind] = null;
      if (kind === 'clip') clipMeta = null;
      if (kind === 'audio') { awDur = 0; awSize = 0; awType = ''; }
      delete imgMeta[kind];
      renderAttach(kind);
    }
  });
  // Switching models re-judges a kept clip against the NEW model's limits
  // (e.g. a 12s clip fine on Kling o3 is over Veo extend's 8s cap) — drop it
  // with the reason rather than let it ride to a doomed, charged submit.
  if (attachments.clip) {
    const bad = clipIssue();
    if (bad) {
      attachments.clip = null;
      clipMeta = null;
      renderAttach('clip');
      updateSendPrice();
      addMsg('agent', '⚠️ ' + bad);
    } else {
      // New model may demand an fps range or pixel band the old one didn't —
      // re-probe/conform both.
      if (clipMeta) clipMeta.fpsOk = false;
      normalizeClipFps();
      normalizeClipArea();
    }
  }
  // Kept images get re-judged against the NEW model's dimension caps too.
  IMG_KINDS.forEach((k) => {
    if (!attachments[k]) return;
    const bad = imageAttachIssue(k);
    if (bad) {
      attachments[k] = null;
      delete imgMeta[k];
      renderAttach(k);
      addMsg('agent', '⚠️ ' + bad);
    }
  });
  // First-&-last-frame row (two dedicated slots) — Veo's 2-frame input.
  const rowFlf = document.getElementById('rowFlf');
  if (rowFlf) rowFlf.style.display = caps.flf ? '' : 'none';
  if (!caps.flf) {
    ['ffirst', 'flast'].forEach((k) => { if (attachments[k]) { attachments[k] = null; renderAttach(k); } });
  }
  // Reference-to-video row (its own image list, capped at caps.ref).
  const rowRef = document.getElementById('rowRef');
  if (rowRef) rowRef.style.display = caps.ref ? '' : 'none';
  if (!caps.ref) refList.length = 0;
  else if (refList.length > caps.ref) refList.length = caps.ref;
  const rowEl = document.getElementById('rowEl');
  if (rowEl) rowEl.style.display = caps.el ? '' : 'none';
  if (!caps.el) elList.length = 0;
  else if (elList.length > caps.el) elList.length = caps.el;
  renderRefList();
  // Keyframes row (Ray: ≤64 timeline-pinned images).
  const rowKf = document.getElementById('rowKf');
  if (rowKf) rowKf.style.display = caps.kf ? '' : 'none';
  if (!caps.kf) kfList.length = 0;
  else if (kfList.length > caps.kf) kfList.length = caps.kf;
  renderKfList();
  // Multi-image slots follow the model's cap (Seedance refs take up to 9).
  const cap = caps.maxImages || 1;
  if (!caps.image) extraImages.length = 0;
  else if (extraImages.length > cap - 1) extraImages.length = Math.max(0, cap - 1);
  renderExtraImages();
  renderMaskState(); // the GPT inpainting button depends on model + single image
  updateApCounts();
}

// ── Attach panel (left of the thread): accordion rows ──
function toggleApRow(kind) {
  const row = document.getElementById('row' + kind[0].toUpperCase() + kind.slice(1));
  if (row) row.classList.toggle('open');
}

// One-line explainer for each input row. Info lives on the title itself —
// hover the dotted-underlined word (no separate ⓘ button). Keyed to data-info.
const AP_INFO = {
  imageVideo: 'Image-to-video: your image becomes the first frame, then animates forward from your prompt.',
  imageEdit: 'Attach an image to edit — describe the change and the model applies it to your picture.',
  avatar: 'Avatar: attach a face or character the model keeps looking consistent across the video.',
  audio: 'Audio: attach a voice or music track — used as the soundtrack or lip-sync source.',
  clip: 'Video clip: attach a video to extend, restyle, or use as motion reference.',
  end: 'End frame: pin the final frame — the model animates from your image toward it.',
  flf: 'First & last frame: pin the opening and closing frames — the model fills in the motion between them.',
  ref: 'Reference to video: images that keep a character or subject looking consistent in a new scene you describe.',
  kf: 'Keyframes: pin up to 64 images along the clip’s timeline — the video animates through them in order, spaced evenly across the duration. Your prompt sets the style and motion between them.',
};
function showApInfo(kind, ev, el) {
  const pop = document.getElementById('apInfoPop');
  if (!pop) return;
  // The Image row means image-to-video in video mode, but image editing in image mode.
  const key = kind === 'image' ? (mode === 'image' ? 'imageEdit' : 'imageVideo') : kind;
  let txt = AP_INFO[key];
  if (!txt) return;
  // Reference-capable models: teach the @ImageN syntax right where the refs live.
  if (kind === 'ref' && refTagBinding()) {
    txt += ' Cite them in your message as @Image1, @Image2… where each should appear — isibi makes sure the model gets them either way.';
  }
  pop.textContent = txt;
  pop.dataset.for = kind;
  const r = el.getBoundingClientRect();
  const w = 244;
  // Line the caret (::before at left:16px, ~5px half-width) up under the word.
  const left = (r.left + r.width / 2) - 21;
  pop.style.left = Math.max(12, Math.min(left, window.innerWidth - w - 12)) + 'px';
  pop.style.top = (r.bottom + 8) + 'px';
  pop.classList.add('open');
}
function closeApInfo() { const p = document.getElementById('apInfoPop'); if (p) { p.classList.remove('open'); p.dataset.for = ''; } }
// Any click dismisses the hover popover (e.g. the title click that toggles the row).
document.addEventListener('click', (e) => {
  const pop = document.getElementById('apInfoPop');
  if (pop && pop.classList.contains('open') && !e.target.closest('#apInfoPop')) closeApInfo();
});
// The popover is position:fixed off the word's rect — if the panel scrolls the
// title moves out from under it, so dismiss rather than let it float orphaned.
(function () {
  const ap = document.getElementById('attachPanel');
  if (ap) {
    ap.addEventListener('scroll', closeApInfo);
    // Info lives on the title: hover the dotted-underlined word to show it.
    ap.addEventListener('mouseover', (e) => {
      const t = e.target.closest('.ap-title[data-info]');
      if (t) showApInfo(t.dataset.info, e, t);
    });
    ap.addEventListener('mouseout', (e) => {
      const t = e.target.closest('.ap-title[data-info]');
      if (t && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.ap-title'))) closeApInfo();
    });
  }
  window.addEventListener('resize', closeApInfo);
  // Toggle the jump-to-latest chevron as the user scrolls the thread.
  const box = document.getElementById('messages');
  const thread = box && box.parentElement;
  if (thread) thread.addEventListener('scroll', () => updateScrollDown(thread), { passive: true });
})();

// ── Image source chooser: device files or the isibi gallery ──
let imgPickTarget = 'main'; // which slot the chosen image lands in

function openImgSrc(target, ev) {
  ev.stopPropagation();
  imgPickTarget = target;
  const menu = document.getElementById('imgSrcMenu');
  // Nano Banana Pro can pull a source image from your saved Avatars and
  // Products too, not just the gallery or a device file. Other models keep the
  // gallery + device options (their edit flows don't lean on avatars/products).
  const sources = [];
  if (model === 'fal-ai/nano-banana-pro') { sources.push(['avatar', 'Avatar'], ['product', 'Product']); }
  sources.push(['gallery', 'isibi gallery'], ['device', 'Your device']);
  menu.innerHTML = sources.map(([pick, label]) =>
    '<div class="model-item" data-act="img-pick" data-pick="' + pick + '"><span>' + label + '</span><span class="check">›</span></div>').join('');
  wireActions(menu); // bind the freshly-built items
  document.querySelectorAll('.model-menu.open').forEach((m) => { if (m !== menu) m.classList.remove('open'); });
  menu.classList.toggle('open');
}

function imgSrcPick(src, ev) {
  ev.stopPropagation();
  document.getElementById('imgSrcMenu').classList.remove('open');
  if (src === 'device') {
    document.getElementById(imgPickTarget === 'extra' ? 'fileExtra' : 'fileImage').click();
  } else {
    openGalleryPicker(src); // 'gallery' | 'avatar' | 'product'
  }
}

// Where each image source pulls from, and how its picker reads. Avatars and
// products are saved locally with an `image` field (data URI or URL).
const IMG_SOURCES = {
  gallery: { title: 'Pick from your gallery', empty: 'Nothing in your gallery yet — images you generate will show up here.', list: () => galleryImages() },
  avatar:  { title: 'Pick an avatar',         empty: 'No avatars yet — create or import one in the Avatar tab.',           list: () => loadAvatars().map((a) => a.image).filter(Boolean) },
  product: { title: 'Pick a product',         empty: 'No products yet — add one in the Products tab.',                    list: () => loadProducts().map((p) => p.image).filter(Boolean) },
};

// Images the user actually SAVED to their gallery — the authoritative storage
// list (serverGallery), same source the Gallery view renders. Only falls back
// to scanning chat media if that list hasn't loaded yet (openGalleryPicker
// loads it first, so the fallback is rare). Never a temp/unsaved link.
function galleryImages() {
  if (Array.isArray(serverGallery)) {
    return serverGallery
      .filter((o) => (o.kind || 'image') === 'image' && isSavedMedia(o.url))
      .sort((a, b) => (b.at || 0) - (a.at || 0))
      .map((o) => o.url);
  }
  const seen = new Set();
  const out = [];
  (chatStore.chats || []).forEach((c) => (c.msgs || []).forEach((m) => {
    if (m.t === 'media' && m.kind === 'image' && m.url && isSavedMedia(m.url) && !seen.has(m.url)) {
      seen.add(m.url);
      out.push({ url: m.url, at: m.at || 0 });
    }
  }));
  return out.sort((a, b) => b.at - a.at).map((x) => x.url);
}

async function openGalleryPicker(source) {
  const meta = IMG_SOURCES[source] || IMG_SOURCES.gallery;
  // The gallery source is the authoritative storage list — fetch it if this
  // session hasn't yet (otherwise galleryImages() falls back to a chat scan,
  // which is exactly the "picks from chats not the gallery" bug).
  if (source === 'gallery' && !Array.isArray(serverGallery)) await loadServerGallery();
  const old = document.querySelector('.gal-overlay');
  if (old) old.remove();
  const ov = document.createElement('div');
  ov.className = 'gal-overlay';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  const urls = meta.list();
  ov.innerHTML = '<div class="gal-box"><div class="gal-head"><span class="gal-title">' + esc(meta.title) + '</span>'
    + '<span class="gal-sub">' + (urls.length ? urls.length + (urls.length === 1 ? ' image' : ' images') : '') + '</span>'
    + '<button class="gal-close">×</button></div>'
    + (urls.length ? '<div class="gal-grid"></div>' : '<div class="gal-empty">' + esc(meta.empty) + '</div>') + '</div>';
  const closeBtn = ov.querySelector('.gal-close');
  if (closeBtn) closeBtn.onclick = () => ov.remove();
  // Build thumbnails with DOM APIs (never innerHTML) so a stored URL can't
  // break out of the src attribute and inject markup.
  const gridEl = ov.querySelector('.gal-grid');
  if (gridEl) urls.forEach((u) => {
    const img = document.createElement('img');
    img.alt = '';
    img.src = u;
    img.onclick = () => { useGalleryImage(u); ov.remove(); };
    gridEl.appendChild(img);
  });
  document.body.appendChild(ov);
}

// Fetch the stored image and attach it like a picked file (the API wants data URIs).
async function useGalleryImage(url) {
  try {
    const blob = await (await fetch(url)).blob();
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
    const cap = ((currentOpts() || {}).caps || {}).maxImages || 1;
    if (imgPickTarget === 'extra' && attachments.image) {
      if (extraImages.length < cap - 1) extraImages.push(dataUrl);
    } else {
      attachments.image = dataUrl;
      clearImageInputsExcept('image'); // keep image-input modes exclusive
    }
    renderAttach('image');
    renderExtraImages();
  } catch {
    alert("Couldn't load that image — try saving it to your device instead.");
  }
}

// Extra images beyond the first, for models that take several references.
function onAttachExtra(inputEl) {
  const files = Array.from(inputEl.files || []);
  inputEl.value = '';
  const cap = ((currentOpts() || {}).caps || {}).maxImages || 1;
  files.forEach((file) => {
    readImageConformed(file).then((uri) => {
      if (!uri) { tooBigMsg(); return; }
      if (!attachments.image) attachments.image = uri;
      else if (extraImages.length < cap - 1) extraImages.push(uri);
      renderAttach('image');
      renderExtraImages();
    });
  });
}

function removeExtraImage(i) {
  extraImages.splice(i, 1);
  renderExtraImages();
  renderAttach('image');
}

function renderExtraImages() {
  const host = document.getElementById('extraImages');
  if (!host) return;
  const cap = ((currentOpts() || {}).caps || {}).maxImages || 1;
  host.innerHTML = '';
  extraImages.forEach((src, i) => {
    const d = document.createElement('div');
    d.className = 'slot';
    // Position out of the max ("2/14", "3/14"): the main image is #1, extras
    // continue from #2. Lets the user see which image is which (the composer
    // refers to them by position) and how many more can be added.
    d.innerHTML = '<img src="' + esc(src) + '" alt="" /><span class="slot-num">' + (i + 2) + '/' + cap + '</span><span class="x">×</span>';
    d.querySelector('.x').onclick = () => removeExtraImage(i);
    host.appendChild(d);
  });
  const more = document.getElementById('btnMoreImages');
  if (more) {
    const cap = ((currentOpts() || {}).caps || {}).maxImages || 1;
    const total = (attachments.image ? 1 : 0) + extraImages.length;
    // Hide the add tile once the cap is reached (was a dead, clickable control at N/N).
    more.style.display = (cap > 1 && attachments.image && total < cap) ? '' : 'none';
    more.innerHTML = '<span class="plus-big">+</span><span class="slot-count">' + total + '/' + cap + '</span>';
  }
  updateApCounts();
  updateSendPrice(); // extra images can move the Ray tier
  renderMaskState(); // a second image disables inpainting (mask maps to one base)
}

// ── GPT Image 2 inpainting: paint the region to edit ──
// The mask fal wants is a black/white PNG at the SOURCE image's exact
// dimensions — WHITE where the model may edit, BLACK to keep pixel-perfect.
// The user paints the edit region on a fit-to-screen canvas; on save we render
// those strokes onto a full-resolution mask. Single-image GPT edits only (the
// mask maps to one base image).
let maskData = null; // the mask PNG data URI, or null when no region is set

function maskCapable() {
  return mode === 'image' && model === 'openai/gpt-image-2' &&
    !!attachments.image && extraImages.length === 0;
}
function clearMask() { maskData = null; renderMaskState(); updateSendPrice(); }
function renderMaskState() {
  const btn = document.getElementById('btnMask');
  if (!btn) return;
  const on = maskCapable();
  btn.style.display = on ? '' : 'none';
  if (!on && maskData) maskData = null; // model/attachment changed out from under a mask
  btn.classList.toggle('has-mask', !!maskData);
  btn.innerHTML = maskData
    ? '<span>✓ Edit area set</span><span class="mask-clear" data-act="mask-clear" title="Clear the edit area">✕</span>'
    : '🖌 Paint edit area';
  wireActions(btn);
}

function openMaskEditor() {
  const src = attachments.image;
  if (!src) return;
  const img = new Image();
  img.onload = () => {
    const nW = img.naturalWidth, nH = img.naturalHeight;
    if (!nW || !nH) return;
    const maxW = Math.min(window.innerWidth * 0.9, 760), maxH = window.innerHeight * 0.68;
    const scale = Math.min(maxW / nW, maxH / nH, 1);
    const dW = Math.round(nW * scale), dH = Math.round(nH * scale);

    const ov = document.createElement('div');
    ov.className = 'mask-overlay';
    ov.innerHTML =
      '<div class="mask-box">' +
        '<div class="mask-head"><span class="mask-title">Paint the area to edit</span>' +
          '<span class="mask-sub">Brush over what should change — the rest stays pixel-for-pixel.</span></div>' +
        '<div class="mask-stage" style="width:' + dW + 'px;height:' + dH + 'px">' +
          '<img class="mask-img" src="' + esc(src) + '" alt="" draggable="false" />' +
          '<canvas class="mask-paint" width="' + dW + '" height="' + dH + '"></canvas>' +
        '</div>' +
        '<div class="mask-tools">' +
          '<label class="mask-brush">Brush<input type="range" min="10" max="140" value="42" class="mask-size"></label>' +
          '<button class="mask-clearall" type="button">Clear</button>' +
          '<span class="mask-actions"><button class="mask-cancel" type="button">Cancel</button>' +
          '<button class="mask-save" type="button">Use this area</button></span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    const paint = ov.querySelector('.mask-paint');
    const pctx = paint.getContext('2d');
    // Full-res mask (black bg, white strokes) — this is what gets sent.
    const mcv = document.createElement('canvas');
    mcv.width = nW; mcv.height = nH;
    const mctx = mcv.getContext('2d');
    const resetMask = () => { mctx.fillStyle = '#000'; mctx.fillRect(0, 0, nW, nH); };
    resetMask();
    const k = nW / dW; // display → full-res

    let brush = 42, drawing = false, last = null, painted = false;
    ov.querySelector('.mask-size').oninput = (e) => { brush = +e.target.value; };
    const pt = (e) => {
      const r = paint.getBoundingClientRect();
      const t = e.touches && e.touches[0];
      return { x: (t ? t.clientX : e.clientX) - r.left, y: (t ? t.clientY : e.clientY) - r.top };
    };
    const seg = (ctx, a, b, w, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    };
    const stroke = (a, b) => {
      seg(pctx, a, b, brush, 'rgba(255,121,198,.55)'); // on-screen: translucent pink
      seg(mctx, { x: a.x * k, y: a.y * k }, { x: b.x * k, y: b.y * k }, brush * k, '#fff'); // mask: solid white
      painted = true;
    };
    const down = (e) => { e.preventDefault(); drawing = true; last = pt(e); stroke(last, last); };
    const move = (e) => { if (!drawing) return; e.preventDefault(); const p = pt(e); stroke(last, p); last = p; };
    const up = () => { drawing = false; };
    paint.addEventListener('mousedown', down);
    paint.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    paint.addEventListener('touchstart', down, { passive: false });
    paint.addEventListener('touchmove', move, { passive: false });
    paint.addEventListener('touchend', up);

    const close = () => { window.removeEventListener('mouseup', up); ov.remove(); };
    ov.querySelector('.mask-clearall').onclick = () => { pctx.clearRect(0, 0, dW, dH); resetMask(); painted = false; };
    ov.querySelector('.mask-cancel').onclick = close;
    ov.onclick = (e) => { if (e.target === ov) close(); };
    ov.querySelector('.mask-save').onclick = () => {
      maskData = painted ? mcv.toDataURL('image/png') : null; // no strokes → no mask
      renderMaskState(); updateSendPrice(); close();
    };
  };
  img.onerror = () => {};
  img.src = src;
}

// The three image-input modes — image-to-video, first-&-last frame, and
// reference-to-video — are mutually exclusive (one fal endpoint per generation),
// so filling one clears the others. Otherwise the worker's routing precedence
// would silently drop a staged input the user meant to use.
function clearImageInputsExcept(keep) {
  if (keep !== 'image' && attachments.image) { attachments.image = null; renderAttach('image'); }
  if (keep !== 'flf') {
    if (attachments.ffirst) { attachments.ffirst = null; renderAttach('ffirst'); }
    if (attachments.flast) { attachments.flast = null; renderAttach('flast'); }
  }
  if (keep !== 'ref' && refList.length) { refList.length = 0; renderRefList(); }
  if (keep !== 'kf' && kfList.length) { kfList.length = 0; renderKfList(); }
  if (keep !== 'el' && elList.length) { elList.length = 0; renderElList(); }
}

// Reference-to-video images (Veo ≤3, Seedance ≤9): its own row, capped at caps.ref.
function refCap() { return ((currentOpts() || {}).caps || {}).ref || 0; }
function onAttachRef(inputEl) {
  const files = Array.from(inputEl.files || []);
  inputEl.value = '';
  const cap = refCap();
  files.forEach((file) => {
    if (refList.length >= cap) return;
    readImageConformed(file).then((uri) => {
      if (!uri) { tooBigMsg(); return; }
      if (refList.length < cap) { refList.push(uri); clearImageInputsExcept('ref'); renderRefList(); }
    });
  });
}
function removeRef(i) { refList.splice(i, 1); renderRefList(); }
// Every reference-capable model gets @ImageN badges on its thumbnails so the
// user can cite them in the prompt. Seedance binds tags natively; for other
// families (Veo) the worker translates each @ImageN into plain "reference
// image N" wording the model understands.
function refTagBinding() { return mode === 'video' && !!refCap(); }
function renderRefList() {
  const host = document.getElementById('refImages');
  if (!host) return;
  host.innerHTML = '';
  const tagged = refTagBinding();
  refList.forEach((src, i) => {
    const d = document.createElement('div');
    d.className = 'slot';
    d.innerHTML = '<img src="' + esc(src) + '" alt="" />' +
      (tagged ? '<span class="slot-tag">@Image' + (i + 1) + '</span>' : '') +
      '<span class="x">×</span>';
    d.querySelector('.x').onclick = () => removeRef(i);
    host.appendChild(d);
  });
  const add = document.getElementById('btnRef');
  const cap = refCap();
  if (add) {
    add.style.display = refList.length < cap ? '' : 'none';
    add.innerHTML = '<span class="plus-big">+</span><span class="slot-count">' + refList.length + '/' + cap + '</span>';
  }
  updateApCounts();
  renderRefChips();
  updateSendPrice(); // references can move the tier on ref-capable models
}

// ── Character elements (Kling): each image is one character/object whose
// identity holds across the video, cited in the prompt as @Element1-4.
// Kept separate from style references (@ImageN) — fal treats them differently.
function elCap() { return ((currentOpts() || {}).caps || {}).el || 0; }
function onAttachEl(inputEl) {
  const files = Array.from(inputEl.files || []);
  inputEl.value = '';
  const cap = elCap();
  files.forEach((file) => {
    if (elList.length >= cap) return;
    readImageConformed(file).then((uri) => {
      if (!uri) { tooBigMsg(); return; }
      if (elList.length < cap) { elList.push(uri); clearImageInputsExcept('el'); renderElList(); }
    });
  });
}
function removeEl(i) { elList.splice(i, 1); renderElList(); }
function renderElList() {
  const host = document.getElementById('elImages');
  if (!host) return;
  host.innerHTML = '';
  elList.forEach((src, i) => {
    const d = document.createElement('div');
    d.className = 'slot';
    d.innerHTML = '<img src="' + esc(src) + '" alt="" />' +
      '<span class="slot-tag">@Element' + (i + 1) + '</span>' +
      '<span class="x">×</span>';
    d.querySelector('.x').onclick = () => removeEl(i);
    host.appendChild(d);
  });
  const add = document.getElementById('btnEl');
  const cap = elCap();
  if (add) {
    add.style.display = elList.length < cap ? '' : 'none';
    add.innerHTML = '<span class="plus-big">+</span><span class="slot-count">' + elList.length + '/' + cap + '</span>';
  }
  updateApCounts();
  renderRefChips();
  updateSendPrice();
}

// ── Keyframes (Ray): ≤64 images pinned along the clip's timeline ──
// Order = playback order; the worker spaces them evenly across the duration.
function kfCap() { return ((currentOpts() || {}).caps || {}).kf || 0; }
function onAttachKf(inputEl) {
  const files = Array.from(inputEl.files || []);
  inputEl.value = '';
  const cap = kfCap();
  files.forEach((file) => {
    if (kfList.length >= cap) return;
    readImageConformed(file).then((uri) => {
      if (!uri) { tooBigMsg(); return; }
      if (kfList.length < cap) { kfList.push(uri); clearImageInputsExcept('kf'); renderKfList(); }
    });
  });
}
function removeKf(i) { kfList.splice(i, 1); renderKfList(); }
function renderKfList() {
  const host = document.getElementById('kfImages');
  if (!host) return;
  host.innerHTML = '';
  kfList.forEach((src, i) => {
    const d = document.createElement('div');
    d.className = 'slot';
    d.innerHTML = '<img src="' + esc(src) + '" alt="" />' +
      '<span class="slot-tag">' + (i + 1) + '</span>' +
      '<span class="x">×</span>';
    d.querySelector('.x').onclick = () => removeKf(i);
    host.appendChild(d);
  });
  const add = document.getElementById('btnKf');
  const cap = kfCap();
  if (add) {
    add.style.display = kfList.length < cap ? '' : 'none';
    add.innerHTML = '<span class="plus-big">+</span><span class="slot-count">' + kfList.length + '/' + cap + '</span>';
  }
  updateApCounts();
  updateSendPrice(); // keyframes flip Ray onto its i2v tier — reprice
}

// ── Reference chips in the composer ──
// While references are attached (tag-binding context), the chatbox shows one
// clickable @ImageN chip per image — tap to drop that tag at the cursor, so
// writing "the character from @Image1…" never means memorizing the order.
// A clip on a Seedance model is a @Video1 reference (reference-to-video), so it
// gets a chip too — everywhere else a clip is an edit/extend, which has no tag.
function clipIsVideoRef() { return mode === 'video' && !!attachments.clip && /seedance/.test(model); }
function renderRefChips() {
  const composer = document.querySelector('#viewHome .composer');
  if (!composer) return;
  let bar = document.getElementById('refChips');
  const vidRef = clipIsVideoRef();
  const want = (refTagBinding() && refList.length) || elList.length || vidRef;
  if (!want) { if (bar) bar.remove(); return; }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'refChips';
    bar.className = 'ref-chips';
    composer.prepend(bar);
  }
  bar.innerHTML = '';
  refList.forEach((src, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ref-chip';
    chip.title = 'Insert @Image' + (i + 1) + ' into your message';
    chip.innerHTML = '<img src="' + esc(src) + '" alt="" />@Image' + (i + 1);
    chip.onclick = () => insertAtCursor('@Image' + (i + 1));
    bar.appendChild(chip);
  });
  elList.forEach((src, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ref-chip';
    chip.title = 'Insert @Element' + (i + 1) + ' into your message';
    chip.innerHTML = '<img src="' + esc(src) + '" alt="" />@Element' + (i + 1);
    chip.onclick = () => insertAtCursor('@Element' + (i + 1));
    bar.appendChild(chip);
  });
  if (vidRef) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ref-chip ref-chip-vid';
    chip.title = 'Insert @Video1 into your message';
    chip.innerHTML = '<span class="ref-chip-glyph">🎬</span>@Video1';
    chip.onclick = () => insertAtCursor('@Video1');
    bar.appendChild(chip);
  }
}
function insertAtCursor(tag) {
  const input = document.getElementById('input');
  if (!input) return;
  const s = input.selectionStart ?? input.value.length;
  const e = input.selectionEnd ?? s;
  const before = input.value.slice(0, s), after = input.value.slice(e);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  const tail = after && !/^\s/.test(after) ? ' ' : '';
  input.value = before + lead + tag + tail + after;
  const pos = (before + lead + tag + tail).length;
  input.setSelectionRange(pos, pos);
  input.focus();
  autoGrow(input);
}

// ── References in the chat thread ──
// When a message is sent with reference images, the thread shows a strip of
// small thumbnails under the user's bubble, each labeled with its @ImageN tag,
// so the conversation records WHICH image each cited tag pointed at.
function buildRefStrip(item) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-refs';
  (item.imgs || []).forEach((src, i) => {
    const s = document.createElement('span');
    s.className = 'mr-slot';
    s.innerHTML = '<img src="' + esc(src) + '" alt="" /><span class="mr-tag">@Image' + (i + 1) + '</span>';
    wrap.appendChild(s);
  });
  return wrap;
}
// Downscale a reference for the persisted copy — full-size data URLs would
// blow the localStorage chat budget (and the cross-device chat sync payload).
function shrinkRef(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 168;
      const k = Math.min(1, MAX / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = reject;
    img.src = src;
  });
}
async function pushRefStrip() {
  if (!refTagBinding() || !refList.length) return;
  let imgs = null;
  try { imgs = await Promise.all(refList.map(shrinkRef)); } catch {}
  if (!imgs || !imgs.length) return;
  const item = { t: 'refs', imgs, ts: Date.now() };
  pushSaved(item);
  threadAppend(buildRefStrip(item));
}

// Provider identity per model id: real logo where we have one, monogram otherwise.
// `tint` is the provider's brand colour — used to give each row's icon tile and
// accents a splash of life instead of one flat grey.
function providerOf(id) {
  if (/nano-banana/.test(id)) return { logo: '/logos/nanobanana.svg', name: 'Nano Banana', tint: '#f5b423' };
  if (/gemini/.test(id)) return { logo: '/logos/gemini.svg', name: 'Gemini', tint: '#6c7cff' };
  if (/sora/.test(id)) return { logo: '/logos/sora.svg', name: 'OpenAI', tint: '#10a37f' };
  if (/gpt-image|^openai\//.test(id)) return { logo: '/logos/openai.svg', name: 'OpenAI', tint: '#10a37f' };
  if (/veo|^google\//.test(id)) return { logo: '/logos/google.svg', name: 'Google', tint: '#4285f4' };
  if (/seedance|seedream|bytedance/.test(id)) return { logo: '/logos/bytedance.svg', name: 'ByteDance', tint: '#3c8cff' };
  if (/kling/.test(id)) return { logo: '/logos/kling.svg', name: 'Kling', tint: '#ff6a2b' };
  if (/hailuo|minimax/.test(id)) return { logo: '/logos/hailuo.svg', name: 'MiniMax', tint: '#6a5bff' };
  if (/grok|^xai\//.test(id)) return { logo: '/logos/grok.svg', name: 'xAI', tint: '#c9ccd4' };
  if (/elevenlabs/.test(id)) return { logo: '/logos/elevenlabs.svg', name: 'ElevenLabs', tint: '#a6b0c0' };
  if (/flux/.test(id)) return { logo: '/logos/flux.svg', name: 'Black Forest Labs', tint: '#f0585d' };
  if (/recraft/.test(id)) return { logo: '/logos/recraft.svg', name: 'Recraft', tint: '#7b6bff' };
  if (/krea/.test(id)) return { logo: '/logos/krea.svg', name: 'Krea', tint: '#ff5c8a' };
  if (/^luma\/|\/ray\//.test(id)) return { mono: 'L', name: 'Luma', tint: '#3fe0d0' };
  return { mono: '·', name: '', tint: '#8a8a92' };
}

function modelChips(id) {
  const chips = [];
  const o = MODEL_OPTS[id];
  if (o && o.resolutions) {
    const top = o.resolutions[o.resolutions.length - 1];
    chips.push('🏷 ' + (top === '4k' ? '4K' : top));
  }
  if (o && o.durations) chips.push('⏱ ' + o.durations[0] + 's–' + o.durations[o.durations.length - 1] + 's');
  if (o && o.noPrompt) chips.push('⏱ from audio');
  return chips;
}

function buildMenu() {
  if (!modelMenu) return;
  if (typeof hideFlyoutNow === 'function') hideFlyoutNow();
  modelMenu.innerHTML = '';
  model = selectedModels[mode] || DEFAULT_MODELS[mode];

  const search = document.createElement('input');
  search.className = 'm-search';
  search.placeholder = 'Search…';
  search.onclick = (e) => e.stopPropagation();
  search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    modelMenu.querySelectorAll('.m-row').forEach((r) => {
      r.style.display = !q || r.dataset.search.includes(q) ? '' : 'none';
    });
  };
  modelMenu.appendChild(search);

  const section = document.createElement('div');
  section.className = 'm-section';
  section.textContent = '✦ Featured models';
  modelMenu.appendChild(section);

  // Render rows, collapsing families (group) into one parent row that opens a
  // side flyout on hover; everything else renders as a normal row.
  const emitted = new Set();
  MODEL_LISTS[mode].forEach((m) => {
    if (m.group) {
      if (emitted.has(m.group)) return;
      emitted.add(m.group);
      modelMenu.appendChild(buildGroupRow(m.group, MODEL_LISTS[mode].filter((x) => x.group === m.group)));
    } else {
      modelMenu.appendChild(buildModelRow(m, false));
    }
  });
  // Guard against a selected id that isn't in this mode's list (e.g. a persisted
  // pick from another mode) — fall back to the default rather than throwing.
  const cur = MODEL_LISTS[mode].find((m) => m.id === model) || MODEL_LISTS[mode].find((m) => m.id === DEFAULT_MODELS[mode]) || MODEL_LISTS[mode][0];
  document.getElementById('modelLabel').textContent = cur ? cur.label : 'Auto';
}

// One picker row for a single model. `variant` → rendered inside a group flyout.
function buildModelRow(m, variant) {
  const prov = providerOf(m.id);
  const d = document.createElement('div');
  d.className = 'model-item m-row' + (variant ? ' m-variant' : '') + (m.id === model ? ' selected' : '');
  d.dataset.model = m.id;
  d.dataset.label = m.label;
  d.dataset.search = (m.label + ' ' + prov.name + ' ' + (m.note || '')).toLowerCase();
  const notes = (m.note || '').split('·').map((t) => t.trim()).filter(Boolean);
  const hasAudio = notes.includes('audio');
  const badges = notes
    .filter((t) => !['audio', 'Google', 'OpenAI', 'ByteDance', 'MiniMax', 'Luma'].includes(t))
    .map((t) => t === 'newest'
      ? '<span class="m-badge">NEW</span>'
      : '<span class="m-tag' + (/cheap/i.test(t) ? ' cheap' : '') + '">' + t.toUpperCase() + '</span>')
    .join('');
  const chips = modelChips(m.id).map((c) => '<span class="m-chip">' + c + '</span>').join('');
  d.style.setProperty('--prov', prov.tint || '#8a8a92');
  const icoInner = prov.logo
    ? '<img class="m-logo" src="' + prov.logo + '" alt="" draggable="false">'
    : '<b>' + (prov.mono || '·') + '</b>';
  d.innerHTML =
    '<span class="m-ico">' + icoInner + '</span>'
    + '<span class="m-main">'
    +   '<span class="m-title">' + m.label + (hasAudio ? ' <span class="spk">🔊</span>' : '') + badges + '</span>'
    +   (chips ? '<span class="m-chips">' + chips + '</span>' : '')
    + '</span>'
    + '<span class="check">✓</span>';
  d.onclick = () => pickModel(d);
  return d;
}

// Collapsed family row: shows the family + which variant is active; hover (or
// tap) opens a side flyout listing the variants.
function buildGroupRow(key, variants) {
  const meta = GROUP_META[key] || { label: key };
  const prov = providerOf(variants[0].id);
  const active = variants.find((v) => v.id === model);
  const d = document.createElement('div');
  d.className = 'model-item m-row m-group' + (active ? ' selected' : '');
  d.dataset.group = key;
  d.dataset.search = (meta.label + ' ' + prov.name + ' ' + variants.map((v) => v.label).join(' ')).toLowerCase();
  d.style.setProperty('--prov', prov.tint || '#8a8a92');
  const icoInner = prov.logo
    ? '<img class="m-logo" src="' + prov.logo + '" alt="" draggable="false">'
    : '<b>' + (prov.mono || '·') + '</b>';
  const activeShort = active ? (meta.variant ? meta.variant(active.label) : active.label) : '';
  d.innerHTML =
    '<span class="m-ico">' + icoInner + '</span>'
    + '<span class="m-main">'
    +   '<span class="m-title">' + meta.label + (activeShort ? ' <span class="m-active">' + activeShort + '</span>' : '') + '</span>'
    +   '<span class="m-chips"><span class="m-chip m-count">' + variants.length + ' models</span></span>'
    + '</span>'
    + '<span class="m-caret">›</span>';
  d.addEventListener('mouseenter', () => showFlyout(d, variants));
  d.addEventListener('mouseleave', hideFlyoutSoon);
  d.onclick = (e) => { e.stopPropagation(); showFlyout(d, variants); };
  return d;
}

// Shared side flyout for family variants, positioned next to the hovered row.
let _flyout, _flyoutHideT;
function getFlyout() {
  if (!_flyout) {
    _flyout = document.createElement('div');
    _flyout.className = 'model-flyout';
    _flyout.addEventListener('mouseenter', () => clearTimeout(_flyoutHideT));
    _flyout.addEventListener('mouseleave', hideFlyoutSoon);
    document.body.appendChild(_flyout);
  }
  return _flyout;
}
function showFlyout(groupRow, variants) {
  const fly = getFlyout();
  clearTimeout(_flyoutHideT);
  fly.innerHTML = '';
  variants.forEach((m) => fly.appendChild(buildModelRow(m, true)));
  fly.style.visibility = 'hidden';
  fly.style.display = 'block';
  const r = groupRow.getBoundingClientRect();
  const fw = fly.offsetWidth, fh = fly.offsetHeight;
  let left = r.right + 6;
  if (left + fw > window.innerWidth - 8) left = Math.max(8, r.left - fw - 6);
  const top = Math.max(8, Math.min(r.top, window.innerHeight - fh - 8));
  fly.style.left = left + 'px';
  fly.style.top = top + 'px';
  fly.style.visibility = 'visible';
}
function hideFlyoutSoon() { clearTimeout(_flyoutHideT); _flyoutHideT = setTimeout(hideFlyoutNow, 180); }
function hideFlyoutNow() { clearTimeout(_flyoutHideT); if (_flyout) _flyout.style.display = 'none'; }

function setMode(m) {
  mode = m;
  document.querySelectorAll('.mode-btn').forEach((b) => {
    const on = b.dataset.mode === m;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  buildMenu();
  document.getElementById('input').placeholder =
    m === 'image' ? 'Describe your image…' :
    m === 'audio' ? 'Type what you want the voice to say…' :
    'Describe your scene…';
  buildOptMenus();
  stampComposer();
}

// Effort picker (top-left of the main chat) — how detailed the director's
// written prompt gets. Persisted per browser.
const EFFORT_KEY = 'zephyr_effort';
const EFFORT_LABELS = { low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra High', max: 'Max' };
let effort = EFFORT_LABELS[localStorage.getItem(EFFORT_KEY)] ? localStorage.getItem(EFFORT_KEY) : 'medium';
function setEffort(level) {
  effort = level;
  localStorage.setItem(EFFORT_KEY, level);
  document.querySelectorAll('.effort-item').forEach((i) =>
    i.classList.toggle('selected', i.dataset.effort === level));
  document.getElementById('effortLabel').textContent = EFFORT_LABELS[level];
  document.getElementById('effortMenu').classList.remove('open');
  updateSendPrice(); // High+ runs the Sonnet director → +1 credit on the tag
  stampComposer();
}
// Web search (Settings toggle). When on, a request the director judges to
// need current real-world facts triggers a billed web-search step before the
// prompt is written. Default on; users can switch it off in Settings.
// Shown in Settings → About.
const APP_VERSION = '1.0.0';
// Prompt-help mode chip (top-right of the composer). Three modes:
//   auto — isibi.ai composes and makes every creative call, never asks
//   plan — isibi.ai interviews first (the question popup), then composes
//   off  — raw prompting: the text goes to the model exactly as typed,
//          and the director surcharge disappears from the price
// The orchestrator (the Sonnet/Haiku layer) is now an explicit on/off switch on
// the builder page. When OFF, directorMode is 'off' (raw prompting — words go to
// the model as typed, no Sonnet in the loop). When ON, the Auto/Plan chip picks
// how it behaves; Plan only exists while the orchestrator is on.
const DIR_MODE_KEY = 'zephyr_director_mode';
const DIR_MODES = {
  auto: { icon: '', label: 'Auto', desc: 'isibi.ai writes the prompt and generates right away' },
  plan: { icon: '', label: 'Plan', desc: 'isibi.ai shows you the plan to approve before generating' },
  off:  { icon: '</>', label: 'Raw', desc: 'No prompt help — your words go to the model exactly as typed' },
};
// Default OFF (free raw prompting) — the Orchestrator spends credits per call,
// so users opt in via the switch. A saved preference (if any) still wins.
let directorMode = DIR_MODES[localStorage.getItem(DIR_MODE_KEY)] ? localStorage.getItem(DIR_MODE_KEY) : 'off';
// The last Auto/Plan choice, so flipping the switch back on restores it.
let lastOrchMode = directorMode === 'off' ? 'auto' : directorMode;
function orchestratorOn() { return directorMode !== 'off'; }
// The AI Orchestrator (the Sonnet/Haiku director) is available to everyone —
// it's metered through regular credits per call (see /api/direct), not a
// subscription. So it's simply on/off via the builder switch (directorMode);
// orchActive() stays as a helper (always true) so the on/off call-sites read
// naturally. A broke user's call 402s server-side and falls back to raw.
function orchActive() { return true; }
function renderOrchSwitch() {
  const on = orchestratorOn();
  const sw = document.getElementById('orchSwitch');
  if (sw) {
    sw.classList.toggle('on', on);
    sw.classList.remove('locked');
    sw.setAttribute('aria-checked', on ? 'true' : 'false');
    sw.title = 'Orchestrator — isibi reads your message, picks the model and writes the prompt (spends credits per use). Off = raw prompting, free.';
    const ctl = sw.closest('.orch-ctl');
    if (ctl) { ctl.classList.toggle('on', on); ctl.classList.remove('locked'); }
  }
  const chip = document.getElementById('dirModeChip');
  if (chip) chip.style.display = on ? '' : 'none'; // Auto/Plan only when on
}
function toggleOrchestrator() {
  if (orchestratorOn()) { lastOrchMode = directorMode; setDirectorMode('off'); }
  else setDirectorMode(lastOrchMode || 'auto');
}
function renderDirChip() {
  const el = document.getElementById('dirModeChip');
  if (!el) return;
  const m = DIR_MODES[directorMode];
  el.innerHTML = (m.icon ? '<span class="ae-icon">' + esc(m.icon) + '</span>' : '') +
    '<span class="ae-label">' + m.label + '</span>';
  document.querySelectorAll('#dirMenu .dir-item').forEach((i) =>
    i.classList.toggle('selected', i.dataset.mode === directorMode));
}
function setDirectorMode(m) {
  directorMode = m;
  if (m !== 'off') lastOrchMode = m; // remember the Auto/Plan choice
  localStorage.setItem(DIR_MODE_KEY, m);
  renderDirChip();
  renderOrchSwitch();
  renderEffortLock();
  document.getElementById('dirMenu').classList.remove('open');
  updateSendPrice(); // raw mode drops the director surcharge from the tag
  stampComposer();
}
function toggleDirMenu(e) {
  e.stopPropagation();
  if (!orchActive() || !orchestratorOn()) return; // chip is hidden unless subscribed + on
  const menu = document.getElementById('dirMenu');
  document.querySelectorAll('.model-menu.open').forEach((m) => { if (m !== menu) m.classList.remove('open'); });
  menu.classList.toggle('open');
}
(function buildDirMenu() {
  const menu = document.getElementById('dirMenu');
  if (!menu) return;
  for (const key of ['auto', 'plan']) { // off is the switch now, not a menu item
    const m = DIR_MODES[key];
    const it = document.createElement('div');
    it.className = 'model-item dir-item';
    it.dataset.mode = key;
    it.innerHTML = '<span class="txt"><b>' + (m.icon ? esc(m.icon) + ' ' : '') + m.label + '</b><small>' + m.desc + '</small></span><span class="check">✓</span>';
    it.onclick = () => setDirectorMode(key);
    menu.appendChild(it);
  }
  renderDirChip();
  renderOrchSwitch();
  renderEffortLock();
})();

// Preset categories shown as top tabs on the Home page. Each card is a full
// RIG, not just a label: a director-grade prompt plus the model/ratio/duration/
// resolution it runs best on — applied automatically when the pinned chip is
// sent (applyPresetRig). Model picks follow docs/MODELS.md family strengths.
const PRESET_CATS = [
  { key: 'marketing', label: 'Marketing', items: [
    { label: 'Product hero ad', kind: 'video', desc: 'Slick 360° commercial of your product.',
      model: 'bytedance/seedance-2.0/text-to-video', ratio: '16:9', dur: 8, res: '720p',
      prompt: 'Premium photoreal product commercial of [your product] on a seamless dark studio backdrop. One continuous shot: the product on a slow 360° turntable, dramatic key light with a soft warm rim, glossy reflections gliding across its surface, shallow depth of field, a subtle sheen of atmosphere. Mid-rotation a gentle push-in tightens toward the label until it reads clean and sharp, then the turn completes into a still, centered hero packshot held for the final second. High-end tech-ad aesthetic, tasteful motion blur, no on-screen text or watermarks; the product stays intact and undeformed throughout.' },
    { label: 'UGC testimonial', kind: 'video', desc: 'Authentic selfie-style hype.',
      model: 'bytedance/seedance-2.0/text-to-video', ratio: '9:16', dur: 10, res: '720p',
      prompt: 'Handheld selfie-style UGC video, vertical 9:16: a relatable person in a bright everyday room holds [your product] up to the camera and talks to the lens with genuine enthusiasm, natural daylight from a window, slight handheld sway, casual authentic energy — like a friend recommending it. They gesture at the product once, glance at it, then back to camera with a nod and a smile. Phone-camera realism, natural skin tones, no on-screen text or watermarks; the product label stays readable whenever it faces the lens.' },
    { label: 'Sale announcement', kind: 'image', desc: 'Bold promo graphic with a headline.',
      model: 'openai/gpt-image-2', ratio: '1:1',
      prompt: 'Bold square promotional graphic announcing a sale for [your product]: a big punchy headline reading "50% OFF" in heavy modern type, the product featured prominently below it, vibrant brand colors with high contrast, clean geometric layout with clear hierarchy — headline, product, small supporting line "this week only". Flat studio lighting on the product, crisp edges, social-feed ready; all text spelled exactly as written.' },
    { label: 'Lifestyle shot', kind: 'image', desc: 'Aspirational product-in-use photo.',
      model: 'fal-ai/nano-banana-pro', ratio: '3:4',
      prompt: 'Editorial lifestyle photograph of [your product] being used naturally in a bright, aspirational setting — soft morning window light, warm neutral palette, styled surfaces with tasteful props, a hint of human presence (hands, a sleeve). Shallow depth of field keeps the product tack-sharp with its label legible while the scene falls into a creamy blur. Magazine quality, natural shadows, no text or watermarks.' },
    { label: 'Product Animation', kind: 'video', desc: 'Show your product in motion.',
      model: 'bytedance/seedance-2.0/text-to-video', ratio: '16:9', dur: 10, res: '720p',
      prompt: 'Photoreal exploded-view product animation of [your product]: the product hangs centered in a rich dark gradient void, then separates into its individual components in slow synchronized motion — every part suspended mid-air in perfect formation, rotating subtly, dramatic rim light tracing each piece against the glow. The camera drifts slowly through the suspended field, then every component glides back along its own path and reassembles seamlessly into the intact product, ending on a locked hero shot with the label clean and readable for the final second. Premium engineering-ad aesthetic, tasteful motion blur, no text or watermarks; parts move rigidly and never deform.' },
    { label: 'From product URL', kind: 'video', desc: 'Paste a store link — isibi does the rest.',
      urlScan: true, model: 'bytedance/seedance-2.0/text-to-video', ratio: '9:16', dur: 10, res: '720p',
      prompt: 'Premium photoreal vertical social ad built around the attached product image — the product is the hero and must faithfully match the attachment: container, colors, label. Open on a tight appetizing detail of the product, then one elegant continuous camera move pulls back to reveal it centered in a styled scene that matches its category and vibe, warm premium lighting with a soft rim, subtle atmosphere. Settle into a final hero framing with the label clean and readable for the last two seconds. Ad-grade and concrete, no on-screen text or watermarks; the product stays intact and undeformed.' },
  ] },
  { key: 'cinematic', label: 'Cinematic', items: [
    { label: 'Epic establishing shot', kind: 'video', desc: 'Sweeping golden-hour drone.',
      model: 'fal-ai/veo3.1', ratio: '16:9', dur: 8, res: '720p',
      prompt: 'Sweeping cinematic aerial establishing shot over [location] at golden hour: the camera glides forward and slowly rises, volumetric god-rays cutting through haze, long warm shadows stretching across the landscape, anamorphic lens flares kissing the frame edges. Epic scale with layered depth — foreground silhouettes, midground detail, glowing horizon. Filmic color grade with rich ambers and deep teals, gentle wind movement in trees or water, 24fps motion cadence, no text or watermarks.' },
    { label: 'Slow-mo hero', kind: 'video', desc: 'Dramatic slow-motion close-up.',
      model: 'fal-ai/veo3.1',
      prompt: 'Ultra slow-motion cinematic close-up of [subject], locked-off camera: dramatic single-source side lighting carves the form out of darkness, dust particles drift and glint through the beam, micro-movements read in exquisite detail — fabric settling, hair lifting, a slow turn toward the light. Shallow depth of field, moody high-contrast grade with soft film grain, one continuous shot with no cuts, no text or watermarks.' },
    { label: 'Noir scene', kind: 'image', desc: 'Neon rain-slicked film noir.',
      model: 'fal-ai/nano-banana-pro', ratio: '16:9',
      prompt: 'Film-noir cinematic still: [subject] in a rain-slicked neon alley at night, hard chiaroscuro lighting splitting the face between shadow and a cyan-magenta neon glow, wet asphalt mirroring the signs, steam rising from a grate, atmospheric haze catching the light. Teal and amber palette, deep blacks with detail preserved, anamorphic framing with foreground bokeh, subtle film grain — a single frame that implies a whole story.' },
  ] },
  { key: 'product', label: 'Product', items: [
    { label: 'Studio pack shot', kind: 'image', desc: 'Clean e-commerce white-bg shot.',
      model: 'fal-ai/nano-banana-pro', ratio: '1:1',
      prompt: 'Clean studio product photograph of [your product] on pure white seamless: soft even wraparound lighting with a gentle top key, crisp natural reflection beneath the product, every edge sharp and true to form, label perfectly legible and undistorted. Centered composition with balanced negative space, true-to-life color, e-commerce catalog standard — no props, no text, no watermarks, no shadows harsher than a soft contact shadow.' },
    { label: 'Floating product', kind: 'video', desc: 'Product rotating in a dark void.',
      model: 'luma/agent/ray/v3.2/text-to-video', ratio: '1:1', dur: 5, res: '720p',
      prompt: '[Your product] floating weightlessly in a dark premium studio void, slowly rotating in place: dramatic rim lighting traces its silhouette, soft specular reflections glide across the surface as it turns, faint particles drift in the depth behind it. The rotation is smooth and continuous, the camera locked, the mood expensive and calm. The label passes through full legibility mid-turn. Deep blacks, controlled highlights, no text or watermarks; the product stays rigid and undeformed.' },
    { label: 'Macro detail', kind: 'image', desc: 'Extreme close-up of texture.',
      model: 'fal-ai/nano-banana-pro', ratio: '1:1',
      prompt: 'Extreme macro photograph of [your product]: razor-thin depth of field isolating one exquisite detail — surface texture, material grain, an edge where two materials meet — with controlled specular highlights tracing the form. The rest falls into smooth darkness. Lighting is a single soft key with a whisper of rim, colors true to the product, detail rendered at the threshold of what a real macro lens resolves. No text or watermarks.' },
  ] },
  { key: 'social', label: 'Social', items: [
    { label: 'Reel intro', kind: 'video', desc: 'Fast vertical hook with text.',
      model: 'bytedance/seedance-2.0/fast/text-to-video', ratio: '9:16', dur: 5, res: '720p',
      prompt: 'Fast-paced vertical 9:16 social intro for [your brand]: 3 quick cuts — a whip-pan into the product, a punch-in beat, then bold kinetic text slamming in reading exactly "NEW DROP" with a subtle shake on impact. Energetic handheld feel, trendy speed-ramps between cuts, bold saturated brand colors, hard flash frames on the transitions. The text stays pinned and spelled exactly as written; ends on product + text locked for the final beat. No watermarks.' },
    { label: 'Story background', kind: 'image', desc: '9:16 background with text room.',
      model: 'fal-ai/nano-banana-pro', ratio: '9:16',
      prompt: 'Eye-catching vertical 9:16 story background: abstract flowing gradient shapes in a pink-to-amber palette over near-black, soft grain, gentle glow where the shapes overlap, generous calm negative space through the middle third left intentionally empty for text overlay. Modern, clean, on-brand design — no text, no logos, no watermarks, nothing busy near the center.' },
    { label: 'Carousel cover', kind: 'image', desc: 'Scroll-stopping post cover.',
      model: 'openai/gpt-image-2', ratio: '1:1',
      prompt: 'Scroll-stopping square social post cover about [topic]: one bold headline reading exactly "[your headline]" in heavy condensed type filling the upper half, a single striking visual anchoring the lower half, high-contrast two-tone palette with one accent color, clean margins, strong visual hierarchy built to be read in under a second on a phone. All text spelled exactly as written; no watermarks.' },
  ] },
  { key: 'portrait', label: 'Portrait', items: [
    { label: 'Studio headshot', kind: 'image', desc: 'Corporate-clean headshot.',
      model: 'fal-ai/nano-banana-pro', ratio: '3:4',
      prompt: 'Professional studio headshot portrait of [subject]: soft wrapped key light with a subtle rim separating them from a neutral seamless background, eyes tack-sharp and engaged with the camera, natural authentic skin texture (no plastic smoothing), relaxed confident expression, shoulders angled slightly. Corporate-clean grade, true skin tones, gentle falloff — LinkedIn-ready. No text or watermarks.' },
    { label: 'Cinematic portrait', kind: 'image', desc: 'Moody single-light portrait.',
      model: 'fal-ai/nano-banana-pro', ratio: '3:4',
      prompt: 'Cinematic character portrait of [subject]: one dramatic single-source light raking across the face from the side, half in shadow, catchlight alive in the near eye, shallow depth of field melting the background into darkness. Moody teal-shadow amber-highlight grade, subtle film grain, imperfect and human — a frame from a film that doesn’t exist. No text or watermarks.' },
    { label: 'Fashion editorial', kind: 'image', desc: 'Magazine-cover styling.',
      model: 'fal-ai/nano-banana-pro', ratio: '3:4',
      prompt: 'High-fashion editorial portrait of [subject]: bold styling and a striking deliberate pose, hard studio strobe with a crisp shadow thrown on a colored seamless backdrop, fabric caught mid-movement, jewelry and textures rendered sharp. Confident magazine-cover composition with headroom for a masthead, saturated yet controlled palette, skin real and luminous. No text or watermarks.' },
  ] },
  { key: 'anime', label: 'Anime', items: [
    { label: 'Anime key art', kind: 'image', desc: 'Vibrant cel-shaded hero art.',
      model: 'fal-ai/nano-banana-pro', ratio: '3:4',
      prompt: 'Vibrant anime key-art illustration of [character]: dynamic three-quarter action pose with strong silhouette, clean confident linework, cel shading with two-step shadows and bright rim light, expressive eyes, hair and clothing caught mid-motion. A detailed but softly-blurred background pushes the character forward; saturated studio-quality palette with atmospheric light effects. No text or watermarks.' },
    { label: 'Chibi sticker', kind: 'image', desc: 'Cute flat-color sticker.',
      model: 'fal-ai/nano-banana-pro', ratio: '1:1',
      prompt: 'Cute chibi anime sticker of [character]: oversized head and tiny body, huge expressive eyes, one clear exaggerated emotion, thick clean outline with a white sticker border, flat bright colors with minimal two-tone shading, simple empty background ready for a transparent cutout. Kawaii, instantly readable at small size. No text or watermarks.' },
    { label: 'Anime scene', kind: 'video', desc: 'Gently animated anime shot.',
      model: 'fal-ai/veo3.1',
      prompt: 'Anime-style animated scene of [subject] with gentle ambient motion: hair and clothes swaying in a soft breeze, blinking and small natural movements, background elements drifting in subtle parallax — petals, clouds, or light particles. The art style is preserved exactly with no smoothing or realism drift, colors stay flat and cel-shaded, camera locked or drifting almost imperceptibly. One continuous calm shot, no text or watermarks.' },
  ] },
];
let presetCat = 'marketing';
// Builds the preset tabs + card grid into any container. `rerender` is called
// when a category tab is clicked so the caller can repaint just its own host
// (keeps surrounding chrome — e.g. the Home greeting — intact).
function renderPresetsInto(body, rerender) {
  if (!body) return;
  const tabs = PRESET_CATS.map((c) =>
    '<button type="button" class="pt-tab' + (c.key === presetCat ? ' active' : '') + '" data-cat="' + c.key + '">' + esc(c.label) + '</button>').join('');
  const cat = PRESET_CATS.find((c) => c.key === presetCat) || PRESET_CATS[0];
  // Clean amber line-icons per kind (stroke:currentColor, tinted by .pt-ico).
  const svg = (paths) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  const kindIco = (k) => k === 'image'
    ? svg('<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15.5l-4.5-4.5L5.5 21"/>')
    : k === 'audio'
      ? svg('<rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 18v3.5"/>')
      : svg('<path d="M3 8.5h18V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5Z"/><path d="M3 8.5l2.4-4h3.2L6.2 8.5m4 0l2.4-4h3.2L13 8.5m4 0l2.4-4h1.4"/>');
  const cards = cat.items.map((it, i) => {
    const first = Array.isArray(it.previews) && it.previews.length ? it.previews[0] : null;
    const prev = first
      ? '<span class="pt-prev"><img src="' + esc(first) + '" alt="" loading="lazy" /></span>'
      : '<span class="pt-prev pt-prev-ph pt-ph' + (i % 4) + '"></span>';
    return '<button type="button" class="pt-card" data-i="' + i + '">' +
      prev +
      '<span class="pt-foot">' +
        '<span class="pt-ico">' + kindIco(it.kind) + '</span>' +
        '<span class="pt-meta"><span class="pt-card-t">' + esc(it.label) + '</span>' +
        '<span class="pt-card-s">' + esc(it.desc || '') + '</span></span>' +
        '<span class="pt-try">Try</span>' +
      '</span>' +
    '</button>';
  }).join('');
  body.innerHTML = '<div class="pt-tabs">' + tabs + '</div><div class="pt-grid">' + cards + '</div>';
  body.querySelectorAll('.pt-tab').forEach((t) => { t.onclick = () => { presetCat = t.dataset.cat; rerender(); }; });
  body.querySelectorAll('.pt-card').forEach((card) => { card.onclick = () => usePreset(cat.items[+card.dataset.i]); });
}
// Clicking a preset card pins it as a removable CHIP in the Home chatbox
// (owner's call, 2026-07-12 — like "3D object generation ×"): the user types
// just their idea, and the preset's prompt rides along as creative direction
// when they send. × unpins. The card's kind also picks the matching mode.
let lpPreset = null;
function usePreset(it) {
  if (!it) return;
  if (it.kind && it.kind !== mode && typeof setMode === 'function') setMode(it.kind);
  lpPreset = it;
  renderLpChip();
  const box = document.getElementById('lpInput');
  if (box) {
    box.placeholder = it.urlScan
      ? 'Paste the product page URL — isibi reads it and builds the ad…'
      : 'Your idea — the “' + it.label + '” preset shapes it…';
    box.focus();
    box.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
}
function clearLpPreset() {
  lpPreset = null;
  renderLpChip();
  const box = document.getElementById('lpInput');
  if (box) box.placeholder = 'Describe a video, image, or a voice line — isibi takes it from here…';
}
// The machinery behind a preset card: apply its rig — mode, model, and the
// settings it runs best on — right before the send fires. Every value is
// validated against what the model actually supports, so a stale rig can
// never produce an invalid generation.
function applyPresetRig(it) {
  if (!it) return;
  if (it.kind && it.kind !== mode && typeof setMode === 'function') setMode(it.kind);
  if (it.model && MODEL_LISTS[mode] && MODEL_LISTS[mode].some((m) => m.id === it.model) && model !== it.model) {
    selectedModels[mode] = it.model;
    buildMenu();      // commits `model` + repaints the picker label
    buildOptMenus();  // resets settings to the new model's defaults
  }
  const opts = currentOpts() || {};
  if (it.ratio && opts.ratios && opts.ratios.includes(it.ratio)) ratio = it.ratio;
  if (it.dur && opts.durations && opts.durations.includes(it.dur)) duration = it.dur;
  if (it.res && opts.resolutions && opts.resolutions.includes(it.res)) quality = it.res;
  updateSettingsSummary();
  updateSendPrice();
}
function renderLpChip() {
  const host = document.getElementById('lpChipHost');
  const hint = document.getElementById('lpHint');
  if (!host) return;
  host.innerHTML = '';
  if (hint) hint.style.display = lpPreset ? 'none' : '';
  if (!lpPreset) return;
  const chip = document.createElement('span');
  chip.className = 'lp-chip';
  chip.innerHTML = '<b>' + esc(lpPreset.label) + '</b><button type="button" class="lp-chip-x" aria-label="Remove preset">×</button>';
  chip.querySelector('.lp-chip-x').onclick = clearLpPreset;
  host.appendChild(chip);
}

// An edit of attached media — a clip in video mode (video-to-video) or a
// source image in image mode (image editing) — makes the director write a short
// edit instruction, so the effort/depth ladder (which only shapes written
// from-scratch prompts) does not apply. NB: a start image for image-to-video is
// NOT an edit — the model generates new motion — so that keeps the ladder.
function isEditMode() {
  return (mode === 'video' && !!attachments.clip) || (mode === 'image' && !!attachments.image);
}
function toggleEffortMenu(e) {
  e.stopPropagation();
  if (directorMode === 'off' || !orchActive() || isEditMode()) return; // raw / no add-on / edit: effort has nothing to control
  const menu = document.getElementById('effortMenu');
  document.querySelectorAll('.model-menu.open').forEach((m) => { if (m !== menu) m.classList.remove('open'); });
  menu.classList.toggle('open');
}
// The effort picker only shapes the prompt isibi.ai writes, so it greys out in
// raw mode AND when the AI Orchestrator add-on isn't active (no writer at all).
function renderEffortLock() {
  const pick = document.querySelector('.effort-pick');
  if (!pick) return;
  const subbed = orchActive();
  const edit = isEditMode();
  const off = directorMode === 'off' || !subbed || edit;
  pick.classList.toggle('locked', off);
  pick.querySelector('.opt-btn').title = !subbed
    ? 'Effort is part of the AI Orchestrator add-on ($19.99/mo)'
    : edit
    ? 'Effort is for written prompts — an edit just takes a short instruction'
    : directorMode === 'off'
    ? 'Effort applies when isibi.ai writes the prompt — turn the orchestrator on to use it'
    : 'How detailed the written prompt gets';
  if (off) document.getElementById('effortMenu').classList.remove('open');
}
setEffort(effort);

function currentOpts() {
  if (mode === 'audio') return AUDIO_OPTS;
  if (mode === 'image') {
    return {
      ratios: IMAGE_RATIOS[model] || IMAGE_OPTS.ratios, defRatio: IMAGE_DEF_RATIO[model] || IMAGE_OPTS.defRatio,
      resolutions: IMAGE_RES[model] ? IMAGE_RES[model].opts.map((o) => o[0]) : null,
      resItems: IMAGE_RES[model] ? IMAGE_RES[model].opts.map(([value, label]) => ({ value, label })) : null,
      resLabel: IMAGE_RES[model] ? IMAGE_RES[model].label : 'Resolution',
      defRes: IMAGE_RES[model] ? IMAGE_RES[model].def : '2K',
      // GPT Image 2 output resolution tier (separate axis from its Quality) —
      // 1K uses the ratio's named preset; 2K/4K send explicit larger dimensions.
      sizes: model === 'openai/gpt-image-2' ? ['1K', '2K', '4K'] : null, defSize: '1K',
      nums: IMAGE_NUM_MODELS.has(model) ? [1, 2, 3, 4] : null,
      caps: {
        // The "Image" row IS the multi-image picker (main + "+ Add image" up to
        // maxImages). No separate avatar slot in image mode — it duplicated the
        // Image row and was mislabeled "Avatar" (a video-only concept). All
        // references go through Image, capped at 14 — Nano Banana Pro's
        // documented max ("combine up to 14 images in a single composition").
        image: IMAGE_EDIT_MODELS.has(model), end: false, avatar: false,
        maxImages: IMAGE_MULTI_MODELS.has(model) ? 14 : 1,
      },
    };
  }
  return MODEL_OPTS[model];
}

// Voice preview: generate a short line in the chosen voice once, then cache
// it (keyed by model+voice) so replays and re-tests are instant and free.
const voicePreviewCache = {};
let previewAudio = null;
let previewing = false; // in-flight guard: the preview control is a <span>, so btn.disabled is a no-op

function stopPreview() {
  if (previewAudio) { previewAudio.pause(); previewAudio.currentTime = 0; }
  document.querySelectorAll('.voice-test.playing, .set-voicebtn.playing').forEach((b) => {
    b.classList.remove('playing'); b.textContent = '▶';
  });
}

async function previewVoice(name, btn) {
  stopPreview();
  const key = model + '|' + name;
  if (voicePreviewCache[key]) { playPreview(voicePreviewCache[key], btn); return; }
  if (previewing) return; // a live TTS preview is already generating — don't spend a second credit
  previewing = true;

  btn.disabled = true;
  btn.textContent = '…';
  try {
    // Committed static previews (/voices/<name>.mp3) are free — prefer them
    // over spending a live TTS call.
    try {
      const staticUrl = '/voices/' + name.toLowerCase() + '.mp3';
      const head = await fetch(staticUrl, { method: 'HEAD' });
      if (head.ok && (head.headers.get('content-type') || '').startsWith('audio')) {
        voicePreviewCache[key] = staticUrl;
        playPreview(staticUrl, btn);
        return;
      }
    } catch {}
    const res = await apiFetch('/api/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // director:'off' — a preview runs no prompt writer, so it must not pay the
      // director surcharge on top of the TTS credit.
      body: JSON.stringify({ model, prompt: "Hi, I'm " + name + ". This is how I sound.", voice: name, director: 'off' }),
    });
    const job = await res.json();
    if (!res.ok || !job.status_url) throw new Error('start');

    const started = Date.now();
    let out = null;
    while (Date.now() - started < 90 * 1000) {
      const sr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(job.status_url));
      const st = await sr.json();
      if (st.status === 'COMPLETED') {
        const rr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(job.response_url));
        out = await rr.json();
        break;
      }
      if (['FAILED', 'ERROR', 'CANCELED', 'CANCELLED'].includes(st.status)) break; // don't spin the full 90s on a dead job
      await new Promise((r) => setTimeout(r, 1500));
    }
    const url = out && (out.audio?.url || out.audio_url || out.audio_file?.url || out.data?.audio?.url);
    if (!url) throw new Error('no audio');
    voicePreviewCache[key] = url;
    playPreview(url, btn);
  } catch {
    btn.textContent = '⚠';
    setTimeout(() => { btn.textContent = '▶'; }, 1600);
  } finally {
    btn.disabled = false;
    previewing = false;
  }
}

function playPreview(url, btn) {
  if (!previewAudio) previewAudio = new Audio();
  previewAudio.src = url;
  btn.classList.add('playing');
  btn.textContent = '♪';
  previewAudio.onended = () => { btn.classList.remove('playing'); btn.textContent = '▶'; };
  previewAudio.play().catch(() => { btn.classList.remove('playing'); btn.textContent = '▶'; });
}

// HDR render toggle (models with opts.hdr — Ray 3.2). 2× price; 720p/1080p 5s only.
let hdrOn = false;
// EXR sidecar export (requires HDR; 3× price total).
let exrOn = false;
// Seamless-loop render (free; 5s, non-HDR, no end frame).
let loopOn = false;
// Video-to-video edit mode when a clip is attached: 'auto' lets the model
// derive conditioning from the source; adhere/flex/reimagine dial how far the
// re-render may stray from it.
let editMode = 'auto';

// One "Settings" panel groups every option (aspect ratio / resolution /
// duration / images / voice) into sections, filtered to what the current model
// supports. Values reset to this model's defaults on each rebuild.
function buildOptMenus() {
  const panel = document.getElementById('settingsMenu');
  const wrap = document.getElementById('settingsWrap');
  if (!panel || !wrap) return;
  const opts = currentOpts() || {}; // a model id missing from MODEL_OPTS must not throw here

  // reset to this model's defaults — skipped while a chat's saved composer
  // state is being restored (the restorer already validated its own values)
  if (!restoringComp) {
    if (opts.durations) duration = opts.defDur;
    if (opts.resolutions) quality = opts.defRes;
    if (opts.sizes) gptSize = opts.defSize;
    if (opts.ratios) ratio = opts.defRatio;
    if (opts.nums) numImages = 1;
    if (opts.voices) voice = opts.defVoice;
    hdrOn = false; exrOn = false; loopOn = false; editMode = 'auto';
  }

  const sections = [];
  if (opts.ratios) sections.push(settingSection('Aspect ratio', 'ratio', opts.ratios.map((r) => ({ value: r, label: r }))));
  if (opts.resolutions) sections.push(settingSection(opts.resLabel || 'Resolution', 'quality', opts.resItems || opts.resolutions.map((q) => ({ value: q, label: q }))));
  if (opts.sizes) sections.push(settingSection('Resolution', 'gptSize', opts.sizes.map((s) => ({ value: s, label: s }))));
  if (opts.durations) sections.push(settingSection('Duration', 'duration', opts.durations.map((d) => ({ value: d, label: d + 's' }))));
  if (opts.hdr) sections.push(settingSection('HDR', 'hdr', [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On · 2×' }, { value: 'exr', label: 'On + EXR · 3×' }]));
  if (opts.loop) sections.push(settingSection('Seamless loop', 'loop', [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]));
  if (opts.v2v) sections.push(settingSection('Clip edit mode', 'editMode', [{ value: 'auto', label: 'Auto' }, { value: 'adhere', label: 'Adhere' }, { value: 'flex', label: 'Flex' }, { value: 'reimagine', label: 'Reimagine' }]));
  if (opts.nums) sections.push(settingSection('Images', 'num', opts.nums.map((n) => ({ value: n, label: n === 1 ? '1 image' : n + ' images' }))));
  if (opts.voices) sections.push(settingSection('Voice', 'voice', opts.voices.map((v) => ({ value: v, label: (opts.voiceLabels || {})[v] || v })), opts.voicePreview !== false));

  wrap.style.display = sections.length ? '' : 'none';
  panel.innerHTML = sections.join('');
  if (!sections.length) panel.classList.remove('open');

  // Keep the panel open while adjusting — stop clicks from reaching the
  // document-level "close menus" handler.
  panel.querySelectorAll('.set-chip').forEach((chip) => {
    chip.onclick = (e) => { e.stopPropagation(); pickSetting(chip); };
  });
  panel.querySelectorAll('.set-voicebtn').forEach((btn) => {
    btn.onclick = (e) => { e.stopPropagation(); previewVoice(btn.dataset.voice, btn); };
  });
  panel.querySelectorAll('.set-viewall').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const open = btn.closest('.set-section').classList.toggle('expanded');
      btn.textContent = open ? 'View less' : 'View all';
    };
  });
  updateSettingsSummary();

  document.getElementById('input').placeholder = opts.hint ||
    (mode === 'image' ? 'Describe your image…' :
     mode === 'audio' ? 'Type what you want the voice to say…' :
     'Describe your scene…');
  updateAttachVisibility();
  updateSendPrice();
}

// A settings section: a label + selectable chips. Long lists (>6) collapse
// behind a "View all" toggle.
function settingSection(label, kind, items, isVoice) {
  const cur = { ratio: ratio, quality: quality, gptSize: gptSize, duration: duration, num: numImages, voice: voice, hdr: exrOn ? 'exr' : hdrOn ? 'on' : 'off', loop: loopOn ? 'on' : 'off', editMode: editMode }[kind];
  const collapsible = items.length > 6;
  const chips = items.map((it) => {
    const active = String(it.value) === String(cur) ? ' active' : '';
    if (isVoice) {
      return '<button type="button" class="set-chip' + active + '" data-kind="voice" data-value="' + esc(it.value) + '">' +
        '<span>' + esc(it.label) + '</span>' +
        '<span class="set-voicebtn" data-voice="' + esc(it.value) + '" title="Hear voice">▶</span></button>';
    }
    return '<button type="button" class="set-chip' + active + '" data-kind="' + kind + '" data-value="' + esc(it.value) + '">' + esc(it.label) + '</button>';
  }).join('');
  return '<div class="set-section' + (collapsible ? ' collapsible' : '') + '">' +
    '<div class="set-label">' + label + '</div>' +
    '<div class="set-chips">' + chips + '</div>' +
    (collapsible ? '<button type="button" class="set-viewall">View all</button>' : '') +
    '</div>';
}

function pickSetting(chip) {
  const kind = chip.dataset.kind, val = chip.dataset.value;
  if (kind === 'ratio') ratio = val;
  else if (kind === 'quality') quality = val;
  else if (kind === 'gptSize') gptSize = val;
  else if (kind === 'duration') duration = Number(val);
  else if (kind === 'num') numImages = Number(val);
  else if (kind === 'voice') voice = val;
  else if (kind === 'hdr') { hdrOn = val !== 'off'; exrOn = val === 'exr'; }
  else if (kind === 'loop') loopOn = val === 'on';
  else if (kind === 'editMode') editMode = val;
  // Constraint web (fal): HDR runs 720p/1080p at 5s only; EXR requires HDR;
  // loop is 5s standard-dynamic-range only (so HDR and loop are exclusive).
  // Turning something on corrects the conflicting picks; picking a conflicting
  // value turns it off. Chips re-sync globally so corrections repaint everywhere.
  if (kind === 'hdr' && hdrOn) {
    if (quality === '540p') quality = '720p';
    if (duration === 10) duration = 5;
    loopOn = false;
  } else if (kind === 'loop' && loopOn) {
    if (duration === 10) duration = 5;
    hdrOn = false; exrOn = false;
  } else if (hdrOn && (quality === '540p' || duration === 10)) {
    hdrOn = false; exrOn = false;
  } else if (loopOn && duration === 10) {
    loopOn = false;
  }
  const cur = { ratio: ratio, quality: quality, gptSize: gptSize, duration: duration, num: numImages, voice: voice, hdr: exrOn ? 'exr' : hdrOn ? 'on' : 'off', loop: loopOn ? 'on' : 'off', editMode: editMode };
  const panel = chip.closest('.settings-panel') || document.getElementById('settingsMenu');
  if (panel) panel.querySelectorAll('.set-chip').forEach((c) => c.classList.toggle('active', String(cur[c.dataset.kind]) === String(c.dataset.value)));
  updateSettingsSummary();
  updateSendPrice();
  stampComposer();
}

// The Settings button shows the current picks at a glance (e.g. "16:9 · 720p · 5s").
function updateSettingsSummary() {
  const el = document.getElementById('settingsSummary');
  if (!el) return;
  const opts = currentOpts() || {};
  const parts = [];
  if (opts.ratios) parts.push(ratio);
  if (opts.resolutions) parts.push(quality);
  if (opts.sizes && gptSize !== '1K') parts.push(gptSize);
  if (opts.durations) parts.push(duration + 's');
  if (opts.hdr && hdrOn) parts.push(exrOn ? 'HDR+EXR' : 'HDR');
  if (opts.loop && loopOn) parts.push('Loop');
  if (opts.v2v && editMode !== 'auto' && attachments.clip) parts.push(editMode);
  if (opts.nums && numImages > 1) parts.push('×' + numImages);
  if (opts.voices) parts.push((opts.voiceLabels || {})[voice] || voice);
  el.textContent = parts.length ? parts.join(' · ') : 'Settings';
}

function toggleOpt(e, which) {
  e.stopPropagation();
  const menu = document.getElementById(which + 'Menu');
  document.querySelectorAll('.model-menu.open').forEach((m) => { if (m !== menu) m.classList.remove('open'); });
  menu.classList.toggle('open');
}

function toggleModelMenu(e) {
  e.stopPropagation();
  document.querySelectorAll('.model-menu.open').forEach((m) => { if (m !== modelMenu) m.classList.remove('open'); });
  modelMenu.classList.toggle('open');
}

function pickModel(el) {
  if (el.classList.contains('disabled')) return;
  model = el.dataset.model;
  selectedModels[mode] = model;
  hideFlyoutNow();
  modelMenu.classList.remove('open');
  buildMenu();       // repaint rows (incl. group parent's active-variant state) + label
  buildOptMenus();
  stampComposer();
}

if (modelMenu) {
  document.addEventListener('click', () => {
    document.querySelectorAll('.model-menu.open').forEach((m) => m.classList.remove('open'));
    hideFlyoutNow();
  });
}

// Keep aria-expanded on dropdown triggers in sync with their menu's open state.
// The menus are toggled from ~10 different places (model/dir/effort/img pickers);
// rather than thread the ARIA update through each, one observer watches the
// menus' class attribute and reflects it onto the controlling button. The
// trigger is the button immediately preceding the .model-menu in the DOM.
(function wireMenuAria() {
  const menus = document.querySelectorAll('.model-menu');
  const trigOf = (menu) => {
    let el = menu.previousElementSibling;
    while (el && el.tagName !== 'BUTTON') el = el.previousElementSibling;
    return el;
  };
  menus.forEach((menu) => {
    const trig = trigOf(menu);
    if (!trig) return;
    trig.setAttribute('aria-haspopup', 'menu');
    trig.setAttribute('aria-expanded', menu.classList.contains('open') ? 'true' : 'false');
  });
  if (typeof MutationObserver !== 'function') return;
  const obs = new MutationObserver((muts) => {
    muts.forEach((mu) => {
      const menu = mu.target;
      const trig = trigOf(menu);
      if (trig) trig.setAttribute('aria-expanded', menu.classList.contains('open') ? 'true' : 'false');
    });
  });
  menus.forEach((menu) => obs.observe(menu, { attributes: true, attributeFilter: ['class'] }));
})();

function newChat() {
  // A fresh chat wouldn't match an active search filter and would be
  // invisible in the list — clear the filter first.
  const search = document.getElementById('chatSearch');
  if (search) search.value = '';
  // Always start a fresh chat — even if the current one is still empty.
  stashStaged(chatStore.active); // keep the outgoing chat's staged attachments
  const fresh = newChatEntry();
  fresh.comp = composerState();  // "stays as last used": inherit the current setup
  chatStore.chats.unshift(fresh);
  chatStore.active = fresh.id;
  persistStore();
  restoreStaged(fresh.id);       // no entry yet → clears the staged slots
  touchSync(fresh.id);
  renderChatList();
  renderThread();
  document.getElementById('input').focus();
}

// Wall-clock caption under a bubble, e.g. "11:03 PM" (user) / "isibi.ai · 11:03 PM" (agent).
function fmtTime(ts) {
  const d = ts ? new Date(ts) : new Date();
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + ap;
}
function msgStamp(kind, ts) {
  const t = document.createElement('div');
  t.className = 'msg-time ' + kind;
  t.textContent = kind === 'agent' ? 'isibi.ai · ' + fmtTime(ts) : fmtTime(ts);
  return t;
}

// Scroll the thread to the bottom, but only when the user is already near it —
// so a streaming reply or a background finish never yanks them up while they're
// reading earlier turns. `force` (their own send) always scrolls. Also toggles
// the jump-to-bottom chevron.
function scrollThreadBottom(scroller, force) {
  if (!scroller) return;
  const near = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140;
  if (force || near) scroller.scrollTop = scroller.scrollHeight;
  updateScrollDown(scroller);
}
function updateScrollDown(scroller) {
  const btn = document.getElementById('scrollDown');
  if (!btn) return;
  const sc = scroller || (document.getElementById('messages') || {}).parentElement;
  if (!sc) return;
  const far = sc.scrollHeight - sc.scrollTop - sc.clientHeight > 240;
  btn.classList.toggle('show', far);
}

function prefersReducedMotion() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch { return false; }
}
// Reveal agent text word-by-word (Claude-Code style). Fresh deliveries only —
// history re-renders through renderSaved and stays instant. The full text is
// already persisted, so this is purely a visual reveal; type into a dedicated
// text node so the message's copy button (a sibling in the div) isn't wiped.
function typeText(el, text) {
  const tokens = String(text).match(/\S+\s*/g);
  if (!tokens || tokens.length < 2) { el.textContent = text; return; }
  const node = document.createTextNode('');
  el.appendChild(node);
  let i = 0;
  const tick = () => {
    if (!el.isConnected) return; // chat switched / thread re-rendered → stop (renderSaved shows the full text)
    const burst = i > 60 ? 3 : 1; // long replies reveal a few words per tick so they don't drag
    for (let b = 0; b < burst && i < tokens.length; b++) node.data += tokens[i++];
    const sc = el.parentElement && el.parentElement.parentElement;
    if (sc) scrollThreadBottom(sc);
    if (i < tokens.length) setTimeout(tick, 32);
  };
  // Defer the first tick: addMsg mounts the div AFTER calling typeText, so run
  // once it's connected (the tick guards on isConnected to stop on chat switch).
  setTimeout(tick, 0);
}
function addMsg(kind, text) {
  const div = document.createElement('div');
  div.className = 'msg ' + kind;
  if (kind.includes('typing')) {
    // Build with DOM so `text` is never interpreted as HTML (defense-in-depth,
    // even though callers only pass internal literals today).
    div.textContent = text + ' ';
    const dots = document.createElement('span');
    dots.className = 'dots';
    div.appendChild(dots);
  } else if (kind === 'agent' && text && !prefersReducedMotion()) {
    typeText(div, text); // isibi's replies type out word-by-word
  } else {
    div.textContent = text;
  }
  toggleHomeHero(false);
  const box = document.getElementById('messages');
  box.appendChild(div);
  if (kind === 'user' || kind === 'agent') {
    const ts = Date.now();
    box.appendChild(msgStamp(kind, ts));
    addCopyBtn(div, text);
    pushSaved({ t: kind, text, ts });
  }
  scrollThreadBottom(box.parentElement, kind === 'user'); // force only on the user's own send
  return div;
}

// Hover chip that copies a message's text to the clipboard.
const COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="3"/></svg>';
const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9 17.5 20 6.5"/></svg>';
function addCopyBtn(div, text) {
  const btn = document.createElement('button');
  btn.className = 'copy-btn'; btn.type = 'button'; btn.title = 'Copy';
  btn.setAttribute('aria-label', 'Copy message');
  btn.innerHTML = COPY_ICON;
  btn.onclick = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      btn.innerHTML = CHECK_ICON;
    } catch {
      const ta = document.createElement('textarea'); // older-browser fallback
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); btn.innerHTML = CHECK_ICON; } catch { btn.innerHTML = COPY_ICON; }
      ta.remove();
    }
    setTimeout(() => { btn.innerHTML = COPY_ICON; }, 1200);
  };
  div.appendChild(btn);
}

function ratioAspect(r) {
  const m = typeof r === 'string' && r.match(/^(\d{1,2}):(\d{1,2})$/);
  return m ? m[1] + ' / ' + m[2] : '16 / 9';
}

// ── Persistence: every chat is kept; New chat starts another ──
const STORE_KEY = 'zephyr_chats_v1';
const OLD_STORE_KEY = 'zephyr_thread_v1';
let chatStore = { active: null, chats: [] };

function newChatEntry() {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: 'New chat', msgs: [], updatedAt: Date.now() };
}

function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (s && Array.isArray(s.chats)) {
      // Drop any corrupted entries (null / missing fields) so one bad row can't
      // throw later and take the whole app boot down with it.
      const chats = s.chats.filter((c) => c && typeof c === 'object' && c.id).map((c) => ({
        ...c,
        title: typeof c.title === 'string' ? c.title : 'New chat',
        msgs: Array.isArray(c.msgs) ? c.msgs : [],
      }));
      if (chats.length) chatStore = { active: s.active, chats };
    }
  } catch {}
  // Migrate the old single-thread format into chat #1.
  if (!chatStore.chats.length) {
    let old = [];
    try { old = JSON.parse(localStorage.getItem(OLD_STORE_KEY) || '[]'); } catch {}
    const first = newChatEntry();
    if (old.length) {
      first.msgs = old;
      const firstUser = old.find((m) => m.t === 'user');
      if (firstUser) first.title = firstUser.text.slice(0, 30);
    }
    chatStore = { active: first.id, chats: [first] };
    try { localStorage.removeItem(OLD_STORE_KEY); } catch {}
    persistStore();
  }
  if (!chatStore.chats.some((c) => c.id === chatStore.active)) chatStore.active = chatStore.chats[0].id;
}

function persistStore() {
  try {
    const slim = {
      active: chatStore.active,
      chats: chatStore.chats.slice(0, 30).map((c) => ({ ...c, msgs: c.msgs.slice(-80) })),
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(slim));
  } catch {}
}

// ── Cross-device chat sync ─────────────────────────────────────────────
// One row per chat in Supabase (RLS: owner only), last-write-wins by the
// client-stamped updatedAt. localStorage stays the instant-boot cache; the
// server is the durable copy that follows the account.
const SYNC_ENDPOINT = SUPABASE_URL + '/rest/v1/chats';
const syncDirty = new Set();
const syncDeleted = new Set();
let syncTimer = null;

// Deletion tombstones: without them a chat deleted on one device gets re-pushed
// by another (it's still local there but gone from the server) and resurrects.
// A locally-recorded tombstone stops this device from re-adding a chat it just
// deleted during a pull race; the per-chat `synced` flag stops the OTHER device
// from re-uploading a chat the server no longer has. Pruned after 45 days.
const CHAT_TOMB_KEY = 'zephyr_chat_tombstones_v1';
function tombLoad() { try { const m = JSON.parse(localStorage.getItem(CHAT_TOMB_KEY) || '{}'); return m && typeof m === 'object' ? m : {}; } catch { return {}; } }
function tombAdd(id) {
  const now = Date.now(); const map = tombLoad(); map[id] = now;
  for (const k of Object.keys(map)) if (now - map[k] > 45 * 24 * 3600e3) delete map[k];
  try { localStorage.setItem(CHAT_TOMB_KEY, JSON.stringify(map)); } catch {}
}
function tombHas(id) { return Object.prototype.hasOwnProperty.call(tombLoad(), id); }
let lastPull = 0;
let pendingFirstMsg = null; // a ?q= prompt held until a signed-out visitor logs in

// Reschedule a push (used when a flush rejects and the dirty set was requeued),
// so those edits get another try instead of waiting for the next manual touch.
function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushChats, 5000);
}

function touchSync(chatId) {
  const c = chatStore.chats.find((x) => x.id === chatId);
  if (c) c.updatedAt = Date.now();
  syncDeleted.delete(chatId);
  syncDirty.add(chatId);
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushChats, 1500);
}

function deleteSync(chatId) {
  syncDirty.delete(chatId);
  syncDeleted.add(chatId);
  tombAdd(chatId); // remember it's deleted so a pull can't resurrect it
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushChats, 800);
}

async function syncHeaders() {
  if (!window.Auth || !Auth.isSignedIn()) return null;
  const token = await Auth.accessToken();
  if (!token) return null;
  return { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token };
}

async function pushChats() {
  const h = await syncHeaders();
  if (!h) return;
  const ids = [...syncDirty]; syncDirty.clear();
  const dels = [...syncDeleted]; syncDeleted.clear();
  const rows = ids.map((id) => chatStore.chats.find((c) => c.id === id)).filter(Boolean).map((c) => ({
    id: c.id,
    title: (c.title || 'New chat').slice(0, 120),
    brief: c.brief || null,
    last_prompt: c.lastPrompt || null,
    msgs: c.msgs.slice(-80),
    updated_at: new Date(c.updatedAt || Date.now()).toISOString(),
  }));
  try {
    if (rows.length) {
      const up = await fetch(SYNC_ENDPOINT + '?on_conflict=user_id,id', {
        method: 'POST',
        headers: Object.assign({}, h, { Prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify(rows),
      });
      // A rejected upsert (expired token, 4xx) must requeue — the dirty set was
      // already cleared, so without this those edits would never sync.
      if (!up.ok) { ids.forEach((id) => syncDirty.add(id)); scheduleSync(); }
      // Confirmed on the server: mark synced so a later pull won't mistake a
      // server-side deletion (chat absent from rows) for a never-synced chat
      // and re-upload it.
      else ids.forEach((id) => { const c = chatStore.chats.find((x) => x.id === id); if (c) c.synced = true; });
    }
    for (const id of dels) {
      const dr = await fetch(SYNC_ENDPOINT + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: h });
      if (!dr.ok) { syncDeleted.add(id); scheduleSync(); }
    }
  } catch {
    // Network hiccup — requeue everything for the next flush.
    ids.forEach((id) => syncDirty.add(id));
    dels.forEach((id) => syncDeleted.add(id));
    scheduleSync();
  }
}

// Union two message arrays by content: keep the winner's order, append any
// messages the loser had that the winner lacks. Stops a clock-skewed
// last-write-wins from silently dropping messages. Capped to the 80-msg window.
function mergeMsgs(winner, loser) {
  const key = (m) => (m.t || '') + '|' + (m.url || m.text || m.prompt || '') + '|' + (m.ts || m.at || '');
  const have = new Set((winner || []).map(key));
  const extra = (loser || []).filter((m) => m && !have.has(key(m)));
  return extra.length ? [...winner, ...extra].slice(-80) : (winner || []);
}

async function pullChats() {
  const h = await syncHeaders();
  if (!h) return;
  lastPull = Date.now();
  let rows;
  try {
    const res = await fetch(SYNC_ENDPOINT + '?select=id,title,brief,last_prompt,msgs,updated_at&order=updated_at.desc&limit=30', { headers: h });
    if (!res.ok) return;
    rows = await res.json();
  } catch { return; }
  if (!Array.isArray(rows)) return;
  let changed = false;
  rows.forEach((r) => {
    // A row we deleted locally but whose DELETE hasn't landed yet: don't re-add.
    if (tombHas(r.id)) return;
    const remoteAt = Date.parse(r.updated_at) || 0;
    const local = chatStore.chats.find((c) => c.id === r.id);
    if (!local) {
      chatStore.chats.push({
        id: r.id, title: r.title || 'New chat', brief: r.brief || undefined,
        lastPrompt: r.last_prompt || undefined,
        msgs: Array.isArray(r.msgs) ? r.msgs : [], updatedAt: remoteAt, synced: true,
      });
      changed = true;
    } else if (remoteAt > (local.updatedAt || 0)) {
      local.title = r.title || local.title;
      local.brief = r.brief || undefined;
      local.lastPrompt = r.last_prompt || undefined;
      // When the remote clearly wins (well past any clock skew) its message
      // list is authoritative — otherwise a message deleted on another device
      // gets unioned back in and re-pushed (resurrection). Only inside the skew
      // window do we union, so a skewed clock can't drop messages this device
      // just added and the remote hasn't seen yet.
      let gainedLocal = false;
      if (Array.isArray(r.msgs)) {
        if (remoteAt - (local.updatedAt || 0) > 90000) {
          local.msgs = r.msgs; // authoritative: honors deletions
        } else {
          const merged = mergeMsgs(r.msgs, local.msgs);
          gainedLocal = merged.length > r.msgs.length; // we hold messages the server lacked
          local.msgs = merged;
        }
      }
      // If we merged in local-only messages, advance the timestamp so the union
      // actually propagates — reusing remoteAt would look "in sync" everywhere
      // else and the merge would never reach other devices.
      if (gainedLocal) { local.updatedAt = Date.now(); syncDirty.add(local.id); }
      else local.updatedAt = remoteAt;
      local.synced = true;
      changed = true;
    } else if ((local.updatedAt || 0) > remoteAt) {
      local.synced = true;
      syncDirty.add(local.id); // local is ahead — push it back up
    } else {
      local.synced = true; // in sync — confirmed present on the server
    }
  });
  // Push up only chats the server has NEVER acknowledged: a previously-synced
  // chat that's absent from rows was deleted elsewhere (or is beyond the 30-row
  // window) — re-pushing it would resurrect a deletion, so leave it be.
  chatStore.chats.forEach((c) => {
    if (c.msgs.length && !c.synced && !tombHas(c.id) && !rows.some((r) => r.id === c.id)) syncDirty.add(c.id);
  });
  if (syncDirty.size) { clearTimeout(syncTimer); syncTimer = setTimeout(pushChats, 1200); }
  if (changed) {
    chatStore.chats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!chatStore.chats.find((c) => c.id === chatStore.active)) {
      chatStore.active = (chatStore.chats[0] || {}).id || null;
    }
    persistStore();
    renderChatList();
    // Don't rebuild the active thread out from under a live generation, a
    // streaming director reply, or a pending review card — that would detach
    // DOM-only UI mid-flight and throw. The list still reflects the sync.
    const busy = activeGens.has(chatStore.active) ||
      document.querySelector('#messages .typing, #messages .review-card, #genLoader');
    if (!busy) renderThread();
  }
}

// Freshen when returning to the tab; flush pending writes when leaving it.
window.addEventListener('focus', () => { if (Date.now() - lastPull > 30000) pullChats(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pushChats(); });

function activeChat() {
  return chatStore.chats.find((c) => c.id === chatStore.active);
}

function pushSaved(item) {
  const chat = activeChat();
  if (!chat) return;
  chat.msgs.push(item);
  if (chat.title === 'New chat' && item.t === 'user') {
    chat.title = item.text.slice(0, 30);
    renderChatList();
  }
  persistStore();
  touchSync(chat.id);
}

function renderSaved(item) {
  if (item.t === 'media') { threadAppend(buildMedia(item.kind, item.url, item.prompt)); return; }
  if (item.t === 'review') { threadAppend(buildReviewCard(item.prompt, item.mode, item.brief, item.memory, item.shots, item.extras)); return; }
  if (item.t === 'refs') { threadAppend(buildRefStrip(item)); return; }
  const div = document.createElement('div');
  div.className = 'msg ' + item.t;
  div.textContent = item.text;
  addCopyBtn(div, item.text);
  threadAppend(div);
  if (item.t === 'user' || item.t === 'agent') threadAppend(msgStamp(item.t, item.ts));
}

function renderThread() {
  const box = document.getElementById('messages');
  box.innerHTML = '';
  clearQDock(); // the dock card belongs to the flow that opened it, not the next chat
  const chat = activeChat();
  if (chat && chat.msgs.length) chat.msgs.forEach(renderSaved);
  // If this chat has a generation in flight, bring its loader back and keep
  // its send button locked; other chats stay free to send.
  mountGenLoader();
  updateSendLock();
  toggleHomeHero(!(chat && chat.msgs.length));
}

// Empty-state hero: greeting + starter chips, shown only while the active
// chat has no messages yet.
function toggleHomeHero(show) {
  const hero = document.getElementById('homeHero');
  if (hero) hero.classList.toggle('gone', !show);
}

function renderChatList() {
  const list = document.getElementById('chatList');
  if (!list) return;
  list.innerHTML = '';
  // Filter by the sidebar search box — matches titles and message text.
  const q = (document.getElementById('chatSearch')?.value || '').trim().toLowerCase();
  const shown = !q ? chatStore.chats : chatStore.chats.filter((c) =>
    c.title.toLowerCase().includes(q) ||
    c.msgs.some((m) => (m.t === 'user' || m.t === 'agent') && String(m.text || '').toLowerCase().includes(q)));
  if (q && !shown.length) {
    const none = document.createElement('div');
    none.className = 'chat-empty';
    none.textContent = 'No chats found';
    list.appendChild(none);
    return;
  }
  shown.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'chat-item' + (c.id === chatStore.active ? ' active' : '');
    const title = document.createElement('span');
    title.className = 'chat-title';
    title.textContent = c.title;
    const del = document.createElement('button');
    del.className = 'chat-del'; del.type = 'button'; del.title = 'Delete chat'; del.textContent = '✕';
    del.onclick = (e) => { e.stopPropagation(); deleteChat(c.id); };
    item.onclick = () => switchChat(c.id);
    item.appendChild(title); item.appendChild(del);
    list.appendChild(item);
  });
}

// ── Per-chat composer state ──
// Everything the composer remembers — mode, model per mode, effort,
// orchestrator, and every setting — lives ON the chat (chat.comp). Switching
// chats restores each chat's own setup, and because chats persist locally and
// sync, a refresh restores it too. Staged attachments are multi-MB data URIs,
// so they stay per-chat IN MEMORY only (survive switching, not a refresh).
// `var` (hoisted) — setEffort/setDirectorMode run during top-level init, before
// this line executes; a `let` here would TDZ-crash the whole script at load.
var restoringComp = false;
function composerState() {
  return {
    mode, effort, dir: directorMode,
    models: { ...selectedModels },
    ratio, quality, gptSize, duration, num: numImages, voice,
    hdr: hdrOn, exr: exrOn, loop: loopOn, editMode,
  };
}
function stampComposer() {
  if (restoringComp) return;
  // Some callers (setEffort/setDirectorMode paints) run during top-level init,
  // before the chat store's declarations execute — skip silently then.
  let chat; try { chat = activeChat(); } catch { return; }
  if (!chat) return;
  chat.comp = composerState();
  persistStore(); // local write only — comp rides along on the next real sync push
}
function applyComposerState(cs) {
  if (!cs) { stampComposer(); return; } // chat without saved state inherits the current setup
  restoringComp = true;
  try {
    if (cs.models) Object.keys(selectedModels).forEach((k) => {
      const id = cs.models[k];
      if (id && (MODEL_LISTS[k] || []).some((m) => m.id === id)) selectedModels[k] = id;
    });
    if (['video', 'image', 'audio'].includes(cs.mode)) mode = cs.mode;
    model = selectedModels[mode];
    if (EFFORT_LABELS[cs.effort]) {
      effort = cs.effort;
      document.querySelectorAll('.effort-item').forEach((i) => i.classList.toggle('selected', i.dataset.effort === effort));
      const lb = document.getElementById('effortLabel');
      if (lb) lb.textContent = EFFORT_LABELS[effort];
    }
    if (DIR_MODES[cs.dir]) {
      directorMode = cs.dir;
      if (cs.dir !== 'off') lastOrchMode = cs.dir;
      renderDirChip(); renderOrchSwitch(); renderEffortLock();
    }
    // Settings — each restored only if the (restored) model still offers it;
    // anything invalid falls back to that model's default.
    const o = currentOpts() || {};
    duration = (o.durations || []).includes(cs.duration) ? cs.duration : (o.defDur || duration);
    quality = (o.resolutions || []).includes(cs.quality) ? cs.quality : (o.defRes || quality);
    gptSize = (o.sizes || []).includes(cs.gptSize) ? cs.gptSize : (o.defSize || gptSize);
    ratio = (o.ratios || []).includes(cs.ratio) ? cs.ratio : (o.defRatio || ratio);
    numImages = o.nums && (o.nums || []).includes(cs.num) ? cs.num : 1;
    voice = (o.voices || []).includes(cs.voice) ? cs.voice : (o.defVoice || voice);
    hdrOn = !!(o.hdr && cs.hdr); exrOn = !!(o.hdr && cs.exr); loopOn = !!(o.loop && cs.loop);
    editMode = ['auto', 'adhere', 'flex', 'reimagine'].includes(cs.editMode) ? cs.editMode : 'auto';
    setMode(mode); // paints mode buttons + menus; buildOptMenus keeps our values (restoringComp)
  } finally {
    restoringComp = false;
  }
}
// Staged attachments per chat (in-memory) — each chat keeps its own set while
// the tab lives; they don't survive a refresh (too big for localStorage).
const stagedByChat = {};
function stashStaged(id) {
  if (!id) return;
  stagedByChat[id] = {
    att: { ...attachments }, extras: extraImages.slice(), refs: refList.slice(),
    els: elList.slice(), kfs: kfList.slice(), mask: maskData, clipMeta,
    awDur, awPeaks, awName, awSize, awType, imgMeta: { ...imgMeta },
  };
}
function restoreStaged(id) {
  const s = stagedByChat[id];
  Object.keys(attachments).forEach((k) => { attachments[k] = s ? s.att[k] || null : null; });
  extraImages.length = 0; refList.length = 0; elList.length = 0; kfList.length = 0;
  if (s) { extraImages.push(...s.extras); refList.push(...s.refs); elList.push(...s.els); kfList.push(...s.kfs); }
  maskData = s ? s.mask : null;
  clipMeta = s ? s.clipMeta : null;
  awDur = s ? s.awDur : 0; awPeaks = s ? s.awPeaks : null;
  awName = s ? s.awName : ''; awSize = s ? s.awSize : 0; awType = s ? s.awType : '';
  Object.keys(imgMeta).forEach((k) => delete imgMeta[k]);
  if (s && s.imgMeta) Object.assign(imgMeta, s.imgMeta);
  Object.keys(attachments).forEach((k) => renderAttach(k));
  renderExtraImages(); renderRefList(); renderElList(); renderKfList();
  updateAttachVisibility();
  updateSendPrice();
}

function switchChat(id) {
  if (id === chatStore.active) return;
  stampComposer();               // save the outgoing chat's composer setup
  stashStaged(chatStore.active); // and its staged attachments (in-memory)
  chatStore.active = id;
  persistStore();
  applyComposerState((activeChat() || {}).comp);
  restoreStaged(id);
  renderChatList();
  renderThread();
  document.getElementById('input').focus();
}

function deleteChat(id) {
  // Cancel any in-flight generation for this chat first — otherwise its output
  // would land in storage with no chat to show it (unreachable forever).
  if (activeGens.has(id)) cancelGen(id);
  // Also drop any PAUSED job record (network-drop/timeout removes it from
  // activeGens but keeps the refresh-proof record) so boot-resume doesn't
  // re-poll a render into a chat that no longer exists.
  jobClear(id);
  delete stagedByChat[id];
  const wasActive = chatStore.active === id;
  chatStore.chats = chatStore.chats.filter((c) => c.id !== id);
  if (!chatStore.chats.length) chatStore.chats = [newChatEntry()];
  if (chatStore.active === id) chatStore.active = chatStore.chats[0].id;
  if (wasActive) {
    applyComposerState((activeChat() || {}).comp);
    restoreStaged(chatStore.active);
  }
  persistStore();
  deleteSync(id);
  renderChatList();
  renderThread();
}

// A generation can finish after the user has moved to another chat — deliver
// its output to the chat that started it, and only render if still there.
function saveToChat(chatId, item) {
  const chat = chatStore.chats.find((c) => c.id === chatId);
  if (!chat) return;
  chat.msgs.push(item);
  persistStore();
  touchSync(chat.id);
}
function deliverAgent(chatId, text) {
  if (chatStore.active === chatId) addMsg('agent', text);
  else saveToChat(chatId, { t: 'agent', text, ts: Date.now() }); // stamp so re-render/merge keys are unique
}
function deliverMedia(chatId, kind, url, prompt) {
  saveToChat(chatId, { t: 'media', kind, url, at: Date.now(), prompt: prompt ? String(prompt).slice(0, 300) : undefined });
  if (chatStore.active === chatId) {
    // Fresh generations land with a soft gradient pulse (live only — saved
    // media re-renders without it).
    const el = buildMedia(kind, url, prompt);
    el.classList.add('landed');
    el.addEventListener('animationend', () => el.classList.remove('landed'), { once: true });
    threadAppend(el);
  }
}

// ── Generated media: element + download + full-screen actions ──
function buildMedia(kind, url, prompt) {
  const div = document.createElement('div');
  div.className = 'msg agent ' + kind;
  const src = mediaSrcOk(url);
  let el;
  if (kind === 'image') {
    el = document.createElement('img');
    el.src = src; el.alt = '';
    el.addEventListener('click', () => openLightbox('image', url));
  } else if (kind === 'audio') {
    el = document.createElement('audio');
    el.controls = true; el.src = src;
  } else {
    el = document.createElement('video');
    el.controls = true; el.src = src; el.playsInline = true;
  }
  // A media URL can die after the fact: deleted from the gallery on another
  // surface/device (chat sync has no per-message tombstones, so the message can
  // outlive its file) or an expired temporary fal link. Without a handler that
  // renders as a big blank box in the thread. Self-heal: a dead OUR-storage URL
  // means the file was deliberately deleted → drop the whole message; any other
  // dead link collapses into a small note instead of dead air.
  el.onerror = () => {
    if (isSavedMedia(url)) {
      div.remove();
      const chat = activeChat();
      if (chat) {
        const i = chat.msgs.findIndex((m) => m.t === 'media' && m.url === url);
        if (i >= 0) { chat.msgs.splice(i, 1); persistStore(); touchSync(chat.id); }
      }
    } else {
      div.innerHTML = '<span class="media-gone">This media is no longer available.</span>';
    }
  };
  div.appendChild(el);
  // Free accounts: on-screen mark over the video player. Only when we KNOW the
  // account is free — otherwise refreshVideoBadges() adds it once credits load,
  // so a paid user never flashes a watermark at boot.
  if (kind === 'video' && paidKnown && !isPaid) div.appendChild(wmBadge());

  const actions = document.createElement('div');
  actions.className = 'media-actions';
  if (kind !== 'audio') {
    const exp = document.createElement('button');
    exp.className = 'media-btn'; exp.type = 'button'; exp.title = 'Full screen'; exp.textContent = '⛶';
    exp.setAttribute('aria-label', 'View full screen');
    exp.onclick = (e) => { e.stopPropagation(); openLightbox(kind, url); };
    actions.appendChild(exp);
  }
  const dl = document.createElement('button');
  dl.className = 'media-btn'; dl.type = 'button'; dl.title = 'Download'; dl.textContent = '⤓';
  dl.setAttribute('aria-label', 'Download');
  dl.onclick = (e) => { e.stopPropagation(); downloadMedia(url, kind); };
  actions.appendChild(dl);
  const del = document.createElement('button');
  del.className = 'media-btn'; del.type = 'button'; del.title = 'Remove from chat (gallery copy stays)'; del.textContent = '🗑';
  del.setAttribute('aria-label', 'Remove from chat');
  del.onclick = (e) => { e.stopPropagation(); deleteMedia(div, url); };
  actions.appendChild(del);
  div.appendChild(actions);
  return div;
}

// Remove a generation from the CHAT only. The gallery is its own space
// (owner's call, 2026-07-16): a chat delete never touches the stored file —
// deleting the file itself happens in the Gallery view's own 🗑.
async function deleteMedia(el, url) {
  if (!confirm(isSavedMedia(url)
    ? 'Remove this from the chat? Your gallery copy stays.'
    : 'Remove this from the chat?')) return;
  el.remove();
  const chat = activeChat();
  if (chat) {
    const i = chat.msgs.findIndex((mm) => mm.t === 'media' && mm.url === url);
    if (i >= 0) { chat.msgs.splice(i, 1); persistStore(); touchSync(chat.id); }
  }
}

// Only assign a real media scheme to an element src — a stored/synced value
// can't smuggle a javascript:/data:text/html URL into a media element. Passive
// sink (inert as an <img>/<video> src), but keeps parity with downloadMedia.
const mediaSrcOk = (u) => /^(https?:|blob:|data:(?:image|video|audio)\/)/i.test(u || '') ? u : '';
// Open an external link only if it's a real http(s) URL — platform-supplied
// permalinks/video URLs (YouTube, Instagram) shouldn't be able to carry a
// javascript: scheme into window.open.
const openExternal = (u) => { if (/^https?:\/\//i.test(u || '')) window.open(u, '_blank', 'noopener'); };
async function downloadMedia(url, kind) {
  // Only ever fetch/open a real media URL — never let a stored value smuggle a
  // javascript:/data:text/html URL into fetch's catch → window.open.
  if (!/^(https?:|blob:|data:(?:image|video|audio)\/)/i.test(url || '')) return;
  const known = url.split('?')[0].match(/\.(png|jpe?g|webp|gif|mp4|webm|mov|mp3|wav|ogg|m4a)$/i);
  const ext = known ? known[1].toLowerCase() : (kind === 'image' ? 'png' : kind === 'audio' ? 'mp3' : 'mp4');
  const name = 'zephyr-' + Date.now() + '.' + ext;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = obj; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(obj), 5000);
  } catch {
    window.open(url, '_blank', 'noopener'); // cross-origin fallback
  }
}

// ── Full-screen lightbox (images & videos) ──
let lightboxEl = null;
let lightboxReturnFocus = null; // element to restore focus to on close
function openLightbox(kind, url) {
  if (!lightboxEl) {
    lightboxEl = document.createElement('div');
    lightboxEl.className = 'lightbox';
    lightboxEl.setAttribute('role', 'dialog');
    lightboxEl.setAttribute('aria-modal', 'true');
    lightboxEl.setAttribute('aria-label', 'Media viewer');
    lightboxEl.innerHTML =
      '<button class="lb-dl" type="button" title="Download" aria-label="Download">⤓</button>' +
      '<button class="lb-close" type="button" title="Close" aria-label="Close">×</button>' +
      '<div class="lb-stage"></div>';
    lightboxEl.addEventListener('click', (e) => { if (e.target === lightboxEl) closeLightbox(); });
    lightboxEl.querySelector('.lb-close').onclick = closeLightbox;
    // Trap Tab within the lightbox while it's open.
    lightboxEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !lightboxEl.classList.contains('open')) return;
      const foci = lightboxEl.querySelectorAll('button, video, [tabindex]:not([tabindex="-1"])');
      if (!foci.length) return;
      const first = foci[0], last = foci[foci.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.body.appendChild(lightboxEl);
  }
  const stage = lightboxEl.querySelector('.lb-stage');
  stage.innerHTML = '';
  // Spinner until the media has actually loaded (big videos buffer slowly).
  const spin = document.createElement('div');
  spin.className = 'lb-loading';
  stage.appendChild(spin);
  const ready = () => spin.remove();
  const src = mediaSrcOk(url);
  let el;
  if (kind === 'image') { el = document.createElement('img'); el.onload = ready; el.onerror = ready; el.src = src; }
  else {
    el = document.createElement('video');
    el.controls = true; el.autoplay = true; el.playsInline = true;
    el.onloadeddata = ready; el.onerror = ready;
    el.src = src;
  }
  stage.appendChild(el);
  // Free accounts: keep the mark on full-screen playback too (images carry
  // theirs in the pixels, so only video needs the overlay).
  stage.classList.toggle('wm-spot', kind !== 'image');
  if (kind !== 'image' && paidKnown && !isPaid) stage.appendChild(wmBadge());
  lightboxEl.querySelector('.lb-dl').onclick = () => downloadMedia(url, kind);
  lightboxEl.classList.add('open');
  // Remember what had focus so we can restore it, then move focus into the dialog.
  lightboxReturnFocus = (document.activeElement instanceof HTMLElement) ? document.activeElement : null;
  lightboxEl.querySelector('.lb-close').focus();
}
function closeLightbox() {
  if (!lightboxEl) return;
  lightboxEl.classList.remove('open');
  lightboxEl.querySelector('.lb-stage').innerHTML = ''; // stop playback
  if (lightboxReturnFocus && document.body.contains(lightboxReturnFocus)) {
    try { lightboxReturnFocus.focus(); } catch {}
  }
  lightboxReturnFocus = null;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
// Escape closes any open overlay via its own close control (so the welcome
// modal still records its dismiss, etc.).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const ov = document.querySelector('.credits-overlay, .gal-overlay');
  if (!ov) return;
  const close = ov.querySelector('.up-close, .cp-close, .wm-x, .gal-close');
  if (close) close.click(); else ov.remove();
});
// The sidebar nav + wordmark are divs acting as buttons — make them focusable
// and operable by keyboard (Enter/Space), with a delegated activator.
document.querySelectorAll('.side-item, .side-logo').forEach((el) => {
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target;
  if (el && el.classList && (el.classList.contains('side-item') || el.classList.contains('side-logo'))) {
    e.preventDefault(); el.click();
  }
});

// Progress theater: while fal renders, the status line plays out a film set —
// one director beat per poll tick (~4s), cycling until the take is done.
const THEATER = {
  video: ['Scouting the location…', 'Setting up the lights…', 'Blocking the shot…', 'Rolling camera…', 'Directing the take…', 'Watching the monitor…', 'Color grading the frames…', 'Cutting the final take…'],
  image: ['Sketching the composition…', 'Mixing the palette…', 'Setting the lighting…', 'Painting in the details…', 'Sharpening the focus…', 'Adding final touches…'],
  audio: ['Warming up the voice…', 'Finding the right tone…', 'Recording the take…', 'Listening back…', 'Mastering the sound…'],
};
function theaterLine(gen, kind) {
  const lines = THEATER[kind] || THEATER.video;
  gen.li = gen.li == null ? 0 : gen.li + 1;
  return lines[gen.li % lines.length];
}

// Animated placeholder shown while a generation runs: a shimmering skeleton
// (or bouncing bars for audio) + a spinning ring and the live status text.
function makeLoader(kind, aspect) {
  const wrap = document.createElement('div');
  wrap.className = 'msg agent gen-loading';

  let visual;
  if (kind === 'audio') {
    visual = document.createElement('div');
    visual.className = 'gen-bars';
    for (let i = 0; i < 13; i++) {
      const b = document.createElement('span');
      b.style.animationDelay = (i * 0.07) + 's';
      visual.appendChild(b);
    }
  } else {
    visual = document.createElement('div');
    visual.className = 'gen-shimmer';
    const ar = aspect || ratioAspect(ratio);
    visual.style.aspectRatio = ar;
    // A single scan line sweeps a coordinate grid — the frame being "scanned in".
    const arLabel = String(ar || '').replace(/\s*\/\s*/, ':');
    visual.innerHTML = '<i class="gen-scanline"></i>'
      + '<span class="gen-scan-tag tl">SCAN</span>'
      + (arLabel ? '<span class="gen-scan-tag br">' + arLabel + '</span>' : '');
  }

  const prog = document.createElement('div');
  prog.className = 'gen-prog';
  prog.innerHTML = '<i></i>';

  const status = document.createElement('div');
  status.className = 'gen-status';
  status.setAttribute('role', 'status'); // announce queue/progress lines to screen readers
  status.setAttribute('aria-live', 'polite');
  status.innerHTML = '<span class="gen-spinner"></span><span class="gen-status-text"></span><span class="gen-model"></span>';

  wrap.appendChild(visual);
  wrap.appendChild(prog);
  wrap.appendChild(status);
  const box = document.getElementById('messages');
  box.appendChild(wrap);
  scrollThreadBottom(box.parentElement, true); // a loader follows the user's own send — keep it in view
  return { el: wrap, setText: (t) => { wrap.querySelector('.gen-status-text').textContent = t; } };
}

// One generation may run per chat; each chat locks its own send button and
// shows its own loader, which is re-mounted when you switch back to it.
const activeGens = new Map(); // chatId → { kind, aspect, text }

function mountGenLoader() {
  const gen = activeGens.get(chatStore.active);
  if (!gen || document.getElementById('genLoader')) return;
  const l = makeLoader(gen.kind, gen.aspect);
  l.el.id = 'genLoader';
  l.setText(gen.text);
  const gm = l.el.querySelector('.gen-model');
  if (gm) gm.textContent = gen.model || '';
}
function setGenText(chatId, t) {
  const gen = activeGens.get(chatId);
  if (gen) gen.text = t;
  if (chatStore.active === chatId) {
    const el = document.querySelector('#genLoader .gen-status-text');
    if (el && el.textContent !== t) {
      el.textContent = t;
      // retrigger the little rise-in so each new beat visibly lands
      el.classList.remove('flip');
      void el.offsetWidth;
      el.classList.add('flip');
    }
    const gm = document.querySelector('#genLoader .gen-model');
    if (gm) gm.textContent = (gen && gen.model) || '';
  }
}
function endGen(chatId) {
  activeGens.delete(chatId);
  jobClear(chatId);
  if (chatStore.active === chatId) {
    const el = document.getElementById('genLoader');
    if (el) el.remove();
  }
  updateSendLock();
}
// Soft stop: drop the in-memory run + loader but KEEP the refresh-proof job
// record, so a run interrupted by a network drop (not a terminal state) is
// resumed at the next app boot instead of being lost after it was charged.
function pauseGen(chatId, autoResume = true) {
  activeGens.delete(chatId);
  if (chatStore.active === chatId) {
    const el = document.getElementById('genLoader');
    if (el) el.remove();
  }
  updateSendLock();
  // A live-but-interrupted render re-picks-up on its own (bounded by tries<4);
  // session-expired and lost-to-another-tab pauses opt out (autoResume=false).
  if (autoResume) scheduleResume(chatId);
}

// ── Refresh-proof generations & gallery saves ──────────────────────────────
// Every submitted fal job stays on record until it ends, so a closed or
// refreshed tab resumes polling at the next boot instead of losing a paid
// render. Gallery copies that fail queue here too and retry at boot,
// swapping the temporary fal URL for the permanent one wherever it landed.
const JOBS_KEY = 'zephyr_jobs_v1';
const SAVES_KEY = 'zephyr_pending_saves_v1';

function jobsLoad() { try { return JSON.parse(localStorage.getItem(JOBS_KEY) || '[]'); } catch { return []; } }
function jobsWrite(list) { try { localStorage.setItem(JOBS_KEY, JSON.stringify(list.slice(-8))); } catch {} }
function jobRecord(chatId, rec) { jobsWrite([...jobsLoad().filter((j) => j.chatId !== chatId), { chatId, ...rec }]); }
function jobClear(chatId) { jobsWrite(jobsLoad().filter((j) => j.chatId !== chatId)); }
// Count a failed-to-complete resume so a permanently-dead job is eventually
// abandoned instead of re-polled every boot forever.
function jobBumpTries(chatId) { jobsWrite(jobsLoad().map((j) => j.chatId === chatId ? { ...j, tries: (j.tries || 0) + 1 } : j)); }

function savesLoad() { try { return JSON.parse(localStorage.getItem(SAVES_KEY) || '[]'); } catch { return []; } }
function savesWrite(list) { try { localStorage.setItem(SAVES_KEY, JSON.stringify(list.slice(-20))); } catch {} }
function queuePendingSave(url, kind) { savesWrite([...savesLoad().filter((p) => p.url !== url), { url, kind, at: Date.now() }]); }

// Cross-tab delivery claim: two tabs of the same account can each resume the
// same job record and both poll it. The first to reach COMPLETED claims the
// result key (the fal status URL) in shared localStorage; the other sees the
// claim and skips save+deliver, so a job is copied and shown exactly once.
const DELIVERED_KEY = 'zephyr_delivered_v1';
const TAB_ID = Math.random().toString(36).slice(2) + '-' + Date.now().toString(36); // per-tab id
const claimAt = (v) => (v && typeof v === 'object') ? v.at : (typeof v === 'number' ? v : 0);
async function claimDelivery(key) {
  try {
    const now = Date.now();
    let map = JSON.parse(localStorage.getItem(DELIVERED_KEY) || '{}');
    if (map[key] && now - claimAt(map[key]) < 3600e3) return false; // already claimed recently
    map[key] = { at: now, by: TAB_ID };
    // Keep the map small — drop entries older than a day (both shapes).
    for (const k of Object.keys(map)) if (now - claimAt(map[k]) > 86400e3) delete map[k];
    localStorage.setItem(DELIVERED_KEY, JSON.stringify(map));
    // Two tabs can both read "unclaimed" and both write. localStorage writes are
    // same-origin serialized, so after a short jittered wait the last writer's
    // token is what persists — re-read and only the tab whose token won proceeds,
    // so a job is still saved+delivered exactly once.
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 90));
    map = JSON.parse(localStorage.getItem(DELIVERED_KEY) || '{}');
    return !!(map[key] && typeof map[key] === 'object' && map[key].by === TAB_ID);
  } catch { return true; } // storage broken → don't block delivery
}

// Copy a fal output into permanent Supabase Storage, with bounded retries —
// a failed copy must never silently become the permanent record.
// Returns { url, block }: url is the permanent gallery copy (null on failure),
// block is the non-transient 402 reason ('free' = paid-only, 'full' = cap hit)
// or null. Returned, not stashed in a global, so concurrent boot save-loops
// can't cross-attribute each other's result.
async function trySave(url, kind, attempts, payload) {
  for (let i = 0; i < attempts; i++) {
    try {
      const sv = await apiFetch('/api/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || { url, kind }),
      });
      if (sv.ok) { const d = await sv.json().catch(() => ({})); if (d.url) return { url: d.url, block: null }; }
      if (sv.status === 401) return { url: null, block: null }; // signed out — retrying now won't help
      if (sv.status === 402) { // over cap / not entitled — retrying won't help
        let reason = 'full';
        try { reason = (await sv.json()).reason || 'full'; } catch {}
        return { url: null, block: reason };
      }
    } catch {}
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return { url: null, block: null };
}

// Save one output: for PAID accounts /api/save stores the permanent copy (and
// watermarks free-account images server-side on the way in). Free accounts have
// no gallery storage, so their save is refused (402 free) and the server mark
// never runs — burnImageWatermark() below covers that case client-side.
async function saveOutput(u, kind) {
  return trySave(u, kind, 3);
}

// ── Product-URL ads: QR burn ──
// Videos born from a "From product URL" chat get a scannable QR (→ the product
// page) burned into the bottom-right corner before saving — the QR is real
// pixels, so downloads and re-shares carry the link forever.
function qrPngFor(text) {
  try {
    if (typeof qrcode !== 'function') return null; // vendor lib missing
    const qr = qrcode(0, 'M');
    qr.addData(String(text));
    qr.make();
    const n = qr.getModuleCount(), quiet = 4, scale = 8;
    const size = (n + quiet * 2) * scale;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
      if (qr.isDark(r, col)) g.fillRect((quiet + col) * scale, (quiet + r) * scale, scale, scale);
    }
    return c.toDataURL('image/png');
  } catch { return null; }
}
// Burn + save the marked copy (base64 path, same as Studio films). Returns
// {url} on success, null on ANY failure — the caller falls back to the normal
// unburned save, so the QR can never cost the user their render.
async function saveVideoWithQr(u, qr, origin) {
  try {
    if (typeof sbFFQr !== 'function' || typeof sbFFSupported !== 'function' || !sbFFSupported()) return null;
    const png = qrPngFor(qr.url);
    if (!png) return null;
    setGenText(origin, 'Stamping the QR…');
    // Timed window (start/end seconds) or whole video when unset; corner via pos.
    const blob = await sbFFQr(u, png, { url: u, start: qr.start, end: qr.end, pos: qr.pos });
    // The worker caps a base64 video upload (~29 MB of blob) — over it, skip.
    if (!blob || blob.size > 29_000_000) return null;
    const b64 = await new Promise((ok, err) => {
      const r = new FileReader();
      r.onload = () => { const s = String(r.result); ok(s.slice(s.indexOf(',') + 1)); };
      r.onerror = () => err(new Error('read failed'));
      r.readAsDataURL(blob);
    });
    setGenText(origin, 'Saving to your gallery…');
    const res = await trySave(null, 'video', 3, { kind: 'video', data: b64 });
    return res && res.url ? res : null;
  } catch { return null; }
}

// Parse a QR instruction out of a chat message — natural phrasings like
// "add a QR to <url> for the last 3 seconds", "put a qr code from second 3 to
// 4", "qr at the end", "no qr". Returns { want, remove, url, start, end,
// clean } where `clean` is the message with the QR clause stripped (so it
// never bleeds into the generation prompt). `durSec` is the clip length, used
// to resolve "last N" / "at the end". Timing is null → whole video.
function parseQrDirective(text, durSec) {
  const src = String(text || '');
  if (!/\bqr\b|qr[\s-]?code/i.test(src)) return { want: false, remove: false, clean: src };
  const remove = /\b(no|without|remove|drop|delete|no more)\b[^.,\n]*\bqr/i.test(src) ||
    /\bqr[^.,\n]*\b(off|removed?|gone)\b/i.test(src);
  // A URL anywhere in the message is the QR target (falls back to chat.productUrl later).
  const urlM = src.match(/https?:\/\/[^\s]+/i);
  const url = urlM ? urlM[0].replace(/[).,]+$/, '') : null;
  // Timing windows.
  let start = null, end = null;
  const d = Number.isFinite(durSec) && durSec > 0 ? durSec : null;
  let m;
  if ((m = src.match(/from\s+(?:second\s+)?(\d+(?:\.\d+)?)\s*s?\s*(?:to|-|until|through|till)\s*(?:second\s+)?(\d+(?:\.\d+)?)/i))) {
    start = +m[1]; end = +m[2];
  } else if ((m = src.match(/last\s+(\d+(?:\.\d+)?)\s*(?:s\b|sec|second)/i)) && d) {
    end = d; start = Math.max(0, d - +m[1]);
  } else if ((m = src.match(/first\s+(\d+(?:\.\d+)?)\s*(?:s\b|sec|second)/i))) {
    start = 0; end = +m[1];
  } else if (/at\s+the\s+end|final\s+(?:few\s+)?second|ending/i.test(src) && d) {
    end = d; start = Math.max(0, d - 3);
  } else if (/at\s+the\s+(?:start|beginning|top)/i.test(src)) {
    start = 0; end = 3;
  } else if ((m = src.match(/at\s+(?:second\s+)?(\d+(?:\.\d+)?)\s*s?\b/i))) {
    start = +m[1]; end = d || (+m[1] + 2); // from that second onward (to end, or a short flash)
  }
  if (start != null && end != null && end <= start) { const t2 = start; start = end; end = t2; }
  // Corner/position — "top-left", "bottom left corner", "center". Codes:
  // tl/tr/bl/br/c. Default (null) → bottom-right in the burn.
  let pos = null;
  const cm = src.match(/\b(top|upper|bottom|lower)[\s-]*(left|right)\b/i);
  if (cm) pos = (/top|upper/i.test(cm[1]) ? 't' : 'b') + (/left/i.test(cm[2]) ? 'l' : 'r');
  else if (/\b(center|centre|middle)\b/i.test(src)) pos = 'c';
  else if (/\btop\b/i.test(src)) pos = 'tr';
  else if (/\bbottom\b/i.test(src)) pos = 'br';
  else if (/\bleft\b/i.test(src)) pos = 'bl';
  else if (/\bright\b/i.test(src)) pos = 'br';
  // Strip the QR-mentioning segment(s) so the instruction never bleeds into the
  // generation prompt: drop any URL first (splitting on its dots would scatter
  // it), then split on sentence/comma breaks and drop pieces naming a QR.
  const clean = src.replace(/https?:\/\/[^\s]+/gi, ' ')
    .split(/[,.\n]+/)
    .map((s) => s.trim())
    .filter((s) => s && !/\bqr\b|qr[\s-]?code/i.test(s))
    .join('. ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { want: !remove, remove, url, start, end, pos, clean };
}

// Burn the "✦ isibi.ai" mark into an image client-side (bottom-right), returning
// a JPEG data URI. Used for FREE accounts, whose images can't be saved (so the
// server-side mark never runs) — they still get a watermarked copy on the temp
// link. Returns null if the source can't be drawn (CORS/decode) so the caller
// falls back to the raw URL rather than dropping the image.
async function burnImageWatermark(url) {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = url; });
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const c = canvas.getContext('2d');
    c.drawImage(img, 0, 0, w, h);
    const pad = Math.round(Math.max(w, h) * 0.022);
    const fs = Math.round(Math.max(16, Math.min(w, h) * 0.038));
    c.font = '600 ' + fs + "px 'Space Grotesk', Inter, system-ui, sans-serif";
    c.textAlign = 'right'; c.textBaseline = 'bottom';
    c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = Math.round(fs * 0.5); c.shadowOffsetY = 1;
    c.fillStyle = 'rgba(255,255,255,.92)';
    c.fillText('✦ isibi.ai', w - pad, h - pad);
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch { return null; }
}

// Swap a temporary fal URL for its permanent copy wherever it was stored.
function replaceMediaUrl(oldUrl, newUrl) {
  let hit = false;
  chatStore.chats.forEach((c) => c.msgs.forEach((m) => {
    if (m.url === oldUrl) { m.url = newUrl; hit = true; touchSync(c.id); }
  }));
  if (hit) {
    persistStore();
    const dock = document.getElementById('qDock');
    if (!dock || !dock.children.length) renderThread();
  }
  try { // Studio shots too (sb / sbSave are studio.js globals on this page)
    if (typeof sb !== 'undefined' && sb && Array.isArray(sb.projects)) {
      let sHit = false;
      sb.projects.forEach((p) => (p.shots || []).forEach((s) => {
        if (s.url === oldUrl) { s.url = newUrl; sHit = true; }
      }));
      if (sHit && typeof sbSave === 'function') sbSave();
    }
  } catch {}
}

// Boot: retry gallery copies that failed, while their fal URL is still alive.
async function retryPendingSaves() {
  const list = savesLoad();
  if (!list.length) return;
  const keep = [];
  for (const p of list) {
    if (Date.now() - (p.at || 0) > 6 * 24 * 3600e3) continue; // fal URL long dead
    // saveOutput just posts the URL; the server watermarks free-account images.
    const { url: perm, block } = await saveOutput(p.url, p.kind);
    if (perm) replaceMediaUrl(p.url, perm);
    else if (block) { /* paid gate (free/full) — retrying won't help, drop it */ }
    else keep.push(p);
  }
  savesWrite(keep);
}

// Boot: pick up any generation that was in flight when the tab last died.
function resumeJobs() {
  const jobs = jobsLoad().filter((j) => j.chatId && ((j.statusUrl && j.responseUrl) || j.idem));
  // Give up on a record that has been paused (network-dead) several boots
  // running — its fal URL is almost certainly gone, so stop re-polling forever.
  const live = jobs.filter((j) => (j.tries || 0) < 4);
  jobsWrite(live);
  live.forEach((j) => { if (!activeGens.has(j.chatId)) resumeOne(j); });
}

// Pick a single on-record job back up into its origin chat's poll loop. Shared
// by boot-resume, the auto-resume timer, and the "you retried while a render was
// still finishing" path so none of them re-implement (or diverge on) the setup.
function resumeOne(j) {
  if (!j || activeGens.has(j.chatId)) return;
  // A provisional record (reply lost mid-submit, maybe charged) has an idem but
  // no statusUrl — recover the job by idem instead of polling a URL we never got.
  if (!j.statusUrl) { if (j.idem) recoverJob(j); return; }
  const kind = j.kind || 'video';
  const myGen = { kind, aspect: j.aspect, text: 'Checking on your ' + kind + '…', statusUrl: j.statusUrl };
  activeGens.set(j.chatId, myGen);
  updateSendLock();
  if (chatStore.active === j.chatId) mountGenLoader();
  // Give even a stale job a real chance — fal keeps results around for days,
  // and a 4K render may still be going, so floor the resumed window at 5 min.
  const deadline = Math.max(Date.now() + 5 * 60000, j.deadline || 0);
  const mins = Math.max(5, Math.round((deadline - Date.now()) / 60000));
  pollAndDeliver(j.chatId, kind, j.statusUrl, j.responseUrl, j.text || '', j.label || 'the model', deadline, mins, myGen, false);
}

// Recover a provisional job (its submit reply was lost): re-POST with the SAME
// idem. The worker returns the stored job if a charge already exists (recover +
// poll it), else a non-OK (nothing was charged → drop the record). It can never
// start a new charged generation, since the recovery body carries no prompt.
async function recoverJob(j) {
  if (activeGens.has(j.chatId)) return;
  try {
    const res = await apiFetch(j.apiPath || '/api/video', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: j.model, idem: j.idem, recover: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.status_url && data.response_url) {
      const deadline = Date.now() + 10 * 60000;
      jobRecord(j.chatId, { kind: j.kind, statusUrl: data.status_url, responseUrl: data.response_url, text: j.text || '', label: j.label, aspect: j.aspect, deadline });
      resumeOne({ ...j, statusUrl: data.status_url, responseUrl: data.response_url, deadline });
    } else if (res.status && res.status !== 502 && res.status !== 503 && res.status !== 401) {
      jobClear(j.chatId); // definitively nothing to recover (400/404) — nothing was charged
    } else {
      jobBumpTries(j.chatId); // transient (5xx/auth) — bounded by tries<4, retried at next boot
    }
  } catch { jobBumpTries(j.chatId); } // network — leave it, bounded, retried later
}

// A render that outran its window / hit a network drop is paused (record kept,
// tries bumped). Re-pick it up shortly WITHOUT a reload, so "the app will get it
// automatically" is literally true — bounded by the tries<4 cap in resumeJobs.
function scheduleResume(chatId, delayMs) {
  setTimeout(() => {
    if (activeGens.has(chatId)) return; // a manual retry/resume already took over
    const rec = jobsLoad().find((j) => j.chatId === chatId && (j.tries || 0) < 4);
    if (rec && rec.statusUrl) resumeOne(rec);
  }, delayMs || 45000);
}

// While the active chat is generating, the send arrow becomes a stop square.
const ARROW_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
const STOP_SVG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>';
function updateSendLock() {
  const btn = document.getElementById('sendBtn');
  const busy = activeGens.has(chatStore.active);
  btn.disabled = false;
  btn.title = busy ? 'Stop generating' : 'Send';
  btn.innerHTML = busy ? STOP_SVG : ARROW_SVG + '<span class="send-spark" id="sendSpark">✦</span><span class="send-price" id="sendPrice"></span>';
  if (!busy) { updateSendPrice(); refreshSendEnabled(); }
}

// Whether the current state can actually be submitted. Every fal model except
// the lip-sync ones requires a text prompt (verified against fal's schemas —
// even the video-to-video/edit and image-edit endpoints list "prompt" as
// required), so an empty box only submits on a genuinely promptless model.
function canSubmit() {
  const promptless = mode === 'video' && currentOpts() && currentOpts().noPrompt;
  if (promptless) return true; // runs off its attachments; send() checks them
  const input = document.getElementById('input');
  return !!(input && input.value.trim());
}
// Grey the send button out when it can't submit (empty box on a prompt model),
// so it never looks ready and then silently does nothing. Stop stays clickable.
function refreshSendEnabled() {
  const btn = document.getElementById('sendBtn');
  if (!btn) return;
  // updateSendPrice() runs during early module init (via setEffort), before
  // chatStore/activeGens are initialized — reading them then throws a TDZ
  // ReferenceError that would halt the whole script. Bail quietly until they
  // exist; the real refreshes all happen after init.
  let busy;
  try { busy = activeGens.has(chatStore.active); } catch (e) { return; }
  if (busy) { btn.disabled = false; return; }
  const ok = canSubmit();
  btn.disabled = !ok;
  btn.title = ok ? 'Send'
    : mode === 'audio' ? 'Type what you want the voice to say'
    : mode === 'image' ? (attachments.image ? 'Type the change to make' : 'Describe your image')
    : attachments.clip ? 'Type the change to make to your clip'
    : 'Describe your scene';
}

// ── Send-button price tag — estimates from fal's published pricing ────────
// Video: $/sec by resolution (audio-on rates where the model does audio;
// aoff = the cheaper audio-off rate applied when the director's "silent" flag
// is set — mirrors the worker's VIDEO_USD exactly).
const VIDEO_PRICE = {
  'fal-ai/veo3.1':                                { s: { '720p': 0.40, '1080p': 0.40, '4k': 0.60 }, aoff: { '720p': 0.20, '1080p': 0.20, '4k': 0.40 } },
  'fal-ai/veo3.1/fast':                           { s: { '720p': 0.15, '1080p': 0.15, '4k': 0.35 }, aoff: { '720p': 0.10, '1080p': 0.10, '4k': 0.30 } },
  // Ray prices i2v BELOW t2v (i2s tier) and only renders 5s from a start image.
  'luma/agent/ray/v3.2/text-to-video':            { s: { '540p': 0.10, '720p': 0.20, '1080p': 0.40 }, i2s: { '540p': 0.03, '720p': 0.06, '1080p': 0.24 }, v2s: { '540p': 0.144, '720p': 0.216, '1080p': 0.432 } },
  'bytedance/seedance-2.0/text-to-video':         { s: { '480p': 0.14, '720p': 0.304, '1080p': 0.682, '4k': 1.59 } },
  'bytedance/seedance-2.0/fast/text-to-video':    { s: { '480p': 0.135, '720p': 0.242 } }, // no 1080p on the fast tier
  'bytedance/seedance-2.0/mini/text-to-video':    { s: { '480p': 0.0725, '720p': 0.155 } },
  'fal-ai/kling-video/o3/pro/text-to-video':      { s: { def: 0.14 }, aoff: { def: 0.112 }, v2s: { def: 0.168 } }, // edit endpoint bills 20% over t2v
  'fal-ai/kling-video/o3/standard/text-to-video': { s: { def: 0.112 }, aoff: { def: 0.084 }, v2s: { def: 0.126 } },
  'fal-ai/kling-video/v3/pro/text-to-video':      { s: { def: 0.168 }, aoff: { def: 0.112 } },
  'fal-ai/kling-video/v3/standard/text-to-video': { s: { def: 0.126 }, aoff: { def: 0.084 } },
  'google/gemini-omni-flash':                     { s: { def: 0.13 } },
  'fal-ai/bytedance/omnihuman':                   { audioPerSec: 0.14 },  // fal bills per second of output (= audio length, ≤30s)
  'fal-ai/bytedance/omnihuman/v1.5':              { audioPerSec: 0.16 },  // $0.16/s flat — 720p and 1080p bill the same
  'fal-ai/kling-video/lipsync/audio-to-video':    { videoPer5s: 0.014 },  // fal bills the INPUT VIDEO's seconds, rolled up to 5s steps
};
// GPT Image 2 $/image by SIZE tier × QUALITY. Each cell is a small margin over
// fal's max price for that tier's pixel budget (1K ≤1024²-class, 2K ≤2560×1440,
// 4K ≤3840×2160), so it never undercharges. Mirrored in the worker.
const GPT_PRICE = {
  // 1K high is $0.23 (not $0.211) to cover the worst case where fal's undocumented
  // named preset maps to a 2560×1440-class image ($0.222) instead of ~1024².
  '1K': { low: 0.008, medium: 0.06,  high: 0.23 },
  '2K': { low: 0.008, medium: 0.06,  high: 0.23 },
  '4K': { low: 0.014, medium: 0.104, high: 0.41 },
};
const IMAGE_PRICE = { // $ per image
  'fal-ai/nano-banana-pro': 0.15,
  'openai/gpt-image-2': 0.22, // token-billed; fal's table puts High 1024² at ~$0.21
};
const AUDIO_PRICE = { // $ per 1,000 characters spoken
  'fal-ai/elevenlabs/tts/eleven-v3': 0.10,
  'fal-ai/elevenlabs/tts/turbo-v2.5': 0.05,
  'fal-ai/elevenlabs/tts/multilingual-v2': 0.10,
};

// 1 credit = $0.008 — same conversion the worker charges with. Generation
// credits are PURE fal cost now: the AI/director cost is billed separately
// against the AI Orchestrator add-on's budget, never on the generation.
const CREDIT_USD = 0.008;
function fmtPrice(usd) {
  return '✦ ' + Math.max(1, Math.ceil(usd / CREDIT_USD)).toLocaleString();
}
function estimatePrice(textForAudio, shotsOverride, soundOverride) {
  if (mode === 'image') {
    // GPT Image 2 is priced by size tier × quality, not a flat rate.
    if (model === 'openai/gpt-image-2') {
      const t = GPT_PRICE[gptSize] || GPT_PRICE['1K'];
      const rate = t[quality] != null ? t[quality] : t.high;
      return fmtPrice(rate * (numImages || 1));
    }
    const per = IMAGE_PRICE[model];
    if (per == null) return '';
    // Nano Banana Pro 4K bills double; 2K/1K bill the base rate.
    const resX = (currentOpts().resolutions && quality === '4K') ? 2 : 1;
    return fmtPrice(per * (numImages || 1) * resX);
  }
  if (mode === 'audio') {
    const per = AUDIO_PRICE[model];
    if (per == null) return '';
    // Price on the exact text being quoted (the review card passes the script;
    // the send button falls back to the live input). Match the server's cap.
    const raw = textForAudio != null ? textForAudio : (document.getElementById('input').value || '');
    const chars = Math.min(2000, raw.trim().length);
    return fmtPrice(Math.max(chars, 40) / 1000 * per);
  }
  const p = VIDEO_PRICE[model];
  if (!p) return '';
  // OmniHuman bills by the driving audio's length (awDur, seconds, ≤30s).
  if (p.audioPerSec != null) {
    const secs = Math.max(1, Math.min(60, Math.round(awDur || 0)));
    return fmtPrice(p.audioPerSec * secs);
  }
  // LipSync bills on the INPUT VIDEO's seconds, rolled up to the next 5s step
  // ($0.014/s). Unknown clip length quotes the 10s max — same as the worker.
  if (p.videoPer5s != null) {
    const dur = attachments.clip && clipMeta ? clipMeta.dur : 0; // ignore a stale/cleared clip's length
    const vs = Math.max(2, Math.min(10, Math.round(dur || 0) || 10));
    return fmtPrice(p.videoPer5s * Math.ceil(vs / 5) * 5);
  }
  if (p.flat != null) return fmtPrice(p.flat);
  // Rate table: clip attached → v2s (re-render premium: Ray, Kling o3 +20%);
  // start image on a model that prices i2v separately (Ray) → i2s; else t2v —
  // discounted to aoff when the render is explicitly silent (Veo, Kling).
  const startImg = !!(attachments.image || attachments.ffirst || attachments.flast || kfList.length);
  const soundOff = soundOverride === false;
  const tbl = p.v2s && attachments.clip ? p.v2s : p.i2s && startImg ? p.i2s : (soundOff && p.aoff ? p.aoff : p.s);
  const rate = tbl[quality] != null ? tbl[quality] : tbl.def != null ? tbl.def : tbl['720p'];
  if (rate == null) return '';
  // Endpoint-fixed durations — quote what will actually be billed:
  //  · Veo extend always outputs 7s; Veo reference-to-video always renders 8s.
  //  · The o3/Gemini clip edits render the WHOLE source clip (no duration
  //    input), so the bill follows the clip's length, not the picker.
  //  · Ray from a start image (no keyframes) only renders 5s.
  //  · A Kling multi-shot bills the SUM of its shot durations.
  const shots = (shotsOverride && shotsApply(model)) ? sanitizeShots(shotsOverride) : null;
  const isVeoExtend = /veo/.test(model) && !!attachments.clip;
  const isVeoRef = /veo/.test(model) && refList.length > 0;
  const isClipEdit = !!attachments.clip && (/kling-video\/o3/.test(model) || /gemini/.test(model));
  const clipEditMax = /gemini/.test(model) ? 30 : 15;
  const clipEditSecs = Math.min(clipEditMax, Math.ceil((clipMeta && clipMeta.dur) || clipEditMax));
  const isRayI2V = model.startsWith('luma/') && startImg && !attachments.clip && !kfList.length;
  // Veo refs win over a clip (the worker routes reference-to-video first).
  const billDur = shots ? shots.reduce((t, s) => t + s.duration, 0)
    : isVeoRef ? 8
    : isVeoExtend ? 7
    : isClipEdit ? clipEditSecs
    : isRayI2V ? 5
    : (duration || 5);
  // Seedance reference-to-video with a @Video1 clip: 0.6× rate over the
  // clip's input seconds + the output duration (same basis as the worker).
  if (/seedance/.test(model) && attachments.clip) {
    const inSecs = Math.min(15, Math.ceil((clipMeta && clipMeta.dur) || 15));
    return fmtPrice(0.6 * rate * (inSecs + billDur));
  }
  // HDR render (Ray) doubles fal's price; the EXR sidecar triples it.
  const hdrX = hdrOn && (currentOpts() || {}).hdr ? (exrOn ? 3 : 2) : 1;
  return fmtPrice(rate * billDur * hdrX);
}
function updateSendPrice() {
  const el = document.getElementById('sendPrice');
  if (el) {
    // The ✦ stays grey on the button; the count chip carries just the number.
    const p = estimatePrice() || '';
    el.textContent = p.replace('✦', '').trim();
    const sp = document.getElementById('sendSpark');
    if (sp) sp.style.display = el.textContent ? '' : 'none';
  }
  refreshSendEnabled(); // model/attachment changes can flip submittability
}

// ── Credit balance (server-owned; the chip is display only) ───────────────
// The arc gauge shows the balance against the highest balance this browser
// has seen (plan size / last top-up) — a fuel gauge that drains as you spend.
const CRED_MAX_KEY = 'zephyr_cred_max_v1';
const CRED_ARC_LEN = 37.7; // half-circle path length (π × r12)
// The on-screen VIDEO badge is tri-state: shown only when the account is KNOWN
// free. Until /api/credits resolves, `paidKnown` is false and we fail toward
// "paid" (no badge) so a slow/failed credits call never defaces a paying user.
// (Image watermarks don't depend on this — the server burns them on /api/save.)
let isPaid = false;
let paidKnown = false;
// The on-screen "✦ isibi.ai" mark free accounts see over video players —
// chat thread, gallery cards and the lightbox all carry it (class wm-spot
// marks the non-chat containers).
function wmBadge() {
  const wm = document.createElement('span');
  wm.className = 'wm-badge';
  wm.textContent = '✦ isibi.ai';
  return wm;
}
// Toggle the on-screen video badge on already-rendered clips once we learn the
// account's paid state (buildMedia renders none while `paidKnown` is false).
function refreshVideoBadges() {
  document.querySelectorAll('.msg.video, .wm-spot').forEach((div) => {
    const has = div.querySelector('.wm-badge');
    if (paidKnown && !isPaid && !has) {
      div.appendChild(wmBadge());
    } else if ((isPaid || !paidKnown) && has) {
      has.remove();
    }
  });
}
function setArcFill(el, frac) {
  if (el) el.style.strokeDashoffset = (CRED_ARC_LEN * (1 - frac)).toFixed(2);
}
function setCredits(n) {
  if (typeof n !== 'number') return;
  // Whole credits show clean; fractional balances (from Orchestrator use) round
  // to 2 decimals for display — the ledger still tracks the exact amount.
  const txt = '✦ ' + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const el = document.getElementById('creditChip');
  if (el) el.textContent = txt;
  const pn = document.getElementById('credPillN');
  if (pn) pn.textContent = txt;
  // The arc fills the balance against the most credits the account has held.
  // Floor that reference at the 20-credit starting grant (every account begins
  // there) so a spent-down or freshly-read low balance reads near-empty instead
  // of anchoring the gauge to itself. parseFloat (not parseInt) keeps fractional
  // maxes intact now that orchestrator use spends fractions.
  const CRED_GRANT = 20;
  let max = Math.max(n, CRED_GRANT);
  try {
    max = Math.max(n, CRED_GRANT, parseFloat(localStorage.getItem(CRED_MAX_KEY)) || 0);
    localStorage.setItem(CRED_MAX_KEY, String(max));
  } catch {}
  const frac = max > 0 ? Math.max(0, Math.min(1, n / max)) : 0;
  setArcFill(document.getElementById('credArc'), frac);
  setArcFill(document.getElementById('credArcMenu'), frac);
  const pill = document.getElementById('credPill');
  if (pill) pill.classList.add('show');
}
// The account badge names the real membership tier (Plus / Pro / Max) when one
// is active; 'Member' for a paid top-up-only account (bought credits, no plan);
// 'Free plan' otherwise. The tier comes from the storage status (/api/storage).
function planLabelText() {
  const tier = galStorage && typeof galStorage.tier === 'string' ? galStorage.tier : '';
  if (tier && tier !== 'free') return tier.charAt(0).toUpperCase() + tier.slice(1);
  if (paidKnown && isPaid) return 'Member';
  if (paidKnown) return 'Free plan';
  return '';
}
function updatePlanTag() {
  const pt = document.getElementById('planTag');
  const l = planLabelText();
  if (pt && l) pt.textContent = l;
}
async function fetchCredits(attempt) {
  try {
    const r = await apiFetch('/api/credits');
    if (!r.ok) throw 0;
    const d = await r.json();
    if (typeof d.paid === 'boolean') {
      isPaid = d.paid; paidKnown = true; refreshVideoBadges();
      updatePlanTag();
      // Resolve the membership tier once so the badge can show Plus/Pro/Max
      // (not just 'Member') — even on the logged-in landing / before the gallery.
      if (!galStorage) refreshStorageBar();
    }
    if (typeof d.balance === 'number') { setCredits(d.balance); maybeShowWelcome(d.balance); }
  } catch {
    // Keep trying a few times so the paid flag (and balance) resolve — a
    // transient failure must not leave a paid user in the "unknown" state.
    const n = (attempt || 0) + 1;
    if (n <= 4) setTimeout(() => fetchCredits(n), 1500 * n);
  }
}

// Turn fal's error payload into one readable line. Validation errors arrive as
// {detail:[{loc:['body','video_url'],msg:'...'}]} (FastAPI-style) — name the
// field and the reason so a rejected input is diagnosable straight from chat.
function falErrorDetail(body) {
  try {
    const d = body && (body.detail ?? body.error ?? body.message);
    if (!d) return '';
    if (typeof d === 'string') return d.slice(0, 300);
    if (Array.isArray(d)) {
      return d.slice(0, 3).map((e) => {
        if (typeof e === 'string') return e;
        const field = Array.isArray(e.loc) ? e.loc.filter((p) => p !== 'body').join('.') : '';
        return (field ? field + ': ' : '') + (e.msg || e.message || JSON.stringify(e));
      }).join(' · ').slice(0, 400);
    }
    return JSON.stringify(d).slice(0, 300);
  } catch { return ''; }
}

// A fal-confirmed failure means fal never billed us — ask the server to refund
// the charge (it independently re-verifies the failure with fal). Returns the
// refunded credit amount, and refreshes the balance display when it's non-zero.
async function requestRefund(statusUrl) {
  if (!statusUrl) return 0;
  try {
    const r = await apiFetch('/api/refund', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusUrl }),
    });
    if (!r.ok) return 0;
    const d = await r.json().catch(() => ({}));
    const n = Number(d.refunded) || 0;
    if (n > 0) fetchCredits();
    return n;
  } catch { return 0; }
}

// One-time welcome banner for fresh accounts: makes the signup grant feel
// intentional and points at the plans. Shows only while the account still
// looks new (grant-sized balance, no chat history), until dismissed.
const WELCOME_KEY = 'zephyr_welcome_v1';
function maybeShowWelcome(balance) {
  try {
    if (localStorage.getItem(WELCOME_KEY)) return;
    if (isPaid) return; // never greet a paying member with the free-credits modal
    if (typeof balance !== 'number' || balance <= 0 || balance > 20) return;
    if ((chatStore.chats || []).some((c) => c.msgs && c.msgs.length)) return;
    if (document.querySelector('.credits-overlay')) return;
    const ov = document.createElement('div');
    ov.className = 'credits-overlay welcome-ov';
    ov.innerHTML = '<div class="wm-box">' +
      '<button type="button" class="wm-x" aria-label="Close">✕</button>' +
      '<div class="wm-star">✦</div>' +
      '<h2 class="wm-title">Welcome to isibi</h2>' +
      '<div class="wm-grant">' + balance + ' free credits, on us</div>' +
      '<p class="wm-sub">Enough for a few images or a voice line — every model, one balance. Ready for video? Plans start at $24.99/mo.</p>' +
      '<button type="button" class="wm-cta">Start generating</button>' +
    '</div>';
    const dismiss = () => { try { localStorage.setItem(WELCOME_KEY, '1'); } catch {} ov.remove(); };
    ov.onclick = (e) => { if (e.target === ov) dismiss(); };
    ov.querySelector('.wm-x').onclick = dismiss;
    ov.querySelector('.wm-cta').onclick = () => {
      dismiss();
      showView('home');
      const inp = document.getElementById('input');
      if (inp) inp.focus();
    };
    document.body.appendChild(ov);
  } catch {}
}

// ── Membership panel: monthly credits, three tiers ─────────────────────────
// Feature matrix is a capacity ladder (all models on every tier; higher tiers
// buy room for more output). Strike prices are the launch-offer framing —
// the charged price is always `usd`.
// Output equivalences are DERIVED from the live price tables so they can never
// drift from what a generation actually costs: a Nano Banana 2 image and a
// 5-second Kling 3.0 Standard video, at pure fal cost (no director surcharge —
// AI is the separate Orchestrator add-on now).
const IMG_CR = Math.max(1, Math.ceil(0.08 / CREDIT_USD));          // Nano Banana 2
const VID_CR = Math.max(1, Math.ceil((0.126 * 5) / CREDIT_USD));   // Kling 3.0 Std 5s
const roundTo = (n, step) => Math.round(n / step) * step;
const estImages = (cr) => roundTo(cr / IMG_CR, 10).toLocaleString();
const estVideos = (cr) => roundTo(cr / VID_CR, 5);
const MEMBERSHIPS = [
  { plan: '25', usd: 24.99, credits: 2000, name: 'Plus', klass: 't-plus', off: '10% OFF', strike: 28,
    desc: 'For getting started with AI creation', storage: '10 GB',
    save: 'Save $3/mo while the launch offer lasts',
    feats: [1, 1, 1] },
  { plan: '50', usd: 49.99, credits: 4000, name: 'Pro', klass: 't-pro best', off: '20% OFF', strike: 63, pop: 1,
    desc: 'For consistent, everyday creation', storage: '50 GB',
    save: 'Save $13/mo while the launch offer lasts',
    feats: [1, 1, 1] },
  { plan: '100', usd: 99.99, credits: 8000, name: 'Max', klass: 't-max', off: '25% OFF', val: 'Best value', strike: 133,
    desc: 'For creators building big projects', storage: '100 GB',
    save: 'Save $33/mo while the launch offer lasts',
    feats: [1, 1, 1] },
];
// Launch offer is a rolling window: it always ends N days out, computed at open
// time, so the countdown can never freeze into "Ends in soon".
const OFFER_WINDOW_DAYS = 5;
const MEMBER_ROWS = [
  'All video, image &amp; voice models',
  'No watermark on your files',
  'Unused credits roll over',
];
const TOPUPS = [
  { topup: '15', usd: 15, credits: 1070 },
  { topup: '30', usd: 30, credits: 2140 },
  { topup: '50', usd: 50, credits: 3570 },
  { topup: '75', usd: 75, credits: 5350 },
  { topup: '100', usd: 100, credits: 7140 },
];

// Focused upsell for the AI Orchestrator add-on ($19.99/mo, at cost). Opened
// from the locked Orchestrator switch and the pricing page's add-on band.
function openCredits(topupsOnly) {
  if (document.querySelector('.credits-overlay')) return;
  document.getElementById('profilePop')?.classList.remove('open'); // don't leave the menu open behind the overlay
  const ov = document.createElement('div');
  ov.className = 'credits-overlay' + (topupsOnly ? '' : ' up-overlay');
  // Full "Upgrade your plan" page: promo hero + three plan cards with feature
  // lists, modelled on the pricing mockup and kept in the isibi theme.
  const cards = MEMBERSHIPS.map((p) =>
    '<button type="button" class="up-card ' + p.klass + '" data-plan="' + p.plan + '">' +
      (p.pop ? '<div class="up-badge">★ Most popular</div>' : '') +
      '<div class="up-namerow">' +
        '<span class="up-pname">' + p.name + '</span>' +
        (p.off ? '<span class="up-chip off">' + p.off + '</span>' : '') +
        (p.val ? '<span class="up-chip val">✦ ' + p.val + '</span>' : '') +
      '</div>' +
      '<div class="up-desc">' + p.desc + '</div>' +
      '<div class="up-credbox">' +
        '<div class="up-credmain"><span class="up-star">✦</span> ' + p.credits.toLocaleString() + ' credits/mo.</div>' +
        '<div class="up-credroll">✓ Unused credits roll over</div>' +
      '</div>' +
      '<div class="up-priceline">' +
        (p.strike ? '<span class="up-strike">$' + p.strike + '</span>' : '') +
        '<span class="up-pprice">$' + p.usd + '</span>' +
        '<span class="up-permo">per month</span>' +
      '</div>' +
      '<span class="up-buy">Get ' + p.name + '</span>' +
      '<div class="up-save">' + p.save + '</div>' +
      '<ul class="up-feat">' + MEMBER_ROWS.map((row, i) =>
        '<li class="' + (p.feats[i] ? 'ok' : 'no') + '">' + row + '</li>').join('') +
        '<li class="ok">' + p.storage + ' gallery storage</li>' + '</ul>' +
    '</button>').join('');
  // Top-ups-only view (from the profile menu) is a quiet list — credits left,
  // price right, hairline separators.
  const rows = TOPUPS.map((p) =>
    '<button type="button" class="cp-lrow" data-topup="' + p.topup + '">' +
      '<span class="cp-lcr">✦ ' + p.credits.toLocaleString() + '</span>' +
      '<span class="cp-lusd">$' + p.usd + '</span>' +
    '</button>').join('');
  const inner = topupsOnly
    ? '<div class="cp-head"><div class="cp-title">Top-up credits</div><button type="button" class="cp-close">✕</button></div>' +
      '<div class="cp-list">' + rows + '</div>' +
      '<div class="cp-note" id="cpNote"></div>'
    : '<button type="button" class="cp-close up-close">✕</button>' +
      '<div class="up-promo up-promo-timer">' +
        '<span class="up-spark s1">✦</span><span class="up-spark s2">✦</span>' +
        '<div class="up-segs">' +
          '<div class="up-seg"><b id="upcD">00</b><span>Days</span></div>' +
          '<span class="up-colon">:</span>' +
          '<div class="up-seg"><b id="upcH">00</b><span>Hours</span></div>' +
          '<span class="up-colon">:</span>' +
          '<div class="up-seg"><b id="upcM">00</b><span>Min</span></div>' +
          '<span class="up-colon">:</span>' +
          '<div class="up-seg"><b id="upcS">00</b><span>Sec</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="up-headwrap">' +
        '<div class="up-eyebrow">Membership</div>' +
        '<h1 class="up-h1">Upgrade your plan</h1>' +
        '<p class="up-sub">Fresh credits every month at a better rate than one-time top-ups — unused credits roll over, and you can cancel anytime.</p>' +
      '</div>' +
      '<div class="up-grid">' + cards + '</div>' +
      '<div class="cp-note up-note" id="cpNote"></div>' +
      '<div class="up-trust"><span>Secure checkout</span><span>Cancel anytime</span><span>Every model included</span><span>Credits roll over</span></div>' +
      '<div class="up-topnote">Just need a one-off? <button type="button" class="up-topup-link">Grab a one-time top-up →</button></div>';
  ov.innerHTML = '<div class="cp-box' + (topupsOnly ? ' cp-narrow' : ' cp-wide') + '">' + inner + '</div>';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  ov.querySelector('.cp-close').onclick = () => ov.remove();
  const topupLink = ov.querySelector('.up-topup-link');
  if (topupLink) topupLink.onclick = () => { ov.remove(); openCredits(true); };
  // Live launch-offer countdown, painted into the four segment boxes; the
  // interval dies with the overlay.
  const segD = ov.querySelector('#upcD'), segH = ov.querySelector('#upcH'),
        segM = ov.querySelector('#upcM'), segS = ov.querySelector('#upcS');
  if (segD) {
    // Rolling per-browser window: anchor to a stored end date; if it's missing
    // or already elapsed, start a fresh N-day window. The clock always shows a
    // real, consistent countdown and never freezes into a broken "soon".
    const OFFER_KEY = 'zephyr_offer_end_v1';
    let end = parseInt(localStorage.getItem(OFFER_KEY) || '0', 10) || 0;
    if (!end || end - Date.now() <= 0) {
      end = Date.now() + OFFER_WINDOW_DAYS * 86400000;
      try { localStorage.setItem(OFFER_KEY, String(end)); } catch {}
    }
    const two = (n) => String(n).padStart(2, '0');
    const tick = () => {
      const ms = Math.max(0, end - Date.now());
      segD.textContent = two(Math.floor(ms / 86400000));
      segH.textContent = two(Math.floor((ms % 86400000) / 3600000));
      segM.textContent = two(Math.floor((ms % 3600000) / 60000));
      segS.textContent = two(Math.floor((ms % 60000) / 1000));
    };
    tick();
    const tid = setInterval(() => {
      if (!document.body.contains(ov)) { clearInterval(tid); return; }
      tick();
    }, 1000);
  }
  ov.querySelectorAll('.cp-card, .cp-lrow, .up-card').forEach((c) => {
    c.onclick = async () => {
      const note = document.getElementById('cpNote');
      note.textContent = 'Opening secure checkout…';
      try {
        const r = await apiFetch('/api/checkout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(c.dataset.plan ? { plan: c.dataset.plan } : { topup: c.dataset.topup }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.status === 501) { note.textContent = 'Payments are switching on very soon — this is where you\'ll buy them.'; return; }
        if (r.ok && d.url) { note.textContent = 'Taking you to checkout…'; location.href = d.url; return; }
        note.textContent = 'Checkout hit a snag — try again in a moment.';
      } catch {
        note.textContent = 'Checkout hit a snag — try again in a moment.';
      }
    };
  });
  document.body.appendChild(ov);
}

// Stop a chat's generation: kill the fal job too (queued jobs never bill),
// drop the loader, and free the chat.
async function cancelGen(chatId) {
  const gen = activeGens.get(chatId);
  if (!gen) return;
  const statusUrl = gen.statusUrl;
  endGen(chatId);
  if (statusUrl) {
    // Tell fal to cancel, then refund — but only if fal confirms the job never
    // ran (CANCELED while queued = fal didn't bill us). requestRefund re-checks
    // fal's status, so a job that had already started/completed isn't refunded.
    try {
      await apiFetch('/api/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: statusUrl.replace(/\/status\b.*$/, '/cancel') }),
      });
    } catch {}
    const refunded = await requestRefund(statusUrl);
    deliverAgent(chatId, refunded > 0
      ? '⏹ Cancelled — your ' + refunded + (refunded === 1 ? ' credit was' : ' credits were') + ' refunded.'
      : '⏹ Cancelled. If the run had already started, its credits were used.');
    return;
  }
  deliverAgent(chatId, '⏹ Cancelled.');
}

// Failures become a conversation: isibi.ai explains what went wrong in plain
// words and, when a rewording could fix it, offers a corrected prompt.
// Returns false if the director can't help so the generic message shows.
async function explainFailure(origin, kind, genPrompt, job) {
  try {
    const res = await apiFetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'error', kind, prompt: genPrompt || '(no prompt)',
        error: JSON.stringify(job || {}).slice(0, 700),
        ...directorContext(),
      }),
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    if (!data.reply) throw 0;
    deliverAgent(origin, data.reply);
    if (data.prompt && chatStore.active === origin) reviewPrompt(data.prompt);
    return true;
  } catch { return false; }
}

// Turn fal/worker failures into human messages; the raw detail goes to the console.
function friendlyFail(job) {
  console.error('generation failed:', job);
  const raw = JSON.stringify(job || {});
  if (/daily limit/i.test(raw)) return "⚠️ You've hit today's generation limit — it resets within 24 hours.";
  if (/exhausted balance|user is locked/i.test(raw)) return '⚠️ Generation is paused — the fal.ai balance ran out. Top it up and try again.';
  if (/content|safety|nsfw|moderation/i.test(raw)) return '⚠️ That prompt was blocked by the model’s content filter — rephrase it and try again.';
  if (/validation|invalid|must be|unprocessable/i.test(raw)) return '⚠️ Those settings didn’t work for this model — tweak duration, ratio or quality and try again.';
  if (job && job.error === 'unknown model') return '⚠️ That model isn’t available right now — pick another from the menu.';
  return '⚠️ Couldn’t start the generation — give it another try in a moment.';
}

async function generateMedia(text, opts = {}) {
  const origin = chatStore.active; // deliver results here even if the user switches chats
  if (activeGens.has(origin)) {
    addMsg('agent', '⚠️ Hold on — this chat is already generating. Start a new chat to run another.');
    return;
  }
  // A paused-but-unfinished (already-charged) render for this chat must not be
  // clobbered by a new run — starting one would overwrite its resume record and
  // strand the paid job forever (the exact way a slow render gets lost). Pick it
  // back up instead of charging for a second generation.
  const pending = jobsLoad().find((j) => j.chatId === origin && (j.statusUrl || j.idem) && (j.tries || 0) < 4);
  if (pending) {
    addMsg('agent', '⏳ Your previous render is still finishing — picking it back up now (you won’t be charged again).');
    resumeOne(pending);
    return;
  }
  if (opts.announce !== false) { addMsg('user', text || '🎬 Lip-sync from the attached media'); await pushRefStrip(); }
  // Remember what we generated with, so "make it slower" can revise it later.
  const originChat = activeChat();
  if (originChat && text && mode !== 'audio') { originChat.lastPrompt = text; persistStore(); touchSync(originChat.id); }

  const kind = mode;
  const label = document.getElementById('modelLabel').textContent;
  // Kling multi-shot: only a Kling t2v generation with nothing attached can send
  // a shot list (the worker double-gates the same way). null otherwise.
  const genShots = (kind === 'video' && shotsApply(model) && sanitizeShots(opts.shots)) || null;
  // Director-driven knobs (silent flag / negative list / voice tuning) — the
  // worker re-validates and applies each only where the endpoint supports it.
  const genExtras = sanitizeExtras(opts.extras) || {};
  // Identity token: cancel deletes it, and a fresh generation in this chat
  // replaces it — either way this run notices and quietly stops.
  const myGen = { kind, aspect: ratioAspect(ratio), text: 'Sending to ' + label, statusUrl: null };
  const alive = () => activeGens.get(origin) === myGen;
  activeGens.set(origin, myGen);
  updateSendLock();
  mountGenLoader();

  const apiPath = kind === 'image' ? '/api/image' : kind === 'audio' ? '/api/audio' : '/api/video';
  // Idempotency key: stamped once per submit. If the response is lost after the
  // worker may have charged, a re-POST with this SAME key returns the stored job
  // (no second charge) instead of orphaning a paid render. The provisional
  // record below survives a dropped reply so auto-resume can do that recovery.
  const idem = (self.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12));
  myGen.idem = idem;
  jobRecord(origin, { kind, idem, apiPath, model, text: text ? String(text).slice(0, 400) : '', label, aspect: myGen.aspect, provisional: true });
  try {
    const res = await apiFetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        idem,
        prompt: text,
        image: attachments.image || undefined,
        images: extraImages.length ? extraImages.slice() : undefined,
        avatar: attachments.avatar || undefined,
        end: attachments.end || undefined,
        first: attachments.ffirst || undefined, // Veo first-&-last-frame
        last: attachments.flast || undefined,
        refs: refList.length ? refList.slice() : undefined, // Veo reference-to-video
        elements: elList.length ? elList.slice() : undefined, // Kling @ElementN characters
        keyframes: kfList.length ? kfList.slice() : undefined, // Ray timeline keyframes
        audio: attachments.audio || undefined,
        audioDuration: attachments.audio && awDur ? awDur : undefined, // lip-sync models bill by clip length
        clip: attachments.clip || undefined,
        clipDuration: attachments.clip && clipMeta && clipMeta.dur ? clipMeta.dur : undefined, // LipSync bills on the clip's length
        shots: genShots || undefined, // Kling multi_prompt shot-list (t2v, or i2v with start/end frames)
        mask: (kind === 'image' && maskCapable() && maskData) ? maskData : undefined, // GPT inpainting region
        size: (kind === 'image' && currentOpts().sizes) ? gptSize : undefined, // GPT resolution tier (1K/2K/4K)
        sound: genExtras.sound, // false = explicit silent request (cheaper on Veo/Kling)
        negative: genExtras.negative, // things to exclude (Kling v3 / Veo only)
        cfg: kind === 'video' ? genExtras.cfg : undefined, // Kling v3 prompt-adherence 0-1
        bitrate: kind === 'video' ? genExtras.bitrate : undefined, // Seedance 'high' encode (free)
        shotType: kind === 'video' ? genExtras.shotType : undefined, // Kling 'intelligent' auto-cuts
        controls: kind === 'video' ? genExtras.controls : undefined, // Ray v2v per-signal conditioning
        stability: kind === 'audio' ? genExtras.stability : undefined, // voice delivery tuning
        speed: kind === 'audio' ? genExtras.speed : undefined,
        style: kind === 'audio' ? genExtras.style : undefined,

        duration: kind === 'video' && currentOpts().durations ? duration : undefined,
        ratio: currentOpts().ratios ? ratio : undefined,
        quality: currentOpts().resolutions ? quality : undefined, // video resolution OR image tier (Nano 2K/4K)
        hdr: kind === 'video' && hdrOn && currentOpts().hdr ? true : undefined,
        exr: kind === 'video' && exrOn && currentOpts().hdr ? true : undefined,
        loop: kind === 'video' && loopOn && currentOpts().loop ? true : undefined,
        editMode: kind === 'video' && currentOpts().v2v && attachments.clip && editMode !== 'auto' ? editMode : undefined,
        voice: (kind === 'audio' || (currentOpts() || {}).voices) ? voice : undefined,
        num: kind === 'image' && currentOpts().nums && numImages > 1 ? numImages : undefined,
        // effort/director ride along for observability only — generations bill
        // pure fal cost; the orchestrator is metered per-call on /api/direct.
        effort: effort,
        director: (directorMode === 'off' || (currentOpts() && currentOpts().noPrompt)) ? 'off' : 'on',
      }),
    });
    if (res.status === 401) { // session died — stop cleanly, the gate is up
      endGen(origin);
      deliverAgent(origin, '⚠️ Your session expired — sign in and try again.');
      return;
    }
    const job = await res.json().catch(() => ({})); // a non-JSON error body must not throw past the status checks
    if (!alive()) {
      jobClear(origin); // cancelled mid-submit — drop the provisional so it isn't "recovered" later
      // Cancelled while we were still submitting. If fal accepted the job the
      // Worker has already charged us (charge-after-fal-accepts) and the
      // status_url only reaches us now — so cancel the job and reclaim the
      // credits here, or the render is paid for but orphaned with no refund.
      if (job && job.status_url) {
        try {
          await apiFetch('/api/cancel', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: job.status_url.replace(/\/status\b.*$/, '/cancel') }),
          });
        } catch {}
        const refunded = await requestRefund(job.status_url); // re-checks fal status; only refunds a job that never ran
        if (refunded > 0) deliverAgent(origin, '↩ ' + refunded + (refunded === 1 ? ' credit was' : ' credits were') + ' refunded.');
      }
      return;
    }
    if (res.status === 402) { // out of credits — nothing was spent
      endGen(origin);
      deliverAgent(origin, '⚡ Not enough credits — this run needs ' + (job.cost ? job.cost + ' credits' : 'more than you have') + '. Tap your ✦ balance up top to get more.');
      return;
    }
    // Need both URLs: a status_url with no response_url would poll forever and
    // then fetch `url=undefined`, dropping a charged render.
    if (!res.ok || !job.status_url || !job.response_url) {
      endGen(origin);
      if (!(await explainFailure(origin, kind, text, job))) deliverAgent(origin, friendlyFail(job));
      return;
    }
    if (typeof job.balance === 'number') setCredits(job.balance);
    myGen.statusUrl = job.status_url; // lets Stop cancel the job on fal too

    // 4K renders and video-to-video edits (a full re-render of the source
    // clip — Kling o3 routinely runs past ten minutes) get twenty minutes.
    const maxWaitMin = kind === 'video' && (quality === '4k' || attachments.clip) ? 20 : 10;
    const deadline = Date.now() + maxWaitMin * 60 * 1000;
    // On record until endGen clears it — a refreshed tab resumes this at boot.
    jobRecord(origin, {
      kind, statusUrl: job.status_url, responseUrl: job.response_url,
      text: text ? String(text).slice(0, 400) : '', label, aspect: myGen.aspect, deadline,
    });
    await pollAndDeliver(origin, kind, job.status_url, job.response_url, text, label, deadline, maxWaitMin, myGen, true);
  } catch {
    // The request may have reached the worker and charged before the reply was
    // lost. KEEP the provisional record (written above) and let auto-resume
    // recover the job by idem, rather than clearing it and stranding a paid
    // render. pauseGen frees the loader + schedules the recovery.
    if (alive()) { deliverAgent(origin, '⚠️ Connection dropped — checking whether that render went through…'); pauseGen(origin); }
  } finally {
    if (alive()) endGen(origin);
    if (chatStore.active === origin) document.getElementById('input').focus();
  }
}

// The wait-save-deliver half of a generation, shared by a live submit and a
// boot-time resume: poll fal until done, copy outputs to permanent storage,
// deliver into the origin chat.
async function pollAndDeliver(origin, kind, statusUrl, responseUrl, text, label, deadline, maxWaitMin, myGen, clearInputs) {
  const alive = () => activeGens.get(origin) === myGen;
  let softErrors = 0; // consecutive transient poll failures
  try {
    let state = '';
    while (Date.now() < deadline) {
      let sr, st;
      try {
        sr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(statusUrl));
        if (sr.status === 401) {
          // Session expired mid-render — KEEP the record so boot-resume (after
          // re-sign-in) finishes the paid render instead of dropping it.
          if (alive()) { jobBumpTries(origin); pauseGen(origin, false); deliverAgent(origin, '⚠️ Your session expired mid-generation — sign back in and the app will pick this up.'); }
          return;
        }
        if (!sr.ok) {
          // 404/410 = fal no longer has this job (expired/cancelled) → terminal.
          if (sr.status === 404 || sr.status === 410) {
            if (alive()) { endGen(origin); deliverAgent(origin, '⚠️ This render is no longer available on fal — please try again.'); }
            return;
          }
          // Any other non-OK (proxy 502, upstream 5xx) is a transient tick, like
          // a network drop — count it so a JSON error body can't spin the loader
          // to the deadline.
          if (!alive()) return;
          if (++softErrors >= 15) { jobBumpTries(origin); pauseGen(origin); deliverAgent(origin, '⚠️ Lost the connection while this was rendering — it keeps going on fal, and the app will pick it back up automatically.'); return; }
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        st = await sr.json();
        softErrors = 0; // a good tick resets the streak
      } catch {
        // Transient network drop: don't kill the run — the record survives, so
        // the poll simply retries next tick (or resumes at boot). Give up the
        // in-memory loader only after a sustained outage (~1 min).
        if (!alive()) return;
        if (++softErrors >= 15) {
          jobBumpTries(origin);
          pauseGen(origin);
          deliverAgent(origin, '⚠️ Lost the connection while this was rendering — it keeps going on fal, and the app will pick it back up automatically.');
          return;
        }
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }
      if (!alive()) return; // cancelled while polling
      state = st.status;
      if (state === 'COMPLETED') break;
      // fal reached a terminal failure — stop now instead of spinning the
      // loader until the deadline. The job is dead; clear the record so it
      // isn't re-polled at boot.
      if (state === 'FAILED' || state === 'ERROR' || state === 'CANCELED' || state === 'CANCELLED') {
        endGen(origin);
        const refunded = await requestRefund(statusUrl); // fal didn't bill us — credit it back
        deliverAgent(origin, '⚠️ The model couldn\'t finish this generation — please try again' + (kind === 'video' ? ', or tweak the prompt' : '') + '.'
          + (refunded > 0 ? ' Your ' + refunded + (refunded === 1 ? ' credit was' : ' credits were') + ' refunded.' : ''));
        return;
      }
      myGen.model = label;
      setGenText(origin,
        state === 'IN_PROGRESS'
          ? theaterLine(myGen, kind)
          : 'In the render queue' + (st.queue_position != null ? ' — #' + st.queue_position : '') + '…');
      await new Promise((r) => setTimeout(r, 4000));
      if (!alive()) return;
    }

    if (state !== 'COMPLETED') {
      // Ran past the deadline but the job is still live on fal (and already
      // charged). Keep the refresh-proof record — bounded by tries — so
      // boot-resume gets it, rather than clearing a paid render here.
      jobBumpTries(origin);
      pauseGen(origin);
      deliverAgent(origin, '⚠️ Timed out after ' + maxWaitMin + ' minutes — the job may still finish on fal.ai; the app will pick it back up automatically.');
      return;
    }

    // The job COMPLETED on fal and is already charged. A non-OK result fetch
    // (the poll proxy's timeout returns a parseable {error} body; or a 401) is
    // transient — a big render's result endpoint can be slow. Retry inline a few
    // times before falling back to boot-resume, so the paid render lands here
    // instead of making the user reopen the app.
    let rr = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      rr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(responseUrl));
      if (!alive()) return;
      if (rr.ok) break;
      // A client error (422 invalid input, 400, 404 gone) is terminal — the
      // render won't ever produce a result, so stop retrying and refund (fal
      // doesn't bill a rejected job). 401 is a session issue, handled elsewhere.
      if (rr.status >= 400 && rr.status < 500 && rr.status !== 401 && rr.status !== 408 && rr.status !== 429) {
        endGen(origin);
        // fal's validation payload names the exact field and reason
        // ({detail:[{loc,msg}]}) — surface it verbatim so a rejected input is
        // diagnosable from the chat instead of a generic shrug.
        const errBody = await rr.json().catch(() => ({}));
        console.error('fal rejected render:', rr.status, errBody);
        const why = falErrorDetail(errBody);
        const refunded = await requestRefund(statusUrl);
        deliverAgent(origin, '⚠️ fal rejected this render (' + rr.status + ')'
          + (why ? ' — ' + why : ' — the clip or prompt didn’t pass its input checks') + '. Nothing was produced'
          + (refunded > 0 ? '; your ' + refunded + (refunded === 1 ? ' credit was' : ' credits were') + ' refunded.' : '.'));
        return;
      }
      if (attempt === 0) setGenText(origin, 'Finishing up…');
      await new Promise((r) => setTimeout(r, 3000));
      if (!alive()) return;
    }
    if (!rr || !rr.ok) {
      // Still not back — keep the refresh-proof record and let boot-resume
      // re-fetch, rather than reading the error body as "no media".
      jobBumpTries(origin);
      pauseGen(origin);
      deliverAgent(origin, '⚠️ The render finished — I’m still pulling it in; it’ll appear here in a moment automatically.');
      return;
    }
    const out = await rr.json().catch(() => ({}));
    // Images may come back as several variations; video/audio is a single URL.
    let urls = [];
    if (kind === 'image') {
      urls = (out.images || out.data?.images || []).map((i) => i && i.url).filter(Boolean);
      if (!urls.length && out.image?.url) urls = [out.image.url];
    } else {
      const single = kind === 'audio'
        ? (out.audio?.url || out.audio_url || out.audio_file?.url || out.audio?.[0]?.url || out.data?.audio?.url)
        : (out.video?.url || out.video_url || out.videos?.[0]?.url || out.data?.video?.url);
      if (single) urls = [single];
    }
    // Claim delivery only now that the result is in hand: claiming earlier meant
    // a failed result-fetch burned the claim and the paid render was dropped on
    // boot-resume. Another tab that already delivered this job wins the claim;
    // we stop without clearing so the winner's record management stands.
    if (!(await claimDelivery(statusUrl))) { jobBumpTries(origin); pauseGen(origin, false); return; } // another tab delivered this — don't re-poll
    // HDR + EXR runs return a pro sidecar file alongside the video — hand the
    // link over in chat (it's a pro-pipeline file; fal links expire in days).
    if (out.exr_file && out.exr_file.url) {
      deliverAgent(origin, '🎞 EXR sidecar ready (pro HDR frame data): ' + out.exr_file.url + ' — download it soon, the link expires in a few days.');
    }
    if (urls.length) {
      // Copy to permanent storage — fal URLs expire after a few days.
      setGenText(origin, urls.length > 1 ? 'Saving ' + urls.length + ' images…' : 'Saving to your gallery…');
      const finals = [];
      let saveFailed = false;
      let blocked = null;
      // QR burn (video only): a per-message directive (chat.qr from a
      // conversational instruction) wins; a product-URL chat auto-burns the
      // product link whole-video as the fallback. `off` suppresses both.
      const originChat = chatStore.chats.find((c) => c.id === origin);
      let qr = null;
      if (kind === 'video' && originChat) {
        const d = originChat.qr;
        if (d && d.off) qr = null;
        else if (d && d.url) qr = d;
        else if (d && d.want && !d.url) {
          deliverAgent(origin, 'ℹ️ I couldn’t add the QR — tell me the link it should point to (paste the URL) and I’ll stamp it on the next one.');
        } else if (originChat.productUrl) qr = { url: originChat.productUrl };
      }
      for (const u of urls) {
        if (qr) {
          const burned = await saveVideoWithQr(u, qr, origin);
          if (burned && burned.url) { finals.push(burned.url); continue; }
          setGenText(origin, 'Saving to your gallery…'); // burn skipped/failed — normal path
        }
        const { url: perm, block } = await saveOutput(u, kind);
        if (perm) finals.push(perm);
        else if (block) { // paid gate — don't queue a doomed retry
          // Free tier can't save, so the server-side image watermark never ran —
          // burn it in client-side and deliver the marked copy on the temp link.
          const marked = (block === 'free' && kind === 'image') ? await burnImageWatermark(u) : null;
          finals.push(marked || u); blocked = block;
        }
        else { finals.push(u); saveFailed = true; queuePendingSave(u, kind); }
      }
      if (!alive()) return;
      endGen(origin);
      finals.forEach((f) => deliverMedia(origin, kind, f, text));
      if (blocked === 'free') deliverAgent(origin, 'ℹ️ Saving to your gallery is a paid feature — this one is a temporary link. Upgrade to keep your generations in the gallery.');
      else if (blocked === 'full') deliverAgent(origin, '⚠️ Your gallery storage is full, so this is a temporary link. Free up space in the gallery or move up a tier to keep saving.');
      else if (saveFailed) deliverAgent(origin, '⚠️ Delivered with a temporary link — the gallery copy failed, so I queued a retry for the next time the app opens.');
      // The inputs were consumed — clear them so they don't ride the next
      // prompt. Only when the user is still on this chat: a background finish
      // must not wipe attachments they've since staged in another chat.
      delete stagedByChat[origin]; // consumed — never restore stale inputs on switch-back
      if (clearInputs && chatStore.active === origin) {
        Object.keys(attachments).forEach((k) => {
          if (attachments[k]) { attachments[k] = null; renderAttach(k); }
        });
        extraImages.length = 0;
        renderExtraImages();
        refList.length = 0;
        elList.length = 0;
        renderRefList();
        renderElList();
      }
    } else {
      endGen(origin);
      console.error('generation finished without media:', out);
      deliverAgent(origin, '⚠️ The model finished but returned no ' + kind + ' — try again.');
    }
  } catch {
    // Completed-but-couldn't-fetch-the-result, or any other late failure: the
    // job is (or was) live on fal and already charged, so keep the record and
    // let boot-resume finish the delivery rather than dropping a paid render.
    if (alive()) { jobBumpTries(origin); pauseGen(origin); deliverAgent(origin, '⚠️ Hit a snag fetching the result — the app will pick it back up automatically.'); }
  } finally {
    if (alive()) pauseGen(origin); // never jobClear here — only terminal paths clear
    if (chatStore.active === origin) document.getElementById('input').focus();
  }
}

// ── Director flow (isibi.ai) ───────────────────────────────────────────────
// Sonnet 5 drives the director via /api/direct. If the key isn't set (501)
// or the call fails, we fall back to these local placeholders so the flow
// still works.
// The last few chat turns, so the director remembers the conversation.
function directorHistory() {
  const chat = activeChat();
  return (chat ? chat.msgs : [])
    .filter((m) => m.t === 'user' || m.t === 'agent' || m.t === 'media')
    .slice(-8)
    .map((m) => m.t === 'media'
      // The director can't see media — give it a text marker so "another one
      // like the last one" means something.
      ? { role: 'assistant', text: '[generated a ' + (m.kind || 'media') + (m.prompt ? ' with prompt: "' + String(m.prompt).slice(0, 200) + '"' : '') + ']' }
      : { role: m.t === 'user' ? 'user' : 'assistant', text: String(m.text || '').slice(0, 400) });
}

// Generation context, so the director writes prompts for the actual target
// (model family, attachments, clip length) instead of guessing blind.
// ── Universal memory: one auto-learned taste list, applied to EVERY
// generation across all chats (not per-chat). Local (zephyr_memory_v1) plus a
// per-user Supabase row so it follows the account across devices. The composer
// evolves it on each approved generation; the Memory space shows/edits it. ──
const MEMORY_KEY = 'zephyr_memory_v1';
const MEMORY_ENDPOINT = SUPABASE_URL + '/rest/v1/user_memory';
let memoryState = { items: [], enabled: true, updatedAt: 0 };
function normMemItems(a) {
  return Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 140)).slice(0, 15) : [];
}
function loadMemory() {
  try {
    const s = JSON.parse(localStorage.getItem(MEMORY_KEY) || 'null');
    if (s && typeof s === 'object') memoryState = { items: normMemItems(s.items), enabled: s.enabled !== false, updatedAt: s.updatedAt || 0 };
  } catch {}
}
function persistMemory(touch) {
  if (touch) memoryState.updatedAt = Date.now();
  try { localStorage.setItem(MEMORY_KEY, JSON.stringify(memoryState)); } catch {}
}
function memoryEnabled() { return memoryState.enabled !== false; }
function memoryItems() { return normMemItems(memoryState.items); }
// Replace the learned taste with the composer's evolved list (on approval).
function commitMemory(items) {
  const clean = normMemItems(items);
  if (JSON.stringify(clean) === JSON.stringify(memoryState.items)) return; // no real change
  memoryState.items = clean;
  persistMemory(true);
  pushMemory();
}
async function pushMemory() {
  const h = await syncHeaders();
  const uid = window.Auth && Auth.userId ? Auth.userId() : '';
  if (!h || !uid) return;
  try {
    await fetch(MEMORY_ENDPOINT + '?on_conflict=user_id', {
      method: 'POST',
      headers: Object.assign({}, h, { Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ user_id: uid, items: memoryState.items, enabled: memoryState.enabled, updated_at: new Date(memoryState.updatedAt || Date.now()).toISOString() }),
    });
  } catch {}
}
async function pullMemory() {
  const h = await syncHeaders();
  if (!h) return;
  try {
    const res = await fetch(MEMORY_ENDPOINT + '?select=items,enabled,updated_at&limit=1', { headers: h });
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return;
    const r = rows[0];
    const remoteAt = Date.parse(r.updated_at) || 0;
    if (remoteAt > (memoryState.updatedAt || 0)) { // last-writer-wins on the whole object
      memoryState = { items: normMemItems(r.items), enabled: r.enabled !== false, updatedAt: remoteAt };
      persistMemory(false);
    }
  } catch {}
}

function directorContext() {
  return {
    model: model,
    duration: mode === 'video' ? duration : undefined,
    ratio: mode !== 'audio' ? ratio : undefined,
    // A "start image" is the Image slot or the First slot of a first-&-last pair;
    // the End frame is the End slot or the Last slot. Reference images are counted
    // separately so the director can cite them (Seedance) or lean on them (Veo).
    hasImage: !!(attachments.image || attachments.ffirst),
    hasEnd: !!(attachments.end || attachments.flast),
    // How many images are attached for an image edit/combine — so the composer
    // can describe EACH one's role ("the product from the first image on the
    // second image's background"). Nano references by position, not @tags.
    imageCount: mode === 'image' ? ((attachments.image ? 1 : 0) + extraImages.length) : undefined,
    // Every attachment the director can't render as an image (video clip,
    // avatar face, audio track) still gets flagged so the orchestrator KNOWS
    // it's there — never denies seeing it, and writes for the actual inputs.
    hasClip: mode === 'video' && !!attachments.clip,
    hasAvatar: mode === 'video' && !!attachments.avatar,
    hasAudio: mode === 'video' && !!attachments.audio,
    refCount: (mode === 'video' && refList.length) ? refList.length : undefined,
    elCount: (mode === 'video' && elList.length) ? elList.length : undefined,
    brief: (activeChat() || {}).brief || undefined,
    // Universal taste — only when enabled and there's something to apply.
    memory: memoryEnabled() && mode !== 'audio' && memoryItems().length ? memoryItems() : undefined,
    effort: effort,
  };
}

// The composer returns an updated per-chat creative brief AND an evolved
// universal taste list with each prompt; both only commit when the user
// APPROVES that prompt (so abandoned drafts never teach isibi anything).
let pendingBrief = null;
let pendingMemory = null;
// A multi-shot list (Kling t2v cut sequence) the composer may return alongside
// the prompt; rides through to generateMedia like the brief does.
let pendingShots = null;
// Director-driven knobs the composer may return alongside the prompt: sound
// (false = explicit silent request → cheaper audio-off billing where fal has
// it), negative (things to exclude — Kling v3/Veo), and voice delivery tuning
// (speed/stability/style — ElevenLabs). Same lifecycle as the brief/shots.
let pendingExtras = null;
function sanitizeExtras(data) {
  if (!data) return null;
  const out = {};
  if (data.sound === false) out.sound = false;
  if (typeof data.negative === 'string' && data.negative.trim()) out.negative = data.negative.trim().slice(0, 300);
  const num = (v, lo, hi) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : null);
  const stab = num(data.stability, 0, 1), spd = num(data.speed, 0.7, 1.2), sty = num(data.style, 0, 1);
  if (stab != null) out.stability = stab;
  if (spd != null) out.speed = spd;
  if (sty != null) out.style = sty;
  // Video knobs (all price-neutral; the worker re-validates every one):
  // cfg → Kling v3 prompt adherence · bitrate → Seedance high-bitrate encode ·
  // shotType → Kling auto-directed cuts · controls → Ray v2v per-signal dials.
  if (typeof data.cfg === 'number' && Number.isFinite(data.cfg)) out.cfg = Math.min(1, Math.max(0, data.cfg));
  if (data.bitrate === 'high') out.bitrate = 'high';
  if (data.shotType === 'intelligent') out.shotType = 'intelligent';
  if (data.controls && typeof data.controls === 'object' && !Array.isArray(data.controls)) out.controls = data.controls;
  return Object.keys(out).length ? out : null;
}
// Kling is the only family with multi_prompt (its t2v AND i2v endpoints take it).
function modelSupportsShots(m) {
  return /kling-video\/(?:o3\/pro|o3\/standard|v3\/pro|v3\/standard)\/text-to-video$/.test(m || model);
}
// Where a shot-list actually applies: Kling's t2v (nothing attached) AND its
// i2v endpoint (start/end/first-&-last frames — fal's schema takes multi_prompt
// there too). A clip routes to o3's video-to-video edit, which has NO
// multi_prompt, so any clip disables shots.
function shotsApply(m) {
  if (mode !== 'video' || !modelSupportsShots(m)) return false;
  if (attachments.clip || attachments.avatar || kfList.length) return false;
  // o3's reference endpoint takes multi_prompt too; v3 has no reference mode.
  return !refList.length || /kling-video\/o3\//.test(m || model);
}
// Validate a shots array from the director: 2-5 shots, each {prompt, 2-10s}.
// Returns a clean array, or null when it isn't a real multi-shot list.
function sanitizeShots(arr) {
  if (!Array.isArray(arr)) return null;
  const out = arr
    .filter((s) => s && typeof s.prompt === 'string' && s.prompt.trim())
    .map((s) => ({ prompt: s.prompt.trim().slice(0, 2500), duration: Math.min(10, Math.max(2, Math.round(+s.duration) || 5)) }))
    .slice(0, 5);
  return out.length >= 2 ? out : null;
}

// The director gets to SEE the attached image (downscaled — it only needs to
// understand the picture, not generate from it).
async function directorImage() {
  // Show the director whatever image is attached: the start image, the first
  // frame, or the first reference — so it can look before it writes.
  const src = attachments.image || attachments.ffirst || (mode === 'video' ? refList[0] || elList[0] : null);
  if (!src || mode === 'audio') return {};
  try {
    const img = new Image();
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = src; });
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
    if (scale === 1 && src.length < 1500000) return { image: src };
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return { image: canvas.toDataURL('image/jpeg', 0.85) };
  } catch { return {}; }
}

async function directorAsk(text, history, onDelta) {
  // Voice mode goes through the director too — it decides whether this is
  // chat ("hey", "how are you") or words to speak. Composing stays literal.
  try {
    const res = await apiFetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'ask', kind: mode, prompt: text, history: history || [], stream: true,
        qmode: directorMode, // tells the worker which prompt-help mode is active
        prevPrompt: (activeChat() || {}).lastPrompt || undefined,
        ...directorContext(), ...(await directorImage()),
      }),
    });
    // 402 = out of credits for the director → fall back to raw prompting (the
    // balance refresh is handled centrally in apiFetch).
    if (!res.ok) throw 0;
    // Streamed reply: render deltas live, then return the final payload.
    if ((res.headers.get('content-type') || '').includes('text/event-stream') && res.body) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '', final = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) !== -1) {
          const line = buf.slice(0, i).split('\n').find((l) => l.startsWith('data: '));
          buf = buf.slice(i + 2);
          if (!line) continue;
          let ev;
          try { ev = JSON.parse(line.slice(6)); } catch { continue; }
          if (ev.d && onDelta) onDelta(ev.d);
          if (ev.done) final = ev.done;
          if (ev.error) throw 0;
        }
      }
      if (!final) throw 0;
      // Taste learned from the conversation commits immediately — chat has no
      // approval gate (unlike compose, which waits for the user to run it).
      if (Array.isArray(final.memory)) commitMemory(final.memory);
      return {
        reply: final.reply || '',
        ready: !!final.ready,
        rerun: !!final.rerun,
        revise: !!final.revise,
        needsWeb: !!final.needsWeb,
      };
    }
    const data = await res.json();
    if (Array.isArray(data.memory)) commitMemory(data.memory);
    return {
      reply: data.reply || '',
      ready: !!data.ready,
      rerun: !!data.rerun,
      revise: !!data.revise,
      needsWeb: !!data.needsWeb,
    };
  } catch { return localAsk(text); }
}

// Surgical prompt revision: previous prompt + plain-words feedback → edited prompt.
async function directorRevise(feedback) {
  const prev = (activeChat() || {}).lastPrompt || '';
  pendingBrief = null; pendingMemory = null; pendingShots = null; pendingExtras = null;
  try {
    const res = await apiFetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'revise', kind: mode, prompt: feedback, prevPrompt: prev,
        history: directorHistory(), ...directorContext(), ...(await directorImage()),
      }),
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    if (data.brief) pendingBrief = String(data.brief).slice(0, 600);
    if (Array.isArray(data.memory)) pendingMemory = data.memory;
    pendingShots = sanitizeShots(data.shots);
    pendingExtras = sanitizeExtras(data);
    if (data.prompt) return data.prompt;
    throw 0;
  } catch { return prev ? prev + ' ' + feedback : feedback; }
}

async function directorCompose(text, answers, webFacts) {
  // Audio used to skip the writer entirely (speak the raw message verbatim),
  // which meant "make an audio of a woman screaming" got read out loud. With
  // the orchestrator on, the writer now interprets the request into the actual
  // words / vocal sounds to voice (see the audio branch in the worker). Raw
  // mode (orchestrator off) never reaches here, so it still speaks verbatim.
  pendingBrief = null; pendingMemory = null; pendingShots = null; pendingExtras = null;
  try {
    const res = await apiFetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'compose', kind: mode, prompt: text, answers: answers.filter(Boolean),
        webFacts: webFacts || undefined,
        history: directorHistory(), ...directorContext(), ...(await directorImage()),
      }),
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    if (data.brief) pendingBrief = String(data.brief).slice(0, 600);
    if (Array.isArray(data.memory)) pendingMemory = data.memory;
    pendingShots = sanitizeShots(data.shots);
    pendingExtras = sanitizeExtras(data);
    if (data.prompt) return data.prompt;
    throw 0;
  } catch { return mode === 'audio' ? text : localCompose(text, answers); }
}

function localAsk(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  // Greeting / small talk — just chat.
  if (words < 3) {
    return {
      reply: mode === 'audio'
        ? 'Hey! Type the words you want the voice to say and I’ll voice them.'
        : "Hey! Tell me what you'd like to create and I'll help you shape it.",
      ready: false,
    };
  }
  return { reply: '', ready: true };
}

function localCompose(text, answers) {
  const extra = answers.filter(Boolean).join(', ');
  return extra ? text + ' — ' + extra + '; highly detailed, professional quality.' : text;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function threadAppend(el) {
  const box = document.getElementById('messages');
  box.appendChild(el);
  scrollThreadBottom(box.parentElement); // near-bottom only — don't yank a user who scrolled up
}

async function startDirector(text) {
  const origin = chatStore.active;
  const history = directorHistory(); // prior turns only — capture before adding this one
  clearQDock(); // a fresh message supersedes any question still waiting
  addMsg('user', text);
  await pushRefStrip();
  const thinking = addMsg('agent typing', 'isibi.ai is thinking');
  // isibi.ai's reply is delivered through the normal path when the call ends,
  // which types it out word-by-word (like every other agent message).
  let res;
  try { res = await directorAsk(text, history); } finally { thinking.remove(); }
  // isibi.ai's conversational reply (greetings, small talk, or a lead-in).
  if (res.reply) deliverAgent(origin, res.reply);
  // If the user moved to another chat while isibi.ai was thinking, stop here —
  // don't pop question cards into the wrong thread.
  if (chatStore.active !== origin) return;
  // The director read the message as "run that again": the last prompt was
  // already approved once — straight back into generation, no re-interview.
  if (res.rerun && (activeChat() || {}).lastPrompt) {
    // For an edit (clip/image attached), never replay the stored prompt: it can
    // be a stale, oversized from-scratch treatment (e.g. saved before edits
    // switched to short instructions, or from a run that failed). Re-compose it
    // into a fresh SHORT edit instruction instead of dredging the old one up.
    if (isEditMode()) {
      if (!res.reply) deliverAgent(origin, '🔁 Giving it another go.');
      composeAndReview(activeChat().lastPrompt, [], false);
      return;
    }
    // Plan mode still gets the approval card (settings may have changed since
    // the last run) — deliverPrompt handles the mode split; Auto runs straight.
    if (!res.reply && directorMode !== 'plan') deliverAgent(origin, '🔁 Running it again.');
    deliverPrompt(activeChat().lastPrompt);
    return;
  }
  // Feedback on the previous generation — revise that prompt surgically.
  if (res.revise && (activeChat() || {}).lastPrompt) {
    const thinking2 = addMsg('agent typing', 'Revising the prompt');
    let prompt;
    try { prompt = await directorRevise(text); } finally { thinking2.remove(); }
    if (chatStore.active !== origin) return;
    deliverPrompt(prompt);
    return;
  }
  // A creative request — compose the prompt for review. If the director
  // flagged it as needing current real-world facts, research the web first.
  if (res.ready) composeAndReview(text, [], res.needsWeb);
  // Otherwise (greeting / small talk): the reply alone is the whole turn.
}

async function composeAndReview(text, answers, needsWeb) {
  const origin = chatStore.active;
  // Web-search first when the request depends on current real-world facts
  // (latest products, real specs) — the director's needsWeb judgment alone
  // decides; there's no user toggle. Failures degrade to no facts.
  let webFacts = '';
  if (needsWeb) {
    const looking = addMsg('agent typing', 'Looking it up on the web');
    let research = { facts: '', sources: [] };
    try { research = await directorResearch(text); } finally { looking.remove(); }
    if (chatStore.active !== origin) return;
    webFacts = research.facts || '';
    if (research.sources && research.sources.length) {
      const names = [...new Set(research.sources
        .map((s) => { try { return new URL(s.url).hostname.replace(/^www\./, ''); } catch { return s.title || 'source'; } }))]
        .slice(0, 3);
      deliverAgent(origin, '🔎 Checked the web — ' + names.join(', '));
      if (chatStore.active !== origin) return;
    }
  }
  const thinking = addMsg('agent typing', 'Writing the prompt');
  let prompt;
  try { prompt = await directorCompose(text, answers, webFacts); } finally { thinking.remove(); }
  // The user moved to another chat while the prompt was being written —
  // don't pop the review card into the wrong thread.
  if (chatStore.active !== origin) return;
  deliverPrompt(prompt);
}

// Live web search: gathers current real-world facts for the prompt writer.
// Returns { facts, sources }; on any failure returns empties so compose runs.
async function directorResearch(text) {
  try {
    const res = await apiFetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'research', kind: mode, prompt: text,
        history: directorHistory(), ...directorContext(),
      }),
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    return {
      facts: String(data.facts || '').slice(0, 2000),
      sources: Array.isArray(data.sources) ? data.sources.slice(0, 5) : [],
    };
  } catch { return { facts: '', sources: [] }; }
}

// Mode split: Plan pops the finished paragraph into the chat for approval;
// Auto commits the brief and generates without stopping.
function deliverPrompt(prompt) {
  if (directorMode === 'plan') { reviewPrompt(prompt); return; }
  const c = activeChat();
  if (pendingBrief && c) { c.brief = pendingBrief; pendingBrief = null; persistStore(); touchSync(c.id); }
  if (pendingMemory) { commitMemory(pendingMemory); pendingMemory = null; }
  const shots = pendingShots; pendingShots = null;
  const extras = pendingExtras; pendingExtras = null;
  // A multi-shot bills the SUM of its shot durations — often far more than the
  // single-duration send-button quote the user last saw. Auto mode never shows
  // a review card, so surface the real total in the chat before it bills.
  const liveShots = (mode === 'video' && shots && shotsApply(model)) ? sanitizeShots(shots) : null;
  if (liveShots) {
    const secs = liveShots.reduce((t, s) => t + s.duration, 0);
    addMsg('agent', '🎬 Multi-shot: ' + liveShots.length + ' shots · ' + secs + 's total — ' + (estimatePrice(undefined, liveShots, extras && extras.sound) || '✦'));
  }
  generateMedia(prompt, { announce: false, shots, extras });
}

// The floating dock above the composer (was the question cards; the Plan
// mode card renders here next).
function clearQDock() {
  const dock = document.getElementById('qDock');
  if (dock) dock.innerHTML = '';
}

// Build the Plan-mode review card (approve to run). Extracted so it can be
// re-rendered from a persisted {t:'review'} message — otherwise switching
// chats, a background sync-renderThread, or a reload lost the composed prompt.
function buildReviewCard(prompt, cardMode, cardBrief, cardMemory, cardShots, cardExtras) {
  const m = cardMode || mode;
  // A shot list applies on Kling t2v/i2v (a clip disables it — edit endpoint).
  const shots = (m === 'video' && sanitizeShots(cardShots) && shotsApply(model)) ? sanitizeShots(cardShots) : null;
  const extras = sanitizeExtras(cardExtras);
  const box = document.createElement('div');
  box.className = 'review-card';
  const label = document.createElement('div');
  label.className = 'review-label';
  label.textContent = m === 'audio'
    ? "I'll voice exactly these words — approve to hear it:"
    : shots
    ? "Here's the shot list — approve to run it:"
    : "Here's the plan — approve to run it:";
  const body = document.createElement('div');
  body.className = 'review-prompt'; body.textContent = prompt;
  // Multi-shot: show the numbered breakdown with each shot's length.
  let shotList = null;
  if (shots) {
    shotList = document.createElement('ol');
    shotList.className = 'review-shots';
    shots.forEach((s, i) => {
      const li = document.createElement('li');
      const tag = document.createElement('span'); tag.className = 'rs-tag'; tag.textContent = 'Shot ' + (i + 1) + ' · ' + s.duration + 's';
      const txt = document.createElement('span'); txt.className = 'rs-txt'; txt.textContent = s.prompt;
      li.appendChild(tag); li.appendChild(txt); shotList.appendChild(li);
    });
  }
  const actions = document.createElement('div'); actions.className = 'review-actions';
  const deny = document.createElement('button'); deny.className = 'review-deny'; deny.textContent = '✕ Deny';
  const allow = document.createElement('button'); allow.className = 'review-allow';
  // Price the card on the actual prompt/script/shot-list (and the silent flag,
  // which discounts Veo/Kling), not the (now-cleared) input.
  allow.textContent = 'Generate ' + (estimatePrice(m === 'audio' ? prompt : undefined, shots, extras && extras.sound) || '✦');
  deny.onclick = () => { clearReviews(); actions.remove(); label.textContent = 'Denied — tweak it and send again.'; document.getElementById('input').focus(); };
  allow.onclick = () => {
    // One generation per chat — if the previous run is still going, keep the
    // card live so the prompt isn't silently swallowed by the busy guard.
    if (activeGens.has(chatStore.active)) {
      label.textContent = "Still finishing the last one — approve again in a moment.";
      return;
    }
    clearReviews();
    actions.remove(); label.textContent = 'Approved ✦';
    // Generate with the KIND this card was composed for, not whatever mode the
    // composer happens to be in now (mode resets to 'video' on reload) — else an
    // approved voice line would run as a video and bill at video rates.
    if (m !== mode) setMode(m);
    // Approval is the signal that this direction is right — commit THIS card's
    // own brief/memory (captured when the card was built), never the live
    // globals, which a later compose may have overwritten.
    const c = activeChat();
    if (cardBrief && c) { c.brief = cardBrief; persistStore(); touchSync(c.id); }
    if (cardMemory) commitMemory(cardMemory);
    generateMedia(prompt, { announce: false, shots, extras });
  };
  actions.appendChild(deny); actions.appendChild(allow);
  box.appendChild(label); box.appendChild(body); if (shotList) box.appendChild(shotList); box.appendChild(actions);
  return box;
}
// Drop any pending review card from the active chat once approved/denied so a
// later re-render doesn't resurrect it.
function clearReviews() {
  const c = activeChat(); if (!c) return;
  const before = c.msgs.length;
  c.msgs = c.msgs.filter((mm) => mm.t !== 'review');
  if (c.msgs.length !== before) { persistStore(); touchSync(c.id); }
}
function reviewPrompt(prompt) {
  // Capture the brief/memory THIS card represents — the globals get overwritten
  // by the next compose, so approving an older (or previously denied) card must
  // not commit a different draft's durable memory. Also persist them on the
  // message so a card approved after a reload still commits the right ones.
  const cardBrief = pendingBrief, cardMemory = pendingMemory, cardShots = pendingShots, cardExtras = pendingExtras;
  pendingBrief = null; pendingMemory = null; pendingShots = null; pendingExtras = null;
  pushSaved({ t: 'review', prompt: String(prompt), mode, at: Date.now(), brief: cardBrief || undefined, memory: cardMemory || undefined, shots: cardShots || undefined, extras: cardExtras || undefined });
  threadAppend(buildReviewCard(prompt, mode, cardBrief, cardMemory, cardShots, cardExtras));
}

// Grow the message box downward as the user types; cap it, then scroll.
function autoGrow(el) {
  if (mode === 'audio') updateSendPrice(); // voice bills per character — live re-quote
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.38)) + 'px';
}

function send(fromButton) {
  // While this chat is generating, the BUTTON doubles as Stop — but Enter
  // must never cancel a run mid-typing.
  if (activeGens.has(chatStore.active)) {
    if (fromButton) cancelGen(chatStore.active);
    return;
  }
  const input = document.getElementById('input');
  const text = input.value.trim();
  // Lip-sync models are prompt-less — they run off the attachments, not text.
  const promptless = mode === 'video' && currentOpts() && currentOpts().noPrompt;
  if (!text && !promptless) return;
  // Voice is capped at 2,000 characters server-side; block over-length scripts
  // here (keeping the text) instead of letting the tail get silently cut off.
  if (mode === 'audio' && text.length > 2000) {
    addMsg('agent', "That's a long one — voice scripts are capped at 2,000 characters (this is " + text.length.toLocaleString() + "). Trim it a little and send again.");
    return;
  }
  // A video-to-video clip out of the model's spec (wrong format, too long/short,
  // too small) is rejected by fal with a 422 — catch it HERE so the user gets a
  // clear fix instead of a charge and a dead render.
  const badClip = clipIssue();
  if (badClip) { addMsg('agent', '⚠️ ' + badClip); return; }
  // Character elements constraints (fal): Kling 3.0 only takes elements on its
  // image-to-video endpoint (needs a start image); o3's edit endpoint caps
  // characters + reference images at 4 combined.
  if (mode === 'video' && elList.length) {
    if (/kling-video\/v3/.test(model) && !attachments.image && !attachments.ffirst) {
      addMsg('agent', '⚠️ Kling 3.0 needs a start image alongside characters — add one (or switch to Kling o3, which takes characters on their own).');
      return;
    }
    if (/kling-video\/o3/.test(model) && attachments.clip && elList.length + refList.length > 4) {
      addMsg('agent', '⚠️ On a clip re-render, characters + reference images are capped at 4 combined — remove ' + (elList.length + refList.length - 4) + '.');
      return;
    }
  }
  // Image models set a minimum prompt length (nano-banana-pro: 3 chars) and 422
  // anything shorter — only bites raw mode, since composed prompts are long.
  if (mode === 'image' && directorMode === 'off' && text.length < 3) {
    addMsg('agent', 'Give me a couple more words — this model needs at least a 3-character prompt.');
    return;
  }
  // Lip-sync bills by the audio length (awDur). Never submit with an unmeasured
  // clip — the worker charges the 60s max, which the price quote never showed.
  if (promptless && attachments.audio && !awDur) {
    addMsg('agent', awDecoding
      ? "One sec — I'm still reading that audio clip. Hit send again in a moment."
      : "I couldn't read that audio clip — try a different file (mp3, wav, or m4a).");
    return;
  }
  // Driving audio out of the model's spec (wrong format, too big, too long/short)
  // 422s after charging — bounce it here with the exact fix instead. Covers Kling
  // LipSync, OmniHuman, and Seedance audio refs (see AUDIO_LIMITS).
  const badAudio = audioIssue();
  if (badAudio) { addMsg('agent', '⚠️ ' + badAudio); return; }
  input.value = '';
  input.style.height = 'auto'; // collapse back to one line after sending
  // Conversational QR control (video only): pull any "add/put a QR … from Xs to
  // Ys / no qr" instruction out of the message, record it on this chat for the
  // burn step, and send the CLEANED text to the model so the words "qr code"
  // never end up in the generation prompt.
  let sendText = text;
  if (mode === 'video' && /\bqr\b|qr[\s-]?code/i.test(text)) {
    const chat = activeChat();
    const q = parseQrDirective(text, currentOpts() && currentOpts().durations ? duration : null);
    if (chat) {
      if (q.remove) chat.qr = { off: true };
      else if (q.want) {
        // Merge onto any prior QR so a follow-up tweak ("move it top-left")
        // keeps the earlier url/timing/position it didn't restate.
        const prev = chat.qr && !chat.qr.off ? chat.qr : {};
        chat.qr = {
          url: q.url || prev.url || chat.productUrl || null,
          start: q.start != null ? q.start : prev.start,
          end: q.end != null ? q.end : prev.end,
          pos: q.pos || prev.pos || null,
          want: true,
        };
      }
      persistStore();
    }
    if (q.clean) sendText = q.clean;
  }
  if (promptless) { generateMedia(sendText); return; }
  // Raw prompting — words go to the model exactly as typed — when the user turned
  // the orchestrator off OR they don't have the add-on (or its budget is spent).
  if (directorMode === 'off' || !orchActive()) { generateMedia(sendText); return; }
  startDirector(sendText);
}

// ── Auth gate ────────────────────────────────────────
// Every /api/* call carries the Supabase access token; a 401 sends the user
// back to the sign-in screen.
// Director calls (/api/direct) debit fractional credits at the gate, so the ✦
// balance needs to re-read after each one. Debounced so a burst (ask→compose)
// coalesces into a single refresh; the debit is already applied by the time the
// response arrives, so the refetched balance reflects it.
let _credRefreshT = null;
function scheduleCreditRefresh() {
  if (_credRefreshT) clearTimeout(_credRefreshT);
  _credRefreshT = setTimeout(() => { _credRefreshT = null; if (typeof fetchCredits === 'function') fetchCredits(); }, 350);
}
async function apiFetch(path, opts = {}) {
  const token = window.Auth ? await Auth.accessToken() : null;
  const headers = Object.assign({}, opts.headers || {});
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(path, Object.assign({}, opts, { headers }));
  if (res.status === 401) showAuthGate();
  // Reflect every credit spend as it happens: the orchestrator (/api/direct)
  // and each generation (/api/video|image|audio). Exact-match so the polling
  // and save endpoints (/api/video/poll, /api/save) don't trigger a refresh;
  // 501 = the feature isn't configured, so nothing was charged.
  const p = path.split('?')[0];
  if (res.status !== 501 &&
      (p === '/api/direct' || p === '/api/video' || p === '/api/image' || p === '/api/audio')) {
    scheduleCreditRefresh();
  }
  return res;
}

function showAuthGate() {
  const gate = document.getElementById('authGate');
  if (!gate) return;
  gate.style.display = 'flex';
  // Take the app behind the gate out of the tab order so focus can't leak onto
  // invisible controls behind the sign-in screen.
  const shell = document.querySelector('.shell');
  if (shell) shell.inert = true;
  const email = document.getElementById('authEmail');
  if (email) email.focus();
}
function hideAuthGate() {
  const gate = document.getElementById('authGate');
  if (gate) gate.style.display = 'none';
  const shell = document.querySelector('.shell');
  if (shell) shell.inert = false;
}

// Public marketing landing (logged-out default). CTAs reveal the auth gate;
// the gate's "← Back" returns here; signing in hides it for good.
function showMarketing() {
  const mkt = document.getElementById('marketing');
  if (mkt) mkt.style.display = 'flex';   // CRT landing is a flex column (nav + stage)
  const gate = document.getElementById('authGate');
  if (gate) gate.style.display = 'none';
  const shell = document.querySelector('.shell');
  if (shell) shell.inert = true;
}
function hideMarketing() {
  const mkt = document.getElementById('marketing');
  if (mkt) mkt.style.display = 'none';
}
// A marketing CTA opens the auth popup OVER the landing, in the right mode
// ("start" → create account, "signin" → sign in). The landing stays visible,
// dimmed behind the modal backdrop.
// Where the gate was opened from decides where a successful auth lands:
//   'app'  → drop into the studio (the chatbox on Enter, or picking a channel)
//   'stay' → stay on the landing as a logged-in page (the Sign in / Sign up nav)
let authEntry = 'stay';
function openAuthFrom(mode, entry) {
  authEntry = entry === 'app' ? 'app' : 'stay';
  if (typeof setAuthMode === 'function') setAuthMode(mode === 'start' ? 'up' : 'in');
  showAuthGate();
}
// After a successful sign in / sign up, route by that entry point.
function finishAuth() {
  if (authEntry === 'app') enterApp();
  else enterLandingAuthed();
}

// One flow: email + password → emailed code → in.
// Modes: 'in' (sign in) · 'up' (create account) · 'reset' (forgot password).
// Steps: 'creds' → 'code' → ('newpass' for reset).
function authEl(id) { return document.getElementById(id); }
let authMode = 'in';
let authStep = 'creds';
let pendingEmail = '';
let pendingType = 'email'; // verify type for the code step

function showAuthError(msg) {
  const e = authEl('authError');
  if (e) { e.textContent = msg || ''; e.style.display = msg ? 'block' : 'none'; }
}

function friendlyAuthErr(e) {
  const m = (e && e.message) || '';
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password.';
  if (/already registered|already been registered/i.test(m)) return 'That email already has an account — sign in instead.';
  if (/rate limit|too many|429/i.test(m)) return 'Too many attempts — wait a minute and try again.';
  if (/(expired|invalid)[^]*(code|token|otp)|(code|token|otp)[^]*(expired|invalid)/i.test(m)) return "That code didn't work — request a new one.";
  if (/should be at least|at least 6/i.test(m)) return 'Password must be at least 6 characters.';
  return m || 'Something went wrong.';
}

const AUTH_TITLES = {
  in:    { creds: 'Sign in to isibi.ai',   code: 'Check your email' },
  up:    { creds: 'Create your account', code: 'Check your email' },
  reset: { creds: 'Reset your password', code: 'Check your email', newpass: 'Set a new password' },
};
const AUTH_BTNS = {
  in:    { creds: 'Sign in',         code: 'Verify & sign in' },
  up:    { creds: 'Create account',  code: 'Verify & finish' },
  reset: { creds: 'Send reset code', code: 'Verify code', newpass: 'Update password' },
};
function authSubmitLabel() { return AUTH_BTNS[authMode][authStep]; }

function renderAuthStep() {
  const inCreds = authStep === 'creds';
  const show = (id, on) => { authEl(id).style.display = on ? '' : 'none'; };
  show('authPass', inCreds && (authMode === 'in' || authMode === 'up'));
  show('authCode', authStep === 'code');
  show('authNewPass', authStep === 'newpass');
  authEl('authEmail').disabled = !inCreds;
  show('authResend', authStep === 'code');

  const showSwitch = inCreds && authMode !== 'reset';
  const showBack = authStep === 'code' || (inCreds && authMode !== 'up');
  show('authForgot', showBack);
  authEl('authSwitch').style.display = showSwitch ? '' : 'none';
  authEl('authLinks').style.display = (showSwitch || showBack) ? '' : 'none';
  authEl('authForgot').textContent =
    authStep === 'code' ? '← Start over' :
    authMode === 'reset' ? '← Back to sign in' : 'Forgot password?';

  authEl('authTitle').textContent = AUTH_TITLES[authMode][authStep];
  authEl('authSubmit').textContent = authSubmitLabel();
  authEl('authSub').textContent =
    authStep === 'code' ? 'Enter the code we emailed to ' + pendingEmail + '.' :
    authStep === 'newpass' ? 'Choose a new password for ' + pendingEmail + '.' :
    authMode === 'reset' ? 'We’ll email you a reset code.' :
    'Create AI video, images, and voice.';
  authEl('authSwitchText').textContent = authMode === 'up' ? 'Already have an account?' : 'New here?';
  authEl('authToggle').textContent = authMode === 'up' ? 'Sign in' : 'Create an account';
  authEl('authPass').setAttribute('autocomplete', authMode === 'up' ? 'new-password' : 'current-password');
}

function setAuthMode(mode) {
  authMode = mode;
  authStep = 'creds';
  authEl('authEmail').disabled = false;
  authEl('authCode').value = '';
  authEl('authNewPass').value = '';
  showAuthError('');
  renderAuthStep();
  authEl('authEmail').focus();
}

// The bottom-left link: Forgot ↔ back to sign in, or start over from a code step.
function onAuthBack() {
  if (authStep === 'code') setAuthMode(authMode);
  else setAuthMode(authMode === 'reset' ? 'in' : 'reset');
}

function goCodeStep(email, type) {
  pendingEmail = email; pendingType = type;
  authStep = 'code';
  renderAuthStep();
  authEl('authCode').value = '';
  authEl('authCode').focus();
}

async function submitAuth() {
  const btn = authEl('authSubmit');
  btn.disabled = true; btn.textContent = '…'; showAuthError('');
  const email = authEl('authEmail').value.trim();
  try {
    // Enter the emailed code.
    if (authStep === 'code') {
      const code = authEl('authCode').value.trim();
      if (!/^\d{6,10}$/.test(code)) { showAuthError('Enter the code from your email.'); return; }
      await Auth.verifyCode(pendingEmail, code, pendingType);
      if (authMode === 'reset') { authStep = 'newpass'; renderAuthStep(); authEl('authNewPass').focus(); }
      else finishAuth();
      return;
    }
    // Set a new password (end of the reset flow).
    if (authStep === 'newpass') {
      const np = authEl('authNewPass').value;
      if (np.length < 6) { showAuthError('Password must be at least 6 characters.'); return; }
      await Auth.updatePassword(np);
      finishAuth();
      return;
    }
    // Credentials step.
    if (!email) { showAuthError('Enter your email.'); return; }

    if (authMode === 'reset') {
      await Auth.recover(email);
      goCodeStep(email, 'recovery');
      return;
    }

    const pass = authEl('authPass').value;
    if (!pass) { showAuthError('Enter your password.'); return; }
    if (authMode === 'up' && pass.length < 6) { showAuthError('Password must be at least 6 characters.'); return; }

    if (authMode === 'up') {
      const r = await Auth.signUp(email, pass);
      if (r.session) { finishAuth(); return; }   // confirm-email OFF → straight in
      goCodeStep(email, 'signup');             // confirm-email ON → verify code
      return;
    }

    // Sign in: check the password (no session kept), then email a code.
    try {
      await Auth.checkPassword(email, pass);
    } catch (e) {
      // An unconfirmed account can't password-grant — let them finish via the code.
      if (!/not confirmed/i.test((e && e.message) || '')) throw e;
    }
    await Auth.sendCode(email, false);
    goCodeStep(email, 'email');
  } catch (e) {
    showAuthError(friendlyAuthErr(e));
  } finally {
    btn.disabled = false; btn.textContent = authSubmitLabel();
  }
}

async function resendAuthCode() {
  showAuthError('');
  const t = authEl('authResend');
  try {
    if (pendingType === 'recovery') await Auth.recover(pendingEmail);
    else await Auth.sendCode(pendingEmail, pendingType === 'signup');
    const orig = t.textContent;
    t.textContent = 'Code re-sent ✓';
    setTimeout(() => { t.textContent = orig; }, 1600);
  } catch (e) { showAuthError(friendlyAuthErr(e)); }
}

function enterApp() {
  hideMarketing();
  hideAuthGate();
  const email = Auth.email();
  const badge = document.getElementById('authEmailBadge');
  if (badge) badge.textContent = email;
  // Derive a friendly display name + avatar initial from the email local part.
  const local = (email.split('@')[0] || '').replace(/[._-]+/g, ' ').trim();
  const name = local ? local.charAt(0).toUpperCase() + local.slice(1) : 'You';
  const nameEl = document.getElementById('sideName');
  if (nameEl) nameEl.textContent = name;
  // Hero greeting follows the clock — late night / morning / day / evening.
  const ht = document.getElementById('heroTitle');
  if (ht) {
    const h = new Date().getHours();
    const [pre, post] =
      h < 5 ? ['Late night session, ', '?'] :
      h < 12 ? ['Morning, ', ' — what are we making?'] :
      h < 18 ? ['What are we making, ', '?'] :
      ['Evening, ', ' — what are we making?'];
    ht.textContent = '';
    ht.append(pre);
    const span = document.createElement('span');
    span.className = 'hh-name';
    span.textContent = name;
    ht.appendChild(span);
    ht.append(post);
  }
  const initial = (name[0] || '·').toUpperCase();
  const av = document.getElementById('sideAvatar');
  if (av) av.textContent = initial;
  const btnAv = document.getElementById('profileBtnAv');
  if (btnAv) btnAv.textContent = initial;
  const so = document.getElementById('signOutRow');
  if (so) so.style.display = '';
  document.getElementById('input').focus();
  // A different account signed in on this browser: drop the previous user's
  // local cache so their chats are never shown to — or re-uploaded under —
  // this account. (Sign-out clears it too; this covers expired-session swaps.)
  const uid = Auth.userId ? Auth.userId() : '';
  if (uid) {
    const prevOwner = localStorage.getItem('zephyr_owner_v1');
    if (prevOwner && prevOwner !== uid) {
      try {
        [STORE_KEY, OLD_STORE_KEY, JOBS_KEY, SAVES_KEY, CHAT_TOMB_KEY, MEMORY_KEY, DELIVERED_KEY, 'zephyr_studio_v1', 'zephyr_avatars_v1', 'zephyr_products_v1', CRED_MAX_KEY, WELCOME_KEY]
          .forEach((k) => localStorage.removeItem(k));
      } catch {}
      chatStore = { active: null, chats: [] };
      memoryState = { items: [], enabled: true, updatedAt: 0 };
      syncDirty.clear(); syncDeleted.clear();
      loadStore();
      renderChatList(); renderThread();
      // Studio holds its projects in memory too — reset it from the wiped store.
      if (typeof sbResetForAccountSwitch === 'function') sbResetForAccountSwitch();
    }
    try { localStorage.setItem('zephyr_owner_v1', uid); } catch {}
  }
  // Run a ?q= prompt only AFTER the account-switch wipe above — otherwise it
  // would land in the outgoing account's chat and be discarded by the reset.
  const ranFirstMsg = !!pendingFirstMsg;
  if (pendingFirstMsg) { const q = pendingFirstMsg; pendingFirstMsg = null; startDirector(q); }
  // Signed in — pull the account's chats and universal memory, merge both.
  pullChats();
  pullMemory();
  fetchCredits();
  // Pick up any generation that was mid-flight when the tab last closed,
  // and re-copy any media whose gallery save failed.
  resumeJobs();
  retryPendingSaves();
  // The Builder chatbox is now the home screen — always land here.
  showView('home');
}

// Signed in via the nav buttons (not the chatbox): stay on the landing but flip
// it to a logged-in page — the top-right becomes the same profile menu the app
// uses. The chatbox still drops them into the studio on Enter. Account cache is
// left for enterApp() to reconcile (it does the account-switch wipe on entry).
function enterLandingAuthed() {
  hideAuthGate();
  const email = Auth.email();
  const local = (email.split('@')[0] || '').replace(/[._-]+/g, ' ').trim();
  const name = local ? local.charAt(0).toUpperCase() + local.slice(1) : 'You';
  const initial = (name[0] || '·').toUpperCase();
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('authEmailBadge', email); set('sideName', name); set('sideAvatar', initial); set('profileBtnAv', initial);
  // The profile cluster lives inside the app shell (inert while the landing is
  // up); move it to <body> so it's interactive over the landing, then show it.
  const so = document.getElementById('signOutRow');
  if (so) { if (so.parentElement !== document.body) document.body.appendChild(so); so.style.display = ''; }
  // Swap the landing's Sign in / Sign up / Pricing nav for the profile menu.
  document.querySelectorAll('#marketing .mkt-links').forEach((n) => { n.style.display = 'none'; });
  fetchCredits();
}

async function doSignOut(everywhere) {
  // Flush any unsynced edits first, then wipe this browser's local copy so
  // the next account on this machine never sees — or re-uploads — these chats.
  try { await pushChats(); } catch {}
  try {
    [STORE_KEY, OLD_STORE_KEY, JOBS_KEY, SAVES_KEY, CHAT_TOMB_KEY, MEMORY_KEY, DELIVERED_KEY, 'zephyr_owner_v1', 'zephyr_studio_v1', 'zephyr_avatars_v1', 'zephyr_products_v1', CRED_MAX_KEY, WELCOME_KEY]
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  if (typeof sbMediaClear === 'function') { try { await sbMediaClear(); } catch {} } // drop stored imports
  if (everywhere) await Auth.signOutEverywhere();
  else await Auth.signOut();
  location.reload();
}

// Settings page — a plain, conventional settings view (grouped list rows),
// rebuilt each time it opens so account/credits/prefs are current.
// ── Integrations: connect the user's social accounts. ──
// The real account-linking hub — Connect/Disconnect drive the same Composio
// OAuth flow as the Media Agent (/api/social/{status,connect,disconnect}),
// sharing socialStatus + connectSocial/disconnectSocial. Once linked, the
// Media Agent page handles chat, DMs and publishing on top of these.
const INTEGRATIONS = [
  {
    id: 'youtube',
    name: 'YouTube',
    desc: 'Publish your generated videos straight to your channel.',
    ico: '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="#FF0000" d="M23 12s0-3.79-.48-5.6a2.94 2.94 0 0 0-2.07-2.08C18.64 3.83 12 3.83 12 3.83s-6.64 0-8.45.49A2.94 2.94 0 0 0 1.48 6.4C1 8.21 1 12 1 12s0 3.79.48 5.6a2.94 2.94 0 0 0 2.07 2.08c1.81.49 8.45.49 8.45.49s6.64 0 8.45-.49a2.94 2.94 0 0 0 2.07-2.08C23 15.79 23 12 23 12z"/>' +
      '<path fill="#fff" d="M9.75 15.5l6-3.5-6-3.5z"/></svg>',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    desc: 'Post your creations to your feed, reels and stories.',
    ico: '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<defs><linearGradient id="igGrad" x1="0" y1="1" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#feda75"/><stop offset=".3" stop-color="#fa7e1e"/>' +
      '<stop offset=".6" stop-color="#d62976"/><stop offset="1" stop-color="#962fbf"/></linearGradient></defs>' +
      '<rect x="2" y="2" width="20" height="20" rx="6" fill="url(#igGrad)"/>' +
      '<rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="#fff" stroke-width="1.6"/>' +
      '<circle cx="12" cy="12" r="3" fill="none" stroke="#fff" stroke-width="1.6"/>' +
      '<circle cx="16.6" cy="7.4" r="1.15" fill="#fff"/></svg>',
  },
];

// One Integrations row — reflects live connection state and offers the right
// action (Connect when linked-off, Disconnect when active). a.id matches the
// socialStatus / SOCIAL_APPS key ('instagram' | 'youtube').
function igItemHtml(app, slot) {
  slot = slot || {};
  const loading = slot.loading;
  const connected = !!slot.connected;
  const pending = !loading && !connected && slot.status && slot.status !== 'INACTIVE';
  const pill = loading ? '<span class="ma-pill">Checking…</span>'
    : connected ? '<span class="ma-pill on">● Connected</span>'
    : pending ? '<span class="ma-pill wait">Pending…</span>'
    : '';
  const btn = connected
    ? '<button type="button" class="ig-connect ig-dis" data-ig-dis="' + app.id + '">Disconnect</button>'
    : '<button type="button" class="ig-connect" data-ig-con="' + app.id + '"' + (loading ? ' disabled' : '') + '>Connect</button>';
  return '<div class="sp-item ig-item">' +
      '<span class="sp-item-l">' +
        '<span class="ig-ico">' + app.ico + '</span>' +
        '<span class="ig-txt"><span class="sp-item-t">' + esc(app.name) + '</span>' +
        '<span class="sp-item-s">' + esc(app.desc) + '</span></span>' +
      '</span>' +
      '<span class="sp-item-r">' + pill + btn + '</span>' +
    '</div>';
}

// Repaint the Integrations list from socialStatus (no-op when not mounted).
function paintIntegrations() {
  const list = document.getElementById('igList');
  if (!list) return;
  if (socialStatus && socialStatus._off) {
    list.innerHTML = '<div class="ma-note">Social connections aren’t configured on the server yet.</div>';
    return;
  }
  list.innerHTML = INTEGRATIONS.map((a) => igItemHtml(a, socialStatus ? socialStatus[a.id] : { loading: true })).join('');
  list.querySelectorAll('[data-ig-con]').forEach((b) => { b.onclick = () => connectSocial(b.dataset.igCon); });
  list.querySelectorAll('[data-ig-dis]').forEach((b) => { b.onclick = () => disconnectSocial(b.dataset.igDis); });
}

function renderIntegrations() {
  const view = document.getElementById('viewIntegrations');
  if (!view) return;

  view.innerHTML =
    '<div class="settings-page">' +
      '<div class="sp-title">Integrations</div>' +
      '<div class="sp-sub">Connect your accounts so Zephyr can manage and publish to them. ' +
        'Chat, DMs and publishing live on the <b>Media Agent</b> page once linked.</div>' +
      '<div class="ma-msg" id="igMsg" hidden></div>' +
      '<div class="sp-group">' +
        '<div class="sp-glabel">Accounts</div>' +
        '<div class="sp-list" id="igList">' +
          INTEGRATIONS.map((a) => igItemHtml(a, { loading: true })).join('') +
        '</div>' +
        '<div class="cp-note sp-note">More destinations coming soon.</div>' +
      '</div>' +
    '</div>';

  loadSocialStatus();   // fetches status, then paints this list + Media Agent
}

function renderSettings() {
  const view = document.getElementById('viewSettings');
  if (!view) return;
  const email = Auth.email();
  const local = (email.split('@')[0] || '').replace(/[._-]+/g, ' ').trim();
  const name = local ? local.charAt(0).toUpperCase() + local.slice(1) : 'You';
  const planTxt = planLabelText();
  const balTxt = (document.getElementById('creditChip') || {}).textContent || '✦ —';

  view.innerHTML =
    '<div class="settings-page">' +
      '<div class="sp-title">Settings</div>' +
      '<div class="sp-sub">Your account, plan, and everything private to you.</div>' +

      '<div class="sp-group">' +
        '<div class="sp-glabel">Account</div>' +
        '<div class="sp-list">' +
          '<div class="sp-item">' +
            '<span class="sp-acct-l"><span class="st-av">' + esc((name[0] || '·').toUpperCase()) + '</span>' +
              '<span class="sp-item-l"><span class="sp-item-t">' + esc(name) + '</span>' +
              '<span class="sp-item-s">' + esc(email) + '</span></span></span>' +
            (planTxt ? '<span class="st-plan' + (isPaid ? ' paid' : '') + '">' + planTxt + '</span>' : '') +
          '</div>' +
          '<button type="button" class="sp-item sp-tap" id="spCredits">' +
            '<span class="sp-item-l"><span class="sp-item-t">Credits &amp; plan</span></span>' +
            '<span class="sp-item-r">' + esc(balTxt) + ' <span class="st-chev">›</span></span>' +
          '</button>' +
          // Cancel-only membership control. Shown to everyone — a free /
          // never-subscribed account that taps it gets a friendly "no active
          // membership" note, so there's nothing to hide.
          '<button type="button" class="sp-item sp-tap" id="spManage">' +
            '<span class="sp-item-l"><span class="sp-item-t">Cancel membership</span>' +
            '<span class="sp-item-s">Cancel anytime — you keep access until your paid period ends.</span></span>' +
            '<span class="sp-item-r"><span class="st-chev">›</span></span>' +
          '</button>' +
        '</div>' +
        '<div class="cp-note sp-note" id="spManageNote"></div>' +
      '</div>' +

      '<div class="sp-group">' +
        '<div class="sp-glabel">Password</div>' +
        '<div class="sp-list">' +
          '<button type="button" class="sp-item sp-tap" id="spPwRow" aria-expanded="false">' +
            '<span class="sp-item-l"><span class="sp-item-t">Change password</span></span>' +
            '<span class="sp-item-r"><span class="st-chev sp-chev">›</span></span>' +
          '</button>' +
          '<form class="sp-item sp-form" id="spForm" hidden>' +
            '<input type="password" class="st-in" id="spPw" placeholder="New password (min 6 characters)" autocomplete="new-password" />' +
            '<button type="submit" class="st-save">Update</button>' +
          '</form>' +
        '</div>' +
        '<div class="cp-note sp-note" id="spNote"></div>' +
      '</div>' +

      '<div class="sp-group">' +
        '<div class="sp-glabel">About</div>' +
        '<div class="sp-list">' +
          // Prefill the account email + version into the body so a support
          // reply never has to ask "which account, which version?".
          '<a class="sp-item sp-tap" href="mailto:support@isibi.ai?subject=isibi%20support&body=' +
            encodeURIComponent('\n\n—\nAccount: ' + email + ' · isibi ' + APP_VERSION) + '">' +
            '<span class="sp-item-l"><span class="sp-item-t">Contact support</span>' +
            '<span class="sp-item-s">support@isibi.ai</span></span>' +
            '<span class="sp-item-r"><span class="st-chev">›</span></span>' +
          '</a>' +
          '<a class="sp-item sp-tap" href="/terms.html" target="_blank" rel="noopener">' +
            '<span class="sp-item-l"><span class="sp-item-t">Terms of Service</span></span>' +
            '<span class="sp-item-r"><span class="st-chev">›</span></span>' +
          '</a>' +
          '<a class="sp-item sp-tap" href="/privacy.html" target="_blank" rel="noopener">' +
            '<span class="sp-item-l"><span class="sp-item-t">Privacy Policy</span></span>' +
            '<span class="sp-item-r"><span class="st-chev">›</span></span>' +
          '</a>' +
          '<div class="sp-item">' +
            '<span class="sp-item-l"><span class="sp-item-t">Version</span></span>' +
            '<span class="sp-item-r">' + APP_VERSION + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<button type="button" class="sp-signout" id="spSignout">Sign out</button>' +
      '<button type="button" class="sp-signout-all" id="spSignoutAll">Sign out on all devices</button>' +

      '<div class="sp-group">' +
        '<div class="sp-glabel">Danger zone</div>' +
        '<div class="sp-list">' +
          '<button type="button" class="sp-item sp-tap" id="spDelete">' +
            '<span class="sp-item-l"><span class="sp-item-t sp-red">Delete account</span>' +
            '<span class="sp-item-s">Permanently removes your account, chats, saved media and remaining credits.</span></span>' +
            '<span class="sp-item-r"><span class="st-chev">›</span></span>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  view.querySelector('#spCredits').onclick = () => openCredits();

  // Cancel membership → focused in-app cancel (no Stripe portal / invoices).
  // Probe status first, then confirm, then cancel at period end.
  const manageBtn = view.querySelector('#spManage');
  if (manageBtn) manageBtn.onclick = async () => {
    const note = view.querySelector('#spManageNote');
    if (manageBtn.dataset.busy) return;
    manageBtn.dataset.busy = '1';
    const fmt = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return null; } };
    if (note) note.textContent = 'Checking your membership…';
    try {
      const r = await apiFetch('/api/billing/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 501) { if (note) note.textContent = 'Membership cancellation is switching on very soon.'; return; }
      if (!r.ok) { if (note) note.textContent = 'Couldn’t reach billing — try again in a moment.'; return; }
      if (!d.active) { if (note) note.textContent = 'You have no active membership to cancel.'; return; }
      const until = d.until ? fmt(d.until) : null;
      if (d.alreadyCanceling) {
        if (note) note.textContent = until ? ('Your membership is already set to end on ' + until + '. You keep access until then.') : 'Your membership is already set to cancel at the end of your paid period.';
        return;
      }
      const ask = until
        ? ('Cancel your membership? You’ll keep full access until ' + until + ', then it drops to Free. No further charges.')
        : 'Cancel your membership? You’ll keep access until the end of your paid period, then it drops to Free. No further charges.';
      if (!confirm(ask)) { if (note) note.textContent = ''; return; }
      if (note) note.textContent = 'Cancelling…';
      const cr = await apiFetch('/api/billing/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }),
      });
      const cd = await cr.json().catch(() => ({}));
      if (cr.ok && cd.cancelled) {
        const u = cd.until ? fmt(cd.until) : null;
        if (note) note.textContent = u ? ('Membership cancelled. You keep access until ' + u + '.') : 'Membership cancelled. You keep access until the end of your paid period.';
      } else {
        if (note) note.textContent = 'Couldn’t cancel just now — email support@isibi.ai and we’ll sort it.';
      }
    } catch {
      if (note) note.textContent = 'Couldn’t reach billing — try again in a moment.';
    } finally {
      delete manageBtn.dataset.busy;
    }
  };

  // The password form stays folded behind its row — an always-open password
  // input on a settings page reads as a prompt to type into it.
  view.querySelector('#spPwRow').onclick = (e) => {
    const row = e.currentTarget;
    const form = view.querySelector('#spForm');
    form.hidden = !form.hidden;
    row.setAttribute('aria-expanded', form.hidden ? 'false' : 'true');
    row.classList.toggle('open', !form.hidden);
    view.querySelector('#spNote').textContent = '';
    if (!form.hidden) view.querySelector('#spPw').focus();
  };

  view.querySelector('#spForm').onsubmit = async (e) => {
    e.preventDefault();
    const inp = view.querySelector('#spPw');
    const note = view.querySelector('#spNote');
    const np = inp.value;
    if (np.length < 6) { note.textContent = 'Password needs at least 6 characters.'; return; }
    note.textContent = 'Updating…';
    try {
      await Auth.updatePassword(np);
      inp.value = '';
      note.textContent = 'Password updated ✓';
    } catch (err) {
      note.textContent = (err && err.message) || 'Could not change the password.';
    }
  };

  view.querySelector('#spSignout').onclick = () => doSignOut();

  // Global sign-out: same local flush/wipe as a normal sign-out, but GoTrue
  // revokes the session on every device, not just this one.
  view.querySelector('#spSignoutAll').onclick = () => doSignOut(true);

  view.querySelector('#spDelete').onclick = async (e) => {
    const btn = e.currentTarget;
    if (!confirm('Delete your isibi account? This permanently removes your chats, saved media and remaining credits.')) return;
    if (!confirm('Last check — this cannot be undone. Delete everything?')) return;
    btn.disabled = true;
    try {
      // Files first via the Storage API (clean byte removal; best-effort —
      // the RPC sweeps whatever this misses), then the account itself.
      await Auth.storageWipeOwn();
      await Auth.deleteAccount();
    } catch (err) {
      btn.disabled = false;
      alert((err && err.message) || 'Could not delete the account — try again in a moment.');
      return;
    }
    // Everything server-side is gone; drop every trace in this browser too.
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('zephyr_'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
    if (typeof sbMediaClear === 'function') { try { await sbMediaClear(); } catch {} } // stored imports too
    location.reload();
  };
}

// ── Home landing / dashboard: personalized greeting + the Presets picker. ──
function renderLanding() {
  const view = document.getElementById('viewLanding');
  if (!view) return;
  const email = Auth.email();
  const local = (email.split('@')[0] || '').replace(/[._-]+/g, ' ').trim();
  const name = local ? local.charAt(0).toUpperCase() + local.slice(1) : 'there';
  const h = new Date().getHours();
  const greet = h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';

  view.innerHTML =
    '<div class="lp-page">' +
      '<div class="lp-hero"><h1>' + greet + ', ' + esc(name) + '</h1>' +
        '<p>Pick a starting point and make it yours.</p></div>' +
      '<div class="lp-presets" id="landingPresets"></div>' +
      '<div class="lp-compose"><div class="composer">' +
        '<div class="composer-top">' +
          '<textarea id="lpInput" rows="1" placeholder="Describe a video, image, or a voice line — isibi takes it from here…"></textarea>' +
        '</div>' +
        '<div class="composer-row">' +
          '<span id="lpChipHost"></span>' +
          '<span class="lp-compose-hint" id="lpHint">Starts a fresh chat in the Builder</span>' +
          '<button type="button" class="send" id="lpSend" aria-label="Send">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>' +
          '</button>' +
        '</div>' +
      '</div></div>' +
    '</div>';

  // Home chatbox: sending spins up a FRESH chat in the Builder and fires the
  // message through the normal send path (orchestrator and all) — the user
  // lands mid-conversation, not on a prefilled input. A pinned preset chip
  // rides along as creative direction for the director.
  lpPreset = null; // view re-rendered — chip host is fresh
  const lpIn = view.querySelector('#lpInput');
  let lpBusy = false; // a URL scan is in flight — don't double-fire
  const lpGo = async () => {
    if (lpBusy) return;
    const text = (lpIn.value || '').trim();
    if (!text && !lpPreset) return;
    let outgoing = lpPreset
      ? (text
        ? text + '\n\nCreative direction — follow this “' + lpPreset.label + '” preset: ' + lpPreset.prompt
        : lpPreset.prompt)
      : text;
    // "From product URL" preset: scan the pasted store page server-side, then
    // build the ad around the REAL product — its image rides along as the
    // generation's start image, its facts go to the director.
    let scanImage = null;
    if (lpPreset && lpPreset.urlScan) {
      const m = text.match(/https?:\/\/\S+/);
      if (!m) { lpIn.placeholder = 'That needs a product link — paste the full URL (https://…)'; return; }
      const chipLabel = document.querySelector('.lp-chip b');
      if (chipLabel) chipLabel.textContent = 'Reading the page…';
      lpIn.disabled = true; lpBusy = true;
      let data = null;
      try {
        const res = await apiFetch('/api/product/scan', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: m[0] }),
        });
        if (res.ok) data = await res.json();
      } catch {}
      lpIn.disabled = false; lpBusy = false;
      if (!data || !(data.name || data.image)) {
        if (chipLabel) chipLabel.textContent = lpPreset.label;
        lpIn.placeholder = 'Couldn’t read that link — try another product URL…';
        lpIn.value = text;
        return;
      }
      scanImage = data.image || null;
      const rest = text.replace(m[0], '').trim();
      const facts = 'The product (from its store page): ' + (data.name || 'unknown') +
        (data.price ? ' · ' + data.price + (data.currency ? ' ' + data.currency : '') : '') +
        (data.desc ? '. ' + String(data.desc).slice(0, 300) : '');
      outgoing = (rest ? rest + '\n\n' : '') + facts +
        '\n\nCreative direction — follow this “' + lpPreset.label + '” preset: ' + lpPreset.prompt;
    }
    // The rig behind the card: pin the preset's best model + settings so the
    // generation actually runs the way the card promises.
    applyPresetRig(lpPreset);
    // Attach AFTER the rig lands (the settings rebuild clears unsupported slots).
    if (scanImage) {
      attachments.image = scanImage;
      clearImageInputsExcept('image');
      renderAttach('image');
    }
    // Reaching here on a urlScan preset means the scan succeeded (failures
    // returned above) — remember the link for the QR burn.
    const scannedUrl = lpPreset && lpPreset.urlScan
      ? (text.match(/https?:\/\/\S+/) || [])[0] || null : null;
    lpIn.value = '';
    clearLpPreset();
    newChat();
    // Product-URL chats remember their link — videos born here get the
    // product-page QR burned in before saving (saveVideoWithQr).
    if (scannedUrl) {
      const oc = activeChat();
      if (oc) { oc.productUrl = scannedUrl; persistStore(); }
    }
    showView('home');
    const input = document.getElementById('input');
    if (input) { input.value = outgoing; autoGrow(input); }
    send(false);
  };
  view.querySelector('#lpSend').onclick = lpGo;
  lpIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); lpGo(); } });
  lpIn.addEventListener('input', () => autoGrow(lpIn));

  const host = view.querySelector('#landingPresets');
  const rerender = () => renderPresetsInto(host, rerender);
  renderPresetsInto(host, rerender);
}

// ── Avatar: talking-avatar workspace. Empty state offers "Generate with AI"
// or "Import"; imported/saved avatars show in a grid (zephyr_avatars_v1). ──
const AVATARS_KEY = 'zephyr_avatars_v1';
function loadAvatars() { try { return JSON.parse(localStorage.getItem(AVATARS_KEY) || '[]'); } catch { return []; } }
function saveAvatars(list) {
  try { localStorage.setItem(AVATARS_KEY, JSON.stringify(list.slice(0, 60))); return true; }
  catch (e) { if (typeof sbToast === 'function') sbToast('Storage is full — this avatar may not stick after a reload. Remove a few to free space.'); return false; }
}

// Avatar-creator state. avatarMode: 'list' (empty state / grid) or 'create'
// (the generator screen — avatar preview in the middle, body-part options on
// the right). AV_PARTS is a placeholder set of options, replaced with the
// real parts later. Avatars generate with Nano Banana Pro.
const AVATAR_MODEL = 'fal-ai/nano-banana-pro';
// Credit cost of one avatar render (same conversion the worker charges with).
function avatarCredits() { return Math.max(1, Math.ceil((IMAGE_PRICE[AVATAR_MODEL] || 0) / CREDIT_USD)); }
function avatarCost() { return '✦ ' + avatarCredits().toLocaleString(); }
// Empty-state "ghost silhouette": a person glyph inside a dashed ring whose
// dashes rotate continuously, over a faint grid.
function acGhostHtml() {
  return '<span class="ac-ghost">' +
      '<span class="ac-ghost-ring"></span>' +
      '<svg class="ac-ghost-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>' +
    '</span>' +
    '<div class="ac-ph-h">Your avatar lives <span class="ac-accent">here</span></div>' +
    '<div class="ac-ph-txt">Shape it on the right, then generate.</div>' +
    '<span class="ac-tag"><i class="ac-tag-dot"></i>Human</span>';
}
let avatarMode = 'list';
const acSel = {};   // key -> selected value
const acOpen = {};  // key -> section expanded?
// Right-side "Builder" sections. Types: 'cards' (label + optional icon),
// 'images' (label + image tile), 'swatch' (color dots). Placeholder content —
// swap for the real sections/options later. opts.img adds a real photo tile.
const AV_SECTIONS = [
  { key: 'gender', label: 'Gender', icon: '⚧', type: 'cards',
    opts: [{ v: 'Female', ico: '♀' }, { v: 'Male', ico: '♂' }] },
  { key: 'skin', label: 'Skin Color', icon: '', type: 'swatch',
    opts: [{ v: 'Porcelain', c: '#f4ddcf' }, { v: 'Fair', c: '#ebcaad' }, { v: 'Light', c: '#d8b48d' }, { v: 'Beige', c: '#ca9f74' }, { v: 'Tan', c: '#bd8a5a' }, { v: 'Golden', c: '#b0703c' }, { v: 'Caramel', c: '#8a5531' }, { v: 'Rich brown', c: '#683e22' }, { v: 'Deep brown', c: '#492a19' }, { v: 'Ebony', c: '#2b190f' }] },
  { key: 'ethnicity', label: 'Ethnicity / Origin Base', icon: '🌍', type: 'images', gendered: true,
    opts: [
      { v: 'African heritage', f: 'african-heritage' },
      { v: 'Indian / South Asian', f: 'indian-south-asian' },
      { v: 'Latin American', f: 'latin-american' },
      { v: 'East Asian', f: 'east-asian' },
      { v: 'Southeast Asian', f: 'southeast-asian' },
      { v: 'Middle Eastern / North African', f: 'middle-eastern-north-african' },
      { v: 'European', f: 'european' },
      { v: 'Indigenous American', f: 'indigenous-american' },
      { v: 'Pacific Islander', f: 'pacific-islander' },
      { v: 'Caribbean', f: 'caribbean' },
    ] },
  { key: 'age', label: 'Age', icon: '🎂', type: 'slider', min: 18, max: 100, def: 25 },
  { key: 'hair', label: 'Hair', icon: '💇', type: 'images', optsByGender: {
      men: [{ v: 'Buzz', f: 'buzz' }, { v: 'Textured crop', f: 'textured-crop' }, { v: 'Tousled', f: 'tousled' }, { v: 'Quiff', f: 'quiff' }, { v: 'Side part', f: 'side-part' }, { v: 'Curly', f: 'curly' }, { v: 'Wavy', f: 'wavy' }, { v: 'Afro', f: 'afro' }, { v: 'Dreadlocks', f: 'dreadlocks' }, { v: 'Long', f: 'long' }],
      women: [{ v: 'Pixie', f: 'pixie' }, { v: 'Bob', f: 'bob' }, { v: 'Long straight', f: 'long-straight' }, { v: 'Wavy', f: 'wavy' }, { v: 'Curly', f: 'curly' }, { v: 'Afro', f: 'afro' }, { v: 'Box braids', f: 'box-braids' }, { v: 'Dreadlocks', f: 'dreadlocks' }, { v: 'Bun', f: 'bun' }, { v: 'Ponytail', f: 'ponytail' }],
    } },
  { key: 'facial', label: 'Facial Hair', icon: '🧔', type: 'images', menOnly: true, gendered: true,
    opts: [{ v: 'Stubble', f: 'stubble' }, { v: 'Short beard', f: 'short-beard' }, { v: 'Moustache', f: 'moustache' }, { v: 'Handlebar', f: 'handlebar' }, { v: 'Goatee', f: 'goatee' }, { v: 'Circle beard', f: 'circle-beard' }, { v: 'Extended goatee', f: 'extended-goatee' }, { v: 'Full beard', f: 'full-beard' }, { v: 'Chin strap', f: 'chin-strap' }, { v: 'Soul patch', f: 'soul-patch' }] },
  { key: 'haircolor', label: 'Hair Color', icon: '🖌️', type: 'swatch',
    opts: [{ v: 'Black', c: '#0e0d0b' }, { v: 'Espresso', c: '#1f1915' }, { v: 'Dark brown', c: '#332218' }, { v: 'Brown', c: '#613c26' }, { v: 'Chestnut', c: '#91623b' }, { v: 'Auburn', c: '#763421' }, { v: 'Copper', c: '#aa562c' }, { v: 'Dark blonde', c: '#b78a50' }, { v: 'Blonde', c: '#debb70' }, { v: 'Silver', c: '#c1bfb6' }] },
  { key: 'eyes', label: 'Eye Color', icon: '👁️', type: 'images', imgDir: '/avatars/eyes/',
    opts: [{ v: 'Black', f: 'black' }, { v: 'Dark brown', f: 'dark-brown' }, { v: 'Brown', f: 'brown' }, { v: 'Amber', f: 'amber' }, { v: 'Hazel', f: 'hazel' }, { v: 'Green', f: 'green' }, { v: 'Blue', f: 'blue' }, { v: 'Light blue', f: 'light-blue' }, { v: 'Gray', f: 'gray' }, { v: 'Violet', f: 'violet' }] },
  { key: 'body', label: 'Body Type', icon: '🧍', type: 'images', optsByGender: {
      men: [{ v: 'Slim', f: 'slim' }, { v: 'Lean', f: 'lean' }, { v: 'Athletic', f: 'athletic' }, { v: 'Muscular', f: 'muscular' }, { v: 'Stocky', f: 'stocky' }, { v: 'Heavy', f: 'heavy' }, { v: 'Skinny', f: 'skinny' }, { v: 'Average', f: 'average' }, { v: 'Broad', f: 'broad' }, { v: 'Tall', f: 'tall' }],
      women: [{ v: 'Petite', f: 'petite' }, { v: 'Slim', f: 'slim' }, { v: 'Lean', f: 'lean' }, { v: 'Athletic', f: 'athletic' }, { v: 'Muscular', f: 'muscular' }, { v: 'Curvy', f: 'curvy' }, { v: 'Pear', f: 'pear' }, { v: 'Full', f: 'full' }, { v: 'Broad', f: 'broad' }, { v: 'Tall', f: 'tall' }],
    } },
];

function renderAvatar() {
  const view = document.getElementById('viewAvatar');
  if (!view) return;
  if (avatarMode === 'create') { renderAvatarCreator(view); return; }
  const avatars = loadAvatars();
  if (!avatars.length) {
    view.innerHTML =
      '<div class="av-page av-empty">' +
        '<div class="av-hero"><h1>Create your avatar</h1>' +
          '<p>Generate a talking avatar with AI, or import your own portrait.</p></div>' +
        '<div class="av-choices">' +
          '<button type="button" class="av-choice" data-act="generate">' +
            '<span class="av-choice-t">Generate with AI</span>' +
            '<span class="av-choice-s">Describe a person and isibi creates the avatar.</span></button>' +
          '<button type="button" class="av-choice" data-act="import"><span class="av-choice-ico">⬆</span>' +
            '<span class="av-choice-t">Import</span>' +
            '<span class="av-choice-s">Upload your own portrait photo.</span></button>' +
        '</div>' +
      '</div>';
  } else {
    view.innerHTML =
      '<div class="av-page">' +
        '<div class="av-top"><h1>Your avatars</h1>' +
          '<div class="av-top-btns">' +
            '<button type="button" class="av-mini" data-act="generate">Generate</button>' +
            '<button type="button" class="av-mini" data-act="import">⬆ Import</button>' +
          '</div>' +
        '</div>' +
        '<div class="av-grid">' + avatars.map((a) =>
          '<div class="av-card" data-id="' + esc(a.id) + '">' +
            (a.image ? '<div class="av-thumb"><img src="' + esc(a.image) + '" alt="" /></div>' : '<div class="av-thumb av-thumb-ph">🧑</div>') +
            '<button class="av-del" data-id="' + esc(a.id) + '" aria-label="Remove">✕</button>' +
            '<div class="av-name">' + esc(a.name || 'Avatar') + '</div>' +
          '</div>').join('') + '</div>' +
      '</div>';
  }
  view.querySelectorAll('[data-act="generate"]').forEach((b) => { b.onclick = () => { avatarMode = 'create'; renderAvatar(); }; });
  view.querySelectorAll('[data-act="import"]').forEach((b) => { b.onclick = () => importAvatar(); });
  view.querySelectorAll('.av-del').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); saveAvatars(loadAvatars().filter((a) => a.id !== b.dataset.id)); renderAvatar(); }; });
}

function importAvatar() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const image = await downscaleImage(f, 720);
    const list = loadAvatars();
    list.unshift({ id: prUid(), name: (f.name || 'Avatar').replace(/\.[^.]+$/, '').slice(0, 60), image, at: Date.now() });
    saveAvatars(list);
    renderAvatar();
  };
  inp.click();
}

// Which gender folder a gendered tile pulls from. Gender is multi-select;
// only a sole "Male" pick shows men — Female, both, or none default to women.
function avGender() {
  const g = Array.isArray(acSel.gender) ? acSel.gender : [];
  return g.length === 1 && g[0] === 'Male' ? 'men' : 'women';
}
// A section's live option list. Sections with per-gender option sets
// (hair — men vs women have different styles) resolve against the Gender pick;
// the rest use their static `opts`.
function avOpts(s) {
  return s.optsByGender ? (s.optsByGender[avGender()] || []) : s.opts;
}
// Resolve a tile's photo URL. Gendered sections (ethnicity, hair) swap folder
// with the Gender pick; a plain `img` on an option wins if set; otherwise no
// photo (the colored placeholder shows through).
function avTileSrc(s, o) {
  if (o.f && (s.gendered || s.optsByGender)) return '/avatars/' + s.key + '/' + avGender() + '/' + o.f + '.jpg';
  if (o.f && s.imgDir) return s.imgDir + o.f + '.jpg';
  return o.img || '';
}

// The avatar generator screen: preview in the middle, a "Builder" panel of
// body-part options on the right (Higgsfield-style). Generates with Nano
// Banana Pro.
function renderAvatarCreator(view) {
  const secHtml = AV_SECTIONS.map((s) => {
    if (s.menOnly && avGender() !== 'men') return ''; // facial hair: men only
    const open = acOpen[s.key] === true; // default collapsed until opened
    const sel = acSel[s.key];
    const sOpts = avOpts(s);
    let body = '';
    const has = (v) => Array.isArray(sel) && sel.includes(v); // single-select per category
    if (s.type === 'cards') {
      body = '<div class="ab-cards">' + sOpts.map((o) =>
        '<button type="button" class="ab-card' + (has(o.v) ? ' on' : '') + '" data-k="' + s.key + '" data-v="' + esc(o.v) + '">' +
          '<span class="ab-card-l">' + esc(o.v) + '</span>' + (o.ico ? '<span class="ab-card-i">' + o.ico + '</span>' : '') +
        '</button>').join('') + '</div>';
    } else if (s.type === 'images') {
      body = '<div class="ab-imgs">' + sOpts.map((o, i) => {
        const src = avTileSrc(s, o);
        // Colored placeholder always sits behind; the photo layers on top and
        // hides itself (revealing the placeholder) if the file isn't there yet.
        return '<button type="button" class="ab-img' + (has(o.v) ? ' on' : '') + '" data-k="' + s.key + '" data-v="' + esc(o.v) + '">' +
          '<span class="ab-img-ph ab-ph' + (i % 3) + '"></span>' +
          (src ? '<img class="ab-img-photo" src="' + esc(src) + '" alt="" loading="lazy" onerror="this.remove()" />' : '') +
          '<span class="ab-img-l">' + esc(o.v) + '</span>' +
        '</button>';
      }).join('') + '</div>';
    } else if (s.type === 'swatch') {
      body = '<div class="ab-swatches">' + sOpts.map((o) =>
        '<button type="button" class="ab-swatch' + (has(o.v) ? ' on' : '') + '" data-k="' + s.key + '" data-v="' + esc(o.v) + '" style="background:' + esc(o.c) + '" title="' + esc(o.v) + '" aria-label="' + esc(o.v) + '"></button>').join('') + '</div>';
    } else if (s.type === 'slider') {
      const val = sel != null ? sel : s.def;
      const pct = ((val - s.min) / (s.max - s.min)) * 100;
      body = '<div class="ab-ruler" data-min="' + s.min + '" data-max="' + s.max + '">' +
        '<span class="ab-ruler-lbl">' + esc(s.label) + '</span>' +
        '<span class="ab-ruler-bubble" data-valfor="' + s.key + '">' + val + '</span>' +
        '<div class="ab-ruler-track">' +
          '<div class="ab-ruler-ticks"></div>' +
          '<div class="ab-ruler-fill" style="width:' + pct + '%"></div>' +
          '<div class="ab-ruler-thumb" style="left:' + pct + '%"></div>' +
          '<input type="range" class="ab-range" data-k="' + s.key + '" min="' + s.min + '" max="' + s.max + '" value="' + val + '" />' +
        '</div>' +
      '</div>';
    }
    const cntStr = s.type === 'slider' ? ' · ' + (sel != null ? sel : s.def) : (Array.isArray(sel) && sel.length ? ' · ' + sel.length : '');
    return '<div class="ab-sec' + (open ? ' open' : '') + '" data-sec="' + s.key + '">' +
      '<button type="button" class="ab-sec-h"><span class="ab-sec-t">' + esc(s.label) +
        '<span class="ab-sec-cnt">' + cntStr + '</span></span><span class="ab-chev">⌄</span></button>' +
      '<div class="ab-sec-body">' + body + '</div>' +
    '</div>';
  }).join('');

  view.innerHTML =
    '<div class="ac-page">' +
      '<button type="button" class="ac-back" id="acBack">← Avatars</button>' +
      '<div class="ac-main">' +
        '<div class="ac-stage">' +
          '<div class="ac-preview ac-empty" id="acPreview">' + acGhostHtml() + '</div>' +
          '<div class="ac-actions">' +
            '<button type="button" class="ac-gen" id="acGen"><span class="ac-gen-t">Generate avatar</span><span class="ac-gen-cost">' + avatarCost() + '</span></button>' +
          '</div>' +
        '</div>' +
        '<aside class="ac-builder">' +
          '<div class="ab-top"><span class="ab-top-t">Builder</span><button type="button" class="ab-reset" id="acReset">Reset</button></div>' +
          secHtml +
        '</aside>' +
      '</div>' +
    '</div>';

  const setCount = (sec) => {
    const c = sec.querySelector('.ab-sec-cnt'); if (!c) return;
    const k = sec.dataset.sec, v = acSel[k], def = AV_SECTIONS.find((x) => x.key === k);
    c.textContent = def && def.type === 'slider' ? ' · ' + (v != null ? v : def.def) : (Array.isArray(v) && v.length ? ' · ' + v.length : '');
  };
  view.querySelector('#acBack').onclick = () => { avatarMode = 'list'; renderAvatar(); };
  view.querySelectorAll('.ab-range').forEach((r) => { r.oninput = () => {
    acSel[r.dataset.k] = +r.value;
    const ruler = r.closest('.ab-ruler');
    if (ruler) {
      const mn = +ruler.dataset.min, mx = +ruler.dataset.max;
      const pct = ((+r.value - mn) / (mx - mn)) * 100;
      const fill = ruler.querySelector('.ab-ruler-fill'); if (fill) fill.style.width = pct + '%';
      const thumb = ruler.querySelector('.ab-ruler-thumb'); if (thumb) thumb.style.left = pct + '%';
      const bub = ruler.querySelector('[data-valfor="' + r.dataset.k + '"]'); if (bub) bub.textContent = r.value;
    }
    setCount(r.closest('.ab-sec'));
  }; });
  view.querySelectorAll('.ab-sec-h').forEach((h) => { h.onclick = () => {
    const sec = h.closest('.ab-sec'); acOpen[sec.dataset.sec] = sec.classList.toggle('open');
  }; });
  view.querySelectorAll('.ab-card, .ab-img, .ab-swatch').forEach((el) => { el.onclick = () => {
    const k = el.dataset.k, v = el.dataset.v;
    // Gender is single-select (you're one): clicking sets it, clicking the
    // active one clears it. It swaps the ethnicity photos AND the hair option
    // set, so rebuild the panel and drop the now-invalid gendered hair pick.
    if (k === 'gender') {
      const cur = Array.isArray(acSel.gender) ? acSel.gender : [];
      acSel.gender = (cur.length === 1 && cur[0] === v) ? undefined : [v];
      delete acSel.hair; delete acSel.facial; delete acSel.body;
      renderAvatarCreator(view);
      return;
    }
    // Single-select per category: clicking sets this as the only pick,
    // clicking the active one clears it. (You have one hair, one skin tone…)
    const wasOn = Array.isArray(acSel[k]) && acSel[k].indexOf(v) >= 0;
    acSel[k] = wasOn ? undefined : [v];
    const sec = el.closest('.ab-sec');
    sec.querySelectorAll('.ab-card, .ab-img, .ab-swatch').forEach((n) => {
      n.classList.toggle('on', !wasOn && n.dataset.v === v);
    });
    setCount(sec);
  }; });
  view.querySelector('#acReset').onclick = () => {
    Object.keys(acSel).forEach((k) => delete acSel[k]);
    renderAvatarCreator(view);
  };
  view.querySelector('#acGen').onclick = () => acGenerate();
}

function buildAvatarPrompt() {
  const s = acSel, b = [];
  const arr = (k) => (Array.isArray(s[k]) ? s[k] : s[k] != null ? [s[k]] : []);
  const lc = (a) => a.map((x) => String(x).toLowerCase());
  const join = (a) => {
    if (!a.length) return '';
    if (a.length === 1) return a[0];
    if (a.length === 2) return a[0] + ' and ' + a[1];
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  };
  const gender = arr('gender'); if (gender.length) b.push(join(lc(gender)));
  // Age falls back to the slider's default even if the user never dragged it,
  // so the shown age (e.g. 25) actually drives the generated avatar.
  const age = s.age != null ? s.age : (AV_SECTIONS.find((x) => x.key === 'age') || {}).def;
  if (age) b.push(age + ' years old');
  const eth = arr('ethnicity'); if (eth.length) b.push('of ' + join(eth) + (eth.length > 1 ? ' mixed origin' : ' origin'));
  const body = arr('body'); if (body.length) b.push(join(lc(body)) + ' build');
  const skin = arr('skin'); if (skin.length) b.push(join(lc(skin)) + ' skin');
  const hair = arr('hair'), haircolor = arr('haircolor');
  const hairStyles = hair.filter((h) => h !== 'Bald');
  if (hair.some((h) => h === 'Bald') && !hairStyles.length) b.push('bald');
  else if (hairStyles.length || haircolor.length) {
    b.push((haircolor.length ? join(lc(haircolor)) + ' ' : '') + (hairStyles.length ? join(lc(hairStyles)) + ' ' : '') + 'hair');
  }
  const facial = arr('facial').filter((f) => f !== 'None');
  if (facial.length) b.push('with a ' + join(lc(facial)));
  const eyes = arr('eyes'); if (eyes.length) b.push(join(lc(eyes)) + ' eyes');
  const who = b.length ? 'a ' + b.join(', ') : 'a person';
  // Owner spec (2026-07-16): every avatar renders the SAME way — full body,
  // standing, on a pure white seamless studio background (photoshoot-cutout
  // look), wearing a plain all-white outfit. White on white, no extra colors,
  // so avatars are uniform and drop cleanly into any scene.
  return 'Photorealistic full-body studio photograph of ' + who + ', standing straight facing the camera, full figure visible head to shoes, on a pure seamless white background (professional e-commerce cutout style), wearing a plain all-white outfit — simple white t-shirt, white pants and white sneakers, no logos, no patterns, no extra colors. Neutral confident expression, soft even studio lighting with gentle natural shadows under the feet, sharp focus, high detail — a clean, uniform avatar reference.';
}

let acBusy = false;
// Generate the avatar right here in the preview stage — don't dump the prompt
// into the main chat. Renders into #acPreview, then saves it to the avatar list.
async function acGenerate() {
  if (acBusy) return;
  const stage = document.getElementById('acPreview');
  const genBtn = document.getElementById('acGen');
  if (!stage) return;
  const prompt = buildAvatarPrompt();
  acBusy = true;
  if (genBtn) { genBtn.disabled = true; genBtn.innerHTML = '<span class="ac-gen-t">Generating…</span>'; }
  stage.classList.remove('ac-empty');
  stage.classList.add('ac-loading');
  stage.innerHTML = '<span class="ac-spin"></span><div class="ac-ph-txt">Creating your avatar…<br>this takes a few seconds.</div>';
  const fail = (msg) => {
    stage.classList.remove('ac-loading');
    stage.innerHTML = '<span class="ac-ph-ico">⚠️</span><div class="ac-ph-txt">' + esc(msg) + '</div>';
  };
  try {
    const res = await apiFetch('/api/image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AVATAR_MODEL, prompt, ratio: '2:3', effort: 'off', director: 'off' }), // taller frame — full body head-to-shoes
    });
    const job = await res.json().catch(() => ({}));
    if (res.status === 402) { fail('Not enough credits — tap your ✦ balance up top to get more.'); return; }
    if (!res.ok || !job.status_url || !job.response_url) {
      fail(typeof friendlyFail === 'function' ? friendlyFail(job) : 'Generation failed — try again.'); return;
    }
    if (typeof job.balance === 'number' && typeof setCredits === 'function') setCredits(job.balance);
    // Poll fal until the render completes (avatars are quick — 5 min ceiling).
    const deadline = Date.now() + 5 * 60 * 1000;
    let state = '';
    while (Date.now() < deadline) {
      const sr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(job.status_url));
      if (sr.ok) { const st = await sr.json().catch(() => ({})); state = st.status || ''; if (state === 'COMPLETED') break; }
      await new Promise((r) => setTimeout(r, 3500));
    }
    if (state !== 'COMPLETED') { fail('Timed out — please try again.'); return; }
    const rr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(job.response_url));
    const out = await rr.json().catch(() => ({}));
    const imgs = ((out.images || (out.data && out.data.images) || []).map((im) => im && im.url).filter(Boolean));
    let url = imgs[0] || (out.image && out.image.url) || '';
    if (!url) { fail('No image came back — please try again.'); return; }
    // Copy to permanent storage (fal URLs expire); fall back to the temp link.
    let finalUrl = url;
    try { const saved = await saveOutput(url, 'image'); if (saved && saved.url) finalUrl = saved.url; } catch (e) {}
    if (avatarMode !== 'create') return; // user navigated away mid-render
    stage.classList.remove('ac-loading');
    stage.innerHTML = '<img class="ac-result" src="' + esc(finalUrl) + '" alt="Your avatar" />';
    // Persist it so it shows in the avatar grid.
    const list = loadAvatars();
    list.unshift({ id: prUid(), name: 'Avatar', image: finalUrl, at: Date.now() });
    saveAvatars(list);
  } catch (e) {
    fail('Network hiccup — please try again.');
  } finally {
    acBusy = false;
    if (genBtn) { genBtn.disabled = false; genBtn.innerHTML = '<span class="ac-gen-t">Generate avatar</span><span class="ac-gen-cost">' + avatarCost() + '</span>'; }
  }
}

// ── Memory: universal auto-learned taste is a SYSTEM feature with no
// front-end — no button, no page. It learns and applies silently (see the
// memory store above and directorContext().memory). ──

// ── Products: save a product from a store link or a manual upload, then reuse
// it across generations. Stored locally for now (zephyr_products_v1). ──
const PRODUCTS_KEY = 'zephyr_products_v1';
function loadProducts() { try { return JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]'); } catch { return []; } }
function saveProducts(list) {
  try { localStorage.setItem(PRODUCTS_KEY, JSON.stringify(list.slice(0, 60))); return true; }
  catch (e) { if (typeof sbToast === 'function') sbToast('Storage is full — this product may not stick after a reload. Remove a few to free space.'); return false; }
}
function prUid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ── Media Agent ───────────────────────────────────────────────────────────
// Chat, DMs and publishing over the user's Instagram / YouTube. Linking the
// accounts themselves happens ONLY on the Integrations page — here we just
// reflect connection state (read-only) and link there to manage it.
const SOCIAL_APPS = [
  { key: 'instagram', name: 'Instagram', tag: 'Business or Creator account',
    ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>' },
  { key: 'youtube', name: 'YouTube', tag: 'Channel uploads & analytics',
    ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10.5 9.2l4.2 2.8-4.2 2.8z" fill="currentColor" stroke="none"/></svg>' },
];
let socialStatus = null;   // { instagram:{connected,status,id}, youtube:{...} } | { _off:true } | null
let socialPoll = null;
let maApp = 'instagram';   // selected app in the switcher
let maSec = 'analytics';   // selected section within the app panel
let igAnalytics = null;    // cached analytics payload (per session)
let igAnalyticsLoading = false;
let ytAnalytics = null;    // cached YouTube analytics payload (per session)
let ytAnalyticsLoading = false;
let ytVideos = null;       // cached YouTube videos payload (per session)
let ytVideosLoading = false;
let ytPlaylists = null;    // cached YouTube playlists payload (per session)
let ytPlaylistsLoading = false;
let igPosts = null;        // cached posts payload (per session)
let igPostsLoading = false;
let postsSort = 'recent';  // 'recent' | 'top'
let igComments = null;     // cached comments payload (per session)
let igCommentsLoading = false;
let arState = null;        // auto-reply config { dm_enabled, dm_prompt, comment_enabled, comment_prompt }
let arChannel = 'dm';      // active auto-reply sub-tab: 'dm' | 'comment'
const IG_SECTIONS = [
  { key: 'analytics', label: 'Analytics' },
  { key: 'posts', label: 'Posts' },
  { key: 'dms', label: 'DMs' },
  { key: 'comments', label: 'Comments' },
  { key: 'triggers', label: 'Triggers' },
  { key: 'autoreply', label: 'Auto reply' },
  { key: 'settings', label: 'Settings' },
];
const YT_SECTIONS = [
  { key: 'analytics', label: 'Analytics' },
  { key: 'videos', label: 'Videos' },
  { key: 'playlists', label: 'Playlists' },
];
// The section tabs for the active app.
function appSections() { return maApp === 'youtube' ? YT_SECTIONS : IG_SECTIONS; }

function renderMediaAgent() {
  const view = document.getElementById('viewMediaAgent');
  if (!view) return;
  view.innerHTML =
    '<div class="ma-page">' +
      '<div class="ma-head">' +
        '<h1>Media Agent</h1>' +
        '<p>Pick an app to manage. Connect or disconnect accounts in <b>Integrations</b>.</p>' +
      '</div>' +
      '<div class="app-switch" id="appSwitch"></div>' +
      // Per-app workspace — intentionally empty for now; redesigned next.
      '<div class="app-main" id="appMain"></div>' +
    '</div>';
  paintMaSwitch();
  renderAppMain();
  loadSocialStatus();
}

// Top app switcher — logo-only square tiles with a connection dot. Selecting a
// tile sets the active app; the panel below reacts to it (design in progress).
function paintMaSwitch() {
  const el = document.getElementById('appSwitch');
  if (!el) return;
  if (socialStatus && socialStatus._off) {
    el.innerHTML = '<div class="ma-note">Social connections aren’t configured on the server yet.</div>';
    return;
  }
  el.innerHTML = SOCIAL_APPS.map((a) => {
    const slot = socialStatus ? socialStatus[a.key] : null;
    const on = !!(slot && slot.connected);
    const loading = !socialStatus;
    return '<button type="button" class="app-tile' + (maApp === a.key ? ' on' : '') + '" data-ma-app="' + a.key + '" title="' + a.name + '" aria-label="' + a.name + '">' +
        '<span class="app-tile-ico ma-ico-' + a.key + '">' + a.ico + '</span>' +
        (loading ? '' : '<span class="cdot' + (on ? ' on' : '') + '" title="' + (on ? 'Connected' : 'Not connected') + '"></span>') +
      '</button>';
  }).join('');
  el.querySelectorAll('[data-ma-app]').forEach((b) => { b.onclick = () => selectMaApp(b.dataset.maApp); });
}

function selectMaApp(app) {
  if (!SOCIAL_APPS.some((a) => a.key === app) || maApp === app) return;
  maApp = app;
  paintMaSwitch();
  renderAppMain();
}

// The per-app workspace. Each app gets its own section tabs (Instagram:
// Analytics/Posts/DMs/…; YouTube: Analytics/Videos/Playlists). Not-connected
// apps point the user to Integrations to link.
function renderAppMain() {
  const el = document.getElementById('appMain');
  if (!el) return;
  if (!socialStatus) { el.innerHTML = appNote('Checking connection…'); return; }
  if (socialStatus._off) { el.innerHTML = appNote('Social connections aren’t configured on the server yet.'); return; }
  const slot = socialStatus[maApp];
  if (!(slot && slot.connected)) {
    const name = (SOCIAL_APPS.find((a) => a.key === maApp) || {}).name || 'This app';
    el.innerHTML =
      '<div class="app-empty"><p>' + esc(name) + ' isn’t connected yet.</p>' +
      '<button type="button" class="ma-btn ma-btn-on" id="appConnectCta">Connect in Integrations</button></div>';
    const cta = document.getElementById('appConnectCta');
    if (cta) cta.onclick = () => showView('integrations');
    return;
  }
  const sections = appSections();
  if (!sections.some((s) => s.key === maSec)) maSec = sections[0].key;   // keep section valid per app
  el.innerHTML =
    '<div class="sec-tabs">' +
      sections.map((s) => '<button type="button" class="sec-tab' + (maSec === s.key ? ' on' : '') + '" data-sec="' + s.key + '">' + s.label + '</button>').join('') +
    '</div>' +
    '<div class="sec-body" id="secBody"></div>';
  el.querySelectorAll('[data-sec]').forEach((b) => { b.onclick = () => { maSec = b.dataset.sec; renderAppMain(); }; });
  renderSection();
}

function appNote(text) { return '<div class="app-empty"><p>' + esc(text) + '</p></div>'; }

function renderSection() {
  const body = document.getElementById('secBody');
  if (!body) return;
  if (maApp === 'youtube') {
    if (maSec === 'analytics') { renderYtAnalytics(body); return; }
    if (maSec === 'videos') { renderYtVideos(body); return; }
    if (maSec === 'playlists') { renderYtPlaylists(body); return; }
    const yl = (YT_SECTIONS.find((s) => s.key === maSec) || {}).label || 'This';
    body.innerHTML = '<div class="sec-soon"><p><b>' + esc(yl) + '</b> is coming soon.</p>' +
      '<p class="sec-soon-s">We’re building this section next.</p></div>';
    return;
  }
  if (maSec === 'analytics') { renderAnalytics(body); return; }
  if (maSec === 'posts') { renderPosts(body); return; }
  if (maSec === 'dms') { renderDms(body); return; }
  if (maSec === 'comments') { renderComments(body); return; }
  if (maSec === 'autoreply') { renderAutoReply(body); return; }
  const label = (IG_SECTIONS.find((s) => s.key === maSec) || {}).label || 'This';
  body.innerHTML = '<div class="sec-soon"><p><b>' + esc(label) + '</b> is coming soon.</p>' +
    '<p class="sec-soon-s">We’re building this section next.</p></div>';
}

// ── YouTube Analytics section (live channel data) ──
function renderYtAnalytics(body) {
  if (ytAnalytics) { paintYtAnalytics(body, ytAnalytics); return; }
  body.innerHTML = '<div class="sec-loading">Loading analytics…</div>';
  if (ytAnalyticsLoading) return;
  ytAnalyticsLoading = true;
  apiFetch('/api/social/analytics?platform=youtube')
    .then((r) => (r.status === 429 ? { _err: 'You’ve hit today’s limit — try again tomorrow.' }
      : r.status === 501 ? { _err: 'Analytics isn’t configured on the server yet.' }
      : r.json().catch(() => ({ _err: 'Couldn’t read the response.' }))))
    .then((d) => { ytAnalytics = d && d.ok ? d : { _err: (d && (d._err || d.error)) || 'Something went wrong.' }; })
    .catch(() => { ytAnalytics = { _err: 'Network error.' }; })
    .finally(() => {
      ytAnalyticsLoading = false;
      const b = document.getElementById('secBody');
      if (b && maApp === 'youtube' && maSec === 'analytics') paintYtAnalytics(b, ytAnalytics);
    });
}

function paintYtAnalytics(body, d) {
  if (d._err) {
    body.innerHTML = '<div class="sec-loading">' + esc(String(d._err)) +
      ' <button type="button" class="an-retry" id="ytRetry">Retry</button></div>';
    const rt = document.getElementById('ytRetry');
    if (rt) rt.onclick = () => { ytAnalytics = null; renderYtAnalytics(body); };
    return;
  }
  const ch = d.channel || {};
  const head = ch.title
    ? '<div class="yt-chan">' +
        '<span class="yt-chan-av"' + (ch.thumb ? ' style="background-image:url(' + esc(ch.thumb) + ')"' : '') + '></span>' +
        '<span class="yt-chan-meta"><span class="yt-chan-t">' + esc(ch.title) + '</span>' +
          (ch.handle ? '<span class="yt-chan-h">' + esc(ch.handle) + '</span>' : '') + '</span>' +
      '</div>'
    : '';
  const tiles = [
    ['Subscribers', d.subscribers], ['Views', d.views], ['Videos', d.video_count],
  ].map(([l, v]) => '<div class="stat"><div class="stat-l">' + l + '</div><div class="stat-v">' + maNum(v) + '</div></div>').join('');
  const vids = (d.videos || []).map((v) =>
    '<button type="button" class="prow" data-yturl="' + esc(v.url || '') + '">' +
      '<span class="pthumb pthumb-wide"' + (v.thumb ? ' style="background-image:url(' + esc(v.thumb) + ')"' : '') + '></span>' +
      '<span class="pmeta"><span class="pt">' + esc(v.title || '(untitled)') + '</span>' +
        '<span class="ps">' + esc(ytDate(v.published)) + '</span></span>' +
    '</button>').join('');
  body.innerHTML =
    head +
    '<div class="stats stats-3">' + tiles + '</div>' +
    (vids ? '<div class="sec-sub">Recent videos</div>' + vids : '');
  body.querySelectorAll('[data-yturl]').forEach((b) => {
    b.onclick = () => { const u = b.dataset.yturl; openExternal(u); };
  });
}

// ── YouTube Playlists section ──
function renderYtPlaylists(body) {
  if (ytPlaylists) { paintYtPlaylists(body, ytPlaylists); return; }
  body.innerHTML = '<div class="sec-loading">Loading playlists…</div>';
  if (ytPlaylistsLoading) return;
  ytPlaylistsLoading = true;
  apiFetch('/api/social/playlists?platform=youtube')
    .then((r) => (r.status === 429 ? { _err: 'You’ve hit today’s limit — try again tomorrow.' }
      : r.status === 501 ? { _err: 'Playlists isn’t configured on the server yet.' }
      : r.json().catch(() => ({ _err: 'Couldn’t read the response.' }))))
    .then((d) => { ytPlaylists = d && d.ok ? d : { _err: (d && (d._err || d.error)) || 'Something went wrong.' }; })
    .catch(() => { ytPlaylists = { _err: 'Network error.' }; })
    .finally(() => {
      ytPlaylistsLoading = false;
      const b = document.getElementById('secBody');
      if (b && maApp === 'youtube' && maSec === 'playlists') paintYtPlaylists(b, ytPlaylists);
    });
}

function paintYtPlaylists(body, d) {
  if (d._err) {
    body.innerHTML = '<div class="sec-loading">' + esc(String(d._err)) +
      ' <button type="button" class="an-retry" id="ytpRetry">Retry</button></div>';
    const rt = document.getElementById('ytpRetry');
    if (rt) rt.onclick = () => { ytPlaylists = null; renderYtPlaylists(body); };
    return;
  }
  const pls = d.playlists || [];
  if (!pls.length) {
    body.innerHTML = '<div class="sec-soon"><p>No playlists yet.</p>' +
      '<p class="sec-soon-s">Playlists on your channel will show up here.</p></div>';
    return;
  }
  body.innerHTML =
    '<div class="ytg">' + pls.map((p) =>
      '<button type="button" class="ytv" data-yturl="' + esc(p.url || '') + '">' +
        '<span class="ytv-thumb"' + (p.thumb ? ' style="background-image:url(' + esc(p.thumb) + ')"' : '') + '>' +
          '<span class="ytv-pl">☰ ' + (p.count != null ? maNum(p.count) : '') + '</span></span>' +
        '<span class="ytv-t">' + esc(p.title || '(untitled)') + '</span>' +
        '<span class="ytv-m">' + (p.count != null ? maNum(p.count) + ' video' + (p.count === 1 ? '' : 's') : 'Playlist') + '</span>' +
      '</button>').join('') + '</div>';
  body.querySelectorAll('[data-yturl]').forEach((b) => {
    b.onclick = () => { const u = b.dataset.yturl; openExternal(u); };
  });
}

// "Jul 4, 2026" from an ISO date (blank on failure).
function ytDate(iso) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  try { return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; }
}

// ── YouTube Videos section (channel uploads grid) ──
function renderYtVideos(body) {
  if (ytVideos) { paintYtVideos(body, ytVideos); return; }
  body.innerHTML = '<div class="sec-loading">Loading videos…</div>';
  if (ytVideosLoading) return;
  ytVideosLoading = true;
  apiFetch('/api/social/posts?platform=youtube')
    .then((r) => (r.status === 429 ? { _err: 'You’ve hit today’s limit — try again tomorrow.' }
      : r.status === 501 ? { _err: 'Videos isn’t configured on the server yet.' }
      : r.json().catch(() => ({ _err: 'Couldn’t read the response.' }))))
    .then((d) => { ytVideos = d && d.ok ? d : { _err: (d && (d._err || d.error)) || 'Something went wrong.' }; })
    .catch(() => { ytVideos = { _err: 'Network error.' }; })
    .finally(() => {
      ytVideosLoading = false;
      const b = document.getElementById('secBody');
      if (b && maApp === 'youtube' && maSec === 'videos') paintYtVideos(b, ytVideos);
    });
}

function paintYtVideos(body, d) {
  if (d._err) {
    body.innerHTML = '<div class="sec-loading">' + esc(String(d._err)) +
      ' <button type="button" class="an-retry" id="ytvRetry">Retry</button></div>';
    const rt = document.getElementById('ytvRetry');
    if (rt) rt.onclick = () => { ytVideos = null; renderYtVideos(body); };
    return;
  }
  const vids = d.videos || [];
  const head = '<div class="posts-head"><span class="posts-count">' + vids.length +
    ' video' + (vids.length === 1 ? '' : 's') + '</span>' +
    '<div class="posts-ctrls"><button type="button" class="posts-add" id="ytAdd" title="Upload video" aria-label="Upload to YouTube">+</button></div></div>';
  const grid = vids.length
    ? '<div class="ytg">' + vids.map((v) =>
        '<button type="button" class="ytv" data-yturl="' + esc(v.url || '') + '">' +
          '<span class="ytv-thumb"' + (v.thumb ? ' style="background-image:url(' + esc(v.thumb) + ')"' : '') + '></span>' +
          '<span class="ytv-t">' + esc(v.title || '(untitled)') + '</span>' +
          '<span class="ytv-m">' + (v.views != null ? '▶ ' + maNum(v.views) + ' views' : ytDate(v.published)) + '</span>' +
        '</button>').join('') + '</div>'
    : '<div class="sec-soon"><p>No videos yet.</p>' +
        '<p class="sec-soon-s">Tap + to upload a video to your channel.</p></div>';
  body.innerHTML = head + grid;
  body.querySelectorAll('[data-yturl]').forEach((b) => {
    b.onclick = () => { const u = b.dataset.yturl; openExternal(u); };
  });
  const add = document.getElementById('ytAdd');
  if (add) add.onclick = () => openYtComposer(body);
}

// The "+" composer in the Videos tab — upload a video to YouTube. Reuses the
// shared publish foot/doPublish (pubPlatform='youtube').
function openYtComposer(body) {
  pubPlatform = 'youtube';
  pubBusy = false;
  body.innerHTML =
    '<div class="ma-publish" id="maPublish">' +
      '<div class="ma-pub-head">' +
        '<button type="button" class="ma-pub-back" id="pubBack">← Videos</button>' +
        '<span class="ma-pub-title">Upload to YouTube</span>' +
      '</div>' +
      '<div class="ma-pub-body">' +
        '<label class="ma-pub-l">Video</label>' +
        '<div class="pub-preview" id="pubPreview"></div>' +
        '<div class="pub-pick">' +
          '<button type="button" class="ma-btn ma-btn-off pub-pick-btn" id="pubFileBtn">📁 Choose from computer</button>' +
          '<button type="button" class="ma-btn ma-btn-off pub-pick-btn" id="pubGal">🖼 From gallery</button>' +
        '</div>' +
        '<input type="file" id="pubFile" accept="video/*" style="display:none">' +
        '<label class="ma-pub-l">or paste a public URL</label>' +
        '<input id="pubMedia" class="ma-pub-in" placeholder="https://….mp4">' +
        '<label class="ma-pub-l">Title</label>' +
        '<input id="pubTitle" class="ma-pub-in" placeholder="Video title">' +
        '<label class="ma-pub-l">Description</label>' +
        '<textarea id="pubDesc" class="ma-pub-ta ma-pub-in" placeholder="Description (optional)"></textarea>' +
        '<label class="ma-pub-l">Privacy</label>' +
        '<select id="pubPrivacy" class="ma-pub-in">' +
          '<option value="private">Private (only you)</option>' +
          '<option value="unlisted">Unlisted (anyone with the link)</option>' +
          '<option value="public">Public</option>' +
        '</select>' +
        '<div class="ma-pub-foot" id="pubFoot"></div>' +
      '</div>' +
    '</div>';
  const back = document.getElementById('pubBack');
  if (back) back.onclick = () => { ytVideos = null; renderYtVideos(body); };
  const gal = document.getElementById('pubGal');
  if (gal) gal.onclick = () => openPubGalleryPicker(true);   // videos only
  const fileBtn = document.getElementById('pubFileBtn');
  const fileIn = document.getElementById('pubFile');
  if (fileBtn && fileIn) {
    fileBtn.onclick = () => fileIn.click();
    fileIn.onchange = () => { if (fileIn.files && fileIn.files[0]) pubUploadDeviceFile(fileIn.files[0]); };
  }
  renderPubFoot();
}

// Compact number: <10k with thousands separators, else 1-decimal "k".
function maNum(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n < 10000) return n.toLocaleString('en-US');
  const k = n / 1000;
  return (k >= 100 ? Math.round(k) : Number(k.toFixed(1))) + 'k';
}

// ── Analytics section (live Instagram data) ──
function renderAnalytics(body) {
  if (igAnalytics) { paintAnalytics(body, igAnalytics); return; }
  body.innerHTML = '<div class="sec-loading">Loading analytics…</div>';
  if (igAnalyticsLoading) return;
  igAnalyticsLoading = true;
  apiFetch('/api/social/analytics?platform=instagram')
    .then((r) => (r.status === 429 ? { _err: 'You’ve hit today’s limit — try again tomorrow.' }
      : r.status === 501 ? { _err: 'Analytics isn’t configured on the server yet.' }
      : r.json().catch(() => ({ _err: 'Couldn’t read the response.' }))))
    .then((d) => { igAnalytics = d && d.ok ? d : { _err: (d && (d._err || d.error)) || 'Something went wrong.' }; })
    .catch(() => { igAnalytics = { _err: 'Network error.' }; })
    .finally(() => {
      igAnalyticsLoading = false;
      const b = document.getElementById('secBody');
      if (b && maSec === 'analytics') paintAnalytics(b, igAnalytics);
    });
}

function paintAnalytics(body, d) {
  if (d._err) {
    body.innerHTML = '<div class="sec-loading">' + esc(String(d._err)) +
      ' <button type="button" class="an-retry" id="anRetry">Retry</button></div>';
    const rt = document.getElementById('anRetry');
    if (rt) rt.onclick = () => { igAnalytics = null; renderAnalytics(body); };
    return;
  }
  const tiles = [
    ['Followers', d.followers], ['Reach · 30d', d.reach],
    ['Views · 30d', d.views], ['Interactions · 30d', d.interactions],
  ].map(([l, v]) => '<div class="stat"><div class="stat-l">' + l + '</div><div class="stat-v">' + maNum(v) + '</div></div>').join('');
  const chart = analyticsChart(d.reach_series);
  const posts = (d.top_posts || []).map((p) =>
    '<div class="prow">' +
      '<span class="pthumb"' + (p.thumb ? ' style="background-image:url(' + esc(p.thumb) + ')"' : '') + '></span>' +
      '<span class="pmeta"><span class="pt">' + esc(p.caption || '(no caption)') + '</span>' +
        '<span class="ps">' + esc(p.media_type || 'post') + '</span></span>' +
      '<span class="pnum">♥ ' + maNum(p.likes) + '</span>' +
      '<span class="pnum">💬 ' + maNum(p.comments) + '</span>' +
    '</div>').join('');
  body.innerHTML =
    '<div class="stats">' + tiles + '</div>' +
    (chart ? '<div class="card"><div class="card-h"><span class="card-t">Reach</span>' +
      '<span class="card-legend">Last ' + (d.reach_series.length) + ' days</span></div>' + chart + '</div>' : '') +
    (posts ? '<div class="sec-sub">Top posts</div>' + posts : '');
}

// Pink→amber area/line chart from a [{t,v}] series (empty → no chart).
function analyticsChart(series) {
  if (!Array.isArray(series) || series.length < 2) return '';
  const vals = series.map((s) => Number(s.v) || 0);
  const W = 680, H = 150, padT = 14, padB = 12, padX = 6;
  const min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || 1;
  const xs = (i) => padX + i * ((W - 2 * padX) / (vals.length - 1));
  const ys = (v) => padT + (1 - (v - min) / span) * (H - padT - padB);
  const line = vals.map((v, i) => (i ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(v).toFixed(1)).join(' ');
  const area = line + ' L' + xs(vals.length - 1).toFixed(1) + ' ' + (H - padB) + ' L' + xs(0).toFixed(1) + ' ' + (H - padB) + ' Z';
  const last = vals.length - 1;
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="none" style="display:block">' +
    '<defs><linearGradient id="agL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff79c6"/><stop offset="1" stop-color="#ffb84d"/></linearGradient>' +
    '<linearGradient id="agF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff79c6" stop-opacity=".28"/><stop offset="1" stop-color="#ff79c6" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + area + '" fill="url(#agF)"/>' +
    '<path d="' + line + '" fill="none" stroke="url(#agL)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="' + xs(last).toFixed(1) + '" cy="' + ys(vals[last]).toFixed(1) + '" r="4" fill="#ffb84d"/></svg>';
}

// ── Posts section (live Instagram media grid) ──
function renderPosts(body) {
  if (igPosts) { paintPosts(body, igPosts); return; }
  body.innerHTML = '<div class="sec-loading">Loading posts…</div>';
  if (igPostsLoading) return;
  igPostsLoading = true;
  apiFetch('/api/social/posts?platform=instagram')
    .then((r) => (r.status === 429 ? { _err: 'You’ve hit today’s limit — try again tomorrow.' }
      : r.status === 501 ? { _err: 'Posts isn’t configured on the server yet.' }
      : r.json().catch(() => ({ _err: 'Couldn’t read the response.' }))))
    .then((d) => { igPosts = d && d.ok ? d : { _err: (d && (d._err || d.error)) || 'Something went wrong.' }; })
    .catch(() => { igPosts = { _err: 'Network error.' }; })
    .finally(() => {
      igPostsLoading = false;
      const b = document.getElementById('secBody');
      if (b && maSec === 'posts') paintPosts(b, igPosts);
    });
}

function paintPosts(body, d) {
  if (d._err) {
    body.innerHTML = '<div class="sec-loading">' + esc(String(d._err)) +
      ' <button type="button" class="an-retry" id="pRetry">Retry</button></div>';
    const rt = document.getElementById('pRetry');
    if (rt) rt.onclick = () => { igPosts = null; renderPosts(body); };
    return;
  }
  const posts = (d.posts || []).slice();
  if (postsSort === 'top') posts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  const addBtn = '<button type="button" class="posts-add" id="pAdd" title="New post" aria-label="New Instagram post">+</button>';
  const head =
    '<div class="posts-head"><span class="posts-count">' + posts.length + ' post' + (posts.length === 1 ? '' : 's') + '</span>' +
      '<div class="posts-ctrls">' +
        (posts.length ? '<div class="posts-sort">' +
          '<button type="button" class="psort' + (postsSort === 'recent' ? ' on' : '') + '" data-sort="recent">Recent</button>' +
          '<button type="button" class="psort' + (postsSort === 'top' ? ' on' : '') + '" data-sort="top">Top</button>' +
        '</div>' : '') + addBtn +
      '</div></div>';
  const gridOrEmpty = posts.length
    ? '<div class="grid">' + posts.map((p) =>
        '<button type="button" class="post" data-perma="' + esc(p.permalink || '') + '">' +
          '<span class="post-media"' + (p.thumb ? ' style="background-image:url(' + esc(p.thumb) + ')"' : '') + '>' +
            (p.media_type ? '<span class="post-k">' + esc(p.media_type) + '</span>' : '') + '</span>' +
          '<span class="post-nums"><span>♥ ' + maNum(p.likes) + '</span><span>💬 ' + maNum(p.comments) + '</span></span>' +
        '</button>').join('') + '</div>'
    : '<div class="sec-soon"><p>No posts yet.</p>' +
        '<p class="sec-soon-s">Tap + to create your first Instagram post.</p></div>';
  body.innerHTML = head + gridOrEmpty;
  body.querySelectorAll('[data-sort]').forEach((b) => { b.onclick = () => { postsSort = b.dataset.sort; paintPosts(body, d); }; });
  body.querySelectorAll('[data-perma]').forEach((b) => {
    b.onclick = () => { const u = b.dataset.perma; openExternal(u); };
  });
  const add = document.getElementById('pAdd');
  if (add) add.onclick = () => openPostComposer(body);
}

// The "+" composer in the Posts tab — create & publish a new Instagram post
// (image or reel). Reuses the shared publish foot/doPublish, scoped to Instagram.
function openPostComposer(body) {
  pubPlatform = 'instagram';
  pubBusy = false;
  body.innerHTML =
    '<div class="ma-publish" id="maPublish">' +
      '<div class="ma-pub-head">' +
        '<button type="button" class="ma-pub-back" id="pubBack">← Posts</button>' +
        '<span class="ma-pub-title">New Instagram post</span>' +
      '</div>' +
      '<div class="ma-pub-body">' +
        '<label class="ma-pub-l">Media</label>' +
        '<div class="pub-preview" id="pubPreview"></div>' +
        '<div class="pub-pick">' +
          '<button type="button" class="ma-btn ma-btn-off pub-pick-btn" id="pubFileBtn">📁 Choose from computer</button>' +
          '<button type="button" class="ma-btn ma-btn-off pub-pick-btn" id="pubGal">🖼 From gallery</button>' +
        '</div>' +
        '<input type="file" id="pubFile" accept="image/*,video/*" style="display:none">' +
        '<label class="ma-pub-l">or paste a public URL</label>' +
        '<input id="pubMedia" class="ma-pub-in" placeholder="https://…">' +
        '<label class="ma-pub-l">Type</label>' +
        '<select id="pubType" class="ma-pub-in">' +
          '<option value="image">Image post</option>' +
          '<option value="video">Reel / video</option>' +
        '</select>' +
        '<label class="ma-pub-l">Caption</label>' +
        '<textarea id="pubCaption" class="ma-pub-ta ma-pub-in" placeholder="Caption (optional)"></textarea>' +
        '<div class="ma-pub-foot" id="pubFoot"></div>' +
      '</div>' +
    '</div>';
  const back = document.getElementById('pubBack');
  if (back) back.onclick = () => { igPosts = null; renderPosts(body); };
  const gal = document.getElementById('pubGal');
  if (gal) gal.onclick = () => openPubGalleryPicker();
  const fileBtn = document.getElementById('pubFileBtn');
  const fileIn = document.getElementById('pubFile');
  if (fileBtn && fileIn) {
    fileBtn.onclick = () => fileIn.click();
    fileIn.onchange = () => { if (fileIn.files && fileIn.files[0]) pubUploadDeviceFile(fileIn.files[0]); };
  }
  renderPubFoot();
}

// Upload a device-chosen file to storage (→ public URL Instagram can fetch),
// then fill the composer's URL + type + preview. Images ≤12MB, video ≤~30MB.
async function pubUploadDeviceFile(file) {
  const kind = (file.type || '').startsWith('video') ? 'video' : 'image';
  const prev = document.getElementById('pubPreview');
  if ((kind === 'image' && file.size > 12_000_000) || (kind === 'video' && file.size > 30_000_000)) {
    pubResult(kind === 'image' ? 'Image is too large (max 12MB).' : 'Video is too large (max 30MB).', 'warn');
    return;
  }
  if (prev) { prev.classList.add('on'); prev.innerHTML = '<div class="pub-preview-load">Uploading…</div>'; }
  pubResult('', '');
  try {
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const b64 = String(dataUrl).split(',')[1] || '';
    const r = await apiFetch('/api/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: b64, kind }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 402) {
      if (prev) { prev.classList.remove('on'); prev.innerHTML = ''; }
      pubResult('Uploading your own files needs a paid plan (gallery storage). Pick from your gallery or paste a URL instead.', 'warn');
      return;
    }
    if (!r.ok || !d.url) {
      if (prev) { prev.classList.remove('on'); prev.innerHTML = ''; }
      pubResult('Upload failed — try a smaller file or a different format.', 'warn');
      return;
    }
    const media = document.getElementById('pubMedia');
    const type = document.getElementById('pubType');
    if (media) media.value = d.url;
    if (type) type.value = kind === 'video' ? 'video' : 'image';
    if (prev) {
      prev.innerHTML = '';
      if (kind === 'video') {
        const chip = document.createElement('div');
        chip.className = 'pub-preview-vid';
        chip.textContent = '🎬 Video ready';
        prev.appendChild(chip);
      } else {
        const img = document.createElement('img');
        img.alt = ''; img.src = d.url;
        prev.appendChild(img);
      }
      prev.appendChild(pubPreviewRemoveBtn());
    }
  } catch {
    if (prev) { prev.classList.remove('on'); prev.innerHTML = ''; }
    pubResult('Couldn’t read that file.', 'warn');
  }
}

// All saved media across chats (images + videos) for the publish picker.
function allGalleryMedia() {
  const seen = new Set();
  const out = [];
  (chatStore.chats || []).forEach((c) => (c.msgs || []).forEach((m) => {
    if (m.t === 'media' && m.url && !seen.has(m.url)) {
      seen.add(m.url);
      out.push({ url: m.url, kind: m.kind || 'video', poster: m.poster || null, at: m.at || 0 });
    }
  }));
  return out.sort((a, b) => b.at - a.at);
}

// Gallery picker for the composer — images and videos; a pick fills the URL +
// type fields (reusing the shared .gal-overlay styling).
function openPubGalleryPicker(videoOnly) {
  const old = document.querySelector('.gal-overlay');
  if (old) old.remove();
  let items = allGalleryMedia();
  if (videoOnly) items = items.filter((it) => it.kind === 'video');
  const ov = document.createElement('div');
  ov.className = 'gal-overlay';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = '<div class="gal-box"><div class="gal-head"><span class="gal-title">Pick from your gallery</span>' +
    '<span class="gal-sub">' + (items.length ? items.length + (items.length === 1 ? ' item' : ' items') : '') + '</span>' +
    '<button class="gal-close">×</button></div>' +
    (items.length ? '<div class="gal-grid"></div>'
      : '<div class="gal-empty">Nothing in your gallery yet — generate an image or video first, then it shows up here.</div>') +
    '</div>';
  const closeBtn = ov.querySelector('.gal-close');
  if (closeBtn) closeBtn.onclick = () => ov.remove();
  const gridEl = ov.querySelector('.gal-grid');
  if (gridEl) items.forEach((it) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'gal-cell';
    const img = document.createElement('img');
    img.alt = '';
    img.src = it.kind === 'video' ? (it.poster || it.url) : it.url;
    cell.appendChild(img);
    if (it.kind === 'video') {
      const k = document.createElement('span');
      k.className = 'gal-cell-k';
      k.textContent = 'REEL';
      cell.appendChild(k);
    }
    cell.onclick = () => { pubSelectMedia(it); ov.remove(); };
    gridEl.appendChild(cell);
  });
  document.body.appendChild(ov);
}

// A "×" on the preview to clear the current media and pick another.
function pubPreviewRemoveBtn() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pub-preview-x';
  b.title = 'Remove';
  b.setAttribute('aria-label', 'Remove media');
  b.textContent = '×';
  b.onclick = pubClearMedia;
  return b;
}

function pubClearMedia() {
  const media = document.getElementById('pubMedia');
  const prev = document.getElementById('pubPreview');
  const fileIn = document.getElementById('pubFile');
  if (media) media.value = '';
  if (fileIn) fileIn.value = '';
  if (prev) { prev.classList.remove('on'); prev.innerHTML = ''; }
  pubResult('', '');
}

// A picked gallery item fills the URL + type fields and shows a preview.
function pubSelectMedia(it) {
  const media = document.getElementById('pubMedia');
  const type = document.getElementById('pubType');
  const prev = document.getElementById('pubPreview');
  if (media) media.value = it.url;
  if (type) type.value = it.kind === 'video' ? 'video' : 'image';
  if (prev) {
    prev.innerHTML = '';
    const img = document.createElement('img');
    img.alt = '';
    img.src = it.kind === 'video' ? (it.poster || it.url) : it.url;
    prev.appendChild(img);
    prev.appendChild(pubPreviewRemoveBtn());
    prev.classList.add('on');
  }
}

// ── Comments section (live feed across recent posts) ──
function renderComments(body) {
  if (igComments) { paintComments(body, igComments); return; }
  body.innerHTML = '<div class="sec-loading">Loading comments…</div>';
  if (igCommentsLoading) return;
  igCommentsLoading = true;
  apiFetch('/api/social/comments?platform=instagram')
    .then((r) => (r.status === 429 ? { _err: 'You’ve hit today’s limit — try again tomorrow.' }
      : r.status === 501 ? { _err: 'Comments isn’t configured on the server yet.' }
      : r.json().catch(() => ({ _err: 'Couldn’t read the response.' }))))
    .then((d) => { igComments = d && d.ok ? d : { _err: (d && (d._err || d.error)) || 'Something went wrong.' }; })
    .catch(() => { igComments = { _err: 'Network error.' }; })
    .finally(() => {
      igCommentsLoading = false;
      const b = document.getElementById('secBody');
      if (b && maSec === 'comments') paintComments(b, igComments);
    });
}

function paintComments(body, d) {
  if (d._err) {
    body.innerHTML = '<div class="sec-loading">' + esc(String(d._err)) +
      ' <button type="button" class="an-retry" id="cRetry">Retry</button></div>';
    const rt = document.getElementById('cRetry');
    if (rt) rt.onclick = () => { igComments = null; renderComments(body); };
    return;
  }
  const comments = d.comments || [];
  const cHead = '<div class="posts-head"><span class="posts-count">' + comments.length +
    ' comment' + (comments.length === 1 ? '' : 's') + '</span>' +
    '<div class="posts-ctrls"><button type="button" class="posts-add" id="cRefresh" title="Refresh" aria-label="Refresh comments">↻</button></div></div>';
  const wireRefresh = () => {
    const rf = document.getElementById('cRefresh');
    if (rf) rf.onclick = () => { igComments = null; renderComments(body); };
  };
  if (!comments.length) {
    body.innerHTML = cHead + '<div class="sec-soon"><p>No comments yet.</p>' +
      '<p class="sec-soon-s">Comments on your recent posts will show up here. Tap ↻ to refresh.</p></div>';
    wireRefresh();
    return;
  }
  body.innerHTML = cHead + '<div class="cmt-list">' + comments.map((c) =>
    '<div class="cmt">' +
      '<span class="cmt-av">' + esc((c.from || '?').slice(0, 1).toUpperCase()) + '</span>' +
      '<span class="cmt-body"><span class="cmt-user">' + esc(c.from ? '@' + c.from : 'unknown') + '</span>' +
        '<span class="cmt-text">' + agentFmt(c.text || '') + '</span>' +
        (c.id ? '<button type="button" class="cmt-reply-btn" data-reply="' + esc(c.id) + '">↩ Reply</button>' : '') +
      '</span>' +
      (c.post_permalink
        ? '<button type="button" class="cmt-thumb" data-perma="' + esc(c.post_permalink) + '"' +
          (c.post_thumb ? ' style="background-image:url(' + esc(c.post_thumb) + ')"' : '') + ' title="Open post"></button>'
        : '<span class="cmt-thumb"' + (c.post_thumb ? ' style="background-image:url(' + esc(c.post_thumb) + ')"' : '') + '></span>') +
    '</div>').join('') + '</div>';
  body.querySelectorAll('[data-perma]').forEach((b) => {
    b.onclick = () => { const u = b.dataset.perma; openExternal(u); };
  });
  body.querySelectorAll('[data-reply]').forEach((b) => {
    b.onclick = () => openCommentReply(b.dataset.reply, b);
  });
  wireRefresh();
}

// Inline reply composer under a comment → posts a public reply to Instagram.
function openCommentReply(cid, btn) {
  const cmt = btn.closest('.cmt');
  if (!cmt || cmt.querySelector('.cmt-reply')) return;
  const box = document.createElement('div');
  box.className = 'cmt-reply';
  box.innerHTML =
    '<input type="text" class="cmt-reply-in" placeholder="Write a reply…" maxlength="300">' +
    '<button type="button" class="ma-btn ma-btn-on cmt-reply-send">Send</button>' +
    '<span class="cmt-reply-status" id="cmtReplyStatus"></span>';
  cmt.appendChild(box);
  const input = box.querySelector('.cmt-reply-in');
  const send = box.querySelector('.cmt-reply-send');
  const status = box.querySelector('.cmt-reply-status');
  const setStatus = (t, kind) => { if (status) { status.textContent = t; status.className = 'cmt-reply-status' + (kind ? ' ' + kind : ''); } };
  if (input) input.focus();
  if (send) send.onclick = async () => {
    const msg = (input.value || '').trim();
    if (!msg) { setStatus('Type a reply first.', 'warn'); return; }
    send.disabled = true; send.textContent = 'Sending…';
    try {
      const r = await apiFetch('/api/social/comment/reply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: cid, message: msg }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.ok) {
        setStatus('Replied ✓', 'ok');
        input.disabled = true; send.style.display = 'none';
      } else {
        setStatus(d.error ? 'Failed: ' + d.error : 'Couldn’t reply.', 'warn');
        send.disabled = false; send.textContent = 'Send';
      }
    } catch {
      setStatus('Network error.', 'warn');
      send.disabled = false; send.textContent = 'Send';
    }
  };
}

// ── Auto reply section (prompt-driven, per channel: DM + Comments) ──
function renderAutoReply(body) {
  if (arState) { paintAutoReply(body); return; }
  body.innerHTML = '<div class="sec-loading">Loading…</div>';
  apiFetch('/api/social/autoreply')
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((c) => {
      arState = {
        dm_enabled: !!(c && c.dm_enabled), dm_prompt: (c && c.dm_prompt) || '',
        comment_enabled: !!(c && c.comment_enabled), comment_prompt: (c && c.comment_prompt) || '',
      };
      if (maSec === 'autoreply') paintAutoReply(document.getElementById('secBody') || body);
    });
}

// Pull whatever's typed into the visible textarea back into arState so a
// sub-tab switch (or save) never loses in-progress edits.
function arSyncFromDom() {
  const ta = document.getElementById('arPrompt');
  if (ta) arState[arChannel + '_prompt'] = ta.value;
  const sw = document.getElementById('arEnabled');
  if (sw) arState[arChannel + '_enabled'] = sw.classList.contains('on');
}

function paintAutoReply(body) {
  if (!body || !arState) return;
  const ch = arChannel;                       // 'dm' | 'comment'
  const on = !!arState[ch + '_enabled'];
  const prompt = arState[ch + '_prompt'] || '';
  const isDm = ch === 'dm';
  const noun = isDm ? 'direct messages' : 'comments';
  const ph = isDm
    ? 'e.g. Reply warmly and briefly as the account owner. Thank people for reaching out. If someone asks about pricing or collabs, point them to studio@example.com. Never share personal details or promise delivery dates.'
    : 'e.g. Thank people for kind comments in a short, friendly way. Answer simple questions about the work. If a comment is negative or asks something you can’t answer, stay polite and don’t engage further.';
  body.innerHTML =
    '<div class="ar">' +
      '<div class="ar-subtabs">' +
        '<button type="button" class="ar-subtab' + (isDm ? ' on' : '') + '" data-arch="dm">DM</button>' +
        '<button type="button" class="ar-subtab' + (!isDm ? ' on' : '') + '" data-arch="comment">Comments</button>' +
      '</div>' +
      '<div class="ar-body">' +
        '<div class="ar-row">' +
          '<div class="ar-row-l"><div class="ar-row-t">Auto reply to ' + noun + '</div>' +
            '<div class="ar-row-s">When on, the agent replies using your instructions below.</div></div>' +
          '<button type="button" class="ar-switch' + (on ? ' on' : '') + '" id="arEnabled" role="switch" aria-checked="' + on + '"><span class="ar-knob"></span></button>' +
        '</div>' +
        '<div class="ar-field"><div class="ar-label">Instructions <span class="ar-hint">— tone, what to say, what to avoid</span></div>' +
          '<textarea class="ar-prompt" id="arPrompt" placeholder="' + esc(ph) + '">' + esc(prompt) + '</textarea></div>' +
        '<div class="ar-foot"><button type="button" class="ma-btn ma-btn-on" id="arSave">Save</button>' +
          '<span class="ar-status" id="arStatus"></span></div>' +
      '</div>' +
    '</div>';
  body.querySelectorAll('[data-arch]').forEach((b) => {
    b.onclick = () => { if (b.dataset.arch === arChannel) return; arSyncFromDom(); arChannel = b.dataset.arch; paintAutoReply(document.getElementById('secBody')); };
  });
  const sw = document.getElementById('arEnabled');
  if (sw) sw.onclick = () => { const v = !sw.classList.contains('on'); sw.classList.toggle('on', v); sw.setAttribute('aria-checked', v); };
  const save = document.getElementById('arSave');
  if (save) save.onclick = () => saveAutoReply();
}

async function saveAutoReply() {
  arSyncFromDom();
  const save = document.getElementById('arSave');
  const status = document.getElementById('arStatus');
  const setStatus = (t, kind) => { if (status) { status.textContent = t; status.className = 'ar-status' + (kind ? ' ' + kind : ''); } };
  if (arState[arChannel + '_enabled'] && !String(arState[arChannel + '_prompt']).trim()) {
    setStatus('Add instructions before turning it on.', 'warn'); return;
  }
  if (save) { save.disabled = true; save.textContent = 'Saving…'; }
  try {
    const r = await apiFetch('/api/social/autoreply', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(arState),
    });
    setStatus(r.ok ? 'Saved ✓' : 'Couldn’t save — try again.', r.ok ? 'ok' : 'warn');
  } catch { setStatus('Network error.', 'warn'); }
  if (save) { save.disabled = false; save.textContent = 'Save'; }
}

// ── Media Agent · Instagram DM inbox ──
let dmConvs = null;
let dmOpen = null;   // { id, user, user_id }

// Renders the DMs tab: a conversation list (left) + the open thread with a
// reply composer (right). Selecting a conversation loads its messages.
function renderDms(body) {
  body.innerHTML =
    '<div class="ma-dm" id="maDm">' +
      '<div class="ma-dm-head"><span>Direct Messages</span>' +
        '<button type="button" class="ma-dm-refresh" id="maDmRefresh" title="Refresh">↻</button></div>' +
      '<div class="ma-dm-body">' +
        '<div class="ma-dm-list" id="maDmList"></div>' +
        '<div class="ma-dm-thread" id="maDmThread">' +
          '<div class="ma-dm-empty">Select a conversation to read it and reply.</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  loadDMs();
  const dr = document.getElementById('maDmRefresh');
  if (dr) dr.onclick = () => loadDMs();
}

async function loadDMs() {
  const list = document.getElementById('maDmList');
  if (list) list.innerHTML = '<div class="ma-dm-empty">Loading conversations…</div>';
  try {
    const r = await apiFetch('/api/social/dm');
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { dmConvs = []; renderDmList(r.status === 501 ? 'Not configured.' : 'Couldn’t load messages.'); return; }
    dmConvs = d.conversations || [];
  } catch { dmConvs = []; renderDmList('Network error.'); return; }
  renderDmList();
}

function renderDmList(note) {
  const list = document.getElementById('maDmList');
  if (!list) return;
  if (note) { list.innerHTML = '<div class="ma-dm-empty">' + esc(note) + '</div>'; return; }
  if (!dmConvs || !dmConvs.length) { list.innerHTML = '<div class="ma-dm-empty">No conversations yet. When someone DMs your account, it shows here.</div>'; return; }
  list.innerHTML = dmConvs.map((c) =>
    '<button type="button" class="ma-dm-conv' + (dmOpen && dmOpen.id === c.id ? ' on' : '') + '" data-cid="' + esc(c.id) + '">' +
      '<span class="ma-dm-av">' + esc((c.user || '?').slice(0, 1).toUpperCase()) + '</span>' +
      '<span class="ma-dm-meta"><span class="ma-dm-user">' + esc(c.user || 'unknown') + '</span>' +
        '<span class="ma-dm-prev">' + esc(c.last || '') + '</span></span>' +
    '</button>').join('');
  list.querySelectorAll('[data-cid]').forEach((b) => {
    b.onclick = () => { const c = dmConvs.find((x) => x.id === b.dataset.cid); if (c) openThread(c); };
  });
}

async function openThread(c) {
  dmOpen = c;
  renderDmList();
  const t = document.getElementById('maDmThread');
  if (!t) return;   // list-only mode (no thread pane yet) — just highlight
  t.innerHTML = '<div class="ma-dm-empty">Loading…</div>';
  let msgs = [];
  try {
    const r = await apiFetch('/api/social/dm?conversation_id=' + encodeURIComponent(c.id));
    const d = await r.json().catch(() => ({}));
    msgs = d.messages || [];
  } catch {}
  renderDmThread(c, msgs);
}

function renderDmThread(c, msgs) {
  const t = document.getElementById('maDmThread');
  if (!t) return;
  t.innerHTML =
    '<div class="ma-dm-tophead">Chat with <b>@' + esc(c.user || 'unknown') + '</b></div>' +
    '<div class="ma-dm-msgs" id="maDmMsgs">' +
      (msgs.length ? msgs.map((m) =>
        '<div class="ma-dm-bub ' + (m.mine ? 'mine' : 'them') + '">' + agentFmt(m.text || '') + '</div>').join('')
        : '<div class="ma-dm-empty">No messages loaded.</div>') +
    '</div>' +
    '<form class="ma-dm-reply" id="maDmReply" autocomplete="off">' +
      '<input id="maDmInput" class="ma-input" placeholder="Reply to @' + esc(c.user || '') + '…" autocomplete="off"' + (c.user_id ? '' : ' disabled') + ' />' +
      '<button type="submit" class="ma-send" aria-label="Send reply">↑</button>' +
    '</form>' +
    '<div class="ma-dm-note" id="maDmNote"></div>';
  const box = document.getElementById('maDmMsgs'); if (box) box.scrollTop = box.scrollHeight;
  const form = document.getElementById('maDmReply');
  if (form) form.onsubmit = (e) => { e.preventDefault(); const i = document.getElementById('maDmInput'); const v = i.value.trim(); if (v && c.user_id) { i.value = ''; sendDM(c, v); } };
}

async function sendDM(c, text) {
  const note = document.getElementById('maDmNote');
  const box = document.getElementById('maDmMsgs');
  if (box) box.insertAdjacentHTML('beforeend', '<div class="ma-dm-bub mine pending">' + agentFmt(text) + '</div>');
  if (box) box.scrollTop = box.scrollHeight;
  if (note) note.textContent = 'Sending…';
  try {
    const r = await apiFetch('/api/social/dm/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_id: c.user_id, text }),
    });
    const d = await r.json().catch(() => ({}));
    if (d.ok) { if (note) note.textContent = 'Sent ✓'; box.querySelector('.pending')?.classList.remove('pending'); }
    else { if (note) note.textContent = 'Couldn’t send — ' + esc(String(d.error || 'try again').slice(0, 120)); box.querySelector('.pending')?.classList.add('failed'); }
  } catch { if (note) note.textContent = 'Network error.'; }
}

// ── Media Agent publishing (write, behind a confirm gate) ──
let pubPlatform = 'youtube';
let pubBusy = false;

function renderPublish() {
  const el = document.getElementById('maPublish');
  if (!el) return;
  const yt = pubPlatform === 'youtube';
  el.innerHTML =
    '<div class="ma-pub-head">' +
      '<span class="ma-pub-title">Publish media</span>' +
      '<div class="ma-pub-tabs">' +
        '<button type="button" class="ma-pub-tab' + (yt ? ' on' : '') + '" data-pub="youtube">YouTube</button>' +
        '<button type="button" class="ma-pub-tab' + (!yt ? ' on' : '') + '" data-pub="instagram">Instagram</button>' +
      '</div>' +
    '</div>' +
    '<div class="ma-pub-body">' +
      '<label class="ma-pub-l">Media URL <span class="ma-pub-hint">(public link — e.g. from your Gallery)</span></label>' +
      '<input id="pubMedia" class="ma-pub-in" placeholder="https://…' + (yt ? '.mp4' : '.jpg or .mp4') + '" autocomplete="off" />' +
      (yt
        ? '<label class="ma-pub-l">Title</label>' +
          '<input id="pubTitle" class="ma-pub-in" placeholder="Video title" autocomplete="off" />' +
          '<label class="ma-pub-l">Description</label>' +
          '<textarea id="pubDesc" class="ma-pub-in ma-pub-ta" placeholder="Description (optional)"></textarea>' +
          '<label class="ma-pub-l">Privacy</label>' +
          '<select id="pubPrivacy" class="ma-pub-in">' +
            '<option value="private">Private (only you)</option>' +
            '<option value="unlisted">Unlisted (anyone with the link)</option>' +
            '<option value="public">Public</option>' +
          '</select>'
        : '<label class="ma-pub-l">Type</label>' +
          '<select id="pubType" class="ma-pub-in">' +
            '<option value="image">Image post</option>' +
            '<option value="video">Reel / video</option>' +
          '</select>' +
          '<label class="ma-pub-l">Caption</label>' +
          '<textarea id="pubCaption" class="ma-pub-ta ma-pub-in" placeholder="Caption (optional)"></textarea>') +
      '<div class="ma-pub-foot" id="pubFoot"></div>' +
    '</div>';
  el.querySelectorAll('[data-pub]').forEach((b) => { b.onclick = () => { if (!pubBusy) { pubPlatform = b.dataset.pub; renderPublish(); } }; });
  renderPubFoot();
}

function renderPubFoot(mode) {
  const foot = document.getElementById('pubFoot');
  if (!foot) return;
  const name = pubPlatform === 'youtube' ? 'YouTube' : 'Instagram';
  if (mode === 'confirm') {
    const priv = pubPlatform === 'youtube' ? (document.getElementById('pubPrivacy') || {}).value : null;
    foot.innerHTML =
      '<div class="ma-pub-confirm">' +
        '<span>Publish to <b>' + name + '</b>' + (priv ? ' as <b>' + priv + '</b>' : '') + '? This posts to your real account.</span>' +
        '<div class="ma-pub-cbtns">' +
          '<button type="button" class="ma-btn ma-btn-off" id="pubCancel">Cancel</button>' +
          '<button type="button" class="ma-btn ma-btn-on" id="pubGo">Confirm &amp; publish</button>' +
        '</div>' +
      '</div>';
    foot.querySelector('#pubCancel').onclick = () => renderPubFoot();
    foot.querySelector('#pubGo').onclick = () => doPublish();
    return;
  }
  foot.innerHTML = '<button type="button" class="ma-btn ma-btn-on ma-pub-submit" id="pubSubmit">Publish to ' + name + '</button>' +
    '<div class="ma-pub-result" id="pubResult"></div>';
  foot.querySelector('#pubSubmit').onclick = () => {
    const media = (document.getElementById('pubMedia') || {}).value || '';
    if (!media.trim()) { pubResult('Add a media URL first.', 'warn'); return; }
    renderPubFoot('confirm');
  };
}

function pubResult(html, kind) {
  const el = document.getElementById('pubResult');
  if (el) el.innerHTML = html ? '<div class="ma-pub-res ma-pub-res-' + (kind || 'ok') + '">' + html + '</div>' : '';
}

async function doPublish() {
  if (pubBusy) return;
  pubBusy = true;
  const payload = { platform: pubPlatform, media_url: (document.getElementById('pubMedia') || {}).value.trim() };
  if (pubPlatform === 'youtube') {
    payload.title = (document.getElementById('pubTitle') || {}).value.trim() || 'Untitled';
    payload.description = (document.getElementById('pubDesc') || {}).value.trim();
    payload.privacy = (document.getElementById('pubPrivacy') || {}).value || 'private';
  } else {
    payload.media_type = (document.getElementById('pubType') || {}).value || 'image';
    payload.caption = (document.getElementById('pubCaption') || {}).value.trim();
  }
  renderPubFoot();
  pubResult('Publishing… (uploading can take a bit)', 'busy');
  try {
    const r = await apiFetch('/api/social/publish', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 429) pubResult('You’ve hit today’s publish limit.', 'warn');
    else if (r.status === 501) pubResult('Publishing isn’t configured on the server.', 'warn');
    else if (d.ok) {
      const link = pubPlatform === 'youtube' && d.id ? ' <a href="https://youtu.be/' + esc(d.id) + '" target="_blank" rel="noopener">View →</a>' : '';
      pubResult('Published to ' + (pubPlatform === 'youtube' ? 'YouTube' : 'Instagram') + ' ✓' + link, 'ok');
    } else pubResult('Couldn’t publish — ' + esc(String(d.error || 'try again').slice(0, 160)), 'warn');
  } catch { pubResult('Network error — try again.', 'warn'); }
  pubBusy = false;
}

// ── Media Agent chat (read-only account Q&A) ──
let agentMsgs = [];       // {role:'user'|'assistant', content}
let agentBusy = false;

const AGENT_SUGGESTIONS = [
  'How many followers do I have on each platform?',
  'What are my latest YouTube videos and their views?',
  'How many posts can I still publish on Instagram today?',
];

function agentRenderThread() {
  const thread = document.getElementById('maThread');
  if (!thread) return;
  if (!agentMsgs.length && !agentBusy) {
    thread.innerHTML = '<div class="ma-empty-chat">' +
      '<p>Your agent can read your Instagram &amp; YouTube. Try:</p>' +
      '<div class="ma-suggests">' +
        AGENT_SUGGESTIONS.map((s) => '<button type="button" class="ma-suggest">' + esc(s) + '</button>').join('') +
      '</div></div>';
    thread.querySelectorAll('.ma-suggest').forEach((b) => { b.onclick = () => agentSend(b.textContent); });
    return;
  }
  thread.innerHTML = agentMsgs.map((m) =>
    '<div class="ma-bub ma-bub-' + m.role + '">' + agentFmt(m.content) + '</div>').join('') +
    (agentBusy ? '<div class="ma-bub ma-bub-assistant ma-typing"><span></span><span></span><span></span></div>' : '');
  thread.scrollTop = thread.scrollHeight;
}

// Minimal, safe formatting: escape, then bold **x** and newlines → <br>.
function agentFmt(text) {
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
}

async function agentSend(text) {
  if (agentBusy) return;
  agentMsgs.push({ role: 'user', content: text });
  agentBusy = true;
  agentRenderThread();
  try {
    const r = await apiFetch('/api/agent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: agentMsgs }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 429) agentMsgs.push({ role: 'assistant', content: 'You’ve hit today’s agent limit — try again tomorrow.' });
    else if (r.status === 501) agentMsgs.push({ role: 'assistant', content: 'The agent isn’t configured on the server yet.' });
    else if (!r.ok || !d.reply) agentMsgs.push({ role: 'assistant', content: 'Something went wrong reaching your accounts. Try again.' });
    else agentMsgs.push({ role: 'assistant', content: d.reply });
  } catch {
    agentMsgs.push({ role: 'assistant', content: 'Network error — try again.' });
  }
  agentBusy = false;
  agentRenderThread();
}

// Read-only connection strip for the Media Agent page. Linking is managed on
// Integrations, so this only reflects state (per platform) and links there —
// no Connect/Disconnect controls here.
// Repaint every mounted surface that reflects connection state: Media Agent's
// app switcher (#appSwitch) and the Integrations hub (#igList). Both read the
// shared socialStatus, so linking on Integrations refreshes the switcher dots.
function paintSocial() {
  paintIntegrations();
  paintMaSwitch();
  // Reflect connection state in the panel (e.g. once status resolves from
  // "Checking…" to connected). Cheap: analytics is cached after first load.
  if (document.getElementById('appMain')) renderAppMain();
}

// Status line for the connect/disconnect flow — mirrored to whichever surface
// is mounted (Media Agent's #maMsg and/or Integrations' #igMsg).
function maMsg(text, kind) {
  ['maMsg', 'igMsg'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!text) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.className = 'ma-msg' + (kind ? ' ma-msg-' + kind : '');
    el.innerHTML = text;
  });
}

async function loadSocialStatus() {
  try {
    const r = await apiFetch('/api/social/status');
    if (r.ok) socialStatus = await r.json();
    else if (r.status === 501) socialStatus = { _off: true };
    else socialStatus = null;
  } catch { socialStatus = null; }
  paintSocial();
}

async function connectSocial(key) {
  const app = SOCIAL_APPS.find((a) => a.key === key);
  maMsg('');
  const btn = document.querySelector('[data-social-con="' + key + '"], [data-ig-con="' + key + '"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Opening…'; }
  let data = {};
  try {
    const r = await apiFetch('/api/social/connect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolkit: key }),
    });
    data = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 409 && data.error === 'no_auth_config') {
        maMsg('No ' + (app ? app.name : key) + ' auth config found. Create one in your ' +
          '<a href="https://dashboard.composio.dev" target="_blank" rel="noopener">Composio dashboard</a> (add the app + your developer credentials), then try again.', 'warn');
      } else {
        maMsg('Couldn’t start the connection' + (data.detail ? ' — ' + esc(data.detail) : '.'), 'warn');
      }
      paintSocial();
      return;
    }
  } catch {
    maMsg('Network error starting the connection. Try again.', 'warn');
    paintSocial();
    return;
  }
  if (!data.redirect_url) { paintSocial(); return; }
  const popup = window.open(data.redirect_url, 'composio_' + key, 'width=620,height=780');
  maMsg('Authorize ' + (app ? app.name : key) + ' in the popup window…');
  pollSocial(key, popup);
}

function pollSocial(key, popup) {
  if (socialPoll) clearInterval(socialPoll);
  const app = SOCIAL_APPS.find((a) => a.key === key);
  let tries = 0;
  socialPoll = setInterval(async () => {
    tries++;
    let connected = false;
    try {
      const r = await apiFetch('/api/social/status');
      if (r.ok) { socialStatus = await r.json(); connected = !!(socialStatus[key] && socialStatus[key].connected); }
    } catch {}
    const closed = !popup || popup.closed;
    if (connected) {
      clearInterval(socialPoll); socialPoll = null;
      if (popup && !popup.closed) { try { popup.close(); } catch {} }
      maMsg((app ? app.name : key) + ' connected ✓', 'ok');
    } else if (tries > 48 || (closed && tries > 1)) {
      clearInterval(socialPoll); socialPoll = null;
      if (closed) maMsg('Connection window closed before finishing. Nothing was linked.', 'warn');
      else maMsg('Still waiting on authorization — you can retry any time.', 'warn');
    }
    paintSocial();
  }, 2500);
}

async function disconnectSocial(key) {
  const app = SOCIAL_APPS.find((a) => a.key === key);
  if (!confirm('Disconnect ' + (app ? app.name : key) + '? The agent will lose access until you reconnect.')) return;
  const btn = document.querySelector('[data-social-dis="' + key + '"], [data-ig-dis="' + key + '"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Removing…'; }
  maMsg('');
  try {
    const r = await apiFetch('/api/social/disconnect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolkit: key }),
    });
    if (!r.ok) throw 0;
    if (socialStatus && socialStatus[key]) socialStatus[key] = { connected: false, status: null, id: null };
  } catch {
    maMsg('Couldn’t disconnect — try again.', 'warn');
  }
  paintSocial();
}

function renderProducts() {
  const view = document.getElementById('viewProducts');
  if (!view) return;
  view.innerHTML =
    '<div class="products-page">' +
      '<div class="pr-head"><h1>Add your product</h1>' +
        '<p>Add a link or upload an image to use your product across generations.</p></div>' +
      '<div class="pr-add">' +
        '<div class="pr-url">' +
          '<span class="pr-url-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg></span>' +
          '<input id="prUrl" type="url" placeholder="www.yourproduct.com" autocomplete="off" spellcheck="false" />' +
          '<button type="button" class="pr-url-go" id="prUrlGo" aria-label="Add product">→</button>' +
        '</div>' +
        '<span class="pr-or">or</span>' +
        '<button type="button" class="pr-manual" id="prManual">Create manually</button>' +
      '</div>' +
      '<div class="pr-grid" id="prGrid"></div>' +
    '</div>';
  renderProductGrid();
  const urlInput = view.querySelector('#prUrl');
  const go = () => { const v = urlInput.value.trim(); if (v) addProductFromUrl(v); };
  view.querySelector('#prUrlGo').onclick = go;
  urlInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
  view.querySelector('#prManual').onclick = () => openCreateProduct();
}

function renderProductGrid() {
  const grid = document.getElementById('prGrid');
  if (!grid) return;
  const products = loadProducts();
  grid.innerHTML = products.map((p) =>
    '<div class="pr-card" data-id="' + esc(p.id) + '">' +
      (p.image
        ? '<div class="pr-thumb"><img src="' + esc(p.image) + '" alt="" loading="lazy" /></div>'
        : '<div class="pr-thumb pr-thumb-empty">📦</div>') +
      '<button class="pr-menu-btn" aria-label="Options">⋯</button>' +
      '<div class="pr-menu">' +
        '<button data-act="gen">Generate ad</button>' +
        '<button data-act="del" class="pr-menu-del">Remove</button>' +
      '</div>' +
      '<div class="pr-name">' + esc(p.name || 'Product') + '</div>' +
    '</div>').join('');
  grid.querySelectorAll('.pr-card').forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('.pr-menu-btn').onclick = (e) => { e.stopPropagation(); toggleProductMenu(card); };
    card.querySelector('[data-act="gen"]').onclick = (e) => { e.stopPropagation(); startProductAd(id); };
    card.querySelector('[data-act="del"]').onclick = (e) => { e.stopPropagation(); removeProduct(id); };
  });
}

function toggleProductMenu(card) {
  const open = card.classList.contains('menu-open');
  document.querySelectorAll('.pr-card.menu-open').forEach((c) => c.classList.remove('menu-open'));
  if (!open) {
    card.classList.add('menu-open');
    const close = (e) => { if (!card.contains(e.target)) { card.classList.remove('menu-open'); document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 0);
  }
}

function removeProduct(id) {
  saveProducts(loadProducts().filter((p) => p.id !== id));
  renderProductGrid();
}

async function addProductFromUrl(url) {
  const grid = document.getElementById('prGrid');
  if (!grid) return;
  const inp = document.getElementById('prUrl'); if (inp) inp.value = '';
  const loader = document.createElement('div');
  loader.className = 'pr-card pr-loading';
  loader.innerHTML = '<div class="pr-ring"></div><div class="pr-load-t">Creating product</div><div class="pr-load-s">It takes a few seconds</div>';
  grid.insertBefore(loader, grid.firstChild);
  try {
    const res = await apiFetch('/api/product/scan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      // Surface the server's reason (e.g. the store's bot-check wall) verbatim.
      let reason = '';
      try { reason = ((await res.json()) || {}).error || ''; } catch {}
      throw new Error(reason);
    }
    const data = await res.json();
    const img = data.image || '';
    const p = { id: prUid(), name: data.name || 'Product', desc: (data.desc || '').slice(0, 300), image: img, images: img ? [img] : [], site: data.site || '', at: Date.now() };
    const list = loadProducts(); list.unshift(p); saveProducts(list);
    renderProductGrid();
  } catch (e) {
    loader.className = 'pr-card pr-loading pr-error';
    const why = (e && e.message) ? esc(e.message) : 'Try “Create manually” instead.';
    loader.innerHTML = '<div class="pr-load-t">Couldn’t read that link</div><div class="pr-load-s">' + why + '</div>';
    setTimeout(() => loader.remove(), 6500);
  }
}

function downscaleImage(file, max) {
  return new Promise((resolve) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(src);
      try { resolve(c.toDataURL('image/jpeg', 0.85)); } catch { resolve(''); }
    };
    img.onerror = () => { URL.revokeObjectURL(src); resolve(''); };
    img.src = src;
  });
}

function openCreateProduct() {
  if (document.querySelector('.credits-overlay')) return;
  let imgData = '';
  const ov = document.createElement('div');
  ov.className = 'credits-overlay';
  ov.innerHTML = '<div class="cp-box pr-modal">' +
    '<div class="cp-head"><div class="cp-title">Create product</div><button type="button" class="cp-close">✕</button></div>' +
    '<div class="pr-modal-body">' +
      '<label class="pr-upload" id="prUpload">' +
        '<input type="file" accept="image/*" id="prFile" hidden />' +
        '<div class="pr-upload-inner" id="prUploadInner">' +
          '<div class="pr-upload-ico">⬆</div><div class="pr-upload-t">Upload product image <span class="pr-req">*</span></div><div class="pr-upload-sub">PNG or JPG</div>' +
        '</div>' +
      '</label>' +
      '<div class="pr-fields">' +
        '<label class="pr-flabel">Product name <span class="pr-req">*</span></label>' +
        '<input class="pr-in" id="prName" placeholder="Enter product name" autocomplete="off" required />' +
        '<label class="pr-flabel">Description</label>' +
        '<textarea class="pr-ta" id="prDesc" placeholder="Describe your product"></textarea>' +
        '<button type="button" class="pr-create" id="prCreate" disabled>Create product</button>' +
      '</div>' +
    '</div>' +
  '</div>';
  document.body.appendChild(ov);
  const fileInput = ov.querySelector('#prFile');
  const inner = ov.querySelector('#prUploadInner');
  const nameInp = ov.querySelector('#prName');
  const descInp = ov.querySelector('#prDesc');
  const createBtn = ov.querySelector('#prCreate');
  // Both a product name and an image are required to save.
  const uploadPrompt = '<div class="pr-upload-ico">⬆</div><div class="pr-upload-t">Upload product image</div><div class="pr-upload-sub">PNG or JPG</div>';
  const refresh = () => { createBtn.disabled = !nameInp.value.trim() || !imgData; };
  // Clear an accidentally-added image; Create stays disabled until one is re-added.
  const clearImg = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    imgData = '';
    fileInput.value = '';
    inner.innerHTML = uploadPrompt;
    refresh();
  };
  fileInput.onchange = async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    imgData = await downscaleImage(f, 720);
    if (imgData) {
      inner.innerHTML = '<img class="pr-upload-img" src="' + esc(imgData) + '" alt="" />' +
        '<button type="button" class="pr-upload-x" aria-label="Remove image">✕</button>';
      inner.querySelector('.pr-upload-x').onclick = clearImg;
    }
    refresh();
  };
  nameInp.oninput = refresh;
  // One close path so the keydown listener is always removed (closing via ✕ or
  // the backdrop used to leak one listener per open).
  let onKey;
  const close = () => { ov.remove(); if (onKey) document.removeEventListener('keydown', onKey); };
  createBtn.onclick = () => {
    if (createBtn.disabled) return;
    const p = { id: prUid(), name: nameInp.value.trim().slice(0, 120), desc: descInp.value.trim().slice(0, 500), image: imgData, images: imgData ? [imgData] : [], site: '', at: Date.now() };
    const list = loadProducts(); list.unshift(p); saveProducts(list);
    close();
    renderProducts();
  };
  ov.onclick = (e) => { if (e.target === ov) close(); };
  ov.querySelector('.cp-close').onclick = close;
  onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  setTimeout(() => nameInp.focus(), 30);
}

// Start an ad from a saved product: drop into the composer prefilled.
function startProductAd(id) {
  const p = loadProducts().find((x) => x.id === id);
  if (!p) return;
  showView('home');
  const input = document.getElementById('input');
  if (input) {
    input.value = 'Create a polished, scroll-stopping ad for ' + (p.name || 'my product') + (p.desc ? ' — ' + p.desc : '') + '.';
    if (typeof autoGrow === 'function') autoGrow(input);
    input.focus();
  }
}

function initAuthGate() {
  const form = document.getElementById('authForm');
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); submitAuth(); });
  const toggle = document.getElementById('authToggle');
  if (toggle) toggle.addEventListener('click', () => setAuthMode(authMode === 'up' ? 'in' : 'up'));
  const forgot = document.getElementById('authForgot');
  if (forgot) forgot.addEventListener('click', onAuthBack);
  const resend = document.getElementById('authResend');
  if (resend) resend.addEventListener('click', resendAuthCode);
  renderAuthStep();
  // Marketing CTAs (data-mkt="start"|"signin") open the gate; the gate's back
  // button returns to the landing.
  document.querySelectorAll('[data-mkt]').forEach((el) => {
    const mode = el.getAttribute('data-mkt');
    const go = (e) => { if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); openAuthFrom(mode); };
    el.addEventListener('click', go);
    if (el.getAttribute('role') === 'button') el.addEventListener('keydown', go);
  });
  // The popup closes three ways — ✕, backdrop click, Esc — all back to the landing.
  // Backing out of the popup drops any prompt typed into the landing chatbox,
  // so a later sign-in doesn't fire a stale generation.
  const closeAuth = () => { pendingFirstMsg = null; hideAuthGate(); showMarketing(); };
  const back = document.getElementById('authHome');
  if (back) back.addEventListener('click', closeAuth);
  const gateEl = document.getElementById('authGate');
  if (gateEl) gateEl.addEventListener('click', (e) => { if (e.target === gateEl) closeAuth(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !gateEl) return;
    if (getComputedStyle(gateEl).display === 'none') return;
    if (window.Auth && Auth.isSignedIn()) return; // mid-session re-auth: don't dismiss
    closeAuth();
  });
  // (initLeadHero removed — the old chatbox hero is gone; the CRT landing's
  //  preview stage is built by initCrtStage inside initCrt.)
  initMktReveal();
  initMktRotate();
  initMktCord();
  initCrt();   // the CRT is now the landing itself (channels + tuning)
  if (window.Auth && Auth.isSignedIn()) enterApp();
  else showMarketing();
}

// Marketing: each how-it-works step (.mkt-rotate) cycles through its inner
// frames, its supporting line, and a vertical phrase wheel in lockstep. The
// wheel keeps all phrases visible — active one centred and sharp, neighbours
// blurred above/below — and slides the next one up into the middle. All steps
// share one clock so the column reads as a single beat.
function initMktRotate() {
  const steps = Array.prototype.slice.call(document.querySelectorAll('.mkt-rotate'));
  if (!steps.length) return;
  const ROW = 2.4; // rem — must match .mkt-wheel-item height
  const groups = steps.map((step) => ({
    frames: Array.prototype.slice.call(step.querySelectorAll('.mkt-frames > .mkt-frame')),
    wheel: Array.prototype.slice.call(step.querySelectorAll('.mkt-wheel-item')),
  }));

  // Place one step at `active`. `animate` false (initial) or when an item wraps
  // top↔bottom skips the transition so it teleports instead of sweeping through.
  const place = (g, active, animate) => {
    g.frames.forEach((el, k) => el.classList.toggle('on', k === active % g.frames.length));
    const n = g.wheel.length;
    g.wheel.forEach((el, i) => {
      const off = (((i - active) % n) + n) % n;   // 0..n-1
      const slot = off > n / 2 ? off - n : off;   // centred range, e.g. -1,0,1
      const prev = el.dataset.slot === undefined || el.dataset.slot === '' ? null : +el.dataset.slot;
      const wraps = prev !== null && Math.abs(slot - prev) > 1;
      if (!animate || wraps) el.style.transition = 'none';
      el.style.transform = 'translateY(' + (slot * ROW) + 'rem)';
      el.style.opacity = slot === 0 ? '1' : '.28';
      el.style.filter = slot === 0 ? 'none' : 'blur(3px)';
      el.classList.toggle('is-focus', slot === 0);
      if (!animate || wraps) { void el.offsetWidth; el.style.transition = ''; }
      el.dataset.slot = String(slot);
    });
  };

  const N = Math.max.apply(null, groups.map((g) => Math.max(g.frames.length, g.wheel.length)));
  if (N < 2) return;
  groups.forEach((g) => place(g, 0, false));
  let active = 0;
  setInterval(() => {
    active = (active + 1) % N;
    groups.forEach((g) => place(g, active, true));
  }, 3600);
}

// Marketing: draw the connector cord that S-curves from the bottom of each
// how-it-works tile into the top of the next. Measured from live tile positions
// (the tiles alternate sides), redrawn on resize so it always lines up. The
// cord sits behind the tiles, so it tucks under them and shows in the gaps.
function initMktCord() {
  const wrap = document.querySelector('.mkt-how-steps');
  if (!wrap) return;
  const svg = wrap.querySelector('.mkt-cord');
  const path = svg && svg.querySelector('.mkt-cord-path');
  const grad = svg && svg.querySelector('#mktCordGrad');
  if (!path) return;
  const draw = () => {
    const tiles = Array.prototype.slice.call(wrap.querySelectorAll('.mkt-step-tile'));
    if (tiles.length < 2) return;
    const wb = wrap.getBoundingClientRect();
    if (!wb.width || !wb.height) return;
    svg.setAttribute('viewBox', '0 0 ' + wb.width + ' ' + wb.height);
    if (grad) { grad.setAttribute('y2', wb.height); }
    let d = '';
    for (let i = 0; i < tiles.length - 1; i++) {
      const a = tiles[i].getBoundingClientRect();
      const b = tiles[i + 1].getBoundingClientRect();
      const acx = a.left + a.width / 2, acy = a.top + a.height / 2;
      const bcx = b.left + b.width / 2, bcy = b.top + b.height / 2;
      const sameRow = Math.abs(bcy - acy) < Math.min(a.height, b.height) * 0.5;
      const stacked = Math.abs(bcx - acx) < Math.min(a.width, b.width) * 0.5;
      if (sameRow) {                           // side by side → connect facing horizontal edges
        const rightward = bcx > acx;
        const sx = (rightward ? a.right - 14 : a.left + 14) - wb.left;
        const ex = (rightward ? b.left + 14 : b.right - 14) - wb.left;
        const sy = acy - wb.top, ey = bcy - wb.top;
        const dx = ex - sx;
        d += 'M ' + sx + ' ' + sy +
             ' C ' + (sx + dx * 0.55) + ' ' + sy +
             ', ' + (ex - dx * 0.55) + ' ' + ey +
             ', ' + ex + ' ' + ey + ' ';
      } else if (stacked) {                    // one above the other → connect vertical edges
        const sx = acx - wb.left, ex = bcx - wb.left;
        const sy = a.bottom - wb.top - 14, ey = b.top - wb.top + 14;
        const dy = ey - sy;
        d += 'M ' + sx + ' ' + sy +
             ' C ' + sx + ' ' + (sy + dy * 0.55) +
             ', ' + ex + ' ' + (ey - dy * 0.55) +
             ', ' + ex + ' ' + ey + ' ';
      }
      // else: not adjacent (e.g. top-right → bottom-left wrap) — skip, no diagonal
    }
    path.setAttribute('d', d.trim());
  };
  draw();
  // redraw after fonts/layout/reveal settle, and on resize
  setTimeout(draw, 300);
  setTimeout(draw, 1200);
  if ('ResizeObserver' in window) { new ResizeObserver(draw).observe(wrap); }
  window.addEventListener('resize', draw);
}

// ── CRT channel selector ──────────────────────────────────────────────────
// Shown right after sign-in. ↑↓ (or clicking) tune a channel, Enter/click
// selects. Live channels (video, audio) enter the workspace in that mode; the
// rest flash a NO SIGNAL / COMING SOON state. The VHF knob turns with the
// channel. State lives on module-level crtSel; wiring is one-time in initCrt().
let crtSel = 0;
let crtNosigTimer = null;
function enterCrt() {
  const crt = document.getElementById('crtSelect');
  if (!crt) { enterApp(); return; }            // safety: no CRT markup → old behaviour
  hideMarketing();
  hideAuthGate();
  crt.style.display = 'flex';
  crtSel = 0;
  paintCrt();
  const menu = document.getElementById('crtMenu');
  if (menu) menu.focus();
}
function hideCrt() {
  const crt = document.getElementById('crtSelect');
  if (crt) crt.style.display = 'none';
}
function paintCrt() {
  const opts = Array.prototype.slice.call(document.querySelectorAll('#crtMenu .crt-opt'));
  opts.forEach((o, i) => {
    const on = i === crtSel;
    o.classList.toggle('on', on);
    o.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const chNo = document.getElementById('crtChNo');
  if (chNo) chNo.textContent = 'CH ' + String(crtSel + 1).padStart(2, '0');
  // morph the preview stage to the tuned channel
  const sel = opts[crtSel];
  if (sel) crtShowPanel(sel.dataset.panel || 'nosig');
  // The chatbox only drives the live channel (Video/Image/Voice). On a
  // coming-soon channel, dim it and swap the placeholder so it reads inert.
  const box = document.getElementById('crtChatbox');
  const inp = document.getElementById('crtLandInput');
  const live = !sel || sel.dataset.live === '1';
  if (box) box.classList.toggle('crt-chatbox-soon', !live);
  if (inp) inp.placeholder = live
    ? 'a neon tiger prowling a rainy Tokyo alley, cinematic'
    : 'Coming soon — pick Video / Image / Voice to create';
}
// swap the visible preview panel; lazy-load the website iframes on first show
function crtShowPanel(panel) {
  const stage = document.getElementById('leadStage');
  if (!stage) return;
  stage.querySelectorAll('.lp-panel').forEach((p) => p.classList.toggle('mkt-on', p.dataset.panel === panel));
  if (panel === 'website') {
    stage.querySelectorAll('.mb-slot[data-src]').forEach((s) => {
      const f = s.querySelector('iframe');
      if (f && !f.src) f.src = s.getAttribute('data-src');
    });
  }
}
function crtMove(delta) {
  const n = document.querySelectorAll('#crtMenu .crt-opt').length;
  if (!n) return;
  crtSel = (crtSel + delta + n) % n;
  paintCrt();
}
function crtSelect() {
  const opt = document.querySelectorAll('#crtMenu .crt-opt')[crtSel];
  if (!opt) return;
  if (opt.dataset.live === '1') {
    if (window.Auth && Auth.isSignedIn()) { enterApp(); return; }   // already in → straight to the studio
    if (typeof openAuthFrom === 'function') openAuthFrom('start', 'app');  // picked a channel → into the studio
  }
  // coming-soon channels already show the NO SIGNAL preview via paintCrt — no-op
}
// Build the preview stage once: filmstrip columns, voice wave, website cascade.
function initCrtStage() {
  const stage = document.getElementById('leadStage');
  if (!stage) return;
  // 'v' → a real AI-made clip playing on loop in one of the squares, with a
  // tap-to-unmute sound button top-right (autoplay must start muted).
  const soundBtn = '<button class="mkt-vid-sound" type="button" aria-label="Play sound">'
    + '<svg class="ico-off" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
    + '<svg class="ico-on" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 4.5a9 9 0 0 1 0 15"/></svg>'
    + '</button>';
  // A cell is either a still ('mkt-cN' + /mkt/fN.jpg) or a video — pass a video
  // as { v:'reel1' } and it renders /mkt/reel1.mp4 (+ /mkt/reel1.jpg poster) with
  // its own tap-to-unmute button. Drop more videos in by adding { v:'reel2' } etc.
  const vidCell = (name) => '<div class="mkt-cell mkt-cvid"><video class="mkt-cell-vid" src="/mkt/' + name + '.mp4" poster="/mkt/' + name + '.jpg" muted loop autoplay playsinline preload="metadata"></video>' + soundBtn + '</div>';
  const cell = (n) => (n && n.v)
    ? vidCell(n.v)
    : '<div class="mkt-cell mkt-c' + n + '"><span class="mkt-cell-img" style="background-image:url(/mkt/f' + n + '.jpg)"></span></div>';
  const col = (arr) => { const one = arr.map(cell).join(''); return one + one; };  // doubled for seamless loop
  const cols = stage.querySelectorAll('.lp-col');
  if (cols[0]) cols[0].innerHTML = col([{ v: 'reel1' }, 3, 5, 7, 9, 11, 13]);
  if (cols[1]) cols[1].innerHTML = col([2, 4, 6, 8, 10, 12, 14]);
  // Drive the loop by the EXACT height of one copy (the start of the 2nd copy)
  // so it wraps seamlessly — a plain -50% is short by the last cell's uncounted
  // margin and visibly jumps. Recompute on resize (cells are vw-sized).
  const setDrift = () => cols.forEach((c) => {
    const cells = c.querySelectorAll('.mkt-cell');
    const mid = cells[cells.length / 2];
    if (mid) c.style.setProperty('--vdrift', '-' + mid.offsetTop + 'px');
  });
  requestAnimationFrame(setDrift);
  let driftT; window.addEventListener('resize', () => { clearTimeout(driftT); driftT = setTimeout(setDrift, 150); });
  // Pause-on-hover via the Web Animations API — pauses/resumes the drift on BOTH
  // the main and compositor threads, so it truly freezes in place and resumes
  // from the exact spot (a CSS :hover play-state pause can keep a GPU-composited
  // animation visually running on some laptops). Falls back to the style prop.
  const film = stage.querySelector('.lp-film');
  if (film) {
    const setPlay = (paused) => cols.forEach((c) => {
      const anims = c.getAnimations ? c.getAnimations() : [];
      if (anims.length) anims.forEach((a) => paused ? a.pause() : a.play());
      else c.style.animationPlayState = paused ? 'paused' : 'running';
    });
    film.addEventListener('mouseenter', () => setPlay(true));
    film.addEventListener('mouseleave', () => setPlay(false));
  }
  // Tap-to-unmute: clicking a clip's sound button unmutes THAT copy and mutes
  // every other (the strip is doubled, so both copies exist — no echo).
  stage.querySelectorAll('.mkt-vid-sound').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cvid = btn.closest('.mkt-cvid');
      const vid = cvid && cvid.querySelector('.mkt-cell-vid');
      if (!vid) return;
      const turnOn = vid.muted;
      stage.querySelectorAll('.mkt-cell-vid').forEach((v) => { v.muted = true; });
      stage.querySelectorAll('.mkt-vid-sound').forEach((b) => b.classList.remove('on'));
      if (turnOn) { vid.muted = false; try { vid.play(); } catch (e2) {} btn.classList.add('on'); }
    });
  });
  const cascade = document.getElementById('mbCascade');
  const slots = cascade ? Array.prototype.slice.call(cascade.querySelectorAll('.mb-slot')) : [];
  const N = slots.length;
  let front = 0;
  const layoutWeb = () => slots.forEach((s, n) => {
    const rel = (n - front + N) % N;
    s.classList.remove('mb-p1', 'mb-p2', 'mb-p3', 'mb-p4', 'mb-p5');
    s.classList.add('mb-p' + Math.min(rel + 1, 5));
  });
  slots.forEach((s, n) => { const g = s.querySelector('.mb-grab'); if (g) g.addEventListener('click', () => { front = n; layoutWeb(); }); });
  layoutWeb();
}
function crtNoSignal() {
  const screen = document.getElementById('crtScreen');
  const note = document.getElementById('crtNote');
  if (!screen || !note) return;
  if (!note.dataset.orig) note.dataset.orig = note.innerHTML;   // remember the credits line
  screen.classList.add('crt-nosig');
  note.classList.add('crt-foot-nosig');
  const label = (document.querySelectorAll('#crtMenu .crt-opt')[crtSel].querySelector('.crt-txt') || {}).textContent || '';
  note.textContent = '◈ ' + label + ' — NO SIGNAL · COMING SOON';
  if (crtNosigTimer) clearTimeout(crtNosigTimer);
  crtNosigTimer = setTimeout(() => {
    screen.classList.remove('crt-nosig');
    note.classList.remove('crt-foot-nosig');
    note.innerHTML = note.dataset.orig;
  }, 1600);
}
function initCrt() {
  const menu = document.getElementById('crtMenu');
  if (!menu) return;
  initCrtStage();
  const mkt = document.getElementById('marketing');
  // click a channel → tune it, then act (live → sign-up, soon → NO SIGNAL)
  menu.querySelectorAll('.crt-opt').forEach((opt, i) => {
    opt.addEventListener('click', () => { crtSel = i; paintCrt(); crtSelect(); });
  });
  // keyboard: ↑↓ tune (only while the landing is showing); Enter selects when the menu is focused
  const onKey = (e) => {
    if (!mkt || mkt.style.display === 'none') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); crtMove(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); crtMove(-1); }
    else if ((e.key === 'Enter' || e.key === ' ') && document.activeElement === menu) { e.preventDefault(); crtSelect(); }
  };
  document.addEventListener('keydown', onKey);
  // Landing chatbox: let the visitor type freely; only funnel into the sign-up
  // popup when they commit (Enter) or hit the send arrow — not on tap/focus.
  const landInput = document.getElementById('crtLandInput');
  const landSend = document.getElementById('crtLandSend');
  const landBox = document.getElementById('crtChatbox');
  const submitLand = () => {
    // Only the live channel (Video/Image/Voice) generates. On a coming-soon
    // channel the chatbox is inert — Enter does nothing.
    const sel = document.querySelectorAll('#crtMenu .crt-opt')[crtSel];
    if (sel && sel.dataset.live !== '1') return;
    // Carry the typed prompt into the studio — it survives login (consumed by
    // enterApp) and is cleared if the user backs out of the auth popup.
    const t = (landInput && landInput.value.trim()) || '';
    if (t) pendingFirstMsg = t;
    if (window.Auth && Auth.isSignedIn()) { enterApp(); return; }   // already in → straight to generating
    if (typeof openAuthFrom === 'function') openAuthFrom('start', 'app');  // sign in/up, then generate
  };
  // grow the box downward as text wraps (never sideways)
  const grow = () => { if (!landInput) return; landInput.style.height = 'auto'; landInput.style.height = landInput.scrollHeight + 'px'; };
  if (landInput) {
    landInput.addEventListener('input', grow);
    landInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitLand(); } });
  }
  // clicking anywhere in the box (padding, empty area) focuses the field
  if (landBox && landInput) landBox.addEventListener('click', (e) => { if (e.target !== landSend && !landSend.contains(e.target)) landInput.focus(); });
  if (landSend) landSend.addEventListener('click', submitLand);
  paintCrt();
}

// Marketing: cards with [data-reveal] drift up as they scroll into view.
// Stagger comes from the card's position within its own grid so each row
// cascades left-to-right; reduced-motion users get everything visible via CSS.
function initMktReveal() {
  const cards = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  if (!cards.length) return;
  if (!('IntersectionObserver' in window)) { cards.forEach((c) => c.classList.add('mkt-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const kin = Array.prototype.indexOf.call(el.parentElement.children, el);
      el.style.transitionDelay = (kin * 70) + 'ms';
      el.classList.add('mkt-in');
      io.unobserve(el);
    });
  }, { threshold: 0.2 });
  cards.forEach((c) => io.observe(c));
}

// Marketing: the lead hero. A chatbox + chips on the left; the right stage
// shows the picked kind's output — a vertical drifting filmstrip (same cells as
// the old strip) for video/image, the live website demos (cascade) for website,
// a placeholder for voice. Chips morph the stage, the headline word, and the
// prompt (which retypes). Website iframes lazy-load on first pick.
function initLeadHero() {
  const stage = document.getElementById('leadStage');
  if (!stage) return;
  const chips = Array.prototype.slice.call(document.querySelectorAll('.mkt-pick:not(.mkt-soon)'));
  const panels = Array.prototype.slice.call(stage.querySelectorAll('.lp-panel'));
  const phEl = document.getElementById('leadPh');
  const wordEl = document.getElementById('leadWord');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CATS = {
    media:   { word: 'create', panel: 'film',    ph: 'a neon tiger prowling a rainy Tokyo alley, cinematic' },
    voice:   { word: 'voice',  panel: 'voice',   ph: 'a warm, unhurried voiceover for a meditation app' },
    website: { word: 'build',  panel: 'website', ph: '' },
  };

  // build the vertical filmstrip — two columns (reuse .mkt-cell/.mkt-cN + /mkt/f*.jpg)
  const cell = (n) => '<div class="mkt-cell mkt-c' + n + '"><span class="mkt-cell-img" style="background-image:url(/mkt/f' + n + '.jpg)"></span></div>';
  const col = (arr) => { const one = arr.map(cell).join(''); return one + one; }; // doubled for a seamless -50% loop
  const cols = Array.prototype.slice.call(stage.querySelectorAll('.lp-col'));
  if (cols[0]) cols[0].innerHTML = col([1, 3, 5, 7, 9, 11, 13]);
  if (cols[1]) cols[1].innerHTML = col([2, 4, 6, 8, 10, 12, 14]);
  const wave = stage.querySelector('.lp-wave');
  if (wave) { let s = ''; for (let i = 0; i < 13; i++) s += '<i style="animation-delay:' + (i * 0.08) + 's"></i>'; wave.innerHTML = s; }

  // chatbox typewriter
  let typeT = null;
  const type = (text) => {
    if (typeT) { clearTimeout(typeT); typeT = null; }
    if (!text) { phEl.textContent = ''; return; }
    if (reduce) { phEl.textContent = text; return; }
    let k = 0;
    const step = () => { phEl.textContent = text.slice(0, ++k); if (k < text.length) typeT = setTimeout(step, 18 + Math.random() * 22); };
    phEl.textContent = ''; step();
  };

  // website cascade (front card interactive; clicking a back card brings it forward)
  const cascade = document.getElementById('mbCascade');
  const slots = cascade ? Array.prototype.slice.call(cascade.querySelectorAll('.mb-slot')) : [];
  const N = slots.length;
  let front = 0;
  const layoutWeb = () => {
    slots.forEach((s, n) => { const rel = (n - front + N) % N;
      s.classList.remove('mb-p1', 'mb-p2', 'mb-p3', 'mb-p4', 'mb-p5');
      s.classList.add('mb-p' + Math.min(rel + 1, 5)); });
    const prompt = slots[front] && slots[front].getAttribute('data-prompt');
    if (prompt) type(prompt);
  };
  slots.forEach((s, n) => { const g = s.querySelector('.mb-grab'); if (g) g.addEventListener('click', () => { front = n; layoutWeb(); }); });

  const setCat = (cat) => {
    const cfg = CATS[cat]; if (!cfg) return;
    chips.forEach((ch) => ch.classList.toggle('mkt-on', ch.dataset.cat === cat));
    if (wordEl) wordEl.textContent = cfg.word;
    panels.forEach((p) => p.classList.toggle('mkt-on', p.dataset.panel === cfg.panel));
    if (cat === 'website') layoutWeb();
    else type(cfg.ph);
  };
  chips.forEach((ch) => ch.addEventListener('click', () => setCat(ch.dataset.cat)));
  setCat('media');
}

// ── Gallery view: every generation across all (synced) chats ──
let galFilter = 'all';   // all | video | image | audio
let galSort = 'new';     // new | old

// A permanent, gallery-saved URL lives in Supabase Storage. Temp links (fal)
// and client-burned free-tier copies (data: URLs) are NOT saved, so they must
// never appear in the gallery — free tier can't save, period.
function isSavedMedia(url) {
  return typeof url === 'string' && typeof SUPABASE_URL === 'string' &&
    url.startsWith(SUPABASE_URL + '/storage/');
}
// The authoritative list of saved objects in the caller's storage, fetched
// from /api/gallery on gallery open. Existence is driven by storage (so a save
// survives deleting its chat); chat messages only supply prompt/poster overlay.
let serverGallery = null; // [{ url, kind, size, at }] or null before first load

async function loadServerGallery() {
  try {
    const r = await apiFetch('/api/gallery');
    if (r && r.ok) {
      const j = await r.json();
      if (j && Array.isArray(j.items)) serverGallery = j.items;
    }
  } catch {}
}

function galleryItems() {
  const seen = new Set();
  const out = [];
  let seq = 0;
  // Chat-message metadata by URL — the prompt/poster/chatId overlay for a
  // stored file, when the originating chat still exists.
  const meta = new Map();
  chatStore.chats.forEach((c) => (c.msgs || []).forEach((m) => {
    if (m.t === 'media' && isSavedMedia(m.url) && !meta.has(m.url)) {
      meta.set(m.url, { chatId: c.id, kind: m.kind, prompt: m.prompt, poster: m.poster, at: m.at || 0 });
    }
  }));
  // Storage is authoritative for what exists. Merge in the chat overlay; a file
  // whose chat was deleted still shows (with no prompt), which is the whole fix.
  if (Array.isArray(serverGallery)) {
    serverGallery.forEach((o) => {
      if (!isSavedMedia(o.url) || seen.has(o.url)) return;
      seen.add(o.url);
      const md = meta.get(o.url) || {};
      out.push({ chatId: md.chatId, kind: o.kind || md.kind || 'video', url: o.url, prompt: md.prompt, poster: md.poster, at: o.at || md.at || 0, seq: seq++ });
    });
  }
  // Before the server list has loaded (or if it failed), fall back to the chat-
  // derived view so the gallery is never blank when we do have local records.
  if (!Array.isArray(serverGallery)) {
    meta.forEach((md, url) => {
      if (seen.has(url)) return;
      seen.add(url);
      out.push({ chatId: md.chatId, kind: md.kind || 'video', url, prompt: md.prompt, poster: md.poster, at: md.at || 0, seq: seq++ });
    });
  }
  const filtered = galFilter === 'all' ? out : out.filter((i) => i.kind === galFilter);
  // Old media has no timestamp — insertion order stands in for age.
  filtered.sort((a, b) => (a.at - b.at) || (a.seq - b.seq));
  if (galSort === 'new') filtered.reverse();
  return filtered;
}

function setGalFilter(f) {
  galFilter = f;
  document.querySelectorAll('.g-chip').forEach((c) => c.classList.toggle('active', c.dataset.f === f));
  renderGallery();
}

function toggleGalSort() {
  galSort = galSort === 'new' ? 'old' : 'new';
  const b = document.getElementById('gallerySort');
  if (b) b.textContent = galSort === 'new' ? 'Newest first ▾' : 'Oldest first ▴';
  renderGallery();
}

// Last-known storage status for the usage bar: { used, cap, tier } in bytes.
// cap 0 = no gallery storage (free/lapsed/top-up-only — saving is a paid perk).
let galStorage = null;

function fmtStorageBytes(n) {
  n = Number(n) || 0;
  const gb = n / 1073741824;
  if (gb >= 1) return gb.toFixed(gb >= 10 ? 0 : 1) + ' GB';
  const mb = n / 1048576;
  if (mb >= 1) return mb.toFixed(mb >= 10 ? 0 : 1) + ' MB';
  const kb = n / 1024;
  if (kb >= 1) return Math.round(kb) + ' KB';
  return n + ' B';
}

// Pull fresh usage from the worker, then repaint. Called on gallery open and
// after a delete; filter/sort clicks repaint from the cached value instead.
async function refreshStorageBar() {
  try {
    const r = await apiFetch('/api/storage');
    if (r && r.ok) galStorage = await r.json();
  } catch {}
  updatePlanTag(); // tier just resolved → let the badge show Plus/Pro/Max
  paintStorageBar();
}

function paintStorageBar() {
  const el = document.getElementById('galleryStorage');
  if (!el) return;
  const s = galStorage;
  if (!s) { el.style.display = 'none'; return; }
  el.style.display = '';
  if (!s.cap) { // free / lapsed / top-up-only: gallery storage is a subscription benefit
    el.innerHTML =
      '<div class="gs-note">Saving to your gallery is a <b>paid feature</b>. ' +
      '<button class="gs-cta" data-act="gal-upgrade">Upgrade to keep your creations →</button></div>';
    wireActions(el);
    return;
  }
  const pct = s.cap ? Math.min(100, Math.round((s.used / s.cap) * 100)) : 0;
  const cls = pct >= 100 ? 'full' : pct >= 85 ? 'warn' : '';
  const tier = (s.tier || '').charAt(0).toUpperCase() + (s.tier || '').slice(1);
  el.innerHTML =
    '<div class="gs-row">' +
      '<span class="gs-label">Storage' + (tier ? '<span class="gs-tier">' + tier + '</span>' : '') + '</span>' +
      '<span class="gs-usage">' + fmtStorageBytes(s.used) + ' / ' + fmtStorageBytes(s.cap) + '</span>' +
    '</div>' +
    '<div class="gs-track"><div class="gs-fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
    (pct >= 100
      ? '<div class="gs-note">Your gallery is full — free up space or <button class="gs-cta" data-act="gal-upgrade">move up a tier →</button></div>'
      : '');
  wireActions(el);
}

// Fetch the authoritative storage list, then repaint — called on gallery open
// so a saved file shows even when its chat is gone (or on a fresh device).
async function refreshGallery() {
  await loadServerGallery();
  renderGallery();
}

function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  paintStorageBar();
  const items = galleryItems();
  const sub = document.getElementById('gallerySub');
  if (sub) sub.textContent = items.length ? items.length + (items.length === 1 ? ' creation' : ' creations') : '';
  const empty = document.getElementById('galleryEmpty');
  if (empty) {
    empty.style.display = items.length ? 'none' : '';
    empty.textContent = galFilter === 'all'
      ? 'Nothing here yet — everything you generate lands in your gallery.'
      : 'No ' + (galFilter === 'audio' ? 'audio' : galFilter + 's') + ' yet.';
  }
  grid.innerHTML = '';
  items.forEach((it) => {
    const d = document.createElement('div');
    d.className = 'g-item';
    let media;
    if (it.kind === 'image') {
      media = document.createElement('img');
      media.src = it.url; media.loading = 'lazy'; media.alt = '';
      media.onclick = () => openLightbox('image', it.url);
    } else if (it.kind === 'audio') {
      media = document.createElement('div');
      media.className = 'g-audio';
      media.innerHTML = '<span class="note">♪</span>';
      const au = document.createElement('audio');
      au.controls = true; au.preload = 'none'; au.src = it.url;
      media.appendChild(au);
    } else {
      media = document.createElement('video');
      media.src = it.url; media.preload = 'metadata'; media.muted = true;
      if (it.poster) media.poster = it.poster;
      media.onmouseenter = () => { media.play().catch(() => {}); };
      media.onmouseleave = () => { media.pause(); media.currentTime = 0; };
      media.onclick = () => openLightbox('video', it.url);
      // Free accounts: same on-screen mark as the chat player.
      d.classList.add('wm-spot');
      if (paidKnown && !isPaid) d.appendChild(wmBadge());
    }
    d.appendChild(media);
    if (it.prompt) {
      const p = document.createElement('div');
      p.className = 'g-prompt'; p.textContent = it.prompt;
      d.appendChild(p);
    }
    const actions = document.createElement('div');
    actions.className = 'g-actions';
    const dl = document.createElement('a');
    dl.className = 'g-btn'; dl.textContent = '⤓'; dl.title = 'Download';
    dl.setAttribute('aria-label', 'Download');
    // Only ever link to a real media URL — never let a stored value smuggle a
    // javascript: URL into an anchor (self-XSS on click).
    dl.href = /^(https?:|blob:|data:)/i.test(it.url || '') ? it.url : '#';
    dl.download = ''; dl.target = '_blank'; dl.rel = 'noopener';
    const del = document.createElement('button');
    del.className = 'g-btn'; del.textContent = '🗑'; del.title = 'Delete';
    del.setAttribute('aria-label', 'Delete');
    del.onclick = () => galleryDelete(it, d);
    actions.appendChild(dl); actions.appendChild(del);
    d.appendChild(actions);
    grid.appendChild(d);
  });
}

async function galleryDelete(it, el) {
  if (!confirm('Delete this from your gallery and its chat?')) return;
  el.remove();
  const chat = chatStore.chats.find((c) => c.id === it.chatId);
  if (chat) {
    const i = chat.msgs.findIndex((m) => m.t === 'media' && m.url === it.url);
    if (i >= 0) { chat.msgs.splice(i, 1); persistStore(); touchSync(chat.id); }
    // The deleted item's chat may be open behind the gallery — repaint it now
    // so returning to the thread never shows a stale/blank media message.
    if (chatStore.active === chat.id) renderThread();
  }
  const m = it.url.match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
  if (m && window.Auth) { try { await Auth.storageDelete(m[1]); } catch {} }
  // Drop it from the authoritative storage list too, so the card doesn't
  // reappear on the next repaint before /api/gallery is re-fetched.
  if (Array.isArray(serverGallery)) serverGallery = serverGallery.filter((o) => o.url !== it.url);
  renderGallery();
  refreshStorageBar(); // freed space → refresh the usage bar
}

// ── Workspace views (Home / Projects / Gallery / Studio) ──
// Navigation is a dropdown in the topbar; the left sidebar (chat history) shows
// on Home only, so every other view gets the full width.
const VIEW_LABELS = { landing: 'Home', home: 'Builder', gallery: 'Gallery', products: 'Products', avatar: 'Avatar', mediaAgent: 'Media Agent', integrations: 'Integrations', settings: 'Settings' };
function showView(name) {
  // The old Home landing is gone — the Builder chatbox is now home. Any lingering
  // request to open 'landing' is redirected there.
  if (name === 'landing') name = 'home';
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const el = document.getElementById('view' + name.charAt(0).toUpperCase() + name.slice(1));
  if (el) el.classList.add('active');
  // The jump-to-latest chevron belongs to the Home thread only.
  const sd = document.getElementById('scrollDown');
  if (sd && name !== 'home') sd.classList.remove('show');
  if (name === 'gallery') { renderGallery(); refreshGallery(); refreshStorageBar(); }
  if (name === 'products') renderProducts();
  if (name === 'avatar') renderAvatar();
  if (name === 'mediaAgent') renderMediaAgent();
  if (name === 'integrations') renderIntegrations();
  if (name === 'settings') renderSettings();
  document.querySelectorAll('.side-item[data-view], .top-tab[data-view]').forEach((i) =>
    i.classList.toggle('active', i.dataset.view === name));
  // Back-to-Builder arrow: only while a section view (not home) is open.
  const back = document.getElementById('topBack');
  if (back) back.classList.toggle('show', name !== 'home');
  // Chat history is Home-only.
  const chats = document.getElementById('homeChats');
  if (chats) chats.style.display = name === 'home' ? '' : 'none';
}
document.addEventListener('click', (e) => {
  const prof = document.getElementById('signOutRow');
  const pop = document.getElementById('profilePop');
  if (pop && pop.classList.contains('open') && prof && !prof.contains(e.target)) pop.classList.remove('open');
});

// Top-right account menu.
function toggleProfileMenu(e) {
  e.stopPropagation();
  const pop = document.getElementById('profilePop');
  if (pop) pop.classList.toggle('open');
}

// Collapsible chats sidebar — collapses to a slim rail; persists per browser.
const SIDE_KEY = 'zephyr_side_v1';
function toggleSidebar() {
  const sb = document.getElementById('sideBar');
  if (!sb) return;
  const collapsed = sb.classList.toggle('collapsed');
  const btn = document.getElementById('sideCollapse');
  if (btn) { btn.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar'; btn.setAttribute('aria-label', btn.title); }
  try { localStorage.setItem(SIDE_KEY, collapsed ? 'collapsed' : 'open'); } catch {}
}
// Apply the saved state at boot (before first paint matters little — the rail
// transition is suppressed by applying it immediately at script init).
(() => {
  try {
    if (localStorage.getItem(SIDE_KEY) === 'collapsed') {
      const sb = document.getElementById('sideBar');
      if (sb) sb.classList.add('collapsed');
      const btn = document.getElementById('sideCollapse');
      if (btn) { btn.title = 'Expand sidebar'; btn.setAttribute('aria-label', 'Expand sidebar'); }
    }
  } catch {}
})();

// ── Declarative event wiring (CSP-safe) ───────────────────────────────────
// The HTML carries data-act / data-change / data-input / data-keydown hooks
// instead of inline on* handlers, so the CSP can drop script-src 'unsafe-inline'.
// Listeners are attached directly to each element (not document-delegated) to
// preserve the stopPropagation() semantics the menu toggles rely on.
const CLICK_ACTIONS = {
  'view': (e, el) => {
    // From the logged-in landing, a profile-menu view (Integrations/Settings)
    // enters the studio first so the view is actually visible.
    const mkt = document.getElementById('marketing');
    if (mkt && mkt.style.display !== 'none' && window.Auth && Auth.isSignedIn()) enterApp();
    showView(el.dataset.view);
  },
  'new-chat': () => newChat(),
  'side-toggle': () => toggleSidebar(),
  'credits': () => openCredits(),
  'credits-topup': () => openCredits(true),
  'profile-menu': (e) => toggleProfileMenu(e),
  'sign-out': () => doSignOut(),
  'effort-menu': (e) => toggleEffortMenu(e),
  'set-effort': (e, el) => setEffort(el.dataset.effort),
  'ap-row': (e, el) => toggleApRow(el.dataset.row),
  'img-src': (e, el) => openImgSrc(el.dataset.src, e),
  'img-pick': (e, el) => imgSrcPick(el.dataset.pick, e),
  'mask-edit': () => openMaskEditor(),
  'mask-clear': (e) => { e.stopPropagation(); clearMask(); },
  'file': (e, el) => { const f = document.getElementById(el.dataset.file); if (f) f.click(); },
  'dir-menu': (e) => toggleDirMenu(e),
  'orch-toggle': () => toggleOrchestrator(),
  'set-mode': (e, el) => setMode(el.dataset.mode),
  'model-menu': (e) => toggleModelMenu(e),
  'opt-settings': (e) => toggleOpt(e, 'settings'),
  'send': () => send(true),
  'gal-filter': (e, el) => setGalFilter(el.dataset.f),
  'gal-sort': () => toggleGalSort(),
  'gal-upgrade': () => openCredits(),
  'scroll-down': () => { const box = document.getElementById('messages'); if (box) scrollThreadBottom(box.parentElement, true); },
};
const CHANGE_ACTIONS = {
  'attach': (e, el) => onAttach(el.dataset.attach, el),
  'attach-extra': (e, el) => onAttachExtra(el),
  'attach-ref': (e, el) => onAttachRef(el),
  'attach-el': (e, el) => onAttachEl(el),
  'attach-kf': (e, el) => onAttachKf(el),
};
const INPUT_ACTIONS = {
  'search': () => renderChatList(),
  'autogrow': (e, el) => { autoGrow(el); refreshSendEnabled(); },
};
const KEYDOWN_ACTIONS = {
  'send': (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } },
  'credits-topup': (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCredits(true); } },
};
function wireActions(root) {
  const scope = root || document;
  const bind = (attr, evt, table) => scope.querySelectorAll('[' + attr + ']').forEach((el) => {
    const flag = '_w_' + evt;
    if (el[flag]) return; el[flag] = true;
    const fn = table[el.getAttribute(attr)];
    if (fn) el.addEventListener(evt, (e) => fn(e, el));
  });
  bind('data-act', 'click', CLICK_ACTIONS);
  bind('data-change', 'change', CHANGE_ACTIONS);
  bind('data-input', 'input', INPUT_ACTIONS);
  bind('data-keydown', 'keydown', KEYDOWN_ACTIONS);
}

// Keyboard navigation for the dropdown menus (model / effort / settings / dir /
// image-source), which are otherwise click-only: ↑/↓ move between items,
// Enter/Space picks the focused one, Esc closes.
document.addEventListener('keydown', (e) => {
  if (!['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Escape'].includes(e.key)) return;
  const menu = document.querySelector('.model-menu.open');
  if (!menu) return;
  if (e.key === 'Escape') { menu.classList.remove('open'); return; }
  const items = [...menu.querySelectorAll('.model-item')].filter((el) => el.getClientRects().length);
  if (!items.length) return;
  items.forEach((el) => { el.setAttribute('role', 'menuitem'); if (!el.hasAttribute('tabindex')) el.tabIndex = -1; });
  const idx = items.indexOf(document.activeElement);
  if (e.key === 'Enter' || e.key === ' ') { if (idx >= 0) { e.preventDefault(); items[idx].click(); } return; }
  e.preventDefault();
  items[e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx <= 0 ? items.length - 1 : idx - 1)].focus();
});

// Init
wireActions();
buildMenu();
buildOptMenus();
renderAttach('audio');
loadStore();
loadMemory();
renderChatList();
renderThread();
// Refresh-proof composer: restore the active chat's saved setup (mode/model/
// effort/orchestrator/settings) instead of booting back to defaults.
applyComposerState((activeChat() || {}).comp);

// Hero ambience stays static (no cursor drift) — the greeting screen holds still.

initAuthGate();

const params = new URLSearchParams(location.search);
const firstMsg = params.get('q');
if (firstMsg) {
  window.history.replaceState({}, '', location.pathname);
  // If already signed in, run it now; otherwise hold it so enterApp picks it up
  // once the visitor authenticates, instead of losing the prompt at the gate.
  if (window.Auth && Auth.isSignedIn()) startDirector(firstMsg);
  else pendingFirstMsg = firstMsg;
}
// Back from Stripe: the webhook mints the credits — poll the balance so the
// chip catches up even if the webhook lands a few seconds after we do.
if (params.get('credits') === 'added') {
  window.history.replaceState({}, '', location.pathname);
  if (window.Auth && Auth.isSignedIn()) {
    addMsg('agent', '✦ Payment received — your credits are landing now.');
    setTimeout(fetchCredits, 2500);
    setTimeout(fetchCredits, 8000);
  }
}
