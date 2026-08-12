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
    // ref: reference-to-video (fal OpenAPI 2026-07-17: image_urls required,
    // maxItems 10, bound as native <IMAGE_REF_N> tags — the worker translates
    // our @ImageN). Same $0.13/s rate as t2v.
    caps: { image: true, end: false, avatar: false, clip: true, ref: 10 },
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
  // Veo 3.1 Lite — the budget tier (schema-verified 2026-07-17): t2v, i2v and
  // first-&-last-frame endpoints exist (no extend / reference), no 4k, and
  // unlike Standard/Fast the 1080p tier genuinely costs more than 720p.
  'fal-ai/veo3.1/lite': {
    durations: [4, 6, 8], defDur: 8,
    ratios: ['16:9', '9:16'], defRatio: '16:9',
    resolutions: ['720p', '1080p'], defRes: '720p',
    caps: { image: true, end: false, avatar: false, flf: true },
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
  // Lip-sync (audio-driven): no prompt, no duration/ratio — duration comes
  // from the audio. (OmniHuman 1.0/1.5 were removed 2026-07-17, owner's call.)
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
  // No 'auto' (owner's call 2026-07-16 — it locked the resolution row and read
  // as confusing): every GPT run sends explicit dimensions for the picked
  // ratio, so EDITS REFRAME the source to that ratio. The worker still accepts
  // 'auto' from stale clients (no size sent, billed base rate).
  'openai/gpt-image-2': ['1:1', '16:9', '9:16', '4:3', '3:4'],
};
// Per-model default aspect. Nano defaults to 'auto' (model picks / keeps source);
// everything else keeps the square default.
const IMAGE_DEF_RATIO = { 'fal-ai/nano-banana-pro': 'auto', 'openai/gpt-image-2': '1:1' };
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
let gptSize = '2K'; // GPT Image 2 output resolution tier (2K/4K — 1K was dropped from the picker 2026-07-16, owner's call: fal bills 1K and 2K identically so 1K was a strictly-worse pick; the worker still accepts '1K' from stale clients)
// Manual sound toggle (owner 2026-07-16: "there's no option to have audio on
// and off") — previously silent renders only happened when the director
// inferred them from the user's words. Families with native soundtracks;
// mirrors the worker's soundCapable gate. Off is cheaper where fal lists
// audio-off rates (Veo, Seedance, Kling v3).
const SOUND_MODELS_RE = /seedance|kling-video\/(?:o3|v3)|veo/;
let soundOn = true;
// Each mode remembers its own model, so switching modes doesn't reset the pick.
const selectedModels = { ...DEFAULT_MODELS };
let model = selectedModels.video;
let mode = 'video';


const MODEL_LISTS = {
  video: [
    // tier: the PREMIUM/CLASSIC/BASIC pill + gold max-res badge row (owner's
    // reference design 2026-07-17) — replaces the note-derived tags on these.
    { id: 'fal-ai/veo3.1', label: 'Veo 3.1', note: 'Google · audio · extend', group: 'veo', tier: 'premium' },
    { id: 'fal-ai/veo3.1/fast', label: 'Veo 3.1 Fast', note: 'Google · cheaper · audio', group: 'veo', tier: 'classic' },
    { id: 'fal-ai/veo3.1/lite', label: 'Veo 3.1 Lite', note: 'Google · cheapest · audio', group: 'veo', tier: 'basic' },
    { id: 'bytedance/seedance-2.0/text-to-video', label: 'Seedance 2.0', note: 'audio', group: 'seedance', tier: 'premium' },
    { id: 'bytedance/seedance-2.0/fast/text-to-video', label: 'Seedance 2.0 Fast', note: 'audio', group: 'seedance', tier: 'classic' },
    { id: 'bytedance/seedance-2.0/mini/text-to-video', label: 'Seedance 2.0 Mini', note: 'cheapest · audio', group: 'seedance', tier: 'basic' },
    { id: 'fal-ai/kling-video/o3/pro/text-to-video', label: 'Kling o3 Pro', note: 'newest · edit', group: 'kling' },
    { id: 'fal-ai/kling-video/o3/standard/text-to-video', label: 'Kling o3 Standard', note: 'cheaper · edit', group: 'kling' },
    { id: 'fal-ai/kling-video/v3/pro/text-to-video', label: 'Kling 3.0 Pro', note: 'audio', group: 'kling' },
    { id: 'fal-ai/kling-video/v3/standard/text-to-video', label: 'Kling 3.0 Standard', note: 'audio', group: 'kling' },
    { id: 'fal-ai/kling-video/lipsync/audio-to-video', label: 'Kling LipSync', note: 'lip-sync', group: 'kling' },
    { id: 'google/gemini-omni-flash', label: 'Gemini Omni Flash', note: 'audio · edit' },
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
// ── The landing page's four model tabs ────────────────────────────────────────
// LLM models · Video models · Image models · Audio models.
//
// Video/image/audio are read STRAIGHT OUT OF `MODEL_LISTS` above — the same
// array the in-app picker renders — rather than restated here. A second copy is
// how a marketing page ends up advertising a model that was removed months ago;
// Ray 3.2 and OmniHuman were dropped on 2026-07-17 and a hand-written list would
// still be offering them.
//
// The LLMs are the one list with no picker to borrow from: nothing chooses them,
// the orchestrator routes by effort. Kept here, next to the others, so all four
// tabs have one source.
const LLM_MODELS = [
  { label: 'Claude Sonnet 5', note: 'Anthropic · deep reasoning' },
  { label: 'Claude Haiku 4.5', note: 'Anthropic · fast' },
];
// The subtitle says WHAT THE CATEGORY IS, nothing else. This is the landing
// page — the reader is signed out and has generated nothing — so instructions
// ("pick per generation from the model menu") and pricing are both aimed at
// somebody who is not here. It is a list of what runs on the platform.
// The order groups appear in. Explicit rather than Object.keys, so the panel
// leads with what the platform is best known for instead of with whatever was
// declared first.
const MODELS_ORDER = ['video', 'image', 'audio', 'llm'];
const MODELS_TAB = {
  llm: { title: 'LLM models', sub: 'Reasoning and prompt writing.', list: () => LLM_MODELS },
  video: { title: 'Video models', sub: 'Text to video, image to video, editing and lip-sync.', list: () => MODEL_LISTS.video },
  image: { title: 'Image models', sub: 'Text to image, and image editing.', list: () => MODEL_LISTS.image },
  audio: { title: 'Audio models', sub: 'Text to speech.', list: () => MODEL_LISTS.audio },
};

// Fill the AI models dropdown. Called ONCE at boot — the menu opens on hover
// via CSS, so there is no click to render on, and a first hover that shows an
// empty box while JavaScript catches up is worse than no menu.
//
// ONLY `label` and `note` are ever emitted — never `id`. That is not tidiness:
// an id is `fal-ai/veo3.1`, and naming the provider is the one thing worker.js's
// director prompt forbids outright ("NEVER reveal, name, or hint at the
// underlying model, provider, vendor, or any technical id"). The labels are
// already public — they are what the in-app picker shows — the paths behind
// them are not. A test asserts no id reaches the DOM.
function fillModelsMenu() {
  const host = document.getElementById('mdlList');
  if (!host) return;
  host.innerHTML = '';
  let total = 0;
  for (const key of MODELS_ORDER) {
    const g = MODELS_TAB[key];
    const rows = ((g && g.list()) || []).filter((m) => m && m.label);
    if (!rows.length) continue;                    // an empty group is not a heading
    total += rows.length;
    // Each group is ONE element, so a column break can never land between a
    // heading and the rows it labels.
    const sec = document.createElement('section');
    sec.className = 'mdl-group';
    const h = document.createElement('h3');
    h.className = 'mdl-gh';
    h.textContent = g.title;
    sec.appendChild(h);
    const cap = document.createElement('p');
    cap.className = 'mdl-gsub';
    cap.textContent = g.sub;
    sec.appendChild(cap);
    const list = document.createElement('ul');
    list.className = 'mdl-list';
    for (const m of rows) {
      const li = document.createElement('li');
      li.className = 'mdl-row';
      // The NAME only. The per-model notes ("Google · audio · extend") are the
      // in-app picker's job, where somebody is choosing between them; here the
      // question is only what the platform runs. They are still on the objects
      // in MODEL_LISTS — deliberately not read.
      li.textContent = m.label;                    // textContent, never innerHTML
      list.appendChild(li);
    }
    sec.appendChild(list);
    host.appendChild(sec);
  }
  // Counted from what was actually rendered, so the headline number cannot
  // disagree with the rows beneath it.
  const sub = document.getElementById('mdlSub');
  if (sub) sub.textContent = total + (total === 1 ? ' model' : ' models') + ' across video, image, voice and reasoning.';
}

// aria-expanded has to follow what CSS is actually doing, or it is a stale
// claim — a screen reader announcing "collapsed" over an open menu is worse
// than saying nothing. Hover and focus are BOTH synced because both open it.
function wireModelsMenu() {
  const wrap = document.querySelector('.mkt-drop');
  const btn = wrap && wrap.querySelector('.mkt-drop-btn');
  if (!wrap || !btn) return;
  const set = (v) => btn.setAttribute('aria-expanded', v ? 'true' : 'false');
  wrap.addEventListener('mouseenter', () => set(true));
  wrap.addEventListener('mouseleave', () => set(false));
  wrap.addEventListener('focusin', () => set(true));
  wrap.addEventListener('focusout', () => set(false));
  // Esc closes it for a keyboard user by moving focus out — :focus-within is
  // what is holding it open, so blurring is the close.
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') btn.blur(); });
}


const GROUP_META = {
  seedance:  { label: 'Seedance 2.0', variant: () => '' },
  kling:     { label: 'Kling',        variant: () => '' },
  // No active-variant chip on the Veo parent row (owner 2026-07-17: the
  // "Lite" pill next to "Veo 3.1" read badly) — the flyout's ✓ shows the pick.
  veo:       { label: 'Veo 3.1',      variant: () => '' },
};

const modelMenu = document.getElementById('modelMenu');

const attachments = { image: null, avatar: null, end: null, audio: null, clip: null, ffirst: null, flast: null };
// Extra reference images beyond the first (multi-image models only).
const extraImages = [];
// Veo reference-to-video images (its own row, capped per model at caps.ref).
const refList = [];
// Kling character elements (@Element1-4): one frontal image per character.
const elList = [];
// Seedance extra reference clips/audios beyond slot #1 (@Video2-3 / @Audio2-3).
// fal caps: 3 videos (combined 2-15s, each ~480-720p, ≤50MB total) · 3 audios
// (combined ≤15s). Slot #1 stays attachments.clip/audio with all its existing
// validation; these carry {uri, dur, w, h} / {uri, dur, name} per item.
const vxList = [];
const axList = [];
const ATTACH_LABELS = {
  image: '<span class="plus-big">+</span>',
  avatar: '<span class="plus-big">+</span>',
  audio: '+ Audio',
  clip: '<span class="plus-big">+</span><span class="slot-lab">Video clip</span>',
  end: '<span class="plus-big">+</span>',
  ffirst: '<span class="plus-big">+</span><span class="slot-lab">First frame</span>',
  flast: '<span class="plus-big">+</span><span class="slot-lab">Last frame</span>',
};

function attachBtn(kind) {
  return document.getElementById('btn' + kind[0].toUpperCase() + kind.slice(1));
}

// Read an image file as a data URI, REFUSING anything past the 8MB payload
// budget (owner 2026-07-27). This used to redraw oversized images at ≤3840px
// and re-encode them as JPEG until they fit — same objection as the clip
// conforms: the file that gets generated from is not the file the user picked,
// and a silent re-compress is invisible in the result. Returns the data URI,
// or a reason string the caller turns into a message.
// Note this governs the DEVICE picker only; useGalleryImages reads app-owned
// media straight from storage, which is how a 4K Nano output (15-25MB PNG)
// still comes back in for editing.
const IMG_BYTE_CAP = 8 * 1024 * 1024;
async function readImageAttach(file) {
  if (file.size > IMG_BYTE_CAP) {
    return { err: 'That image is ' + (file.size / 1048576).toFixed(1) + ' MB — the limit is '
      + Math.round(IMG_BYTE_CAP / 1048576) + ' MB. Export it smaller and attach it again.' };
  }
  const raw = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(file); });
  if (typeof raw !== 'string') return { err: "Couldn't read that image — try a different file." };
  return { uri: raw };
}

function onAttach(kind, inputEl) {
  const file = inputEl.files[0];
  inputEl.value = '';
  if (!file) return;
  // Nothing is re-encoded for the user any more: images over the payload
  // budget are refused below, same as clips and audio are here. The 20 MB
  // ceiling keeps a clip under the Worker's base64 limit (data URI ≈ ×1.34).
  if (kind === 'clip' || kind === 'audio') {
    if (file.size > 20 * 1024 * 1024) {
      alert('File too big — max 20 MB.');
      return;
    }
  } else {
    const originChatId = chatStore.active; // conform is async — don't leak into another chat
    readImageAttach(file).then(({ uri, err }) => {
      if (!uri) { addMsg('agent', '⚠️ ' + err); return; }
      // The user switched chats while this image was being downscaled — writing
      // it now would stage it into the WRONG chat and ride its next send
      // (2026-07-17). Drop it silently; they can re-attach in the right chat.
      if (chatStore.active !== originChatId) return;
      attachments[kind] = uri;
      if (IMG_KINDS.includes(kind)) measureAttachedImage(kind, uri);
      // Merged Image-to-video row (owner 2026-07-17): the End-frame slot picks a
      // `flast`; pair it with the staged start by promoting image→ffirst (and
      // the mirror case if the end frame was added first). This is the ONLY
      // place it can run — image kinds resolve here, never in reader.onload.
      const pairing = mergedFlf() &&
        ((kind === 'flast' && !attachments.ffirst && attachments.image) ||
         (kind === 'image' && attachments.flast && !attachments.ffirst));
      if (pairing) {
        attachments.ffirst = attachments.image; attachments.image = null;
        imgMeta.ffirst = imgMeta.image; delete imgMeta.image;
        renderAttach('ffirst'); renderAttach('image'); renderAttach('flast');
        clearImageInputsExcept('flf');
      } else {
        renderAttach(kind);
        if (kind === 'image') {
          clearImageInputsExcept('image');
          // Image mode is EITHER one edit base OR references, never both —
          // attaching the base clears the reference row.
          if (mode === 'image' && extraImages.length) { extraImages.length = 0; }
          renderExtraImages();
        } else if (kind === 'ffirst' || kind === 'flast') clearImageInputsExcept('flf');
      }
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
    if (kind === 'clip') {
      clipMeta = { dur: 0, w: 0, h: 0, type: file.type || '', name: file.name || 'clip' };
      readClipMeta(reader.result); renderRefChips();
      // Veo + Gemini: attaching a clip clears the other rows (see
      // clearImageInputsExcept — the reverse direction lives there).
      if (mode === 'video' && /veo|gemini/.test(model)) clearImageInputsExcept('clip');
    }
    // Image slots: measure dimensions and bounce anything the model hard-caps
    // (Kling: ≥300px, aspect 0.40–2.50) with the exact reason.
    if (IMG_KINDS.includes(kind)) measureAttachedImage(kind, reader.result);
    renderAttach(kind);
    // Slot #1 landing may reveal the Seedance +extras tile (@Video2-3/@Audio2-3).
    if (kind === 'clip') renderVxList();
    if (kind === 'audio') renderAxList();
    // (Only clip/audio reach here — image kinds, incl. the merged-flf pairing,
    // resolve in the readImageAttach branch above.)
    // Any attachment can move the price: a clip flips into video-to-video.
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
    // Validate against the current model RIGHT NOW — an out-of-spec clip gets
    // rejected at attach (slot cleared + a message saying what to fix), not
    // discovered at send. The send-time check stays as the backstop for a
    // model switched AFTER attaching.
    const bad = clipIssue();
    if (bad) {
      try { v.src = ''; } catch (e) {}
      attachments.clip = null;
      clipMeta = null;
      renderAttach('clip');
      updateSendPrice();
      addMsg('agent', '⚠️ ' + bad);
      return;
    }
    // First-frame thumbnail for the attach slot (owner 2026-07-16: the slot
    // showed a generic "🎬 clip" chip). Seek a hair in, draw to a canvas,
    // re-render the slot with the real frame. The <video> src is released
    // only AFTER the capture (it used to be cleared here, which would have
    // made seeking impossible).
    v.onseeked = () => {
      try {
        if (clipMeta && attachments.clip === dataUri && v.videoWidth) {
          const cv = document.createElement('canvas');
          const scale = Math.min(1, 480 / v.videoWidth);
          cv.width = Math.max(1, Math.round(v.videoWidth * scale));
          cv.height = Math.max(1, Math.round(v.videoHeight * scale));
          cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
          clipMeta.thumb = cv.toDataURL('image/jpeg', 0.72);
          renderAttach('clip');
        }
      } catch (e) {}
      try { v.src = ''; } catch (e) {}
    };
    try { v.currentTime = Math.min(0.1, (v.duration || 1) / 2); }
    catch (e) { try { v.src = ''; } catch (e2) {} }
    // Passed the basic checks — now probe fps and pixel area, and REJECT the
    // clip if it misses either (normalizeClipFps / normalizeClipArea). Both
    // used to re-encode it for the user; neither does now.
    normalizeClipFps();
    normalizeClipArea();
  };
  // Undecodable → REFUSE (owner 2026-07-27). This used to leave clipMeta at
  // zeros and call it "can't verify, not a hard block" — but every check in
  // clipIssue is guarded on a truthy dur/w/h, so zeros meant duration,
  // resolution, aspect and pixel area were ALL skipped and the clip went
  // straight to fal, where an unmeasurable one bills the model's maximum.
  // Found by running the attach matrix in a Chromium without H.264: all 12
  // mp4s read 0s/0×0 and every model accepted every clip. On a real machine
  // the same hole opens for HEVC, ProRes or AV1 the browser can't decode.
  v.onerror = () => {
    if (attachments.clip !== dataUri) return; // superseded while loading
    rejectClip("I couldn't read that clip — this browser can't decode it, so its length and size can't be checked. Re-export it as MP4 (H.264) and attach it again.");
  };
  v.src = dataUri;
}
// Per-model clip requirements for video-to-video edits, verified against each
// endpoint's fal OpenAPI schema (2026-07). Models absent here (Gemini)
// document no hard clip limits — anything they still reject is caught by the
// terminal-4xx auto-refund path.
const CLIP_LIMITS = {
  // kling-video/o3/pro/video-to-video/edit: mp4/mov, 3-15s, 720-3840px, 24-60fps, ≤200MB
  'fal-ai/kling-video/o3/pro/text-to-video': { minDur: 3, maxDur: 15, minPx: 720, maxPx: 3840, formats: ['mp4', 'mov'], fps: [24, 60] },
  'fal-ai/kling-video/o3/standard/text-to-video': { minDur: 3, maxDur: 15, minPx: 720, maxPx: 3840, formats: ['mp4', 'mov'], fps: [24, 60] },
  // veo3.1/extend-video: 720p/1080p in 16:9|9:16 (schema), output always +7s.
  // Input cap 23s = fal's "extend up to 30 seconds" ceiling minus the 7s
  // output — an 8s cap used to block re-extending an already-extended video.
  'fal-ai/veo3.1': { maxDur: 23, minPx: 720, maxPx: 1920, aspects: [16 / 9, 9 / 16] },
  'fal-ai/veo3.1/fast': { maxDur: 23, minPx: 720, maxPx: 1920, aspects: [16 / 9, 9 / 16] },
  // kling-video/lipsync/audio-to-video: mp4/mov, 2-10s, 720-1920px, ≤100MB
  'fal-ai/kling-video/lipsync/audio-to-video': { minDur: 2, maxDur: 10, minPx: 720, maxPx: 1920, formats: ['mp4', 'mov'] },
  // gemini-omni-flash/edit renders (and fal bills) the WHOLE source clip, and
  // its schema documents no cap — but the MODEL stops at 10s: hand it 30s and
  // it returns the first 10 (at 24fps) and reports success, so we billed 30s
  // of input for 10s of output and fal's COMPLETED status hid it from the
  // refund path. 10 is measured, not documented (2026-07-27). Keep in step
  // with CLIP_MAX_S in worker.js, which is the gate that enforces it.
  // minDur 3 is INFERRED, not documented: fal's /edit schema states no limits
  // at all, but every other Gemini endpoint caps duration at 3..10, and an edit
  // renders the source's own length — so a 1s clip asks for an output shorter
  // than the model will make. Every other model had a floor; this one didn't.
  'google/gemini-omni-flash': { minDur: 3, maxDur: 10 },
  // Seedance @Video1 reference: mp4/mov, 2-15s, <50MB total, and a pixel-AREA
  // band of ~480p-720p (schema: "between ~480p (640x640) and ~720p (834x1112)"
  // — an area constraint: 0.41-0.93MP; 1280×720 fits, 1080p doesn't). Clips
  // over the band are rejected too (normalizeClipArea) — we don't re-encode
  // the user's footage; under-band clips can't be upscaled into detail either.
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
  // A webm written without a Duration element (MediaRecorder captures often
  // are) decodes with duration === Infinity. It used to fall through to the
  // max-duration branch below and read "That clip is Infinitys"; the server
  // can't measure one either, so it would bill the model's maximum. Say what's
  // actually wrong and how to fix it.
  if (dur && !Number.isFinite(dur)) return 'I couldn’t read that clip’s length — its container doesn’t record one. Re-export it as MP4 and attach it again.';
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
  // dimension check in normalizeClipArea, so it's not an error here.
  if (lim.minArea && w && h && w * h < lim.minArea) return 'That clip is ' + w + '×' + h + ' — this model needs at least ~480p (' + lim.minArea.toLocaleString() + ' pixels per frame). Use a higher-resolution clip.';
  // Required aspect ratios (Veo extend: the schema wants a 16:9 or 9:16
  // input). 5% tolerance absorbs encoder rounding (1920×1088 etc.); without
  // this check a square clip only died at fal after the wait + refund.
  if (lim.aspects && w && h) {
    const r = w / h;
    if (!lim.aspects.some((a) => Math.abs(r - a) / a < 0.05)) {
      return 'That clip is ' + w + '×' + h + ' — this model extends 16:9 or 9:16 clips only. Crop or re-export it in one of those shapes.';
    }
  }
  return '';
}

// ── Clip rejection: never rewrite the user's video ──
// A clip that misses a model's requirements is REFUSED, not silently
// re-encoded (owner 2026-07-27). We used to conform fps and downscale
// oversized clips on-device and say so afterwards — but that hands back a file
// the user didn't shoot, re-compressed, and the message arrives after the fact.
// Images are refused over their byte budget too (owner 2026-07-27) — nothing
// the user attaches gets rewritten on the way in.
function rejectClip(msg) {
  if (!attachments.clip) return;
  attachments.clip = null;
  clipMeta = null;
  renderAttach('clip');
  updateSendPrice();
  addMsg('agent', '⚠️ ' + msg);
}

// Some models hard-require an fps range (Kling o3 edit: 24-60) that fal
// enforces strictly — a 23.98fps download (most film/YouTube content) misses
// it. A browser <video> can't report fps, so probe with the on-device engine
// and reject when it's out of range. Serialized by token so a re-attach
// mid-probe can't reject the newer clip.
let _clipFpsToken = 0;
async function normalizeClipFps() {
  const lim = CLIP_LIMITS[model];
  if (!lim || !lim.fps || mode !== 'video' || !attachments.clip) return;
  if (clipMeta && clipMeta.fpsOk) return; // already probed for this clip
  if (typeof sbFFProbeFps !== 'function' || !sbFFSupported()) return; // engine unavailable → fal's error net catches it
  const myToken = ++_clipFpsToken;
  const src = attachments.clip;
  let fps = 0;
  try { fps = await sbFFProbeFps(src, { mime: (clipMeta && clipMeta.type) || '' }); } catch { return; }
  if (myToken !== _clipFpsToken || attachments.clip !== src) return; // clip changed while probing
  if (!fps) return; // couldn't read — leave it to the error net
  const [lo, hi] = lim.fps;
  if (fps >= lo && fps <= hi) { if (clipMeta) clipMeta.fpsOk = true; return; }
  rejectClip('That clip is ' + fps.toFixed(2) + ' fps — this model needs ' + lo + '–' + hi + ' fps. Re-export it at ' + lo + ' fps and attach it again.');
}

// Seedance hard-caps reference clips at ~720p worth of pixels (area band in
// CLIP_LIMITS). A 1080p/4K phone clip is over it — refuse, same as any other
// missed requirement, rather than downscaling their footage for them.
async function normalizeClipArea() {
  const lim = CLIP_LIMITS[model];
  if (!lim || !lim.maxArea || mode !== 'video' || !attachments.clip) return;
  if (!clipMeta || !clipMeta.w || !clipMeta.h) return; // dims unknown — fal's error net catches it
  if (clipMeta.w * clipMeta.h <= lim.maxArea) return; // inside the band
  rejectClip('That clip is ' + clipMeta.w + '×' + clipMeta.h + ' — this model caps reference clips near 720p. Re-export it at 720p or smaller and attach it again.');
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
    // Bail if this clip was swapped out or cleared while it decoded — else a
    // slow decode of the OLD clip stamps its peaks/duration onto the current
    // one (wrong waveform, wrong lip-sync price, wrong validation) (2026-07-17,
    // same guard readClipMeta/measureAttachedImage already have).
    if (attachments.audio !== dataUrl) { if (actx) { try { actx.close(); } catch {} } return; }
    const top = Math.max(...peaks, 0.01);
    awPeaks = peaks.map((p) => Math.pow(p / top, 0.7));
    awDur = audio.duration;
  } catch { if (attachments.audio === dataUrl) { awPeaks = null; awDur = 0; } }
  finally { if (actx) { try { actx.close(); } catch {} } } // always release the context, even on a decode failure (browsers cap ~6)
  if (attachments.audio !== dataUrl) return; // swapped/cleared mid-decode — don't touch live state
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

// Merged Image-to-video row: start slot + optional End frame slot in ONE row
// (owner 2026-07-17) — applies to every video model whose panel had both an
// image slot and a first-&-last row (Veo ×3, Seedance ×3, Kling ×4).
function mergedFlf() {
  const caps = (currentOpts() || {}).caps || {};
  return mode === 'video' && !!caps.image && !!caps.flf;
}
// The optional End-frame slot inside the Image-to-video row: shows once a
// start is staged; renders the flast thumbnail once filled.
function renderImgEnd() {
  const btn = document.getElementById('btnImgEnd');
  if (!btn) return;
  const start = attachments.image || attachments.ffirst;
  const show = mergedFlf() && !!start;
  btn.style.display = show ? '' : 'none';
  if (!show) return;
  if (attachments.flast) {
    btn.classList.add('has');
    btn.innerHTML = '<img src="' + esc(attachments.flast) + '" alt="" /><span class="clip-tag">End</span><span class="x">×</span>';
    const clr = btn.querySelector('.x'); if (clr) clr.onclick = (e) => clearAttach(e, 'flast');
  } else {
    btn.classList.remove('has');
    btn.innerHTML = '<span class="plus-big">+</span><span class="slot-lab">Last frame · optional</span>';
  }
}
function renderAttach(kind) {
  const btn = attachBtn(kind);
  if (!btn) return;
  // Merged row: with an end frame staged, the pair's start lives in ffirst —
  // paint it in the image slot so the row reads as one unit; its × drops the
  // whole pair (a start-less end frame can't run anywhere).
  if (kind === 'image' && mergedFlf() && !attachments.image && attachments.ffirst) {
    btn.classList.add('has');
    btn.innerHTML = '<img src="' + esc(attachments.ffirst) + '" alt="" /><span class="x">×</span>';
    const clr = btn.querySelector('.x');
    if (clr) clr.onclick = (e) => {
      e.stopPropagation();
      attachments.ffirst = null; attachments.flast = null;
      delete imgMeta.ffirst; delete imgMeta.flast;
      renderAttach('ffirst'); renderAttach('flast'); renderAttach('image');
      updateSendPrice();
    };
    renderImgEnd();
    updateApCounts();
    return;
  }
  if (kind === 'ffirst' || kind === 'flast' || kind === 'image') renderImgEnd();
  if (kind === 'audio') {
    renderAudioSlot(btn);
  } else if (attachments[kind]) {
    btn.classList.add('has');
    const preview = kind === 'clip'
      ? (clipMeta && clipMeta.thumb
        ? '<img src="' + esc(clipMeta.thumb) + '" alt="" /><span class="clip-tag">🎬' + (Number.isFinite(clipMeta.dur) && clipMeta.dur >= 0.5 ? ' ' + Math.round(clipMeta.dur) + 's' : '') + '</span>'
        : '<span class="audio-chip">🎬 clip</span>')
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
    // The clip drop-slot reads plain "Video" where the row's verb lives in its
    // header: inside Seedance's combined Reference row (it's a reference), and
    // on Gemini Omni Flash (the row is "Video edit"). Elsewhere it's "Video clip".
    btn.innerHTML = kind === 'clip' && (vxAllowed() || /gemini-omni/.test(model))
      ? '<span class="plus-big">+</span><span class="slot-lab">Video</span>'
      : ATTACH_LABELS[kind];
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
  // Merged row: dropping the End frame demotes the pair back to a plain
  // image-to-video start (ffirst → image), so nothing is lost.
  if (kind === 'flast' && mergedFlf() && attachments.ffirst) {
    attachments.image = attachments.ffirst; attachments.ffirst = null;
    imgMeta.image = imgMeta.ffirst; delete imgMeta.ffirst;
    renderAttach('ffirst'); renderAttach('image');
  }
  // Removing the main image promotes the first extra ref so none orphan,
  // and the add-more slot re-renders (it keys off the main image).
  if (kind === 'image') {
    if (extraImages.length) attachments.image = extraImages.shift();
    renderExtraImages();
  }
  if (kind === 'audio') { awDur = 0; awPeaks = null; awSize = 0; awType = ''; axList.length = 0; renderAxList(); renderRefChips(); }
  if (kind === 'clip') { clipMeta = null; vxList.length = 0; renderVxList(); renderRefChips(); } // dropping slot #1 drops its extras + chips too
  delete imgMeta[kind];
  renderAttach(kind);
  updateSendPrice(); // any removal can move the tier/duration (esp. Ray i2v ↔ t2v)
}

// Show only the panel rows the current model actually supports (same rules
// as the old inline pickers), and clear anything a model can't use.
// Every attach-row header shows filled/cap ("0/14", "1/2") for the CURRENT
// model, so the limits are visible before anything is attached.
// The size/length limits a row actually enforces, for the CURRENT model, as a
// short "3–15s · ≤20 MB" hint beside the count (owner 2026-07-27). The numbers
// come from the same tables the validators use — CLIP_LIMITS, AUDIO_LIMITS and
// the attach-time byte caps — so a hint can't promise something clipIssue or
// audioIssue then rejects. Clips and audio can't be recompressed in the
// browser, so 20 MB is a hard stop; images are refused over 8 MB rather than
// downscaled, so every row's number is now a limit the file has to meet.
// Which limit table each row's hint should read from. Everything unlisted is
// an image row and gets the image byte cap.
const AP_CAP_KIND = { cntClip: 'clip', cntAudio: 'audio' };
const ATTACH_HARD_MB = 20;         // clip/audio: the attach-time rejection
const IMG_FIT_MB = Math.round(IMG_BYTE_CAP / 1048576);
function apCapText(kind) {
  const span = (l) => (l.minDur && l.maxDur ? l.minDur + '–' + l.maxDur + 's'
    : l.maxDur ? '≤' + l.maxDur + 's' : '');
  if (kind === 'clip') {
    const d = span(CLIP_LIMITS[model] || {});
    return (d ? d + ' · ' : '') + '≤' + ATTACH_HARD_MB + ' MB';
  }
  if (kind === 'audio') {
    const lim = AUDIO_LIMITS[model] || {};
    const d = span(lim);
    return (d ? d + ' · ' : '') + '≤' + (lim.maxMB || ATTACH_HARD_MB) + ' MB';
  }
  return '≤' + IMG_FIT_MB + ' MB'; // every other row takes images — refused over this, not shrunk
}
function updateApCounts() {
  const caps = (currentOpts() && currentOpts().caps) || {};
  const set = (id, n, cap) => {
    const el = document.getElementById(id);
    if (el) el.textContent = cap ? n + '/' + cap : '';
    // The hint rides on the same visibility as the count: no cap, no row, no hint.
    const hint = document.getElementById('cap' + id.slice(3));
    if (hint) hint.textContent = cap ? apCapText(AP_CAP_KIND[id] || 'image') : '';
  };
  // Image mode splits into "Image to image" (the one being edited, 0/1) and
  // "Reference to image" (the rest, 0/13) — one number each, no blending.
  // Merged Image-to-video row counts start + optional end frame over /2.
  set('cntImage',
    (attachments.image || attachments.ffirst ? 1 : 0) + (mergedFlf() && attachments.flast ? 1 : 0),
    caps.image ? (mergedFlf() ? 2 : 1) : 0);
  set('cntImgRef', extraImages.length, (mode === 'image' && caps.image && (caps.maxImages || 1) > 1) ? caps.maxImages : 0);
  set('cntAvatar', attachments.avatar ? 1 : 0, caps.avatar ? 1 : 0);
  // Seedance takes up to 3 of each (slot #1 + the @Video2-3/@Audio2-3 extras).
  const multiRef = vxAllowed();
  set('cntAudio', (attachments.audio ? 1 : 0) + axList.length, caps.audio ? (multiRef ? 3 : 1) : 0);
  set('cntClip', (attachments.clip ? 1 : 0) + vxList.length, caps.clip ? (multiRef ? 3 : 1) : 0);
  set('cntEnd', attachments.end ? 1 : 0, caps.end ? 1 : 0);
  set('cntFlf', (attachments.ffirst ? 1 : 0) + (attachments.flast ? 1 : 0), caps.flf ? 2 : 0);
  // Seedance's combined Reference row counts every modality over fal's
  // 12-file total; the per-group labels carry the per-modality caps.
  if (vxAllowed() && caps.ref) {
    set('cntRef', srTotal(), 12);
    renderSrTabs(); // the modality tabs carry the per-type counts
  } else {
    set('cntRef', refList.length, caps.ref || 0);
  }
  set('cntEl', elList.length, caps.el || 0);
}

function updateAttachVisibility() {
  closeApInfo(); // rows are about to be re-shown/hidden — a tooltip pointing at one mustn't linger
  const caps = (currentOpts() && currentOpts().caps) || {};
  // No slots for this model → hide the whole panel, don't leave an empty box.
  const anySlot = !!(caps.image || caps.avatar || caps.audio || caps.clip || caps.end || caps.flf || caps.ref);
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
  // The Seedance-only extra reference slots don't survive a switch to any
  // other family (their @Video2-3/@Audio2-3 tags mean nothing elsewhere).
  if (!vxAllowed() && (vxList.length || axList.length)) {
    vxList.length = 0; axList.length = 0;
  }
  renderVxList(); renderAxList();
  // ── Seedance combined Reference row (owner 2026-07-17): ONE "Reference to
  // video n/12" row with three groups inside — Images 0/9 · Videos 0/3 ·
  // Audio 0/3 — replacing the separate Audio/Video clip rows. The existing
  // controls are RELOCATED (same ids, handlers, validators), and moved back
  // whenever any other model is selected.
  const combine = vxAllowed() && !!caps.ref;
  const vidGrp = document.getElementById('srVidGroup');
  const audGrp = document.getElementById('srAudGroup');
  const clipBody = document.querySelector('#rowClip .ap-body');
  const audBody = document.querySelector('#rowAudio .ap-body');
  if (vidGrp && audGrp && clipBody && audBody) {
    const vidNodes = [attachBtn('clip'), document.getElementById('vxSlots'), document.getElementById('btnVx')].filter(Boolean);
    const audNodes = [attachBtn('audio'), document.getElementById('axSlots'), document.getElementById('btnAx')].filter(Boolean);
    if (combine) {
      vidNodes.forEach((n) => vidGrp.appendChild(n));
      audNodes.forEach((n) => audGrp.appendChild(n));
      const rc = document.getElementById('rowClip'); if (rc) rc.style.display = 'none';
      const ra = document.getElementById('rowAudio'); if (ra) ra.style.display = 'none';
    } else {
      vidNodes.forEach((n) => clipBody.appendChild(n));
      audNodes.forEach((n) => audBody.appendChild(n));
    }
    renderSrTabs();
  }
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
      // re-probe both against the new model's limits.
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
  // The separate First-&-last row retired where the merged Image-to-video
  // row carries the optional End frame slot instead (owner 2026-07-17).
  const rowFlf = document.getElementById('rowFlf');
  if (rowFlf) rowFlf.style.display = caps.flf && !(caps.image && mode === 'video') ? '' : 'none';
  renderImgEnd();
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
  // Reference images follow the model's cap; they stand alone (either ONE
  // edit base or references, never both — normalize any stale mixed state
  // in favor of the edit base).
  const cap = caps.maxImages || 1;
  if (!caps.image || cap <= 1) extraImages.length = 0;
  else if (extraImages.length > cap) extraImages.length = cap;
  if (mode === 'image' && attachments.image && extraImages.length) extraImages.length = 0;
  // "Reference to image" row: image mode only, and only on multi-image models.
  const rowIR = document.getElementById('rowImgref');
  if (rowIR) rowIR.style.display = (mode === 'image' && caps.image && cap > 1) ? '' : 'none';
  // The Image slot reads as the edit base in image mode, the start frame in video.
  const ti = document.getElementById('titleImage');
  // "Edit image", not "image to image" (owner 2026-07-16) — users think in
  // verbs; the row attaches ONE picture the model then changes. In video mode
  // it reads "First and last frame" on the models that take an optional end
  // frame (merged row, owner 2026-07-21), else plain "Image to video".
  if (ti) ti.textContent = mode === 'image' ? 'Edit image' : (mergedFlf() ? 'First and last frame' : 'Image to video');
  // The clip row means different things per family — say the right verb
  // (owner 2026-07-16): Veo CONTINUES the clip (extend-video); Gemini rewrites
  // it (conversational edit → the /edit endpoint, owner 2026-07-21); Kling o3
  // re-renders it; Seedance uses it as a motion reference.
  const tc = document.getElementById('titleClip');
  if (tc) tc.textContent = /veo/.test(model) ? 'Extend clip' : (/gemini-omni/.test(model) ? 'Video edit' : 'Video clip');
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
  imageFlf: 'First and last frame: your image is the opening frame; add an optional last frame to pin the ending, and the model fills in the motion between them.',
  imageEdit: 'Edit image: attach ONE picture, describe the change, and the model applies it — the output follows your picked aspect ratio. Adding references clears this slot (it\'s one input mode or the other).',
  avatar: 'Avatar: attach a face or character the model keeps looking consistent across the video.',
  audio: 'Audio: attach a voice or music track — used as the soundtrack or lip-sync source.',
  clip: 'Video clip: attach a video to extend, restyle, or use as motion reference.',
  clipEdit: 'Video edit: attach a video and describe the change — the model rewrites it (swap objects, relight, change the background) while keeping the scene coherent.',
  end: 'End frame: pin the final frame — the model animates from your image toward it.',
  flf: 'First & last frame: pin the opening and closing frames — the model fills in the motion between them.',
  ref: 'Reference to video: images that keep a character or subject looking consistent in a new scene you describe.',
  imgref: 'Build a NEW image from up to {N} references — a product to place, a style to copy, a face to keep. Cite them by number ("use the style of image 2"). It\'s one input mode or the other: adding references clears the Edit image slot, and vice versa.',
};
function showApInfo(kind, ev, el) {
  const pop = document.getElementById('apInfoPop');
  if (!pop) return;
  // The Image row means image-to-video in video mode, but image editing in image
  // mode; the clip row is a conversational edit on Gemini Omni Flash.
  let key = kind;
  if (kind === 'image') key = mode === 'image' ? 'imageEdit' : (mergedFlf() ? 'imageFlf' : 'imageVideo');
  else if (kind === 'clip' && /gemini-omni/.test(model)) key = 'clipEdit';
  let txt = AP_INFO[key];
  if (!txt) return;
  // The reference cap is per-model (Nano 14, GPT 16) — fill it in live.
  if (kind === 'imgref') txt = txt.replace('{N}', String(((currentOpts() || {}).caps || {}).maxImages || 14));
  // Reference-capable models: teach the @ImageN syntax right where the refs live.
  if (kind === 'ref' && refTagBinding()) {
    txt += ' Cite them in your message as @Image1, @Image2… where each should appear — Go Farther makes sure the model gets them either way.';
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

// ── Image source chooser: device files or the Go Farther gallery ──
let imgPickTarget = 'main'; // which slot the chosen image lands in

function openImgSrc(target, ev, btn) {
  ev.stopPropagation();
  imgPickTarget = target;
  const menu = document.getElementById('imgSrcMenu');
  // Anchor the menu to the tile that was clicked (the main + sits at the top,
  // the add-more + can be several images down) instead of pinning it to the
  // top of the row. The two + tiles now live in DIFFERENT rows, so hop the
  // menu into the clicked tile's row first.
  if (btn && btn.offsetParent) {
    if (menu.parentElement !== btn.offsetParent) btn.offsetParent.appendChild(menu);
    menu.style.top = (btn.offsetTop + 10) + 'px';
  }
  // Multi-image editors can pull a source image from your saved Avatars too,
  // not just the gallery or a device file.
  const sources = [];
  if (IMAGE_MULTI_MODELS.has(model)) { sources.push(['avatar', 'Avatar']); }
  sources.push(['gallery', 'Go Farther gallery'], ['device', 'Your device']);
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
    openGalleryPicker(src); // 'gallery' | 'avatar'
  }
}

// ── Universal source chooser for EVERY attach slot (owner 2026-07-17: "for
// every picker it asks for both") — video-mode slots used to jump straight
// to the device dialog. Each slot now offers Go Farther gallery + Your device
// (image slots also offer saved Avatars), kind-aware: the clip slot lists
// gallery VIDEOS, the audio slot gallery AUDIO. A gallery pick is fetched
// into a File and fed through the SAME hidden-input change path as a device
// pick, so every validation (size caps, magic bytes, exclusivity, clip
// thumbnail, fps conform) applies identically. ──
const SRC_SLOTS = {
  fileImage: { kind: 'image', avatar: true },
  fileAvatar: { kind: 'image', avatar: true },
  fileEnd: { kind: 'image' },
  fileFfirst: { kind: 'image' },
  fileFlast: { kind: 'image' },
  fileRef: { kind: 'image', avatar: true, room: () => Math.max(1, refCap() - refList.length) },
  fileEl: { kind: 'image', avatar: true, room: () => Math.max(1, elCap() - elList.length) },
  fileClip: { kind: 'video' },
  fileAudio: { kind: 'audio' },
  // Seedance extra reference slots (@Video2-3 / @Audio2-3).
  fileVx: { kind: 'video', room: () => Math.max(1, 2 - vxList.length) },
  fileAx: { kind: 'audio', room: () => Math.max(1, 2 - axList.length) },
};
function openSrcMenu(fileId, ev, btn) {
  ev.stopPropagation();
  const cfg = SRC_SLOTS[fileId];
  const menu = document.getElementById('imgSrcMenu');
  if (!menu || !cfg) { const f = document.getElementById(fileId); if (f) f.click(); return; }
  if (btn && btn.offsetParent) {
    if (menu.parentElement !== btn.offsetParent) btn.offsetParent.appendChild(menu);
    menu.style.top = (btn.offsetTop + 10) + 'px';
  }
  const sources = [];
  if (cfg.avatar && loadAvatars().length) sources.push(['slot-avatar', 'Avatar']);
  sources.push(['slot-gallery', 'Go Farther gallery'], ['slot-device', 'Your device']);
  menu.innerHTML = sources.map(([pick, label]) =>
    '<div class="model-item" data-act="slot-pick" data-pick="' + pick + '" data-slot="' + fileId + '"><span>' + label + '</span><span class="check">›</span></div>').join('');
  wireActions(menu);
  document.querySelectorAll('.model-menu.open').forEach((m) => { if (m !== menu) m.classList.remove('open'); });
  menu.classList.toggle('open');
}
function slotSrcPick(fileId, pick, ev) {
  ev.stopPropagation();
  const menu = document.getElementById('imgSrcMenu');
  if (menu) menu.classList.remove('open');
  if (pick === 'slot-device') { const f = document.getElementById(fileId); if (f) f.click(); return; }
  pickMediaFromLibrary(fileId, pick === 'slot-avatar');
}
// Fetch picked gallery/avatar items into Files and hand them to the slot's
// hidden input — the change event runs the exact device-pick pipeline.
async function feedInput(fileId, urls) {
  const input = document.getElementById(fileId);
  if (!input || !urls.length) return;
  const dt = new DataTransfer();
  let failed = 0;
  for (const u of urls) {
    try {
      const r = await fetch(u);
      const blob = await r.blob();
      const ext = (u.startsWith('data:') ? (blob.type.split('/')[1] || 'png') : (u.split('?')[0].split('.').pop() || 'bin')).slice(0, 5);
      dt.items.add(new File([blob], 'gallery-' + (dt.items.length + 1) + '.' + ext, { type: blob.type || '' }));
    } catch { failed++; }
  }
  if (dt.files.length) {
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (failed && typeof sbToast === 'function') sbToast('Couldn’t load ' + failed + (failed === 1 ? ' item' : ' items') + ' from your gallery — try again.');
}
async function pickMediaFromLibrary(fileId, fromAvatars) {
  const cfg = SRC_SLOTS[fileId] || { kind: 'image' };
  let urls;
  if (fromAvatars) {
    urls = loadAvatars().map((a) => a.image).filter(Boolean);
  } else {
    if (!Array.isArray(serverGallery)) await loadServerGallery();
    urls = (Array.isArray(serverGallery) ? serverGallery : [])
      .filter((o) => (o.kind || 'image') === cfg.kind && isSavedMedia(o.url))
      .map((o) => o.url);
  }
  const old = document.querySelector('.gal-overlay');
  if (old) old.remove();
  const ov = document.createElement('div');
  ov.className = 'gal-overlay';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  const remaining = cfg.room ? cfg.room() : 1;
  const multi = remaining > 1 && urls.length > 1;
  const title = fromAvatars ? 'Pick an avatar'
    : cfg.kind === 'video' ? 'Pick a video from your gallery'
    : cfg.kind === 'audio' ? 'Pick audio from your gallery'
    : 'Pick from your gallery';
  const empty = fromAvatars ? 'No avatars yet — create or import one in the Avatar tab.'
    : cfg.kind === 'video' ? 'No videos in your gallery yet — generate or import one first.'
    : cfg.kind === 'audio' ? 'No audio in your gallery yet — generate or import some first.'
    : 'Nothing in your gallery yet — images you generate will show up here.';
  ov.innerHTML = '<div class="gal-box"><div class="gal-head"><span class="gal-title">' + esc(title) + '</span>'
    + '<span class="gal-sub">' + (urls.length ? urls.length + (urls.length === 1 ? ' item' : ' items') : '') + '</span>'
    + '<button class="gal-close">×</button></div>'
    + (urls.length ? '<div class="gal-grid"></div>' : '<div class="gal-empty">' + esc(empty) + '</div>')
    + (multi ? '<div class="gal-foot"><span class="gal-count">Tap to select · up to ' + remaining + '</span><button class="gal-add" disabled>Add</button></div>' : '')
    + '</div>';
  const closeBtn = ov.querySelector('.gal-close');
  if (closeBtn) closeBtn.onclick = () => ov.remove();
  const gridEl = ov.querySelector('.gal-grid');
  const picked = [];
  const countEl = ov.querySelector('.gal-count');
  const addBtn = ov.querySelector('.gal-add');
  const paintBar = () => {
    if (!addBtn) return;
    addBtn.disabled = !picked.length;
    addBtn.textContent = picked.length ? 'Add ' + picked.length : 'Add';
    countEl.textContent = picked.length ? picked.length + ' / ' + remaining + ' selected' : 'Tap to select · up to ' + remaining;
  };
  if (gridEl) urls.forEach((u) => {
    let tile;
    if (!fromAvatars && cfg.kind === 'video') {
      tile = document.createElement('video');
      tile.muted = true; tile.preload = 'metadata'; tile.src = u;
      tile.addEventListener('loadedmetadata', () => { try { tile.currentTime = 0.001; } catch (e) {} }, { once: true });
    } else if (!fromAvatars && cfg.kind === 'audio') {
      tile = document.createElement('div');
      tile.className = 'gal-audio-tile';
      tile.textContent = '♪ ' + decodeURIComponent((u.split('/').pop() || 'audio').split('?')[0]).slice(-28);
    } else {
      tile = document.createElement('img');
      tile.alt = ''; tile.loading = 'lazy'; tile.decoding = 'async';
      if (fromAvatars) tile.src = u;
      else { thumbFallback(tile, u); tile.src = galleryThumb(u); }
    }
    tile.onclick = () => {
      if (!multi) { ov.remove(); feedInput(fileId, [u]); return; }
      const i = picked.indexOf(u);
      if (i >= 0) { picked.splice(i, 1); tile.classList.remove('sel'); }
      else if (picked.length < remaining) { picked.push(u); tile.classList.add('sel'); }
      paintBar();
    };
    gridEl.appendChild(tile);
  });
  if (addBtn) addBtn.onclick = () => { if (picked.length) { ov.remove(); feedInput(fileId, picked.slice()); } };
  document.body.appendChild(ov);
}

// Where each image source pulls from, and how its picker reads. Avatars and
// products are saved locally with an `image` field (data URI or URL).
const IMG_SOURCES = {
  gallery: { title: 'Pick from your gallery', empty: 'Nothing in your gallery yet — images you generate will show up here.', list: () => galleryImages() },
  avatar:  { title: 'Pick an avatar',         empty: 'No avatars yet — create or import one in the Avatar tab.',           list: () => loadAvatars().map((a) => a.image).filter(Boolean) },
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
    if (m.t === 'media' && m.kind === 'image' && m.url && isSavedMedia(m.url) && !isChatOnlyMedia(m.url) && !seen.has(m.url)) {
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
  // How many more images this pick can take — the Image-to-image slot is
  // always exactly one; the reference row runs to the model's cap. Decides
  // instant single-pick vs multi-select with an Add bar.
  const capNow = ((currentOpts() || {}).caps || {}).maxImages || 1;
  const remaining = imgPickTarget === 'extra'
    ? Math.max(1, capNow - extraImages.length)
    : 1;
  const multi = remaining > 1 && urls.length > 1;
  ov.innerHTML = '<div class="gal-box"><div class="gal-head"><span class="gal-title">' + esc(meta.title) + '</span>'
    + '<span class="gal-sub">' + (urls.length ? urls.length + (urls.length === 1 ? ' image' : ' images') : '') + '</span>'
    + '<button class="gal-close">×</button></div>'
    + (urls.length ? '<div class="gal-grid"></div>' : '<div class="gal-empty">' + esc(meta.empty) + '</div>')
    + (multi ? '<div class="gal-foot"><span class="gal-count">Tap to select · up to ' + remaining + '</span><button class="gal-add" disabled>Add</button></div>' : '')
    + '</div>';
  const closeBtn = ov.querySelector('.gal-close');
  if (closeBtn) closeBtn.onclick = () => ov.remove();
  // Build thumbnails with DOM APIs (never innerHTML) so a stored URL can't
  // break out of the src attribute and inject markup.
  const gridEl = ov.querySelector('.gal-grid');
  const picked = []; // insertion order = attach order
  const countEl = ov.querySelector('.gal-count');
  const addBtn = ov.querySelector('.gal-add');
  const paintBar = () => {
    if (!addBtn) return;
    addBtn.disabled = !picked.length;
    addBtn.textContent = picked.length ? 'Add ' + picked.length + (picked.length === 1 ? ' image' : ' images') : 'Add';
    countEl.textContent = picked.length ? picked.length + ' / ' + remaining + ' selected' : 'Tap to select · up to ' + remaining;
  };
  if (gridEl) urls.forEach((u) => {
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy'; img.decoding = 'async';
    // Thumbnail for DISPLAY only — the picked value stays the original `u`.
    thumbFallback(img, u);
    img.src = galleryThumb(u);
    if (!multi) {
      img.onclick = () => { useGalleryImages([u]); ov.remove(); };
    } else {
      img.onclick = () => {
        const i = picked.indexOf(u);
        if (i >= 0) { picked.splice(i, 1); img.classList.remove('sel'); }
        else if (picked.length < remaining) { picked.push(u); img.classList.add('sel'); }
        paintBar();
      };
    }
    gridEl.appendChild(img);
  });
  if (addBtn) addBtn.onclick = () => { if (picked.length) { useGalleryImages(picked.slice()); ov.remove(); } };
  document.body.appendChild(ov);
}

// Fetch the stored image(s) and attach them like picked files (the API wants
// data URIs). The Image-to-image slot takes exactly one (and clears the
// references); the reference row appends up to the cap (and clears the edit
// base) — it's one input mode or the other, never both.
async function useGalleryImages(urls) {
  const cap = ((currentOpts() || {}).caps || {}).maxImages || 1;
  let failed = 0;
  if (imgPickTarget === 'extra' && attachments.image) { attachments.image = null; }
  for (const url of urls) {
    try {
      const blob = await (await fetch(url)).blob();
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
      if (imgPickTarget === 'extra') {
        if (extraImages.length < cap) extraImages.push(dataUrl);
      } else {
        attachments.image = dataUrl;      // the one edit base (last pick wins)
        if (mode === 'image') extraImages.length = 0;
        clearImageInputsExcept('image');  // keep image-input modes exclusive
      }
    } catch { failed++; }
  }
  renderAttach('image');
  renderExtraImages();
  updateSendPrice();
  if (failed) alert("Couldn't load " + (failed === 1 ? 'one of those images' : failed + ' of those images') + ' — try saving to your device instead.');
}

// Reference images (the "Reference to image" row) — EITHER these OR the one
// edit base, never both: adding references clears the Image-to-image slot.
function onAttachExtra(inputEl) {
  const files = Array.from(inputEl.files || []);
  inputEl.value = '';
  const cap = ((currentOpts() || {}).caps || {}).maxImages || 1;
  if (attachments.image) { attachments.image = null; renderAttach('image'); }
  files.forEach((file) => {
    readImageAttach(file).then(({ uri, err }) => {
      if (!uri) { addMsg('agent', '⚠️ ' + err); return; }
      if (extraImages.length < cap) extraImages.push(uri);
      renderExtraImages();
      updateSendPrice();
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
    // References number 1..cap (they stand alone — there's no edit base when
    // references are attached, it's one or the other).
    d.innerHTML = '<img src="' + esc(src) + '" alt="" /><span class="slot-num">' + (i + 1) + '/' + cap + '</span><span class="x">×</span>';
    d.querySelector('.x').onclick = () => removeExtraImage(i);
    host.appendChild(d);
  });
  const more = document.getElementById('btnMoreImages');
  if (more) {
    const cap = ((currentOpts() || {}).caps || {}).maxImages || 1;
    // Hide the add tile once the cap is reached (was a dead, clickable control at N/N).
    more.style.display = (cap > 1 && extraImages.length < cap) ? '' : 'none';
    more.innerHTML = '<span class="plus-big">+</span><span class="slot-count">' + extraImages.length + '/' + cap + '</span>';
  }
  // The 44px badge gutter exists only while the n/14 badges show —
  // otherwise the slots sit full-width with no dead lane on the left.
  const body = host.closest('.ap-body');
  if (body) body.classList.toggle('has-nums', extraImages.length > 0);
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
  if (keep !== 'el' && elList.length) { elList.length = 0; renderElList(); }
  // On Veo the clip is exclusive too (owner 2026-07-16): its four rows are
  // four separate fal endpoints, none accepting the others' inputs — so an
  // image/flf/ref attach drops a staged Extend clip. Gemini is the same
  // (its edit endpoint takes no refs; its ref endpoint takes no clip).
  // Other families keep their legit combos (Kling o3 edit + refs/elements,
  // Seedance clip-as-reference).
  if (keep !== 'clip' && attachments.clip && mode === 'video' && /veo|gemini/.test(model)) {
    attachments.clip = null; clipMeta = null; renderAttach('clip'); renderRefChips();
  }
}

// Reference-to-video images (Veo ≤3, Seedance ≤9): its own row, capped at caps.ref.
function refCap() { return ((currentOpts() || {}).caps || {}).ref || 0; }
function onAttachRef(inputEl) {
  const files = Array.from(inputEl.files || []);
  inputEl.value = '';
  const cap = refCap();
  // Cap hits reject LOUDLY (owner 2026-07-17: no caps printed in the UI —
  // reject with the reason instead), never silently drop files.
  let capToasted = false;
  files.forEach((file) => {
    if (refList.length >= cap) {
      if (!capToasted) { capToasted = true; sbToast('Reference images are capped at ' + cap + ' on this model.'); }
      return;
    }
    if (srCapHit()) return;
    readImageAttach(file).then(({ uri, err }) => {
      if (!uri) { addMsg('agent', '⚠️ ' + err); return; }
      if (refList.length < cap && !(vxAllowed() && srTotal() >= 12)) { refList.push(uri); clearImageInputsExcept('ref'); renderRefList(); }
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
    readImageAttach(file).then(({ uri, err }) => {
      if (!uri) { addMsg('agent', '⚠️ ' + err); return; }
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

// ── Seedance multi-reference extras (@Video2-3 / @Audio2-3) ──
// Slot #1 is the normal clip/audio attach (all existing validation applies);
// these add up to 2 more of each, Seedance-only, with the COMBINED caps fal
// enforces (videos 2-15s total & ≤50MB; audios ≤15s total).
function vxAllowed() { return mode === 'video' && /seedance/.test(model); }
// fal's cross-modal cap on the Seedance reference endpoint: ≤12 files TOTAL
// across images + videos + audios (9/3/3 per-modality maxima sum to 15).
function srTotal() {
  return refList.length
    + (attachments.clip ? 1 : 0) + vxList.length
    + (attachments.audio ? 1 : 0) + axList.length;
}
function srCapHit() {
  if (!vxAllowed() || srTotal() < 12) return false;
  sbToast('References are capped at 12 files total (images + videos + audio).');
  return true;
}
// The combined Reference row's modality switcher (owner 2026-07-17: "three
// logos that switch between image, video and audio") — one group visible at
// a time on Seedance; every other model shows the plain image group.
let srTab = 'img';
function renderSrTabs() {
  const tabs = document.getElementById('srTabs');
  if (!tabs) return;
  const caps = (currentOpts() || {}).caps || {};
  const combine = vxAllowed() && !!caps.ref;
  tabs.style.display = combine ? '' : 'none';
  const groups = { img: 'srImgGroup', vid: 'srVidGroup', aud: 'srAudGroup' };
  Object.entries(groups).forEach(([tab, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = !combine || tab === srTab ? '' : 'none';
  });
  tabs.querySelectorAll('.sr-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === srTab));
  const n = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  n('srTabImgN', refList.length + '/9');
  n('srTabVidN', ((attachments.clip ? 1 : 0) + vxList.length) + '/3');
  n('srTabAudN', ((attachments.audio ? 1 : 0) + axList.length) + '/3');
}
function pickSrTab(tab) { srTab = tab; renderSrTabs(); }
function vxDurTotal() { return ((clipMeta && clipMeta.dur) || 0) + vxList.reduce((t, x) => t + (x.dur || 0), 0); }
function axDurTotal() { return (awDur || 0) + axList.reduce((t, x) => t + (x.dur || 0), 0); }
function onAttachVx(inputEl) {
  const files = Array.from(inputEl.files || []);
  inputEl.value = '';
  if (!vxAllowed() || !attachments.clip) return;
  let vxCapToasted = false;
  files.forEach((file) => {
    if (vxList.length >= 2) {
      if (!vxCapToasted) { vxCapToasted = true; sbToast('Video references are capped at 3 (the clip + 2 more).'); }
      return;
    }
    if (srCapHit()) return;
    // Same format rule as slot #1 (CLIP_LIMITS seedance): fal takes MP4/MOV.
    if (!/^video\/(mp4|quicktime)/.test(file.type || '')) { sbToast('Reference clips must be MP4 or MOV.'); return; }
    const bytesNow = Math.floor(((attachments.clip || '').length + vxList.reduce((t, x) => t + x.uri.length, 0)) * 0.75);
    if (bytesNow + (file.size || 0) > 50_000_000) { sbToast('Video references are capped at 50 MB combined — this one would go over.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const uri = reader.result;
      const v = document.createElement('video');
      v.preload = 'metadata'; v.muted = true;
      v.onloadedmetadata = () => {
        const dur = v.duration || 0, w = v.videoWidth || 0, h = v.videoHeight || 0;
        try { v.src = ''; } catch (e) {}
        if (vxList.length >= 2 || !attachments.clip) return; // state moved on
        // fal's per-clip pixel band (~480p-720p AREA) — extras aren't
        // auto-downscaled (slot #1 is); bounce with the reason instead.
        const area = w * h;
        if (w && (area < 409600 || area > 927408)) {
          sbToast('Reference clips need to sit between ~480p and ~720p — re-export this one near 720p (e.g. 1280×720) and add it again.');
          return;
        }
        if (vxDurTotal() + dur > 15.2) {
          sbToast('Video references are capped at 15 seconds COMBINED — this one would make it ' + Math.ceil(vxDurTotal() + dur) + 's.');
          return;
        }
        vxList.push({ uri, dur, w, h });
        renderVxList(); renderRefChips(); updateSendPrice();
      };
      v.onerror = () => { sbToast('Couldn’t read that video — try a different file.'); };
      v.src = uri;
    };
    reader.readAsDataURL(file);
  });
}
function removeVx(i) { vxList.splice(i, 1); renderVxList(); renderRefChips(); updateSendPrice(); }
function renderVxList() {
  const host = document.getElementById('vxSlots');
  const add = document.getElementById('btnVx');
  if (!host || !add) return;
  host.innerHTML = '';
  vxList.forEach((x, i) => {
    const d = document.createElement('div');
    d.className = 'slot';
    d.innerHTML = '<span class="slot-vid">🎬 ' + (x.dur >= 0.5 ? Math.round(x.dur) + 's' : 'clip') + '</span>' +
      '<span class="slot-tag">@Video' + (i + 2) + '</span><span class="x">×</span>';
    d.querySelector('.x').onclick = () => removeVx(i);
    host.appendChild(d);
  });
  const show = vxAllowed() && !!attachments.clip && vxList.length < 2;
  add.style.display = show ? '' : 'none';
  if (show) add.querySelector('.slot-count').textContent = (1 + vxList.length) + '/3';
  updateApCounts();
}
function onAttachAx(inputEl) {
  const files = Array.from(inputEl.files || []);
  inputEl.value = '';
  if (!vxAllowed() || !attachments.audio) return;
  let axCapToasted = false;
  files.forEach((file) => {
    if (axList.length >= 2) {
      if (!axCapToasted) { axCapToasted = true; sbToast('Audio references are capped at 3 (the track + 2 more).'); }
      return;
    }
    if (srCapHit()) return;
    if (!/^audio\//.test(file.type || '')) { sbToast('That file isn’t an audio clip.'); return; }
    if ((file.size || 0) > 15_000_000) { sbToast('Audio references are capped at 15 MB per file.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const uri = reader.result;
      const a = document.createElement('audio');
      a.preload = 'metadata';
      a.onloadedmetadata = () => {
        const dur = a.duration || 0;
        try { a.src = ''; } catch (e) {}
        if (axList.length >= 2 || !attachments.audio) return;
        if (axDurTotal() + dur > 15.2) {
          sbToast('Audio references are capped at 15 seconds COMBINED — this one would make it ' + Math.ceil(axDurTotal() + dur) + 's.');
          return;
        }
        axList.push({ uri, dur, name: (file.name || 'audio').replace(/[<>&"]/g, '') });
        renderAxList(); renderRefChips(); updateSendPrice();
      };
      a.onerror = () => { sbToast('Couldn’t read that audio — try a different file.'); };
      a.src = uri;
    };
    reader.readAsDataURL(file);
  });
}
function removeAx(i) { axList.splice(i, 1); renderAxList(); renderRefChips(); updateSendPrice(); }
function renderAxList() {
  const host = document.getElementById('axSlots');
  const add = document.getElementById('btnAx');
  if (!host || !add) return;
  host.innerHTML = '';
  axList.forEach((x, i) => {
    const d = document.createElement('div');
    d.className = 'slot';
    d.innerHTML = '<span class="slot-vid">♪ ' + (x.dur >= 0.5 ? Math.round(x.dur) + 's' : 'audio') + '</span>' +
      '<span class="slot-tag">@Audio' + (i + 2) + '</span><span class="x">×</span>';
    d.querySelector('.x').onclick = () => removeAx(i);
    host.appendChild(d);
  });
  const show = vxAllowed() && !!attachments.audio && axList.length < 2;
  add.style.display = show ? '' : 'none';
  if (show) add.querySelector('.slot-count').textContent = (1 + axList.length) + '/3';
  updateApCounts();
}
// ── Reference chips in the composer ──
// While references are attached (tag-binding context), the chatbox shows one
// clickable @ImageN chip per image — tap to drop that tag at the cursor, so
// writing "the character from @Image1…" never means memorizing the order.
// A clip on a Seedance model is a @Video1 reference (reference-to-video), so it
// gets a chip too — everywhere else a clip is an edit/extend, which has no tag.
function clipIsVideoRef() { return mode === 'video' && !!attachments.clip && /seedance/.test(model); }
// The chip bar is a mention picker, NOT a permanent fixture (owner
// 2026-07-17: "don't make it appear when I put it in reference — only when
// I go @…"): it shows only while the user is typing an @tag in the prompt,
// offering the staged references to complete with a click.
function refChipsWanted() {
  const input = document.getElementById('input');
  if (!input) return false;
  const upto = input.value.slice(0, input.selectionStart ?? input.value.length);
  return /@[a-z0-9]*$/i.test(upto);
}
function renderRefChips() {
  const composer = document.querySelector('#viewHome .composer');
  if (!composer) return;
  let bar = document.getElementById('refChips');
  const vidRef = clipIsVideoRef();
  // Seedance audio references get @AudioN tags the prompt can cite too.
  const audRef = vxAllowed() && !!attachments.audio;
  const want = ((refTagBinding() && refList.length) || elList.length || vidRef || audRef) && refChipsWanted();
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
    chip.onclick = () => completeTag('@Image' + (i + 1));
    bar.appendChild(chip);
  });
  elList.forEach((src, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ref-chip';
    chip.title = 'Insert @Element' + (i + 1) + ' into your message';
    chip.innerHTML = '<img src="' + esc(src) + '" alt="" />@Element' + (i + 1);
    chip.onclick = () => completeTag('@Element' + (i + 1));
    bar.appendChild(chip);
  });
  if (vidRef) {
    const vids = 1 + vxList.length; // slot #1 + the Seedance extras
    for (let i = 1; i <= vids; i++) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ref-chip ref-chip-vid';
      chip.title = 'Insert @Video' + i + ' into your message';
      chip.innerHTML = '<span class="ref-chip-glyph">🎬</span>@Video' + i;
      chip.onclick = () => completeTag('@Video' + i);
      bar.appendChild(chip);
    }
  }
  if (audRef) {
    const auds = 1 + axList.length;
    for (let i = 1; i <= auds; i++) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ref-chip ref-chip-vid';
      chip.title = 'Insert @Audio' + i + ' into your message';
      chip.innerHTML = '<span class="ref-chip-glyph">♪</span>@Audio' + i;
      chip.onclick = () => completeTag('@Audio' + i);
      bar.appendChild(chip);
    }
  }
}
// Caret moves (arrows, clicks, focus) also decide whether an @token is being
// typed — the input event alone misses them.
(() => {
  const inp = document.getElementById('input');
  if (inp) ['click', 'keyup', 'focus'].forEach((ev) => inp.addEventListener(ev, () => { try { renderRefChips(); } catch (e) {} }));
})();
// Complete the @token being typed: select the partial "@im…" so the insert
// replaces it, then re-render (the finished tag hides the picker).
function completeTag(tag) {
  const input = document.getElementById('input');
  if (input) {
    const s = input.selectionStart ?? input.value.length;
    const m = input.value.slice(0, s).match(/@[a-z0-9]*$/i);
    if (m) input.setSelectionRange(s - m[0].length, s);
  }
  insertAtCursor(tag);
  renderRefChips();
}
function insertAtCursor(tag) {
  const input = document.getElementById('input');
  if (!input) return;
  const s = input.selectionStart ?? input.value.length;
  const e = input.selectionEnd ?? s;
  const before = input.value.slice(0, s), after = input.value.slice(e);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  // Always leave a space after the tag — the caret lands past the completed
  // token, so the mention picker closes instead of re-matching "@Image1".
  const tail = /^\s/.test(after) ? '' : ' ';
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
  const badges = m.tier ? '' : notes
    .filter((t) => !['audio', 'Google', 'OpenAI', 'ByteDance', 'MiniMax'].includes(t))
    .map((t) => t === 'newest'
      ? '<span class="m-badge">NEW</span>'
      : '<span class="m-tag' + (/cheap/i.test(t) ? ' cheap' : '') + '">' + t.toUpperCase() + '</span>')
    .join('');
  // Tiered rows (owner's reference design): a gold max-res badge + a colored
  // PREMIUM/CLASSIC/BASIC pill instead of the generic chips.
  let chips;
  if (m.tier) {
    const o = MODEL_OPTS[m.id];
    const top = o && o.resolutions ? o.resolutions[o.resolutions.length - 1] : '';
    const res = top === '4k' ? '4K' : top;
    const mon = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M9 20.5h6"/></svg>';
    chips = (res ? '<span class="m-restier">' + mon + res + '</span>' : '')
      + '<span class="m-tier m-tier-' + m.tier + '">' + m.tier.toUpperCase() + '</span>';
  } else {
    chips = modelChips(m.id).map((c) => '<span class="m-chip">' + c + '</span>').join('');
  }
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
//   auto — gofarther.dev composes and makes every creative call, never asks
//   plan — gofarther.dev interviews first (the question popup), then composes
//   off  — raw prompting: the text goes to the model exactly as typed,
//          and the director surcharge disappears from the price
// The orchestrator (the Sonnet/Haiku layer) is now an explicit on/off switch on
// the builder page. When OFF, directorMode is 'off' (raw prompting — words go to
// the model as typed, no Sonnet in the loop). When ON, the Auto/Plan chip picks
// how it behaves; Plan only exists while the orchestrator is on.
const DIR_MODE_KEY = 'zephyr_director_mode';
const DIR_MODES = {
  auto: { icon: '', label: 'Auto', desc: 'gofarther.dev writes the prompt and generates right away' },
  plan: { icon: '', label: 'Plan', desc: 'gofarther.dev shows you the plan to approve before generating' },
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
    sw.title = 'Orchestrator — Go Farther reads your message, picks the model and writes the prompt (spends credits per use). Off = raw prompting, free.';
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

// ── Website-builder model picker (Auto / Sonnet 5 / Opus 4.8) — lives in the SITE-BUILDER composer (st-comp),
// sent as `picker` on a react-build. Auto routes per agent (Opus plans, Sonnet builds); Sonnet/Opus pin every agent.
// The site composer re-renders, so the menu markup is emitted inline (buildPickerHTML) and wired per render.
// TWO OPTIONS, SONNET DEFAULT (owner's call, 2026-08-08). There was a third —
// `auto`, Opus for the data model and Sonnet for the pages — and wiring the
// picker made it real and immediately broke every new account's first build: a
// cold Opus schema call is 15 credits against a 20-credit grant, leaving less
// than the pages call needs, so the customer paid 15 and got a placeholder.
// Kept out until the grant covers it; see builder/build-models.mjs.
const BUILD_PICKERS = {
  sonnet: { label: 'Sonnet 5', desc: 'Fast, and what most sites want' },
  opus:   { label: 'Opus 5',   desc: 'Most capable — slower, and costs about 1.7×' },
};
const BUILD_PICKER_KEY = 'zephyr_build_picker_v1';
// `auto` is still in some browsers' localStorage from the hours it existed, so
// a stored value that is no longer an option has to fall back rather than
// render an undefined label.
let buildPicker = localStorage.getItem(BUILD_PICKER_KEY) || 'sonnet';
if (!BUILD_PICKERS[buildPicker]) buildPicker = 'sonnet';
function buildPickerHTML() {
  return '<span class="st-buildsel-wrap">' +
    '<button type="button" class="st-buildsel" id="stBuildSel" title="Which model builds the site">Builder: <b id="stBuildLabel">' + BUILD_PICKERS[buildPicker].label + '</b> ▾</button>' +
    '<div class="model-menu drop-up build-menu" id="stBuildMenu">' +
      ['sonnet', 'opus'].map((k) => { const m = BUILD_PICKERS[k]; return '<div class="model-item build-item' + (k === buildPicker ? ' selected' : '') + '" data-pick="' + k + '"><span class="txt"><b>' + m.label + '</b><small>' + m.desc + '</small></span><span class="check">✓</span></div>'; }).join('') +
    '</div></span>';
}
function setBuildPicker(p) {
  if (!BUILD_PICKERS[p]) return;
  buildPicker = p;
  localStorage.setItem(BUILD_PICKER_KEY, p);
  const lbl = document.getElementById('stBuildLabel'); if (lbl) lbl.textContent = BUILD_PICKERS[p].label;
  const menu = document.getElementById('stBuildMenu');
  if (menu) { menu.classList.remove('open'); menu.querySelectorAll('.build-item').forEach((it) => it.classList.toggle('selected', it.dataset.pick === p)); }
}
function wireBuildPicker() {
  const sel = document.getElementById('stBuildSel'), menu = document.getElementById('stBuildMenu');
  if (!sel || !menu) return;
  sel.onclick = (e) => { e.stopPropagation(); document.querySelectorAll('.model-menu.open').forEach((m) => { if (m !== menu) m.classList.remove('open'); }); menu.classList.toggle('open'); };
  menu.querySelectorAll('.build-item').forEach((it) => { it.onclick = () => setBuildPicker(it.dataset.pick); });
}

// ── Effort dial (1→5) — sits next to the model picker in the site-builder composer, sent as `effort`.
// Levels 1–4 keep the picked model and just raise tokens-out; level 5 ("Max") trips the multi-agent
// fan-out, which inherits the model picker (Sonnet→all-Sonnet, Opus→all-Opus, Auto→mixed per task).
const BUILD_EFFORTS = {
  low:    { lvl: 1, label: 'Low',    desc: 'Smallest output — quick drafts' },
  medium: { lvl: 2, label: 'Medium', desc: 'More output — simple sites' },
  high:   { lvl: 3, label: 'High',   desc: 'Big output — most sites' },
  ultra:  { lvl: 4, label: 'Ultra',  desc: 'Max single-shot output' },
  max:    { lvl: 5, label: 'Max',    desc: 'Multi-agent fan-out — nothing truncates' },
};
const BUILD_EFFORT_KEY = 'zephyr_build_effort_v1';
let buildEffort = localStorage.getItem(BUILD_EFFORT_KEY) || 'high';
if (!BUILD_EFFORTS[buildEffort]) buildEffort = 'high';
function buildEffortHTML() {
  return '<span class="st-buildsel-wrap">' +
    '<button type="button" class="st-buildsel" id="stEffSel" title="Effort — how much output; Level 5 (Max) fans out to multi-agent">Effort: <b id="stEffLabel">' + BUILD_EFFORTS[buildEffort].label + '</b> ▾</button>' +
    // Anchored to its RIGHT edge — this chip sits near the end of the composer
    // row, and the shared `.drop-up` rule pins menus to `left: 0`, which ran the
    // panel 72px past the rail. Measured at the rail's real 450px width.
    '<div class="model-menu drop-up build-menu build-menu-end" id="stEffMenu">' +
      ['low', 'medium', 'high', 'ultra', 'max'].map((k) => { const m = BUILD_EFFORTS[k]; return '<div class="model-item build-item' + (k === buildEffort ? ' selected' : '') + '" data-eff="' + k + '"><span class="txt"><b>' + m.lvl + ' · ' + m.label + '</b><small>' + m.desc + '</small></span><span class="check">✓</span></div>'; }).join('') +
    '</div></span>';
}
function setBuildEffort(e) {
  if (!BUILD_EFFORTS[e]) return;
  buildEffort = e;
  localStorage.setItem(BUILD_EFFORT_KEY, e);
  const lbl = document.getElementById('stEffLabel'); if (lbl) lbl.textContent = BUILD_EFFORTS[e].label;
  const menu = document.getElementById('stEffMenu');
  if (menu) { menu.classList.remove('open'); menu.querySelectorAll('.build-item').forEach((it) => it.classList.toggle('selected', it.dataset.eff === e)); }
}
function wireBuildEffort() {
  const sel = document.getElementById('stEffSel'), menu = document.getElementById('stEffMenu');
  if (!sel || !menu) return;
  sel.onclick = (e) => { e.stopPropagation(); document.querySelectorAll('.model-menu.open').forEach((m) => { if (m !== menu) m.classList.remove('open'); }); menu.classList.toggle('open'); };
  menu.querySelectorAll('.build-item').forEach((it) => { it.onclick = () => setBuildEffort(it.dataset.eff); });
}


// An edit of attached media — a clip in video mode (video-to-video) or a
// source image in image mode (image editing). The effort ladder applies to
// edits too (owner's call, 2026-07-16) — this now only routes reruns of edits
// into a fresh compose instead of replaying a stale prompt.
function isEditMode() {
  return (mode === 'video' && !!attachments.clip) || (mode === 'image' && !!attachments.image);
}
function toggleEffortMenu(e) {
  e.stopPropagation();
  if (directorMode === 'off' || !orchActive()) return; // raw / no add-on: effort has nothing to control
  const menu = document.getElementById('effortMenu');
  document.querySelectorAll('.model-menu.open').forEach((m) => { if (m !== menu) m.classList.remove('open'); });
  menu.classList.toggle('open');
}
// The effort picker only shapes the prompt gofarther.dev writes, so it greys out in
// raw mode AND when the AI Orchestrator add-on isn't active (no writer at all).
function renderEffortLock() {
  const pick = document.querySelector('.effort-pick');
  if (!pick) return;
  const subbed = orchActive();
  // Effort applies to EDITS too (owner's call, 2026-07-16): High+ writes a
  // detailed edit instruction, Low a terse one — user picks the dial.
  const off = directorMode === 'off' || !subbed;
  pick.classList.toggle('locked', off);
  pick.querySelector('.opt-btn').title = !subbed
    ? 'Effort is part of the AI Orchestrator add-on ($19.99/mo)'
    : directorMode === 'off'
    ? 'Effort applies when gofarther.dev writes the prompt — turn the orchestrator on to use it'
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
      sizes: model === 'openai/gpt-image-2' ? ['2K', '4K'] : null, defSize: '2K',
      nums: IMAGE_NUM_MODELS.has(model) ? [1, 2, 3, 4] : null,
      caps: {
        // Reference caps are the PROVIDERS' documented input maxima: Nano
        // Banana Pro combines up to 14 images (Google), GPT Image 2's edit
        // API takes up to 16 (OpenAI). fal's schemas declare no bound.
        image: IMAGE_EDIT_MODELS.has(model), end: false, avatar: false,
        maxImages: model === 'openai/gpt-image-2' ? 16 : IMAGE_MULTI_MODELS.has(model) ? 14 : 1,
      },
    };
  }
  const o = MODEL_OPTS[model];
  return o && SOUND_MODELS_RE.test(model) ? { ...o, sound: true } : o;
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
  if (previewing) {
    // Another preview is mid-generation. The control is a <span> (no disabled
    // state), so without a cue the click reads as ignored — flash the clicked
    // button briefly so the user knows it registered (2026-07-18).
    const prev = btn.textContent;
    btn.textContent = '⏳';
    setTimeout(() => { if (btn.textContent === '⏳') btn.textContent = prev; }, 800);
    return; // don't spend a second credit while one is already generating
  }
  previewing = true;
  let previewStatusUrl = null;

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
    previewStatusUrl = job.status_url; // charged now — refund if the render fails

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
    // The preview render failed AFTER being charged — refund the TTS credit and
    // say why, instead of a silent bare glyph (2026-07-17).
    if (previewStatusUrl) {
      try {
        const rf = await requestRefund(previewStatusUrl);
        if (typeof sbToast === 'function') sbToast("Couldn't generate that voice preview" + (rf > 0 ? ' — the credit was refunded.' : '. Try again in a moment.'));
      } catch {}
    } else if (typeof sbToast === 'function') sbToast("Couldn't play that voice preview — try again in a moment.");
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
    soundOn = true;
  }

  const sections = [];
  if (opts.ratios) sections.push(settingSection('Aspect ratio', 'ratio', opts.ratios.map((r) => ({ value: r, label: r }))));
  if (opts.resolutions) sections.push(settingSection(opts.resLabel || 'Resolution', 'quality', opts.resItems || opts.resolutions.map((q) => ({ value: q, label: q }))));
  if (opts.sizes) sections.push(settingSection('Resolution', 'gptSize', opts.sizes.map((s) => ({ value: s, label: s }))));
  if (opts.durations) sections.push(settingSection('Duration', 'duration', opts.durations.map((d) => ({ value: d, label: d + 's' }))));
  if (opts.sound) sections.push(settingSection('Sound', 'sound', [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]));
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
  const cur = { ratio: ratio, quality: quality, gptSize: gptSize, duration: duration, num: numImages, voice: voice, sound: soundOn ? 'on' : 'off' }[kind];
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
  return '<div class="set-section sec-' + kind + (collapsible ? ' collapsible' : '') + '">' +
    '<div class="set-label">' + label + '</div>' +
    '<div class="set-chips">' + chips + '</div>' +
    (collapsible ? '<button type="button" class="set-viewall">View all</button>' : '') +
    '</div>';
}

// Veo runs whose length fal FIXES regardless of the picker: references
// always render 8s, extends always add 7s. The duration section locks while
// one is staged (owner 2026-07-16: the picker let you choose seconds that
// changed nothing — the price rightly stayed on the fixed length).
function veoDurLock() {
  if (mode !== 'video') return '';
  if (/veo/.test(model)) {
    if (refList.length) return 'ref';
    if (attachments.clip) return 'extend';
    // Lite first-&-last only accepts 8s (fal OpenAPI: duration const "8s";
    // live 422 2026-07-17 confirmed). Lite t2v/i2v genuinely take 4s/6s/8s.
    if (/\/lite/.test(model) && (attachments.ffirst || attachments.flast)) return 'lite8';
    return '';
  }
  return '';
}
function syncDurLock() {
  const menu = document.getElementById('settingsMenu');
  const sec = menu && menu.querySelector('.set-section.sec-duration');
  if (!sec) return;
  const lock = veoDurLock();
  sec.classList.toggle('dur-locked', !!lock);
  let note = sec.querySelector('.set-note');
  if (!note) { note = document.createElement('div'); note.className = 'set-note'; sec.appendChild(note); }
  note.textContent = lock === 'ref'
    ? 'Reference runs always render 8s — the model fixes the length.'
    : lock === 'extend' ? 'Extending always adds 7s — the model fixes the length.'
    : lock === 'lite8' ? 'An end-frame run on Lite always renders 8s — the model fixes the length.' : '';
  // Veo extend outputs 720p ONLY (fal schema: resolution const) — pin the
  // resolution picker to match, so the summary/price can't disagree with
  // what fal renders and bills.
  const qsec = menu.querySelector('.set-section.sec-quality');
  if (qsec) {
    const resLock = lock === 'extend';
    qsec.classList.toggle('dur-locked', resLock);
    let qnote = qsec.querySelector('.set-note');
    if (!qnote && resLock) { qnote = document.createElement('div'); qnote.className = 'set-note'; qsec.appendChild(qnote); }
    if (qnote) qnote.textContent = resLock ? 'Extending always outputs 720p — the model fixes the resolution.' : '';
    if (resLock && quality !== '720p') {
      quality = '720p';
      menu.querySelectorAll('.set-chip[data-kind="quality"]').forEach((c) => c.classList.toggle('active', c.dataset.value === '720p'));
      updateSettingsSummary();
    }
  }
  // Snap the picker to the truth so the chips + summary can't disagree with
  // what fal renders and bills.
  if ((lock === 'ref' || lock === 'lite8') && duration !== 8) {
    duration = 8;
    menu.querySelectorAll('.set-chip[data-kind="duration"]').forEach((c) => c.classList.toggle('active', c.dataset.value === '8'));
    updateSettingsSummary();
  }
}

function pickSetting(chip) {
  const kind = chip.dataset.kind, val = chip.dataset.value;
  if (kind === 'duration' && veoDurLock()) return; // fixed-length run — picker inert
  if (kind === 'quality' && veoDurLock() === 'extend') return; // extend outputs 720p only
  if (kind === 'ratio') ratio = val;
  else if (kind === 'quality') quality = val;
  else if (kind === 'gptSize') gptSize = val;
  else if (kind === 'duration') duration = Number(val);
  else if (kind === 'num') numImages = Number(val);
  else if (kind === 'voice') voice = val;
  else if (kind === 'sound') soundOn = val === 'on';
  const cur = { ratio: ratio, quality: quality, gptSize: gptSize, duration: duration, num: numImages, voice: voice, sound: soundOn ? 'on' : 'off' };
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
  if (opts.sizes && gptSize !== '2K') parts.push(gptSize); // 2K is the default
  if (opts.durations) parts.push(veoDurLock() === 'extend' ? '+7s' : duration + 's');
  if (opts.sound && !soundOn) parts.push('Silent');
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

// Wall-clock caption under a bubble, e.g. "11:03 PM" (user) / "gofarther.dev · 11:03 PM" (agent).
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
  t.textContent = kind === 'agent' ? 'gofarther.dev · ' + fmtTime(ts) : fmtTime(ts);
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
    typeText(div, text); // Go Farther's replies type out word-by-word
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
// A website brief typed on the landing's WEBSITE channel, held through login —
// consumed by enterApp into the standalone Website Builder (never the studio).
let pendingSiteBrief = null;
// Same idea for the landing's GAME channel — a game brief held through login,
// consumed when the Game Studio first renders (prefills the compose box).
let pendingGameBrief = null;

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
  // Flag the empty new-chat state on the view root so the composer can center
  // itself under the greeting (Claude Focus layout); it drops back to the
  // bottom-docked chat layout the moment a message exists.
  document.getElementById('viewHome')?.classList.toggle('home-empty', show);
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
    sound: soundOn,
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
    soundOn = o.sound ? cs.sound !== false : true;
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
    els: elList.slice(), vxs: vxList.slice(), axs: axList.slice(),
    mask: maskData, clipMeta,
    awDur, awPeaks, awName, awSize, awType, imgMeta: { ...imgMeta },
  };
}
function restoreStaged(id) {
  restoringStaged = true;
  try {
    const s = stagedByChat[id];
    Object.keys(attachments).forEach((k) => { attachments[k] = s ? s.att[k] || null : null; });
    extraImages.length = 0; refList.length = 0; elList.length = 0; vxList.length = 0; axList.length = 0;
    if (s) { extraImages.push(...s.extras); refList.push(...s.refs); elList.push(...s.els); vxList.push(...(s.vxs || [])); axList.push(...(s.axs || [])); }
    maskData = s ? s.mask : null;
    clipMeta = s ? s.clipMeta : null;
    // Tear down the previous chat's audio player — else the play button on the
    // new chat's clip plays the OLD chat's audio (awPlayer was left bound)
    // (2026-07-17). It re-creates from the new attachments.audio on next play.
    if (awPlayer) { try { awPlayer.pause(); } catch (e) {} awPlayer = null; }
    try { cancelAnimationFrame(awRaf); } catch (e) {}
    awDur = s ? s.awDur : 0; awPeaks = s ? s.awPeaks : null;
    awName = s ? s.awName : ''; awSize = s ? s.awSize : 0; awType = s ? s.awType : '';
    Object.keys(imgMeta).forEach((k) => delete imgMeta[k]);
    if (s && s.imgMeta) Object.assign(imgMeta, s.imgMeta);
    Object.keys(attachments).forEach((k) => renderAttach(k));
    renderExtraImages(); renderRefList(); renderElList(); renderVxList(); renderAxList();
    updateAttachVisibility();
    updateSendPrice();
  } finally { restoringStaged = false; }
}

// ── Staged attachments survive a refresh (owner 2026-07-16, every model) ──
// localStorage can't hold multi-MB clip data URIs, so each chat's staged
// snapshot mirrors into IndexedDB: written (debounced) on every attach-panel
// change, hydrated at boot and on chat switch, deleted when a send consumes
// the inputs, the chat dies, or the account signs out/wipes.
function stagedDbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('zephyr_staged_v1', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('staged');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function stagedDbPut(id, val) {
  if (!id) return;
  try {
    const db = await stagedDbOpen();
    await new Promise((res, rej) => {
      const tx = db.transaction('staged', 'readwrite');
      if (val === null) tx.objectStore('staged').delete(id);
      else tx.objectStore('staged').put(val, id);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch (e) {}
}
async function stagedDbGet(id) {
  try {
    const db = await stagedDbOpen();
    const val = await new Promise((res, rej) => {
      const rq = db.transaction('staged').objectStore('staged').get(id);
      rq.onsuccess = () => res(rq.result || null);
      rq.onerror = () => rej(rq.error);
    });
    db.close();
    return val;
  } catch (e) { return null; }
}
async function stagedDbClear() {
  try {
    const db = await stagedDbOpen();
    await new Promise((res, rej) => {
      const tx = db.transaction('staged', 'readwrite');
      tx.objectStore('staged').clear();
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch (e) {}
}
const stagedHasContent = (s) => !!s && (Object.values(s.att || {}).some(Boolean)
  || (s.extras || []).length > 0 || (s.refs || []).length > 0
  || (s.els || []).length > 0 || (s.kfs || []).length > 0
  || (s.vxs || []).length > 0 || (s.axs || []).length > 0 || !!s.mask);
var restoringStaged = false; // var: read by renderers that run before this line executes
let _stagedPersistT = 0;
function schedulePersistStaged() {
  if (restoringStaged) return;
  clearTimeout(_stagedPersistT);
  _stagedPersistT = setTimeout(() => {
    let id; try { id = chatStore.active; } catch { return; }
    if (!id) return;
    stashStaged(id);
    const s = stagedByChat[id];
    stagedDbPut(id, stagedHasContent(s) ? { ...s, at: Date.now() } : null);
  }, 400);
}
// Stale stashes expire after 7 days: a photo attached weeks ago must never
// silently ride along on (and re-route) a fresh send, and forgotten 25MB
// clips shouldn't sit in the browser forever.
const STAGED_MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const stagedFresh = (rec) => !!rec && (!rec.at || Date.now() - rec.at < STAGED_MAX_AGE_MS);
// Boot GC: drop every persisted stash that expired or whose chat no longer
// exists (deleted on another device — the local delete path already cleans).
async function stagedDbSweep() {
  try {
    const db = await stagedDbOpen();
    const alive = new Set((chatStore.chats || []).map((c) => c.id));
    await new Promise((res, rej) => {
      const tx = db.transaction('staged', 'readwrite');
      const cur = tx.objectStore('staged').openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) return;
        if (!stagedFresh(c.value) || !alive.has(c.key)) c.delete();
        c.continue();
      };
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch (e) {}
}
// A chat with no in-memory snapshot may have one persisted from before the
// refresh — pull it and re-apply if the user is still looking at that chat.
async function hydrateStaged(id) {
  if (!id || stagedByChat[id]) return;
  const rec = await stagedDbGet(id);
  if (rec && !stagedFresh(rec)) { stagedDbPut(id, null); return; } // expired — never ambush a send
  if (rec && !stagedByChat[id] && chatStore.active === id && stagedHasContent(rec)) {
    stagedByChat[id] = rec;
    restoreStaged(id);
  }
}
// Every attach-panel change funnels through these renderers — wrap them once
// so any change (attach, clear, exclusivity eviction, thumbnail landing)
// persists without touching each call site.
(() => {
  ['renderAttach', 'renderExtraImages', 'renderRefList', 'renderElList', 'renderVxList', 'renderAxList', 'renderMaskState'].forEach((name) => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () { const r = orig.apply(this, arguments); schedulePersistStaged(); return r; };
  });
})();

function switchChat(id) {
  if (id === chatStore.active) return;
  stampComposer();               // save the outgoing chat's composer setup
  const outId = chatStore.active;
  stashStaged(outId);            // and its staged attachments (in-memory)
  const outSnap = stagedByChat[outId];
  stagedDbPut(outId, stagedHasContent(outSnap) ? outSnap : null); // …and refresh-proof
  chatStore.active = id;
  persistStore();
  applyComposerState((activeChat() || {}).comp);
  restoreStaged(id);
  hydrateStaged(id); // nothing in memory → maybe persisted from before a refresh
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
  stagedDbPut(id, null);
  // Chat-only files (already gallery-deleted) whose ONLY references live in
  // this chat become invisible everywhere once it's gone — free their storage.
  const dying = chatStore.chats.find((c) => c.id === id);
  const orphanCandidates = new Set();
  if (dying) (dying.msgs || []).forEach((m) => {
    if (m.t === 'media' && isChatOnlyMedia(m.url)) orphanCandidates.add(m.url);
  });
  const wasActive = chatStore.active === id;
  chatStore.chats = chatStore.chats.filter((c) => c.id !== id);
  orphanCandidates.forEach((u) => {
    if (anyChatMediaRef(u)) return; // another chat still shows it
    const m = u.match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
    if (m && window.Auth) { try { Auth.storageDelete(m[1]); } catch {} }
  });
  if (!chatStore.chats.length) chatStore.chats = [newChatEntry()];
  if (chatStore.active === id) chatStore.active = chatStore.chats[0].id;
  if (wasActive) {
    applyComposerState((activeChat() || {}).comp);
    restoreStaged(chatStore.active);
    hydrateStaged(chatStore.active); // else the fallback chat's refresh-persisted staged inputs stay hidden (mirror switchChat)
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
    el.decoding = 'async'; el.loading = 'lazy';
    // Appear whole: hidden until decoded, so big originals never paint top-down.
    el.className = 'img-fade';
    el.addEventListener('load', () => el.classList.add('img-ready'), { once: true });
    el.src = src; el.alt = '';
    if (el.complete) el.classList.add('img-ready'); // instant from cache
    el.addEventListener('click', () => openLightbox('image', url));
  } else if (kind === 'audio') {
    el = document.createElement('audio');
    el.controls = true; el.src = src;
  } else {
    el = document.createElement('video');
    el.controls = true; el.src = src; el.playsInline = true;
    // Safari: paint the first frame without waiting for play (see the same
    // nudge on gallery cards).
    el.addEventListener('loadedmetadata', () => { try { el.currentTime = 0.001; } catch (e) {} }, { once: true });
  }
  // A media URL can die after the fact: deleted from the gallery on another
  // surface/device (chat sync has no per-message tombstones, so the message can
  // outlive its file) or an expired temporary fal link. Without a handler that
  // renders as a big blank box in the thread. Self-heal: a dead OUR-storage URL
  // means the file was deliberately deleted → drop the whole message; any other
  // dead link collapses into a small note instead of dead air.
  el.onerror = () => {
    if (isSavedMedia(url)) {
      // A media element error fires on TRANSIENT failures too — offline, a
      // Supabase 5xx, a flaky connection. Deleting the message (and SYNCING
      // the deletion) on those is permanent data loss for a temporary blip.
      // Only self-heal (drop the message) when the file is CONFIRMED gone —
      // an actual 404/410 from storage. Anything else collapses to a note and
      // leaves the message intact so it reloads next time.
      div.innerHTML = '<span class="media-gone">Couldn’t load this media — it’ll reappear if it was just a hiccup.</span>';
      if (!navigator.onLine) return; // offline → definitely transient
      fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } })
        .then((res) => {
          if (res.status !== 404 && res.status !== 410) return; // still there / transient error → keep the message
          div.remove();
          const chat = activeChat();
          if (chat) {
            const i = chat.msgs.findIndex((m) => m.t === 'media' && m.url === url);
            if (i >= 0) { chat.msgs.splice(i, 1); persistStore(); touchSync(chat.id); }
          }
        })
        .catch(() => {}); // network error confirming → assume transient, keep the message
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
  del.className = 'media-btn'; del.type = 'button'; del.textContent = '🗑';
  del.title = isSavedMedia(url) && !isChatOnlyMedia(url) ? 'Remove from chat (gallery copy stays)' : 'Remove from chat';
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
  if (!confirm(isSavedMedia(url) && !isChatOnlyMedia(url)
    ? 'Remove this from the chat? Your gallery copy stays.'
    : 'Remove this from the chat?')) return;
  el.remove();
  const chat = activeChat();
  if (chat) {
    const i = chat.msgs.findIndex((mm) => mm.t === 'media' && mm.url === url);
    if (i >= 0) { chat.msgs.splice(i, 1); persistStore(); touchSync(chat.id); }
  }
  // A chat-only file (already deleted from the gallery) that no chat shows
  // anymore is invisible everywhere — free its storage for real.
  if (isChatOnlyMedia(url) && !anyChatMediaRef(url)) {
    const m = url.match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
    if (m && window.Auth) { try { await Auth.storageDelete(m[1]); } catch {} }
    if (galStorage) refreshStorageBar();
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
  // javascript:/data:text/html URL into fetch's catch → window.open. Same-origin
  // proxy paths (/api/m/<token>, used to hide the source host on temp links) are
  // allowed — fetch resolves them relative to our origin.
  if (!/^(https?:|blob:|data:(?:image|video|audio)\/)/i.test(url || '') && !/^\/api\/m\//.test(url || '')) return;
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
    // Cross-origin fetch failed. Opening the raw URL would put the render
    // service's host in the address bar — users must never see the provider
    // (owner 2026-07-17). Only fall back to window.open for our own hosts
    // (Supabase storage, gofarther.dev); otherwise fail with a toast.
    if (/^(blob:|data:)/i.test(url) || /(^|\.)(gofarther\.dev|supabase\.co)(\/|$)/i.test((url.match(/^https?:\/\/([^/]+)/i) || [, ''])[1])) {
      window.open(url, '_blank', 'noopener');
    } else if (typeof sbToast === 'function') {
      sbToast("Couldn't download that just now — try again in a moment.");
    }
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
// Avatar renders use the same JOBS_KEY store (so boot-resume + the sign-out
// sweep can recover/refund one abandoned by a refresh) under a reserved key.
const AVATAR_JOB_ID = '__avatar__';
const SAVES_KEY = 'zephyr_pending_saves_v1';

function jobsLoad() { try { return JSON.parse(localStorage.getItem(JOBS_KEY) || '[]'); } catch { return []; } }
// Cap kept generous (24) so the oldest in-flight record is never silently
// evicted in practice — routing an evicted record through finishDeadJob would
// wrongly cancel a still-live render, so a bigger buffer is the safe mitigation.
function jobsWrite(list) { try { localStorage.setItem(JOBS_KEY, JSON.stringify(list.slice(-24))); } catch {} }
function jobRecord(chatId, rec) { jobsWrite([...jobsLoad().filter((j) => j.chatId !== chatId), { chatId, ...rec }]); }
function jobClear(chatId) { jobsWrite(jobsLoad().filter((j) => j.chatId !== chatId)); }
// Drop ONE record by its idem — used when cancelling a specific submit so a new
// run started in the same chat (different idem) keeps its refresh protection.
function jobClearByIdem(idem) { if (!idem) return; jobsWrite(jobsLoad().filter((j) => j.idem !== idem)); }
// Count a failed-to-complete resume so a permanently-dead job is eventually
// abandoned instead of re-polled every boot forever.
function jobBumpTries(chatId) { jobsWrite(jobsLoad().map((j) => j.chatId === chatId ? { ...j, tries: (j.tries || 0) + 1 } : j)); }

function savesLoad() { try { return JSON.parse(localStorage.getItem(SAVES_KEY) || '[]'); } catch { return []; } }
function savesWrite(list) { try { localStorage.setItem(SAVES_KEY, JSON.stringify(list.slice(-20))); } catch {} }
// `url` is the raw provider link to actually save; `disp` is what's shown in
// the thread (a same-origin proxy src when the source host must stay hidden) so
// the eventual permanent-URL swap can find the right message.
function queuePendingSave(url, kind, disp) { savesWrite([...savesLoad().filter((p) => p.url !== url), { url, kind, disp: disp || url, at: Date.now() }]); }

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
    const existing = map[key];
    if (existing && now - claimAt(existing) < 3600e3) {
      // A recent claim from ANOTHER live tab means it's delivering now — yield.
      // But a claim from a different tab that's older than the deliver window
      // (a save finishes in seconds; 3 min is generous even for a big video)
      // means the claiming tab DIED mid-deliver — e.g. a page refresh during
      // save. Take it over so the paid render isn't stranded until the 1h
      // expiry with no message (bug 2026-07-17). A refresh mints a new TAB_ID,
      // so `by !== TAB_ID` reliably flags the dead prior tab.
      const mine = typeof existing === 'object' && existing.by === TAB_ID;
      // 40s < the 45s scheduleResume cycle: a live tab saves+delivers in seconds
      // and clears the shared job record, so a claim still un-cleared past 40s
      // belongs to a dead tab — the next resume tick takes it over.
      const stale = now - claimAt(existing) > 40e3;
      if (!mine && !stale) return false;
    }
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

// When a render can't be saved (free tier / gallery full) it's delivered on a
// temporary link. That link must NEVER ride a <video>/<audio> src directly —
// swap it for an opaque same-origin stream token so the source host is never
// client-visible (right-click, devtools). Retries the tiny same-origin mint a
// couple of times; only a total failure falls back to the raw link (playback
// beats a broken card, and this endpoint is same-origin + authed so it
// effectively always succeeds).
async function proxyMediaUrl(u) {
  if (typeof u !== 'string' || !/^https?:\/\//i.test(u)) return u; // local/data/blob already safe
  for (let i = 0; i < 3; i++) {
    try {
      const r = await apiFetch('/api/media-token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        if (d && d.token) return '/api/m/' + d.token;
        return u; // server declined to seal (not a proxyable host) — nothing to hide
      }
      if (r.status === 400) return u; // not a sealable URL; no point retrying
    } catch {}
    if (i < 2) await new Promise((res) => setTimeout(res, 600 * (i + 1)));
  }
  return u;
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

// Burn the "✦ gofarther.dev" mark into an image client-side (bottom-right), returning
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
    c.fillText('✦ gofarther.dev', w - pad, h - pad);
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
let retryingSaves = false; // in-session retries can overlap boot's run — don't double-post
async function retryPendingSaves() {
  if (retryingSaves) return;
  retryingSaves = true;
  try {
    const list = savesLoad();
    if (!list.length) return;
    const keep = [];
    for (const p of list) {
      // Finding the media stranded on the expired temp link — tell the chat
      // that holds it, instead of dropping the promised save silently
      // (2026-07-17). "It'll land there on its own" must not quietly break.
      if (Date.now() - (p.at || 0) > 6 * 24 * 3600e3) {
        const c = chatStore.chats.find((ch) => (ch.msgs || []).some((m) => m.t === 'media' && (m.url === (p.disp || p.url) || m.url === p.url)));
        if (c) deliverAgent(c.id, '⚠️ Couldn’t save one of your earlier ' + (p.kind || 'media') + ' generations to the gallery in time — its temporary link has expired. Re-generate it to keep a permanent copy.');
        continue;
      }
      // saveOutput just posts the URL; the server watermarks free-account images.
      const { url: perm, block } = await saveOutput(p.url, p.kind);
      if (perm) { replaceMediaUrl(p.disp || p.url, perm); if (p.disp && p.disp !== p.url) replaceMediaUrl(p.url, perm); }
      else if (block) { /* paid gate (free/full) — already told at gen time; drop it */ }
      else keep.push(p);
    }
    savesWrite(keep);
  } finally { retryingSaves = false; }
}
// A save just failed mid-session: retry soon while the tab is open (90s, then
// 5 min), instead of parking it until the next full page load — the user
// shouldn't need to refresh for their gallery copy to appear.
let saveRetryTimers = [];
function scheduleSaveRetries() {
  saveRetryTimers.forEach(clearTimeout);
  saveRetryTimers = [90_000, 300_000].map((ms) => setTimeout(retryPendingSaves, ms));
}

// Boot: pick up any generation that was in flight when the tab last died.
function resumeJobs() {
  const all = jobsLoad();
  // Avatar renders (reserved key) can't ride the chat-delivery resume path —
  // recover/refund them separately and drop the record.
  const avatarJobs = all.filter((j) => j.avatar || j.chatId === AVATAR_JOB_ID);
  if (avatarJobs.length) {
    jobsWrite(all.filter((j) => !(j.avatar || j.chatId === AVATAR_JOB_ID)));
    avatarJobs.forEach((j) => resumeAvatarJob(j));
  }
  const jobs = jobsLoad().filter((j) => j.chatId && j.chatId !== AVATAR_JOB_ID && ((j.statusUrl && j.responseUrl) || j.idem));
  const live = jobs.filter((j) => (j.tries || 0) < 4);
  const dead = jobs.filter((j) => (j.tries || 0) >= 4);
  jobsWrite(live);
  live.forEach((j) => { if (!activeGens.has(j.chatId)) resumeOne(j); });
  // A record that failed several boots running used to be dropped SILENTLY —
  // a paid render vanishing with no explanation (owner 2026-07-17: every
  // render must end visibly). Resolve it terminally instead: if fal actually
  // finished it, give delivery one more shot; otherwise refund + say so.
  dead.forEach((j) => { finishDeadJob(j); });
}
async function finishDeadJob(j) {
  try {
    if (j.statusUrl) {
      try {
        const sr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(j.statusUrl));
        if (sr.ok) {
          const st = await sr.json().catch(() => ({}));
          if (st.status === 'COMPLETED' && !activeGens.has(j.chatId)) {
            // fal finished it — retry DELIVERY, but BOUNDED so a permanently
            // undeliverable render can't loop forever. resumeJobs already
            // dropped the record from storage, so RE-PERSIST it (with a
            // delivery-attempt counter) to make "retry each boot" actually
            // true (2026-07-17: it wasn't — the record was gone). After a few
            // attempts, fall through to the refund + message below.
            const dtries = (j.dtries || 0) + 1;
            if (dtries <= 3) {
              jobRecord(j.chatId, { ...j, tries: 3, dtries });
              resumeOne({ ...j, tries: 3, dtries });
              return;
            }
          }
        }
      } catch (e) {}
    }
    // A provisional record (idem, no statusUrl — its submit reply was lost) that
    // reached the dead state: try an idem recovery before giving up. The worker
    // returns the stored job if a charge exists (recover + deliver) and confirms
    // nothing was charged otherwise. If recovery takes over the chat's gen loop,
    // we're done; else fall through to the refund/apology (2026-07-18).
    if (!j.statusUrl && j.idem && !activeGens.has(j.chatId)) {
      await recoverJob(j);
      if (activeGens.has(j.chatId)) return;
    }
    // Not recoverable: cancel (in case it's wedged IN_QUEUE — otherwise the
    // refund can't credit a non-terminal job) then refund; the server
    // re-verifies with fal so only jobs that never ran get credited back.
    const refunded = j.statusUrl ? await cancelThenRefund(j.statusUrl) : 0;
    deliverAgent(j.chatId, '⚠️ A render from earlier couldn\'t be recovered'
      + (refunded > 0
        ? ' — your ' + refunded + (refunded === 1 ? ' credit was' : ' credits were') + ' refunded.'
        : '. Sorry about that — if credits were taken for it, use the same prompt to run it again.'));
  } catch (e) {}
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
    const rec = jobsLoad().find((j) => j.chatId === chatId);
    if (!rec) return;
    // Exhausted its tries mid-session (the 45s cycle bumped it to the cap) —
    // resolve it TERMINALLY (deliver-if-fal-finished, else refund + message)
    // like boot-resume does, instead of stalling silently until a full reload
    // and letting a new send overwrite the dead record (2026-07-17).
    if ((rec.tries || 0) >= 4) { jobClear(chatId); finishDeadJob(rec); return; }
    // A provisional idem-only record (submit reply lost, maybe charged) has no
    // statusUrl — recover it by idem in-session too, not just at next reload.
    if (rec.statusUrl || rec.idem) resumeOne(rec);
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
  // Lite: t2v + i2v only, no 4k; 1080p costs more than 720p (unlike Std/Fast).
  'fal-ai/veo3.1/lite':                           { s: { '720p': 0.05, '1080p': 0.08 }, aoff: { '720p': 0.03, '1080p': 0.05 } },
  // Ray prices i2v BELOW t2v (i2s tier) and only renders 5s from a start image.
  'bytedance/seedance-2.0/text-to-video':         { s: { '480p': 0.14, '720p': 0.304, '1080p': 0.682, '4k': 1.59 } },
  'bytedance/seedance-2.0/fast/text-to-video':    { s: { '480p': 0.135, '720p': 0.242 } }, // no 1080p on the fast tier
  'bytedance/seedance-2.0/mini/text-to-video':    { s: { '480p': 0.0725, '720p': 0.155 } },
  'fal-ai/kling-video/o3/pro/text-to-video':      { s: { def: 0.14 }, aoff: { def: 0.112 }, v2s: { def: 0.168 } }, // edit endpoint bills 20% over t2v
  'fal-ai/kling-video/o3/standard/text-to-video': { s: { def: 0.112 }, aoff: { def: 0.084 }, v2s: { def: 0.126 } },
  'fal-ai/kling-video/v3/pro/text-to-video':      { s: { def: 0.168 }, aoff: { def: 0.112 } },
  'fal-ai/kling-video/v3/standard/text-to-video': { s: { def: 0.126 }, aoff: { def: 0.084 } },
  'google/gemini-omni-flash':                     { s: { def: 0.13 } },
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
      // 'auto' ratio has no explicit dimensions, so 2K/4K can't apply — the
      // run goes out (and bills) at 1K. Worker enforces the same.
      const t = GPT_PRICE[ratio === 'auto' ? '1K' : gptSize] || GPT_PRICE['1K'];
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
  // Audio-length billing (awDur, seconds) — no current model uses it (was
  // OmniHuman, removed 2026-07-17); kept for the next audio-billed model.
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
  // Rate table: clip attached → v2s (re-render premium: Kling o3 +20%);
  // start image on a model that prices i2v separately → i2s; else t2v —
  // discounted to aoff when the render is explicitly silent (Veo, Kling).
  const startImg = !!(attachments.image || attachments.ffirst || attachments.flast);
  // Silent when the director inferred it from the user's words (override) OR
  // the manual Sound toggle is off — both hit fal's audio-off rate where one
  // exists (Veo, Seedance, Kling v3).
  const soundOff = soundOverride === false || (!soundOn && !!(currentOpts() || {}).sound);
  const tbl = p.v2s && attachments.clip ? p.v2s : p.i2s && startImg ? p.i2s : (soundOff && p.aoff ? p.aoff : p.s);
  const rate = tbl[quality] != null ? tbl[quality] : tbl.def != null ? tbl.def : tbl['720p'];
  if (rate == null) return '';
  // Endpoint-fixed durations — quote what will actually be billed:
  //  · Veo extend always outputs 7s; Veo reference-to-video always renders 8s.
  //  · The o3/Gemini clip edits render the WHOLE source clip (no duration
  //    input), so the bill follows the clip's length, not the picker.
  //  · A Kling multi-shot bills the SUM of its shot durations.
  const shots = (shotsOverride && shotsApply(model)) ? sanitizeShots(shotsOverride) : null;
  const isVeoExtend = /veo/.test(model) && !!attachments.clip;
  const isVeoRef = /veo/.test(model) && refList.length > 0;
  // Lite first-&-last renders 8s only (the duration picker locks too).
  const isLite8 = /veo3\.1\/lite/.test(model) && !!(attachments.ffirst || attachments.flast);
  const isClipEdit = !!attachments.clip && (/kling-video\/o3/.test(model) || /gemini/.test(model));
  const clipEditMax = /gemini/.test(model) ? 30 : 15;
  // The worker byte-measures MP4/MOV (moov→mvhd) and WebM/MKV (EBML Info→
  // Duration); a container it can't measure bills the max, so quote the max
  // too for those and the shown price matches the charge (2026-07-17).
  // Measurable formats keep the browser-measured length. Keep this list in
  // step with videoDurationFromDataUri in worker.js — that is the parity.
  const clipMeasurable = clipMeta && /mp4|quicktime|mov|webm|matroska/i.test(clipMeta.type || '');
  const clipEditSecs = Math.min(clipEditMax, Math.ceil((clipMeasurable && clipMeta.dur) || clipEditMax));
  // Veo refs win over a clip (the worker routes reference-to-video first).
  const billDur = shots ? shots.reduce((t, s) => t + s.duration, 0)
    : isVeoRef ? 8
    : isVeoExtend ? 7
    : isLite8 ? 8
    : isClipEdit ? clipEditSecs
    : (duration || 5);
  // Seedance reference-to-video with @VideoN clips: 0.6× rate over the
  // COMBINED input seconds + the output duration (same basis as the worker).
  if (/seedance/.test(model) && attachments.clip) {
    const combined = ((clipMeta && clipMeta.dur) || 0) + vxList.reduce((t, x) => t + (x.dur || 0), 0);
    const inSecs = Math.min(15, Math.ceil(combined || 15));
    return fmtPrice(0.6 * rate * (inSecs + billDur));
  }
  // Veo extend outputs 720p only (fal schema const) — quote that tier even
  // if the picker sits on 4k, matching what the worker bills.
  const effRate = isVeoExtend && tbl['720p'] != null ? tbl['720p'] : rate;
  return fmtPrice(effRate * billDur);
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
  // Live-re-quote any visible Plan review card so its "Generate ✦N" always
  // equals what approval will actually charge at the current settings.
  document.querySelectorAll('.review-allow').forEach((b) => { try { if (b._reprice) b._reprice(); } catch (e) {} });
  // Every price-moving change also decides whether the duration picker is
  // live (Veo refs/extend fix the length) — keep the lock in sync here since
  // this runs on every attach/setting/model change.
  try { syncDurLock(); } catch (e) {}
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
// The on-screen "✦ gofarther.dev" mark free accounts see over video players —
// chat thread, gallery cards and the lightbox all carry it (class wm-spot
// marks the non-chat containers).
function wmBadge() {
  const wm = document.createElement('span');
  wm.className = 'wm-badge';
  wm.textContent = '✦ gofarther.dev';
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
  // `credArcMenu` went with the gauge on 2026-08-12 (owner). `setArcFill` is
  // null-safe, so leaving the call would have worked — and a line naming an
  // element that no longer exists reads as wiring somebody will later hunt for.
  setArcFill(document.getElementById('credArc'), frac);
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
// Upstream detail text can name the provider or its hosts — users must never
// see "fal" anywhere (owner 2026-07-17), so every quoted error is scrubbed:
// provider URLs vanish, standalone provider tokens become neutral wording.
// \bfal\b never matches inside words (false, falcon), so prose survives.
function scrubProvider(s) {
  return String(s || '')
    .replace(/https?:\/\/[^\s"']*fal[^\s"']*/gi, '')
    .replace(/\bfal\.(?:ai|run|media)\b/gi, 'the render service')
    .replace(/\bfal-ai\b/gi, 'the render service')
    .replace(/\bfal\b/gi, 'the render service')
    .replace(/\s{2,}/g, ' ').trim();
}
function falErrorDetail(body) {
  try {
    const d = body && (body.detail ?? body.error ?? body.message);
    if (!d) return '';
    if (typeof d === 'string') return scrubProvider(d).slice(0, 300);
    if (Array.isArray(d)) {
      return scrubProvider(d.slice(0, 3).map((e) => {
        if (typeof e === 'string') return e;
        const field = Array.isArray(e.loc) ? e.loc.filter((p) => p !== 'body').join('.') : '';
        return (field ? field + ': ' : '') + (e.msg || e.message || JSON.stringify(e));
      }).join(' · ')).slice(0, 400);
    }
    return scrubProvider(JSON.stringify(d)).slice(0, 300);
  } catch { return ''; }
}

// A fal-confirmed failure means fal never billed us — ask the server to refund
// the charge (it independently re-verifies the failure with fal). Returns the
// refunded credit amount, and refreshes the balance display when it's non-zero.
// Cancel a possibly-stuck job THEN refund. A job wedged IN_QUEUE forever is
// never in a terminal state, so /api/refund (which only credits FAILED/ERROR/
// CANCELED) wouldn't refund it — cancelling first moves it to CANCELED so the
// refund can land (fal doesn't bill a cancelled-while-queued job).
async function cancelThenRefund(statusUrl) {
  if (!statusUrl) return 0;
  try {
    await apiFetch('/api/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: statusUrl.replace(/\/status\b.*$/, '/cancel') }),
    });
  } catch {}
  return requestRefund(statusUrl);
}
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
      '<h2 class="wm-title">Welcome to Go Farther</h2>' +
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

// The pricing page: three membership tiers (Plus/Pro/Max) + top-ups. Opened
// from the ✦ balance pill, storage/upgrade CTAs, and gallery gate. (The
// $19.99 Orchestrator add-on this once described was removed 2026-07-14.)
// `topupsOnly` opens the credit top-up view instead of the plan cards.
function openCredits(topupsOnly) {
  if (document.querySelector('.credits-overlay')) return;
  document.getElementById('profilePop')?.classList.remove('open'); // don't leave the menu open behind the overlay
  const ov = document.createElement('div');
  ov.className = 'credits-overlay' + (topupsOnly ? '' : ' up-overlay');
  // Full "Upgrade your plan" page: promo hero + three plan cards with feature
  // lists, modelled on the pricing mockup and kept in the Go Farther theme.
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
        // Already a member — refuse a second subscription (would double-bill).
        if (r.status === 409) { note.textContent = d.reason || 'You already have an active membership — manage it from Settings before changing plans.'; return; }
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

// Failures become a conversation: gofarther.dev explains what went wrong in plain
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
    // Defense in depth: the AI explainer is instructed never to name the
    // provider, but scrub its output anyway (one slipped through 2026-07-17,
    // naming fal + linking its billing dashboard).
    deliverAgent(origin, scrubProvider(data.reply));
    // The reworded prompt is written BY the model FROM the raw provider error,
    // so scrub it too before it lands in a review card (2026-07-17).
    if (data.prompt && chatStore.active === origin) reviewPrompt(scrubProvider(data.prompt));
    return true;
  } catch { return false; }
}

// A content-filter rejection after the job was accepted (the poll paths)
// still deserves the auto-reword: ask the error step for a fixedPrompt and
// pop it as an approval card in the ORIGIN chat. Quiet on purpose — the
// deterministic message (exact error + refund) has already been delivered,
// so data.reply is ignored; only the reworded prompt is offered.
async function offerReword(origin, kind, genPrompt, errBody) {
  try {
    const res = await apiFetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'error', kind, prompt: genPrompt,
        error: JSON.stringify(errBody || {}).slice(0, 700),
        ...directorContext(),
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.prompt) return;
    // Scrub — the rework is authored from the raw provider error (2026-07-17).
    const fixed = scrubProvider(String(data.prompt));
    deliverAgent(origin, '✍️ That wording tripped the content check — here it is reworded to pass, same idea. Approve to try again:');
    saveToChat(origin, { t: 'review', prompt: fixed, mode: kind, at: Date.now() });
    if (chatStore.active === origin) threadAppend(buildReviewCard(fixed, kind));
  } catch {}
}

// Turn fal/worker failures into human messages, ALWAYS carrying the exact
// upstream error (owner 2026-07-16: "show users the exact error") — the
// friendly line says what to do, the quote says precisely what happened.
function friendlyFail(job) {
  console.error('generation failed:', job);
  const raw = JSON.stringify(job || {});
  const exact = falErrorDetail(job);
  const withExact = (msg) => exact ? msg + ' (exact error: “' + exact + '”)' : msg;
  if (/daily limit/i.test(raw)) return "⚠️ You've hit today's generation limit — it resets within 24 hours.";
  if (/briefly paused|servers are temporarily down/i.test(raw)) return '⚠️ Our generation servers are temporarily down — we\'re working on it. Check back soon; you were not charged.';
  if (/exhausted balance|user is locked/i.test(raw)) return '⚠️ Our generation servers are temporarily down — we\'re working on it. Check back soon; you were not charged.';
  // Regional restriction (Gemini's edit endpoint blocks the EEA/UK/Switzerland
  // per its schema) — say what's wrong and point at a model that works.
  if (/European Economic Area|\bEEA\b|not available (?:for users )?in (?:your|the) (?:region|country)/i.test(raw)) return '⚠️ This model doesn’t offer video editing in your region — the model maker blocks it in the EU, UK and Switzerland.';
  if (/content|safety|nsfw|moderation/i.test(raw)) return withExact('⚠️ That prompt was blocked by the model’s content filter — rephrase it and try again.');
  if (/validation|invalid|must be|unprocessable/i.test(raw)) return withExact('⚠️ Those settings didn’t work for this model — tweak duration, ratio or quality and try again.');
  if (job && job.error === 'unknown model') return '⚠️ That model isn’t available right now — pick another from the menu.';
  return withExact('⚠️ Couldn’t start the generation — give it another try in a moment.');
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
  // The director can narrow an edit/combine to the images it actually uses:
  // "edit image 10" sends ONE image (in the director's reference order), not
  // the whole panel — smaller request, and an unrelated attachment can't get
  // the render refused. No selection → send everything, as before.
  let genImage = attachments.image || undefined;
  let genImages = extraImages.length ? extraImages.slice() : undefined;
  if (kind === 'image' && Array.isArray(genExtras.useImages) && genExtras.useImages.length) {
    const all = [attachments.image, ...extraImages].filter(Boolean);
    const picked = genExtras.useImages.map((n) => all[n - 1]).filter(Boolean);
    if (picked.length) { genImage = picked[0]; genImages = picked.length > 1 ? picked.slice(1) : undefined; }
  }
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
        image: genImage,
        images: genImages,
        avatar: attachments.avatar || undefined,
        end: attachments.end || undefined,
        first: attachments.ffirst || undefined, // Veo first-&-last-frame
        last: attachments.flast || undefined,
        refs: refList.length ? refList.slice() : undefined, // Veo reference-to-video
        elements: elList.length ? elList.slice() : undefined, // Kling @ElementN characters
        // Seedance extra references beyond slot #1 (@Video2-3 / @Audio2-3).
        extraClips: vxAllowed() && vxList.length ? vxList.map((x) => x.uri) : undefined,
        extraAudios: vxAllowed() && axList.length ? axList.map((x) => x.uri) : undefined,
        audio: attachments.audio || undefined,
        audioDuration: attachments.audio && awDur ? awDur : undefined, // lip-sync models bill by clip length
        clip: attachments.clip || undefined,
        clipDuration: attachments.clip && clipMeta && clipMeta.dur ? clipMeta.dur : undefined, // LipSync bills on the clip's length
        shots: genShots || undefined, // Kling multi_prompt shot-list (t2v, or i2v with start/end frames)
        mask: (kind === 'image' && maskCapable() && maskData) ? maskData : undefined, // GPT inpainting region
        size: (kind === 'image' && currentOpts().sizes) ? gptSize : undefined, // GPT resolution tier (1K/2K/4K)
        // false = silent render (cheaper on Veo/Seedance/Kling v3). The manual
        // Sound toggle wins; otherwise the director's inference rides along.
        sound: !soundOn && (currentOpts() || {}).sound ? false : undefined, // chatbox toggle only — never the director

        negative: genExtras.negative, // things to exclude (Kling v3 / Veo only)
        cfg: kind === 'video' ? genExtras.cfg : undefined, // Kling v3 prompt-adherence 0-1
        bitrate: kind === 'video' ? genExtras.bitrate : undefined, // Seedance 'high' encode (free)
        shotType: kind === 'video' ? genExtras.shotType : undefined, // Kling 'intelligent' auto-cuts
        stability: kind === 'audio' ? genExtras.stability : undefined, // voice delivery tuning
        speed: kind === 'audio' ? genExtras.speed : undefined,
        style: kind === 'audio' ? genExtras.style : undefined,

        duration: kind === 'video' && currentOpts().durations ? duration : undefined,
        ratio: currentOpts().ratios ? ratio : undefined,
        quality: currentOpts().resolutions ? quality : undefined, // video resolution OR image tier (Nano 2K/4K)
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
      jobClearByIdem(idem); // cancelled mid-submit — drop ONLY this provisional (a new run started in the same chat keeps its record)
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
      // Platform-balance / paused errors get the DETERMINISTIC message — the
      // AI explainer once rephrased them as "your account has run out of
      // credits" (owner 2026-07-17), which is false and steers users to buy
      // credits they don't need. Everything else may use the explainer.
      const rawErr = JSON.stringify(job || {});
      if (/briefly paused|servers are temporarily down|exhausted balance|user is locked/i.test(rawErr)) {
        deliverAgent(origin, friendlyFail(job));
      } else if (!(await explainFailure(origin, kind, text, job))) deliverAgent(origin, friendlyFail(job));
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
  const pollStart = Date.now(); // long IN_QUEUE stretches get an honest status line
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
            if (alive()) { endGen(origin); deliverAgent(origin, '⚠️ This render is no longer available — please try again.'); }
            return;
          }
          // Any other non-OK (proxy 502, upstream 5xx) is a transient tick, like
          // a network drop — count it so a JSON error body can't spin the loader
          // to the deadline.
          if (!alive()) return;
          if (++softErrors >= 15) { jobBumpTries(origin); pauseGen(origin); deliverAgent(origin, '⚠️ Lost the connection while this was rendering — it keeps going on our servers, and the app will pick it back up automatically.'); return; }
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
          deliverAgent(origin, '⚠️ Lost the connection while this was rendering — it keeps going on our servers, and the app will pick it back up automatically.');
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
        // A failed job's response endpoint carries fal's reason ({detail}) —
        // fetch it so the user sees the EXACT error, not a generic shrug
        // (owner 2026-07-16).
        let why = '', fb = {};
        try {
          const fr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(responseUrl));
          fb = await fr.json().catch(() => ({}));
          console.error('fal render failed:', state, fb);
          why = falErrorDetail(fb);
        } catch {}
        const refunded = await requestRefund(statusUrl); // fal didn't bill us — credit it back
        deliverAgent(origin, '⚠️ The model couldn\'t finish this generation'
          + (why ? ' — exact error: “' + why + '”' : '')
          + '. Please try again' + (kind === 'video' ? ', or tweak the prompt' : '') + '.'
          + (refunded > 0 ? ' Your ' + refunded + (refunded === 1 ? ' credit was' : ' credits were') + ' refunded.' : ''));
        // A content-filter kill can usually be reworded around — offer that.
        if (text && kind !== 'audio' && /content|safety|nsfw|moderation|flagged|checker/i.test(JSON.stringify(fb))) offerReword(origin, kind, text, fb);
        return;
      }
      myGen.model = label;
      setGenText(origin,
        state === 'IN_PROGRESS'
          ? theaterLine(myGen, kind)
          // A queue that hasn't moved in minutes usually means fal itself is
          // stalled (backed up, or the platform account is out of balance) —
          // say so honestly instead of an eternal "#0…" (owner 2026-07-17).
          : Date.now() - pollStart > 150_000
            ? 'Still queued — our render servers are unusually backed up right now. This keeps trying; if the render can\'t run you\'ll see the exact error and get your credits back.'
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
      deliverAgent(origin, '⚠️ Timed out after ' + maxWaitMin + ' minutes — the job may still finish on our servers; the app will pick it back up automatically.');
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
        const refundNote = refunded > 0 ? ' Your ' + refunded + (refunded === 1 ? ' credit was' : ' credits were') + ' refunded.' : '';
        // Gemini's opaque "could not generate with the given prompts and
        // images" = it refused the IMAGE BATCH (a flagged image — photos of
        // real people are the usual one — or too many/too heavy inputs).
        // Explain that instead of parroting the raw shrug (owner, 2026-07-16).
        if (/could not generate (images )?with the given prompts and images/i.test(JSON.stringify(errBody))) {
          deliverAgent(origin, '⚠️ The model refused this set of images rather than a specific mistake on your end. That usually means one of the attached pictures tripped its content check (photos of real people are the most common cause), or the batch was too heavy. Try again with only the image(s) this edit actually needs — and leave out photos of recognizable people. Nothing was produced.' + refundNote);
          return;
        }
        // Regional restriction (Gemini's edit endpoint is blocked in the
        // EEA/UK/Switzerland per its schema) — name the real cause + a fix.
        if (/European Economic Area|\bEEA\b|not available (?:for users )?in (?:your|the) (?:region|country)/i.test(JSON.stringify(errBody))) {
          deliverAgent(origin, '⚠️ Video editing with this model isn’t available in your region — the model maker blocks it in the EU, UK and Switzerland. Nothing was produced.' + refundNote);
          return;
        }
        deliverAgent(origin, '⚠️ The model rejected this render (' + rr.status + ')'
          + (why ? ' — ' + why : ' — the clip or prompt didn’t pass its input checks') + '. Nothing was produced'
          + (refunded > 0 ? '; your ' + refunded + (refunded === 1 ? ' credit was' : ' credits were') + ' refunded.' : '.'));
        // A content-filter rejection can usually be reworded around — offer that.
        if (text && kind !== 'audio' && /content|safety|nsfw|moderation|flagged|checker/i.test(JSON.stringify(errBody))) offerReword(origin, kind, text, errBody);
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
    if (!(await claimDelivery(statusUrl))) {
      // Another tab holds a FRESH claim — it's delivering now. Keep the record
      // and RESCHEDULE (autoResume) rather than pausing dead: if that tab was
      // actually a dying one (mid-deliver refresh), its claim goes stale within
      // 40s and the next resume tick takes it over instead of stranding the
      // charged render for an hour with no message (bug 2026-07-17).
      jobBumpTries(origin); pauseGen(origin, true); return;
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
          // Video/audio temp links go through the same-origin stream proxy so the
          // source host never appears in the player src (images ride a data: URL).
          const deliverUrl = marked || (kind === 'image' ? u : await proxyMediaUrl(u));
          finals.push(deliverUrl); blocked = block;
        }
        else { const disp = kind === 'image' ? u : await proxyMediaUrl(u); finals.push(disp); saveFailed = true; queuePendingSave(u, kind, disp); }
      }
      if (!alive()) return;
      endGen(origin);
      finals.forEach((f) => deliverMedia(origin, kind, f, text));
      if (blocked === 'free') deliverAgent(origin, 'ℹ️ Saving to your gallery is a paid feature — this one is a temporary link. Upgrade to keep your generations in the gallery.');
      else if (blocked === 'full') deliverAgent(origin, '⚠️ Your gallery storage is full, so this is a temporary link. Free up space in the gallery or move up a tier to keep saving.');
      else if (saveFailed) {
        deliverAgent(origin, '⏳ Still saving this to your gallery — big files can take a minute. It\'ll land there on its own.');
        scheduleSaveRetries(); // keep retrying IN this session, not just at next boot
      }
      // The inputs were consumed — clear them so they don't ride the next
      // prompt. Only when the user is still on this chat: a background finish
      // must not wipe attachments they've since staged in another chat.
      delete stagedByChat[origin]; // consumed — never restore stale inputs on switch-back
      stagedDbPut(origin, null);   // and never resurrect them after a refresh
      if (clearInputs && chatStore.active === origin) {
        Object.keys(attachments).forEach((k) => {
          if (attachments[k]) { attachments[k] = null; renderAttach(k); }
        });
        clipMeta = null; // stale metadata must not price/validate the next run
        extraImages.length = 0;
        renderExtraImages();
        refList.length = 0;
        elList.length = 0;
        // The Seedance reference extras (@Video2-3 / @Audio2-3) were consumed
        // too — clear them so they don't ride the NEXT prompt at the wrong
        // price tier (2026-07-17).
        vxList.length = 0;
        axList.length = 0;
        renderRefList();
        renderElList();
        renderVxList();
        renderAxList();
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

// ── Director flow (gofarther.dev) ───────────────────────────────────────────────
// Sonnet 5 drives the director via /api/direct. If the key isn't set (501)
// or the call fails, we fall back to these local placeholders so the flow
// still works.
// The last few chat turns, so the director remembers the conversation.
function directorHistory(chatId) {
  // Default: the open chat. A background director flow passes its ORIGIN chat
  // id so a mid-flight chat switch can't feed it another thread's history.
  const chat = chatId ? chatStore.chats.find((c) => c.id === chatId) : activeChat();
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

// ── Avatars + products cross-device sync (user_assets row, LWW like memory).
// Images are compacted before push (≤800px JPEG) so the row stays a payload,
// not a warehouse; the device that created an asset keeps its full-res copy
// locally until another device edits the collection. ──
const ASSETS_ENDPOINT = SUPABASE_URL + '/rest/v1/user_assets';
const ASSETS_AT_KEY = 'zephyr_assets_at_v1';
let assetsAt = 0; // when THIS device last changed avatars/products
try { assetsAt = +localStorage.getItem(ASSETS_AT_KEY) || 0; } catch {}
let assetsPushTimer = null;
function touchAssets() {
  assetsAt = Date.now();
  try { localStorage.setItem(ASSETS_AT_KEY, String(assetsAt)); } catch {}
  clearTimeout(assetsPushTimer);
  assetsPushTimer = setTimeout(pushAssets, 900);
}
// Only real image sources survive a sync round-trip into an <img> src.
const assetSrcOk = (s) => typeof s === 'string' && /^(data:image\/|https?:)/i.test(s) ? s : '';
async function compactAssetImage(src, edge = 800) {
  if (!assetSrcOk(src)) return '';
  if (!src.startsWith('data:')) return src.slice(0, 2000); // already a hosted URL — tiny to sync
  if (src.length < 220000) return src; // ≈160KB binary — small enough as-is
  try {
    const img = new Image();
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = src; });
    const scale = Math.min(1, edge / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.width * scale));
    cv.height = Math.max(1, Math.round(img.height * scale));
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.82);
  } catch { return src.length < 700000 ? src : ''; }
}
async function pushAssets() {
  const h = await syncHeaders();
  const uid = window.Auth && Auth.userId ? Auth.userId() : '';
  if (!h || !uid) return;
  try {
    const avatars = [];
    for (const a of loadAvatars().slice(0, 60)) {
      if (!a || !a.id) continue;
      avatars.push({ id: String(a.id), name: String(a.name || 'Avatar').slice(0, 80), image: await compactAssetImage(a.image) });
    }
    // Games are tiny {slug,url} pointers (the media lives in R2) — sync them in
    // the same row, no compaction needed.
    const games = gamesLoad().slice(0, 40)
      .map((g) => ({ slug: String(g && g.slug || '').slice(0, 80), url: String(g && g.url || '').slice(0, 200) }))
      .filter((g) => g.slug && g.url);
    const up = await fetch(ASSETS_ENDPOINT + '?on_conflict=user_id', {
      method: 'POST',
      headers: Object.assign({}, h, { Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ user_id: uid, avatars, games, updated_at: new Date(assetsAt || Date.now()).toISOString() }),
    });
    // A rejected upsert (expired token, RLS, 4xx) must retry — otherwise the
    // avatar edit silently never syncs cross-device (2026-07-17, mirrors
    // pushChats' requeue). Re-arm the debounced push.
    if (!up.ok) { clearTimeout(assetsPushTimer); assetsPushTimer = setTimeout(pushAssets, 8000); }
  } catch { clearTimeout(assetsPushTimer); assetsPushTimer = setTimeout(pushAssets, 8000); }
}
async function pullAssets() {
  const h = await syncHeaders();
  if (!h) return;
  try {
    const res = await fetch(ASSETS_ENDPOINT + '?select=avatars,games,updated_at&limit=1', { headers: h });
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) {
      // No server row yet — seed it from this device's existing collections,
      // so a plain refresh (no edit) is enough to start following the account.
      if (loadAvatars().length || gamesLoad().length) touchAssets();
      return;
    }
    const r = rows[0];
    const remoteAt = Date.parse(r.updated_at) || 0;
    if (remoteAt <= (assetsAt || 0)) return; // this device wrote more recently — LWW
    if (Array.isArray(r.avatars)) {
      const av = r.avatars.filter((a) => a && a.id)
        .map((a) => ({ id: String(a.id), name: String(a.name || 'Avatar').slice(0, 80), image: assetSrcOk(a.image) }))
        .slice(0, 60);
      try { localStorage.setItem(AVATARS_KEY, JSON.stringify(av)); } catch {}
    }
    if (Array.isArray(r.games)) {
      const gm = r.games.filter((g) => g && g.slug && g.url)
        .map((g) => ({ slug: String(g.slug).slice(0, 80), url: String(g.url).slice(0, 200) }))
        .slice(0, 40);
      try { localStorage.setItem(GAMES_KEY, JSON.stringify(gm)); } catch {}
    }
    assetsAt = remoteAt;
    try { localStorage.setItem(ASSETS_AT_KEY, String(remoteAt)); } catch {}
    // Repaint whichever page is on screen right now.
    try { const v = document.getElementById('viewAvatar'); if (v && v.classList.contains('active')) renderAvatar(); } catch {}
    try { if (document.body.classList.contains('in-games')) renderGames(); } catch {}
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
    imageCount: mode === 'image'
      ? ((attachments.image ? 1 : 0) + extraImages.length)
      // Video reference runs: the director must know it's looking at N refs,
      // not "a start image" (it used to compose around refList[0] only).
      : mode === 'video' && !attachments.image && !attachments.ffirst && refList.length > 1
        ? refList.length
        : undefined,
    // Every attachment the director can't render as an image (video clip,
    // avatar face, audio track) still gets flagged so the orchestrator KNOWS
    // it's there — never denies seeing it, and writes for the actual inputs.
    hasClip: mode === 'video' && !!attachments.clip,
    // Seedance multi-reference counts so the director cites @Video1..N/@Audio1..N.
    vidRefCount: mode === 'video' && vxAllowed() && attachments.clip && vxList.length ? 1 + vxList.length : undefined,
    audRefCount: mode === 'video' && vxAllowed() && attachments.audio && axList.length ? 1 + axList.length : undefined,
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
// APPROVES that prompt (so abandoned drafts never teach Go Farther anything).
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
  // NOTE (owner rule, 2026-07-17): the chatbox settings are authoritative —
  // the director must never override anything the user can set there. Sound
  // has a chatbox toggle, so a director-returned sound:false is IGNORED
  // (this also strips it from review cards persisted before the rule).
  // Everything below has no chatbox control and stays director-drivable.
  if (typeof data.negative === 'string' && data.negative.trim()) out.negative = data.negative.trim().slice(0, 300);
  const num = (v, lo, hi) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : null);
  const stab = num(data.stability, 0, 1), spd = num(data.speed, 0.7, 1.2), sty = num(data.style, 0, 1);
  if (stab != null) out.stability = stab;
  if (spd != null) out.speed = spd;
  if (sty != null) out.style = sty;
  // Which attached images the composed prompt actually uses (1-based panel
  // numbers, reference order) — "edit image 10" then sends ONE image, not all.
  if (Array.isArray(data.useImages)) {
    const total = (attachments.image ? 1 : 0) + extraImages.length;
    const sel = [...new Set(data.useImages.map((n) => Math.round(+n)).filter((n) => Number.isFinite(n) && n >= 1 && n <= total))].slice(0, 16);
    if (sel.length) out.useImages = sel;
  }
  // Video knobs (all price-neutral; the worker re-validates every one):
  // cfg → Kling v3 prompt adherence · bitrate → Seedance high-bitrate encode ·
  // shotType → Kling auto-directed cuts.
  if (typeof data.cfg === 'number' && Number.isFinite(data.cfg)) out.cfg = Math.min(1, Math.max(0, data.cfg));
  if (data.bitrate === 'high') out.bitrate = 'high';
  if (data.shotType === 'intelligent') out.shotType = 'intelligent';
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
  if (attachments.clip || attachments.avatar) return false;
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

// The director gets to SEE the attached images (downscaled — it only needs to
// understand the pictures, not generate from them). ALL of them, in panel
// order (1 = main, 2..N = extras): it used to get only image 1, so "edit
// image 5" was confidently planned against the wrong picture.
async function directorImage() {
  if (mode === 'audio') return {};
  const srcs = mode === 'image'
    ? [attachments.image, ...extraImages].filter(Boolean)
    // Video: a start/first frame is a single image; a REFERENCE run sends
    // every ref so the director can see (and cite) each one — it used to see
    // only refList[0] and compose around that single subject.
    : (attachments.image || attachments.ffirst)
      ? [attachments.image || attachments.ffirst]
      : refList.length
        ? refList.slice(0, 9)
        : [elList[0]].filter(Boolean);
  if (!srcs.length) return {};
  // Downscale harder as the count grows — understanding needs far fewer
  // pixels than generating, and 14 originals would blow the request budget.
  const edge = srcs.length > 6 ? 512 : srcs.length > 2 ? 640 : 1024;
  const out = [];
  for (const src of srcs.slice(0, 16)) {
    try {
      const img = new Image();
      await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = src; });
      const scale = Math.min(1, edge / Math.max(img.width, img.height));
      if (scale === 1 && src.length < 900000) { out.push(src); continue; }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      out.push(canvas.toDataURL('image/jpeg', 0.85));
    } catch {}
  }
  if (!out.length) return {};
  return out.length === 1 ? { image: out[0] } : { images: out };
}

async function directorAsk(text, history, onDelta, snap) {
  // Voice mode goes through the director too — it decides whether this is
  // chat ("hey", "how are you") or words to speak. Composing stays literal.
  try {
    const res = await apiFetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'ask', kind: snap ? snap.kind : mode, prompt: text, history: history || [], stream: true,
        qmode: directorMode, // tells the worker which prompt-help mode is active
        prevPrompt: snap ? snap.prev : (activeChat() || {}).lastPrompt || undefined,
        ...(snap ? snap.ctx : directorContext()), ...(snap ? snap.img : await directorImage()),
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
          if (ev.d && onDelta) onDelta(scrubProvider(ev.d));
          if (ev.done) final = ev.done;
          if (ev.error) throw 0;
        }
      }
      if (!final) throw 0;
      // Taste learned from the conversation commits immediately — chat has no
      // approval gate (unlike compose, which waits for the user to run it).
      if (Array.isArray(final.memory)) commitMemory(final.memory);
      return {
        reply: scrubProvider(final.reply || ''),
        ready: !!final.ready,
        rerun: !!final.rerun,
        revise: !!final.revise,
        needsWeb: !!final.needsWeb,
      };
    }
    const data = await res.json();
    if (Array.isArray(data.memory)) commitMemory(data.memory);
    return {
      reply: scrubProvider(data.reply || ''),
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

async function directorCompose(text, answers, webFacts, origin, snap) {
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
        step: 'compose', kind: snap ? snap.kind : mode, prompt: text, answers: answers.filter(Boolean),
        webFacts: webFacts || undefined,
        history: directorHistory(origin), ...(snap ? snap.ctx : directorContext()), ...(snap ? snap.img : await directorImage()),
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
  } catch { return (snap ? snap.kind : mode) === 'audio' ? text : localCompose(text, answers); }
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
  // Snapshot everything the pipeline needs from THIS chat's composer state
  // before the first await — if the user switches chats mid-think, the flow
  // keeps going on this snapshot instead of reading the other chat's globals.
  // (directorAsk awaited directorImage() itself before; same cost, done once.)
  const snap = {
    kind: mode,
    prev: (activeChat() || {}).lastPrompt || undefined,
    ctx: directorContext(),
    img: await directorImage(),
  };
  const thinking = addMsg('agent typing', 'gofarther.dev is thinking');
  // gofarther.dev's reply is delivered through the normal path when the call ends,
  // which types it out word-by-word (like every other agent message).
  let res;
  try { res = await directorAsk(text, history, null, snap); } finally { thinking.remove(); }
  // gofarther.dev's conversational reply (greetings, small talk, or a lead-in).
  if (res.reply) deliverAgent(origin, res.reply);
  // The user moved to another chat while gofarther.dev was thinking: a creative
  // request still gets composed in the background (the finished card lands in
  // this chat, waiting for approval). Rerun/revise anchor on the live chat's
  // last prompt, so those stop here rather than act on the wrong thread.
  if (chatStore.active !== origin) {
    if (res.ready) composeAndReview(text, [], res.needsWeb, origin, snap);
    return;
  }
  // The director read the message as "run that again": the last prompt was
  // already approved once — straight back into generation, no re-interview.
  if (res.rerun && (activeChat() || {}).lastPrompt) {
    // For an edit (clip/image attached), never replay the stored prompt: it can
    // be a stale, oversized from-scratch treatment (e.g. saved before edits
    // switched to short instructions, or from a run that failed). Re-compose it
    // into a fresh SHORT edit instruction instead of dredging the old one up.
    if (isEditMode()) {
      if (!res.reply) deliverAgent(origin, '🔁 Giving it another go.');
      composeAndReview(activeChat().lastPrompt, [], false, origin, snap);
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
  if (res.ready) composeAndReview(text, [], res.needsWeb, origin, snap);
  // Otherwise (greeting / small talk): the reply alone is the whole turn.
}

async function composeAndReview(text, answers, needsWeb, origin, snap) {
  origin = origin || chatStore.active;
  // A typing indicator belongs only in the origin thread — when the user has
  // already moved to another chat, the work carries on invisibly instead.
  const typingIf = (label) => (chatStore.active === origin ? addMsg('agent typing', label) : null);
  // Web-search first when the request depends on current real-world facts
  // (latest products, real specs) — the director's needsWeb judgment alone
  // decides; there's no user toggle. Failures degrade to no facts.
  let webFacts = '';
  if (needsWeb) {
    const looking = typingIf('Looking it up on the web');
    let research = { facts: '', sources: [] };
    try { research = await directorResearch(text, origin, snap); } finally { if (looking) looking.remove(); }
    webFacts = research.facts || '';
    if (research.sources && research.sources.length) {
      const names = [...new Set(research.sources
        .map((s) => { try { return new URL(s.url).hostname.replace(/^www\./, ''); } catch { return s.title || 'source'; } }))]
        .slice(0, 3);
      deliverAgent(origin, '🔎 Checked the web — ' + names.join(', '));
    }
  }
  const thinking = typingIf('Writing the prompt');
  let prompt;
  try { prompt = await directorCompose(text, answers, webFacts, origin, snap); } finally { if (thinking) thinking.remove(); }
  if (chatStore.active === origin) { deliverPrompt(prompt); return; }
  // The user switched chats while the prompt was being written. Don't throw
  // the work away — persist an approval card into the ORIGIN chat (both
  // modes: Auto must not fire a billed generation against another chat's
  // composer state), so switching back shows it ready to run.
  const cardBrief = pendingBrief, cardMemory = pendingMemory, cardShots = pendingShots, cardExtras = pendingExtras;
  pendingBrief = null; pendingMemory = null; pendingShots = null; pendingExtras = null;
  saveToChat(origin, {
    t: 'review', prompt: String(prompt), mode: snap ? snap.kind : mode, at: Date.now(),
    brief: cardBrief || undefined, memory: cardMemory || undefined,
    shots: cardShots || undefined, extras: cardExtras || undefined,
  });
}

// Live web search: gathers current real-world facts for the prompt writer.
// Returns { facts, sources }; on any failure returns empties so compose runs.
async function directorResearch(text, origin, snap) {
  try {
    const res = await apiFetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'research', kind: snap ? snap.kind : mode, prompt: text,
        history: directorHistory(origin), ...(snap ? snap.ctx : directorContext()),
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
  // which discounts Veo/Kling), not the (now-cleared) input. The price is LIVE:
  // approval runs with whatever settings are active at click time, so re-quote
  // on every settings change (updateSendPrice calls _reprice) — otherwise the
  // shown ✦N could differ from what's charged (bug 2026-07-17). A user mode
  // switch drops the card entirely, so this only ever re-prices in mode `m`.
  allow._reprice = () => { allow.textContent = 'Generate ' + (estimatePrice(m === 'audio' ? prompt : undefined, shots, extras && extras.sound) || '✦'); };
  allow._reprice();
  deny.onclick = () => { clearReviews(prompt); actions.remove(); label.textContent = 'Denied — tweak it and send again.'; document.getElementById('input').focus(); };
  allow.onclick = () => {
    // One generation per chat — if the previous run is still going, keep the
    // card live so the prompt isn't silently swallowed by the busy guard.
    if (activeGens.has(chatStore.active)) {
      label.textContent = "Still finishing the last one — approve again in a moment.";
      return;
    }
    // The card was composed WITH a shot list but the CURRENT model can't run
    // shots (user switched off Kling after the card was built) — don't silently
    // collapse it to a single render (2026-07-17). Re-evaluate shotsApply
    // against the live model, not the card's build-time `shots`.
    if (sanitizeShots(cardShots) && !shotsApply(model)) {
      label.textContent = 'This shot list only runs on a Kling model — switch back to Kling to keep the shots, or deny and send again.';
      return;
    }
    clearReviews(prompt); // just THIS card — a second pending card stays
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
// Drop pending review card(s) from the active chat so a later re-render doesn't
// resurrect them. With `onlyPrompt`, remove ONLY the matching card — approving
// or denying one card must not wipe a second pending card (e.g. the auto-reword
// offer after a content-filter failure) (2026-07-17). No arg → clear all (used
// on a mode switch, which invalidates every card).
function clearReviews(onlyPrompt) {
  const c = activeChat(); if (!c) return;
  const before = c.msgs.length;
  c.msgs = c.msgs.filter((mm) => mm.t !== 'review' || (onlyPrompt != null && mm.prompt !== onlyPrompt));
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
  // LipSync and Seedance audio refs (see AUDIO_LIMITS).
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
  // Reflect every credit spend as it happens: the orchestrator (/api/direct),
  // each generation (/api/video|image|audio), and the builder's message router
  // (/api/site/route), which debits before it answers exactly like /api/direct.
  // Exact-match so the polling and save endpoints (/api/video/poll, /api/save)
  // don't trigger a refresh; 501 = the feature isn't configured, so nothing was
  // charged.
  //
  // THE BUILD ROUTES ARE DELIBERATELY ABSENT, and the reason is not the one this
  // comment gave when it was written ("they stream their own balance back") —
  // they do not, and nothing on that path called setCredits at all. The real
  // reason is timing: this fires when the response HEADERS arrive, which on an
  // NDJSON build is when the build STARTS. The charge lands after publish,
  // minutes later, so a refresh here reads the balance before anything was taken
  // and paints a number that is wrong in the reassuring direction. `reactSend`
  // and the legacy path call `scheduleCreditRefresh` once the stream is done.
  const p = path.split('?')[0];
  if (res.status !== 501 &&
      (p === '/api/direct' || p === '/api/video' || p === '/api/image' || p === '/api/audio' ||
       p === '/api/site/route')) {
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

// Wordmark → back to the landing page (owner 2026-07-16), in its signed-in
// form when a session exists: profile pill top-right stays live, and the
// landing chatbox drops back into the studio. Nothing in the app is lost —
// chats/attachments keep their state behind the (inert) shell.
function goLanding() {
  try { stampComposer(); } catch (e) {}
  try { if (Auth.email && Auth.email()) enterLandingAuthed(); } catch (e) {}
  showMarketing();
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
  // Coming BACK to the landing (the wordmark): the browser paused the
  // autoplay loops while the page was hidden and won't resume them on its
  // own — only a fresh load autoplays. Re-kick every cell that isn't playing.
  if (mkt) mkt.querySelectorAll('video').forEach((v) => { if (v.paused) v.play().catch(() => {}); });
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
  // A mid-session 401 pops the gate via showAuthGate() directly, so authEntry
  // is still 'stay' — but if a DIFFERENT account just signed in, routing to the
  // landing skips the account-switch wipe (only enterApp does it), leaving the
  // previous account's in-memory chats/avatars to be shown AND synced under the
  // new account. Force the full-reset path whenever the owner changed.
  let switched = false;
  try {
    const uid = Auth.userId ? Auth.userId() : '';
    const prev = localStorage.getItem('zephyr_owner_v1');
    switched = !!(uid && prev && prev !== uid);
  } catch {}
  if (authEntry === 'app' || switched) enterApp();
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
  in:    { creds: 'Sign in to gofarther.dev',   code: 'Check your email' },
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
  // Reveal the app shell (hidden by default in the HTML so it never flashes
  // behind the landing on a fresh load). This is the single authed entry point.
  const shell = document.querySelector('.shell');
  if (shell) shell.style.display = '';
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
        [STORE_KEY, OLD_STORE_KEY, JOBS_KEY, SAVES_KEY, CHAT_TOMB_KEY, MEMORY_KEY, DELIVERED_KEY, ASSETS_AT_KEY, 'zephyr_studio_v1', 'zephyr_avatars_v1', 'zephyr_products_v1', 'zephyr_games_v1', CRED_MAX_KEY, WELCOME_KEY]
          .forEach((k) => localStorage.removeItem(k));
      } catch {}
      stagedDbClear(); // staged attachments belong to the outgoing account too
      chatStore = { active: null, chats: [] };
      memoryState = { items: [], enabled: true, updatedAt: 0 };
      // The avatar-sync clock lives in memory too — reset it, else the new
      // account's pullAssets bails (remoteAt <= stale assetsAt) and their first
      // edit clobbers the server row with this device's empty avatars.
      assetsAt = 0;
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
  // A website brief from the landing's WEBSITE channel goes to the standalone
  // builder instead (its VIEW_KEY was already pointed at 'sites' on submit —
  // this kicks the first build with the typed brief).
  if (pendingSiteBrief) { const b = pendingSiteBrief; pendingSiteBrief = null; showView('sites'); siteCreate(b); }
  // Signed in — pull the account's chats, universal memory, and the synced
  // avatars/products, merge all of them.
  pullChats();
  pullMemory();
  pullAssets();
  fetchCredits();
  // Pick up any generation that was mid-flight when the tab last closed,
  // and re-copy any media whose gallery save failed.
  resumeJobs();
  retryPendingSaves();
  // Land back on the view the user was on before the refresh (Builder for a
  // fresh session or anything unknown).
  let lastView = 'home';
  try { lastView = localStorage.getItem(VIEW_KEY) || 'home'; } catch {}
  const KNOWN_VIEWS = ['home', 'gallery', 'avatar', 'mediaAgent', 'sites', 'games', 'integrations', 'settings'];
  showView(KNOWN_VIEWS.includes(lastView) ? lastView : 'home');
  // Staged attachments from before the refresh — re-apply the active chat's,
  // and garbage-collect expired/orphaned stashes in the background.
  try { hydrateStaged(chatStore.active); stagedDbSweep(); } catch (e) {}
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
  // Sign-out used to discard in-flight/paused render records with no refund.
  // Best-effort credit-back for any un-delivered charged job BEFORE the wipe
  // (auth is still valid; the server only credits jobs that didn't run)
  // (2026-07-17). Bounded so sign-out stays snappy.
  try {
    const pending = jobsLoad().filter((j) => j.statusUrl).slice(0, 8);
    await Promise.all(pending.map((j) => requestRefund(j.statusUrl).catch(() => {})));
  } catch {}
  try {
    [STORE_KEY, OLD_STORE_KEY, JOBS_KEY, SAVES_KEY, CHAT_TOMB_KEY, MEMORY_KEY, DELIVERED_KEY, ASSETS_AT_KEY, 'zephyr_owner_v1', 'zephyr_studio_v1', 'zephyr_avatars_v1', 'zephyr_products_v1', 'zephyr_games_v1', CRED_MAX_KEY, WELCOME_KEY]
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  assetsAt = 0; // reset the in-memory avatar-sync clock too (see account-switch note)
  if (typeof sbMediaClear === 'function') { try { await sbMediaClear(); } catch {} } // drop stored imports
  try { await stagedDbClear(); } catch {} // staged attachments (IndexedDB) go too
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
          '<a class="sp-item sp-tap" href="mailto:support@gofarther.dev?subject=Go%20Farther%20support&body=' +
            encodeURIComponent('\n\n—\nAccount: ' + email + ' · Go Farther ' + APP_VERSION) + '">' +
            '<span class="sp-item-l"><span class="sp-item-t">Contact support</span>' +
            '<span class="sp-item-s">support@gofarther.dev</span></span>' +
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
        if (note) note.textContent = 'Couldn’t cancel just now — email support@gofarther.dev and we’ll sort it.';
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
    if (!confirm('Delete your Go Farther account? This permanently removes your chats, saved media and remaining credits.')) return;
    if (!confirm('Last check — this cannot be undone. Delete everything?')) return;
    btn.disabled = true;
    try {
      // Cancel any live Stripe subscription FIRST, while the account still
      // exists (billing/cancel needs auth). Deleting without this leaves the
      // membership billing monthly forever on a gone account. Immediate =
      // end it now, all subs. If Stripe genuinely can't cancel, STOP — better
      // to leave the account than to keep charging a deleted user.
      try {
        const cr = await apiFetch('/api/billing/cancel', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: true, immediate: true }),
        });
        if (cr.status !== 501) { // 501 = payments not configured → nothing to cancel
          const cd = await cr.json().catch(() => ({}));
          // Abort the delete ONLY on a real cancel failure. active:false (no
          // sub) and cancelled:true both mean "safe to proceed".
          if (!cr.ok || cd.error === 'cancel_failed') {
            btn.disabled = false;
            alert('Couldn’t cancel your membership just now, so we didn’t delete the account (you shouldn’t keep being billed). Try again in a moment.');
            return;
          }
        }
      } catch (ce) {
        btn.disabled = false;
        alert('Couldn’t reach billing to cancel your membership — the account wasn’t deleted so you’re not billed again. Try again in a moment.');
        return;
      }
      // WIPE EVERY BUILT SITE FIRST, while the account still exists — and stop if
      // that fails. `site_backends.uid` cascades with `auth.users`, so once the
      // account goes the ownership rows go with it and `DELETE /api/site/<slug>`
      // answers 404 by design; the site keeps serving at a public URL and nothing
      // is left that can authorise taking it down. That is the orphan state only
      // an operator can clear.
      //
      // THIS USED TO CALL `/api/site/backend/delete-all`, WHICH HAS NEVER EXISTED.
      // The 404 was swallowed as best-effort and the account was deleted anyway,
      // so every published site of every deleted account is still up. The slug
      // list it posted was read by nothing — and would have been wrong anyway,
      // since a site built on another device is not in this browser's storage.
      // The server reads the caller's own rows now.
      const dr = await apiFetch('/api/site/delete-all', { method: 'POST' });
      const dj = await dr.json().catch(() => null);
      if (!dr.ok || !dj || dj.ok !== true) {
        // NOT best-effort any more. Deleting the account over a half-finished
        // sweep is unrecoverable — there is no second chance at those sites.
        btn.disabled = false;
        const left = (dj && Array.isArray(dj.failed) && dj.failed.length) ? dj.failed.join(', ') : '';
        alert("Couldn't take your published sites down" + (left ? ' (' + left + ')' : '') +
          ", so your account was NOT deleted — otherwise those sites would stay online with no way to remove them. Try again in a moment.");
        return;
      }
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

// ── Avatar: talking-avatar workspace. Empty state offers "Generate with AI"
// or "Import"; imported/saved avatars show in a grid (zephyr_avatars_v1). ──
const AVATARS_KEY = 'zephyr_avatars_v1';
function avUid() { return 'av_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function loadAvatars() { try { return JSON.parse(localStorage.getItem(AVATARS_KEY) || '[]'); } catch { return []; } }
function saveAvatars(list) {
  try { localStorage.setItem(AVATARS_KEY, JSON.stringify(list.slice(0, 60))); touchAssets(); return true; }
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
  // One layout, mirroring the Products page (owner's pick, design 1,
  // 2026-07-16): headline top-left + subtitle + one action row, and the
  // saved avatars in a grid UNDERNEATH — same as products under their bar.
  view.innerHTML =
    '<div class="av-page">' +
      '<div class="pr-head"><h1>Create your avatar</h1>' +
        '<p>A consistent face for your videos — generate one with AI or import your own portrait.</p></div>' +
      '<div class="av-start">' +
        '<button type="button" class="av-start-gen" data-act="generate">✦ Generate with AI</button>' +
        '<span class="pr-or">or</span>' +
        '<button type="button" class="pr-manual" data-act="import">⬆ Import a photo</button>' +
      '</div>' +
      (avatars.length ? '<div class="av-grid">' + avatars.map((a) =>
        '<div class="av-card" data-id="' + esc(a.id) + '">' +
          (a.image ? '<div class="av-thumb"><img class="img-fade" src="' + esc(a.image) + '" alt="" loading="lazy" decoding="async" /></div>' : '<div class="av-thumb av-thumb-ph">🧑</div>') +
          '<button class="av-del" data-id="' + esc(a.id) + '" aria-label="Remove">✕</button>' +
          '<div class="av-name">' + esc(a.name || 'Avatar') + '</div>' +
        '</div>').join('') + '</div>' : '') +
    '</div>';
  view.querySelectorAll('[data-act="generate"]').forEach((b) => { b.onclick = () => { avatarMode = 'create'; renderAvatar(); }; });
  view.querySelectorAll('[data-act="import"]').forEach((b) => { b.onclick = () => importAvatar(); });
  view.querySelectorAll('.av-del').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); saveAvatars(loadAvatars().filter((a) => a.id !== b.dataset.id)); renderAvatar(); }; });
  // Click a saved avatar → full-size lightbox (same viewer as chat media).
  // Fade-in wired HERE, not as an inline onload= attribute — the CSP has no
  // 'unsafe-inline' for scripts, so inline handlers never run in production
  // (an inline version left avatars invisible at opacity 0).
  view.querySelectorAll('.av-card .av-thumb img').forEach((img) => {
    img.style.cursor = 'zoom-in';
    img.onclick = () => openLightbox('image', img.getAttribute('src'));
    img.addEventListener('load', () => img.classList.add('img-ready'), { once: true });
    if (img.complete && img.naturalWidth) img.classList.add('img-ready');
  });
}

function importAvatar() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const image = await downscaleImage(f, 720);
    const list = loadAvatars();
    list.unshift({ id: avUid(), name: (f.name || 'Avatar').replace(/\.[^.]+$/, '').slice(0, 60), image, at: Date.now() });
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
// Show a finished avatar in the preview stage (with the full-size lightbox
// click) — used by acGenerate and by rebuild-preservation below.
function acShowResult(stage, url) {
  stage.classList.remove('ac-empty', 'ac-loading');
  stage.innerHTML = '<img class="ac-result img-fade" src="' + esc(url) + '" alt="Your avatar" title="Click to view full size" decoding="async" />';
  const img = stage.querySelector('.ac-result');
  if (img) {
    img.style.cursor = 'zoom-in'; img.onclick = () => openLightbox('image', url);
    // addEventListener, never an inline onload= — the CSP blocks inline handlers.
    img.addEventListener('load', () => img.classList.add('img-ready'), { once: true });
    if (img.complete && img.naturalWidth) img.classList.add('img-ready');
  }
}

function renderAvatarCreator(view) {
  // The Builder re-renders on gender picks and on Reset (both swap the section
  // set). That must never wipe a freshly generated avatar out of the preview
  // stage — capture it and restore it after the rebuild.
  const prevResult = (() => {
    const img = document.querySelector('#acPreview .ac-result');
    return img ? img.getAttribute('src') : null;
  })();
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
          (src ? '<img class="ab-img-photo" src="' + esc(src) + '" alt="" loading="lazy" />' : '') +
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
  // A missing preview photo hides itself, revealing the colored placeholder.
  // Wired here (addEventListener), never inline onerror= — the CSP has no
  // 'unsafe-inline' for scripts, so inline handlers silently never run.
  view.querySelectorAll('.ab-img-photo').forEach((img) => {
    img.addEventListener('error', () => img.remove(), { once: true });
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) img.remove();
  });
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
  if (prevResult) acShowResult(view.querySelector('#acPreview'), prevResult);
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
    // Register the charged render so a refresh/tab-close mid-poll doesn't strand
    // the credit — boot-resume (resumeJobs) + the sign-out sweep recover or
    // refund it. Cleared in `finally` when this in-page loop resolves normally.
    jobRecord(AVATAR_JOB_ID, { avatar: true, statusUrl: job.status_url, responseUrl: job.response_url, at: Date.now() });
    // Poll fal until the render completes (avatars are quick — 5 min ceiling).
    const deadline = Date.now() + 5 * 60 * 1000;
    let state = '';
    while (Date.now() < deadline) {
      const sr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(job.status_url));
      if (sr.ok) {
        const st = await sr.json().catch(() => ({}));
        state = st.status || '';
        if (state === 'COMPLETED') break;
        // Terminal failure — stop, surface the reason, refund (avatars have no
        // resume machinery, so an un-refunded credit is gone) (bug 2026-07-17).
        if (state === 'FAILED' || state === 'ERROR' || state === 'CANCELED' || state === 'CANCELLED') {
          let why = '';
          try {
            const fr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(job.response_url));
            const fb = await fr.json().catch(() => ({}));
            why = typeof falErrorDetail === 'function' ? scrubProvider(falErrorDetail(fb) || '') : '';
          } catch (e) {}
          const refunded = await requestRefund(job.status_url);
          fail('That avatar couldn’t be generated' + (why ? ' — ' + why : '') + '.'
            + (refunded > 0 ? ' Your ' + refunded + (refunded === 1 ? ' credit was' : ' credits were') + ' refunded.' : '')
            + ' Please try again.');
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 3500));
    }
    if (state !== 'COMPLETED') {
      const refunded = await requestRefund(job.status_url); // never received — credit back
      fail('Timed out — please try again.' + (refunded > 0 ? ' Your ' + refunded + (refunded === 1 ? ' credit was' : ' credits were') + ' refunded.' : ''));
      return;
    }
    const rr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(job.response_url));
    const out = await rr.json().catch(() => ({}));
    const imgs = ((out.images || (out.data && out.data.images) || []).map((im) => im && im.url).filter(Boolean));
    let url = imgs[0] || (out.image && out.image.url) || '';
    if (!url) { fail('No image came back — please try again.'); return; }
    // Copy to permanent storage (fal URLs expire); fall back to the temp link.
    let finalUrl = url, saveBlock = null;
    try { const saved = await saveOutput(url, 'image'); if (saved && saved.url) finalUrl = saved.url; else if (saved) saveBlock = saved.block; } catch (e) {}
    if (avatarMode !== 'create') return; // user navigated away mid-render
    acShowResult(stage, finalUrl);
    // Couldn't store a permanent copy (free/lapsed/full, or a save error) — the
    // avatar sits on a temporary link that expires within days. Tell the user
    // (it used to rot silently, on this device AND the synced copies) (2026-07-17).
    if (saveBlock && typeof sbToast === 'function') {
      sbToast(saveBlock === 'free' || saveBlock === 'full'
        ? 'Heads up — keeping avatars permanently needs a paid plan with gallery space. This one is on a temporary link that expires soon; regenerate after upgrading to keep it.'
        : 'Heads up — couldn’t save a permanent copy just now, so this avatar is on a temporary link that may expire. Try regenerating in a moment.');
    }
    // Persist it so it shows in the avatar grid.
    const list = loadAvatars();
    list.unshift({ id: avUid(), name: 'Avatar', image: finalUrl, at: Date.now() });
    saveAvatars(list);
  } catch (e) {
    fail('Network hiccup — please try again.');
  } finally {
    // This loop resolved in-page (success/fail/timeout) — the render no longer
    // needs recovery. (A refresh mid-poll skips this, leaving the record for
    // boot-resume.)
    jobClear(AVATAR_JOB_ID);
    acBusy = false;
    if (genBtn) { genBtn.disabled = false; genBtn.innerHTML = '<span class="ac-gen-t">Generate avatar</span><span class="ac-gen-cost">' + avatarCost() + '</span>'; }
  }
}
// Recover an avatar render abandoned by a refresh: if fal finished it, save the
// avatar; otherwise cancel + refund the credit. (Avatars aren't delivered to a
// chat, so they can't ride resumeOne's chat-delivery path.)
async function resumeAvatarJob(j) {
  try {
    let state = '';
    if (j.statusUrl) {
      const sr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(j.statusUrl));
      if (sr.ok) { const st = await sr.json().catch(() => ({})); state = st.status || ''; }
    }
    if (state === 'COMPLETED' && j.responseUrl) {
      const rr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(j.responseUrl));
      const out = await rr.json().catch(() => ({}));
      const imgs = ((out.images || (out.data && out.data.images) || []).map((im) => im && im.url).filter(Boolean));
      const url = imgs[0] || (out.image && out.image.url) || '';
      if (url) {
        let finalUrl = url;
        try { const saved = await saveOutput(url, 'image'); if (saved && saved.url) finalUrl = saved.url; } catch (e) {}
        const list = loadAvatars();
        list.unshift({ id: avUid(), name: 'Avatar', image: finalUrl, at: Date.now() });
        saveAvatars(list);
        return;
      }
    }
    // Not completed (stuck/failed/abandoned) → cancel + refund the credit.
    await cancelThenRefund(j.statusUrl);
  } catch (e) {}
}

// ── Memory: universal auto-learned taste is a SYSTEM feature with no
// front-end — no button, no page. It learns and applies silently (see the
// memory store above and directorContext().memory). ──


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
// Scheduled posts — FRONTEND ONLY for now (no backend wired): the queue lives in
// localStorage per browser and nothing is actually published. Wiring the publish
// side (Composio create-post at the scheduled time) is a later backend task.
const SCHED_KEY = 'zephyr_ig_scheduled_v1';
let igScheduled = null;    // lazy-loaded array of scheduled-post records
let schMedia = null;       // media staged in the open composer { url, thumb, kind, name }
let schCalMonth = null;    // { y, m } month the calendar is showing
let schSelDay = null;      // 'YYYY-MM-DD' day selected in the calendar (or null)
const IG_SECTIONS = [
  { key: 'analytics', label: 'Analytics' },
  { key: 'posts', label: 'Posts' },
  { key: 'schedule', label: 'Schedule post' },
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
  if (maSec === 'schedule') { renderSchedule(body); return; }
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
    '<defs><linearGradient id="agL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1e1e22"/><stop offset="1" stop-color="#0b0b0e"/></linearGradient>' +
    '<linearGradient id="agF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0b0e" stop-opacity=".18"/><stop offset="1" stop-color="#0b0b0e" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + area + '" fill="url(#agF)"/>' +
    '<path d="' + line + '" fill="none" stroke="url(#agL)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="' + xs(last).toFixed(1) + '" cy="' + ys(vals[last]).toFixed(1) + '" r="4" fill="#0b0b0e"/></svg>';
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

// ── Schedule post (Instagram) — FRONTEND ONLY ────────────────────────────────
// Compose a post + pick a date/time; it lands in a local queue. Nothing is
// published yet — the backend (create-post at the scheduled time) is a later
// task. The queue persists per browser in localStorage.
function loadScheduled() {
  if (igScheduled) return igScheduled;
  try { const raw = JSON.parse(localStorage.getItem(SCHED_KEY) || '[]'); igScheduled = Array.isArray(raw) ? raw : []; }
  catch { igScheduled = []; }
  return igScheduled;
}
function saveScheduled() {
  try { localStorage.setItem(SCHED_KEY, JSON.stringify((igScheduled || []).slice(0, 100))); } catch (e) {}
}
// "Jul 4, 2026 · 3:30 PM" from an ISO/local datetime string.
function schWhen(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  try { return new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch { return ''; }
}
// A default datetime-local value ~1 hour out, floored to the minute, for the picker.
function schDefaultWhen() {
  const d = new Date(Date.now() + 3600_000);
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
function renderSchedule(body) {
  // Two columns: the composer on the left, a month calendar of the scheduled
  // posts on the right. (Still frontend-only — the calendar reads the local
  // queue; nothing publishes.)
  const compose =
    '<div class="ma-publish" id="schCompose">' +
      '<div class="ma-pub-head">' +
        '<span class="ma-pub-title">Schedule a post</span>' +
        '<span class="sch-flag">Preview · not published yet</span>' +
      '</div>' +
      '<div class="ma-pub-body">' +
        '<label class="ma-pub-l">Media</label>' +
        '<div class="pub-preview" id="schPreview"></div>' +
        '<div class="pub-pick">' +
          '<button type="button" class="ma-btn ma-btn-off pub-pick-btn" id="schFileBtn">📁 Choose from computer</button>' +
          '<button type="button" class="ma-btn ma-btn-off pub-pick-btn" id="schGal">🖼 From gallery</button>' +
        '</div>' +
        '<input type="file" id="schFile" accept="image/*,video/*" style="display:none">' +
        '<label class="ma-pub-l">Type</label>' +
        '<select id="schType" class="ma-pub-in">' +
          '<option value="image">Image post</option>' +
          '<option value="video">Reel / video</option>' +
        '</select>' +
        '<label class="ma-pub-l">Caption</label>' +
        '<textarea id="schCaption" class="ma-pub-ta ma-pub-in" placeholder="Caption (optional)"></textarea>' +
        '<label class="ma-pub-l">When</label>' +
        '<input type="datetime-local" id="schWhen" class="ma-pub-in" value="' + schDefaultWhen() + '">' +
        '<div class="ma-pub-foot">' +
          '<button type="button" class="ma-btn ma-btn-on ma-pub-submit" id="schSubmit">📅 Schedule post</button>' +
          '<div class="ma-pub-res ma-pub-res-busy" id="schRes" style="display:none"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  body.innerHTML =
    '<div class="sch-wrap">' +
      '<div class="sch-left">' + compose + '</div>' +
      '<div class="sch-right"><div class="scal" id="schCal"></div></div>' +
    '</div>';
  schMedia = null;

  const fileBtn = document.getElementById('schFileBtn');
  const fileIn = document.getElementById('schFile');
  if (fileBtn && fileIn) {
    fileBtn.onclick = () => fileIn.click();
    fileIn.onchange = () => { if (fileIn.files && fileIn.files[0]) schPickFile(fileIn.files[0]); };
  }
  const galBtn = document.getElementById('schGal');
  if (galBtn) galBtn.onclick = () => openPubGalleryPicker(false, schSelectGalleryMedia);
  const sub = document.getElementById('schSubmit');
  if (sub) sub.onclick = () => schSubmit(body);
  paintSchCal();
}
// ── The scheduled-posts calendar (right column) ──
function schDayKey(d) { const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
function schTime(iso) { const t = Date.parse(iso); if (!Number.isFinite(t)) return ''; try { return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } catch { return ''; } }
// Compact time for the tight calendar chips: "9am", "6:30pm", "12pm".
function schTimeShort(iso) { const t = Date.parse(iso); if (!Number.isFinite(t)) return ''; const d = new Date(t); let h = d.getHours(); const m = d.getMinutes(); const ap = h < 12 ? 'am' : 'pm'; h = h % 12 || 12; return h + (m ? ':' + String(m).padStart(2, '0') : '') + ap; }
function schDayLabel(key) { const t = Date.parse(key + 'T00:00'); if (!Number.isFinite(t)) return key; try { return new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); } catch { return key; } }
// Group the local queue by local day → { 'YYYY-MM-DD': [post, …] }.
function schPostsByDay() {
  const map = {};
  loadScheduled().forEach((it) => { const t = Date.parse(it.when); if (!Number.isFinite(t)) return; const k = schDayKey(new Date(t)); (map[k] = map[k] || []).push(it); });
  return map;
}
function paintSchCal() {
  const host = document.getElementById('schCal');
  if (!host) return;
  if (!schCalMonth) { const n = new Date(); schCalMonth = { y: n.getFullYear(), m: n.getMonth() }; }
  const { y, m } = schCalMonth;
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayKey = schDayKey(new Date());
  const byDay = schPostsByDay();
  const title = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const dows = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => '<span class="scal-dow">' + d + '</span>').join('');
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<span class="scal-cell scal-empty"></span>';
  for (let day = 1; day <= daysInMonth; day++) {
    const key = schDayKey(new Date(y, m, day));
    const posts = byDay[key] || [];
    const chips = posts.slice(0, 2).map((p) => {
      const th = p.thumb
        ? '<span class="scal-chip-th" style="background-image:url(' + esc(p.thumb) + ')"></span>'
        : '<span class="scal-chip-th scal-chip-th-none">' + (p.kind === 'video' ? '🎬' : '🖼') + '</span>';
      return '<span class="scal-chip">' + th + '<span class="scal-chip-t">' + esc(schTimeShort(p.when)) + '</span></span>';
    }).join('');
    const more = posts.length > 2 ? '<span class="scal-more">+' + (posts.length - 2) + '</span>' : '';
    cells += '<button type="button" class="scal-cell' + (key === todayKey ? ' today' : '') + (key === schSelDay ? ' sel' : '') + (posts.length ? ' has' : '') + '" data-day="' + key + '">' +
      '<span class="scal-n">' + day + '</span>' +
      (posts.length ? '<span class="scal-chips">' + chips + more + '</span>' : '') +
      '</button>';
  }
  host.innerHTML =
    '<div class="scal-head">' +
      '<button type="button" class="scal-nav" data-nav="-1" aria-label="Previous month">‹</button>' +
      '<span class="scal-title">' + esc(title) + '</span>' +
      '<button type="button" class="scal-nav" data-nav="1" aria-label="Next month">›</button>' +
    '</div>' +
    '<div class="scal-dows">' + dows + '</div>' +
    '<div class="scal-grid">' + cells + '</div>' +
    schDayPanel();
  host.querySelectorAll('[data-nav]').forEach((b) => b.onclick = () => {
    let mm = schCalMonth.m + Number(b.dataset.nav), yy = schCalMonth.y;
    if (mm < 0) { mm = 11; yy--; } if (mm > 11) { mm = 0; yy++; }
    schCalMonth = { y: yy, m: mm };
    paintSchCal();
  });
  host.querySelectorAll('[data-day]').forEach((b) => b.onclick = () => {
    schSelDay = schSelDay === b.dataset.day ? null : b.dataset.day;
    paintSchCal();
  });
  host.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => schRemovePost(b.dataset.rm));
}
// The selected day's posts, listed under the grid with a remove ×.
function schDayPanel() {
  if (!schSelDay) return '';
  const posts = (schPostsByDay()[schSelDay] || []).slice().sort((a, b) => Date.parse(a.when) - Date.parse(b.when));
  if (!posts.length) return '';
  const items = posts.map((p) => {
    const thumb = p.thumb
      ? '<span class="scal-thumb" style="background-image:url(' + esc(p.thumb) + ')"></span>'
      : '<span class="scal-thumb scal-thumb-none">' + (p.kind === 'video' ? '🎬' : '🖼') + '</span>';
    const cap = p.caption ? esc(p.caption) : '<span class="sch-nocap">No caption</span>';
    return '<div class="scal-item">' + thumb +
        '<div class="scal-item-meta"><div class="scal-item-cap">' + cap + '</div>' +
          '<div class="scal-item-sub">' + esc(schTime(p.when)) + ' · ' + (p.kind === 'video' ? 'Reel' : 'Image') + '</div></div>' +
        '<button type="button" class="sch-del" data-rm="' + esc(p.id) + '" title="Remove" aria-label="Remove scheduled post">×</button>' +
      '</div>';
  }).join('');
  return '<div class="scal-day"><div class="scal-day-h">' + esc(schDayLabel(schSelDay)) + '</div>' + items + '</div>';
}
function schRemovePost(id) {
  igScheduled = loadScheduled().filter((it) => it.id !== id);
  saveScheduled();
  paintSchCal();
}
// Stage a device-chosen file LOCALLY (no upload) — image → a small thumb for
// the preview + queue; video → an icon (thumbs would bloat localStorage).
async function schPickFile(file) {
  const kind = (file.type || '').startsWith('video') ? 'video' : 'image';
  const prev = document.getElementById('schPreview');
  const typeSel = document.getElementById('schType');
  if (typeSel) typeSel.value = kind;
  if (prev) { prev.classList.add('on'); prev.innerHTML = '<div class="pub-preview-load">Reading…</div>'; }
  let thumb = '';
  if (kind === 'image') { try { thumb = await downscaleImage(file, 400); } catch (e) {} }
  schMedia = { url: '', thumb, kind, name: file.name || '' };
  if (prev) {
    prev.classList.add('on');
    prev.innerHTML = thumb
      ? '<img src="' + esc(thumb) + '" alt="">'
      : '<div class="sch-urlprev">🎬 ' + esc(file.name || 'video') + '</div>';
  }
}
// A picked Go Farther-gallery item (already a hosted URL) → stage it + preview. The
// URL doubles as the thumb for images; a video uses its poster if there is one.
function schSelectGalleryMedia(it) {
  const kind = it.kind === 'video' ? 'video' : 'image';
  schMedia = { url: it.url, thumb: kind === 'video' ? (it.poster || '') : it.url, kind, name: '' };
  const typeSel = document.getElementById('schType');
  if (typeSel) typeSel.value = kind;
  const prev = document.getElementById('schPreview');
  if (prev) {
    prev.classList.add('on');
    const src = kind === 'video' ? (it.poster || it.url) : it.url;
    prev.innerHTML = '<img src="' + esc(src) + '" alt="">' +
      (kind === 'video' ? '<span class="sch-prev-k">REEL</span>' : '');
  }
}
function schSubmit(body) {
  const res = document.getElementById('schRes');
  const show = (msg, cls) => { if (!res) return; res.style.display = ''; res.className = 'ma-pub-res ' + (cls || 'ma-pub-res-busy'); res.textContent = msg; };
  const whenRaw = (document.getElementById('schWhen') || {}).value || '';
  const when = Date.parse(whenRaw);
  if (!schMedia || (!schMedia.thumb && !schMedia.url && schMedia.kind !== 'video')) { show('Add media first — choose a file or pick from your gallery.', 'ma-pub-res-warn'); return; }
  if (!Number.isFinite(when)) { show('Pick a date and time.', 'ma-pub-res-warn'); return; }
  if (when < Date.now()) { show('Pick a time in the future.', 'ma-pub-res-warn'); return; }
  const caption = ((document.getElementById('schCaption') || {}).value || '').trim().slice(0, 2200);
  const kind = (document.getElementById('schType') || {}).value || schMedia.kind || 'image';
  loadScheduled().push({
    id: 'sch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    kind,
    caption,
    thumb: schMedia.thumb || '',
    url: schMedia.url || '',
    name: schMedia.name || '',
    when: new Date(when).toISOString(),
    createdAt: Date.now(),
  });
  saveScheduled();
  // Confirm inline, reset the composer, and surface the new post on the calendar
  // (jump to its month + select its day so it's visible right away).
  show('Scheduled for ' + schWhen(new Date(when).toISOString()) + '.', 'ma-pub-res-ok');
  const wd = new Date(when);
  schCalMonth = { y: wd.getFullYear(), m: wd.getMonth() };
  schSelDay = schDayKey(wd);
  paintSchCal();
  schMedia = null;
  const cap = document.getElementById('schCaption'); if (cap) cap.value = '';
  const prev = document.getElementById('schPreview'); if (prev) { prev.classList.remove('on'); prev.innerHTML = ''; }
  const fileIn = document.getElementById('schFile'); if (fileIn) fileIn.value = '';
  const dt = document.getElementById('schWhen'); if (dt) dt.value = schDefaultWhen();
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
function openPubGalleryPicker(videoOnly, onPick) {
  const pick = typeof onPick === 'function' ? onPick : pubSelectMedia;
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
    cell.onclick = () => { pick(it); ov.remove(); };
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
    else agentMsgs.push({ role: 'assistant', content: scrubProvider(d.reply) });
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
  // The AI models menu. It OPENS on hover via CSS, so there is nothing to wire
  // for that — this fills it once and keeps aria-expanded honest.
  fillModelsMenu();
  wireModelsMenu();
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
  const closeAuth = () => {
    pendingFirstMsg = null;
    // Backing out of a WEBSITE-channel signup must not strand the NEXT login
    // in the sites view — drop the brief and point the boot view back home.
    pendingSiteBrief = null;
    pendingGameBrief = null;
    try { if (localStorage.getItem(VIEW_KEY) === 'sites' || localStorage.getItem(VIEW_KEY) === 'games') localStorage.setItem(VIEW_KEY, 'home'); } catch (e) {}
    hideAuthGate(); showMarketing();
  };
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
  // Click ripple on primary buttons — a white ink expands from the tap point.
  if (!window.__rippleWired) {
    window.__rippleWired = true;
    const RIPPLE = '.send, .st-sendc, .st-publish, .crt-chatbox-send, .st-data-add, .st-data-save';
    const reduceRipple = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.addEventListener('pointerdown', (e) => {
      if (reduceRipple) return;
      const btn = e.target.closest && e.target.closest(RIPPLE);
      if (!btn || btn.disabled) return;
      const r = btn.getBoundingClientRect();
      const d = Math.max(r.width, r.height);
      const ink = document.createElement('span');
      ink.className = 'ripple-ink';
      ink.style.width = ink.style.height = d + 'px';
      ink.style.left = (e.clientX - r.left - d / 2) + 'px';
      ink.style.top = (e.clientY - r.top - d / 2) + 'px';
      btn.appendChild(ink);
      ink.addEventListener('animationend', () => ink.remove());
    }, { passive: true });
  }
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
  const kind = sel && sel.dataset.kind;
  // GAME and WEBSITE are real standalone builders — their chatbox is active and
  // Enter opens the respective builder, so they must NOT read as coming-soon.
  const builder = kind === 'game' || kind === 'website';
  const live = !sel || sel.dataset.live === '1';
  const active = live || builder;
  if (box) box.classList.toggle('crt-chatbox-soon', !active);
  if (inp) inp.placeholder = kind === 'game'
    ? 'Describe a game — press Enter and Go Farther builds it →'
    : kind === 'website'
      ? 'Describe a website or app — press Enter and Go Farther builds it →'
      : live
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
  if (panel === 'game') {
    stage.querySelectorAll('.lp-arc-slot[data-src]').forEach((s) => {
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
  // WEBSITE / MOBILE APP is the ONLY door into the standalone Website Builder
  // (owner 2026-07-18) — selecting it routes there, never the media studio.
  if (opt.dataset.kind === 'website') {
    try { localStorage.setItem(VIEW_KEY, 'sites'); } catch (e) {}
    if (window.Auth && Auth.isSignedIn()) { enterApp(); return; }
    if (typeof openAuthFrom === 'function') openAuthFrom('start', 'app');
    return;
  }
  // GAME is the door into the standalone Game Studio — its own screen, never the
  // media studio (mirrors the WEBSITE channel above).
  if (opt.dataset.kind === 'game') {
    try { localStorage.setItem(VIEW_KEY, 'games'); } catch (e) {}
    if (window.Auth && Auth.isSignedIn()) { enterApp(); return; }
    if (typeof openAuthFrom === 'function') openAuthFrom('start', 'app');
    return;
  }
  if (opt.dataset.live === '1') {
    try { if (localStorage.getItem(VIEW_KEY) === 'sites') localStorage.setItem(VIEW_KEY, 'home'); } catch (e) {}
    if (window.Auth && Auth.isSignedIn()) { enterApp(); return; }   // already in → straight to the studio
    if (typeof openAuthFrom === 'function') openAuthFrom('start', 'app');  // picked a channel → into the studio
  }
  // coming-soon channels already show the NO SIGNAL preview via paintCrt — no-op
}
// Build the preview stage once: filmstrip columns, voice wave, website cascade.
function initCrtStage() {
  const stage = document.getElementById('leadStage');
  if (!stage) return;
  // Minimal landing hides the media wall — skip building/loading it entirely.
  if (getComputedStyle(stage).display === 'none') return;
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
    // The channel list is hidden on the minimal landing — don't hijack the
    // chatbox's arrow keys or tune a menu the visitor can't see.
    if (!menu || menu.offsetParent === null) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); crtMove(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); crtMove(-1); }
    else if ((e.key === 'Enter' || e.key === ' ') && document.activeElement === menu) { e.preventDefault(); crtSelect(); }
  };
  document.addEventListener('keydown', onKey);

  // The two doors above the chatbox. Same three lines the channel list uses, and
  // deliberately so: the view is stashed under VIEW_KEY *before* the gate opens,
  // because a signed-out visitor comes back through boot rather than through
  // this handler, and boot is what reads it. Signed in, there is no gate to
  // wait for and enterApp() takes them straight there.
  const door = (id, view) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      try { localStorage.setItem(VIEW_KEY, view); } catch (err) {}
      if (window.Auth && Auth.isSignedIn()) { enterApp(); return; }
      if (typeof openAuthFrom === 'function') openAuthFrom('start', 'app');
    });
  };
  door('doorVideo', 'home');   // the media studio — video, image, voice
  door('doorApp', 'sites');    // the site builder

  // Landing chatbox: let the visitor type freely; only funnel into the sign-up
  // popup when they commit (Enter) or hit the send arrow — not on tap/focus.
  const landInput = document.getElementById('crtLandInput');
  const landSend = document.getElementById('crtLandSend');
  const landBox = document.getElementById('crtChatbox');
  const submitLand = () => {
    const sel = document.querySelectorAll('#crtMenu .crt-opt')[crtSel];
    // WEBSITE channel: the typed text is a site brief for the standalone
    // Website Builder — never a media prompt (owner 2026-07-18).
    if (sel && sel.dataset.kind === 'website') {
      const b = (landInput && landInput.value.trim()) || '';
      if (b) pendingSiteBrief = b;
      try { localStorage.setItem(VIEW_KEY, 'sites'); } catch (e) {}
      if (window.Auth && Auth.isSignedIn()) { enterApp(); return; }
      if (typeof openAuthFrom === 'function') openAuthFrom('start', 'app');
      return;
    }
    // GAME channel: the typed text is a game brief for the standalone Game
    // Studio — never a media prompt (mirrors the WEBSITE branch above).
    if (sel && sel.dataset.kind === 'game') {
      const b = (landInput && landInput.value.trim()) || '';
      if (b) pendingGameBrief = b;
      try { localStorage.setItem(VIEW_KEY, 'games'); } catch (e) {}
      if (window.Auth && Auth.isSignedIn()) { enterApp(); return; }
      if (typeof openAuthFrom === 'function') openAuthFrom('start', 'app');
      return;
    }
    // Only the live channel (Video/Image/Voice) generates. On a coming-soon
    // channel the chatbox is inert — Enter does nothing.
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

// ── Website Builder — a SEPARATE product with its own UI. The only thing it
// shares with the media builder is the ✦ credit ledger (owner, 2026-07-18).
// FRONTEND ONLY for now: projects + the chat/preview loop live locally; the
// real build engine (top-tier AI, keys pending) wires in later via its own
// /api route. Until then Generate renders a clearly-labeled SAMPLE page so the
// whole flow is testable end to end. Note for the engine phase: generated
// sites preview via iframe srcdoc, which inherits the app CSP — inline CSS is
// allowed but inline <script> is NOT, so JS-bearing sites will need a serving
// route with a relaxed CSP (the /mkt/demo* pattern).
const SITES_KEY = 'zephyr_sites_v1';
let sitesCache = null;
let siteOpenId = null;      // project open in the workspace (null → project list)
let siteDevice = 'desktop'; // preview viewport: desktop | tablet | phone
let siteBusy = false;       // a build/revision is "running" (sample: brief delay)
let siteAbort = null;       // AbortController for the in-flight build/revise (Stop)
let siteBuildMsg = '';      // live streamed build step ("Designing 3 pages…") shown while busy
let siteBuild = null;       // { phase, pages[], done[], tick } — running build activity log
let siteTicker = null;      // setInterval handle rotating the active "live" line
let siteView = 'preview';   // workspace stage: preview | code | more | data
let siteMoreTab = 'analytics'; // More sub-nav: analytics | cloud | security | seo
let siteDataTable = '';     // Data panel: which table is open
let siteDataForm = null;    // Data panel: the add/edit row form ({editId, values}) when open
let siteRail = 'chat';      // left rail: chat | history
let siteRailHidden = false; // collapse the chat rail to give the preview full width
let siteErr = null;         // { chatId } → show the "Try to fix" card over the preview
// Images the owner attached for the next build/revise (logo / reference). Sent to
// the builder, which hosts them + shows them to the generator's vision.
let siteAttach = [];
// Attach button → ask the source first: a device file, or one of the user's own
// gallery creations (saved image generations).
function siteAttachOpen() {
  if (siteAttach.length >= 3) { if (typeof sbToast === 'function') sbToast('Up to 3 attachments.'); return; }
  let box = document.getElementById('stAttachChoose');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'stAttachChoose';
  box.className = 'si-modal';
  box.innerHTML = '<div class="si-card" style="width:min(420px,96vw)"><div class="si-head"><b>Add an attachment</b><button type="button" class="si-x" aria-label="Close">×</button></div>' +
    '<div class="si-body"><div class="stac-opts">' +
      '<button type="button" class="stac-opt" id="stacDevice">' + ic('image', 24) + '<span><b>From device</b><small>An image, a PDF menu or price list, a document</small></span></button>' +
      '<button type="button" class="stac-opt" id="stacGallery">' + ic('grid', 24) + '<span><b>From your gallery</b><small>Pick one of your saved creations</small></span></button>' +
    '</div></div></div>';
  document.body.appendChild(box);
  const close = () => box.remove();
  box.querySelector('.si-x').onclick = close;
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  box.querySelector('#stacDevice').onclick = () => { close(); siteAttachDevice(); };
  box.querySelector('#stacGallery').onclick = () => { close(); siteAttachGallery(); };
}
function siteAttachDevice() {
  if (siteAttach.length >= 3) { if (typeof sbToast === 'function') sbToast('Up to 3 attachments.'); return; }
  const inp = document.createElement('input');
  // NO `accept` FILTER. People attach whatever they have — a menu PDF, a promo
  // clip, a price list — and a picker that hides those files answers the
  // question before they ask it. Each kind is handled (or honestly refused) in
  // siteAttachFiles; the browser dialog's job is only to let them choose.
  inp.type = 'file'; inp.multiple = true;
  inp.onchange = () => { siteAttachFiles(inp.files); };
  inp.click();
}
// Fetch a gallery image (hosted URL) → data URL for the builder. Fetches as a
// blob (Supabase public bucket is CORS-open) so the canvas is never tainted;
// only downscales when the file would blow the 5 MB attach cap.
async function galleryUrlToData(url, edge = 1600, cap = 4500000) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return '';
    const blob = await resp.blob();
    const toData = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(''); r.readAsDataURL(b); });
    if (blob.size <= cap) return await toData(blob);
    const objUrl = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = objUrl; });
      const scale = Math.min(1, edge / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(img.width * scale));
      cv.height = Math.max(1, Math.round(img.height * scale));
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      return cv.toDataURL('image/jpeg', 0.85);
    } finally { URL.revokeObjectURL(objUrl); }
  } catch { return ''; }
}
async function siteAttachGallery() {
  const remaining = 3 - siteAttach.length;
  if (remaining <= 0) { if (typeof sbToast === 'function') sbToast('Up to 3 attachments.'); return; }
  let box = document.getElementById('stAttachGal');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'stAttachGal';
  box.className = 'si-modal';
  box.innerHTML = '<div class="si-card" style="width:min(720px,96vw)"><div class="si-head"><b>Your gallery</b><button type="button" class="si-x" aria-label="Close">×</button></div>' +
    '<div class="si-body"><div id="stgGrid" class="stg-grid"><div class="stg-empty">Loading…</div></div></div>' +
    '<div class="stg-foot"><span class="stg-hint">Pick up to ' + remaining + '</span><span style="flex:1"></span><button type="button" class="st-attbtn" id="stgCancel">Cancel</button><button type="button" class="stg-add" id="stgAdd" disabled>Add</button></div></div>';
  document.body.appendChild(box);
  const close = () => box.remove();
  box.querySelector('.si-x').onclick = close;
  box.querySelector('#stgCancel').onclick = close;
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  if (!Array.isArray(serverGallery)) { try { await loadServerGallery(); } catch (e) {} }
  const imgs = (typeof galleryItems === 'function' ? galleryItems() : []).filter((i) => i.kind === 'image');
  const grid = box.querySelector('#stgGrid');
  const addBtn = box.querySelector('#stgAdd');
  if (!imgs.length) { grid.innerHTML = '<div class="stg-empty">No images in your gallery yet. Generate some in the image generator, then they show up here.</div>'; return; }
  const sel = new Set();
  grid.innerHTML = imgs.map((it, i) => '<button type="button" class="stg-cell" data-i="' + i + '"><img src="' + it.url + '" alt="" loading="lazy"><span class="stg-check">✓</span></button>').join('');
  const sync = () => { addBtn.disabled = sel.size === 0; addBtn.textContent = sel.size ? ('Add ' + sel.size) : 'Add'; };
  grid.querySelectorAll('.stg-cell').forEach((c) => {
    c.onclick = () => {
      const i = +c.dataset.i;
      if (sel.has(i)) { sel.delete(i); c.classList.remove('sel'); }
      else { if (sel.size >= remaining) { if (typeof sbToast === 'function') sbToast('You can add ' + remaining + ' more.'); return; } sel.add(i); c.classList.add('sel'); }
      sync();
    };
  });
  sync();
  addBtn.onclick = async () => {
    addBtn.disabled = true; addBtn.textContent = 'Adding…';
    for (const i of sel) {
      if (siteAttach.length >= 3) break;
      const data = await galleryUrlToData(imgs[i].url);
      if (data) siteAttach.push({ data, name: 'gallery.jpg' });
      else if (typeof sbToast === 'function') sbToast('Couldn’t load one of the images.');
    }
    paintAttachStrip();
    close();
  };
}
// A video frame, so a clip is worth something instead of nothing.
//
// THE MODEL CANNOT WATCH VIDEO — the API has no video content block, in any
// encoding. But a still from the clip carries most of what a reference video was
// attached FOR: the palette, the type, the look of the place. So the browser
// takes one here and sends an image.
//
// Plain <video> + canvas rather than the ffmpeg engine that ships for the QR
// burn: this is a seek and a drawImage, and loading a WASM build to do it would
// cost more than the feature. A codec the browser cannot decode (HEVC in a .mov
// is the common one) rejects, and the attachment is reported as unusable rather
// than dropped.
function videoPoster(file, edge = 1400) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    let settled = false;
    const done = (fn, arg) => { if (settled) return; settled = true; try { URL.revokeObjectURL(url); } catch (e) {} fn(arg); };
    // A clip whose metadata never arrives would otherwise hang the attach strip
    // on a spinner with no end.
    const timer = setTimeout(() => done(reject, new Error('timeout')), 12000);
    v.preload = 'metadata'; v.muted = true; v.playsInline = true;
    v.onerror = () => { clearTimeout(timer); done(reject, new Error('decode')); };
    v.onloadeddata = () => {
      // A second in, or the midpoint of a short clip — the first frame of a
      // video is very often black or a fade-in, which is the one frame that
      // says nothing about the design.
      const t = Math.min(1, (v.duration || 2) / 2);
      const grab = () => {
        try {
          const w = v.videoWidth, h = v.videoHeight;
          if (!w || !h) throw new Error('no frame');
          const k = Math.min(1, edge / Math.max(w, h));
          const c = document.createElement('canvas');
          c.width = Math.round(w * k); c.height = Math.round(h * k);
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          clearTimeout(timer);
          done(resolve, c.toDataURL('image/jpeg', 0.86));
        } catch (e) { clearTimeout(timer); done(reject, e); }
      };
      if (Math.abs(v.currentTime - t) < 0.05) { grab(); return; }
      v.onseeked = grab;
      try { v.currentTime = t; } catch (e) { grab(); }
    };
    v.src = url;
  });
}

// An image the API does not take (HEIC from an iPhone, AVIF, BMP) re-encoded to
// PNG by the browser. Only works when the browser can decode it in the first
// place — which for HEIC it usually cannot outside Safari — so the failure path
// matters as much as the success one.
function imageToPng(file, edge = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = (fn, arg) => { try { URL.revokeObjectURL(url); } catch (e) {} fn(arg); };
    img.onerror = () => done(reject, new Error('decode'));
    img.onload = () => {
      try {
        const k = Math.min(1, edge / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        done(resolve, c.toDataURL('image/png'));
      } catch (e) { done(reject, e); }
    };
    img.src = url;
  });
}

const NATIVE_IMAGE = /^image\/(png|jpe?g|webp|gif)$/;
// Read as words rather than shipped as bytes. A .txt IS the thing the model
// needs; base64-ing it to un-base64 it server-side would be ceremony. Matched on
// the extension as well as the type, because a .md or a .csv routinely arrives
// with an empty or wrong `type` from the OS.
const TEXTISH = /\.(txt|md|markdown|csv|tsv|json|yml|yaml|html?|xml|rtf)$/i;

const readAs = (file, how) => new Promise((resolve, reject) => {
  const rd = new FileReader();
  rd.onload = () => resolve(rd.result);
  rd.onerror = () => reject(new Error('read'));
  rd[how](file);
});

// Turn whatever was picked into something the builder can use — or into an
// honest note that it could not. Every branch resolves; nothing is dropped in
// silence, because a file somebody deliberately attached going missing without
// a word is the failure this whole change exists to fix.
async function siteAttachOne(f) {
  const name = f.name || 'attachment';
  const type = String(f.type || '').toLowerCase();
  try {
    if (NATIVE_IMAGE.test(type)) {
      if (f.size > 5 * 1024 * 1024) return { name, type, note: 'too large' };
      return { name, data: await readAs(f, 'readAsDataURL') };
    }
    if (type === 'application/pdf' || /\.pdf$/i.test(name)) {
      if (f.size > 3.5 * 1024 * 1024) return { name, type, note: 'too large' };
      return { name, data: await readAs(f, 'readAsDataURL') };
    }
    if (type.startsWith('video/')) {
      // Sent as an IMAGE, and labelled so the chat can say what happened —
      // "used a frame from it" is a different sentence from "used it".
      return { name, data: await videoPoster(f), frameOf: name };
    }
    if (type.startsWith('image/')) return { name, data: await imageToPng(f) };
    if (type.startsWith('text/') || type === 'application/json' || TEXTISH.test(name)) {
      if (f.size > 400 * 1024) return { name, type, note: 'too large' };
      return { name, text: String(await readAs(f, 'readAsText') || '') };
    }
  } catch (e) {
    // A decode that failed still travels: the server turns `type` into the
    // sentence the customer reads.
    return { name, type };
  }
  return { name, type };
}

function siteAttachFiles(fileList) {
  const files = Array.from(fileList || []).slice(0, 3 - siteAttach.length);
  if (!files.length) return;
  let pending = files.length;
  files.forEach((f) => {
    siteAttachOne(f).then((a) => {
      if (siteAttach.length < 3) siteAttach.push(a);
      if (a && a.note === 'too large' && typeof sbToast === 'function') sbToast(a.name + ' is too large to attach.');
      if (--pending === 0) paintAttachStrip();
    });
  });
}
// Repaint the thumbnail strip in place (both composers share id="stAttach") — no
// full re-render, so the textarea the user is typing in is never reset.
function paintAttachStrip() {
  document.querySelectorAll('#stAttach').forEach((el) => {
    // A thumbnail when there IS a picture; a named chip otherwise. Rendering
    // `<img src="undefined">` for a PDF or a text file paints a broken-image
    // icon, which reads as "your file failed" for one that is about to be used.
    el.innerHTML = siteAttach.map((a, i) => '<div class="st-att' + (a.data ? '' : ' st-att-doc') + '">' +
      (a.data ? '<img src="' + a.data + '" alt="">' : '<span class="st-att-name">' + esc(a.name || 'file') + '</span>') +
      '<button type="button" class="st-att-x" data-att="' + i + '" aria-label="Remove">×</button></div>').join('');
    el.querySelectorAll('[data-att]').forEach((b) => b.onclick = () => { siteAttach.splice(+b.dataset.att, 1); paintAttachStrip(); });
  });
}
// Runtime errors caught in the live preview, keyed `siteId|path`. Populated by
// postMessage from the preview's error shim; drives the "Fix with AI" badge.
let sitePreviewErrs = {};
function previewErrKey() { const s = siteById(siteOpenId); return s ? (s.id + '|' + (s.active || '/')) : ''; }
function collectPreviewErr(err) {
  const key = previewErrKey(); if (!key) return;
  const msg = String(err && err.msg || '').trim(); if (!msg) return;
  const list = sitePreviewErrs[key] || (sitePreviewErrs[key] = []);
  if (list.length >= 6 || list.some((x) => x.msg === msg)) return;
  list.push({ msg, info: String((err && err.info) || '') });
  paintPreviewErrBadge();
}
// Update the badge in place (NOT via renderSites — that would reload the iframe
// and re-trigger the errors). Errors arrive async, a moment after the preview loads.
function paintPreviewErrBadge() {
  const bar = document.getElementById('stFixBar'); if (!bar) return;
  const list = sitePreviewErrs[previewErrKey()] || [];
  if (!list.length || siteView !== 'preview') { bar.hidden = true; return; }
  const n = list.length;
  const label = bar.querySelector('.st-fixbar-n'); if (label) label.textContent = n + ' issue' + (n === 1 ? '' : 's') + ' detected';
  bar.hidden = false;
}
function sitesLoad() {
  if (sitesCache) return sitesCache;
  try { const raw = JSON.parse(localStorage.getItem(SITES_KEY) || '[]'); sitesCache = Array.isArray(raw) ? raw : []; }
  catch { sitesCache = []; }
  return sitesCache;
}
function sitesSave() {
  const build = (withHist) => (sitesCache || []).slice(0, 20).map((s) => ({
    ...s,
    html: (s.html || '').slice(0, 400000),
    pages: Array.isArray(s.pages) ? s.pages.slice(0, 6).map((p) => ({ path: p.path, name: p.name, html: (p.html || '').slice(0, 400000) })) : undefined,
    msgs: (s.msgs || []).slice(-40),
    // Version history (for restore). Best-effort: dropped first if storage is tight.
    history: (withHist && Array.isArray(s.history)) ? s.history.slice(0, 8).map((h) => ({
      ts: h.ts, label: h.label, active: h.active, design: (h.design || '').slice(0, 4000),
      pages: (h.pages || []).slice(0, 6).map((p) => ({ path: p.path, name: p.name, html: (p.html || '').slice(0, 300000) })),
    })) : undefined,
  }));
  try { localStorage.setItem(SITES_KEY, JSON.stringify(build(true))); }
  catch (e) {
    try { localStorage.setItem(SITES_KEY, JSON.stringify(build(false))); } // drop history to fit; current state still persists
    catch (e2) { if (typeof sbToast === 'function') sbToast('Storage is full — this website may not stick after a reload.'); }
  }
}
// Snapshot the site's CURRENT pages as a restore point, newest first (cap 8).
function siteSnap(s, label) {
  if (!s) return;
  try {
    const snap = { ts: Date.now(), label: String(label || 'Change').slice(0, 120), active: s.active || '/', design: s.design || '', pages: (sitePages(s) || []).map((p) => ({ path: p.path, name: p.name, html: p.html })) };
    s.history = [snap].concat(Array.isArray(s.history) ? s.history : []).slice(0, 8);
  } catch (e) {}
}
// Restore a site to a saved version (snapshots the current state first, so the
// restore itself is undoable).
function siteRestore(id, idx) {
  const s = siteById(id);
  if (!s || !Array.isArray(s.history) || !s.history[idx]) return;
  const snap = s.history[idx];
  // A REACT SITE'S PAGES ARE ON THE SERVER, SO THIS CANNOT RESTORE ONE.
  //
  // Everything below rewrites localStorage and prints "↩ Restored to: …" — and
  // for a React site that is a lie the customer cannot see through, because the
  // preview iframe loads the LIVE url, so it shows the build they were trying
  // to undo while the message says it worked. `siteSnap` runs on every
  // successful react build, so this rail is populated on every React site and
  // the button was reachable on all of them. It also replaced `s.pages` with an
  // older build's stub list, desyncing the page picker from what is published.
  //
  // This is the failure the 2026-08-08 work recorded as fixed, still live one
  // button over: the real restore (`siteVersions`, Cloud → Versions) copies an
  // archived build back over the live prefix through the publish path. Sent
  // there rather than reimplemented, so there is ONE thing that restores a
  // published site.
  if (s.react) { siteVersions(s); return; }
  siteSnap(s, 'Before restore');
  s.pages = (snap.pages || []).map((p) => ({ path: p.path, name: p.name, html: p.html }));
  s.design = snap.design || s.design;
  s.active = snap.active || '/';
  s.msgs.push({ r: 'a', t: '↩ Restored to: ' + (snap.label || 'a previous version') + '.' });
  s.updatedAt = Date.now();
  siteRail = 'chat'; siteView = 'preview';
  sitesSave(); renderSites();
}
function siteById(id) { return sitesLoad().find((s) => s.id === id) || null; }
// Multi-page model: a site holds `pages` [{path,name,html}] with an `active`
// path. Legacy single-`html` sites read as one Home page (backward-compat).
function sitePages(site) {
  if (site && Array.isArray(site.pages) && site.pages.length) {
    // SITES BUILT BEFORE THE PAGES WERE DERIVED still carry the single
    // `{path:'/', name:'App'}` placeholder in localStorage, so fixing the build
    // path fixed nothing they already own — the picker stayed a dead "Homepage"
    // label on every site that existed. The route files are recoverable: every
    // build message keeps the list it wrote, which is what the steps panel
    // renders its chips from.
    //
    // Derived on read rather than written back: this is called on every render,
    // and a getter that quietly rewrites and saves the record is a side effect
    // nobody expects from a function named `sitePages`. The next build stores
    // the real list anyway.
    if (site.react && site.pages.length === 1 && !site.pages[0].html) {
      const routed = reactRoutePages(lastBuildFiles(site));
      if (routed.length) return routed;
    }
    return site.pages;
  }
  if (site && site.html) return [{ path: '/', name: 'Home', html: site.html }];
  return [];
}
// The file list off the most recent build in the thread, newest first.
function lastBuildFiles(site) {
  const msgs = (site && Array.isArray(site.msgs)) ? site.msgs : [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const b = msgs[i] && msgs[i].build;
    if (b && Array.isArray(b.files) && b.files.length) return b.files;
  }
  return [];
}
// The route files a React build wrote, as pages the picker can offer.
//
// A REACT BUILD USED TO STORE EXACTLY ONE PAGE — `{path:'/', name:'App'}` —
// however many routes it generated. The picker only renders above one page, so a
// three-page site showed a dead "Homepage" label and there was no way to reach
// the other two in the preview at all. The information was already there: the
// build response lists every file it wrote, and the steps panel was printing
// them as chips one panel over.
//
// Files arrive as "src/routes/<name>.tsx". `index` is the home page and every
// other name is its own path; a nested route keeps its folder, which is what
// TanStack does with it.
function reactRoutePages(files) {
  const out = [];
  const seen = new Set();
  for (const f of Array.isArray(files) ? files : []) {
    const raw = String((f && f.path) || f || '');
    const m = raw.match(/(?:^|\/)src\/routes\/(.+)\.tsx$/) || raw.match(/^([A-Za-z0-9_/.-]+)\.tsx$/);
    if (!m) continue;
    const rel = m[1].replace(/^\/+/, '');
    // __root and the generated route tree are plumbing, not pages.
    if (!rel || /(^|\/)__/.test(rel) || rel === 'routeTree.gen') continue;
    const path = rel === 'index' ? '/' : '/' + rel.replace(/\/index$/, '');
    if (seen.has(path)) continue;
    seen.add(path);
    const last = path === '/' ? 'Home' : path.split('/').pop().replace(/[-_]+/g, ' ');
    out.push({ path, name: last.charAt(0).toUpperCase() + last.slice(1), html: '' });
  }
  // Home first; the rest keep the order the model wrote them, which matches the
  // site's own nav far more often than alphabetical would.
  out.sort((a, b) => (a.path === '/' ? -1 : b.path === '/' ? 1 : 0));
  return out;
}
function siteActivePage(site) {
  const pages = sitePages(site);
  return pages.find((p) => p.path === (site && site.active)) || pages[0] || null;
}
// The workspace preview renders from a Blob URL in a sandboxed allow-scripts
// iframe (opaque origin — no access to the app), NOT srcdoc: srcdoc inherits
// the app CSP, which blocks the generated site's own inline scripts. One live
// URL at a time; the previous one is revoked so long sessions don't leak.
let sitePrevUrl = null;
// Build the shim-injected preview HTML (error watcher + draft slug + nav shim),
// then hand it to the Worker so the iframe loads it from a real /preview/ URL
// served under the WEBSITE CSP — the generated page's own inline <script>/<style>
// run, exactly like the live site. A blob/srcdoc iframe inherits the APP's strict
// CSP (script-src 'self', no inline) and renders the page blank; that was the bug.
async function loadSitePreview(fr, html, slug) {
  if (!fr) return;
  const withShim = sitePreviewHtml(html, slug);
  try {
    const r = await apiFetch('/api/site/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: withShim }) });
    if (r && r.ok) { const d = await r.json().catch(() => ({})); if (d && d.url) { fr.src = d.url; return; } }
  } catch (e) {}
  // Fallback only if the round-trip fails (offline / not signed in): a blob URL.
  // Styled but its inline scripts are blocked by the app CSP, so dynamic content
  // won't run — still better than a hard failure.
  if (sitePrevUrl) { try { URL.revokeObjectURL(sitePrevUrl); } catch (e) {} sitePrevUrl = null; }
  sitePrevUrl = URL.createObjectURL(new Blob([withShim], { type: 'text/html' }));
  fr.src = sitePrevUrl;
}
function sitePreviewHtml(html, slug) {
  // Intercept internal "/path" link clicks in the preview and hand them to the
  // parent so the picker switches pages (a blob preview can't route by itself).
  const shim = '<script>(function(){document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a");if(!a)return;var h=a.getAttribute("href")||"";if(h.charAt(0)==="/"&&h.indexOf("//")!==0){e.preventDefault();try{parent.postMessage({__siteNav:h.split("#")[0].split("?")[0]||"/"},"*");}catch(x){}}},true);})();<\/script>';
  // Error watcher (preview-only QA): catch UNCAUGHT script errors + unhandled
  // promise rejections in the running preview and report them to the parent, so
  // the workspace can offer a one-click AI fix. Runs FIRST in <head> so it sees
  // load-time errors too. Resource-load errors have no .message → ignored (noise).
  const errShim = '<script>(function(){var seen={};function post(m,info){m=String(m||"").slice(0,300);if(!m||seen[m])return;seen[m]=1;try{parent.postMessage({__siteErr:{msg:m,info:String(info||"").slice(0,160)}},"*");}catch(x){}}window.addEventListener("error",function(e){if(e&&e.message)post(e.message,"");},true);window.addEventListener("unhandledrejection",function(e){var r=e&&e.reason;post((r&&(r.message||r))||"Unhandled promise rejection","promise");});function shown(el){if(el.checkVisibility){try{return el.checkVisibility({opacityProperty:true,visibilityProperty:true,contentVisibilityAuto:true})}catch(e){}}var cs=getComputedStyle(el);return !(cs.display==="none"||cs.visibility==="hidden"||parseFloat(cs.opacity)<0.05)}function blankCheck(){try{var b=document.body;if(!b)return;var vh=innerHeight||600,vw=innerWidth||800,els=b.querySelectorAll("h1,h2,h3,p,img,svg,section,header,main,article,button,a,li"),vis=0;for(var i=0;i<els.length&&vis<1;i++){var el=els[i],r=el.getBoundingClientRect();if(!shown(el))continue;if(r.width<8||r.height<8)continue;if(r.bottom<=0||r.top>=vh||r.right<=0||r.left>=vw)continue;vis++;}if(vis<1&&els.length>4)post("The page renders blank on load — content is present in the HTML but nothing shows (JavaScript likely hides it and never reveals it). Make all content visible with CSS; use JS only to enhance.","blank");}catch(x){}}window.addEventListener("load",function(){setTimeout(blankCheck,1300);});setTimeout(blankCheck,2600);})();<\/script>';
  // Draft identity: the blob preview has no /s/<slug> URL, so hand the site its
  // slug directly (runs BEFORE the site's own JS) — forms/accounts/maps resolve
  // it exactly like they will on the live URL. Published pages read it from the
  // path instead, so this injection is preview-only.
  let out = String(html || '');
  const slugTag = slug ? '<script>window.__SITE_SLUG__=' + JSON.stringify(String(slug)) + ';<\/script>' : '';
  const headInject = errShim + slugTag; // errShim first so it observes the site's own scripts
  out = /<head[^>]*>/i.test(out) ? out.replace(/<head[^>]*>/i, (m) => m + headInject) : (headInject + out);
  return /<\/body>/i.test(out) ? out.replace(/<\/body>/i, shim + '</body>') : (out + shim);
}
// Bind ONCE: preview link clicks (postMessaged from the shim) switch the picker.
let siteNavBound = false;
function bindSiteNav() {
  if (siteNavBound) return; siteNavBound = true;
  window.addEventListener('message', (e) => {
    if (e.data && e.data.__siteErr) { collectPreviewErr(e.data.__siteErr); return; }
    const nav = e.data && e.data.__siteNav;
    if (!nav) return;
    const s = siteById(siteOpenId); if (!s) return;
    const target = sitePages(s).find((p) => p.path === nav);
    if (target && s.active !== target.path) switchSitePage(target.path);
  });
}
// Switch the previewed page WITHOUT a full re-render. Rebuilding the workspace
// destroys the iframe (a fresh iframe paints blank/black until its src loads —
// that was the flash). Instead we keep the SAME iframe: the browser holds the
// current page visible until the new one commits, so the swap is seamless
// (Lovable-style). Only the picker label, the URL chip, and the iframe content
// update. In Code/More views there's no live iframe, so fall back to a render.
// A SECOND COPY OF TWO CONSTANTS, kept honest by test/site-zone.test.mjs.
//
// The client cannot import a Worker module, and the repo's usual answer is to
// compose the string on the server — right for prose, wrong here: a per-site
// address computed at build time is stale for every site built before the zone
// went live, so every existing customer would keep seeing the old link until
// they happened to make a change. Two constants read at render time make every
// chip correct the moment the flag flips. The test reads site-domains.mjs and
// fails if either drifts.
const SITE_ZONE = 'gofarther.app';
const SITE_ZONE_LIVE = true;

// The address shown above the preview — and the one people copy out of it.
//
// IT HAS TO BE A URL THAT WORKS, which it twice was not. It read
// "gofarther.dev/s/hey/press" when the app was hash-routed and that page lived
// at `#/press`; the fragment was added, and then the router moved to browser
// history on 2026-08-09 and the fragment became wrong in the other direction —
// `/s/hey/#/press` loads the home page and the customer sends that to somebody.
// Pages have real addresses now, so the path is just the path.
function siteChipUrl(site, path) {
  if (!site || !site.slug) return 'Draft preview — publish to get a live link';
  const base = SITE_ZONE_LIVE
    ? site.slug + '.' + SITE_ZONE + '/'
    : 'gofarther.dev/s/' + site.slug + '/';
  const p = path && path !== '/' ? String(path).replace(/^\//, '') : '';
  return base + p;
}
function switchSitePage(path) {
  const s = siteById(siteOpenId); if (!s) return;
  const target = sitePages(s).find((p) => p.path === path);
  if (!target || s.active === path) return;
  s.active = path; sitesSave();
  if (siteView !== 'preview') { renderSites(); return; }
  const btn = document.getElementById('stPageBtn');
  if (btn) btn.innerHTML = esc(target.name) + ' <span class="st-cv">▾</span>';
  const menu = document.getElementById('stPageMenu');
  if (menu) { menu.hidden = true; menu.querySelectorAll('[data-path]').forEach((b) => b.classList.toggle('on', b.dataset.path === path)); }
  const chip = document.querySelector('.st-frame-url');
  if (chip) chip.textContent = siteChipUrl(s, path);
  const f = document.getElementById('stFrame');
  sitePreviewErrs[s.id + '|' + path] = []; // fresh page → clear stale errors
  if (f && target.html) loadSitePreview(f, target.html, s.slug);
  // A REACT PAGE HAS NO `html` TO LOAD, so the branch above skipped it entirely
  // and the frame kept showing whatever it already had while the label changed.
  // A REAL PATH, not a fragment. This said `+ '#' + path` and worked for exactly
  // as long as the app was hash-routed; since the router moved to browser
  // history the fragment is inert, so picking "Press" changed the label and left
  // the frame on the home page — indistinguishable from the build having made
  // one page. The Worker answers an extensionless path with that route's
  // prerendered HTML, so this is a real navigation and it reloads.
  //
  // THE PREVIEW LOADS THE PUBLIC ADDRESS, which is what `s.url` already is:
  // it comes straight from the build response's `url`, and that is `siteUrlFor`,
  // which returns the pretty host whenever the site has one.
  //
  // A comment here used to claim the opposite — that the frame deliberately
  // stayed on `/s/<slug>/` to be "same-origin with the builder". It was wrong
  // twice over. The value was never `/s/` for any site built since the zone went
  // live, and the frame is sandboxed WITHOUT `allow-same-origin`, so it is an
  // opaque origin either way and there was no same-origin to preserve. Corrected
  // rather than deleted, because a false claim in a comment is the thing that
  // gets read and believed the next time somebody changes this line.
  else if (f && s.react && s.url) f.src = s.url + (path !== '/' ? String(path).replace(/^\//, '') : '') + '?v=' + (s.previewV || 1);
  if (typeof paintPreviewErrBadge === 'function') paintPreviewErrBadge();
}
function renderSites() {
  const view = document.getElementById('viewSites');
  if (!view) return;
  const open = siteOpenId && siteById(siteOpenId);
  view.classList.toggle('ws-open', !!open);
  if (open) { renderSiteWorkspace(view, open); return; }
  siteOpenId = null;
  const sites = sitesLoad();
  view.innerHTML =
    '<div class="st-page">' +
      '<div class="st-hero">' +
        '<h1>What are we <span class="st-grad">building</span>?</h1>' +
      '<div class="st-new">' +
        '<textarea id="stPrompt" class="st-in" rows="2" placeholder="Describe the website you want — “a landing page for my sneaker brand, dark, bold type, waitlist form”…"></textarea>' +
        '<div class="st-attach" id="stAttach"></div>' +
        '<div class="st-new-foot">' +
          '<button type="button" class="st-attbtn" id="stAttachBtn" title="Attach a logo, a photo, a PDF menu or price list">' + ic('image', 15) + ' Attach</button>' +
          '<button type="button" class="st-gen" id="stGen" aria-label="Build it" title="Build it"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>' +
        '</div>' +
      '</div></div>' +
      (sites.length
        ? '<div class="st-grid-h">Your sites</div><div class="st-grid">' + sites.map((s) =>
            '<div class="st-card" data-open="' + esc(s.id) + '" role="button" tabindex="0">' +
              '<div class="st-card-prev"><iframe sandbox="' + (s.react && s.url ? 'allow-scripts' : '') + '" loading="lazy" title="' + esc(s.name) + '"></iframe></div>' +
              '<div class="st-card-meta"><span class="st-card-name">' + esc(s.name) + '</span>' +
                '<span class="st-card-sub">' + esc(schWhen(new Date(s.updatedAt || s.createdAt).toISOString())) + '</span></div>' +
              '<button type="button" class="sch-del st-card-del" data-del="' + esc(s.id) + '" title="Delete" aria-label="Delete site">×</button>' +
            '</div>').join('') + '</div>'
        : '');
  const gen = document.getElementById('stGen');
  const ta = document.getElementById('stPrompt');
  if (gen && ta) {
    const go = () => { const t = ta.value.trim(); if (!t) { ta.focus(); return; } siteCreate(t); };
    gen.onclick = go;
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } };
  }
  const attBtn = document.getElementById('stAttachBtn');
  if (attBtn) attBtn.onclick = siteAttachOpen;
  paintAttachStrip();
  // thumbnails: srcdoc set via property (attribute-escaping-proof), inert
  view.querySelectorAll('.st-card').forEach((card) => {
    const s = siteById(card.dataset.open);
    const fr = card.querySelector('iframe');
    const home = s && (siteActivePage(s) || sitePages(s)[0]);
    if (fr && s && s.react && s.url) fr.src = s.url; // compiled React thumbnail
    else if (fr && home && home.html) fr.srcdoc = home.html;
    card.onclick = (e) => { if (e.target.closest('[data-del]')) return; siteOpenId = card.dataset.open; renderSites(); };
    card.onkeydown = (e) => { if (e.key === 'Enter') { siteOpenId = card.dataset.open; renderSites(); } };
  });
  view.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    const id = b.dataset.del;
    const s = siteById(id);
    // A published/React site has a live page + (maybe) its own database — deleting
    // it is permanent, so confirm, then wipe it server-side before removing locally.
    if (s && s.slug) {
      if (!confirm('Delete this site for good? Its live page' + (s.backend ? ' and any saved data' : '') + ' will be permanently removed.')) return;
      // THE REAL ROUTE. This posted to `/api/site/backend/delete`, which has never
      // existed: the 404 was swallowed, the local record was dropped anyway, and
      // the published site, its Neon database and its claimed slug all kept
      // running — while the customer had just been told they were permanently
      // removed. And with the local record gone there was no UI left to retry.
      // A failure now KEEPS the site in the list, so it can be tried again.
      let dr;
      try { dr = await apiFetch('/api/site/' + encodeURIComponent(s.slug), { method: 'DELETE' }); } catch (e) { dr = null; }
      // A 404 IS "ALREADY GONE", AND KEEPING THE CARD FOR IT MADE ONE
      // UNDELETABLE FOREVER. The backend row is the ownership record, so a slug
      // with no row answers 404 — and a site that was already taken down (or
      // whose build never claimed the slug) has no row by definition. The card
      // then failed every retry with "it's still live", which was untrue in both
      // halves: measured 2026-08-12 on `pulse-fitness`, where the row was gone,
      // the subdomain answered 404 and the customer could not clear the card by
      // any means.
      //
      // Removing it here is NOT the 2026-08-08 bug coming back. That one dropped
      // the record on a 404 from a route that HAD NEVER EXISTED, so every delete
      // silently failed while the site kept running. This route exists, and its
      // 404 has exactly one meaning. It is said out loud rather than done
      // quietly, because "we took your site down" and "there was nothing of it
      // left" are different facts and the customer is entitled to which one.
      if (dr && dr.status === 404) {
        alert("That site was already gone on our side, so I've taken it off your list.");
      } else if (dr && dr.status === 403) {
        // Not yours. The local card is wrong either way, but this is the one
        // status that means somebody ELSE's site is at that slug, and quietly
        // clearing it would hide an ownership bug rather than report one.
        alert("That site belongs to another account, so it can't be removed from here.");
        return;
      } else if (!dr || !dr.ok) {
        alert("Couldn't take that site down just now — it's still live. Try again in a moment.");
        return;
      }
    }
    sitesCache = sitesLoad().filter((x) => x.id !== id);
    sitesSave(); renderSites();
  });
}
function siteCreate(prompt) {
  const id = 'site_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const name = prompt.split(/\s+/).slice(0, 4).join(' ').slice(0, 30) || 'New site';
  sitesLoad().unshift({ id, name, createdAt: Date.now(), updatedAt: Date.now(), html: '', msgs: [] });
  sitesSave();
  siteOpenId = id;
  renderSites();
  siteSend(prompt);
}
// "Jul 18 at 9:58 PM" — the thread's session stamp (Lovable-style).
function stStamp(ts) {
  try { return new Date(ts || Date.now()).toLocaleString('en-US', { month: 'short', day: 'numeric' }) + ' at ' + new Date(ts || Date.now()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  catch { return ''; }
}
// ── Workspace stage views (frontend chrome, Go Farther-skinned) ────────────────────
// Preview / Code / More(Analytics·Cloud·Security·SEO). Real data where we have it
// (the page HTML, the live URL); tasteful "coming soon" where the backend isn't
// wired yet. All visual for now — owner reference 2026-07-18 (Lovable).
// Monochrome inline-SVG icon set (currentColor, no fill) — no emoji anywhere in
// the workspace chrome, so every glyph inherits the UI's own colour.
const ST_ICONS = {
  back: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
  history: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
  reload: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v5h-5"/>',
  desktop: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/>',
  tablet: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M11 18h2"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.5h13l3.5 6.5v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3.5"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.9 2.6 15.1 0 18"/><path d="M12 3c-2.6 2.9-2.6 15.1 0 18"/>',
  code: '<path d="M9 7l-5 5 5 5"/><path d="M15 7l5 5-5 5"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.4"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.4"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.4"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.4"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 20v-5"/><path d="M13 20V9"/><path d="M18 20v-8"/>',
  cloud: '<path d="M17.5 18.5a4.5 4.5 0 0 0 .3-9A6 6 0 0 0 6 10a4 4 0 0 0 0 8.5z"/>',
  shield: '<path d="M12 3l7 3v5.5c0 4.4-3 7.4-7 8.9-4-1.5-7-4.5-7-8.9V6l7-3z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="3"/><path d="M4.5 5.5v13c0 1.6 3.4 3 7.5 3s7.5-1.4 7.5-3v-13"/><path d="M4.5 12c0 1.6 3.4 3 7.5 3s7.5-1.4 7.5-3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6 8.5-6"/>',
  key: '<circle cx="8" cy="15" r="4.5"/><path d="M11.2 11.8l8-8"/><path d="M17 6l2.5 2.5"/><path d="M14.5 8.5L17 11"/>',
  zap: '<path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8z"/>',
  alert: '<path d="M12 3.5l9.2 16H2.8l9.2-16z"/><path d="M12 10v4.5"/><path d="M12 18h.01"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/><path d="M6 15h4"/>',
};
function ic(name, size) { size = size || 16; return '<svg class="st-svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ST_ICONS[name] || '') + '</svg>'; }
function siteFileName(p) { return (p.path === '/' ? 'index' : p.path.replace(/^\//, '').replace(/[^a-z0-9/_-]/gi, '-')) + '.html'; }
function siteCodeView(site, active, pages) {
  const files = pages.map((p) =>
    '<button type="button" class="st-file' + (active && p.path === active.path ? ' on' : '') + '" data-codepath="' + esc(p.path) + '">' +
    '<span class="st-file-ic">' + ic('code', 13) + '</span><span class="st-file-n">' + esc(siteFileName(p)) + '</span></button>').join('');
  const raw = active ? String(active.html).slice(0, 120000) : '';
  const gutter = raw ? Array.from({ length: raw.split('\n').length }, (_, i) => i + 1).join('\n') : '';
  return '<div class="st-code">' +
    '<div class="st-code-tree"><div class="st-code-h">Pages</div>' + files + '</div>' +
    '<div class="st-code-main">' +
      '<div class="st-code-bar"><span class="st-code-fname">' + (active ? esc(siteFileName(active)) : '') + '</span>' +
      '<button type="button" class="st-code-dl" id="stCodeDl" title="Download this page">' + ic('download', 14) + ' Download</button></div>' +
      '<div class="st-code-scroll"><pre class="st-code-gutter" aria-hidden="true">' + gutter + '</pre><pre class="st-code-pre"><code>' + esc(raw) + '</code></pre></div>' +
    '</div>' +
  '</div>';
}
function moreStat(label, val) { return '<div class="st-stat"><span class="st-stat-l">' + label + '</span><span class="st-stat-v">' + val + '</span></div>'; }
function siteMoreView(site) {
  const items = [['analytics', 'chart', 'Analytics'], ['cloud', 'cloud', 'Cloud'], ['security', 'shield', 'Security'], ['seo', 'search', 'SEO & AI search']];
  const nav = items.map((it) => '<button type="button" class="st-mnav' + (siteMoreTab === it[0] ? ' on' : '') + '" data-more="' + it[0] + '"><span class="st-mnav-ic">' + ic(it[1], 17) + '</span>' + it[2] + '</button>').join('');
  const body = siteMoreTab === 'cloud' ? moreCloud(site) : siteMoreTab === 'security' ? moreSecurity(site) : siteMoreTab === 'seo' ? moreSeo(site) : moreAnalytics(site);
  return '<div class="st-more"><div class="st-mnav-col">' + nav + '</div><div class="st-more-body">' + body + '</div></div>';
}
function moreAnalytics(site) {
  if (!site.slug) return '<div class="st-panel"><div class="st-panel-head"><h3>Web traffic</h3></div><div class="st-chart"><div class="st-chart-empty">Publish your site to start tracking visits.</div></div></div>';
  return '<div class="st-panel" id="anPanel">' +
    '<div class="st-panel-head"><h3>Web traffic</h3><span class="st-chip-muted">All time</span></div>' +
    '<div class="st-stats">' +
      '<div class="st-stat"><span class="st-stat-l">Visitors</span><span class="st-stat-v" id="anVisitors">·</span></div>' +
      '<div class="st-stat"><span class="st-stat-l">Page views</span><span class="st-stat-v" id="anViews">·</span></div>' +
      '<div class="st-stat"><span class="st-stat-l">Views / visit</span><span class="st-stat-v" id="anVpv">·</span></div>' +
    '</div>' +
    '<div class="st-panel-sub">Last 7 days</div>' +
    '<div class="st-chart" id="anChart"><div class="st-chart-empty">Loading…</div></div>' +
  '</div>';
}
// Fill the Analytics panel with real numbers from /api/site/analytics.
async function loadSiteAnalytics(site) {
  const vEl = document.getElementById('anVisitors'); if (!vEl) return;
  try {
    // The owner's own door, same gate as the Data panel. site_hits has been
    // written on every visit since the D1 era with nothing reading it — this
    // route did not exist, so a published site collected traffic its owner
    // could never see.
    const r = await apiFetch('/api/site/' + encodeURIComponent(site.slug || '') + '/analytics');
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d || !d.ok) throw 0;
    const views = d.views || 0, visitors = d.visitors || 0;
    vEl.textContent = visitors;
    const viEl = document.getElementById('anViews'); if (viEl) viEl.textContent = views;
    const vpv = document.getElementById('anVpv'); if (vpv) vpv.textContent = visitors ? (views / visitors).toFixed(1) : '0';
    const chart = document.getElementById('anChart');
    if (chart) {
      const series = Array.isArray(d.series) ? d.series : [];
      const max = Math.max(1, ...series.map((s) => s.views || 0));
      chart.innerHTML = (series.length && views > 0)
        ? '<div class="an-bars">' + series.map((s) => '<div class="an-bar" title="' + esc(String(s.day)) + ': ' + (s.views || 0) + '"><div class="an-bar-fill" style="height:' + Math.round(((s.views || 0) / max) * 100) + '%"></div><span class="an-bar-l">' + esc(String(s.day).replace(/^\w+ /, '')) + '</span></div>').join('') + '</div>'
        : '<div class="st-chart-empty">No visits yet — share your link and watch this fill up.</div>';
    }
  } catch (e) {
    vEl.textContent = '0';
    const viEl = document.getElementById('anViews'); if (viEl) viEl.textContent = '0';
    const vpv = document.getElementById('anVpv'); if (vpv) vpv.textContent = '0';
    const chart = document.getElementById('anChart'); if (chart) chart.innerHTML = '<div class="st-chart-empty">Couldn’t load analytics just now.</div>';
  }
}
// A column that holds a picture. Only a naming guess — the column is plain text
// either way, and the value is just a URL — so getting it wrong costs a button
// that is not offered, never a broken save.
function isImageCol(name) {
  return /(^|_)(image|images|img|photo|photos|picture|pic|avatar|logo|cover|thumbnail|thumb|banner|hero)(_|$)|_url$/i.test(String(name || ''));
}
// Phase E — the Data / Users panel: shows the rows in the site's OWN database
// (visitor submissions, displayed content, per-user data, and the visitor accounts).
async function loadSiteData(site) {
  const host = document.getElementById('stData'); if (!host) return;
  // The owner's door onto their own site: /api/site/<slug>/rows[/<table>[/<id>]]
  // and /api/site/<slug>/members. A different caller from the published site's
  // public /api/db — that one is an anonymous visitor, this one is the Go Farther
  // account that OWNS the site, so it can read `collect` submissions (which the
  // public API refuses by design) and correct `display` content.
  const base = '/api/site/' + encodeURIComponent(site.slug || '');
  let tables = [];
  try {
    const r = await apiFetch(base + '/rows');
    const d = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(d.tables)) tables = d.tables;
  } catch (e) {}
  // No synthetic "Users" tab HERE — member accounts get their own panel
  // (`siteMembers`, Cloud → Members), because managing one is a different job
  // from editing a table's rows: a role, a suspension, a removal. The comment
  // this replaces said the members route "went with the auth layer on
  // 2026-07-30" and left `const members = false` behind to prove it; the route
  // was rebuilt on Neon Auth the same day, and the dead flag then made every
  // ternary that mentioned it unreachable code pretending to be a branch.
  const tabs = tables.map((t) => ({ name: t.name, access: t.access, memberRows: !!t.memberRows, columns: t.columns || [], label: t.name }));
  let sel = (siteDataTable && tabs.some((t) => t.name === siteDataTable)) ? siteDataTable : (tabs[0] && tabs[0].name);
  siteDataTable = sel;
  const selTab = tabs.find((t) => t.name === sel) || { columns: [] };
  // Editing and deleting work on every declared table — it is all the owner's.
  // Adding does not: a `user`/`feed` row belongs to a member of the site, and
  // the owner has no member id to stamp on it, so the API answers 409.
  const editable = !!sel;
  // ASKED OF THE SERVER'S OWN ANSWER, not re-derived from the access NAME.
  // `access` is a label for people; whether a row belongs to a member is a fact
  // `site-access.mjs` resolves from the write axis, and a table declared as a
  // pair (`{read:"own", write:"own"}`) matches neither 'user' nor 'feed' — so
  // this offered "+ Add" on exactly the tables where the API answers 409.
  const canAdd = editable && !selTab.memberRows;
  const cols = (selTab.columns || []).map((c) => (typeof c === 'string' ? c : c && c.name)).filter(Boolean);
  let rows = [], err = false;
  if (sel) {
    try {
      const r = await apiFetch(base + '/rows/' + encodeURIComponent(sel));
      const d = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(d.rows)) rows = d.rows; else err = true;
    } catch (e) { err = true; }
  }
  // One per access level the schema engine can produce — `admin` was missing, so
  // a staff-managed table was the ONE kind that rendered with a blank label and
  // read as an unlabelled odd-one-out beside four that were named.
  const accLabel = { collect: 'submissions', display: 'content', user: 'per-user', feed: 'public feed', admin: 'members' };
  const side = '<div class="st-data-side">' + tabs.map((t) => '<button type="button" class="st-data-tab' + (t.name === sel ? ' on' : '') + '" data-dtable="' + esc(t.name) + '"><span class="st-data-tn">' + esc(t.label) + '</span>' + '<span class="st-data-acc">' + esc(accLabel[t.access] || t.access || '') + '</span>' + '</button>').join('') + '</div>';
  // Add / edit form (owner content editor) — a field per declared column.
  let formHtml = '';
  if (editable && siteDataForm) {
    const v = siteDataForm.values || {};
    formHtml = '<div class="st-data-form"><div class="st-data-form-fields">' + cols.map((c) => {
      const cur = v[c] == null ? '' : String(v[c]);
      // A column that holds a picture gets a file button next to its box. The
      // stored value is still just a URL string — the column is text either way,
      // so this is a nicety of the editor and not a different kind of field.
      const pic = isImageCol(c);
      return '<label class="st-data-field"><span>' + esc(c) + '</span>' +
        '<input class="st-data-in" data-col="' + esc(c) + '" value="' + esc(cur) + '">' +
        (pic ? '<span class="st-data-pic">' +
          (cur ? '<img class="st-data-thumb" src="' + esc(cur) + '" alt="">' : '') +
          '<button type="button" class="st-data-up" data-up="' + esc(c) + '">Upload image</button>' +
        '</span>' : '') +
      '</label>';
    }).join('') + '</div>' +
      '<div class="st-data-form-actions"><button type="button" class="st-data-save" id="stDataSave">' + (siteDataForm.editId ? 'Save changes' : 'Add row') + '</button><button type="button" class="st-data-cancel" id="stDataCancel">Cancel</button></div></div>';
  }
  let main;
  if (!tabs.length) main = '<div class="st-empty">No data tables yet.</div>';
  else if (err) main = '<div class="st-empty">Couldn’t load this table just now.</div>';
  else if (!rows.length && !formHtml) main = '<div class="st-empty">Nothing here yet.' + (canAdd ? ' Use “+ Add” to put in your first row.' : ' When visitors submit, it shows up here.') + '</div>';
  else {
    const displayCols = rows.length ? Object.keys(rows[0]) : cols;
    main = (rows.length ? '<div class="st-data-tablewrap"><table class="st-data-grid"><thead><tr>' + displayCols.map((c) => '<th>' + esc(c) + '</th>').join('') + (editable ? '<th></th>' : '') + '</tr></thead><tbody>' +
      rows.map((row) => '<tr>' + displayCols.map((c) => '<td>' + esc(String(row[c] == null ? '' : row[c])).slice(0, 240) + '</td>').join('') + (editable ? '<td class="st-data-rowact"><button type="button" class="st-data-editbtn" data-edit="' + esc(String(row.id)) + '">Edit</button><button type="button" class="st-data-rmrow" data-rm="' + esc(String(row.id)) + '" title="Delete">×</button></td>' : '') + '</tr>').join('') +
      '</tbody></table></div>' : '');
  }
  const addBtn = (canAdd && !siteDataForm) ? '<button type="button" class="st-data-add" id="stDataAdd">+ Add</button>' : '';
  // Email-me-when-someone-submits, and the switch to stop it. Only meaningful
  // on a table visitors write to.
  const notifyBtn = (selTab.access === 'collect')
    ? '<button type="button" class="st-data-notify" id="stDataNotify" title="Email me when someone submits">…</button>' : '';
  host.innerHTML = '<div class="st-data-head"><span class="st-data-title">Data</span><span class="st-data-count">' + (rows.length ? rows.length + ' row' + (rows.length > 1 ? 's' : '') : '') + '</span>' + notifyBtn + addBtn + '<button type="button" class="st-icon" id="stDataReload" title="Refresh">' + ic('reload', 15) + '</button></div><div class="st-data-body">' + side + '<div class="st-data-main">' + formHtml + main + '</div></div>';
  const nb = document.getElementById('stDataNotify');
  if (nb) {
    const paint = (on) => { nb.textContent = on ? '🔔 Emails on' : '🔕 Emails off'; nb.dataset.on = on ? '1' : ''; };
    apiFetch(base + '/notify').then((r) => r.json()).then((d) => paint(!!d.notify)).catch(() => paint(true));
    nb.onclick = async () => {
      const next = nb.dataset.on !== '1';
      nb.disabled = true;
      try {
        const r = await apiFetch(base + '/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: next }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { sbToast(d.error || 'Couldn’t change that.'); return; }
        paint(!!d.notify);
      } catch (e) { sbToast('Couldn’t change that — check your connection.'); }
      finally { nb.disabled = false; }
    };
  }
  host.querySelectorAll('[data-dtable]').forEach((b) => b.onclick = () => { siteDataTable = b.dataset.dtable; siteDataForm = null; loadSiteData(site); });
  const rl = document.getElementById('stDataReload'); if (rl) rl.onclick = () => loadSiteData(site);
  const add = document.getElementById('stDataAdd'); if (add) add.onclick = () => { siteDataForm = { editId: null, values: {} }; loadSiteData(site); };
  const cancel = document.getElementById('stDataCancel'); if (cancel) cancel.onclick = () => { siteDataForm = null; loadSiteData(site); };
  // Upload a picture and drop its URL into the field. Raw bytes, not base64:
  // base64 inflates a photo by a third and the server ignores the declared type
  // anyway — only the leading bytes decide what it is.
  host.querySelectorAll('[data-up]').forEach((b) => b.onclick = () => {
    const col = b.dataset.up;
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const was = b.textContent; b.textContent = 'Uploading…'; b.disabled = true;
      try {
        const r = await apiFetch(base + '/uploads', { method: 'POST', headers: { 'Content-Type': f.type || 'application/octet-stream' }, body: f });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.url) { sbToast(d.error || 'Couldn’t upload that image.'); return; }
        // Keep whatever else was typed — re-rendering from the DOM rather than
        // from the saved row, so a half-filled form is not thrown away.
        const vals = {}; host.querySelectorAll('.st-data-in').forEach((i) => vals[i.dataset.col] = i.value);
        vals[col] = d.url;
        siteDataForm = { editId: siteDataForm && siteDataForm.editId, values: vals };
        loadSiteData(site);
      } catch (e) { sbToast('Couldn’t upload that image — check your connection.'); }
      finally { b.textContent = was; b.disabled = false; }
    };
    inp.click();
  });
  const save = document.getElementById('stDataSave'); if (save) save.onclick = async () => {
    const values = {}; host.querySelectorAll('.st-data-in').forEach((i) => values[i.dataset.col] = i.value);
    const editId = siteDataForm && siteDataForm.editId;
    // The row IS the body — the API keeps declared columns and drops the rest.
    try {
      const r = await apiFetch(base + '/rows/' + encodeURIComponent(sel) + (editId ? '/' + encodeURIComponent(editId) : ''), {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      // Say what went wrong instead of silently redrawing the same form: the
      // API's own message separates "that time is taken" from a server fault.
      if (!r.ok) { const d = await r.json().catch(() => ({})); sbToast(d.error || 'Couldn’t save that.'); return; }
    } catch (e) { sbToast('Couldn’t save that — check your connection.'); return; }
    siteDataForm = null; loadSiteData(site);
  };
  host.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => { const row = rows.find((r) => String(r.id) === b.dataset.edit); siteDataForm = { editId: b.dataset.edit, values: row ? Object.assign({}, row) : {} }; loadSiteData(site); });
  host.querySelectorAll('[data-rm]').forEach((b) => b.onclick = async () => {
    if (!confirm('Delete this row?')) return;
    const path = base + '/rows/' + encodeURIComponent(sel) + '/' + encodeURIComponent(b.dataset.rm);
    try {
      const r = await apiFetch(path, { method: 'DELETE' });
      if (!r.ok) { const d = await r.json().catch(() => ({})); sbToast(d.error || 'Couldn’t delete that.'); return; }
    } catch (e) { sbToast('Couldn’t delete that — check your connection.'); return; }
    siteDataForm = null; loadSiteData(site);
  });
}
function moreCloud(site) {
  const isReact = !!site.react;
  const hasBackend = !!(isReact && site.backend);
  // React sites: Members / Submissions / Database ride the site's OWN D1 (live once
  // the app declares a backend). Secrets + Edge functions are LIVE once published
  // (server logic + keys for payments/email/integrations). Emails / Payments / Files
  // management panels aren't ported to React yet → Soon (payments+email still work
  // for React via an edge function + a secret). Legacy static sites unchanged.
  const dataLive = isReact ? hasBackend : !!site.slug;
  const fnLive = !!site.slug;                       // Secrets + Edge functions: any published site
  const auxLive = isReact ? false : !!site.slug;    // Emails/Payments/Files dedicated panels: static only for now
  // WHAT IS ACTUALLY SERVED, audited 2026-08-06 against worker.js's route
  // matcher. The owner block answers exactly: /rows /members /analytics
  // /uploads /export /notify /secrets. Everything else these cards call was
  // deleted with the D1 runtime in July and 404s.
  //
  // The dead ones are marked UNAVAILABLE rather than removed. Removing them
  // deletes the record of what this console is meant to do, and these are
  // features the platform still wants; a card that says why it is off is
  // honest, whereas one that looks live and 404s reads as a broken product.
  // Flip a name out of DEAD_PANELS the moment its route exists again.
  const DEAD_PANELS = {
    security: 'Off since the audit log was removed',        // /events — routed nowhere
    // `versions` WAS HERE AND ITS ROUTE HAD EXISTED FOR FOUR DAYS. The archive,
    // the 10-version retention and `POST /api/site/<slug>/versions/restore` all
    // shipped 2026-08-08 and `siteVersions` was rewired to call them — and this
    // entry, with its stale "/backend/rollback — nothing records builds" note,
    // kept forcing the card to render Off and stripping its click handler. So
    // the feature was live end to end on the server and unreachable in the
    // product, which is precisely what the line above says to prevent.
    functions: 'Set up by your app, nothing to configure', // jobs are declared in the schema, not here
    emails: 'Set up in Secrets — add your provider key',   // no route; the key lives under Secrets
  };
  const cards = [
    ['users', 'Members', dataLive ? 'Accounts that sign up in your app' : (isReact ? 'Add a login to your app to collect members' : 'Publish to enable member accounts'), dataLive, 'members'],
    ['key', 'Security log', dataLive ? 'Sign-ins, failures and what you changed' : (isReact ? 'Add a login to your app to see this' : 'Publish to enable the security log'), dataLive, 'security'],
    ['inbox', 'Submissions', dataLive ? 'Form entries from your visitors' : (isReact ? 'Add a form to your app to collect entries' : 'Publish to collect submissions'), dataLive, 'inbox'],
    ['database', 'Database', dataLive ? 'Your app’s tables + rows' : (isReact ? 'Add data to your app to see it here' : 'Publish to enable collections'), dataLive, 'database'],
    ['chart', 'Insights', dataLive ? 'Traffic, top pages + error rate' : (isReact ? 'Add data/traffic to see insights' : 'Publish to see insights'), dataLive, 'insights'],
    ['download', 'Export data', dataLive ? 'Download everything your site has collected' : (isReact ? 'Add data to enable exports' : 'Publish to enable exports'), dataLive, 'backups'],
    ['history', 'Versions', (isReact && !!site.slug) ? 'Roll back to a previous build' : (isReact ? 'Publish to enable versions' : 'React sites only'), (isReact && !!site.slug), 'versions'],
    ['key', 'Secrets', isReact ? 'API keys for payments, email + integrations (kept server-side)' : 'Encrypted keys for server-side features', fnLive, 'secrets'],
    ['zap', 'Edge functions', 'Custom server logic your app builds', fnLive, 'functions'],
    ['mail', 'Emails', 'Send email from your own provider', auxLive, 'emails'],
    ['card', 'Payments', dataLive ? 'Sell with your own Stripe' : (isReact ? 'Publish your app to take payments' : 'Publish to take payments'), fnLive, 'payments'],
    ['image', 'Files', 'Pictures on your site — yours and your visitors\u2019', dataLive, 'files'],
    // Needs only a PUBLISHED site, not a backend: a brochure site with no data
    // wants its own domain just as much as an app does, and gating this on
    // `dataLive` would hide it from exactly those owners.
    ['globe', 'Domains', site.slug ? 'Put this on your own web address' : 'Publish first, then add your own address', !!site.slug, 'domains'],
  ];
  return '<div class="st-panel"><div class="st-panel-head"><h3>Cloud</h3></div>' +
    '<div class="st-cards">' + cards.map((c) => {
      // A dead panel is NOT clickable and does not claim to be Live. It used to
      // pass both tests — `dataLive` is about the site having a backend, not
      // about the route existing — so seven cards said "Live", opened, and 404ed.
      const dead = DEAD_PANELS[c[4]];
      const clickable = !dead && c[3] && c[4] && site.slug;
      const badge = dead ? '<span class="st-badge-soon">Off</span>'
        : (c[3] ? '<span class="st-badge-live">Live</span>' : '<span class="st-badge-soon">Soon</span>');
      return '<div class="st-cloudcard' + (c[3] && !dead ? ' live' : '') + (clickable ? ' st-clickable' : '') + '"' + (clickable ? ' role="button" tabindex="0" data-cloud="' + c[4] + '"' : '') + '><span class="st-cc-ic">' + ic(c[0], 20) + '</span><div class="st-cc-tx"><b>' + c[1] + badge + '</b><span>' + (dead || c[2]) + '</span></div></div>';
    }).join('') +
    '</div></div>';
}
function moreSecurity(site) {
  const can = (sitePages(site) || []).length > 0;
  return '<div class="st-panel"><div class="st-panel-head"><h3>Security</h3></div>' +
    // THE SCAN HAS NO ROUTE. It offered "~8 credits" on every built site and the
    // endpoint behind it does not exist, so the button spent nothing and did
    // nothing — a price quoted for a feature that cannot run. Given the same
    // honest Off treatment as the dead Cloud cards rather than left looking live;
    // flip it back the moment the route exists.
    '<div class="st-sec-hero"><span class="st-sec-ic">' + ic('shield', 22) + '</span><div class="st-cc-tx"><b>Deep security scan</b><span>Not available yet — a model-reviewed audit of your site’s code is still to come.</span></div><button type="button" class="st-publish" id="secScan" disabled>Run scan</button></div>' +
    '<div class="st-panel-sub">Detected issues</div>' +
    '<div id="secResults"><div class="st-sec-empty"><span class="st-sec-ok">' + ic('shield', 30) + '</span><b>No scan has run yet</b><span>Run a scan to surface issues.</span></div></div>' +
  '</div>';
}
// Deep scan — send the site's code to Opus (/api/site/scan) and render findings.
function siteSecurityScan(site) {
  const box = document.getElementById('secResults'); if (!box) return;
  const btn = document.getElementById('secScan'); if (btn) { btn.disabled = true; btn.textContent = 'Scanning…'; }
  box.innerHTML = '<div class="st-sec-empty"><b>Opus is reviewing your code…</b><span>This takes a few seconds.</span></div>';
  apiFetch('/api/site/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pages: (sitePages(site) || []).map((p) => ({ path: p.path, name: p.name, html: p.html })) }) })
    .then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (btn) { btn.disabled = false; btn.textContent = 'Run scan'; }
      if (r.status === 402) { box.innerHTML = '<div class="st-sec-empty"><b>Not enough credits</b><span>A deep scan needs ~8 credits. Tap your ✦ balance up top.</span></div>'; return; }
      if (!r.ok || !d.ok) { box.innerHTML = '<div class="st-sec-empty"><b>Scan didn’t run</b><span>Try again in a moment.</span></div>'; return; }
      const f = Array.isArray(d.findings) ? d.findings : [];
      if (!f.length) { box.innerHTML = '<div class="st-sec-empty"><span class="st-sec-ok">' + ic('shield', 30) + '</span><b>No issues found</b><span>Opus reviewed your code and it looks clean.</span></div>'; }
      else {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        f.sort((a, b) => (order[a.severity] == null ? 9 : order[a.severity]) - (order[b.severity] == null ? 9 : order[b.severity]));
        box.innerHTML = '<div class="st-sec-count">' + f.length + ' issue' + (f.length === 1 ? '' : 's') + ' found</div><div class="st-sec-issues">' + f.map((i) =>
          '<div class="st-issue st-sev-' + esc(i.severity || 'low') + '"><div class="st-issue-top"><span class="st-issue-sev">' + esc(i.severity || 'low') + '</span><b>' + esc(i.title || 'Issue') + '</b>' + (i.page ? '<span class="st-issue-pg">' + esc(i.page) + '</span>' : '') + '</div><p>' + esc(i.detail || '') + '</p></div>').join('') + '</div>';
      }
      if (typeof fetchCredits === 'function') fetchCredits();
    }).catch(() => { if (btn) { btn.disabled = false; btn.textContent = 'Run scan'; } box.innerHTML = '<div class="st-sec-empty"><b>Lost the connection</b><span>Try again.</span></div>'; });
}
function moreSeo(site) {
  return '<div class="st-panel"><div class="st-panel-head"><h3>SEO &amp; social</h3></div>' +
    '<div class="st-field"><label>Title</label><div class="st-inp">' + esc(site.name || 'Your site') + ' — built with Go Farther</div></div>' +
    '<div class="st-field"><label>Description</label><div class="st-inp st-inp-area">A short, on-brand description of your site for search engines and social shares.</div></div>' +
    '<div class="st-field"><label>Social image</label><div class="st-social"><div class="st-social-ph">1200 × 630</div><div class="st-social-btns"><button type="button" class="st-gen2" disabled>Upload · soon</button><button type="button" class="st-gen2" disabled>Generate · soon</button></div></div></div>' +
  '</div>';
}
// Edit history — the rail flips from chat to a list of every change you asked for.
function siteHistoryRail(site) {
  const hist = Array.isArray(site.history) ? site.history : [];
  const list = hist.length
    ? hist.map((h, i) => '<div class="st-hitem"><span class="st-hi-ic">' + ic('history', 14) + '</span><div class="st-hi-tx"><b>' + esc(String(h.label || 'Change').slice(0, 80)) + '</b><span>' + (i === 0 ? 'Current version' : esc(stStamp(h.ts))) + '</span></div>' + (i === 0 ? '' : '<button type="button" class="st-hi-restore" data-restore="' + i + '">Restore</button>') + '</div>').join('')
    : '<div class="st-hi-empty">No versions yet. Each change is saved here so you can roll back.</div>';
  return '<div class="st-hist">' +
    // ONE TAB, because Bookmarks was a `disabled` placeholder that had never
    // done anything — removed 2026-08-08, owner's call. A control that cannot be
    // pressed is a promise the app does not keep.
    '<div class="st-hist-tabs"><button type="button" class="st-htab on">' + ic('history', 14) + ' History</button></div>' +
    '<div class="st-hist-list">' + list + '</div>' +
  '</div>';
}
// Publish panel (mirrors Lovable's popover): the live link, visibility, visitors,
// republish/copy. Unpublish + edit-settings are visual placeholders for now.
function sitePublishPanel(site) {
  const slug = site.slug || (site.liveUrl || '').split('/s/')[1] || '';
  // ONE PUBLIC ADDRESS. `siteChipUrl` is the single place that knows what a
  // site's address is; two copies of that answer is how the panel ends up
  // offering a link the router redirects away from.
  const url = site.liveUrl || (slug ? 'https://' + siteChipUrl({ slug }) : '');
  const published = !!site.published;
  let box = document.getElementById('sitePubModal'); if (box) box.remove();
  box = document.createElement('div'); box.id = 'sitePubModal'; box.className = 'si-modal';
  const offline = site.offline === true;
  box.innerHTML = '<div class="si-card"><div class="si-head"><b>' + (offline ? 'Off the web' : 'Live') + '</b><button type="button" class="si-x" aria-label="Close">×</button></div><div class="si-body">' +
    // THERE IS NO PUBLISH BUTTON ANY MORE, and that is the fix rather than an
    // omission. A React site goes live as part of the build — the old Publish and
    // Republish buttons POSTed `/api/site/publish` with `p.html`, the D1-era page
    // format deleted 2026-07-27, at a route with zero occurrences in worker.js.
    // Same reasoning that removed the "Live ↗" button: a control that does
    // nothing the product already does is worse than no control.
    (offline
      ? '<p class="sp-intro">This site is <b>off the web</b>. Your pages, bookings, members and settings are all still here.</p>' +
        (slug ? '<div class="sp-row"><span class="sp-k">Its link</span><span class="sp-v">' + esc(siteChipUrl({ slug })) + '</span></div>' : '') +
        '<div class="sp-actions"><button type="button" class="st-publish" id="spLive">Put it back online</button></div>'
      : '<div class="sp-row"><span class="sp-k">Live URL</span><a class="sp-url" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(url.replace(/^https?:\/\//, '')) + '</a></div>' +
        '<div class="sp-row"><span class="sp-k">Visibility</span><span class="sp-v sp-vis">' + ic('globe', 14) + ' Public · anyone with the link</span></div>' +
        '<p class="sp-intro">Every change you make goes live on its own — there is nothing to publish.</p>' +
        '<div class="sp-actions"><button type="button" class="st-share" id="spCopy">Copy link</button><button type="button" class="st-share sp-unpub" id="spUnpub">Take it offline</button></div>') +
  '</div></div>';
  document.body.appendChild(box);
  const close = () => box.remove();
  box.querySelector('.si-x').onclick = close;
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  const cp = box.querySelector('#spCopy'); if (cp) cp.onclick = () => { try { navigator.clipboard.writeText(url); } catch (e) {} if (typeof sbToast === 'function') sbToast('Live link copied — ' + url); };
  const un = box.querySelector('#spUnpub'); if (un) un.onclick = () => { close(); siteSetLive(site, false); };
  const lv = box.querySelector('#spLive'); if (lv) lv.onclick = () => { close(); siteSetLive(site, true); };
}
// Off the web, and back, at the same address.
//
// THIS REPLACES A BUTTON THAT LIED. `siteUnpublish` POSTed `/api/site/unpublish`
// — a path with ZERO occurrences in worker.js — and on the 404 told the owner
// "couldn't take it offline just now, try again", so the site stayed up and they
// retried forever. The server owns the wording now, because it is the only side
// that knows whether there is a saved copy to put back.
function siteSetLive(site, live) {
  const slug = String(site.slug || '');
  if (!slug || siteBusy) return;
  const origin = site.id;
  siteBusy = true;
  site.msgs.push({ r: 'a', t: live ? '\u21bb Putting your site back online\u2026' : '\u23f9 Taking your site off the web\u2026' });
  sitesSave(); renderSites();
  // `on: true` means OFFLINE, matching the route's name.
  apiFetch('/api/site/' + encodeURIComponent(slug) + '/offline', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ on: !live }),
  }).then(async (r) => {
    const d = await r.json().catch(() => ({}));
    siteBusy = false;
    const s = siteById(origin); if (!s) return;
    if (r.ok && d.ok) {
      // OFFLINE IS ITS OWN STATE, not the absence of a live URL. A site with no
      // URL has never been built; one that is offline has been, and the panel has
      // to tell somebody which of those they are looking at.
      s.offline = !live;
      s.msgs.push({ r: 'a', t: d.msg || (live ? '\u2705 Back online.' : '\u23f9 Taken offline.') });
      if (typeof sbToast === 'function') sbToast(live ? 'Back online.' : 'Site taken offline.');
    } else {
      // THE SERVER'S OWN WORDS. A 409 means there was no saved copy to put back
      // and it refused rather than wiping — a generic "try again" there sends the
      // owner round a loop that cannot succeed.
      s.msgs.push({ r: 'a', t: d.msg || '\u26a0\ufe0f Couldn\u2019t do that just now \u2014 your site is unchanged.' });
    }
    sitesSave();
    if (siteOpenId === origin) renderSites();
  }).catch(() => {
    siteBusy = false;
    const s = siteById(origin);
    if (s) { s.msgs.push({ r: 'a', t: '\u26a0\ufe0f Couldn\u2019t reach the server \u2014 your site is unchanged.' }); sitesSave(); renderSites(); }
  });
}

// and the stage (Preview / Code / More). Skinned in Go Farther's own dark + pink→amber.
function renderSiteWorkspace(view, site) {
  const pages = sitePages(site);
  const active = siteActivePage(site);
  const curHtml = active ? active.html : '';
  const isReact = !!(site.react && site.url);
  const hasSite = !!curHtml || isReact;
  // Browser-frame URL chip: the live path once published (drafts have a slug too).
  const previewUrl = siteChipUrl(site, active && active.path);
  const picker = pages.length > 1
    ? '<div class="st-pagepick"><button type="button" class="st-pagebtn" id="stPageBtn">' + esc(active ? active.name : 'Home') + ' <span class="st-cv">▾</span></button>' +
        '<div class="st-pagemenu" id="stPageMenu" hidden>' + pages.map((p) =>
          '<button type="button" class="st-pageitem' + (active && p.path === active.path ? ' on' : '') + '" data-path="' + esc(p.path) + '"><span class="st-pi-name">' + esc(p.name) + '</span><span class="st-pi-path">' + esc(p.path) + '</span></button>').join('') +
        '</div></div>'
    : '<span class="st-tb-page">Homepage</span>';
  view.innerHTML =
    '<div class="st-ws st-lv' + (siteRailHidden ? ' st-rail-hidden' : '') + '">' +
      '<div class="st-topbar">' +
        '<div class="st-tb-left">' +
          '<button type="button" class="st-icon" id="stBack" title="Your sites" aria-label="Back to your sites">' + ic('back', 18) + '</button>' +
          '<button type="button" class="st-icon' + (siteRailHidden ? '' : ' on') + '" id="stRailToggle" title="' + (siteRailHidden ? 'Show chat' : 'Hide chat') + '" aria-label="Hide or show the chat panel"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/></svg></button>' +
          '<div class="st-tb-names">' +
            '<span class="st-ws-name" title="' + esc(site.name) + '">' + esc(site.name) + '</span>' +
            '<span class="st-ws-sub">' + (hasSite ? (pages.length > 1 ? pages.length + ' pages' : 'Previewing last saved version') : 'New project') + '</span>' +
          '</div>' +
          '<button type="button" class="st-icon' + (siteRail === 'history' ? ' on' : '') + '" id="stHist" title="Edit history" aria-label="Edit history">' + ic('history', 17) + '</button>' +
        '</div>' +
        '<div class="st-tb-mid">' +
          '<div class="st-vtabs">' +
            '<button type="button" class="st-vtab' + (siteView === 'preview' ? ' on' : '') + '" data-view="preview">' + ic('globe', 14) + ' Preview</button>' +
            (isReact ? '' : '<button type="button" class="st-vtab' + (siteView === 'code' ? ' on' : '') + '" data-view="code">' + ic('code', 14) + ' Code</button>') +
            ((isReact && site.backend) ? '<button type="button" class="st-vtab' + (siteView === 'data' ? ' on' : '') + '" data-view="data">' + ic('grid', 14) + ' Data</button>' : '') +
            '<button type="button" class="st-vtab' + (siteView === 'more' ? ' on' : '') + '" data-view="more">' + ic('grid', 14) + ' More</button>' +
          '</div>' +
        '</div>' +
        '<div class="st-tb-right">' +
          // THE PREVIEW-ONLY CONTROLS. Two things here stop the view tabs moving
          // when you switch away from Preview, and both are needed.
          //
          // They live in THIS group rather than in `.st-tb-mid`, which is centred
          // by its total width — so with these inside it the tabs slid 66px right
          // the moment you left Preview, and another 8px on a multi-page site
          // where the picker is wider than the word "Homepage". Both measured.
          // They still read as sitting just right of the tabs: this group begins
          // exactly where the centred tabs end, and `margin-right: auto` parks
          // them at that edge while everything else stays flush right.
          //
          // And they are always RENDERED, only hidden, because the two side
          // groups split the bar between them — so removing this block still
          // moves the centre. Reserving the space keeps both sides the same
          // width in every view.
          '<div class="st-tb-pv' + (siteView === 'preview' ? '' : ' st-tb-pv-off') + '"' +
            (siteView === 'preview' ? '' : ' aria-hidden="true"') + '>' + picker +
            '<button type="button" class="st-icon" id="stReload" title="Refresh preview" aria-label="Refresh preview">' + ic('reload', 15) + '</button></div>' +
          '<div class="st-devs">' +
            '<button type="button" class="st-dev' + (siteDevice === 'desktop' ? ' on' : '') + '" data-dev="desktop" title="Desktop">' + ic('desktop', 16) + '</button>' +
            '<button type="button" class="st-dev' + (siteDevice === 'tablet' ? ' on' : '') + '" data-dev="tablet" title="Tablet">' + ic('tablet', 16) + '</button>' +
            '<button type="button" class="st-dev' + (siteDevice === 'phone' ? ' on' : '') + '" data-dev="phone" title="Phone">' + ic('phone', 16) + '</button>' +
          '</div>' +
          (site.slug ? '<button type="button" class="st-icon" id="stInbox" title="Form submissions" aria-label="Form submissions">' + ic('inbox', 16) + '</button>' : '') +
          (site.slug ? '<button type="button" class="st-icon" id="stMembers" title="Site members" aria-label="Site members">' + ic('users', 16) + '</button>' : '') +
          (isReact ? '' : '<button type="button" class="st-icon" id="stDl" title="Download page HTML" aria-label="Download page HTML"' + (hasSite ? '' : ' disabled') + '>' + ic('download', 16) + '</button>') +
          '<button type="button" class="st-share" id="stShare">Share</button>' +
          // THE "Live ↗" LINK IS GONE (owner's call, 2026-08-08). A React site
          // publishes as part of the build, so there was nothing for it to do
          // that Share does not already do — and it opened the raw
          // `/s/<slug>/` URL in a new tab, which reads as "here is your site on
          // some weird page" rather than as the customer's own address. Share
          // is the one way out of this screen now.
          (isReact
            ? ''
            : '<button type="button" class="st-publish" id="stPub"' + (hasSite ? '' : ' disabled') + '>Publish</button>') +
        '</div>' +
      '</div>' +
      '<div class="st-body">' +
        '<div class="st-rail">' +
          (siteRail === 'history'
            ? siteHistoryRail(site)
            : '<div class="st-date">' + esc(stStamp(site.updatedAt || site.createdAt)) + '</div>' +
              '<div class="st-thread" id="stThread"></div>' +
              '<div class="st-comp">' +
                '<textarea id="stRevise" class="st-comp-in" rows="2" placeholder="Ask Go Farther…"></textarea>' +
                '<div class="st-attach" id="stAttach"></div>' +
                '<div class="st-comp-row">' +
                  '<button type="button" class="st-plus" id="stPlus" title="Attach a logo, a photo, a PDF menu or price list" aria-label="Attach a file">+</button>' +
                  buildPickerHTML() +
                  buildEffortHTML() +
                  (siteBusy
                    ? '<button type="button" class="st-sendc st-stopc" id="stStop" title="Stop" aria-label="Stop generating">■</button>'
                    : '<button type="button" class="st-sendc" id="stSend" title="Send" aria-label="Send">↑</button>') +
                '</div>' +
              '</div>') +
        '</div>' +
        '<div class="st-stage" id="stStage" data-dev="' + siteDevice + '">' +
          ((siteBusy && siteBuild && siteBuild.react && !isReact)
            // A first React build has no preview yet → show a compile placeholder in
            // the stage; the live code is in the chat. (A React revise keeps its
            // existing preview visible and just reloads it when done.)
            ? '<div class="st-frame"><div class="st-frame-bar"><span class="st-frame-url">' + esc(previewUrl) + '</span></div><div class="st-building"><div class="st-bring"></div><div class="st-building-t">' + esc(reactStageLabel()) + '</div></div></div>'
            : !hasSite
              ? (siteBusy && siteBuild
                  ? '<div class="st-empty"><div class="st-livelog st-livelog-stage"></div></div>'
                  : '<div class="st-empty">' + (siteBusy ? 'Building your site — this takes a minute or two…' : 'Describe your site on the left to build the first draft.') + '</div>')
              : (!isReact && siteView === 'code')
                ? siteCodeView(site, active, pages)
                : (isReact && site.backend && siteView === 'data')
                  ? '<div class="st-datawrap" id="stData"><div class="st-empty">Loading your data…</div></div>'
                  : siteView === 'more'
                    ? siteMoreView(site)
                    : '<div class="st-frame"><div class="st-frame-bar"><span class="st-frame-url">' + esc(previewUrl) + '</span></div><iframe id="stFrame" sandbox="allow-scripts allow-forms allow-popups" title="Site preview"></iframe></div>') +
          ((hasSite && siteView === 'preview')
            ? '<div class="st-fixbar" id="stFixBar" hidden><span class="st-fixbar-ic">' + ic('alert', 15) + '</span><span class="st-fixbar-n"></span><button type="button" class="st-fixbar-btn" id="stFixBtn">Fix with AI</button><button type="button" class="st-fixbar-x" id="stFixX" aria-label="Dismiss">×</button></div>'
            : '') +
          ((siteErr && siteErr.chatId === site.id)
            ? '<div class="st-errcard"><div class="st-err-h"><span class="st-err-ic">' + ic('alert', 16) + '</span> Error</div><div class="st-err-b">That change didn’t go through — you weren’t charged.</div>' +
              '<div class="st-err-row"><button type="button" class="st-err-logs" id="stErrLogs">Dismiss</button><button type="button" class="st-err-fix" id="stErrFix">Try to fix ⏎</button></div></div>'
            : '') +
        '</div>' +
      '</div>' +
    '</div>';
  bindSiteNav();
  const thread = document.getElementById('stThread');
  if (thread) {
    const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    thread.innerHTML = (site.msgs || []).map((m) => m.r === 'u'
      ? '<div class="st-msg u">' + esc(m.t) + '</div>'
      : '<div class="st-msg a">' + (m.note ? '<div class="st-note">' + esc(m.note) + '</div>' : '') + linkify(m.t) + (m.why ? '<div class="st-why">' + esc(m.why) + '</div>' : '') + (m.build ? reactStepsHTML(m.build) : '') + siteAskHTML(m, site) + '<span class="st-acts"><button type="button" class="st-act" data-copy="1" title="Copy">⧉</button></span></div>'
    ).join('') + (siteBusy
      ? (siteBuild
          ? (siteBuild.react
              ? '<div class="st-msg a st-busy st-busy-react">' + reactLiveStepsHTML() + '</div>'
              : '<div class="st-msg a st-busy"><div class="st-livelog"></div></div>')
          : '<div class="st-msg a st-busy">Working</div>')
      : '');
    if (siteBusy && siteBuild && !siteBuild.react) paintBuildLog();
    thread.scrollTop = thread.scrollHeight;
    thread.querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => {
      const txt = (b.closest('.st-msg') || {}).textContent || '';
      try { navigator.clipboard.writeText(txt.replace(/⧉\s*$/, '').trim()); } catch (e) {}
    });
    // Delegated: expand/collapse a step row's ▾ (works for live-repainted rows too),
    // and answering the builder's own question. Delegated rather than bound per
    // button because the thread is re-rendered wholesale on every message, so a
    // per-node handler would be rebound constantly and lost on the next repaint.
    thread.onclick = (e) => {
      if (!e.target.closest) return;
      const skip = e.target.closest('[data-skip]');
      if (skip && thread.contains(skip)) { siteAnswer('', true); return; }
      const ans = e.target.closest('[data-ans]');
      if (ans && thread.contains(ans)) { siteAnswer(ans.getAttribute('data-ans')); return; }
      const h = e.target.closest('[data-steptog]');
      if (h && thread.contains(h)) h.parentNode.classList.toggle('open');
    };
  }
  const fr = document.getElementById('stFrame');
  if (fr && isReact) {
    // React sites are served compiled at /s/<slug>/ — point the iframe straight
    // there (cache-busted per revise) instead of the draft-preview HTML path.
    //
    // THE PICKED PAGE IS A REAL PATH. It rode in the hash while the generated
    // app was built on `createHashHistory()`, and the comment here used to give
    // the reason: a real path needed the server to answer `/s/<slug>/press`
    // with something, and it answered 404. It answers that now — with the
    // route's prerendered HTML, or the app shell — so the fragment stopped
    // being the mechanism and became the bug, leaving the frame on the home
    // page whatever the picker said. Same fix as `switchSitePage`.
    const at = (active && active.path) || '/';
    fr.src = site.url + (at !== '/' ? String(at).replace(/^\//, '') : '') + '?v=' + (site.previewV || 1);
  } else if (fr && curHtml) {
    sitePreviewErrs[site.id + '|' + (site.active || '/')] = []; // fresh page load → clear stale errors
    loadSitePreview(fr, curHtml, site.slug);
  }
  paintPreviewErrBadge(); // hidden until the preview reports errors
  // "Fix with AI": route the caught runtime errors through the normal revise flow.
  const fixBtn = document.getElementById('stFixBtn');
  if (fixBtn) fixBtn.onclick = () => {
    const errs = (sitePreviewErrs[previewErrKey()] || []).slice(0, 6);
    if (!errs.length) return;
    const detail = errs.map((x, i) => (i + 1) + '. ' + x.msg + (x.info ? ' [' + x.info + ']' : '')).join('\n');
    const bar = document.getElementById('stFixBar'); if (bar) bar.hidden = true;
    siteSend('The live page is throwing these JavaScript errors — find the root cause in the code and fix it, changing as little else as possible:\n' + detail);
  };
  const fixX = document.getElementById('stFixX');
  if (fixX) fixX.onclick = () => { sitePreviewErrs[previewErrKey()] = []; const bar = document.getElementById('stFixBar'); if (bar) bar.hidden = true; };
  // View tabs (Preview / Code / More).
  view.querySelectorAll('.st-vtab').forEach((b) => b.onclick = () => { siteView = b.dataset.view; renderSites(); });
  // Code view: clicking a page "file" switches which page's code shows.
  view.querySelectorAll('[data-codepath]').forEach((b) => b.onclick = () => {
    const s = siteById(siteOpenId); if (!s) return; s.active = b.dataset.codepath; sitesSave(); renderSites();
  });
  const codeDl = document.getElementById('stCodeDl');
  if (codeDl && curHtml) codeDl.onclick = () => {
    const blob = new Blob([curHtml], { type: 'text/html' }); const u = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = u; a.download = (active ? siteFileName(active) : 'index.html'); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 5000);
  };
  // More sub-nav (Analytics / Cloud / Security / SEO).
  view.querySelectorAll('[data-more]').forEach((b) => b.onclick = () => { siteMoreTab = b.dataset.more; renderSites(); });
  if (siteView === 'more' && siteMoreTab === 'analytics' && site.slug) loadSiteAnalytics(site);
  if (isReact && site.backend && siteView === 'data') loadSiteData(site);
  // Cloud cards that are live open their real panels.
  view.querySelectorAll('[data-cloud]').forEach((b) => b.onclick = () => {
    if (b.dataset.cloud === 'database') siteDatabase(site);
    else if (b.dataset.cloud === 'insights') siteInsights(site);
    else if (b.dataset.cloud === 'backups') siteBackups(site);
    else if (b.dataset.cloud === 'versions') siteVersions(site);
    else if (b.dataset.cloud === 'secrets') siteSecrets(site);
    else if (b.dataset.cloud === 'functions') siteFunctions(site);
    else if (b.dataset.cloud === 'files') siteFiles(site);
    else if (b.dataset.cloud === 'emails') siteEmails(site);
    else if (b.dataset.cloud === 'payments') sitePayments(site);
    else if (b.dataset.cloud === 'domains') siteDomains(site);
    // WITHOUT THIS BRANCH THE MEMBERS CARD FELL THROUGH TO THE INBOX — a card
    // promising "Accounts that sign up in your app" that opened form
    // submissions, while the whole server-side member API sat unreachable.
    else if (b.dataset.cloud === 'members') siteMembers(site);
    else siteInbox(site);
  });
  // Deep security scan — no route behind it, so the button stays disabled and is
  // wired to nothing rather than to a call that 404s (see moreSecurity).

  // History rail toggle + restore.
  const hist = document.getElementById('stHist');
  if (hist) hist.onclick = () => { siteRail = siteRail === 'history' ? 'chat' : 'history'; renderSites(); };
  // Collapse/expand the chat rail WITHOUT re-rendering — so the preview iframe
  // never reloads and any half-typed message survives.
  const railTog = document.getElementById('stRailToggle');
  if (railTog) railTog.onclick = () => {
    siteRailHidden = !siteRailHidden;
    const ws = view.querySelector('.st-ws');
    if (ws) ws.classList.toggle('st-rail-hidden', siteRailHidden);
    railTog.classList.toggle('on', !siteRailHidden);
    railTog.title = siteRailHidden ? 'Show chat' : 'Hide chat';
  };
  view.querySelectorAll('[data-restore]').forEach((b) => b.onclick = () => siteRestore(siteOpenId, +b.dataset.restore));
  // "Try to fix" error card.
  const errFix = document.getElementById('stErrFix');
  if (errFix) errFix.onclick = () => { siteErr = null; siteSend('There was an error on this page — please find and fix it.'); };
  const errLogs = document.getElementById('stErrLogs');
  if (errLogs) errLogs.onclick = () => { siteErr = null; renderSites(); };
  const back = document.getElementById('stBack');
  if (back) back.onclick = () => { siteOpenId = null; renderSites(); };
  const rl = document.getElementById('stReload');
  if (rl) rl.onclick = () => { const f = document.getElementById('stFrame'); if (f && curHtml) loadSitePreview(f, curHtml, site.slug); };
  // Page picker: toggle the menu; clicking a page switches the active page.
  const pageBtn = document.getElementById('stPageBtn');
  const pageMenu = document.getElementById('stPageMenu');
  if (pageBtn && pageMenu) {
    const onOutside = (ev) => { if (!ev.target.closest('.st-pagepick')) { pageMenu.hidden = true; document.removeEventListener('click', onOutside); } };
    pageBtn.onclick = (e) => {
      e.stopPropagation();
      if (pageMenu.hidden) { pageMenu.hidden = false; setTimeout(() => document.addEventListener('click', onOutside), 0); }
      else { pageMenu.hidden = true; document.removeEventListener('click', onOutside); }
    };
    pageMenu.querySelectorAll('[data-path]').forEach((b) => b.onclick = () => switchSitePage(b.dataset.path));
  }
  view.querySelectorAll('.st-dev').forEach((b) => b.onclick = () => {
    siteDevice = b.dataset.dev;
    const st = document.getElementById('stStage');
    if (st) st.setAttribute('data-dev', siteDevice);
    view.querySelectorAll('.st-dev').forEach((x) => x.classList.toggle('on', x === b));
  });
  const dl = document.getElementById('stDl');
  if (dl) dl.onclick = () => {
    if (!curHtml) return;
    const blob = new Blob([curHtml], { type: 'text/html' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const pn = (active && active.path && active.path !== '/') ? active.path.replace(/^\//, '') : (site.name || 'index');
    a.href = u; a.download = String(pn).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.html';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 5000);
  };
  // Share: copy the live URL.
  //
  // `liveUrl` IS THE LEGACY FIELD, set by the old static engine's publish step —
  // which no longer exists. A React site is published by the build itself and
  // records `site.url` (`/s/<slug>/`), so every React site said "publish it
  // first" about a page that was already live at a URL the panel was showing
  // three inches away. `site.url` is a path, so it is absolutized here: a
  // clipboard full of "/s/x/" is not a link anybody can send.
  const sh = document.getElementById('stShare');
  if (sh) sh.onclick = () => {
    const live = site.liveUrl || (site.url ? new URL(site.url, location.origin).href : '');
    if (live) { try { navigator.clipboard.writeText(live); } catch (e) {} if (typeof sbToast === 'function') sbToast('Live link copied — ' + live); }
    else if (typeof sbToast === 'function') sbToast('Publish it first, then you can share the live link.');
  };
  // Publish: push the site live to gofarther.dev/s/<slug> (or Republish to update).
  const pb = document.getElementById('stPub');
  if (pb) {
    // NOT "Republish" — a React site publishes as part of the build, so there is
    // nothing to re-do. The panel behind it is about the one thing that IS a
    // choice: whether the site is on the web at all.
    if (site.liveUrl) pb.textContent = site.offline ? 'Offline' : 'Live';
    pb.onclick = () => { if (!pb.disabled) sitePublishPanel(site); };
  }
  const ib = document.getElementById('stInbox');
  if (ib) ib.onclick = () => siteInbox(site);
  const mb = document.getElementById('stMembers');
  const plusBtn = document.getElementById('stPlus');
  if (plusBtn) plusBtn.onclick = siteAttachOpen;
  paintAttachStrip();
  const sendBtn = document.getElementById('stSend');
  const stopBtn = document.getElementById('stStop');
  if (stopBtn) stopBtn.onclick = siteStop;
  const ta = document.getElementById('stRevise');
  if (sendBtn && ta) {
    sendBtn.onclick = () => { const t = ta.value.trim(); if (!t || siteBusy) return; ta.value = ''; siteSend(t); };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.onclick(); } };
    ta.focus();
  }
  wireBuildPicker();
  wireBuildEffort();
}
// #4 — LIVE build activity (Claude-Code-style running log). The server only
// speaks at a few checkpoints (plan done, each page done, photos), which leaves
// long silent gaps during the actual Gemini calls. So the CLIENT runs a ticker
// that keeps the words moving the whole time — a rotating "current step" line
// over an accumulating list of finished steps (✓). It starts the instant Send is
// hit (before any server event) so there's zero dead air.
const ST_TICK = {
  plan: ['Reading your brief', 'Planning the pages', 'Choosing a design direction', 'Picking fonts & colors', 'Setting the brand voice', 'Sketching the layout'],
  design: ['Designing {p}', 'Laying out {p}', 'Writing the copy for {p}', 'Styling the components', 'Building the sections', 'Refining the spacing', 'Wiring the buttons & links'],
  photos: ['Art-directing the photos', 'Generating the imagery', 'Placing the hero shot', 'Optimizing the images', 'Polishing the details'],
  finish: ['Reviewing the code', 'Final touches', 'Wrapping up'],
};
function siteBuildStart(react) {
  // STARTS IN `thinking`, NOT `generating`. This runs the instant a message is
  // sent — before the router has said whether it is even a build — and starting
  // at `generating` is what made "hey" paint "Writing the code".
  siteBuild = { phase: 'plan', pages: [], done: [], tick: 0, react: !!react, code: '', file: '', rphase: 'thinking', images: [], filesSeen: [], agents: {} };
  if (siteTicker) clearInterval(siteTicker);
  // React builds repaint on stream events, not on a timer — the timer only drives
  // the classic rotating activity log.
  siteTicker = setInterval(() => { if (!siteBuild || siteBuild.react) return; siteBuild.tick++; paintBuildLog(); }, 1500);
}
function siteBuildStop() { siteBuild = null; if (siteTicker) { clearInterval(siteTicker); siteTicker = null; } }
// ---- React builder: Claude-Code-style "what it did" step rows (live + finished) ----
function stHlCode(t) { return esc(t).replace(/\b(import|from|export|default|function|return|const|let|className)\b/g, '<span class="kw">$1</span>').replace(/(&quot;[^&]*?&quot;)/g, '<span class="str">$1</span>'); }
function stStepRow(o) { // {label, meta, state:'run'|'done'|'wait', body, open}
  const mark = o.state === 'run' ? '<span class="st-step-run"></span>'
    : o.state === 'done' ? '<span class="st-step-tick">✓</span>'
    // A STEP THAT FAILED. There were three states and none of them could say
    // "this did not work", which is why the compile step reported a tick on a
    // build that had just failed to compile.
    : o.state === 'fail' ? '<span class="st-step-fail">✕</span>'
    : '<span class="st-step-wait"></span>';
  return '<div class="st-step' + (o.open ? ' open' : '') + (o.body ? '' : ' st-step-nobody') + '">' +
    '<div class="st-step-h"' + (o.body ? ' data-steptog' : '') + '><span class="st-step-chev">' + (o.body ? '▶' : '') + '</span>' + mark +
    '<span class="st-step-lbl">' + esc(o.label) + '</span>' + (o.meta ? '<span class="st-step-meta">' + esc(o.meta) + '</span>' : '') + '</div>' +
    (o.body ? '<div class="st-step-b">' + o.body + '</div>' : '') + '</div>';
}
function stFilesBody(files) { return '<div class="st-fchips">' + (files || []).map((f) => '<span class="st-fchip">' + esc(String(f).split('/').pop()) + '</span>').join('') + '</div>'; }
function stImgsBody(imgs) { return '<div class="st-ithumbs">' + (imgs || []).map((im) => '<span class="st-ithumb"><img src="' + esc(im.url) + '" alt="" loading="lazy"><em>' + esc(String(im.prompt || '').slice(0, 70)) + '</em></span>').join('') + '</div>'; }
function stCodeBody(txt, cursor) { return '<pre class="st-lc">' + stHlCode(txt) + (cursor ? '<span class="st-lc-cur"></span>' : '') + '</pre>'; }
// Multi-agent fan-out: one chip per agent with its model + running/done state (shown when MULTI_AGENT streams).
function stAgentsBody(agents) {
  const keys = Object.keys(agents || {});
  if (!keys.length) return '';
  const short = (m) => /opus/i.test(m || '') ? 'Opus' : /sonnet/i.test(m || '') ? 'Sonnet' : (m || '');
  const nice = (k) => k === 'shell' ? 'shell' : k === 'design' ? 'design' : k === 'backend' ? 'backend' : k.replace(/^page:/, '');
  return '<div class="st-agents">' + keys.map((k) => {
    const a = agents[k]; const done = a.status === 'done';
    return '<span class="st-agent' + (done ? ' done' : ' run') + '">' + (done ? '✓' : '<span class="st-agent-run"></span>') + ' ' + esc(nice(k)) + ' <em>' + esc(short(a.model)) + '</em></span>';
  }).join('') + '</div>';
}
// Finished build, stored on an assistant message — collapsed by default.
function reactStepsHTML(b) {
  const rows = [];
  rows.push(stStepRow({ label: 'Wrote the code', meta: (b.files && b.files.length ? b.files.length + ' files' : ''), state: 'done', body: stFilesBody(b.files) }));
  if (b.images && b.images.length) rows.push(stStepRow({ label: 'Generated images', meta: b.images.length + (b.images.length === 1 ? ' photo' : ' photos'), state: 'done', body: stImgsBody(b.images) }));
  // THE OUTCOME, NOT A DECORATION. Both of these were `state: 'done'` no matter
  // what happened, so a build whose pages did not compile showed a green tick
  // beside "Compiled React" and another beside "Published" — directly under our
  // own sentence explaining that the pages had failed and the site was showing
  // its data model. Two contradictory claims, and the tick is the one people
  // believe. `page` is 'app' when a real site published and 'placeholder' when
  // the fallback did.
  const ok = b.page !== 'placeholder';
  rows.push(stStepRow({ label: ok ? 'Compiled React' : 'Could not compile', meta: (b.buildMs ? (b.buildMs / 1000).toFixed(1) + 's' : ''), state: ok ? 'done' : 'fail' }));
  // Something IS published either way — a placeholder is a real page at a real
  // address — so this stays a tick and says which of the two it is instead.
  rows.push(stStepRow({ label: ok ? (b.revised ? 'Rebuilt & published' : 'Published') : 'Published the data model', meta: b.slug || '', state: 'done' }));
  if (b.backend) rows.push(stStepRow({ label: 'Set up the database', meta: 'live', state: 'done' }));
  return '<div class="st-steps">' + rows.join('') + '</div>';
}
// Live steps while a React build/revise streams (reads siteBuild).
function reactLiveStepsHTML() {
  const sb = siteBuild || {};
  // NOTHING CLAIMS TO BE HAPPENING YET. Carries `st-steps-live` because that is
  // the selector `paintReactLive` swaps — without it the transition from
  // thinking to the real steps would never repaint, which is invisible in the
  // markup and total at runtime.
  if (sb.rphase === 'thinking') return '<div class="st-steps st-steps-live"><div class="st-think"><i></i>Thinking</div></div>';
  // NO "GENERATING IMAGES" STEP, because nothing generates any (owner's call,
  // 2026-08-08). The React builder has never produced an image: the generator in
  // worker.js is from the static-site era and is not reachable from the build
  // path, and nothing anywhere emits the `image` stream event this UI listens
  // for. So the row appeared on every build, sat pending, and then reported
  // itself DONE — a step claiming work that was never even attempted. The same
  // dead-control shape as the Builder picker and the Attach button, this time
  // lying rather than merely doing nothing.
  //
  // The receiving half is deliberately kept: the ingest below and the finished-
  // build row are both guarded on there BEING images, so they show nothing today
  // and light up on their own if generation is ever wired. That is the honest
  // version — a step that reports what happened rather than what was planned.
  const order = ['generating', 'compiling', 'fixing', 'publishing', 'database'];
  const idx = Math.max(0, order.indexOf(sb.rphase || 'generating'));
  const st = (name) => { const i = order.indexOf(name); return i < idx ? 'done' : i === idx ? 'run' : 'wait'; };
  // BY NAME, NOT BY NUMBER. These were `idx > 0`, `idx > 2`, `idx >= 4` — magic
  // indices into the array above, so removing one phase from it silently
  // re-pointed all of them at the wrong step. Named, the list can change without
  // the labels quietly following it.
  const past = (name) => order.indexOf(name) < idx;
  const reached = (name) => order.indexOf(name) <= idx;
  const rows = [];
  rows.push(stStepRow({ label: past('generating') ? 'Wrote the code' : 'Writing the code', meta: sb.file || '', state: st('generating'), open: true, body: stAgentsBody(sb.agents) + stCodeBody((sb.code || '').slice(-2600), st('generating') === 'run') }));
  if (sb.images && sb.images.length) rows.push(stStepRow({ label: 'Generated images', meta: sb.images.length + (sb.images.length === 1 ? ' photo' : ' photos'), state: 'done', body: stImgsBody(sb.images) }));
  if (sb.rphase === 'fixing') rows.push(stStepRow({ label: 'Fixing a build error', state: 'run' }));
  else rows.push(stStepRow({ label: past('compiling') ? 'Compiled React' : 'Compiling React', state: st('compiling') }));
  if (reached('publishing')) rows.push(stStepRow({ label: past('publishing') ? 'Published' : 'Publishing', state: st('publishing') }));
  if (sb.rphase === 'database') rows.push(stStepRow({ label: 'Setting up the database', state: 'run' }));
  return '<div class="st-steps st-steps-live">' + rows.join('') + '</div>';
}
function paintReactLive() {
  const host = document.querySelector('#stThread .st-steps-live');
  if (host) host.outerHTML = reactLiveStepsHTML();
  const pre = document.querySelector('#stThread .st-steps-live .st-lc'); if (pre) pre.scrollTop = pre.scrollHeight;
  const th = document.getElementById('stThread'); if (th) th.scrollTop = th.scrollHeight;
}
function reactStageLabel() {
  const p = (siteBuild && siteBuild.rphase) || 'generating';
  // No `images` entry — see reactLiveStepsHTML. Nothing sets that phase, so the
  // label was unreachable and said something untrue if it ever were reached.
  return { thinking: 'Thinking…', generating: 'Writing the code…', compiling: 'Compiling your app…', fixing: 'Fixing a build error…', publishing: 'Publishing…', database: 'Setting up the database…' }[p] || 'Building…';
}
// Read the React build/revise NDJSON stream: fold code/phase/image into the live
// steps, return the terminal {done|error} payload.
async function readReactStream(r, origin) {
  const reader = r.body.getReader(); const dec = new TextDecoder();
  let buf = '', final = null;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
      if (!line) continue;
      let ev; try { ev = JSON.parse(line); } catch (e) { continue; }
      if (siteOpenId !== origin || !siteBuild) { if (ev.ev === 'done') final = ev; else if (ev.ev === 'error') final = { error: true, msg: ev.msg, code: ev.code, need: ev.need }; continue; }
      if (ev.ev === 'code') {
        siteBuild.code = (siteBuild.code || '') + ev.t;
        const mm = siteBuild.code.match(/===FILE:\s*([^=\n]+?)\s*===/g);
        if (mm) { const f = mm[mm.length - 1].replace(/===FILE:\s*/, '').replace(/\s*===/, '').trim(); siteBuild.file = f; if (siteBuild.filesSeen.indexOf(f) < 0) siteBuild.filesSeen.push(f); }
        paintReactLive();
      } else if (ev.ev === 'phase') { siteBuild.rphase = ev.phase; paintReactLive(); }
      else if (ev.ev === 'agent') { (siteBuild.agents = siteBuild.agents || {})[ev.key] = { model: ev.model, status: ev.status }; paintReactLive(); }
      else if (ev.ev === 'agents') { siteBuild.picker = ev.picker; paintReactLive(); }
      else if (ev.ev === 'image') { (siteBuild.images = siteBuild.images || []).push({ prompt: ev.prompt, url: ev.url }); paintReactLive(); }
      else if (ev.ev === 'done') final = ev;
      else if (ev.ev === 'error') final = { error: true, msg: ev.msg, code: ev.code, need: ev.need };
    }
  }
  return final || { error: true };
}
// Finish a React build/revise: stop the live log, append the assistant message
// WITH its step data (so the collapsed rows persist in the thread), re-render.
// WHY A BUILD CAME BACK AS THE DATA MODEL — or shipped with something wrong.
//
// The platform diagnoses this completely and threw the diagnosis away at the
// last layer: `stage`, `error` and `cited` (the exact source lines the compiler
// pointed at) came back on every failed build, `problems` (the lint's findings)
// and `functionErrors` (model-written SQL that failed to create) came back even
// on a SUCCESSFUL one — and `public/chat.js` rendered none of the five. The
// owner was told "the pages didn't compile" and had to open devtools to learn
// anything more. Measured 2026-08-09: fifteen minutes hunting for an answer the
// response already carried, on a build that cost ~20 credits.
//
// BOUNDED, because tsc echoes one mistake through the whole tree: the first few
// lines are the causes and the tail is the echo. `cited` is the useful half and
// is already capped at four server-side.
function buildWhy(d) {
  if (!d) return '';
  const out = [];
  const line = (x, n) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, n || 220);
  if (d.page === 'placeholder') {
    if (typeof d.stage === 'string' && d.stage) out.push('stage: ' + line(d.stage, 40));
    if (typeof d.error === 'string' && d.error.trim()) {
      const first = d.error.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 4);
      for (const l of first) out.push(line(l, 300));
    }
  }
  if (Array.isArray(d.cited)) for (const c of d.cited.slice(0, 4)) out.push(line(c));
  // These two are NOT gated on the placeholder: a site can publish with a page
  // the lint refused, or with a confirmation function that never got created —
  // and those are exactly the failures nobody would otherwise notice, because
  // the site looks fine until a visitor hits the broken part.
  if (Array.isArray(d.problems)) for (const p of d.problems.slice(0, 4)) out.push('lint: ' + line(p));
  if (Array.isArray(d.functionErrors)) {
    for (const f of d.functionErrors.slice(0, 3)) {
      out.push('function ' + line(f && f.name, 40) + ': ' + line(f && f.error, 160));
    }
  }
  return out.join('\n');
}

function siteFinishBuild(origin, reply, build, note, why) {
  siteBusy = false; siteBuildMsg = ''; siteBuildStop();
  const s = siteById(origin); if (!s) return;
  // `note` is its OWN field rather than being prepended to `t` with a blank
  // line. `.st-msg` has no `white-space: pre-wrap`, so a newline inside the
  // text collapses to a space and the note runs into the result as one
  // paragraph — which buries exactly the sentence that has to be noticed
  // ("couldn't read your link"). Caught by looking at a render; every test
  // passed. Stored on the message so it survives a reload, since the thread is
  // rebuilt from localStorage.
  s.msgs.push({ r: 'a', t: reply, note: note || undefined, why: why || undefined, build: build });
  s.updatedAt = Date.now(); sitesSave();
  if (siteOpenId === origin) renderSites();
}
// Ask the router whether this is a question, then either answer it or build.
//
// ONE extra call in front of the build path, ~0.3 credits, and it pays for
// itself the first time somebody types a question at an existing site — that
// used to cost a full revise and overwrite their pages with an answer to it.
//
// EVERY failure mode here falls through to the build. A 401, a 500, a network
// drop, a body that is not what we expect: all of them call `reactSend` exactly
// as before. This sits in front of a path that works and must never be the
// reason it does not run — the same asymmetry the server-side reader takes, for
// the same reason. Getting it wrong toward "build" costs a build they can see;
// getting it wrong toward "ask" silently does not build what they asked for.
function siteRoute(site, t, origin, isBuild, imgs, finish, answering) {
  // THE BRIEF THE BUILD RUNS ON, not the message that was just typed. After a
  // clarify round `t` is "Book a time slot" and the real brief — "a barber shop
  // in Leeds" — is three messages back. Losing it here would build a site about
  // booking a time slot and nothing else, which is the failure this whole path
  // has to be written around.
  const round = (isBuild && site.clarify) || null;
  const brief = round ? round.brief : t;
  const qa = round ? round.qa.slice(0, 8) : [];
  // THE ANSWERS ARE FOLDED IN ON THE SERVER, by `clarifiedBrief` in
  // builder/site-ask.mjs. Composing them here would be a second implementation
  // of the sentence the designer reads, in a file that cannot import the first —
  // and two copies of a prompt fragment is how the two quietly stop agreeing.
  // THE ROUND ENDS THE MOMENT A BUILD STARTS, and it has to end here rather than
  // when the build returns: left set, the next thing they type would be read as
  // an answer to a question that is no longer on screen, forever.
  const go = () => {
    const s = siteById(origin);
    if (s && s.clarify) { s.clarify = null; sitesSave(); }
    reactSend(site, brief, origin, isBuild ? 'build' : 'revise', imgs, finish, qa);
  };
  // What the answer is allowed to know. Names only — a `collect` table holds
  // customer names and phone numbers and none of that belongs in a routing call.
  const digest = {
    name: site.name || '',
    url: site.url || '',
    pages: sitePages(site).map((p) => p.path).slice(0, 24),
    tables: Array.isArray(site.tables) ? site.tables.slice(0, 24) : [],
  };
  apiFetch('/api/site/route', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    // `firstBuild` is what opens the question path at all, and it is `isBuild` —
    // the same flag that decides build-vs-revise — so a revise can never be
    // interviewed. The server re-derives the budget from `qa` regardless.
    // `attached` closes off "ask" the way `answering` does, and leaves the
    // question open. A file plus a sentence is an instruction, so answering it
    // with a paragraph would drop the file on the floor — but that says nothing
    // about whether a FIRST build should be asked what the business is.
    // `slug` and `hasSite` OPEN THE TWO CHEAP RUNGS. Until they were sent, the
    // router had two work answers and on an existing site the only one it could
    // give was `build` — a ~25-credit rewrite of every page, for a change of
    // colour. `hasSite` is deliberately not `!isBuild`: that flag is about this
    // project having pages in localStorage, this one is about the SERVER owning
    // a published site at that slug, and the server re-checks it anyway.
    body: JSON.stringify({ message: t, site: digest, firstBuild: !!isBuild, brief: brief, qa: qa, answering: !!answering, attached: !!(imgs && imgs.length), slug: site.slug || '', hasSite: !!(site.slug && sitePages(site).length) }),
  }).then(async (r) => {
    const d = await r.json().catch(() => null);
    if (!r.ok || !d) return go();
    // A QUESTION FOR THEM, before anything is built or charged. Rendered as an
    // ordinary assistant message carrying options; the round is remembered on
    // the site so the answer can be put back together with the brief.
    if (d.intent === 'clarify' && d.question && Array.isArray(d.question.options) && d.question.options.length >= 2) {
      siteBusy = false;
      siteBuildMsg = '';
      siteBuildStop();
      const s0 = siteById(origin);
      if (!s0) return;
      s0.clarify = { brief: brief, qa: qa, imgs: imgs || [] };
      s0.msgs.push({ r: 'a', t: String(d.question.text), q: String(d.question.text), opts: d.question.options.slice(0, 4) });
      s0.updatedAt = Date.now();
      sitesSave();
      if (siteOpenId === origin) renderSites();
      return;
    }
    // A CHEAP CHANGE, ON ITS OWN ROUTE. `edit` is the bottom rung of the ladder
    // — words, colours, the theme, the fonts, the name — and none of it runs the
    // page generator, so it costs a fraction of a revise and takes seconds.
    //
    // EVERY FAILURE FALLS THROUGH TO `go()`, which is the revise that used to be
    // the only answer. That is what makes trying the cheap rung first safe: the
    // worst case is the customer waits a moment longer for the outcome they
    // would have got anyway. So this must never surface an escalation as an
    // error — the change still happens, one rung up.
    if (d.intent === 'edit' && site.slug) return siteEdit(site, d, t, origin, finish, go, imgs);
    // THE MIDDLE RUNG. Adds a page or a table and keeps everything else; costs a
    // few credits where the revise below costs ~25 and rewrites pages that were
    // fine. Falls through to that revise on anything it cannot do, exactly like
    // the edit above it.
    if (d.intent === 'addon' && site.slug) return siteAddon(site, t, origin, finish, go);
    if (d.intent !== 'ask' || !d.answer) return go();
    // A QUESTION. Nothing is built, nothing on the site changes, and the reply
    // is an ordinary assistant message — no build steps, because there was no
    // build and a steps block over an answer would claim one.
    siteBusy = false;
    siteBuildMsg = '';
    siteBuildStop();
    const s = siteById(origin);
    if (!s) return;
    // The answer alone. What it cost shows up in the ✦ pill, which `apiFetch`
    // already refreshes for this route — safe there, unlike the build, because
    // this is a plain JSON response whose charge is settled before it answers.
    s.msgs.push({ r: 'a', t: String(d.answer) });
    s.updatedAt = Date.now();
    sitesSave();
    if (siteOpenId === origin) renderSites();
  }).catch(go);
}
// The cheap rung: change what the site already has, without rewriting a page.
//
// `fallback` IS THE WHOLE SAFETY ARGUMENT and it is the revise that used to be
// the only answer. Anything this lane cannot do — a layer it does not implement,
// a site with no stored source, a look change that really does need pages
// rewritten — comes back `escalate:true` and lands there, so the customer gets
// the change either way and the worst case is that they waited a moment longer.
// That is what makes trying the cheap rung first safe, and it is why an
// escalation must NEVER be shown as an error.
//
// The two that are NOT escalations are the two a bigger lane cannot fix either:
// a stored source that moved under us (retrying is the fix) and a compile that
// failed (the site is untouched, and rewriting every page to fix a typo is the
// trade nobody would make). Those the customer is told about, in the server's
// own words.
function siteEdit(site, d, instruction, origin, finish, fallback, imgs) {
  const slug = String(site.slug || '');
  if (!slug) return fallback();
  apiFetch('/api/site/' + encodeURIComponent(slug) + '/edit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      layer: String(d.layer || ''),
      page: d.page ? String(d.page) : '',
      // THE ROUTER DECIDES A DELETION, not the pages model — three attempts to
      // get the model to volunteer it failed against words it was demonstrably
      // reading. Passed through verbatim as a real boolean, so nothing merely
      // truthy on the wire can take a customer's page away.
      remove: d.remove === true,
      instruction: instruction,
      picker: buildPicker,
      // THE UNDO. A deleted row is gone from the table, so the server cannot
      // show the model what "put it back" refers to — the client is the only
      // party that still holds it, because it rendered the contents in the
      // reply. Sent only on the data layer, which is the only one that could
      // act on it.
      recent: d.layer === 'data' && Array.isArray(site.undoRows) && site.undoRows.length
        ? site.undoRows.slice(0, 3) : undefined,
      // THE ATTACHED PICTURE, AND ONLY WHERE IT MEANS SOMETHING. The logo layer
      // is the one rung where the attachment IS the instruction — it is which
      // picture, and there is nothing else to resolve it against. Sent on that
      // layer alone so no other edit carries a megabyte of base64 it will not
      // read.
      images: d.layer === 'logo' && Array.isArray(imgs) && imgs.length ? imgs.slice(0, 3) : undefined,
    }),
  }).then(async (r) => {
    const e = await r.json().catch(() => null);
    // A body we cannot read is not a refusal — it is us not knowing, and the
    // rung above still works.
    if (!e) return fallback();
    if (e.escalate) return fallback();
    if (!r.ok || !e.ok) {
      // The server's own sentence when it has one. `buildDownMsg` already knows
      // to drop the "try again in a few seconds" advice on a failure that no
      // amount of retrying fixes.
      if (e.msg) { finish('⚠️ ' + e.msg); return; }
      return fallback();
    }
    // PUBLISHED. Bump the cache-buster the same way a revise does, or the
    // preview keeps showing the old bundle and the change reads as not applied.
    scheduleCreditRefresh();
    const s = siteById(origin);
    if (s) {
      s.previewV = (s.previewV || 0) + 1;
      // REMEMBER WHAT WENT, so the next message can undo it. Replaced by a
      // later removal and CLEARED by an add, because once a row has been put
      // back, carrying it forward is a standing offer to put it back again on
      // an unrelated change.
      // A DELETED PAGE LEAVES THE PICKER, exactly as it does on the addon lane.
      // Told it is gone and still offered it is the same lie either way.
      const cut = (Array.isArray(e.removed) ? e.removed : []).map(sitePathOf).filter(Boolean);
      if (cut.length && Array.isArray(s.pages)) s.pages = s.pages.filter((q) => !(q && cut.indexOf(q.path) >= 0));
      const rows = Array.isArray(e.applied) ? e.applied : [];
      const gone = rows.filter((r) => r && r.removed && r.was).map((r) => ({ table: r.table, was: r.was }));
      if (gone.length) s.undoRows = gone.slice(0, 3);
      else if (rows.some((r) => r && r.id === undefined)) s.undoRows = null;
      sitesSave();
    }
    finish(editReply(e));
  }).catch(fallback);
}
// The middle rung: add a page or a table, keep everything else.
//
// Same contract as `siteEdit` — every failure falls through to the revise, and
// an escalation is never surfaced as an error — but this one CAN take a while
// (a model call plus a container build), so the step rows stay running rather
// than being stopped the way a question stops them.
function siteAddon(site, instruction, origin, finish, fallback) {
  const slug = String(site.slug || '');
  if (!slug) return fallback();
  apiFetch('/api/site/' + encodeURIComponent(slug) + '/addon', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction: instruction, picker: buildPicker }),
  }).then(async (r) => {
    const a = await r.json().catch(() => null);
    if (!a) return fallback();
    if (a.escalate) return fallback();
    if (!r.ok || !a.ok) {
      if (a.msg) { finish('⚠️ ' + a.msg); return; }
      return fallback();
    }
    scheduleCreditRefresh();
    const s = siteById(origin);
    if (s) {
      s.previewV = (s.previewV || 0) + 1;
      // A NEW PAGE HAS TO REACH THE PICKER, or the customer is told it was added
      // and cannot open it. Merged rather than replaced: the response names only
      // what this addon touched, and `s.pages` is the whole site.
      const added = (Array.isArray(a.added) ? a.added : []).map(sitePathOf).filter(Boolean);
      if (added.length && Array.isArray(s.pages)) {
        for (const p of added) if (!s.pages.some((q) => q && q.path === p)) s.pages.push({ path: p });
      }
      // AND A PAGE THAT WENT HAS TO LEAVE THE PICKER. Adding without removing is
      // the same lie the other way round: the customer is told the page is gone,
      // the picker still offers it, and opening it lands on a route the site no
      // longer has. The two halves belong in one place, or the next person adds
      // a third field and keeps only the flattering one.
      // The SELECTION needs nothing: `sitePageActive` resolves `site.active`
      // with `|| pages[0]`, so a path that has left the list falls back to the
      // home page on its own. Clearing it here would be a line that cannot
      // change what anybody sees.
      const removed = (Array.isArray(a.removed) ? a.removed : []).map(sitePathOf).filter(Boolean);
      if (removed.length && Array.isArray(s.pages)) {
        s.pages = s.pages.filter((q) => !(q && removed.indexOf(q.path) >= 0));
      }
      sitesSave();
    }
    finish(addonReplyText(a));
  }).catch(fallback);
}
// `src/routes/gallery.tsx` OR a bare `gallery.tsx` → `/gallery`. Kept in step
// with `routeOf` in builder/site-addon.mjs; the client cannot import it.
//
// THE PREFIX IS OPTIONAL AND THAT IS THE WHOLE POINT. This anchored on
// `^src/routes/` while the edit and addon lanes return the BARE stored path —
// `cleanPath` strips the prefix on the way in and the container puts it back —
// so every `added`/`changed`/`removed`/`kept` path mapped to '' and was
// filtered away by the `.filter(Boolean)` below. New pages never entered the
// page picker, deleted pages never left it, and the replies named no pages at
// all. `routeOf` was fixed for exactly this on 2026-08-12 and this copy, which
// lives in the browser, was not: the FIFTH instance of one shape being read by
// code anchored on the other. Both spellings are accepted here for the same
// reason they are there — assuming one is what cost the last four.
function sitePathOf(file) {
  const m = String(file || '').match(/^(?:src\/routes\/)?(.+)\.tsx$/i);
  if (!m) return '';
  const rel = m[1];
  if (rel === 'index') return '/';
  if (rel.endsWith('/index')) return '/' + rel.slice(0, -'/index'.length);
  return '/' + rel;
}
// What the addon did, naming the pages — including the one they did not ask
// about. The nav link is a page this lane touches on its own, and not saying so
// is how a legitimate change reads as the site being altered behind them.
function addonReplyText(a) {
  const added = (Array.isArray(a.added) ? a.added : []).map(sitePathOf).filter(Boolean);
  const changed = (Array.isArray(a.changed) ? a.changed : []).map(sitePathOf).filter(Boolean);
  const removed = (Array.isArray(a.removed) ? a.removed : []).map(sitePathOf).filter(Boolean);
  const bits = [];
  if (added.length) bits.push('added ' + added.join(', '));
  if (removed.length) bits.push('removed ' + removed.join(', '));
  if (changed.length) bits.push('linked it from ' + changed.join(', '));
  if (Array.isArray(a.tables) && a.tables.length) bits.push('now storing ' + a.tables.join(', '));
  let out = bits.length ? '✅ Done — ' + bits.join(', ') + '.' : '✅ Done.';
  out += photoNote(a.photos);
  // A PAGE WE REFUSED TO DELETE IS SAID PLAINLY. Keeping it quietly is the
  // silent partial this lane already had once: asked for gone, told it worked,
  // still there.
  for (const k of (Array.isArray(a.kept) ? a.kept : []).slice(0, 3)) {
    if (!k || !k.path) continue;
    const p = sitePathOf(k.path);
    out += k.why === 'home'
      ? ' I left ' + p + ' — that\u2019s the home page, and removing it would leave the site with no front door.'
      : ' I left ' + p + ' — ' + (k.from || []).map(sitePathOf).filter(Boolean).join(', ') +
        ' still links to it. Ask me to take the link out first.';
  }
  // A REVERT IS SAID OUT LOUD — the customer's own page being put back. Composed
  // the same way the server composes it, because chat.js cannot import the module.
  const back = (Array.isArray(a.reverted) ? a.reverted : []).map(sitePathOf).filter(Boolean).slice(0, 3);
  if (back.length) {
    out += ' I left ' + back.join(', ') + ' as ' + (back.length === 1 ? 'it was' : 'they were') +
      ' — nothing there needed to change for this. Ask me directly if you did want ' +
      (back.length === 1 ? 'it' : 'them') + ' edited.';
  }
  const un = Array.isArray(a.unlinked) ? a.unlinked : [];
  if (un.length) out += ' Nothing links to ' + un.join(', ') + ' yet — say where you want the link and I’ll add it.';
  return out + problemNote(a.problems);
}
// WHAT THE LINT FOUND, appended to whatever the lane reported.
//
// The server returns `problems` on every path that generates a page and NEITHER
// reply rendered them, so a page that publishes while calling `fetch`, naming a
// table that does not exist or hardcoding a colour said "✅ Done." and nothing
// else. A lint problem deliberately does not block publishing — the site is real
// and usable — but a problem nobody is shown is a problem nobody fixes.
//
// ONE helper, used by both replies. Two copies drift into one lane reporting and
// the other not, which is the shape this session keeps finding.
function problemNote(list) {
  const p = (Array.isArray(list) ? list : []).filter((x) => typeof x === 'string' && x.trim()).slice(0, 3);
  if (!p.length) return '';
  // The lint's own sentences, which are written to the person who has to act on
  // them. Rewording them here would be a second place they can be wrong.
  return ' ⚠️ ' + p.join(' ');
}
// What an edit actually did, in one line.
//
// NAMES WHAT MOVED. A customer who asks for one thing and gets four changed
// cannot see that from the site, and "done" tells them nothing they can check.
function editReply(e) {
  if (e.layer === 'text') {
    // NAMES WHAT IT NOW SAYS. "Updated the wording in 3 places" is a number the
    // owner cannot check — the same class as the two silent partials this file
    // already fixed, one notch milder. The server returns the new strings.
    const n = Number(e.applied) || 0;
    const said = (Array.isArray(e.changed) ? e.changed : [])
      .filter((x) => typeof x === 'string' && x.trim()).slice(0, 3)
      .map((x) => '“' + x.slice(0, 60) + '”');
    return '✅ Updated the wording' + (n > 1 ? ' in ' + n + ' places' : '') +
      (said.length ? ' — now ' + said.join(', ') : '') + '.' + problemNote(e.problems);
  }
  if (e.layer === 'data') {
    // NAMES WHAT MOVED, because this layer changes rows the customer cannot see
    // in the page source — "done" leaves them with nothing to check.
    const rows = Array.isArray(e.applied) ? e.applied : [];
    const gone = rows.filter((r) => r && r.removed);
    const rest = rows.filter((r) => !(r && r.removed));
    const uniq = [...new Set(rest.map((r) => (r.id === undefined ? 'added to ' : '') + r.table).filter(Boolean))];
    const bits = [];
    if (rest.length) bits.push('updated ' + (rest.length === 1 ? 'one entry' : rest.length + ' entries') +
      (uniq.length ? ' in ' + uniq.join(', ') : ''));
    if (gone.length) bits.push('removed ' + (gone.length === 1 ? 'one entry' : gone.length + ' entries'));
    let out = bits.length ? '✅ ' + bits.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.' : '✅ Done.';
    // WHAT WENT, IN WORDS. A deleted row has no version history to restore from,
    // so the contents sitting in the thread ARE the undo — "put that back" is
    // one sentence with the data already on screen.
    for (const g of gone.slice(0, 3)) {
      const w = g && g.was && typeof g.was === 'object' ? g.was : null;
      if (!w) continue;
      const cols = Object.keys(w).filter((k) => k !== 'id' && w[k] != null && String(w[k]).trim());
      const desc = cols.slice(0, 3).map((k) => k + ' ' + String(w[k]).slice(0, 40)).join(', ');
      // NAMED, NOT "say the word". Bare "undo that" is genuinely ambiguous to
      // the router \u2014 it could be a page, a colour or a row \u2014 and would be
      // classified as something that cannot restore anything. Handing them the
      // words to say makes the request data-shaped, which is the one lane that
      // can act on it, and turns a vague promise into a concrete one.
      const name = String(w[cols[0]] || '').slice(0, 40);
      if (desc) out += ' Gone from ' + g.table + ': ' + desc +
        (name ? '. Say \u201cput ' + name + ' back\u201d and I\u2019ll restore it.' : '');
    }
    if (e.failed) out += ' ' + e.failed + ' couldn\u2019t be saved \u2014 try that one again.';
    return out;
  }
  if (e.layer === 'picture') {
    // THE SERVER NAMES THE PICTURE. A src is not something the owner can check,
    // so the reply quotes the description the slot already carries — and the
    // module is the only thing that knows which ones could not be made, which is
    // the half a second copy here would eventually drop.
    return (typeof e.msg === 'string' && e.msg.trim() ? e.msg.trim() : '✅ Done.');
  }
  if (e.layer === 'rules') {
    // THE SERVER WROTE THIS ONE. `rulesReply` is the single place a rule change
    // becomes words, and it is the only place that knows what was REFUSED — a
    // second copy here would eventually drop the refusal and report a booking
    // table that still takes double bookings as a plain success.
    //
    // NOTHING WAS REPUBLISHED, and the owner is told so: a rule that changes no
    // page still changes what the site does the moment it applies, and somebody
    // waiting for their site to redeploy would refresh and see nothing move.
    const said = typeof e.msg === 'string' && e.msg.trim() ? e.msg.trim() : '✅ Done.';
    return said + ' It’s live now — nothing needed rebuilding.';
  }
  if (e.layer === 'page' && Array.isArray(e.removed) && e.removed.length) {
    // FREE, AND SAYING SO IS THE POINT. This is the one change that costs nothing
    // but a recompile, and the customer has been told for months that editing
    // pages is expensive.
    const gone = e.removed.map(sitePathOf).filter(Boolean);
    return '✅ Took ' + (gone.join(', ') || 'that page') + ' off the site. Every publish is kept, ' +
      'so say the word if you want it back.' + problemNote(e.problems);
  }
  if (e.layer === 'page') {
    // NAMES THE PAGE, AND NAMES WHAT IT REFUSED. This layer changes exactly one
    // file and drops anything else the model returned — deliberately, so one
    // instruction cannot rewrite a page nobody named. Reporting only "Done"
    // makes that a SILENT PARTIAL: ask for a link "on every page", get it on
    // one, and be told it worked.
    let out = '✅ Updated ' + (e.page || 'the page') + '.';
    const ign = Array.isArray(e.ignored) ? e.ignored.map(sitePathOf).filter(Boolean) : [];
    if (ign.length) {
      out += ' I only changed that one — ' + ign.join(', ') +
        (ign.length === 1 ? ' was' : ' were') + ' left alone. Ask again naming ' +
        (ign.length === 1 ? 'it' : 'them') + ' if you want the same change there.';
    }
    return out + photoNote(e.photos) + problemNote(e.problems);
  }
  if (e.layer === 'logo') {
    // THE SERVER'S OWN SENTENCE. It is the only side that knows whether the
    // logo went on or came off, and a generic "done" over a removal reads as
    // the builder not having understood.
    return String(e.msg || '✅ Done.');
  }
  if (e.layer === 'look') {
    // OUR FIELD NAMES ARE NOT THE CUSTOMER'S WORDS. `moved` carries the stored
    // look's own keys, and joining them raw produced "Updated the look — lang.",
    // which tells somebody nothing. It was already inconsistent with itself:
    // the branch four lines below says "the name" about the field this sentence
    // called "brand". Anything unmapped falls through unchanged, so a field
    // added later reads no worse than it does today.
    const SAY = { lang: 'language', brand: 'name', description: 'the description' };
    const moved = (Array.isArray(e.moved) ? e.moved : []).slice(0, 4);
    const tokens = (Array.isArray(e.tokens) ? e.tokens : []).slice(0, 4);
    const bits = moved.map(function (k) { return SAY[k] || k; }).concat(tokens);
    let out = '✅ Updated the look' + (bits.length ? ' — ' + bits.join(', ') : '') + '.';
    // A RENAME REACHES THE PAGES, and saying how far is the honest half. The
    // name is stored once and written into every page; the customer can check
    // the second half by looking, and a count of zero on a rename is the one
    // thing they need to know went wrong.
    if (moved.indexOf('brand') >= 0) {
      const n = Number(e.renamed) || 0;
      out += n
        ? ' Changed the name in ' + n + (n === 1 ? ' place' : ' places') + ' on the pages too.'
        : ' The title and link preview now use it, but I couldn’t find the old name written on any page — check the headings.';
    }
    return out + problemNote(e.problems);
  }
  return '✅ Done.';
}
// A PICTURE SLOT NOBODY CAN FILL, said out loud.
//
// Neither the edit nor the addon lane buys photographs — deliberate, because a
// revise re-buying pictures the owner already had was a ~94-credit bug — so a
// NEW page that wants one publishes with an empty frame. Four outcomes render
// that same blank box and only one is a bug, which is why the build path has
// `imageNote`; these two lanes had nothing, so the customer was left looking at
// a gap with no way to know it was theirs to fill.
function photoNote(n) {
  const c = Number(n) || 0;
  if (!c) return '';
  return ' There ' + (c === 1 ? 'is a space' : 'are ' + c + ' spaces') +
    ' for a photo — upload yours in the Data panel and ' + (c === 1 ? 'it' : 'they') + '\u2019ll fill in.';
}
// What to say when a build could not run.
//
// THE SERVER ALREADY KNOWS, AND WE WERE THROWING IT AWAY. Every 503 from the
// build route carries `msg` — a sentence written for the exact failure — plus
// `stage` and, for the one failure no retry can fix, `billing: true`. The client
// discarded all of it and printed "the builder's busy right now, give it a few
// seconds, then send again" for every 503 there is.
//
// Measured live 2026-08-08 on a real account: the model provider was returning
// 400 `invalid_request_error` because its balance was empty, the route correctly
// answered `billing: true` with "this is on us, not your brief" — and the
// customer saw "busy, try again" and sent the same message four times. Telling
// somebody to retry something that cannot succeed is worse than saying nothing:
// they spend the evening thinking it is their brief.
//
// So: the server's own words when it has them, and the retry advice ONLY when
// the failure is actually transient. `billing` is the flag for "no amount of
// retrying fixes this" — the route's own comment says exactly that.
function buildDownMsg(d) {
  const msg = (d && typeof d.msg === 'string' && d.msg.trim()) ? d.msg.trim() : '';
  const transient = !(d && d.billing);
  if (!msg) {
    return transient
      ? '⏳ The builder’s busy right now — give it a few seconds, then send again. (You weren’t charged.)'
      : '⚠️ The builder can’t run right now. (You weren’t charged.)';
  }
  return (transient ? '⏳ ' : '⚠️ ') + msg +
    (transient ? ' Give it a few seconds, then send again.' : '') + ' (You weren’t charged.)';
}
// The React build/revise send path (cutover engine). Build = first message on a
// project → /api/site/react-build; revise = any later message on a React site →
// /api/site/react-revise (same slug/URL). Streams live steps; charge-after.
function reactSend(site, t, origin, mode, imgs, finish, qa) {
  // WE KNOW IT IS A BUILD NOW, so the steps may appear. Set here rather than in
  // `siteRoute` because an attachment skips the router and comes straight here —
  // one place, so neither entry can leave it stuck on `thinking`.
  if (siteBuild) { siteBuild.rphase = 'generating'; paintReactLive(); }
  const endpoint = mode === 'build' ? '/api/site/react-build' : '/api/site/react-revise';
  // `picker` on BOTH, and it was on neither in any way that mattered until
  // 2026-08-08: the build sent it and the server read it zero times, and the
  // REVISE did not even send it. So the one path where somebody has already seen
  // a result and is reaching for a better model was the path that could not ask
  // for one. `effort` rides along on both and is still read by nothing — the
  // control is visible and inert on purpose (owner's call).
  // `qa` is what they were asked before the build and what they said. Sent RAW,
  // not folded into the brief here — the server composes it, so there is one
  // version of the sentence the designer ends up reading. Build only: questions
  // are never asked on a revise, so a revise has none to send.
  const body = mode === 'build'
    ? { brief: t, images: imgs, picker: buildPicker, effort: buildEffort, qa: qa || [] }
    : { slug: site.slug, instruction: t, images: imgs, picker: buildPicker, effort: buildEffort };
  siteAbort = new AbortController();
  apiFetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: siteAbort.signal }).then(async (r) => {
    const ct = r.headers.get('content-type') || '';
    const d = (r.ok && ct.indexOf('ndjson') >= 0) ? await readReactStream(r, origin) : await r.json().catch(() => ({}));
    // WHAT IT COST GOES TO THE METER, NOT INTO THE SENTENCE (owner's call
    // 2026-08-08). The reply used to end "(✦21 used)" on every build.
    //
    // THE REFRESH IS NOT OPTIONAL, it is the whole change. That text was the
    // ONLY signal a build had spent anything: the build response carries `cost`
    // and no `balance`, and nothing on this path has ever called `setCredits` —
    // so deleting the sentence without this leaves the pill stale until the next
    // page load, and the spend becomes invisible rather than quiet.
    //
    // HERE rather than in `apiFetch`, and that distinction is the reason the
    // build routes are absent from its list. `apiFetch` fires when the response
    // HEADERS arrive, which on the NDJSON build is the moment the build STARTS —
    // minutes before the charge, which lands after publish. A refresh there would
    // read the balance before anything was taken and paint a number that is
    // wrong in the reassuring direction.
    scheduleCreditRefresh();
    // A PLACEHOLDER BUILD IS A SUCCESS THAT CARRIES A REASON, and `!d.error` was
    // refusing exactly those. The route returns `error` alongside `ok:true`
    // whenever it fell back — validate, home, typecheck, build, generate — so the
    // most common real failure there is (a page that doesn't compile) took the
    // ERROR branch below, which tells the customer "you weren't charged" over
    // stages that ARE charged, and never records the slug/url/backend that were
    // really provisioned. The project then lost its link to its own database, and
    // the next message ran as a fresh first build against a slug already claimed.
    //
    // The placeholder-vs-app distinction it was reaching for already lives in
    // `d.page`, and the ⚠️ wording below is built on it. So this gates on the
    // route having answered, not on the answer being flawless.
    if (r.ok && d && d.error !== true && d.slug) {
      const s = siteById(origin);
      if (s) {
        s.react = true; s.slug = d.slug; s.url = d.url || ('/s/' + d.slug + '/');
        if (d.backend) s.backend = true; // this site now has its own database
        if (d.brand && typeof d.brand === 'string' && d.brand.trim()) s.name = d.brand.trim().slice(0, 40);
        // EVERY ROUTE IT WROTE, not one hardcoded entry. `filesSeen` is what the
        // stream reported live; `d.files` is the same list off the final
        // response, and is what a non-streaming answer leaves us with.
        const wrote = (siteBuild && siteBuild.filesSeen && siteBuild.filesSeen.length) ? siteBuild.filesSeen : d.files;
        const routed = reactRoutePages(wrote);
        // A revise that reported no files must not wipe the pages the last build
        // established — falling back to one entry is what made every React site
        // look like a single-page site in the first place.
        //
        // AND ONLY WHEN A REAL APP PUBLISHED. `routed` is what the model WROTE,
        // which on a placeholder build is a set of pages that failed to compile
        // and are therefore not at those addresses — the header read "6 pages"
        // and the picker offered five routes that all served the data-model
        // fallback. Seen live 2026-08-09.
        //
        // Skipping it is right for both failures, for different reasons: a
        // failed REVISE leaves the already-published site untouched, so the
        // pages it already had are still the true ones; a failed FIRST build
        // published one placeholder, which the fallback below records as a
        // single Home entry.
        if (d.page !== 'placeholder' && routed.length) s.pages = routed;
        else if (!Array.isArray(s.pages) || !s.pages.length) s.pages = [{ path: '/', name: 'Home', html: '' }];
        s.active = '/'; delete s.html;
        s.previewV = (s.previewV || 0) + 1; // cache-bust the preview iframe on revise
        siteSnap(s, t);
      }
      siteErr = null;
      // `built` is what the steps below have to key off. Without it every step
      // rendered a tick unconditionally, so a build whose pages failed to
      // compile showed "Compiled React ✓" directly above our own sentence
      // saying they had not compiled. Seen live 2026-08-09.
      const build = { files: (siteBuild && siteBuild.filesSeen && siteBuild.filesSeen.length) ? siteBuild.filesSeen.slice() : (d.files || []), images: (siteBuild && siteBuild.images) ? siteBuild.images.slice() : [], buildMs: d.buildMs, cost: d.cost, slug: d.slug, revised: mode === 'revise', backend: !!d.backend, page: d.page || '' };
      const name = (siteById(origin) || {}).name;
      // What was READ for this build — a linked page, a web lookup, or a link
      // we could not reach. Composed server-side (see contextSentence) because
      // this file cannot import the module that decides it, and a second copy
      // here would eventually claim a link was read when it wasn't. Sits on its
      // own line ahead of the result so a failed read is not buried after the
      // credit count.
      // AND WHAT HAPPENED TO THE PHOTOGRAPHS, on the same line. Four outcomes
      // render the identical placeholder on the published page — never wanted,
      // could not afford, the image model failed, wanted more than the cap — so
      // without a sentence the customer cannot tell a design choice from a
      // failure. Composed server-side (imageNote) for the same reason the
      // context note is: this file cannot import the module that decides it.
      // AND WHICH COLOUR MOVED. Same shape, same reason (tokenNote): a colour
      // silently not applied reads as the builder being broken rather than as a
      // request that did not land.
      const note = [
        (d && typeof d.contextNote === 'string') ? d.contextNote.trim() : '',
        (d && typeof d.tokensNote === 'string') ? d.tokensNote.trim() : '',
        (d && typeof d.imagesNote === 'string') ? d.imagesNote.trim() : '',
        // WHICH PAGE CAME BACK AS A STUB. There is now a middle outcome — the
        // site publishes with one page showing a placeholder — and this is the
        // only thing that names it. In the note block rather than glued to
        // `notes`, or it reads mid-paragraph the way contextNote once did.
        (d && typeof d.salvageNote === 'string') ? d.salvageNote.trim() : '',
      ].filter(Boolean).join('\n');
      // THE MODEL'S OWN SUMMARY, which the builder has always written and always
      // discarded — `notes` came back on every response and nothing rendered it,
      // so we paid for prose nobody read. Falls back to the canned line when the
      // model wrote nothing.
      const said = (d && typeof d.notes === 'string') ? d.notes.trim() : '';
      // AND WHETHER A SITE WAS ACTUALLY BUILT. `page` is 'app' or 'placeholder',
      // and a placeholder build still answers ok:true with a slug — so this said
      // '✅ Built “X”. Tell me what to change.' over the data-model fallback,
      // claiming a site that does not exist. `notes` on that path is our own
      // sentence explaining what went wrong, which is the thing to show.
      const built = !d || d.page !== 'placeholder';
      const canned = mode === 'revise' ? 'Updated — the preview’s refreshed.'
        : 'Built ' + (name ? '“' + name + '”' : 'your site') + '. Tell me what to change.';
      siteFinishBuild(origin, (built ? '✅ ' : '⚠️ ') + (said || canned), build, note, buildWhy(d));
    } else if (r.status === 402 || (d && d.need === 'credits')) {
      // THE SERVER'S OWN SENTENCE WINS, because on the picker-floor refusal it
      // names the FREE way out and this one does not. `buildFloor` answers with
      // the floor, the balance, and "switch the Builder to Sonnet 5" — its
      // comment says naming the cheaper picker is the point, since topping up
      // "is not the only way out and is the less useful one". That message was
      // composed and discarded here, so somebody on Opus with 30 credits was
      // sent to buy more instead of flipping a control back.
      finish('⚡ ' + ((d && d.msg) || 'You don’t have enough credits to build this right now. Tap your ✦ balance up top to get more.'));
    } else if (d && d.need === 'rebuild') {
      finish('That older draft can’t be edited directly — say “rebuild it” and I’ll regenerate it as a React app.');
    } else if (r.status === 429) { finish('⏳ You’ve hit today’s build limit — it resets within 24 hours.'); }
    else if (r.status === 501) { finish('⚠️ The build engine isn’t switched on yet — check back soon.'); }
    else if ((d && d.code === 429) || r.status === 503) { siteErr = null; finish(buildDownMsg(d)); }
    else { siteErr = { chatId: origin }; finish('⚠️ ' + ((d && d.msg) || 'That didn’t come together — you weren’t charged. Try again in a moment.')); }
    if (typeof fetchCredits === 'function') fetchCredits();
  }).catch((e) => {
    if (e && e.name === 'AbortError') { finish('■ Stopped. (A build already running may still finish server-side.)'); return; }
    siteErr = { chatId: origin }; finish('⚠️ Lost the connection while building — check your internet and try again in a moment.');
  }).finally(() => { siteAbort = null; });
}
function buildActiveText() {
  if (!siteBuild) return 'Working';
  const set = ST_TICK[siteBuild.phase] || ST_TICK.finish;
  let s = set[siteBuild.tick % set.length];
  if (s.indexOf('{p}') >= 0) {
    // Prefer pages still in progress (not yet ticked ✓), so the active line reads
    // as what it's actually working on.
    const pending = siteBuild.pages.filter((p) => !siteBuild.done.includes(p));
    const pool = pending.length ? pending : (siteBuild.pages.length ? siteBuild.pages : ['the page']);
    s = s.replace('{p}', pool[siteBuild.tick % pool.length]);
  }
  return s;
}
// Paint the running log in place — no full re-render (that would reload the
// preview iframe mid-build). Finished steps stay (dim, ✓); the active line
// pulses and rotates.
function paintBuildLog() {
  const active = buildActiveText();
  siteBuildMsg = active;
  const done = siteBuild ? siteBuild.done : [];
  const html = done.map((d) => '<div class="st-ll done">' + esc(d) + '</div>').join('') +
    '<div class="st-ll active"><span class="st-ll-dot"></span>' + esc(active) + '…</div>';
  const host = document.querySelector('.st-thread .st-livelog');
  if (host) { host.innerHTML = html; const th = document.querySelector('.st-thread'); if (th) th.scrollTop = th.scrollHeight; }
  const stageHost = document.querySelector('.st-stage .st-livelog');
  if (stageHost) stageHost.innerHTML = html;
  const empty = document.querySelector('.st-stage .st-empty'); if (empty && !stageHost) empty.textContent = active + '…';
}
// Fold a streamed checkpoint into the running log (advances the phase, appends
// finished steps). Called from readSiteStream with the raw event object.
function siteBuildStatus(origin, ev) {
  if (siteOpenId !== origin || !siteBuild) return;
  if (ev.ev === 'status') {
    if (ev.phase === 'design') { if (!siteBuild.done.includes('Planned the pages')) siteBuild.done.push('Planned the pages'); siteBuild.phase = 'design'; if (Array.isArray(ev.pages)) siteBuild.pages = ev.pages.slice(0, 8); }
    else if (ev.phase === 'photos') { siteBuild.phase = 'photos'; }
    else if (ev.phase === 'plan') { siteBuild.phase = 'plan'; }
    siteBuild.tick = 0;
  } else if (ev.ev === 'page') {
    if (ev.name && !siteBuild.done.includes(ev.name)) siteBuild.done.push(ev.name);
  }
  paintBuildLog();
}
// Read the NDJSON build stream: fold each {ev:"status"|"page"} into the live log,
// and return the terminal {ev:"done"|"error"} payload shaped like the old JSON
// body (so the existing result-handling branches below need no change).
async function readSiteStream(r, origin) {
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '', final = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
      if (!line) continue;
      let ev; try { ev = JSON.parse(line); } catch (e) { continue; }
      if (ev.ev === 'status' || ev.ev === 'page') siteBuildStatus(origin, ev);
      else if (ev.ev === 'done') final = ev;
      else if (ev.ev === 'error') final = { error: true, code: ev.code };
    }
  }
  return final || { error: true };
}
// The REAL engine (2026-07-18, Gemini-only, multi-page): the FIRST message on a
// project builds the whole site (a plan pass decides the pages + a shared design
// system, then each page is generated to match); every later message revises the
// ACTIVE page. Metered charge-after-success (no reserve/refund): the worker bills
// the measured Gemini cost + each generated Nano Banana Pro image, only once each
// step lands, so a failure costs nothing. Builds take a minute or two, streamed
// as NDJSON so the chat shows live steps.
// Answering the builder's own question, or refusing to.
//
// `label` is the option they clicked, or what they typed while a question was on
// screen — a typed reply is treated as the answer, because the builder has just
// asked them something and anything else would drop the brief on the floor. A
// correction ("no, make it a cafe") lands in the same place and the designer
// reads it as written; the pair is appended, never interpreted here.
//
// `skip` builds immediately with whatever has been gathered. It exists because
// the alternative to an escape is somebody who wrote a perfectly good brief
// being asked three questions about it, and this path is offered on EVERY new
// project.
// The options under a question the builder asked, and the way out of them.
//
// Rendered ONLY while that question is the live one — `site.clarify` is cleared
// the moment a build starts, so an answered question keeps its text in the
// thread and loses its buttons. Leaving them clickable would offer a second
// answer to something already built on the first.
function siteAskHTML(m, site) {
  if (!m || !m.q || !Array.isArray(m.opts) || !m.opts.length) return '';
  if (!site || !site.clarify) return '';
  // The LAST question only. A round asks one at a time, so an earlier one still
  // in the thread is history and its buttons would answer the wrong question.
  const live = [...(site.msgs || [])].reverse().find((x) => x && x.r === 'a' && x.q);
  if (!live || live !== m) return '';
  // NUMBERED, and the numbers are REAL — the keydown listener below this
  // function is what makes them so. A hint printed beside an option that does
  // nothing when pressed is worse than no hint: it teaches a shortcut and then
  // ignores it.
  return '<div class="st-opts">' +
    m.opts.slice(0, 4).map((o, i) =>
      '<button type="button" class="st-opt" data-ans="' + esc(String(o)) + '">' +
        '<kbd>' + (i + 1) + '</kbd><span>' + esc(String(o)) + '</span>' +
      '</button>').join('') +
    // ESC, NOT ENTER, and the mockup said Enter. Enter is the composer's send
    // key: bound here it either fights that or works only when the box happens
    // to be empty, which is a shortcut that silently does two different things.
    // Esc means dismiss everywhere else and collides with nothing.
    '<button type="button" class="st-opt st-opt-skip" data-skip="1">' +
      '<kbd>esc</kbd><span>Skip &mdash; just build it</span>' +
    '</button>' +
  '</div>';
}

// The keys behind the numbers.
//
// GUARDED ON WHERE THE FOCUS IS, which is the whole difficulty: the composer is
// a text field and the customer has just typed a brief into it, so a bare "1"
// bound globally would put a digit in the box on some paths and answer a
// question on others. Typing anywhere that takes text always wins.
//
// Modifiers are excluded too — Cmd+1 and Alt+1 are the browser's own tab
// switching, and stealing them to answer a question about a barber shop is not a
// trade anybody would accept.
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const el = e.target;
  const tag = el && el.tagName ? el.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || (el && el.isContentEditable)) return;
  const site = siteById(siteOpenId);
  if (!site || !site.clarify || siteBusy) return;
  if (e.key === 'Escape') { e.preventDefault(); siteAnswer('', true); return; }
  // The options of the LIVE question, read off the thread — the same one
  // `siteAskHTML` renders buttons for, so a number and a click cannot disagree
  // about which answer is which.
  const live = [...(site.msgs || [])].reverse().find((x) => x && x.r === 'a' && x.q);
  const opts = (live && Array.isArray(live.opts)) ? live.opts.slice(0, 4) : [];
  const n = Number(e.key);
  if (!(n >= 1 && n <= opts.length)) return;
  e.preventDefault();
  siteAnswer(opts[n - 1]);
});

function siteAnswer(label, skip) {
  const site = siteById(siteOpenId);
  if (!site || siteBusy || !site.clarify) return;
  const said = String(label || '').trim().slice(0, 200);
  if (!skip && !said) return;
  // The question this answers — the last one actually asked, read off the
  // thread rather than held in a second place that could disagree with it.
  const asked = [...(site.msgs || [])].reverse().find((m) => m && m.r === 'a' && m.q);
  if (!skip && asked) site.clarify.qa.push({ q: String(asked.q), a: said });
  site.msgs.push({ r: 'u', t: skip ? 'Skip the questions — just build it' : said });
  const origin = siteOpenId;
  const imgs = site.clarify.imgs || [];
  siteBusy = true;
  siteBuildStart(true);
  sitesSave();
  renderSites();
  const finish = (reply) => {
    siteBusy = false;
    siteBuildMsg = '';
    siteBuildStop();
    const s = siteById(origin);
    if (!s) return;
    s.msgs.push({ r: 'a', t: reply });
    s.updatedAt = Date.now();
    sitesSave();
    if (siteOpenId === origin) renderSites();
  };
  if (skip) {
    // Straight to the build. No routing call: they have said what they want and
    // paying a model to reclassify "just build it" would be the one question too
    // many this button exists to avoid.
    const round = site.clarify;
    site.clarify = null;
    sitesSave();
    reactSend(site, round.brief, origin, 'build', imgs, finish, round.qa);
    return;
  }
  // ANSWERING, and the server is told so. Without it the router may classify a
  // button press as a question and answer it — which is what happened live on
  // 2026-08-09: three answers in, "Sleek and modern" came back as "I'm not sure
  // what you'd like me to build", nothing was built, and the round was left on
  // an already-answered question.
  siteRoute(site, said, origin, true, imgs, finish, true);
}

function siteSend(text) {
  const site = siteById(siteOpenId);
  if (!site || siteBusy) return;
  const t = String(text || '').trim().slice(0, 2000);
  if (!t) return;
  // A QUESTION IS ON SCREEN, so this is the answer to it. Typing instead of
  // clicking is normal — the options cover the likely answers, not every answer
  // — and routing a typed reply down the ordinary path would start a fresh
  // build from those few words and lose the brief the round was about.
  if (site.clarify) { siteAnswer(t); return; }
  const isBuild = !sitePages(site).length;
  const active = siteActivePage(site);
  site.msgs.push({ r: 'u', t });
  siteBusy = true;
  // The React engine (build = new project, revise = any React site) drives its own
  // live step-rows; legacy static sites keep the classic activity log / no log.
  const reactPath = isBuild || site.react;
  if (reactPath) siteBuildStart(true); else if (isBuild) siteBuildStart(); else siteBuildStop();
  sitesSave();
  renderSites();
  const origin = siteOpenId;
  const finish = (reply) => {
    siteBusy = false;
    siteBuildMsg = '';
    siteBuildStop();
    const s = siteById(origin);
    if (!s) return;
    s.msgs.push({ r: 'a', t: reply });
    s.updatedAt = Date.now();
    sitesSave();
    if (siteOpenId === origin) renderSites();
  };
  const imgs = siteAttach.slice(0, 3); siteAttach = []; paintAttachStrip();
  // Cutover: new projects + React sites go through the streaming React engine.
  // IS THIS EVEN A BUILD? Until 2026-08-08 nothing asked: `isBuild` above is the
  // only decision there was, so every message on an existing site ran a full
  // revise — designer, generation, compile, republish. "can you read a URL?"
  // cost ~21 credits AND rewrote the customer's pages, and "hi" on a new project
  // built a site out of the word "hi".
  //
  // AN ATTACHMENT NO LONGER SKIPS THE QUESTION, only the answer.
  //
  // It used to skip this call entirely, on reasoning that was right about one
  // outcome and took a second one with it: a file plus a sentence is the shape
  // of "use this", so guessing "ask" answers a build request with a paragraph
  // and drops the attachment on the floor. True — and `attached` closes "ask"
  // off at the router instead, which is the narrow fix.
  //
  // What the skip also removed was the QUESTION. Owner's rule is that every new
  // project is asked one thing before ~28 credits are spent on a guess, and
  // attaching a logo to "a barber shop in Leeds" quietly opted out of it. The
  // attachment survives the round — `siteAnswer` carries `clarify.imgs` through
  // to the build — so there was never a reason it could not be asked.
  //
  // A REVISE WITH AN ATTACHMENT IS ROUTED AGAIN, and the reason it stopped
  // being skipped is worth keeping: the skip was justified by "both non-build
  // outcomes are already closed, so the call could only ever answer build" —
  // true of the layers that existed, and made FALSE by the `logo` layer. An
  // attached picture plus "this is my logo" now has a real, honest answer that
  // is neither a paragraph nor a ~27-credit rewrite of every page.
  //
  // The reasoning that closed `ask` still stands and is unchanged: `attached`
  // shuts it at the router, because answering a file with prose drops the file
  // on the floor. What re-opens is only the WORK answers.
  if (reactPath) { siteRoute(site, t, origin, isBuild, imgs, finish); return; }
  // A LEGACY STATIC SITE CANNOT BE EDITED — the engine that made it is gone.
  //
  // This posted to `POST /api/site`, deleted with the D1 runtime on 2026-07-27.
  // Measured live: 404. So every message on a pre-React project (still sitting in
  // some users' localStorage) failed forever with the generic "that build didn't
  // come together — you weren't charged. Try again in a moment", which reads as
  // transient and never was. The `d.need === 'rebuild'` escape below could not
  // fire either, because the server that sent that field is what was deleted.
  //
  // Said plainly instead, and the escape is real: "rebuild it" starts a fresh
  // React build, because `siteRebuild` clears the pages and `isBuild` is derived
  // from there being none. Deliberately NOT automatic — a rebuild spends credits
  // and replaces what they have, and neither should happen because somebody
  // typed a sentence.
  finish('This project was made with the older engine, which has been retired — I can\u2019t edit it in place. Say \u201Crebuild it\u201D and I\u2019ll regenerate it as a React app on the current builder.');
}
// Stop the in-flight build/revise: aborts the request so the UI stops waiting.
// (The server uses a charge-after model, so a generation that already completed
// may still bill — noted to the user — but the workspace is freed immediately.)
function siteStop() {
  if (siteAbort) { try { siteAbort.abort(); } catch (e) {} }
}

// Inbox: the site owner's form submissions (waitlist/contact/etc.), newest first.
async function siteInbox(site) {
  const slug = site.slug || (site.liveUrl || '').split('/s/')[1] || '';
  if (!slug) { if (typeof sbToast === 'function') sbToast('Publish the site first — then submissions show up here.'); return; }
  let box = document.getElementById('siteInboxModal');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'siteInboxModal';
  box.className = 'si-modal';
  box.innerHTML = '<div class="si-card"><div class="si-head"><b>Form submissions</b><button type="button" class="si-x" aria-label="Close">×</button></div><div class="si-body">Loading…</div></div>';
  document.body.appendChild(box);
  const close = () => box.remove();
  box.querySelector('.si-x').onclick = close;
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  const bodyEl = box.querySelector('.si-body');
  const fmtT = (t) => { try { if (!t) return ''; const iso = /^\d{4}-\d\d-\d\d \d\d:/.test(String(t)) ? String(t).replace(' ', 'T') + 'Z' : t; return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
  try {
    if (site.react && site.backend) {
      // React site: submissions are rows in the site's own `collect` tables,
      // read through the OWNER's door — the public API refuses a collect read
      // by design, which is why these were invisible to the person they were for.
      const sbase = '/api/site/' + encodeURIComponent(slug);
      const tr = await apiFetch(sbase + '/rows');
      const td = await tr.json().catch(() => ({}));
      const collectTables = ((td && td.tables) || []).filter((t) => t.access === 'collect');
      if (!collectTables.length) { bodyEl.innerHTML = '<div class="si-empty">No form yet. When your app has a form that saves entries, they land here.</div>'; return; }
      let html = '';
      for (const t of collectTables) {
        const rr = await apiFetch(sbase + '/rows/' + encodeURIComponent(t.name));
        const rd = await rr.json().catch(() => ({}));
        const rows = (rd && Array.isArray(rd.rows)) ? rd.rows : [];
        html += '<div class="si-count">' + esc(t.name) + ' · ' + rows.length + ' submission' + (rows.length === 1 ? '' : 's') + '</div>' + rows.map((row) => {
          const fields = Object.keys(row).filter((k) => k !== 'id' && k !== 'created_at' && k !== 'owner_id');
          return '<div class="si-item"><div class="si-item-top"><span class="si-form">' + esc(t.name) + '</span><span class="si-when">' + esc(fmtT(row.created_at)) + '</span></div>' +
            fields.map((k) => '<div class="si-row"><span class="si-k">' + esc(k) + '</span><span class="si-v">' + esc(String(row[k] == null ? '' : row[k])) + '</span></div>').join('') + '</div>';
        }).join('');
      }
      bodyEl.innerHTML = html;
      return;
    }
    // NO FALLBACK ANY MORE. This branch served D1-era sites through
    // `/api/site/submissions`, a route deleted with that runtime — so what a
    // pre-React site's owner actually got here was a 404 rendered as "couldn't
    // load submissions, try again", which is the same lie the Unpublish button
    // told. Every site the platform makes is React + Neon and takes the branch
    // above; anything that reaches here predates that and has no submissions
    // store left to read.
    bodyEl.innerHTML = '<div class="si-empty">This one was made before the current builder, so its submissions aren\u2019t stored any more. Anything sent to a form since then is in the Data panel.</div>';
    return;
  } catch (e) { bodyEl.innerHTML = '<div class="si-empty">Couldn’t load submissions just now — try again.</div>'; }
}

// Site members — the real end-user accounts that signed up on the published site
// (auth backend). Owner-only, RLS-scoped by their JWT. Mirrors the inbox modal.

// Shared: derive the slug + build a Cloud modal shell; returns {box, bodyEl, close}.
function stCloudModal(id, title) {
  let box = document.getElementById(id); if (box) box.remove();
  box = document.createElement('div'); box.id = id; box.className = 'si-modal';
  box.innerHTML = '<div class="si-card"><div class="si-head"><b>' + esc(title) + '</b><button type="button" class="si-x" aria-label="Close">×</button></div><div class="si-body">Loading…</div></div>';
  document.body.appendChild(box);
  const close = () => box.remove();
  box.querySelector('.si-x').onclick = close;
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  return { box, bodyEl: box.querySelector('.si-body'), close };
}
function stFmtTime(t) { try { if (!t) return '—'; const iso = /^\d{4}-\d\d-\d\d \d\d:/.test(String(t)) ? String(t).replace(' ', 'T') + 'Z' : t; return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return '—'; } }

// Insights — visitor traffic (page views + key actions) and the app's API request/error
// counts. Read-only; owner-scoped.
// The auth audit log — who signed in, who failed, and what the owner changed.
// Reads GET /api/site/<slug>/events, which is owner-only and GET-only; there is
// deliberately no member-facing view, because the log names other members and
// where they signed in from.

async function siteInsights(site) {
  const slug = site.slug || (site.liveUrl || '').split('/s/')[1] || '';
  if (!slug) { if (typeof sbToast === 'function') sbToast('Publish the site first — insights show up here.'); return; }
  const { bodyEl } = stCloudModal('siteInsightsModal', 'Insights');
  // REWRITTEN against the live route. This panel used to call
  // /api/site/backend/analytics and /backend/metrics, both deleted with the D1
  // runtime in July, and it asked for a shape nothing serves any more —
  // byEvent / byPath / totals.reqs. Not a path fix: /api/site/<slug>/analytics
  // answers {views, visitors, views7, visitors7, series}, which is different
  // data and, unlike the old per-event tracking, is actually being recorded.
  // site_hits has been written on every visit since the D1 era.
  try {
    const r = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/analytics');
    const d = await r.json().catch(() => ({}));
    // 503 is the route saying it could not READ, and it says so rather than
    // answering zeros — "nobody visited your site" is a very different and much
    // worse thing to tell someone than "try again". Honour that here.
    if (!r.ok) { bodyEl.innerHTML = '<div class="si-empty">Couldn\u2019t read your traffic just now — try again in a moment.</div>'; return; }
    const n = (v) => Number.isFinite(+v) ? +v : 0;
    const series = Array.isArray(d.series) ? d.series : [];
    const peak = series.reduce((m, x) => Math.max(m, n(x.views)), 0);
    const day = (iso) => { try { return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }); } catch (e) { return ''; } };
    // A bar per day, height by fill — no colour, so it survives greyscale.
    // A zero day still draws a hairline, or an empty week looks like missing
    // data rather than a quiet week.
    const chart = series.length
      ? '<div class="si-days">' + series.map((x) => '<div class="si-day" title="' + esc(String(x.day)) + ' \u00b7 ' + n(x.views) + '"><span class="si-day-bar"><i style="height:' + (peak ? Math.max(2, Math.round(n(x.views) / peak * 100)) : 2) + '%"></i></span><span class="si-day-k">' + esc(day(String(x.day))) + '</span></div>').join('') + '</div>'
      : '<div class="si-empty">No visits recorded yet.</div>';
    bodyEl.innerHTML =
      '<div class="si-stat-row">' +
        '<div class="si-stat"><b>' + n(d.views) + '</b><span>views \u00b7 all time</span></div>' +
        '<div class="si-stat"><b>' + n(d.visitors) + '</b><span>visitors \u00b7 all time</span></div>' +
      '</div>' +
      '<div class="si-stat-row">' +
        '<div class="si-stat"><b>' + n(d.views7) + '</b><span>views \u00b7 last 7 days</span></div>' +
        '<div class="si-stat"><b>' + n(d.visitors7) + '</b><span>visitors \u00b7 last 7 days</span></div>' +
      '</div>' +
      '<div class="si-panel-sub">Last 7 days</div>' + chart +
      '<div class="si-note">A visitor is counted once a day. Bots are not counted.</div>';
  } catch (e) { bodyEl.innerHTML = '<div class="si-empty">Couldn\u2019t load insights just now — try again.</div>'; }
}

async function siteBackups(site) {
  // EXPORT ONLY, and renamed to say so. This panel used to offer snapshot,
  // restore and import as well — all four of those called /api/site/backend/*,
  // deleted with the D1 runtime in July, so the buttons were there and none of
  // them did anything. `/api/site/<slug>/export` is real and always was.
  //
  // Offering a "Restore" that 404s is worse than not offering one: somebody
  // deletes data believing they can put it back.
  const slug = site.slug || (site.liveUrl || '').split('/s/')[1] || '';
  if (!slug) { if (typeof sbToast === 'function') sbToast('Publish the site first — then you can export your data.'); return; }
  const { bodyEl } = stCloudModal('siteBackupsModal', 'Export data');
  bodyEl.innerHTML = '<p class="sp-intro">Download a copy of everything your site has collected. CSV opens in a spreadsheet; JSON is for moving it somewhere else.</p><div id="bkList">Loading…</div>';

  // Authed download → blob. A plain <a href> cannot send the Bearer token.
  const dl = async (table, fmt) => {
    try {
      const r = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/export?table=' + encodeURIComponent(table) + '&format=' + fmt);
      if (!r.ok) { if (typeof sbToast === 'function') sbToast('Export failed — try again.'); return; }
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = slug + '-' + table + '.' + fmt;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    } catch (e) { if (typeof sbToast === 'function') sbToast('Export failed — try again.'); }
  };

  apiFetch('/api/site/' + encodeURIComponent(slug) + '/rows')
    .then(async (r) => {
      const d = await r.json().catch(() => ({}));
      const box = document.getElementById('bkList'); if (!box) return;
      if (!r.ok) { box.innerHTML = '<div class="st-sec-empty"><b>Couldn\u2019t read your tables</b><span>Try again in a moment.</span></div>'; return; }
      const tables = Array.isArray(d.tables) ? d.tables : [];
      if (!tables.length) { box.innerHTML = '<div class="st-sec-empty"><b>Nothing to export yet</b><span>Once your site collects something, it can be downloaded here.</span></div>'; return; }
      box.innerHTML = '<div class="bk-rows">' + tables.map((t) => {
        const n = Number(t.rows) || 0;
        return '<div class="bk-row"><div class="bk-tx"><b>' + esc(t.name) + '</b><span>' + n + ' row' + (n === 1 ? '' : 's') + '</span></div>' +
          '<div class="bk-btns"><button type="button" class="bk-dl" data-t="' + esc(t.name) + '" data-f="csv">CSV</button>' +
          '<button type="button" class="bk-dl" data-t="' + esc(t.name) + '" data-f="json">JSON</button></div></div>';
      }).join('') + '</div>';
      box.querySelectorAll('.bk-dl').forEach((b) => b.onclick = () => dl(b.getAttribute('data-t'), b.getAttribute('data-f')));
    })
    .catch(() => { const box = document.getElementById('bkList'); if (box) box.innerHTML = '<div class="st-sec-empty"><b>Lost the connection</b><span>Try again.</span></div>'; });
}

// Versions — every publish archives its build; roll the LIVE site back to a prior one.
async function siteVersions(site) {
  const slug = site.slug || (site.liveUrl || '').split('/s/')[1] || '';
  if (!slug) { if (typeof sbToast === 'function') sbToast('Publish the site first — versions show up here.'); return; }
  const { bodyEl } = stCloudModal('siteVersionsModal', 'Versions');
  // THIS PANEL WAS TWO LIES DEEP UNTIL 2026-08-08. It called
  // `/api/site/backend/builds` and `/backend/rollback`, both deleted with the
  // D1 runtime, so it showed "Couldn't load versions" (a 404 caught by its own
  // catch) over a roll-back button that posted into the void — and there was
  // nothing to roll back to anyway, because a publish wiped the prefix and
  // wrote the new dist over it. Both halves are real now: `writeSiteDistToR2`
  // archives what it publishes, and `POST /api/site/<slug>/versions/restore`
  // puts one back over the live prefix through the same write-then-sweep path.
  const when = (ms) => {
    const t = Number(ms) || 0;
    if (!t) return '';
    const mins = Math.round((Date.now() - t) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    if (mins < 60 * 24) return Math.round(mins / 60) + 'h ago';
    const d = new Date(t);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' +
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const restore = async (id, label) => {
    // ASKED FIRST. This overwrites the live site, and the person reaching for
    // it is usually reacting to a build they dislike — which is exactly when a
    // mis-click costs the most.
    if (!confirm('Put "' + (label || 'this version') + '" back on the live site?\n\nThe build you are on now stays in the list, so you can come back to it.')) return;
    bodyEl.innerHTML = '<div class="si-empty">Restoring…</div>';
    try {
      const r = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/versions/restore', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { if (typeof sbToast === 'function') sbToast(d.error || 'Couldn’t restore that version.'); return load(); }
      if (typeof sbToast === 'function') sbToast('Restored — your site is live on that build.');
      load();
    } catch (e) { if (typeof sbToast === 'function') sbToast('Lost the connection — try again.'); load(); }
  };

  const load = async () => {
    bodyEl.innerHTML = '<div class="si-empty">Loading…</div>';
    let d = {};
    try {
      const r = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/versions');
      d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error('bad');
    } catch (e) {
      bodyEl.innerHTML = '<div class="si-empty">Couldn’t read your build history. Try again in a moment.</div>';
      return;
    }
    const list = Array.isArray(d.versions) ? d.versions : [];
    const intro = '<p class="sp-intro">Every publish is saved here, so you can put an earlier build back on the live site.</p>';
    if (!list.length) {
      // A site published before this shipped has no archive, which is a
      // different thing from a failure — say which it is.
      bodyEl.innerHTML = intro + '<div class="si-empty">Nothing saved yet. Your next build shows up here.</div>';
      return;
    }
    bodyEl.innerHTML = intro + '<div class="st-hist">' + list.map((v, i) =>
      '<div class="st-hitem"><span class="st-hi-ic">' + ic('history', 14) + '</span>' +
      '<div class="st-hi-tx"><b>' + esc(String(v.label || 'Build').slice(0, 80)) + '</b>' +
      '<span>' + (i === 0 ? 'Live now' : esc(when(v.at))) + '</span></div>' +
      (i === 0 ? '' : '<button type="button" class="st-hi-restore" data-vid="' + esc(String(v.id)) + '" data-vl="' + esc(String(v.label || 'Build')) + '">Restore</button>') +
      '</div>').join('') + '</div>';
    bodyEl.querySelectorAll('[data-vid]').forEach((b) => {
      b.onclick = () => restore(b.getAttribute('data-vid'), b.getAttribute('data-vl'));
    });
  };
  load();
}

// Members — the accounts that signed up on the OWNER'S published site, not on
// Go Farther. List, change a role, suspend, reinstate, remove.
//
// THE SERVER SIDE HAS BEEN LIVE AND UNREACHABLE. `handleOwnerMembers` implements
// all four verbs against `neon_auth."user"` and is tested; the Members card was
// clickable, promised "Accounts that sign up in your app", and fell through the
// cloud dispatch to `else siteInbox(site)` — the form-submissions modal. A stale
// comment in `loadSiteData` claimed the route "went with the auth layer on
// 2026-07-30"; it was rebuilt on Neon Auth the same day and never re-wired. So
// there was no way, anywhere in the product, to see who had an account on a site
// you own — let alone suspend one.
async function siteMembers(site) {
  const slug = site.slug || (site.liveUrl || '').split('/s/')[1] || '';
  if (!slug) { if (typeof sbToast === 'function') sbToast('Publish the site first — member accounts show up here.'); return; }
  const { bodyEl } = stCloudModal('siteMembersModal', 'Members');
  const base = '/api/site/' + encodeURIComponent(slug) + '/members';

  // One helper for all three writes: they differ only in method and body, and
  // every one of them ends by re-reading the list, because a member's row is the
  // thing being changed and a stale row beside a "done" toast is how somebody
  // suspends the same person twice.
  const change = async (id, init, okMsg) => {
    try {
      const r = await apiFetch(base + '/' + encodeURIComponent(id), init);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        // The server names the roles a site's own tables actually check, which
        // is the only useful thing to say when a role is refused — a generic
        // "couldn't do that" leaves the owner guessing at a closed set.
        const roles = Array.isArray(d.roles) && d.roles.length ? ' Try: ' + d.roles.join(', ') + '.' : '';
        if (typeof sbToast === 'function') sbToast((d.error || 'That didn’t work.') + roles);
      } else if (typeof sbToast === 'function') sbToast(okMsg);
    } catch (e) { if (typeof sbToast === 'function') sbToast('Lost the connection — try again.'); }
    load();
  };

  const setRole = (id, email) => {
    const next = prompt('Role for ' + (email || 'this member') + '\n\n"admin" can write to staff-managed tables; "user" is an ordinary member. Your site’s own tables may name others.', 'user');
    if (next == null) return;
    const role = String(next).trim().toLowerCase();
    if (!role) return;
    change(id, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role }),
    }, 'Role updated.');
  };

  const suspend = (id, email, on) => {
    // ASKED ONLY ON THE WAY IN. Suspending locks somebody out of an account they
    // are using; reinstating gives it back, and a confirm on a harmless action
    // is how people learn to click through the one that matters.
    if (on && !confirm('Suspend ' + (email || 'this member') + '?\n\nThey are signed out everywhere and cannot sign back in until you reinstate them. Their rows stay.')) return;
    change(id, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ suspended: !!on }),
    }, on ? 'Suspended.' : 'Reinstated.');
  };

  const remove = (id, email) => {
    if (!confirm('Remove ' + (email || 'this member') + ' for good?\n\nThis cannot be undone. Anything they submitted stays on your site but stops being attributed to anyone.')) return;
    change(id, { method: 'DELETE' }, 'Member removed.');
  };

  const load = async () => {
    bodyEl.innerHTML = '<div class="si-empty">Loading…</div>';
    let d = {};
    try {
      const r = await apiFetch(base);
      d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error('bad');
    } catch (e) {
      bodyEl.innerHTML = '<div class="si-empty">Couldn’t read your members. Try again in a moment.</div>';
      return;
    }
    const list = Array.isArray(d.members) ? d.members : [];
    const intro = '<p class="sp-intro">People who created an account on your site. This is separate from your Go Farther account.</p>';
    if (!list.length) {
      // NO MEMBERS AND NO SIGN-IN ARE DIFFERENT THINGS and only one of them is
      // worth acting on, so do not report the empty list as if something failed.
      bodyEl.innerHTML = intro + '<div class="si-empty">Nobody has signed up yet. Accounts appear here as people create them.</div>';
      return;
    }
    bodyEl.innerHTML = intro + '<div class="st-hist">' + list.map((m) => {
      const who = esc(String(m.email || m.name || m.id || '').slice(0, 80));
      // State as a WORD, not a colour — the platform is black-and-white and its
      // own component kit forbids colour-only state.
      const bits = [];
      if (m.suspended) bits.push('Suspended');
      bits.push(esc(String(m.role || 'user')));
      if (!m.verified) bits.push('unverified email');
      return '<div class="st-hitem"><span class="st-hi-ic">' + ic('users', 14) + '</span>' +
        '<div class="st-hi-tx"><b>' + who + '</b><span>' + bits.join(' · ') + '</span></div>' +
        '<button type="button" class="st-hi-restore" data-mrole="' + esc(String(m.id)) + '" data-me="' + who + '">Role</button>' +
        '<button type="button" class="st-hi-restore" data-msus="' + esc(String(m.id)) + '" data-mon="' + (m.suspended ? '0' : '1') + '" data-me="' + who + '">' +
          (m.suspended ? 'Reinstate' : 'Suspend') + '</button>' +
        '<button type="button" class="st-hi-restore" data-mdel="' + esc(String(m.id)) + '" data-me="' + who + '">Remove</button>' +
        '</div>';
    }).join('') + '</div>';
    bodyEl.querySelectorAll('[data-mrole]').forEach((b) => {
      b.onclick = () => setRole(b.getAttribute('data-mrole'), b.getAttribute('data-me'));
    });
    bodyEl.querySelectorAll('[data-msus]').forEach((b) => {
      b.onclick = () => suspend(b.getAttribute('data-msus'), b.getAttribute('data-me'), b.getAttribute('data-mon') === '1');
    });
    bodyEl.querySelectorAll('[data-mdel]').forEach((b) => {
      b.onclick = () => remove(b.getAttribute('data-mdel'), b.getAttribute('data-me'));
    });
  };
  load();
}

// Database — the site's collections (public records it saves + shows). Owner view,
// grouped by collection, RLS-scoped by their JWT.
async function siteDatabase(site) {
  // React sites: the site's real database is its own D1, shown in the Data panel —
  // just switch to it (no separate legacy-collections modal).
  if (site.react && site.backend) { siteView = 'data'; renderSites(); return; }
  const slug = site.slug || (site.liveUrl || '').split('/s/')[1] || '';
  if (!slug) { if (typeof sbToast === 'function') sbToast('Publish the site first — then its collections show up here.'); return; }
  let box = document.getElementById('siteDbModal');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'siteDbModal';
  box.className = 'si-modal';
  box.innerHTML = '<div class="si-card"><div class="si-head"><b>Database</b><button type="button" class="si-x" aria-label="Close">×</button></div><div class="si-body">Loading…</div></div>';
  document.body.appendChild(box);
  const close = () => box.remove();
  box.querySelector('.si-x').onclick = close;
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  const bodyEl = box.querySelector('.si-body');
  try {
    const r = await apiFetch('/api/site/collections?slug=' + encodeURIComponent(slug));
    const d = await r.json().catch(() => ({ records: [] }));
    const recs = Array.isArray(d.records) ? d.records : [];
    if (!recs.length) { bodyEl.innerHTML = '<div class="si-empty">No collections yet. When your site saves records (reviews, entries, …) to a collection, they show up here.</div>'; return; }
    const groups = {};
    recs.forEach((x) => { const c = x.collection || 'data'; (groups[c] = groups[c] || []).push(x); });
    bodyEl.innerHTML = Object.keys(groups).map((c) => {
      const rows = groups[c];
      return '<div class="si-count">' + esc(c) + ' · ' + rows.length + ' record' + (rows.length === 1 ? '' : 's') + '</div>' + rows.slice(0, 50).map((x) => {
        const dt = (x.data && typeof x.data === 'object') ? x.data : {};
        const fields = Object.keys(dt).filter((k) => k !== '_hp' && k !== 'hp');
        return '<div class="si-item">' + fields.map((k) => '<div class="si-row"><span class="si-k">' + esc(k) + '</span><span class="si-v">' + esc(String(dt[k])) + '</span></div>').join('') + '</div>';
      }).join('');
    }).join('');
  } catch (e) { bodyEl.innerHTML = '<div class="si-empty">Couldn’t load collections just now — try again.</div>'; }
}

// Secrets — encrypted per-site vault. Values are never shown back (rotate = re-add,
// or delete). Owner-only, RLS-scoped.
async function siteSecrets(site) {
  const slug = site.slug || (site.liveUrl || '').split('/s/')[1] || '';
  if (!slug) { if (typeof sbToast === 'function') sbToast('Publish the site first — then you can add secrets.'); return; }
  let box = document.getElementById('siteSecModal');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'siteSecModal';
  box.className = 'si-modal';
  box.innerHTML = '<div class="si-card"><div class="si-head"><b>Secrets</b><button type="button" class="si-x" aria-label="Close">×</button></div><div class="si-body"><p class="sp-intro">Store API keys and tokens encrypted. Values are never shown again — rotate by re-adding, or delete.</p>' +
    '<div class="sk-add"><input class="st-in" id="skName" placeholder="NAME (e.g. STRIPE_KEY)" autocomplete="off"><input class="st-in" id="skVal" type="password" placeholder="Value" autocomplete="off"><button type="button" class="st-publish" id="skAdd">Add</button></div>' +
    '<div class="si-count" id="skErr" style="display:none"></div>' +
    '<div id="skList">Loading…</div></div></div>';
  document.body.appendChild(box);
  const close = () => box.remove();
  box.querySelector('.si-x').onclick = close;
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  const listEl = box.querySelector('#skList');
  const errEl = box.querySelector('#skErr');
  const fmt = (t) => { try { return new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; } };
  const load = async () => {
    try {
      const r = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/secrets');
      const d = await r.json().catch(() => ({ secrets: [] }));
      const secs = Array.isArray(d.secrets) ? d.secrets : [];
      if (!secs.length) { listEl.innerHTML = '<div class="si-empty">No secrets yet.</div>'; return; }
      // The hint, never the value. `sk_live` against `sk_test` is the difference
      // between a shop that takes money and one that quietly does not, and it is
      // the single thing an owner cannot otherwise check without re-adding the key.
      listEl.innerHTML = secs.map((s) => {
        const bits = [s.prefix ? esc(s.prefix) : '', s.last4 ? '···· ' + esc(s.last4) : ''].filter(Boolean).join(' ');
        const mode = s.mode ? '<span class="sk-mode sk-mode-' + esc(s.mode) + '">' + esc(s.mode) + '</span>' : '';
        return '<div class="sk-item"><span class="sk-name">' + esc(s.name) + '</span>' +
          (bits ? '<span class="sk-hint">' + bits + '</span>' : '') + mode +
          '<span class="sk-when">' + esc(fmt(s.created_at)) + '</span>' +
          '<button type="button" class="sk-del" data-del="' + esc(s.name) + '" title="Delete">×</button></div>';
      }).join('');
      listEl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
        await apiFetch('/api/site/' + encodeURIComponent(slug) + '/secrets/' + encodeURIComponent(b.dataset.del), { method: 'DELETE' });
        load();
      });
    } catch (e) { listEl.innerHTML = '<div class="si-empty">Couldn’t load secrets — try again.</div>'; }
  };
  box.querySelector('#skAdd').onclick = async () => {
    const name = box.querySelector('#skName').value.trim();
    const val = box.querySelector('#skVal').value;
    errEl.style.display = 'none';
    if (!name || !val) { errEl.textContent = 'Enter a name and a value.'; errEl.style.display = ''; return; }
    try {
      const r = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/secrets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, value: val }) });
      const d = await r.json().catch(() => ({}));
      if (d && d.ok) { box.querySelector('#skName').value = ''; box.querySelector('#skVal').value = ''; load(); }
      else { errEl.textContent = (d && d.error) || 'Couldn’t save the secret.'; errEl.style.display = ''; }
    } catch (e) { errEl.textContent = 'Couldn’t save the secret.'; errEl.style.display = ''; }
  };
  load();
}

// Custom domains — the owner's own web address instead of gofarther.dev/s/<slug>/.
//
// THE WHOLE JOB OF THIS PANEL IS THE DNS STEP. Adding the domain here takes one
// click; what actually decides whether it works is two records typed correctly
// into a form on somebody else's website, from memory, ten minutes later. So
// the records are shown as a copyable table rather than described in a
// sentence, each with its own Copy button, and the panel says which of the two
// independent things — DNS, or the certificate — is still outstanding.
async function siteDomains(site) {
  const slug = site.slug || (site.liveUrl || '').split('/s/')[1] || '';
  if (!slug) { if (typeof sbToast === 'function') sbToast('Publish the site first — then you can put it on your own address.'); return; }
  let box = document.getElementById('siteDomModal');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'siteDomModal';
  box.className = 'si-modal';
  box.innerHTML = '<div class="si-card"><div class="si-head"><b>Domains</b><button type="button" class="si-x" aria-label="Close">×</button></div><div class="si-body">' +
    '<p class="sp-intro">Serve this site on your own web address. Add the domain here, then add the records it gives you at whoever you bought the domain from. The certificate is issued automatically \u2014 you can close this and we\u2019ll email you when it\u2019s live.</p>' +
    '<div class="sk-add"><input class="st-in" id="sdHost" placeholder="sharpfadebarbers.com" autocomplete="off" spellcheck="false"><button type="button" class="st-publish" id="sdAdd">Add domain</button></div>' +
    '<div class="si-count" id="sdErr" style="display:none"></div>' +
    '<div id="sdList">Loading…</div></div></div>';
  document.body.appendChild(box);
  const close = () => box.remove();
  box.querySelector('.si-x').onclick = close;
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  const listEl = box.querySelector('#sdList');
  const errEl = box.querySelector('#sdErr');

  // One record, as something to copy rather than something to read. The name
  // and the value are the two things people get wrong, so each gets its own
  // button — a single "copy all" produces a blob that has to be taken apart
  // again on the other side.
  const recRow = (r) => '<div class="sd-rec">' +
    '<span class="sd-rt">' + esc(r.kind) + '</span>' +
    '<div class="sd-rf"><span class="sd-rl">Name</span><code>' + esc(r.name) + '</code><button type="button" class="fn-hook-copy" data-copy="' + esc(r.name) + '">Copy</button></div>' +
    '<div class="sd-rf"><span class="sd-rl">Value</span><code>' + esc(r.value) + '</code><button type="button" class="fn-hook-copy" data-copy="' + esc(r.value) + '">Copy</button></div>' +
    (r.note ? '<span class="sd-note">' + esc(r.note) + '</span>' : '') + '</div>';

  const load = async () => {
    try {
      const r = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/domains');
      const d = await r.json().catch(() => ({}));
      const list = Array.isArray(d.domains) ? d.domains : [];
      if (!list.length) {
        listEl.innerHTML = '<div class="si-empty">No custom domain yet. Your site is live at <code>' + esc(siteChipUrl({ slug })) + '</code>.</div>';
        return;
      }
      listEl.innerHTML = list.map((x) => {
        // Three states and they read differently on purpose: live is done,
        // failed needs the owner to do something, and pending is NORMAL — a
        // certificate takes minutes and telling somebody it failed sends them
        // to delete and re-add, which starts the clock again.
        const live = x.status === 'live';
        const failed = x.status === 'failed';
        const badge = live ? '<span class="st-badge-live">Live</span>'
          : failed ? '<span class="sd-bad">Needs attention</span>'
          : '<span class="st-badge-soon">' + esc(x.stage || 'setting up') + '</span>';
        // The records still outstanding, plus the CNAME that always applies.
        // Hidden once it is live: spent records on screen read as work to do.
        // ONCE DNS IS CORRECT, THE CNAME IS SPENT TOO — not just once the whole
        // domain is live. Leaving it up while the only outstanding thing is the
        // certificate presents finished work as work to do, which is what sends
        // somebody back to their registrar to 'fix' a record that is already
        // right. Any TXT validation still outstanding stays.
        const dnsDone = live || x.dns === 'ok';
        const recs = live ? '' : (dnsDone ? [] : (x.records || [])).concat(x.pending || []).map(recRow).join('');
        // WHAT THE DOMAIN ACTUALLY POINTS AT. The one line that turns "waiting
        // for DNS" from a shrug into something to go and do: it says whether
        // there is no record yet, or a record pointing at the old host — and
        // names the old host, because they cannot find it otherwise.
        //
        // `unknown` is OUR resolver failing, not their domain, so it is worded
        // as such and marked plain rather than as a problem.
        // WHO HOLDS THEIR DNS, and a way straight into the right page. The
        // link is the automation that actually exists: it does not need a
        // credential, it works for every provider on the list, and being
        // dropped on the correct screen is most of what people are stuck on.
        // THE ONE-CLICK BUTTON, where the provider supports Domain Connect.
        //
        // It goes ABOVE the copyable records, because it replaces them: an
        // owner who can press this never has to look at a CNAME. The records
        // stay below as the fallback, not as the instruction.
        const oneClick = (!live && x.oneClick)
          ? '<div class="sd-auto"><a class="sd-auto-go" href="' + esc(x.oneClick) + '" target="_blank" rel="noreferrer">' +
            'Set it up at ' + esc(x.oneClickProvider || 'your provider') + '</a>' +
            '<span class="sd-auto-note">Signs you in there and asks you to approve the change. We never see your password.</span></div>'
          // WHY THERE IS NO BUTTON, when there is a reason worth giving.
          //
          // The backend has always computed this and nothing rendered it, so
          // an owner whose provider supports one-click through a sign-in we
          // have not built saw the same blank as everyone else. The records
          // below are the answer in both cases; the sentence is what stops it
          // reading as a broken feature.
          : (!live && x.oneClickBlocked)
            ? '<div class="sd-auto-off">' + esc(x.oneClickBlocked === 'asyncOnly'
              ? 'Your DNS provider supports one-click setup through a sign-in we haven’t built yet. Add the record below instead.'
              : 'One-click setup covers the bare domain and www. For any other subdomain, add the record below.') + '</div>'
            : '';
        const provRow = (!live && x.providerNote)
          ? '<div class="sd-prov"><span>' + esc(x.providerNote) + '</span>' +
            (x.providerUrl ? '<a class="sd-visit" href="' + esc(x.providerUrl) + '" target="_blank" rel="noreferrer">Open ' + esc(x.provider || 'DNS') + ' \u2192</a>' : '') +
            '</div>'
          : '';
        const dnsRow = (!live && x.dnsNote)
          ? '<div class="sd-dns' + (x.dns === 'elsewhere' ? ' sd-dns-warn' : x.dns === 'ok' ? ' sd-dns-ok' : '') + '">' + esc(x.dnsNote) + '</div>'
          : '';
        return '<div class="sd-item"><div class="sd-top">' + ic('globe', 15) + '<b class="sd-host">' + esc(x.hostname) + '</b>' + badge +
          (live ? '<a class="sd-visit" href="https://' + esc(x.hostname) + '" target="_blank" rel="noreferrer">Visit</a>' : '') +
          '<button type="button" class="sk-del" data-del="' + esc(x.hostname) + '" title="Remove">×</button></div>' +
          (x.error ? '<div class="sd-err">' + esc(x.error) + '</div>' : '') + dnsRow + oneClick + provRow +
          (recs ? '<div class="sd-recs">' + recs + '</div>' : '') + '</div>';
      }).join('');
      listEl.querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => {
        try { navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1400); } catch (e) { /* no clipboard */ }
      });
      listEl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
        // REMOVING A DOMAIN IS NOT UNDOABLE IN ONE CLICK — the certificate is
        // released and re-adding starts the wait over — so it asks first.
        if (!window.confirm('Remove ' + b.dataset.del + '? The site stays published at its gofarther.dev address.')) return;
        await apiFetch('/api/site/' + encodeURIComponent(slug) + '/domains/' + encodeURIComponent(b.dataset.del), { method: 'DELETE' });
        load();
      });
    } catch (e) { listEl.innerHTML = '<div class="si-empty">Couldn\u2019t load domains — try again.</div>'; }
  };

  box.querySelector('#sdAdd').onclick = async () => {
    const btn = box.querySelector('#sdAdd');
    const host = box.querySelector('#sdHost').value.trim();
    errEl.style.display = 'none';
    if (!host) { errEl.textContent = 'Enter the domain you want to use.'; errEl.style.display = ''; return; }
    // Registering calls Cloudflare, which is not instant. Without this the
    // owner presses again and gets "already in use" for their own domain.
    btn.disabled = true; btn.textContent = 'Adding…';
    try {
      const r = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/domains', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hostname: host }) });
      const d = await r.json().catch(() => ({}));
      if (d && d.ok) { box.querySelector('#sdHost').value = ''; load(); }
      else { errEl.textContent = (d && d.error) || 'Couldn\u2019t add that domain.'; errEl.style.display = ''; }
    } catch (e) { errEl.textContent = 'Couldn\u2019t add that domain.'; errEl.style.display = ''; }
    btn.disabled = false; btn.textContent = 'Add domain';
  };
  load();
}

// Edge functions — server-side logic the builder DECLARES from chat (call a
// third-party API with a saved secret, aggregate collection data, multi-step
// flows). Read-only list + delete here; you add/change them by asking in the
// builder. Owner-only, RLS-scoped.
async function siteFunctions(site) {
  const slug = site.slug || (site.liveUrl || '').split('/s/')[1] || '';
  if (!slug) { if (typeof sbToast === 'function') sbToast('Publish the site first — then its functions show up here.'); return; }
  let box = document.getElementById('siteFnModal');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'siteFnModal';
  box.className = 'si-modal';
  box.innerHTML = '<div class="si-card"><div class="si-head"><b>Edge functions</b><button type="button" class="si-x" aria-label="Close">×</button></div><div class="si-body"><p class="sp-intro">Server-side logic your app builds from chat — calling an API with a saved secret, aggregating data, multi-step flows. Ask in the builder to add or change one.</p><div id="fnList">Loading…</div></div></div>';
  document.body.appendChild(box);
  const close = () => box.remove();
  box.querySelector('.si-x').onclick = close;
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  const listEl = box.querySelector('#fnList');
  const host = (u) => { try { return new URL(String(u).replace(/\{\{[^}]*\}\}/g, 'x')).hostname.replace(/^www\./, ''); } catch (e) { return 'an API'; } };
  const stepLabel = (s) => {
    if (!s || typeof s !== 'object') return '';
    if (s.do === 'read') return 'read ' + esc(s.collection || 'data');
    if (s.do === 'save') return 'save to ' + esc(s.collection || 'data');
    if (s.do === 'fetch') return esc(s.method || 'GET') + ' ' + esc(host(s.url));
    if (s.do === 'respond') return 'respond';
    return esc(s.do || '');
  };
  const load = async () => {
    try {
      const r = await apiFetch('/api/site/functions?slug=' + encodeURIComponent(slug));
      const d = await r.json().catch(() => ({ functions: [] }));
      const fns = Array.isArray(d.functions) ? d.functions : [];
      if (!fns.length) { listEl.innerHTML = '<div class="si-empty">No functions yet. In the builder, describe the server logic you want (e.g. “when someone signs up, post it to my Slack webhook”) and it’ll appear here.</div>'; return; }
      const schLabel = (m) => (m === 60 ? 'Hourly' : m === 1440 ? 'Daily' : 'Every ' + m + 'm');
      listEl.innerHTML = fns.map((f) => {
        const steps = (f.spec && Array.isArray(f.spec.steps)) ? f.spec.steps : [];
        const chips = steps.map((s) => '<span class="fn-step">' + stepLabel(s) + '</span>').join('<span class="fn-arrow">→</span>');
        const sm = parseInt(f.schedule_minutes, 10);
        const schBadge = sm > 0 ? '<span class="fn-sch">' + ic('history', 12) + ' ' + esc(schLabel(sm)) + '</span>' : '';
        const hookUrl = 'https://gofarther.dev/api/site/hook/' + slug + '/' + f.name;
        return '<div class="fn-item"><div class="fn-top"><span class="fn-ic">' + ic('zap', 15) + '</span><b class="fn-name">' + esc(f.name) + '</b><span class="fn-trig">HTTP</span>' + schBadge + (f.enabled === false ? '<span class="st-badge-soon">Paused</span>' : '<span class="st-badge-live">Live</span>') + '<button type="button" class="sk-del" data-del="' + esc(f.name) + '" title="Delete">×</button></div><div class="fn-flow">' + (chips || '<span class="fn-step">no steps</span>') + '</div><div class="fn-hook"><span class="fn-hook-label">Webhook</span><code class="fn-hook-url">' + esc(hookUrl.replace(/^https:\/\//, '')) + '</code><button type="button" class="fn-hook-copy" data-hook="' + esc(hookUrl) + '">Copy</button></div></div>';
      }).join('');
      listEl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
        await apiFetch('/api/site/functions?slug=' + encodeURIComponent(slug) + '&name=' + encodeURIComponent(b.dataset.del), { method: 'DELETE' });
        load();
      });
      listEl.querySelectorAll('[data-hook]').forEach((b) => b.onclick = () => {
        try { navigator.clipboard.writeText(b.dataset.hook); } catch (e) {}
        if (typeof sbToast === 'function') sbToast('Webhook URL copied — paste it into Stripe, Zapier, etc.');
      });
    } catch (e) { listEl.innerHTML = '<div class="si-empty">Couldn’t load functions — try again.</div>'; }
  };
  load();
}

// Files — the images/PDFs visitors uploaded to this site (R2). Owner can view +
// delete. Owner-only (ownership proven server-side via the site's RLS row).
async function siteFiles(site) {
  // Repointed 2026-08-07 from `/api/site/files?slug=` — deleted with the D1
  // runtime — to `/api/site/<slug>/uploads`, which has existed all along and is
  // what the owner's own upload button already writes to. The panel was marked
  // dead in the audit; the panel was fine, its URL was three months stale.
  const slug = site.slug || (site.liveUrl || '').split('/s/')[1] || '';
  if (!slug) { if (typeof sbToast === 'function') sbToast('Publish the site first — then its files show up here.'); return; }
  const { bodyEl } = stCloudModal('siteFilesModal', 'Files');
  bodyEl.innerHTML = '<p class="sp-intro">Pictures on your site — the ones you added, and the ones visitors sent with a form.</p><div id="flList">Loading…</div>';
  const list = () => apiFetch('/api/site/' + encodeURIComponent(slug) + '/uploads')
    .then(async (r) => {
      const d = await r.json().catch(() => ({}));
      const box = document.getElementById('flList'); if (!box) return;
      if (!r.ok) { box.innerHTML = '<div class="st-sec-empty"><b>Couldn\u2019t load your files</b><span>Try again in a moment.</span></div>'; return; }
      const files = Array.isArray(d.files) ? d.files : [];
      if (!files.length) { box.innerHTML = '<div class="st-sec-empty"><b>No files yet</b><span>Pictures you add, or that visitors upload with a form, appear here.</span></div>'; return; }
      const mb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
      box.innerHTML =
        '<div class="fl-bar"><b>' + files.length + ' file' + (files.length === 1 ? '' : 's') + '</b>' +
        '<span>' + mb(d.used || 0) + ' of ' + mb(d.max || 0) + '</span></div>' +
        '<div class="fl-grid">' + files.map((f) =>
          // A thumbnail that 404s paints the browser's broken-image icon — a
          // torn page in a tall grey box, which reads as "this panel is broken"
          // rather than "this one file is missing". Seen on a stubbed render.
          // The class swap leaves the tile its own size and says what happened.
          '<figure class="fl-item"><a href="' + esc(f.url) + '" target="_blank" rel="noreferrer">' +
          '<img src="' + esc(f.url) + '" alt="" loading="lazy" ' +
          'onerror="this.closest(\'.fl-item\').classList.add(\'fl-gone\');this.remove()" /></a>' +
          '<figcaption><span class="fl-nm">' + esc(f.name) + '</span><span class="fl-sz">' + mb(f.size) + '</span>' +
          '<button type="button" class="fl-del" data-file="' + esc(f.name) + '" aria-label="Delete ' + esc(f.name) + '">\u00d7</button></figcaption></figure>').join('') +
        '</div>';
      // Deleting is irreversible and the file may be on a live page, so it asks
      // first — the one place in this panel that changes anything.
      box.querySelectorAll('.fl-del').forEach((b) => b.onclick = async () => {
        const name = b.getAttribute('data-file');
        if (!window.confirm('Delete ' + name + '? If a page uses it, that picture will stop showing.')) return;
        b.disabled = true;
        const r2 = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/uploads/' + encodeURIComponent(name), { method: 'DELETE' });
        if (!r2.ok) { b.disabled = false; if (typeof sbToast === 'function') sbToast('Could not delete that file.'); return; }
        list();
      });
    })
    .catch(() => { const box = document.getElementById('flList'); if (box) box.innerHTML = '<div class="st-sec-empty"><b>Lost the connection</b><span>Try again.</span></div>'; });
  list();
}

// Emails — your site sends email through YOUR OWN provider. This is a setup guide;
// the actual sending is wired by the builder as an edge-function step.
function siteEmails(site) {
  const slug = site.slug || (site.liveUrl || '').split('/s/')[1] || '';
  if (!slug) { if (typeof sbToast === 'function') sbToast('Publish the site first — then you can wire up email.'); return; }
  let box = document.getElementById('siteEmailModal');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'siteEmailModal';
  box.className = 'si-modal';
  box.innerHTML = '<div class="si-card"><div class="si-head"><b>Emails</b><button type="button" class="si-x" aria-label="Close">×</button></div><div class="si-body">' +
    '<p class="sp-intro">Your site sends email through <b>your own</b> email provider — welcome emails, “new form entry” alerts, order receipts. Two quick steps:</p>' +
    '<div class="em-steps">' +
      '<div class="em-step"><span class="em-n">1</span><div><b>Add your provider key in Secrets</b><span>Use Resend, SendGrid, or Postmark. Verify your sending domain there, then paste that provider’s API key into <b>Cloud → Secrets</b> (name it e.g. <code>RESEND_KEY</code>).</span></div></div>' +
      '<div class="em-step"><span class="em-n">2</span><div><b>Ask the builder</b><span>Say what you want — “email me when someone submits the contact form”, “send a welcome email on signup”. It wires the send as an edge function using your key.</span></div></div>' +
    '</div>' +
    '<p class="sp-intro" style="margin-top:1rem">Your key stays encrypted and never touches the page — it’s used server-side only, exactly like payments.</p>' +
  '</div></div>';
  document.body.appendChild(box);
  const close = () => box.remove();
  box.querySelector('.si-x').onclick = close;
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
}

// Payments — sell through the owner's OWN Stripe. Setup guide (the checkout +
// order-webhook are wired by the builder as edge-function steps).
function sitePayments(site) {
  const slug = site.slug || (site.liveUrl || '').split('/s/')[1] || '';
  if (!slug) { if (typeof sbToast === 'function') sbToast('Publish the site first — then you can wire up payments.'); return; }
  let box = document.getElementById('sitePayModal');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'sitePayModal';
  box.className = 'si-modal';
  // The webhook URL the owner registers in THEIR Stripe dashboard. Shown
  // literally and copyable, because it is the one value they have to move by
  // hand and a typo produces a shop that takes money and never marks an order
  // paid — which looks like our bug and is silent for days.
  const hookUrl = location.origin + '/api/stripe/site/' + slug;
  box.innerHTML = '<div class="si-card"><div class="si-head"><b>Payments</b><button type="button" class="si-x" aria-label="Close">×</button></div><div class="si-body">' +
    '<p class="sp-intro">Take payments with <b>your own</b> Stripe account. Money goes straight to you — Go Farther never touches it and takes no cut.</p>' +
    '<div id="payState">Checking…</div>' +
  '</div></div>';
  document.body.appendChild(box);
  const close = () => box.remove();
  box.querySelector('.si-x').onclick = close;
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  const host = box.querySelector('#payState');

  const step = (n, done, title, body) =>
    '<div class="em-step' + (done ? ' em-done' : '') + '"><span class="em-n">' + (done ? '&#10003;' : n) + '</span><div><b>' + title + '</b><span>' + body + '</span></div></div>';

  (async () => {
    let secrets = [], tables = [], failed = false;
    try {
      const [sr, tr] = await Promise.all([
        apiFetch('/api/site/' + encodeURIComponent(slug) + '/secrets'),
        apiFetch('/api/site/' + encodeURIComponent(slug) + '/rows'),
      ]);
      const sd = await sr.json().catch(() => ({}));
      const td = await tr.json().catch(() => ({}));
      secrets = Array.isArray(sd.secrets) ? sd.secrets : [];
      tables = Array.isArray(td.tables) ? td.tables : [];
      if (!sr.ok) failed = true;
    } catch (e) { failed = true; }
    // Fails LOUD rather than showing an empty checklist: "no keys yet" and
    // "we could not look" are very different things to tell someone whose shop
    // may or may not be taking money right now.
    if (failed) { host.innerHTML = '<div class="si-empty">Couldn\u2019t check your payment setup just now \u2014 try again.</div>'; return; }

    const byName = (n) => secrets.find((x) => x.name === n) || null;
    const key = byName('STRIPE_SECRET_KEY');
    const hook = byName('STRIPE_WEBHOOK_SECRET');
    const paidTables = tables.filter((t) => t && t.paid);

    const keyLine = key
      ? 'Added' + (key.mode ? ' \u2014 <b>' + esc(key.mode) + ' mode</b>' : '') + (key.last4 ? ' (\u00b7\u00b7\u00b7\u00b7 ' + esc(key.last4) + ')' : '') + '.'
      : 'In Stripe go to <b>Developers \u2192 API keys</b>, copy your <b>secret</b> key, and add it in <b>Cloud \u2192 Secrets</b> as <code>STRIPE_SECRET_KEY</code>.';
    const hookLine = hook
      ? 'Added.'
      : 'In Stripe go to <b>Developers \u2192 Webhooks</b>, add the URL below for the <code>checkout.session.completed</code> event, then paste the signing secret into Secrets as <code>STRIPE_WEBHOOK_SECRET</code>.';

    host.innerHTML =
      // The one thing that decides whether real money can move, said first and
      // said plainly. A test key looks identical everywhere else in Stripe.
      (key && key.mode === 'test'
        ? '<div class="pay-warn">Your key is a <b>test</b> key \u2014 real cards will be declined. Swap it for the live one when you are ready to sell.</div>'
        : '') +
      // NOT shown on a test key, even though all three steps are done. It said
      // "Ready" directly under "real cards will be declined", which is the
      // panel contradicting itself about the only question that matters.
      (key && key.mode !== 'test' && hook && paidTables.length
        ? '<div class="pay-ok">Ready \u2014 ' + paidTables.map((t) => '<code>' + esc(t.name) + '</code>').join(', ') + ' ' + (paidTables.length === 1 ? 'takes' : 'take') + ' card payments.</div>'
        : '') +
      '<div class="em-steps">' +
        step(1, !!key, 'Your Stripe secret key', keyLine) +
        step(2, !!hook, 'Tell Stripe where to confirm payments', hookLine) +
        step(3, paidTables.length > 0,
          'Ask the builder to sell something',
          paidTables.length
            ? 'Selling from ' + paidTables.map((t) => '<code>' + esc(t.name) + '</code>').join(', ') + '.'
            : '\u201cLet customers buy the products online\u201d. Until you ask, nothing on the site charges a card.') +
      '</div>' +
      '<div class="pay-hook"><label>Your webhook URL</label><div class="pay-hook-row"><code id="payHook">' + esc(hookUrl) + '</code><button type="button" class="st-publish" id="payCopy">Copy</button></div></div>' +
      // Said out loud because it is the question every owner asks and the
      // answer is the reason to paste a live key into somebody else\u2019s box.
      '<p class="sp-intro" style="margin-top:1rem">Your key is encrypted and only ever used on our server \u2014 it is never sent to the page, and never shown back to you. Prices always come from your own data, so a customer cannot change what they are charged.</p>';

    const cp = host.querySelector('#payCopy');
    if (cp) cp.onclick = () => {
      try { navigator.clipboard.writeText(hookUrl); } catch (e) {}
      if (typeof sbToast === 'function') sbToast('Webhook URL copied');
    };
  })();
}

function isSavedMedia(url) {
  return typeof url === 'string' && typeof SUPABASE_URL === 'string' &&
    url.startsWith(SUPABASE_URL + '/storage/');
}
// A file deleted from the gallery while a chat still showed it lives on under
// media/<uid>/chat/ — "in the chat but no longer in the gallery".
function isChatOnlyMedia(url) {
  return isSavedMedia(url) && /\/object\/public\/media\/[^/]+\/chat\//.test(url);
}
// Does any chat message (across ALL chats) still reference this URL?
function anyChatMediaRef(url) {
  return (chatStore.chats || []).some((c) => (c.msgs || []).some((m) => m.t === 'media' && m.url === url));
}
// The authoritative list of saved objects in the caller's storage, fetched
// from /api/gallery on gallery open. Existence is driven by storage (so a save
// survives deleting its chat); chat messages only supply prompt/poster overlay.
let serverGallery = null; // [{ url, kind, size, at }] or null before first load
let galleryLoadFailed = false; // true when the last fetch errored → show "couldn't load", not "empty"

async function loadServerGallery() {
  try {
    const r = await apiFetch('/api/gallery');
    if (r && r.ok) {
      const j = await r.json();
      if (j && Array.isArray(j.items)) { serverGallery = j.items; galleryLoadFailed = false; return; }
    }
    galleryLoadFailed = true; // non-ok / unexpected body — don't pass it off as an empty gallery
  } catch { galleryLoadFailed = true; }
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
      if (seen.has(url) || isChatOnlyMedia(url)) return; // chat-only files were gallery-deleted
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

// Small bottom-center toast. Several callers were already guarding
// `typeof sbToast === 'function'` against a definition that never existed —
// their messages (storage-full warnings, import errors) silently vanished
// until this landed (2026-07-16).
function sbToast(text) {
  let t = document.getElementById('sbToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'sbToast';
    t.className = 'sb-toast';
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(sbToast._t);
  sbToast._t = setTimeout(() => t.classList.remove('show'), 5000);
}

// ── Import into the gallery: local files → /api/save (base64) → storage.
// Same rules as every save: it's a subscription perk (free/lapsed = cap 0 →
// 402 → the storage bar's upgrade CTA), counts against the tier's GB cap, and
// the worker validates by magic bytes. Sizes stay under the worker's base64
// ceilings (image ~12M chars, video ~40M, audio ~20M).
const IMPORT_MAX = { image: 8_500_000, video: 29_000_000, audio: 14_000_000 };
const IMPORT_BATCH = 12; // files per pick — keeps one bad drop from hammering /api/save

async function importGalleryFiles(input) {
  const files = [...(input.files || [])];
  input.value = ''; // picking the same file again must re-fire change
  if (!files.length) return;
  const btn = document.getElementById('galleryImport');
  const label = btn ? btn.textContent : '';
  const batch = files.slice(0, IMPORT_BATCH);
  const failed = [];
  let done = 0;
  if (btn) btn.disabled = true;
  for (const f of batch) {
    if (btn) btn.textContent = 'Importing ' + (done + failed.length + 1) + '/' + batch.length + '…';
    const kind = /^image\//.test(f.type) ? 'image'
      : /^video\//.test(f.type) ? 'video'
      : /^audio\//.test(f.type) ? 'audio' : null;
    if (!kind) { failed.push(f.name + ' (not an image, video, or audio file)'); continue; }
    if (f.size > IMPORT_MAX[kind]) { failed.push(f.name + ' (' + kind + 's up to ' + fmtStorageBytes(IMPORT_MAX[kind]) + ')'); continue; }
    let b64;
    try {
      b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1] || '');
        r.onerror = () => rej(new Error('read failed'));
        r.readAsDataURL(f);
      });
    } catch { failed.push(f.name + ' (couldn’t read the file)'); continue; }
    try {
      const r = await apiFetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, data: b64 }),
      });
      if (r && r.ok) { done++; continue; }
      const j = r ? await r.json().catch(() => null) : null;
      if (r && r.status === 402) {
        // Storage gate — no plan, or the cap is hit. The rest of the batch
        // would fail the same way, so stop; the storage bar explains itself.
        failed.push(f.name + (j && j.reason === 'free' ? ' (importing needs a plan)' : ' (gallery storage is full)'));
        break;
      }
      failed.push(f.name + (j && j.error ? ' (' + j.error + ')' : ''));
    } catch { failed.push(f.name + ' (network hiccup — try again)'); }
  }
  if (btn) { btn.textContent = label; btn.disabled = false; }
  if (files.length > IMPORT_BATCH) failed.push((files.length - IMPORT_BATCH) + ' more skipped (up to ' + IMPORT_BATCH + ' per import)');
  if (done) await refreshGallery();
  refreshStorageBar(); // repaints the bar either way (a 402 means it's stale)
  if (failed.length && typeof sbToast === 'function') {
    sbToast('Couldn’t import: ' + failed.slice(0, 3).join(', ') + (failed.length > 3 ? ' · +' + (failed.length - 3) + ' more' : ''));
  }
}

// Import-from-link (the product-page pattern, owner's ask 2026-07-16): paste
// any URL — a direct image/video/audio file, or a page whose og:image we take
// — the worker fetches it (SSRF-guarded, /api/import/fetch) and hands back
// base64, which goes through the exact same /api/save gates as a device pick.
async function importGalleryUrl() {
  const inp = document.getElementById('galImportUrl');
  const go = document.getElementById('galImportGo');
  const raw = ((inp && inp.value) || '').trim();
  const m = raw.match(/https?:\/\/\S+/);
  // A non-URL string used to only change the (invisible-while-typed)
  // placeholder — a silent no-op. Toast it so the user gets real feedback
  // (2026-07-17).
  if (!m) {
    if (typeof sbToast === 'function') sbToast(raw ? 'That needs a full link starting with https://' : 'Paste a link to import from (https://…)');
    if (inp) inp.placeholder = 'That needs a full link (https://…)';
    return;
  }
  if (galStorage && !galStorage.cap) { openCredits(); return; } // storage is a paid perk
  if (inp) inp.disabled = true;
  if (go) { go.disabled = true; go.textContent = '…'; }
  let ok = false;
  let msg = null;
  try {
    const r = await apiFetch('/api/import/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: m[0] }),
    });
    const j = r ? await r.json().catch(() => null) : null;
    // A walled page fell back to the paid AI lookup (✦3) — repaint the pill.
    if (j && typeof j.balance === 'number') setCredits(j.balance);
    if (r && r.ok && j && j.data) {
      const s = await apiFetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: j.kind, data: j.data }),
      });
      if (s && s.ok) ok = true;
      else {
        const sj = s ? await s.json().catch(() => null) : null;
        msg = s && s.status === 402
          ? (sj && sj.reason === 'free' ? 'Importing needs a plan.' : 'Your gallery storage is full.')
          : 'Couldn’t save that file.';
      }
    } else msg = (j && j.error) || 'Couldn’t fetch that link.';
  } catch { msg = 'Network hiccup — try again.'; }
  if (inp) { inp.disabled = false; if (ok) inp.value = ''; }
  if (go) { go.disabled = false; go.innerHTML = '→ <span class="gi-go-cr">✦3</span>'; }
  if (ok) await refreshGallery();
  refreshStorageBar();
  if (msg && typeof sbToast === 'function') sbToast(msg);
}

// Fetch the authoritative storage list, then repaint — called on gallery open
// so a saved file shows even when its chat is gone (or on a fresh device).
async function refreshGallery() {
  await loadServerGallery();
  renderGallery();
}

// Grid thumbnails (owner 2026-07-16: "scrolling feels slow"): the grid was
// decoding multi-MB full-res originals at card size. Supabase's image CDN
// (render/image — confirmed enabled on this project) serves a 560×350 webp
// cover crop (~10–70KB, >100× lighter); the lightbox still opens the
// original. Any transform error falls back to the original file.
function galleryThumb(url) {
  const m = /^(https:\/\/[^/]+)\/storage\/v1\/object\/public\/media\/(.+)$/.exec(url || '');
  if (!m || !/\.(png|jpe?g|webp)$/i.test(m[2])) return url;
  return m[1] + '/storage/v1/render/image/public/media/' + m[2] + '?width=560&height=350&resize=cover&quality=75&format=webp';
}
function thumbFallback(img, url) {
  img.addEventListener('error', () => { if (img.src !== url) img.src = url; }, { once: true });
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
    // Distinguish a genuinely empty gallery from a fetch that failed — a load
    // error on a device with saved media must not read as "nothing here yet".
    empty.textContent = (galleryLoadFailed && !items.length)
      ? 'Couldn’t load your gallery just now — check your connection and reopen it.'
      : galFilter === 'all'
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
      media.loading = 'lazy'; media.decoding = 'async'; media.alt = '';
      media.classList.add('img-fade');
      media.addEventListener('load', () => media.classList.add('img-ready'), { once: true });
      thumbFallback(media, it.url);
      media.src = galleryThumb(it.url);
      if (media.complete) media.classList.add('img-ready');
      media.onclick = () => openLightbox('image', it.url);
    } else if (it.kind === 'audio') {
      media = buildAudioCard(it.url);
    } else {
      media = document.createElement('video');
      media.src = it.url; media.preload = 'metadata'; media.muted = true;
      if (it.poster) media.poster = it.poster;
      // Safari won't PAINT a metadata-loaded video's first frame until
      // something forces a decode (our hover-play was doing it — cards sat
      // blank until the mouse passed by). A hair-width seek forces the frame.
      media.addEventListener('loadedmetadata', () => { try { if (!media.poster) media.currentTime = 0.001; } catch (e) {} }, { once: true });
      media.onmouseenter = () => { media.play().catch(() => {}); };
      media.onmouseleave = () => { media.pause(); media.currentTime = 0; };
      media.onclick = () => openLightbox('video', it.url);
      // Free accounts: same on-screen mark as the chat player.
      d.classList.add('wm-spot');
      if (paidKnown && !isPaid) d.appendChild(wmBadge());
    }
    d.appendChild(media);
    // No prompt caption on gallery cards (owner 2026-07-16: some cards carried
    // the generation prompt as an overlay, some didn't — none should).
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

// Custom audio card (owner 2026-07-16: the native <audio controls> rows read
// as broken). Brand equalizer bars animate while playing, gradient play/pause,
// a seekable track, tabular time. Playing one card pauses the others.
function buildAudioCard(url) {
  const card = document.createElement('div');
  card.className = 'au-card';
  card.innerHTML =
    '<div class="au-viz">' + Array.from({ length: 26 }, (_, i) => '<i style="animation-delay:' + ((i % 7) * 0.11).toFixed(2) + 's"></i>').join('') + '</div>' +
    '<div class="au-row">' +
      '<button class="au-play" type="button" aria-label="Play">' +
        '<svg class="au-ic-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
        '<svg class="au-ic-pause" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>' +
      '</button>' +
      '<div class="au-track"><div class="au-fill"></div></div>' +
      '<span class="au-time">–:––</span>' +
    '</div>';
  const au = document.createElement('audio');
  au.preload = 'metadata';
  au.src = mediaSrcOk(url);
  card.appendChild(au);
  const btn = card.querySelector('.au-play');
  const fill = card.querySelector('.au-fill');
  const time = card.querySelector('.au-time');
  const track = card.querySelector('.au-track');
  const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const durOk = () => au.duration && isFinite(au.duration);
  const paint = () => {
    fill.style.width = durOk() ? (au.currentTime / au.duration) * 100 + '%' : '0%';
    time.textContent = card.classList.contains('playing') || au.currentTime > 0
      ? fmt(au.currentTime) + (durOk() ? ' / ' + fmt(au.duration) : '')
      : (durOk() ? fmt(au.duration) : '–:––');
  };
  au.addEventListener('loadedmetadata', paint);
  au.addEventListener('timeupdate', paint);
  au.addEventListener('play', () => { card.classList.add('playing'); btn.setAttribute('aria-label', 'Pause'); paint(); });
  au.addEventListener('pause', () => { card.classList.remove('playing'); btn.setAttribute('aria-label', 'Play'); paint(); });
  au.addEventListener('ended', () => { au.currentTime = 0; paint(); });
  btn.onclick = (e) => {
    e.stopPropagation();
    if (au.paused) {
      document.querySelectorAll('.au-card audio').forEach((a) => { if (a !== au) a.pause(); });
      au.play().catch(() => {});
    } else au.pause();
  };
  track.onclick = (e) => {
    e.stopPropagation();
    if (!durOk()) return;
    const r = track.getBoundingClientRect();
    au.currentTime = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * au.duration;
    paint();
  };
  return card;
}

// Delete from the GALLERY only (owner's call, 2026-07-16): a chat message
// showing the same file must keep working. So: if no chat references it, the
// file is truly orphaned → hard-delete from storage (frees space). If a chat
// still shows it, the worker MOVES the file to media/<uid>/chat/ (out of the
// gallery listing, still alive) and we rewrite the chat messages to the new
// URL. The mirror lives in deleteMedia(): removing the last chat reference to
// a chat-only file hard-deletes it, since it's invisible everywhere by then.
async function galleryDelete(it, el) {
  const referenced = anyChatMediaRef(it.url);
  if (!confirm(referenced
    ? 'Delete this from your gallery? The copy in your chat stays.'
    : 'Delete this from your gallery?')) return;
  el.remove();
  let ok = false;
  if (referenced) {
    try {
      const r = await apiFetch('/api/media/unlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: it.url }),
      });
      const j = r && r.ok ? await r.json() : null;
      if (j && j.url) {
        chatStore.chats.forEach((c) => {
          let hit = false;
          (c.msgs || []).forEach((m) => { if (m.t === 'media' && m.url === it.url) { m.url = j.url; hit = true; } });
          if (hit) touchSync(c.id);
        });
        persistStore();
        // The chat may be open behind the gallery — repaint so it picks up the
        // file's new URL instead of the (now dead) gallery one.
        renderThread();
        ok = true;
      }
    } catch {}
  } else {
    const m = it.url.match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
    // storageDelete returns res.ok (false on a 4xx/expired-token DELETE) and
    // only throws on a network error — capture the boolean so a non-throwing
    // failure isn't reported as a successful delete (2026-07-18).
    if (m && window.Auth) { try { ok = !!(await Auth.storageDelete(m[1])); } catch {} }
    else ok = true; // non-storage URL — nothing to remove server-side, treat as done
  }
  // The server op failed — the file is still there. Don't leave a phantom
  // delete that silently reappears on the next gallery load (2026-07-17): put
  // the card back and tell the user.
  if (!ok) {
    if (typeof sbToast === 'function') sbToast('Couldn’t delete that just now — try again in a moment.');
    renderGallery(); // re-adds the card from the still-present serverGallery
    return;
  }
  // Drop it from the authoritative storage list too, so the card doesn't
  // reappear on the next repaint before /api/gallery is re-fetched.
  if (Array.isArray(serverGallery)) serverGallery = serverGallery.filter((o) => o.url !== it.url);
  renderGallery();
  refreshStorageBar(); // freed/moved space → refresh the usage bar
}

// ── Workspace views (Home / Projects / Gallery / Studio) ──
// Navigation is a dropdown in the topbar; the left sidebar (chat history) shows
// on Home only, so every other view gets the full width.
const VIEW_LABELS = { landing: 'Home', home: 'Builder', gallery: 'Gallery', avatar: 'Avatar', mediaAgent: 'Media Agent', sites: 'Websites', integrations: 'Integrations', settings: 'Settings' };
const VIEW_KEY = 'zephyr_view_v1';
function showView(name) {
  // The old Home landing is gone — the Builder chatbox is now home. Any lingering
  // request to open 'landing' is redirected there.
  if (name === 'landing') name = 'home';
  // Refresh-proof: remember where the user is so a reload reopens the same
  // view instead of bouncing back to the Builder.
  try { localStorage.setItem(VIEW_KEY, name); } catch {}
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const el = document.getElementById('view' + name.charAt(0).toUpperCase() + name.slice(1));
  if (el) el.classList.add('active');
  // The Website Builder is a SEPARATE product (entered only via the landing's
  // WEBSITE channel) — while it's open, the studio chrome (chats sidebar, the
  // Gallery/Avatar/Media-Agent tabs, the Back arrow) disappears entirely.
  document.body.classList.toggle('in-sites', name === 'sites');
  // The Game Studio is likewise its own product — hide the studio chrome while it's open.
  document.body.classList.toggle('in-games', name === 'games');
  // The jump-to-latest chevron belongs to the Home thread only.
  const sd = document.getElementById('scrollDown');
  if (sd && name !== 'home') sd.classList.remove('show');
  if (name === 'gallery') { renderGallery(); refreshGallery(); refreshStorageBar(); }
  if (name === 'avatar') renderAvatar();
  if (name === 'mediaAgent') renderMediaAgent();
  if (name === 'sites') renderSites();
  if (name === 'games') renderGames();
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
  'img-src': (e, el) => openImgSrc(el.dataset.src, e, el),
  'img-pick': (e, el) => imgSrcPick(el.dataset.pick, e),
  'mask-edit': () => openMaskEditor(),
  'mask-clear': (e) => { e.stopPropagation(); clearMask(); },
  'file': (e, el) => {
    // Media slots open the source chooser (gallery + device); anything else
    // (e.g. the gallery-header Import) stays a direct file dialog.
    if (SRC_SLOTS[el.dataset.file]) { openSrcMenu(el.dataset.file, e, el); return; }
    const f = document.getElementById(el.dataset.file); if (f) f.click();
  },
  'slot-pick': (e, el) => slotSrcPick(el.dataset.slot, el.dataset.pick, e),
  'sr-tab': (e, el) => { e.stopPropagation(); pickSrTab(el.dataset.tab); },
  'dir-menu': (e) => toggleDirMenu(e),
  'orch-toggle': () => toggleOrchestrator(),
  'set-mode': (e, el) => {
    const changing = el.dataset.mode !== mode;
    setMode(el.dataset.mode);
    // A pending Plan card was composed for the OLD kind of generation — a mode
    // switch invalidates it (re-pricing it in the new mode would be wrong), so
    // drop it from the thread and storage (bug 2026-07-17).
    if (changing) {
      clearReviews();
      document.querySelectorAll('#messages .review-card').forEach((n) => n.remove());
    }
  },
  'model-menu': (e) => toggleModelMenu(e),
  'opt-settings': (e) => toggleOpt(e, 'settings'),
  'send': () => send(true),
  'landing': () => goLanding(),
  'gal-filter': (e, el) => setGalFilter(el.dataset.f),
  'gal-sort': () => toggleGalSort(),
  'gal-import': () => {
    // No storage (free/lapsed/top-up-only) → the pricing sheet, not a doomed
    // file pick. Unknown status (bar hasn't loaded) falls through to the pick;
    // the server's own 402 still backstops it.
    if (galStorage && !galStorage.cap) { openCredits(); return; }
    const f = document.getElementById('fileGalImport');
    if (f) f.click();
  },
  'gal-import-url': () => importGalleryUrl(),
  'gal-upgrade': () => openCredits(),
  'scroll-down': () => { const box = document.getElementById('messages'); if (box) scrollThreadBottom(box.parentElement, true); },
};
const CHANGE_ACTIONS = {
  'attach': (e, el) => onAttach(el.dataset.attach, el),
  'gal-import-files': (e, el) => importGalleryFiles(el),
  'attach-extra': (e, el) => onAttachExtra(el),
  'attach-ref': (e, el) => onAttachRef(el),
  'attach-el': (e, el) => onAttachEl(el),
  'attach-vx': (e, el) => onAttachVx(el),
  'attach-ax': (e, el) => onAttachAx(el),
};
const INPUT_ACTIONS = {
  'search': () => renderChatList(),
  'autogrow': (e, el) => { autoGrow(el); refreshSendEnabled(); try { renderRefChips(); } catch (err) {} },
};
const KEYDOWN_ACTIONS = {
  'send': (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } },
  'credits-topup': (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCredits(true); } },
  'gal-import-url': (e) => { if (e.key === 'Enter') { e.preventDefault(); importGalleryUrl(); } },
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

// ══════════════════════════════════════════════════════════════════════════
// Game Studio — a STANDALONE screen (its own view, like the Website Builder).
// Entered from the landing's GAME channel → showView('games') → renderGames().
// Prompt → POST /api/game/build (Sonnet(GAME_RULES) → container build + runtime
// smoke test → auto-fix loop → publish to /g/<slug>/) → a big playable iframe.
// Not a mode inside the media composer — it never touches the video generator.
// ══════════════════════════════════════════════════════════════════════════
const GAMES_KEY = 'zephyr_games_v1';
let gameOpenSlug = null;
let gameBuilding = false;
let gameView = 'preview'; // 'preview' | 'code' — the open game's active tab
let gameArt = 'shapes';   // 'shapes' | 'sprites' — Phase 6 AI art toggle
let gameEngine = '2d';    // '2d' (kaplay) | '3d' (Babylon) — Phase 7 engine toggle
function gsEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function gamesLoad() { try { return JSON.parse(localStorage.getItem(GAMES_KEY) || '[]'); } catch { return []; } }
function gamesSave(list) { try { localStorage.setItem(GAMES_KEY, JSON.stringify(list.slice(0, 40))); } catch {} try { touchAssets(); } catch {} }

const GAME_GENRES = [
  { key: 'runner', label: 'Endless runner', prompt: 'An endless runner where you dash and double-jump over neon obstacles and grab glowing orbs. It gets faster over time.' },
  { key: 'flappy', label: 'Flappy', prompt: 'A flappy-style game — tap or press space to fly through the gaps between neon pipes. One life, score per pipe.' },
  { key: 'breakout', label: 'Breakout', prompt: 'A breakout game — bounce a ball off a paddle to smash a wall of colourful neon bricks. Three lives, win when the wall is cleared.' },
  { key: 'topdown', label: 'Top-down shooter', prompt: 'A top-down arena shooter — move with WASD, aim with the mouse, and blast endless waves of enemies that home in on you.' },
  { key: 'platformer', label: 'Platformer', prompt: 'A platformer — run and double-jump across floating platforms, collect coins, and reach the goal flag to win.' },
];

function gameTitle(slug) {
  const t = String(slug || 'game').split('-').slice(0, -1).join(' ').trim();
  return t ? t.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Your game';
}

function renderGames() {
  const view = document.getElementById('viewGames');
  if (!view) return;
  const games = gamesLoad();
  const open = gameOpenSlug ? games.find((g) => g.slug === gameOpenSlug) : null;

  const tabs = open
    ? '<div class="gs-tabs">' +
        '<button class="gs-tab' + (gameView === 'preview' ? ' on' : '') + '" type="button" data-gv="preview">Preview</button>' +
        '<button class="gs-tab' + (gameView === 'code' ? ' on' : '') + '" type="button" data-gv="code">Code</button>' +
      '</div>'
    : '';
  const head =
    '<div class="gs-top">' +
      '<button class="gs-back" type="button" id="gsBack">‹ Studio</button>' +
      '<div class="gs-brand">🎮 <b>Game Studio</b></div>' +
      '<div style="flex:1"></div>' +
      tabs +
      (open ? '<a class="gs-open" href="' + open.url + '" target="_blank" rel="noopener">Open ↗</a>' +
              '<button class="gs-new" type="button" id="gsNew">+ New game</button>' : '') +
    '</div>';

  let body;
  if (open && gameView === 'code') {
    body = '<div class="gs-codeview" id="gsCodeView"><div class="gs-code-load">Loading source…</div></div>';
  } else if (open) {
    body =
      '<div class="gs-stage">' +
        '<div class="gs-frame-wrap"><div class="gs-frame">' +
          '<iframe title="' + gameTitle(open.slug) + '" src="' + open.url + '" allow="autoplay; fullscreen"></iframe>' +
        '</div>' +
        '<div class="gs-meta"><b>' + gameTitle(open.slug) + '</b><span>Play-tested ✓ · click the game to play</span></div>' +
        '<div class="gs-revise">' +
          '<input id="gsRevise" type="text" placeholder="Change something — “make it faster”, “add a boss”, “neon green theme”…" />' +
          '<button class="gs-build" type="button" id="gsReviseBtn">Update</button>' +
          '<span class="gs-status" id="gsReviseStatus"></span>' +
        '</div></div>' +
      '</div>';
  } else {
    const chips = GAME_GENRES.map((g) => '<button class="gs-chip" type="button" data-genre="' + g.key + '">' + g.label + '</button>').join('');
    const is3d = gameEngine === '3d';
    const artToggle =
      '<div class="gs-toggles">' +
        '<div class="gs-arttoggle">' +
          '<button class="gs-artbtn' + (is3d ? ' on' : '') + '" type="button" id="gsEngine" role="switch" aria-checked="' + (is3d ? 'true' : 'false') + '"><span class="gs-artknob"></span>🧊 3D <span class="gs-beta">beta</span></button>' +
          '<span class="gs-arthint">' + (is3d ? 'A real 3D world (WebGL) — first-person, heavier build' : 'Toggle for a 3D game instead of 2D') + '</span>' +
        '</div>' +
        (is3d ? '' :
          '<div class="gs-arttoggle">' +
            '<button class="gs-artbtn' + (gameArt === 'sprites' ? ' on' : '') + '" type="button" id="gsArt" role="switch" aria-checked="' + (gameArt === 'sprites' ? 'true' : 'false') + '"><span class="gs-artknob"></span>✨ AI art</button>' +
            '<span class="gs-arthint" id="gsArtHint">' + (gameArt === 'sprites' ? 'Generated sprites — richer look, uses more credits' : 'Clean neon shapes — fast &amp; free') + '</span>' +
          '</div>') +
      '</div>';
    const cards = games.length
      ? '<div class="gs-recent"><div class="gs-recent-lab">Your games</div><div class="gs-grid">' +
          games.map((g) => '<div class="gs-card" role="button" tabindex="0" data-slug="' + g.slug + '">' +
            '<span class="gs-card-frame"><iframe tabindex="-1" title="" src="' + g.url + '" scrolling="no"></iframe></span>' +
            '<span class="gs-card-t">' + gameTitle(g.slug) + '</span>' +
            '<button class="gs-card-del" type="button" data-del="' + g.slug + '" title="Delete game" aria-label="Delete game"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>' +
          '</div>').join('') +
        '</div></div>'
      : '';
    body =
      '<div class="gs-compose">' +
        '<h1 class="gs-h1">What are we <span class="gs-grad">playing</span>?</h1>' +
        '<p class="gs-sub">Describe a game. Go Farther writes it, compiles it, and play-tests it before you see it.</p>' +
        '<div class="gs-chips">' + chips + '</div>' +
        artToggle +
        '<div class="gs-box">' +
          '<textarea id="gsPrompt" rows="3" placeholder="e.g. a neon endless runner where you dodge obstacles and collect orbs…"></textarea>' +
          '<div class="gs-box-foot">' +
            '<span class="gs-status" id="gsStatus"></span>' +
            '<button class="gs-build" type="button" id="gsBuild">Build game →</button>' +
          '</div>' +
        '</div>' +
        '<pre class="gs-code" id="gsCode" hidden></pre>' +
        cards +
      '</div>';
  }
  view.innerHTML = head + body;

  const back = view.querySelector('#gsBack'); if (back) back.onclick = () => showView('home');
  const nw = view.querySelector('#gsNew'); if (nw) nw.onclick = () => { gameOpenSlug = null; gameView = 'preview'; renderGames(); };
  view.querySelectorAll('.gs-tab').forEach((t) => { t.onclick = () => { gameView = t.dataset.gv; renderGames(); }; });
  view.querySelectorAll('.gs-card').forEach((c) => {
    c.onclick = () => { gameOpenSlug = c.dataset.slug; gameView = 'preview'; renderGames(); };
    c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); gameOpenSlug = c.dataset.slug; gameView = 'preview'; renderGames(); } };
  });
  view.querySelectorAll('.gs-card-del').forEach((d) => { d.onclick = (e) => { e.stopPropagation(); gameDelete(d.dataset.del); }; });
  // A game brief typed on the landing GAME channel, carried through login.
  if (!open && pendingGameBrief) { const ta = view.querySelector('#gsPrompt'); if (ta) { ta.value = pendingGameBrief; pendingGameBrief = null; ta.focus(); } }
  if (open && gameView === 'code') loadGameCode(open.slug);
  view.querySelectorAll('.gs-chip').forEach((ch) => { ch.onclick = () => {
    const g = GAME_GENRES.find((x) => x.key === ch.dataset.genre);
    const ta = view.querySelector('#gsPrompt'); if (g && ta) { ta.value = g.prompt; ta.focus(); }
  }; });
  const engineBtn = view.querySelector('#gsEngine');
  if (engineBtn) engineBtn.onclick = () => {
    gameEngine = gameEngine === '3d' ? '2d' : '3d';
    if (gameEngine === '3d') gameArt = 'shapes'; // 3D uses primitives, not AI sprites
    renderGames(); // re-render so the AI-art toggle hides/shows
  };
  const artBtn = view.querySelector('#gsArt');
  if (artBtn) artBtn.onclick = () => {
    gameArt = gameArt === 'sprites' ? 'shapes' : 'sprites';
    artBtn.classList.toggle('on', gameArt === 'sprites');
    artBtn.setAttribute('aria-checked', gameArt === 'sprites' ? 'true' : 'false');
    const hint = view.querySelector('#gsArtHint');
    if (hint) hint.textContent = gameArt === 'sprites' ? 'Generated sprites — richer look, uses more credits' : 'Clean neon shapes — fast & free';
  };
  const buildBtn = view.querySelector('#gsBuild');
  if (buildBtn) buildBtn.onclick = () => {
    const ta = view.querySelector('#gsPrompt');
    const brief = (ta && ta.value || '').trim();
    if (!brief) { if (ta) ta.focus(); return; }
    gameStudioBuild(brief);
  };
  const rvBtn = view.querySelector('#gsReviseBtn');
  const doRevise = () => {
    const inp = view.querySelector('#gsRevise');
    const ins = (inp && inp.value || '').trim();
    if (!ins) { if (inp) inp.focus(); return; }
    gameStudioRevise(open.slug, ins);
  };
  if (rvBtn) rvBtn.onclick = doRevise;
  const rvInp = view.querySelector('#gsRevise');
  if (rvInp) rvInp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); doRevise(); } };
}

// Iterate on an open game — POST /api/game/revise (loads its stashed source,
// applies the change with GAME_REVISE_RULES, rebuilds + smoke-tests, republishes
// to the SAME slug). Reloads the iframe in place so the change shows immediately.
async function gameStudioRevise(slug, instruction) {
  if (gameBuilding) return;
  gameBuilding = true;
  const btn = document.getElementById('gsReviseBtn');
  const status = document.getElementById('gsReviseStatus');
  if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }
  if (status) status.textContent = 'Starting…';
  let done = null, err = null;
  try {
    const r = await apiFetch('/api/game/revise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, instruction }) });
    if (r.status === 402) { if (status) status.textContent = 'Out of credits — top up to keep editing.'; if (typeof openCredits === 'function') openCredits(true); return; }
    if (!r.ok || !r.body) { if (status) status.textContent = '⚠️ Couldn’t start the edit — try again.'; return; }
    const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done: rd } = await reader.read(); if (rd) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.ev === 'phase') { if (status) status.textContent = GAME_PHASES[ev.phase] || ev.phase; }
        else if (ev.ev === 'done') { done = ev; }
        else if (ev.ev === 'error') { err = ev; }
      }
    }
    if (err) { if (status) status.textContent = '⚠️ ' + (err.msg || 'That change didn’t apply — try rephrasing.'); return; }
    if (!done) { if (status) status.textContent = '⚠️ The edit ended early — try again.'; return; }
    if (typeof done.balance === 'number' && typeof setCredits === 'function') setCredits(done.balance);
    const fr = document.querySelector('#viewGames .gs-frame iframe');
    if (fr) fr.src = done.url + '?r=' + Date.now(); // cache-buster → the rebuilt game reloads
    if (status) status.textContent = 'Updated ✓' + (done.fixed ? ' · auto-fixed ' + done.fixed + '×' : '');
    const inp = document.getElementById('gsRevise'); if (inp) inp.value = '';
  } catch (e) {
    if (status) status.textContent = '⚠️ Couldn’t reach the builder just now — give it a moment.';
  } finally {
    gameBuilding = false;
    const b2 = document.getElementById('gsReviseBtn');
    if (b2) { b2.disabled = false; b2.textContent = 'Update'; }
  }
}

// Code view — fetch the game's stashed source and render each file, with Download.
async function loadGameCode(slug) {
  const el = document.getElementById('gsCodeView');
  if (!el) return;
  try {
    const r = await apiFetch('/api/game/source?slug=' + encodeURIComponent(slug));
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok || !d.files) { el.innerHTML = '<div class="gs-code-load">Couldn’t load the source.</div>'; return; }
    const paths = Object.keys(d.files).sort((a, b) => (a === 'src/main.js' ? -1 : b === 'src/main.js' ? 1 : a.localeCompare(b)));
    el.innerHTML =
      '<div class="gs-code-head"><span>' + paths.length + ' file' + (paths.length === 1 ? '' : 's') + ' · kaplay</span>' +
        '<button class="gs-dl" type="button" id="gsDownload">↓ Download source</button></div>' +
      paths.map((p) => '<div class="gs-file"><div class="gs-file-h">' + gsEsc(p) + '</div><pre class="gs-code gs-code-static">' + gsEsc(d.files[p]) + '</pre></div>').join('');
    const dl = document.getElementById('gsDownload');
    if (dl) dl.onclick = () => downloadGameSource(slug, d.files);
  } catch (e) { el.innerHTML = '<div class="gs-code-load">Couldn’t load the source.</div>'; }
}

function downloadGameSource(slug, files) {
  const bundle = Object.entries(files).map(([p, s]) => '===FILE: ' + p + '===\n' + s).join('\n\n');
  const blob = new Blob([bundle], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (slug || 'game') + '-source.txt';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Delete a published game: wipe it server-side (dist + stashed source) and drop
// it from the local list. Optimistic — the local list is the source of truth for
// the grid, and the server call is idempotent.
async function gameDelete(slug) {
  if (!slug) return;
  if (!window.confirm('Delete “' + gameTitle(slug) + '”? This removes the game and its link for good.')) return;
  try {
    const r = await apiFetch('/api/game/delete?slug=' + encodeURIComponent(slug), { method: 'DELETE' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); if (typeof sbToast === 'function') sbToast(d && d.error === 'not your game' ? 'That game isn’t yours to delete.' : 'Couldn’t delete that game — try again.'); return; }
  } catch (e) { if (typeof sbToast === 'function') sbToast('Couldn’t reach the server — try again.'); return; }
  const list = gamesLoad().filter((g) => g.slug !== slug);
  gamesSave(list);
  if (gameOpenSlug === slug) { gameOpenSlug = null; gameView = 'preview'; }
  renderGames();
  if (typeof sbToast === 'function') sbToast('Game deleted.');
}

// Live phase labels for the streamed build.
const GAME_PHASES = { generating: 'Designing & writing the code…', arting: 'Creating the art…', compiling: 'Compiling…', fixing: 'Fixing a hiccup…', publishing: 'Publishing…' };
async function gameStudioBuild(brief) {
  if (gameBuilding) return;
  gameBuilding = true;
  const btn = document.getElementById('gsBuild');
  const status = document.getElementById('gsStatus');
  const codeEl = document.getElementById('gsCode');
  if (btn) { btn.disabled = true; btn.textContent = 'Building…'; }
  if (status) status.textContent = 'Starting…';
  if (codeEl) { codeEl.textContent = ''; codeEl.hidden = false; }
  const appendCode = (t) => { if (!codeEl) return; codeEl.textContent += t; if (codeEl.textContent.length > 12000) codeEl.textContent = codeEl.textContent.slice(-9000); codeEl.scrollTop = codeEl.scrollHeight; };
  let done = null, err = null;
  try {
    const r = await apiFetch('/api/game/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief, art: gameArt, engine: gameEngine }) });
    if (r.status === 402) { if (status) status.textContent = 'Out of credits — top up to build a game.'; if (typeof openCredits === 'function') openCredits(true); return; }
    if (!r.ok || !r.body) { if (status) status.textContent = '⚠️ Couldn’t start the build — try again.'; return; }
    // Consume the NDJSON stream: {ev:"phase"|"code"|"done"|"error"}.
    const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done: rd } = await reader.read(); if (rd) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.ev === 'phase') { if (status) status.textContent = GAME_PHASES[ev.phase] || ev.phase; }
        else if (ev.ev === 'code') { appendCode(ev.t); }
        else if (ev.ev === 'done') { done = ev; }
        else if (ev.ev === 'error') { err = ev; }
      }
    }
    if (err) { if (status) status.textContent = '⚠️ ' + (err.msg || 'That build didn’t come together — try again, maybe simpler.'); return; }
    if (!done) { if (status) status.textContent = '⚠️ The build ended early — try again.'; return; }
    const games = gamesLoad();
    games.unshift({ slug: done.slug, url: done.url, ts: Date.now() });
    gamesSave(games);
    if (typeof done.balance === 'number' && typeof setCredits === 'function') setCredits(done.balance);
    gameOpenSlug = done.slug;
    gameView = 'preview';
    renderGames();
  } catch (e) {
    if (status) status.textContent = '⚠️ Couldn’t reach the game builder just now — give it a moment.';
  } finally {
    gameBuilding = false;
    const b2 = document.getElementById('gsBuild');
    if (b2) { b2.disabled = false; b2.textContent = 'Build game →'; }
  }
}
