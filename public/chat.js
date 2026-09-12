
// ── Two helpers the site builder reads, lifted out of the media side ────────
// Both were declared in the middle of the generator's own code and are used by
// the builder: `esc` on every string the start screen and the workspace put
// into an innerHTML, `schWhen` for the "updated 3 minutes ago" line on a site
// card. They came here rather than staying behind, because a helper whose only
// callers are the builder belongs with the builder — and because leaving two
// live names inside a region being deleted is how a deletion ships a
// ReferenceError nothing can see (this file has done it five times).
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// "Jul 4, 2026 · 3:30 PM" from an ISO/local datetime string.
function schWhen(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  try { return new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch { return ''; }
}
// Shown in Settings → About, and in the support mailto's footer.
const APP_VERSION = '1.0.0';
// A brief typed on the landing (or arriving as `?q=`) before the visitor is
// signed in. `enterApp` consumes it and starts the build; backing out of the
// sign-up popup clears it, so a later login never fires a build nobody asked
// for twice. Declared here because it outlived the chat-sync block it used to
// sit in — one holder now, where there were two.
let pendingSiteBrief = null;
// Provider identity per model id: real logo where we have one, monogram
// otherwise. `tint` is the provider's brand colour.
//
// KEPT FOR THE LANDING, WHICH STILL ADVERTISES THE GENERATOR. The marketing
// page's model pipeline (`initPipeModels`) walks MODELS_TAB and asks this for
// each row's badge. That page — its CRT channel selector, its pipeline, its
// alternating "generate / build" prompt line — is the one part of the media side
// still standing, deliberately: rewriting it is a design job the owner directs,
// not a deletion. Until then the tables it reads stay, and this is one of them.
function providerOf(id) {
  if (/nano-banana/.test(id)) return { logo: '/logos/nanobanana.svg', name: 'Nano Banana', tint: '#f5b423' };
  if (/gemini/.test(id)) return { logo: '/logos/gemini.svg', name: 'Gemini', tint: '#6c7cff' };
  if (/sora/.test(id)) return { logo: '/logos/sora.svg', name: 'OpenAI', tint: '#10a37f' };
  if (/gpt-image|^openai\//.test(id)) return { logo: '/logos/openai.svg', name: 'OpenAI', tint: '#10a37f' };
  if (/veo|^google\//.test(id)) return { logo: '/logos/google.svg', name: 'Google', tint: '#4285f4' };
  if (/seedance|seedream|bytedance/.test(id)) return { logo: '/logos/bytedance.svg', name: 'ByteDance', tint: '#3c8cff' };
  if (/kling/.test(id)) return { logo: '/logos/kling.svg', name: 'Kling', tint: '#ff6a2b' };
  if (/hailuo|minimax/.test(id)) return { logo: '/logos/hailuo.svg', name: 'MiniMax', tint: '#6a5bff' };
  if (/claude|anthropic/i.test(id)) return { logo: '/logos/claude.svg', name: 'Anthropic', tint: '#d97757' };
  if (/grok|^xai\//i.test(id)) return { logo: '/logos/grok.svg', name: 'xAI', tint: '#c9ccd4' };
  if (/elevenlabs/.test(id)) return { logo: '/logos/elevenlabs.svg', name: 'ElevenLabs', tint: '#a6b0c0' };
  if (/flux/.test(id)) return { logo: '/logos/flux.svg', name: 'Black Forest Labs', tint: '#f0585d' };
  if (/recraft/.test(id)) return { logo: '/logos/recraft.svg', name: 'Recraft', tint: '#7b6bff' };
  if (/krea/.test(id)) return { logo: '/logos/krea.svg', name: 'Krea', tint: '#ff5c8a' };
  return { mono: '·', name: '', tint: '#8a8a92' };
}

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
// The order groups appear in. Explicit rather than Object.keys, so the landing
// leads with what the platform is best known for instead of with whatever was
// declared first.
//
// Each group is a LIST and nothing else. It used to carry a title and a
// subtitle too, for the headings of the nav dropdown these lists also filled;
// that menu was removed on 2026-08-29 (the pipeline down the landing names
// every model already, so the nav item was a second answer to the same
// question) and the headings went with it.
const MODELS_ORDER = ['video', 'image', 'audio', 'llm'];
const MODELS_TAB = {
  llm: { list: () => LLM_MODELS },
  video: { list: () => MODEL_LISTS.video },
  image: { list: () => MODEL_LISTS.image },
  audio: { list: () => MODEL_LISTS.audio },
};

const GROUP_META = {
  seedance:  { label: 'Seedance 2.0', variant: () => '' },
  kling:     { label: 'Kling',        variant: () => '' },
  // No active-variant chip on the Veo parent row (owner 2026-07-17: the
  // "Lite" pill next to "Veo 3.1" read badly) — the flyout's ✓ shows the pick.
  veo:       { label: 'Veo 3.1',      variant: () => '' },
};

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
  grok:   { label: 'Grok 4.6', desc: 'About half the price — newest here, less proven' },
};
const BUILD_PICKER_KEY = 'zephyr_build_picker_v1';
// `auto` is still in some browsers' localStorage from the hours it existed, so
// a stored value that is no longer an option has to fall back rather than
// render an undefined label.
// GROK FROM 2026-08-22, and this must match `DEFAULT_PICKER` in
// builder/build-models.mjs — a test asserts they agree, because a composer
// defaulting to one picker while the server defaults to another means a request
// that says nothing gets a different model from the one the customer is looking
// at. See that file for why the default moved.
//
// A STORED CHOICE STILL WINS, which is the point of reading localStorage first —
// and the cost is worth saying: anybody who has already used the picker keeps
// whatever they picked, so an existing browser holding 'sonnet' goes on sending
// 'sonnet'. The flip reaches new sessions, not old ones.
let buildPicker = localStorage.getItem(BUILD_PICKER_KEY) || 'grok';
if (!BUILD_PICKERS[buildPicker]) buildPicker = 'grok';
// ONE PICKER, DRAWN ON BOTH SCREENS (owner, 2026-09-07: "PUT THE PICKER TOO IN
// THE SITESPAGE PAGE, THE ONE BEFORE, AND THEN WHATEVR THE USER CHOOSES THERE IT
// GOES NEXT"). It lived only in the workspace composer, which is the screen you
// reach AFTER the first build has already been sent — so the one build where the
// choice matters most was the one build nobody could make it for.
//
// "WHATEVER THEY CHOOSE THERE GOES NEXT" NEEDS NO CARRYING. `buildPicker` is one
// module variable behind one storage key, `reactSend` reads it when it posts the
// build, and the workspace chip renders from it — so a pick made on the start
// screen IS the pick the build runs on and the pick the next screen shows. The
// alternative, passing a choice along beside the prompt, would be a second place
// the answer lives, and this file already records what two copies of one value
// cost.
//
// `dir` IS WHICH WAY THE MENU OPENS, and it follows from where the chip sits
// rather than from taste: in the workspace the composer is at the foot of the
// rail, so the menu drops UP over the thread; on the start screen the same chip
// is near the top of the page under the hero, where dropping up would open it
// across the heading and off the top of a short window. Anything that is not
// exactly "down" opens up, so the existing call site keeps its behaviour whatever
// it is handed. ONE function either way: a second copy of this markup is the
// recorded "two lists of the same thing", and the two would disagree the first
// time a model joined the table.
function buildPickerHTML(dir) {
  const up = dir !== 'down';
  return '<span class="st-buildsel-wrap">' +
    '<button type="button" class="st-buildsel" id="stBuildSel" title="Which model builds the site">Builder: <b id="stBuildLabel">' + BUILD_PICKERS[buildPicker].label + '</b> ▾</button>' +
    '<div class="model-menu ' + (up ? 'drop-up ' : '') + 'build-menu" id="stBuildMenu">' +
      Object.keys(BUILD_PICKERS).map((k) => { const m = BUILD_PICKERS[k]; return '<div class="model-item build-item' + (k === buildPicker ? ' selected' : '') + '" data-pick="' + k + '"><span class="txt"><b>' + m.label + '</b><small>' + m.desc + '</small></span><span class="check">✓</span></div>'; }).join('') +
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

// ── Effort dial (1→5) — PARKED 2026-09-07, owner: "DELETE THE EFFORT THING FOR NOW".
//
// It used to sit beside the model picker in the site-builder composer and ride the
// build and revise as `effort`. It is off the row, off the wiring and off both
// request bodies; the table and these three functions stay, because "for now" is
// what the owner said and this is the `gif` precedent — the mechanism kept, the
// door removed, and the way back written down rather than remembered.
//
// WHY IT WENT, and it is not that nobody used it: it had been VISIBLE AND INERT
// since 2026-08-08 by the owner's own call ("leave the effort thing off, leave it
// there but doesn't work, i want it like that"). The build route says so in as
// many words — `body.effort` stays unread — so what a customer saw was a
// five-level dial that changed nothing. That is this repo's open dead-control
// finding, in its own chrome for the third time in a fortnight (`stMembers`, the
// Security panel's Run scan, this). A disabled control earns its place by SAYING
// something true; "not built yet" does, a dial with no effect does not.
//
// TO PUT IT BACK, three lines and nothing else: `buildEffortHTML() +` after
// `buildPickerHTML() +` in the composer row, `wireBuildEffort();` beside
// `wireBuildPicker();` at the end of that render, and `effort: buildEffort` on
// the two bodies in `reactSend`. Then wire `body.effort` on the build route, or
// it comes back exactly as inert as it went.
//
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
// The account badge names 'Member' for any paid account and 'Free plan'
// otherwise.
//
// IT USED TO NAME THE TIER — Plus / Pro / Max — and that is a real loss, said
// rather than hidden. The tier came off the gallery's storage status
// (`/api/storage`), because storage is the thing the tiers differ in; the
// gallery went with the media side on 2026-09-12 and took the only reader of
// that route with it. `/api/credits` answers paid-or-not and no tier name, so
// this now says the true half of what it used to. Putting the tier back means
// either asking /api/storage from here (a route about a feature that no longer
// exists) or adding the tier to the credits answer, which is the right home for
// it — the owner's call, not a thing to invent inside a deletion.
function planLabelText() {
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
    // FIRST RUN IS ASKED OF THE SITES LIST NOW. It used to be "has this
    // account got a chat with messages in it", which was the media side's own
    // store; the builder's equivalent is whether they have built anything.
    // Same question, one product later: do not greet somebody mid-work with a
    // welcome modal.
    try { if ((JSON.parse(localStorage.getItem(SITES_KEY) || '[]') || []).length) return; } catch (e) {}
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
  const initial = (name[0] || '·').toUpperCase();
  const av = document.getElementById('sideAvatar');
  if (av) av.textContent = initial;
  const btnAv = document.getElementById('profileBtnAv');
  if (btnAv) btnAv.textContent = initial;
  const so = document.getElementById('signOutRow');
  if (so) so.style.display = '';
  // A different account signed in on this browser: drop the previous user's
  // local cache so their sites are never shown to — or re-uploaded under —
  // this account. (Sign-out clears it too; this covers expired-session swaps.)
  //
  // THE LIST SHRANK WITH THE MEDIA SIDE and that is the whole of the change
  // here: every key it used to name — the chat store, the job and save queues,
  // the delivered-media ledger, universal memory, the avatar-sync clock, the
  // staged attachments — belonged to the generator. What is left is what this
  // browser still caches for one account: its sites, the credit high-water
  // mark, and whether the welcome modal has been shown. The two avatar/product
  // keys are named as plain strings so an old browser's leftovers are still
  // cleared on an account switch, even though nothing writes them any more.
  const uid = Auth.userId ? Auth.userId() : '';
  if (uid) {
    const prevOwner = localStorage.getItem('zephyr_owner_v1');
    if (prevOwner && prevOwner !== uid) {
      try {
        [SITES_KEY, CRED_MAX_KEY, WELCOME_KEY, VIEW_KEY,
         'zephyr_chats_v1', 'zephyr_memory_v1', 'zephyr_studio_v1',
         'zephyr_avatars_v1', 'zephyr_products_v1']
          .forEach((k) => localStorage.removeItem(k));
      } catch {}
    }
    try { localStorage.setItem('zephyr_owner_v1', uid); } catch {}
  }
  // A website brief typed on the landing kicks the first build. Run it only
  // AFTER the account-switch wipe above, or it would land under the outgoing
  // account and be discarded by the reset.
  if (pendingSiteBrief) { const b = pendingSiteBrief; pendingSiteBrief = null; showView('sites'); siteCreate(b); }
  fetchCredits();
  // Land back on the view the user was on before the refresh (the builder for a
  // fresh session or anything unknown).
  let lastView = 'sites';
  try { lastView = localStorage.getItem(VIEW_KEY) || 'sites'; } catch {}
  // A PROJECT ADDRESS BEATS THE REMEMBERED VIEW, and that order is the whole
  // point of having addresses. `/projects/<id>` is a link somebody followed or
  // a tab they reloaded; localStorage is a preference this browser happened to
  // store on some earlier visit. Read the other way round, every pasted link
  // would land wherever that browser was last — which is exactly what an
  // address must not do, and would make the feature look broken to the one
  // person it was built for: whoever opened the link.
  //
  // `siteOpenId` is set BEFORE showView because showView('sites') renders
  // immediately and reads it; setting it after would paint the list first and
  // the project a frame later, or not at all.
  const bootProject = projectFromPath();
  if (bootProject !== undefined) { siteOpenId = bootProject; lastView = 'sites'; }
  showView(lastView);
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
  // Wipe this browser's local copy so the next account on this machine never
  // sees — or re-uploads — the outgoing one's sites.
  //
  // THE REFUND SWEEP WENT WITH THE GENERATOR, and it is worth saying what it
  // did rather than just that it is gone: sign-out used to credit back any
  // charged render that had not been delivered, because a queued fal job the
  // browser stopped watching was money spent for nothing. The builder has no
  // equivalent — a build's money is reserved and refunded server-side by the
  // queue consumer and the sweeper, which do not care whether anyone is still
  // signed in. So there is nothing to flush and nothing to claim back here.
  try {
    [SITES_KEY, CRED_MAX_KEY, WELCOME_KEY, VIEW_KEY, 'zephyr_owner_v1',
     'zephyr_chats_v1', 'zephyr_memory_v1', 'zephyr_studio_v1',
     'zephyr_avatars_v1', 'zephyr_products_v1']
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  if (everywhere) await Auth.signOutEverywhere();
  else await Auth.signOut();
  location.reload();
}

// Settings page — a plain, conventional settings view (grouped list rows),
// rebuilt each time it opens so account/credits/prefs are current.
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
    location.reload();
  };
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
  const closeAuth = () => {
    // Backing out of a signup drops the brief typed into the landing chatbox,
    // so a later sign-in doesn't fire a build nobody asked for a second time.
    // The remembered view is left alone: it can only ever be the builder now.
    pendingSiteBrief = null;
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
// ── The landing's prompt line writes itself (owner 2026-08-29): one example at
// a time, letters in and letters out. They alternate between something to
// GENERATE and something to BUILD, so a visitor sees both halves of the product
// within a few seconds and without a word of caption explaining it.
//
// This array is the only place the examples live. paintCrt() used to carry its
// own copy of the first line; it now asks for the typing instead, so there is
// exactly ONE writer for that attribute and no second list to drift out of step.
const LAND_PROMPTS = [
  'a neon tiger prowling a rainy Tokyo alley, cinematic',
  'a booking page for my barber shop — prices, hours, and a contact form',
  'a slow drone shot over a foggy pine forest at sunrise',
  'a one-page site for a wedding photographer, with a gallery',
  'a paper-craft hummingbird, lit like a studio portrait',
  'an app that tracks my gym sets and charts the week',
  'read this warmly: "we open at seven — come hungry"',
  'a menu site for a ramen shop, with a map and opening times',
  'a 90s VHS advert for a lemonade stand, handheld and grainy',
  'a landing page for my plumbing business that takes callbacks',
];
let landTypeTimer = null, landTypeAt = 0, landTypeEl = null;
function landTypeStop() {
  if (landTypeTimer) { clearTimeout(landTypeTimer); landTypeTimer = null; }
  landTypeEl = null;
}
function landTypeStart(inp) {
  if (!inp) return;
  if (landTypeEl === inp && landTypeTimer) return;  // already running on this box
  landTypeStop();
  landTypeEl = inp;
  // Asking for less motion should not mean an empty box: show a whole line and
  // leave it alone.
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    inp.placeholder = LAND_PROMPTS[0];
    return;
  }
  landTypeAt = 0;
  landTypeStep(0, false);
}
function landTypeStep(chars, erasing) {
  landTypeTimer = null;
  const inp = landTypeEl;
  const mkt = document.getElementById('marketing');
  // Stop dead once the box is gone or the landing is behind the app. A timer
  // that outlives its element keeps the whole landing alive after enterApp(),
  // and goes on writing to a placeholder nobody can see.
  if (!inp || !inp.isConnected || !mkt || mkt.style.display === 'none') { landTypeEl = null; return; }
  // While the visitor is typing, their words cover the placeholder anyway —
  // hold position rather than animating underneath them.
  if (inp.value) { landTypeTimer = setTimeout(function () { landTypeStep(chars, erasing); }, 700); return; }
  const full = LAND_PROMPTS[landTypeAt % LAND_PROMPTS.length];
  inp.placeholder = full.slice(0, chars);
  if (!erasing && chars < full.length) landTypeTimer = setTimeout(function () { landTypeStep(chars + 1, false); }, 42);
  else if (!erasing) landTypeTimer = setTimeout(function () { landTypeStep(chars, true); }, 2100);
  else if (chars > 0) landTypeTimer = setTimeout(function () { landTypeStep(chars - 1, true); }, 22);
  else { landTypeAt++; landTypeTimer = setTimeout(function () { landTypeStep(0, false); }, 320); }
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
  const kind = sel && sel.dataset.kind;
  // WEBSITE is a real standalone builder — its chatbox is active and Enter opens
  // the builder, so it must NOT read as coming-soon. (GAME was the other one
  // until 2026-09-12; the channel is off index.html, so a branch on it here
  // could never fire again.)
  const builder = kind === 'website';
  const live = !sel || sel.dataset.live === '1';
  const active = live || builder;
  if (box) box.classList.toggle('crt-chatbox-soon', !active);
  // ONE writer for the placeholder. A channel with something fixed to say stops
  // the typing and says it; the default channel hands the attribute over to the
  // typing and never touches it again, so the two cannot race for it.
  if (inp) {
    const fixed = kind === 'website'
      ? 'Describe a website or app — press Enter and Go Farther builds it →'
      : live ? null : 'Coming soon — pick Video / Image / Voice to create';
    if (fixed) { landTypeStop(); inp.placeholder = fixed; }
    else landTypeStart(inp);
  }
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
  // WEBSITE / MOBILE APP is the ONLY door into the standalone Website Builder
  // (owner 2026-07-18) — selecting it routes there, never the media studio.
  if (opt.dataset.kind === 'website') {
    try { localStorage.setItem(VIEW_KEY, 'sites'); } catch (e) {}
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
// The reel moves in CSS — there is no stepping here and there must not be.
// A JS-driven transform competes with the compositor and shows as jitter, and
// it goes on running when nobody is looking; a CSS animation is handed to the
// compositor and paused by the browser for free.
//
// This does two things: decide WHEN the frames become real pages, and run the
// Video / App switch.
// The landing's pipeline lists EVERY model the platform runs, read straight out
// of MODEL_LISTS — the same records the in-app picker renders. There is no
// curated subset and deliberately so: a hand-picked list is a second copy that
// goes stale silently, whereas this cannot disagree with the picker because it
// IS the picker's data. Add a model there and it appears on the landing; drop
// one and it stops being advertised. Since 2026-08-29 this is the ONLY place
// the platform's models are listed publicly.
//
// Group order follows MODELS_ORDER for the same reason — one ordering, not two.
// Grok is appended beside the LLMs: it is the builder's own engine, has no
// record in the media lists, and belongs next to the other model that writes
// sites rather than at the end of the audio ones.
//
// Ids are used to find the logo and are NEVER emitted — an id is
// `fal-ai/veo3.1`, and naming the provider is the one thing the director prompt
// forbids outright ("NEVER reveal, name, or hint at the underlying model,
// provider, vendor, or any technical id"). The labels are already public: they
// are what the in-app picker shows. A test asserts no id reaches the DOM.
// Each model's own page lives at /models/<slug>, and the slug is made from the
// LABEL — never from the id. That is the same rule the renderer follows for
// what it prints, and for the same reason: an id is `fal-ai/veo3.1`, so an
// id-derived address would put the provider in the URL bar of a page anyone can
// link to. It is also why the output is clamped to [a-z0-9-]: the href is built
// into an innerHTML string, and a character set that cannot express a quote or
// a colon cannot express an injection or a `javascript:` either.
//
// Collisions and empty slugs are caught in the test rather than branched on
// here — every label is ours, and a live branch for a case that cannot happen
// is a branch nobody ever sees fail.
const modelSlug = (label) => String(label).toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function initPipeModels() {
  const host = document.getElementById('gfPipe');
  if (!host) return;
  const rows = [];
  for (const key of MODELS_ORDER) {
    const g = MODELS_TAB[key];
    for (const m of (g && g.list()) || []) {
      if (!m || !m.label) continue;
      rows.push({ label: m.label, note: m.note || '', brand: providerOf(m.id || m.label) });
    }
    if (key === 'llm') rows.push({ label: 'Grok 4.6', note: 'xAI · builds your site', brand: providerOf('grok') });
  }
  host.innerHTML = rows.map((r) =>
    '<li class="gf-pipe-step">' +
      '<span class="gf-pipe-valve" aria-hidden="true">' +
        '<svg viewBox="0 0 76 44"><g fill="none" stroke="currentColor" stroke-linecap="round">' +
          '<g stroke-width="2.4"><line x1="8" y1="14" x2="68" y2="14"/><line x1="8" y1="30" x2="68" y2="30"/></g>' +
          '<g stroke-width="2.1"><circle cx="38" cy="22" r="12"/><line x1="26" y1="22" x2="50" y2="22"/>' +
          '<line x1="38" y1="10" x2="38" y2="34"/></g>' +
        '</g></svg>' +
      '</span>' +
      '<span class="gf-pipe-txt">' +
        '<a class="gf-pipe-name" href="/models/' + modelSlug(r.label) + '">' + (r.brand.logo
          ? '<i class="gf-pipe-mark" style="-webkit-mask-image:url(' + r.brand.logo + ');mask-image:url(' + r.brand.logo + ')"></i>'
          : '') + r.label + '</a>' +
        (r.note ? '<small>' + r.note + '</small>' : '') +
      '</span>' +
    '</li>').join('');
}
// The horizontal run at the foot of the pipeline is the AGENTS one (owner
// 2026-08-30: "each one is its own, so do agents in the first horizontal one").
// More runs are coming below it, each its own subject.
//
// ONE ENTRY PER VALVE, and the list is what the strip says the platform has —
// so it says only what the platform HAS. One ships today: Instagram and
// YouTube through Composio, reads live and comment auto-reply live. It is
// called "Agent" here rather than by its internal name (owner 2026-08-30:
// "not media agent, just agent") — the page names what a customer gets, not
// what the code calls it. Anything added here is a claim on a public page, so
// it goes in when it goes live, not before.
//
// `note` is optional and currently unused — the owner dropped the second line
// on 2026-08-30. The renderer still honours one, so a station that needs a
// qualifier can have it back without touching anything but this list.
const RUN_AGENTS = [
  { name: 'Agent' },
];

// Same valve the vertical pipe draws, turned on its side: two flange lines
// across the flow and a handwheel on the centreline. Kept here beside the list
// rather than in the markup because the stations are now data.
const RUN_VALVE =
  '<span class="gf-run-valve" aria-hidden="true"><svg viewBox="0 0 44 76">' +
    '<g fill="none" stroke="currentColor" stroke-linecap="round">' +
      '<g stroke-width="2.4"><line x1="14" y1="8" x2="14" y2="68"/><line x1="30" y1="8" x2="30" y2="68"/></g>' +
      '<g stroke-width="2.1"><circle cx="22" cy="38" r="12"/><line x1="10" y1="38" x2="34" y2="38"/>' +
      '<line x1="22" y1="26" x2="22" y2="50"/></g>' +
    '</g></svg></span>';

function initRunAgents() {
  const host = document.getElementById('gfRun');
  if (!host) return;
  host.innerHTML = RUN_AGENTS.map((a) =>
    '<li class="gf-run-step">' + RUN_VALVE +
      '<b class="gf-run-txt">' + a.name +
        (a.note ? '<small>' + a.note + '</small>' : '') +
      '</b>' +
    '</li>').join('');
}

// The clips behind the Video tab. ONE ENTRY PER RECTANGLE, and the shape is
// the card's: 'wide' 16:9, 'sq' 1:1, 'tall' 9:16. Every card is the same
// HEIGHT and takes its width from that shape, which is the rule the app strip
// above already follows and the reason a mixed row lines up instead of reading
// as a pile.
//
// PLACEHOLDER FOOTAGE: /mkt/reel1.mp4 is the only clip in the repo, so all six
// currently point at it. Drop the real files beside it and change the src —
// that is the whole edit; nothing below reads a count or a filename.
const REEL_CLIPS = [
  { src: '/mkt/reel1.mp4', poster: '/mkt/reel1.jpg', shape: 'wide', alt: 'A reel generated with Go Farther' },
  { src: '/mkt/reel1.mp4', poster: '/mkt/reel1.jpg', shape: 'tall', alt: 'A vertical reel generated with Go Farther' },
  { src: '/mkt/reel1.mp4', poster: '/mkt/reel1.jpg', shape: 'sq',   alt: 'A square reel generated with Go Farther' },
  { src: '/mkt/reel1.mp4', poster: '/mkt/reel1.jpg', shape: 'wide', alt: 'A reel generated with Go Farther' },
  { src: '/mkt/reel1.mp4', poster: '/mkt/reel1.jpg', shape: 'tall', alt: 'A vertical reel generated with Go Farther' },
  { src: '/mkt/reel1.mp4', poster: '/mkt/reel1.jpg', shape: 'sq',   alt: 'A square reel generated with Go Farther' },
];

// Two passes of the same cards, because the drift keyframe travels -50% — half
// the track — and lands mid-gap only if the halves match. Built by repeating
// ONE rendering rather than by writing the list out twice, so they cannot come
// to disagree. The second pass is aria-hidden: it is the same six clips again,
// and a screen reader should hear them once.
function initReelClips() {
  const host = document.getElementById('gfClips');
  if (!host) return;
  const card = (c, dup) =>
    '<div class="gf-reel-slide gf-clip gf-' + c.shape + '"' + (dup ? ' aria-hidden="true"' : '') + '>' +
      '<div class="gf-reel-body">' +
        '<video class="gf-reel-vid" data-src="' + c.src + '" poster="' + c.poster + '"' +
        ' muted loop playsinline preload="none" aria-label="' + c.alt + '"></video>' +
      '</div>' +
    '</div>';
  host.innerHTML = REEL_CLIPS.map((c) => card(c, false)).join('') +
                   REEL_CLIPS.map((c) => card(c, true)).join('');
}

function initReel() {
  initReelClips();
  const reel = document.querySelector('.gf-reel-sec');
  if (!reel) return;

  // ---- lazy loading. The frames are real documents and the reel is a real
  // video, so none of it is fetched until the strip is approached.
  const wake = (root) => {
    (root || reel).querySelectorAll('[data-src]').forEach((el) => {
      const u = el.getAttribute('data-src');
      if (!u) return;
      el.removeAttribute('data-src');
      el.src = u;
      if (el.tagName === 'VIDEO') { el.load(); const p = el.play(); if (p && p.catch) p.catch(() => {}); }
    });
  };

  // ---- the switch. Each pane is addressed by data-mode, so adding a third
  // mode is a button and a pane and no change here.
  const panes = Array.prototype.slice.call(reel.querySelectorAll('[data-mode]'))
    .filter((el) => !el.classList.contains('gf-sw'));
  const tabs = Array.prototype.slice.call(reel.querySelectorAll('.gf-sw'));
  const vids = Array.prototype.slice.call(reel.querySelectorAll('.gf-reel-vid'));
  const pick = (mode) => {
    panes.forEach((p) => { p.hidden = p.getAttribute('data-mode') !== mode; });
    tabs.forEach((t) => {
      const on = t.getAttribute('data-mode') === mode;
      t.classList.toggle('on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    // a video nobody is looking at should not be decoding frames — and there
    // are twelve of them now, so this matters more than it did with one
    if (mode === 'video') wake(document.getElementById('gfClips'));
    vids.forEach((v) => {
      if (mode !== 'video') return v.pause();
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    });
  };
  tabs.forEach((t) => t.addEventListener('click', () => pick(t.getAttribute('data-mode'))));

  const track = reel.querySelector('.gf-reel-track');
  if (!('IntersectionObserver' in window)) return wake(track);
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    wake(track);          // only the visible pane; the video waits for its tab
    io.disconnect();
  }), { root: document.getElementById('marketing'), rootMargin: '400px' });
  io.observe(reel);
}
function initCrt() {
  const menu = document.getElementById('crtMenu');
  if (!menu) return;
  initCrtStage();
  initReel();
  initPipeModels();
  initRunAgents();
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
  const doorEl = (el, view) => {
    if (!el) return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      try { localStorage.setItem(VIEW_KEY, view); } catch (err) {}
      if (window.Auth && Auth.isSignedIn()) { enterApp(); return; }
      if (typeof openAuthFrom === 'function') openAuthFrom('start', 'app');
    });
  };
  const door = (id, view) => doorEl(document.getElementById(id), view);
  // BOTH DOORS OPEN THE BUILDER, because there is one room. `doorVideo` used to
  // open the media studio and is left wired rather than deleted: it is a link on
  // the landing, and a landing link that does nothing is worse than one that
  // lands somewhere real. What that link SAYS is the landing's own remaining
  // work — see the note beside `providerOf`.
  door('doorVideo', 'sites');
  door('doorApp', 'sites');
  // The footer's product links are the same doors under another name, so they
  // are wired from the SAME function rather than a second copy of it — a change
  // to what a door does cannot reach these two and miss the three below.
  document.querySelectorAll('[data-door]').forEach((el) => doorEl(el, el.getAttribute('data-door')));

  // Landing chatbox: let the visitor type freely; only funnel into the sign-up
  // popup when they commit (Enter) or hit the send arrow — not on tap/focus.
  const landInput = document.getElementById('crtLandInput');
  const landSend = document.getElementById('crtLandSend');
  const landBox = document.getElementById('crtChatbox');
  const submitLand = () => {
    const sel = document.querySelectorAll('#crtMenu .crt-opt')[crtSel];
    // WEBSITE channel: the typed text is a site brief for the standalone
    // Website Builder — never a media prompt (owner 2026-07-18).
    // ONE HOLDER AND ONE DESTINATION SINCE 2026-09-12. There used to be two:
    // the WEBSITE channel put the typed text in `pendingSiteBrief` for the
    // builder, and every other live channel put it in `pendingFirstMsg` for the
    // media studio's director. The studio is gone, so a prompt has one place to
    // go and there is nothing for a second holder to hold — keeping it would be
    // a variable that is always null, read by a boot that no longer runs.
    if (sel && sel.dataset.kind === 'website') {
      const b = (landInput && landInput.value.trim()) || '';
      if (b) pendingSiteBrief = b;
      try { localStorage.setItem(VIEW_KEY, 'sites'); } catch (e) {}
      if (window.Auth && Auth.isSignedIn()) { enterApp(); return; }
      if (typeof openAuthFrom === 'function') openAuthFrom('start', 'app');
      return;
    }
    // Every other channel is a coming-soon one now, and the chatbox on it is
    // inert — Enter does nothing. That is the state the CRT selector already
    // had a design for (NO SIGNAL / COMING SOON), which is why nothing else
    // here had to change; what the landing SAYS about the product is still the
    // media side's and is the one piece of it still standing, deliberately.
    return;
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

// ── A PROJECT HAS AN ADDRESS ────────────────────────────────────────────────
//
// Owner, 2026-09-09, holding up `lovable.dev/projects/<uuid>`: "or something
// with id, look at lovable for example" → "build it".
//
// Until this, the app had NO router: zero pushState, zero popstate, and the two
// `history` calls in the file only scrubbed `?q=` and `?credits=added` off the
// URL after reading them. Every screen was a div inside the one page and the
// address bar never moved, so a site's workspace could not be linked,
// bookmarked, opened in a second tab, or backed out of — Back left the app.
//
// THE ID ALREADY EXISTED. `siteCreate` mints `site_<epoch-ms>_<5 base36>` per
// project the moment a brief is typed, and it is the `origin` threaded through
// every call. Nothing new is invented here; a value that was already the
// project's identity is simply put where a person can see and copy it.
//
// WHY THE ID AND NOT THE SLUG, since `/hartleys-barbers` reads better: the slug
// is RENAMEABLE (the `slug`→`rename` lane, `site_aliases`, the one-current-name
// index), so a slug URL would move under the customer on a rename and need the
// alias machinery a second time — for the app instead of the site. And a slug
// does not exist until the build finishes, which is the eight-minute window
// where a stable address is worth the most. The id has neither problem.
const PROJECT_PATH = /^\/projects(?:\/([A-Za-z0-9_-]{1,120}))?\/?$/;

/**
 * Which project the current URL names.
 *
 * THREE ANSWERS, AND THE THIRD IS WHY THIS RETURNS `undefined` RATHER THAN
 * FALLING BACK: `undefined` means the URL is not a project address at all (the
 * landing, `/privacy`, anything else), and the caller must then leave the view
 * alone. Collapsing that into `null` — the project LIST — would make every
 * ordinary page load navigate to the sites screen.
 */
function projectFromPath() {
  const m = PROJECT_PATH.exec(location.pathname);
  return m ? (m[1] || null) : undefined;
}

/**
 * Open a project (or the list, with `null`) — the ONE way either happens.
 *
 * State and URL move together here and nowhere else. Four call sites navigate
 * (a card, the Data button, a new build, the Back arrow) and pushing from each
 * of them is the recorded "two lists of the same thing": the fifth one added
 * later is the one that forgets, and a forgotten push is invisible — the screen
 * is right and only the address is stale. One function cannot drift.
 *
 * `mode` says what to do with history: "push" for a navigation a person made,
 * "replace" for a correction (an id that resolves to nothing), and "none" when
 * the browser moved us and the entry already exists — pushing on popstate is
 * how Back becomes a trap you cannot get out of.
 */
function openProject(id, mode) {
  siteOpenId = id || null;
  const path = siteOpenId ? '/projects/' + siteOpenId : '/projects';
  // A PUSH TO THE PATH WE ARE ALREADY ON IS A REPLACE. Re-opening the site that
  // is already open (the Data button on the open project, a re-render) would
  // otherwise stack identical entries and Back would appear to do nothing for
  // as many presses as the screen was re-entered. Every branch below is
  // reachable: push moves, replace corrects, "none" leaves history alone.
  try {
    if (mode === 'push' && location.pathname !== path) history.pushState({ project: siteOpenId }, '', path);
    else if (mode === 'push' || mode === 'replace') history.replaceState({ project: siteOpenId }, '', path);
  } catch (e) {}
  renderSites();
}

// BACK AND FORWARD MOVE A SCREEN. Re-read the path and re-render with mode
// "none" — the entry the browser just moved to is already in history, so
// pushing here would add a second copy of it and Back would never escape.
// A pop to a non-project URL is left alone: that is the landing or another
// view, and this router owns the sites screen only.
window.addEventListener('popstate', () => {
  const id = projectFromPath();
  if (id === undefined) return;
  if (typeof showView === 'function') showView('sites');
  openProject(id, 'none');
});
let siteDevice = 'desktop'; // preview viewport: desktop | tablet | phone
let siteBusy = false;       // a build/revision is "running" (sample: brief delay)
let siteAbort = null;       // AbortController for the in-flight build/revise (Stop)
let siteBuildMsg = '';      // live streamed build step ("Designing 3 pages…") shown while busy
let siteBuild = null;       // { phase, pages[], done[], tick } — running build activity log
let siteTicker = null;      // setInterval handle rotating the active "live" line
let siteView = 'preview';   // workspace stage: preview | code | more | data
// WHICH VIEW THE STAGE IS ACTUALLY SHOWING, which is not always the one that was
// asked for. `siteView` is module scope and outlives the site it was set on, and
// the Data view is only offered to a site that HAS a database — so a site
// without one can arrive carrying 'data', and the stage's own chain falls
// through to the preview. Anything that has to AGREE with the stage asks this
// one function; a second copy of the chain would disagree in exactly that case,
// which is the one nobody would think to test.
const stStageView = (view, hasData) =>
  view === 'code' ? 'code'
    : (hasData && view === 'data') ? 'data'
      : view === 'more' ? 'more'
        : 'preview';
let siteMoreTab = 'analytics'; // More sub-nav: analytics | cloud | security | seo
let siteDataTable = '';     // Data panel: which table is open
let siteDataForm = null;    // Data panel: the add/edit row form ({editId, values}) when open
// The Code tab's fetched source, and which file of it is open. `siteCodeFiles` is
// what the top bar's Download zips, so the tab and the download can never
// disagree about what the site is made of — one list, two readers.
let siteCodeFiles = [];     // Code panel: [{name, text}] from /api/site/source
let siteCodeOpen = '';      // Code panel: the open file, kept by NAME across renders
// WHICH FOLDERS ARE OPEN, and `null` is a THIRD state rather than "none of
// them". Until the customer has folded or unfolded anything there is no choice
// to remember, and the first draw derives one — open the folder holding the file
// on screen, leave the rest folded. An empty Set is a different thing entirely:
// a customer who has closed every folder, which must survive a re-render.
// Reading the two as one would re-open a folder somebody just closed, on the
// next click, for ever.
let siteCodeOpenGroups = null;
// WHAT IS IN THE SEARCH BOX, at module scope for the reason the fold set is: the
// workspace re-renders on every reply, so a filter kept inside the render would
// empty itself each time the builder answered.
//
// IT SURVIVES A PROJECT SWITCH, deliberately. `siteCodeOpen` already does — it
// falls back to the first file when the name is not in the new site — and a
// carried-over query is VISIBLE where a carried-over filename is not: the text is
// in the box, the count is under it, and a site with no match says so by name.
// Clearing it on a switch would be a second rule about a state the customer can
// already see and undo.
let siteCodeFind = '';
let siteRail = 'chat';      // left rail: chat | history
let siteRailHidden = false; // collapse the chat rail to give the preview full width
// THE MOBILE APP COLUMN, closed until somebody opens it (owner, 2026-09-08:
// "a column in the right hand side … for mobile app" → "in a sidebar not free
// like that" → "something you open and close, not just something there").
// Module scope, exactly as `siteRailHidden` is and for the same reason: the
// workspace re-renders on every reply, so a state kept inside the render would
// shut the panel each time the builder answered.
let siteMobileOpen = false;
// WHICH PHONE THE PANEL IS DRAWN AS (owner, 2026-09-08: "now a switch there for
// android and apple"). Module scope beside the flag above and for its reason.
//
// `iPhone` and `Android` rather than `iOS` and `Android`: that is the pair a
// small business says out loud, and this panel is read by somebody who sells
// guitar lessons. The owner's word was "apple" — if they want it on the button,
// it is one label.
//
// AND THE SWITCH REALLY CHANGES SOMETHING, which is the whole reason it may
// exist beside a panel that has no app in it: the two phones are not the same
// shape. An iPhone is narrower for its height with rounder corners and a
// Dynamic Island; an Android is a touch wider with a punch-hole camera. The
// stylesheet draws both, and a guard asserts the two differ — a switch whose
// halves look identical is the dead control this repo keeps finding, wearing a
// coat. When the app is real, the same switch picks which build you are seeing.
const MOBILE_OSES = ['ios', 'android'];
// ONE PLACE FOR THE WORDS. They are on the switch AND, once the panel is wide
// enough to show both phones at once, under each frame — two spellings of
// "iPhone" is the recorded two-lists-of-the-same-thing on the smallest possible
// subject, and the one that would go stale is the caption, which only appears
// after somebody has dragged the panel open.
const MOBILE_LABELS = { ios: 'iPhone', android: 'Android' };
let siteMobileOs = 'ios';
// THE PANEL'S WIDTH, DRAGGED (owner, 2026-09-09: "that tab can be dragaable and
// open until the chatbox in the left"). `null` means "no one has dragged it",
// and the stylesheet's own clamp decides — so the default is still the measured
// one and this variable only ever holds a width a person chose. Module scope
// beside the other two, for their reason: the workspace re-renders on every
// builder reply, and a width kept inside the render would snap back each time
// the builder answered.
let siteMobileW = null;
// The floor is the stylesheet's own; the ceiling is measured from the row at
// drag time, because "until the chatbox" is a position on screen and not a
// number. Two phones need about twice one, so the container query that puts
// them side by side is pitched just above a single phone's widest clamp.
const MOBILE_MIN_W = 300;
let siteErr = null;         // { chatId, cost, short } → the "Try to fix" card over the preview

// ── WHAT A FAILED BUILD COST, SAID ONLY WHEN WE KNOW IT ────────────────────
//
// The error card used to end with the LITERAL "you weren't charged", and the
// chat rail's catch-all fell back to the same words. Neither read anything: the
// card had no response in scope at all (`siteErr` carried a chat id and nothing
// else), and the reply has carried `cost` all along. MEASURED on
// `saltmarsh-kayak-co` (2026-09-11): 10 credits taken, "you weren't charged"
// on screen, and no reversal row anywhere.
//
// THREE ANSWERS, NOT TWO, and the third is the point. A cost we did not read —
// a connection lost mid-build, a shape with no `cost` — is CANNOT-TELL, and
// this repo's standing rule is that cannot-tell must never read as a value. So
// it says nothing about money rather than guessing zero, and the balance in the
// top bar (refreshed on every one of these paths) is then the honest answer.
//
// `refundShort` IS THE SERVER'S OWN FLAG for a reversal that did not land, and
// it outranks a zero: `cost: 0` with `refundShort` means we tried to give it
// back and could not, which is the one case where claiming nothing was charged
// would be worst.
function buildCostWords(err) {
  if (!err || err.short) return '';
  const n = err.cost;
  if (typeof n !== 'number' || !isFinite(n) || n < 0) return '';
  if (n === 0) return ' You weren’t charged.';
  return ' You were charged ' + n + (n === 1 ? ' credit' : ' credits') + '.';
}

// The outcome a failed build leaves for the card to read. Built from the
// server's own reply, and answering `cost: null` when there was no reply to
// read — which is what keeps `buildCostWords` silent rather than wrong.
function buildErrOutcome(chatId, d) {
  const n = d && typeof d.cost === 'number' ? d.cost : null;
  return { chatId, cost: n, short: !!(d && d.refundShort) };
}
// Images the owner attached for the next build/revise (logo / reference). Sent to
// the builder, which hosts them + shows them to the generator's vision.
let siteAttach = [];
// Attach button → the device file picker. It used to ask the source first
// (device, or one of the user's own saved image generations) — the gallery half
// went with the media side on 2026-09-12, and a chooser with one option is a
// modal in the way of the only thing it can do.
function siteAttachOpen() {
  if (siteAttach.length >= 3) { if (typeof sbToast === 'function') sbToast('Up to 3 attachments.'); return; }
  siteAttachDevice();
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
// A PUBLISHED SITE REPORTS ITS OWN RUNTIME ERRORS, AND UNTIL 2026-09-12 NOTHING
// LISTENED (owner: "fix"). Every generated site carries
// `src/lib/error-reporting.ts`, which on any throw posts
// `{type:"isibi:runtime-error", report}` to `window.parent` — written for
// exactly this panel, and the panel only ever read `__siteErr`.
//
// THE TWO HALVES WERE BUILT TO MEET AND DID NOT, and which preview you are
// looking at is what decided it. `errShim` — the reporter that DOES reach
// `collectPreviewErr` — is injected by `sitePreviewHtml`, which serves the blob
// DRAFT preview only. A published site is framed at its own URL with no shim,
// so its own module is the only reporter it has, and that is the ordinary case
// now: the throw reached the visitor's console and our `/error` endpoint, and
// the owner watching the preview saw a blank panel and no badge.
//
// THE WIRE STRING STAYS `isibi:runtime-error`. Every site published before today bakes that
// literal into its frozen bundle, so renaming the sender means accepting both
// spellings here for as long as any un-republished site exists — the
// `isibi-ambient` / `isibi-reveal` situation exactly. It is on the
// do-not-rename table in owner-notes now, which is what puts it under guard.
//
// EVERY FIELD IS REFUSED RATHER THAN COERCED, because this arrives by
// postMessage from a frame and `String(["a"])` is `"a"` — the recorded trap,
// and the reason a hostile or a version-skewed payload cannot make a plausible
// sentence out of an array. `collectPreviewErr` does the clipping, the
// de-duplication and the six-per-page bound it already does for the shim.
function previewErrFromReport(report) {
  // THE TWO HALVES OF THIS LINE ARE NOT THE SAME KIND OF CHECK, and a sweep
  // cannot say so. `!report` is load-bearing: without it `null.message` THROWS
  // inside the message listener, which is measured, not assumed. The `typeof`
  // half is INERT against everything postMessage can deliver — 18 shapes driven
  // through both versions differ on none, because the message check below
  // already refuses each one. The single shape that WOULD differ is a function
  // carrying a string `.message`, and `structuredClone` answers `DataCloneError`
  // for a function, so it cannot arrive in `e.data` at all.
  //
  // KEPT ANYWAY, DELIBERATELY, and said here because a sweep reports it as a
  // test gap and the next session deletes what nothing appears to need: this is
  // the one reader in the workspace fed by a frame, and a belt on the shape of
  // an untrusted value costs nothing. What is NOT kept is a mutant for it —
  // `scripts/mutants/preview-errors.json` cuts the load-bearing half instead.
  if (!report || typeof report !== 'object') return null;
  const msg = typeof report.message === 'string' ? report.message.trim() : '';
  if (!msg) return null;
  // WHERE it broke and WHAT caught it, which is what `info` carries for the
  // shim ("promise", "blank"). A boundary-caught throw and an unhandled
  // rejection need different fixes, so the source is worth the eight
  // characters.
  const route = typeof report.route === 'string' ? report.route : '';
  const source = typeof report.source === 'string' ? report.source : '';
  return { msg, info: [route, source].filter(Boolean).join(' · ') };
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
    // AND A COMPONENT IS NOT A ROUTE. `out.files` began carrying the parts on
    // 2026-09-11 so the "wrote the code — N files" count could stop lying, and
    // this list is the OTHER reader of it: the page picker. A part offered here
    // becomes `/-parts/tide-window-chart` in the picker, which is a 404 — the
    // finding `render-check.mjs` already records for exactly this directory,
    // arriving in the customer's own page list instead of a report.
    //
    // The `-` prefix is what makes it not a route (`routeFileIgnorePrefix` in
    // the template's vite config), so testing the segment tests the real rule
    // rather than a name we happen to use today.
    if (/(^|\/)-/.test(rel)) continue;
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
// WHAT THE PREVIEW FRAME MAY DO — decided from the URL it is about to load,
// and failing closed (2026-09-07, owner: "SO ITS PREVIEW THING … SO FIX").
//
// A sandboxed iframe with no `allow-same-origin` has an OPAQUE origin, and a
// PUBLISHED SITE cannot run inside one. Two independent walls refuse every
// script it needs: module scripts are always fetched in CORS mode and the site
// answers no `access-control-allow-origin` for origin `null`, and the site's
// own policy is `script-src 'self'`, which under an opaque origin matches
// nothing. So the panel painted the server-rendered document — header, nav,
// headings, every word — and then stopped: no hydration, no 3D scene, no
// language switcher, no accordion, no form, no calendar. It looked whole,
// which is why it went unreported until an empty 3D box was asked about.
//
// MEASURED on one page framed three ways (scratchpad probe, the live CSP header
// served with the mirror): at top level the canvas is 1096x420 and the scene
// draws; under today's flags it sits at 300x150 — the size a canvas is when no
// code has ever touched it — and the console carries the CORS refusal; with
// `allow-same-origin` added it is 1096x420 and draws again.
//
// `allow-same-origin` lets the framed document keep ITS OWN origin — the
// site's — and never the app's; that is what the flag means, and the common
// misreading of it is the reason this was written the tight way first. The
// combination that is genuinely dangerous is `allow-scripts allow-same-origin`
// on a frame that is ALREADY same-origin with the app, because such a frame can
// reach into the app and take its own sandbox off. THAT CASE IS LIVE HERE: the
// draft preview is served from `gofarther.dev/preview/<uid>/<nonce>`, our own
// origin. So the answer is computed per URL and anything that cannot be PROVEN
// cross-origin keeps exactly the flags of the day before this.
const FRAME_SANDBOX = 'allow-scripts allow-forms allow-popups';
function frameSandbox(url) {
  if (typeof url !== 'string' || !url) return FRAME_SANDBOX; // never coerce: String(["a"]) is "a"
  let origin = '';
  try { origin = new URL(url, location.href).origin; } catch (e) { return FRAME_SANDBOX; }
  // "null" is what an opaque or non-hierarchical URL parses to; it is not proof
  // of a different origin, so it stays on the tight flags with everything else
  // we cannot tell about.
  if (!origin || origin === 'null' || origin === location.origin) return FRAME_SANDBOX;
  return FRAME_SANDBOX + ' allow-same-origin';
}
// THE ONE PLACE THE PREVIEW FRAME IS POINTED ANYWHERE. Two call sites set a
// react site's address (the workspace render and the page picker) and two more
// set the draft preview's, and a sandbox attribute applies AT NAVIGATION — so
// the flags have to be written before the src on every one of them, and one
// function is what stops the four drifting apart.
function loadSiteFrame(fr, url) {
  if (!fr || typeof url !== 'string' || !url) return;
  fr.setAttribute('sandbox', frameSandbox(url));
  fr.src = url;
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
    if (r && r.ok) { const d = await r.json().catch(() => ({})); if (d && d.url) { loadSiteFrame(fr, d.url); return; } }
  } catch (e) {}
  // Fallback only if the round-trip fails (offline / not signed in): a blob URL.
  // Styled but its inline scripts are blocked by the app CSP, so dynamic content
  // won't run — still better than a hard failure.
  if (sitePrevUrl) { try { URL.revokeObjectURL(sitePrevUrl); } catch (e) {} sitePrevUrl = null; }
  sitePrevUrl = URL.createObjectURL(new Blob([withShim], { type: 'text/html' }));
  loadSiteFrame(fr, sitePrevUrl);
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
    // The published site's own reporter — the draft shim's counterpart, into
    // the same collector. See previewErrFromReport for why the string is
    // spelled the way it is.
    if (e.data && e.data.type === 'isibi:runtime-error') { collectPreviewErr(previewErrFromReport(e.data.report)); return; }
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
  // live, and the frame was sandboxed WITHOUT `allow-same-origin`. Corrected
  // rather than deleted, because a false claim in a comment is the thing that
  // gets read and believed the next time somebody changes this line — AND ITS
  // SECOND HALF WENT STALE ON 2026-09-07, which is the same lesson again: the
  // sentence went on "so it is an opaque origin either way and there was no
  // same-origin to preserve", which was true and was also the defect. An opaque
  // origin is precisely what stopped the site's own scripts loading, so the
  // frame is pointed through `loadSiteFrame` now and a cross-origin site keeps
  // its own origin. The draft branch above it does not, and must not.
  else if (f && s.react && s.url) loadSiteFrame(f, s.url + (path !== '/' ? String(path).replace(/^\//, '') : '') + '?v=' + (s.previewV || 1));
  if (typeof paintPreviewErrBadge === 'function') paintPreviewErrBadge();
}
// THE THREE ON EVERY CARD: its data, its live address, its phone view (owner,
// 2026-09-07: "next to each square couple of icons, one for database, one for
// site and one more mobile app"; the set is A/B/A off the variants sheet — the
// cylinder, the globe, the handset).
//
// EACH ONE GOES SOMEWHERE THAT EXISTS, which is the whole reason this function
// takes the site rather than drawing three glyphs: the repo already carries an
// open "dead-control" finding about links that point at where they already are,
// and three decorative icons on 51 cards would be fifty-one times that.
//
//   database → the workspace's Data view, `siteDatabase`'s own jump
//   site     → the live address, in a new tab
//
// THE THIRD IS THE MOBILE APP, AND IT IS THERE AND DISABLED (owner, 2026-09-07:
// "LEAVE IT THERE BUT OFF SINCE WE HAVENT DONE THE MOBILE APP THING YET").
//
// It shipped for one afternoon opening Preview at phone width, which was a
// GUESS at what "mobile app" meant against what the tree already had — the
// platform builds websites and there is no app product in it. It is not a
// phone preview: it is a placeholder for a thing that does not exist yet.
//
// So it is disabled ALWAYS, whatever the site's state, and its tooltip says
// which of the two kinds of off it is. That distinction is the whole reason it
// may sit here greyed while the rule below still holds: a disabled control
// earns its place by SAYING something, and "we have not built this yet" is a
// true sentence where "this works and we would rather you did not" is not.
//
// IT HAS NO HANDLER, deliberately. A disabled button fires no click, and a
// branch for behaviour nobody has designed is a guess written down as code —
// the handler's `act !== 'data'` refuses it on the way past. When the mobile
// app is real, the work is: drop `disabled`, write the tooltip, add the branch.
//
// A SITE WITH NO DATABASE GETS A DISABLED BUTTON THAT SAYS SO, never a live one
// that lands on Preview without explanation: a first build provisions none, so
// this is the ordinary case and not an edge, and the tooltip is the only place
// a customer would ever learn the feature is there to ask for.
// THE DATABASE SITS ABOVE THE PAIR, NOT ON THE CARD (owner, 2026-09-09: "the
// database thing on top of the card but in the middle … the width of the site
// and the mobile app together is 100 … the database has to be 50 … outside the
// square but in the middle on top of each of them").
//
// It is centred over BOTH the site and the phone and is half the pair's width,
// which is arithmetic the stylesheet does — this only draws the control. JUST
// THE ICON, no box and no label: the owner looked at a pill and a labelled bar
// and picked the bare glyph.
//
// ITS TWO STATES COME WITH IT UNCHANGED. A first build provisions no database,
// so "no database yet" is the ORDINARY card, and the control stays visible and
// says what to do about it — hiding it is how a customer never learns the
// feature is there to ask for.
// WHERE THE THREE THINGS SIT ACROSS THE PAIR, as percentages of its width —
// and these are DERIVED from the pair's own columns rather than eyeballed.
// `.st-pair` is `1fr .2888fr` with a 1.05rem (16.8px) column gap, so for a pair
// of width W the site is (W-16.8)/1.2888 wide: its centre is .38796*(W-16.8)
// and the phone's is W - .11204*(W-16.8). As fractions of W those work out at
// 36.9–37.8% and 89.1–89.3% across every width this grid reaches (349 at three
// across, 510 at two, 635 at one), so ONE pair of numbers lands within about
// two pixels of both centres everywhere — a distance nobody can see on a wire.
const SITE_X = 37.4, APP_X = 89.2;
// AND THE DATABASE SITS BETWEEN THEM, NOT AT THE PAIR'S OWN 50% (owner,
// 2026-09-09: "the database thing more to the right so its in the middle, no
// matter if its not 50 in the middle"). The middle of a pair whose two halves
// are 74% and 21% wide is not the middle of the two THINGS, and the wires are
// what make that visible: from 50% the left wire ran 12.6% and the right one
// 39.2%, which reads as lopsided however carefully it is centred. Computed, so
// the two runs are equal by construction and cannot drift apart when either
// landing moves. The 50% WIDTH is untouched — that was the owner's number for
// the hit area, and this moves where that box sits, not how big it is.
const DB_X = +(((SITE_X + APP_X) / 2).toFixed(2));
// TWO WIRES, ONE TO EACH (owner, 2026-09-09: "two wires coming from the
// database, one that goes to the site and one to the app"). Curves were chosen
// over straight lines and over a right-angled bus, from three renders.
// `preserveAspectRatio="none"` is what lets one viewBox stretch to a pair of any
// width, and `vector-effect: non-scaling-stroke` in the stylesheet is what stops
// that stretch from smearing the line: without it the horizontal squash would
// make these wires thicker than the glyph they leave from. Decoration, so
// `aria-hidden` and unfocusable — the button beside them is the control.
// AND A LIVE WIRE IS GREEN (owner, 2026-09-09: "IF THE PROJECT HAS A DATABASE,
// THE WIRE TURNS GREEN TO THE SITE BOX OR THE MOBILE APP ONE, DEPENDING ON
// WHICH ONE IS IT"). Four treatments were rendered — the wire alone, the wire
// and the glyph, the idle wire stepped back, and a node at the landing — and
// the owner picked the first, then the loudest of five greens.
// WHICH WIRE, AND WHY THE APP'S IS ANSWERED AT ALL. A site's Neon database is
// the SITE'S: it is reached through that site's own data API and nothing else
// can hold one, so `site` is the database's state and `app` is false for every
// site on the platform. It is ANSWERED rather than left out of the drawing,
// because the day a mobile app can own a database the second half is a value
// somebody has to remember to forward — and a value computed and never
// forwarded is the trap this repository has shipped a dozen features on. The
// guard pins `app` at false over every shape, so it turns true deliberately.
function wireLive(hasDb) {
  return { site: !!hasDb, app: false };
}
function siteWires(live) {
  const c = (x) => 'M' + DB_X + ' 1 C' + DB_X + ' 21 ' + x + ' 15 ' + x + ' 35';
  const on = (k) => (live && live[k]) ? ' class="live"' : '';
  return '<svg class="st-wires" viewBox="0 0 100 36" preserveAspectRatio="none"' +
    ' aria-hidden="true" focusable="false">' +
    '<path' + on('site') + ' d="' + c(SITE_X) + '"/>' +
    '<path' + on('app') + ' d="' + c(APP_X) + '"/></svg>';
}
function siteDbIcon(s) {
  // ONE EXPRESSION FOR THE CONTROL AND THE WIRE. The button is live when the
  // Data view is reachable, and the wire says the database is wired to the
  // site — the same fact, so they are read from the same `hasDb` rather than
  // each asking its own way. Two tests here would disagree on one card the
  // first time either moved, and the disagreement is drawn: a dark glyph with
  // a green wire under it, or the reverse.
  const hasDb = !!(s.react && s.backend);
  return '<div class="st-dbwrap">' +
    '<button type="button" class="st-db" data-act="data" data-sid="' + esc(s.id) + '"' +
    (hasDb ? '' : ' disabled') +
    ' title="' + (hasDb ? 'Data' : 'No database yet — ask for one in the chat') + '"' +
    ' aria-label="' + (hasDb ? 'Open this site’s data' : 'This site has no database yet') + '">' +
    ic('database', 17) + '</button>' + siteWires(wireLive(hasDb)) + '</div>';
}
function cardActs(s) {
  const id = esc(s.id);
  return '<div class="st-card-acts">' +
    '<button type="button" class="st-card-act" data-act="live" data-sid="' + id + '"' +
      (s.url ? '' : ' disabled') +
      ' title="' + (s.url ? 'Open the live site' : 'Not published yet') + '"' +
      ' aria-label="Open the live site in a new tab">' + ic('globe', 15) + '</button>' +
  '</div>';
}
// THE MOBILE APP, BESIDE THE SITE RATHER THAN INSIDE IT (owner, 2026-09-09:
// "one square with the site , and one wiht the mobile app" → "no i mean the
// square and next to it the phone , not inside" → "leave the square the size it
// is currently , just add the phone thing next to it" → "the phone same height
// as the square").
//
// IT TOOK THE CARD'S PHONE ICON WITH IT. That button was drawn disabled with
// `title="Mobile app — not built yet"`, and a tile beside the card saying the
// same words made it the same sentence twice on one card — three times counting
// its `aria-label`, measured. The tile says it better than a greyed 15px glyph
// can, and dropping the button hands the name back the width it was taking:
// `hartleys-barbers` stops ellipsising to `hartleys-barb…`.
//
// IT TAKES THE CARD'S ID AND THE PHONE — AND THE FIRST OF THOSE IS A RULE THAT
// EXPIRED (owner, 2026-09-09: "MAKE SURE IT ONLY SWITCHED THE ONE I TAPPED ,
// NBOT ALL OF THEM").
//
// This said "IT TAKES NO SITE, DELIBERATELY", on the reasoning that no site has
// a mobile app, so there is nothing per-site to say and a parameter nothing
// reads is a guess written down as code. That reasoning was true and it is
// spent: the switch gave every card something per-site to say — WHICH PHONE THIS
// CARD IS PREVIEWING — so the tile has to know which card it is. The recorded "a
// rule true because of a layer below it expires when that layer moves", inside
// the comment that stated it.
//
// It takes the ID rather than the SITE, and that half of the old rule stands:
// nothing about the site's content — its name, its address, whether it has a
// database — may change what this tile draws, because none of it is about a
// mobile app. Driven with real site shapes that must all draw the same tile.
//
// AND IT TAKES THE PHONE rather than reading module scope, for `siteMobilePanel`'s
// own reason: a free identifier resolves when the line RUNS, so a function that
// reads module scope cannot be evaluated and driven in a bare scope — the trap
// that put four misses on main in one session.
//
// THE TILE IS STILL INERT and still a `div`; the switch is the only control on
// it. A disabled button says "this works and we would rather you did not"; the
// tile says "we have not built this yet", which is a different sentence and the
// true one — so the phone stays a div with no click for the card's own
// `closest('button')` guard to think about, and the segments are real buttons
// because they really do something.
//
// EVERY CARD REMEMBERS ITS OWN PHONE (owner, 2026-09-09: "MAKE SURE IT ONLY
// SWITCHED THE ONE I TAPPED , NBOT ALL OF THEM").
//
// It shipped for one afternoon reading and writing `siteMobileOs`, the workspace
// panel's own variable, so a press on any card moved every phone on the screen.
// That was a real reading of the ask and it was the wrong one; the owner saw it
// and said so. The two are separate now: this is what a customer is comparing on
// the START SCREEN, card by card, and the panel's is which phone that panel is
// showing. Nothing is shared between them but the two phones themselves.
//
// A `Map`, NOT AN OBJECT, and that is the recorded `X["constructor"]` trap: the
// keys here are site ids, `siteCreate` mints them but a server-listed site's id
// is whatever came back over the wire, and `({})["constructor"]` is a function.
// A Map has no prototype to fall through to.
const siteCardOs = new Map();
/** This card's phone, or the one every card opens on. */
function cardOs(id) {
  const v = siteCardOs.get(id);
  return MOBILE_OSES.includes(v) ? v : MOBILE_OSES[0];
}
/**
 * Remember one card's phone. Answers whether anything CHANGED, so the caller can
 * skip a repaint on a second press of the segment already on — `setMobileOs`'s
 * own shape, one screen over.
 */
function setCardOs(id, os) {
  if (!id || !MOBILE_OSES.includes(os) || cardOs(id) === os) return false;
  siteCardOs.set(id, os);
  return true;
}
function siteAppTile(id, os) {
  const on = MOBILE_OSES.includes(os) ? os : MOBILE_OSES[0];
  // THE MARK ALONE, no word, and that is a measurement rather than a taste. The
  // tile is 74.5px wide at three across (measured; 110.5 at two, 138.8 at one),
  // and the workspace panel's own segments — mark plus word — need 248px of
  // content. So the word cannot come, and `aria-label` carries the name instead
  // of a visible one. `MOBILE_LABELS` is still what supplies it, so there is one
  // list of what these two phones are called and this cannot drift from the
  // panel's segments.
  const seg = (v) =>
    '<button type="button" class="st-app-osbtn' + (on === v ? ' on' : '') + '" data-os="' + v + '"' +
      ' title="' + MOBILE_LABELS[v] + '" aria-label="Preview as ' + MOBILE_LABELS[v] + '"' +
      ' aria-pressed="' + (on === v ? 'true' : 'false') + '">' + brandMark(v, 13) + '</button>';
  // THE TILE NAMES ITS CARD, which is what lets the handler repaint THIS one and
  // leave the other fifty alone. `data-app` rather than `data-sid`: `data-sid`
  // means "a control that names a site" and is what the CARD's own handler binds
  // to, and these segments are not card actions — a shared attribute would put
  // them through a handler that opens the Data view.
  // THE PHONE SITS IN A BOX WHOSE SIZE NEVER CHANGES (owner, 2026-09-09: "THE
  // SITE SQUARE THING MOVES , WHEN I TAP TO SWICTH"). The two phones are
  // different SHAPES — 393/852 against 412/915 — so a phone that took the
  // column's width came out 4px taller on Android, and because the pair's second
  // row is `1fr` with stretched items that grew the tile, the card, AND every
  // other card in that grid row. MEASURED before the fix: 3.9px at 1512, 5.8 at
  // 1100, 7.4 at 700, and the neighbouring card moved with it.
  // `.st-app-screen` is the fixed box; the phone is height-led inside it.
  return '<div class="st-app" data-app="' + esc(id) + '">' +
    '<div class="st-app-screen"><div class="st-app-phone" data-os="' + on + '"></div></div>' +
    '<div class="st-app-os" role="group" aria-label="Which phone">' +
      MOBILE_OSES.map(seg).join('') + '</div>' +
    '<span class="st-app-t">Mobile app</span>' +
    '<span class="st-app-s">not built yet</span></div>';
}
function renderSites() {
  const view = document.getElementById('viewSites');
  if (!view) return;
  const open = siteOpenId && siteById(siteOpenId);
  view.classList.toggle('ws-open', !!open);
  // THE OPEN SITE PICKS ITS RUNNING EDIT BACK UP before it is drawn (stage 2b,
  // 2026-09-05): a refresh mid-edit used to lose sight of the job for good.
  // Idempotent — a job already watched is refused inside — so this is safe on
  // the render every reply triggers.
  if (open) { resumeOpenSite(open); renderSiteWorkspace(view, open); return; }
  // AN ID THAT NAMES NOTHING FALLS BACK TO THE LIST, AND THE URL STOPS LYING.
  // A pasted link to a deleted project, or one belonging to another account,
  // lands here. `replaceState` and not a push, and not `openProject` either:
  // this is a correction rather than a navigation, so it must not add an entry
  // Back would have to walk through — and openProject calls this very function,
  // which would recurse.
  if (siteOpenId && PROJECT_PATH.test(location.pathname)) {
    try { history.replaceState({ project: null }, '', '/projects'); } catch (e) {}
  }
  siteOpenId = null;
  // EVERY SITE THIS ACCOUNT OWNS, not only the ones this browser built. The
  // fetch is fire-and-forget and re-renders when it lands, so the first paint
  // is still the local list and nothing waits on the network.
  sitesFetchRemote();
  const sites = SiteList.merge(sitesLoad(), sitesRemote, sitesRemote !== null);
  view.innerHTML =
    '<div class="st-page">' +
      '<div class="st-hero">' +
        '<h1>What are we <span class="st-grad">building</span>?</h1>' +
      '<div class="st-new">' +
        '<textarea id="stPrompt" class="st-in" rows="2" placeholder="Describe the website you want — “a landing page for my sneaker brand, dark, bold type, waitlist form”…"></textarea>' +
        '<div class="st-attach" id="stAttach"></div>' +
        '<div class="st-new-foot">' +
          '<button type="button" class="st-attbtn" id="stAttachBtn" title="Attach a logo, a photo, a PDF menu or price list">' + ic('image', 15) + ' Attach</button>' +
          // WHICH MODEL BUILDS IT, chosen where the build is asked for. The same
          // function the workspace composer draws, opening downward because this
          // row sits under the hero rather than at the foot of a rail. The row is
          // `space-between` and the wrap carries `margin-right: auto`, so the free
          // space lands there and it reads Attach · Builder ————— ↑.
          buildPickerHTML('down') +
          '<button type="button" class="st-gen" id="stGen" aria-label="Build it" title="Build it"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>' +
        '</div>' +
      '</div></div>' +
      (sites.length
        // THE THUMBNAILS KEEP THE TIGHT SANDBOX, DELIBERATELY, and it is worth
        // saying because they carry the same defect as the workspace preview
        // did: no `allow-same-origin`, so the site's own scripts never load and
        // the picture is its server-rendered HTML. That is the RIGHT trade
        // here and the wrong one there. This screen draws one frame per site —
        // 51 on the owner's own account — and letting each run its whole app
        // would start fifty-one React bundles to paint fifty-one postage
        // stamps. The workspace preview is ONE frame the customer is looking
        // at; the difference is the number, not the principle. If a thumbnail
        // ever needs to be true rather than cheap, `loadSiteFrame` is the
        // function to point it at, and the cost has to be measured first.
        // THE GRID CELL IS A PAIR, NOT A CARD: the site, and the mobile app
        // beside it. The card itself is untouched by this — same width (258 at
        // three across, which is what it measured at four), same 16/10
        // thumbnail, same meta row — because the owner's instruction was to
        // leave the square as it is and add the phone next to it. What makes
        // that possible on the existing 1080px page is the pair's own column
        // arithmetic; `.st-pair` in styles.css carries the derivation.
        ? '<div class="st-grid-h">Your sites</div><div class="st-grid">' + sites.map((s) =>
            '<div class="st-pair">' +
              siteDbIcon(s) +
              '<div class="st-card" data-open="' + esc(s.id) + '" role="button" tabindex="0">' +
                '<div class="st-card-prev"><iframe sandbox="' + (s.react && s.url ? 'allow-scripts' : '') + '" loading="lazy" title="' + esc(s.name) + '"></iframe></div>' +
                '<div class="st-card-meta">' +
                  '<div class="st-card-names"><span class="st-card-name">' + esc(s.name) + '</span>' +
                    '<span class="st-card-sub">' + esc(schWhen(new Date(s.updatedAt || s.createdAt).toISOString())) + '</span></div>' +
                  cardActs(s) +
                '</div>' +
                '<button type="button" class="sch-del st-card-del" data-del="' + esc(s.id) + '" title="Delete" aria-label="Delete site">×</button>' +
              '</div>' +
              siteAppTile(s.id, cardOs(s.id)) +
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
  // THE CHIP IS DRAWN BY THE MARKUP ABOVE AND DOES NOTHING UNTIL THIS RUNS — the
  // wiring layer, which has shipped twelve features here looking perfect and
  // doing nothing, and the card icons caught the same shape a fortnight ago by
  // counting call sites. `wireBuildPicker` finds its own elements by id and
  // returns quietly when there are none, so calling it on a screen that has no
  // chip is safe; the ids are never on the page twice because this function
  // returns to `renderSiteWorkspace` before drawing anything when a site is open.
  wireBuildPicker();
  paintAttachStrip();
  // A CARD MAY NAME A SITE THIS BROWSER HAS NO RECORD OF — one the server
  // listed and another machine built. `siteById` searches localStorage alone,
  // so every one of these three (the thumbnail, the click, the delete) would
  // have found nothing and done nothing. They resolve through the MERGED list
  // and adopt on first touch instead.
  const cardEntry = (id) => sites.find((s) => s.id === id) || null;
  const cardOpen = (id) => {
    const rec = siteAdopt(cardEntry(id));
    if (!rec) return;
    openProject(rec.id, 'push');
  };
  // thumbnails: srcdoc set via property (attribute-escaping-proof), inert
  view.querySelectorAll('.st-card').forEach((card) => {
    const s = cardEntry(card.dataset.open);
    const fr = card.querySelector('iframe');
    const home = s && (siteActivePage(s) || sitePages(s)[0]);
    if (fr && s && s.react && s.url) fr.src = s.url; // compiled React thumbnail
    else if (fr && home && home.html) fr.srcdoc = home.html;
    // EVERY BUTTON ON THE CARD, not a list of them. This read `[data-del]` when
    // the delete was the only control here; the action buttons arrived beside it
    // and would each have opened the workspace as well as doing their own job.
    // `closest('button')` is one rule that cannot drift as controls are added or
    // removed — the recorded "two lists of the same thing", avoided rather than
    // extended, and the reason taking the phone icon off needed nothing here.
    card.onclick = (e) => { if (e.target.closest('button')) return; cardOpen(card.dataset.open); };
    card.onkeydown = (e) => { if (e.key === 'Enter') cardOpen(card.dataset.open); };
  });
  // The card's actions. Each ADOPTS first, for the same reason the open and the
  // delete do: a card the server listed and this browser has never seen has no
  // local record, and every one of these needs one to work on.
  // SELECTED BY `data-sid` — "a control that names a site" — rather than by a
  // class. When the database moved off the card on 2026-09-09 it stopped being a
  // `.st-card-act` and a class selector would have left it drawn and dead: the
  // wiring trap, which this screen has already shipped once. `data-sid` is on
  // exactly these controls and is what the handler below reads, so any card
  // control that names a site is wired wherever it sits.
  view.querySelectorAll('[data-sid]').forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const rec = siteAdopt(cardEntry(b.dataset.sid));
    if (!rec) return;
    if (b.dataset.act === 'live') { if (rec.url) window.open(rec.url, '_blank', 'noopener'); return; }
    // ONLY THE ACTS WE DRAW DO ANYTHING. This was an `else`, which was right
    // while `phone` was the only other one and became a way for any unknown
    // `data-act` to open the Data view the moment that button came off.
    //
    // THAT MOMENT ARRIVED ON 2026-09-09, and this line is why it cost nothing:
    // the mobile-app icon came off the card and the mobile app moved beside it
    // as a tile that is not a button at all. Two acts are drawn now — `live` and
    // `data` — and anything else is a click on something we do not draw, whose
    // answer is still nothing. Written for a change that had not happened yet
    // and paid off when it did, which is the argument for keeping it positive.
    if (b.dataset.act !== 'data') return;
    siteView = 'data';
    openProject(rec.id, 'push');
  });
  // THE PHONE SWITCH, AND IT REPAINTS RATHER THAN RE-RENDERS. `renderSites()`
  // rebuilds the grid, and every card in it carries an `<iframe>` showing that
  // site — fifty-one of them on the owner's account — so a switch that
  // re-rendered would reload every thumbnail on the screen to change a corner
  // radius. Moving the attribute and the lit segment by hand is the workspace
  // panel's own answer one screen over, for the same reason.
  //
  // AND IT REPAINTS THE PRESSED TILE ALONE (owner, 2026-09-09: "MAKE SURE IT
  // ONLY SWITCHED THE ONE I TAPPED , NBOT ALL OF THEM"). The first cut moved
  // every phone on the screen, off one shared variable. `closest('.st-app')` is
  // what scopes it — the tile, never the document — so the two `querySelectorAll`
  // calls below are the TILE's and reach nothing outside it.
  //
  // BOUND ON `.st-app-osbtn`, NOT `[data-sid]`: `data-sid` means "a control that
  // names a site" and is what the CARD's handler binds to, whose branches open
  // the live site and the Data view. These segments name their TILE instead.
  view.querySelectorAll('.st-app-osbtn').forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const tile = b.closest('.st-app');
    if (!tile || !setCardOs(tile.dataset.app, b.dataset.os)) return;  // no tile, not a phone, or already on it
    const os = cardOs(tile.dataset.app);
    const phone = tile.querySelector('.st-app-phone');
    if (phone) phone.dataset.os = os;
    tile.querySelectorAll('.st-app-osbtn').forEach((o) => {
      const on = o.dataset.os === os;
      o.classList.toggle('on', on);
      o.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  });
  view.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    const id = b.dataset.del;
    // Adopted first for the same reason: the delete below is a REAL server-side
    // delete keyed on `s.slug`, and a remote card with no local record would
    // have fallen through it silently, leaving the live site running.
    const s = siteAdopt(cardEntry(id));
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
// ── THE ACCOUNT'S OWN SITES, FROM THE SERVER (2026-09-07) ────────────────────
//
// `sitesLoad` is this browser's localStorage and `sitesSave` keeps twenty of
// them. The account this shipped for owns 51, so the start screen could show a
// fraction of them, in one browser, and none on a phone.
//
// `null` means NEVER ANSWERED — which is what `SiteList.merge` reads as "show
// the local list untouched". An empty array is a real answer meaning this
// account owns nothing, and the two must not be spelled the same way.
let sitesRemote = null;
let sitesRemoteAt = 0;
let sitesRemoteBusy = false;
const SITES_REMOTE_TTL = 60_000;
async function sitesFetchRemote(force) {
  if (sitesRemoteBusy) return;
  if (!force && sitesRemote !== null && Date.now() - sitesRemoteAt < SITES_REMOTE_TTL) return;
  // Signed out there is nothing to ask for, and asking would pop the auth gate
  // on a page the visitor has not tried to do anything on yet.
  if (!window.Auth || !(await Auth.accessToken().catch(() => null))) return;
  sitesRemoteBusy = true;
  try {
    const r = await apiFetch('/api/site/list');
    const d = await r.json().catch(() => null);
    // ANY failure leaves `sitesRemote` exactly as it was: a blip must not blank
    // a customer's screen, and a stale list is better than an empty one.
    if (r.ok && d && d.ok && Array.isArray(d.sites)) {
      sitesRemote = d.sites;
      sitesRemoteAt = Date.now();
      renderSites();
    }
  } catch { /* offline: the local list stands */ }
  finally { sitesRemoteBusy = false; }
}
// A CARD THE SERVER NAMED AND THIS BROWSER HAS NEVER SEEN HAS NO LOCAL RECORD,
// and `siteById` only ever searches localStorage — so without this the card
// would open nothing at all. Adopting writes the same fields a finished build
// writes (`slug`, `url`, `react`, an empty thread), so the workspace cannot
// tell the difference between a site built here and one built on another
// machine. Idempotent: a slug already held is returned as it stands.
function siteAdopt(entry) {
  if (!entry || !entry.slug) return entry && entry.id ? siteById(entry.id) : null;
  const all = sitesLoad();
  const have = all.find((s) => s.slug === entry.slug);
  if (have) return have;
  const rec = {
    id: 'site_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name: entry.name || entry.slug,
    slug: entry.slug,
    url: entry.url || '',
    react: true,
    createdAt: entry.createdAt || Date.now(),
    updatedAt: entry.updatedAt || entry.createdAt || Date.now(),
    html: '',
    msgs: [],
  };
  all.unshift(rec);
  sitesSave();
  return rec;
}
function siteCreate(prompt) {
  const id = 'site_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const name = prompt.split(/\s+/).slice(0, 4).join(' ').slice(0, 30) || 'New site';
  sitesLoad().unshift({ id, name, createdAt: Date.now(), updatedAt: Date.now(), html: '', msgs: [] });
  sitesSave();
  // THE ADDRESS EXISTS BEFORE THE SITE DOES, which is the case the id was
  // chosen over the slug for: this fires the moment a brief is typed, minutes
  // before there is a slug to name, and the customer can copy or reload that
  // URL for the whole build.
  openProject(id, 'push');
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
  // A BARE CHEVRON, and it is not `back` at a smaller size. That one carries a
  // shaft (`M19 12H5`) which is right for a 16px button and reads as a
  // strikethrough inside the 18px-wide edge tab, where the shaft would span the
  // whole width. Named for its DIRECTION because direction is the whole of what
  // it means — a tab on the right border pointing left, "the panel comes out
  // this way" — so the day something needs the other one, it is a second entry
  // rather than an argument.
  chevronleft: '<path d="M15 5l-7 7 7 7"/>',
  history: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
  reload: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v5h-5"/>',
  desktop: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/>',
  tablet: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M11 18h2"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.5h13l3.5 6.5v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3.5"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.9 2.6 15.1 0 18"/><path d="M12 3c-2.6 2.9-2.6 15.1 0 18"/>',
  // The site card's three: its data, its live address, its phone view. The
  // globe and the phone were already here — the cylinder is the third, drawn
  // to the same 24×24 / 1.85-stroke rule so the trio reads as one set.
  database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-13"/><path d="M4.5 12c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8"/>',
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
  // THE RIGHT-HAND PANEL TOGGLE — the mirror of the chat rail's own glyph, whose
  // divider sits at x=9. NOT `phone`, deliberately: `phone` is already the
  // phone-WIDTH button (`.st-dev[data-dev="phone"]`) two positions along the
  // same bar, and two phone icons in one row meaning different things is a
  // control nobody can read. What this button does is open a panel on the right,
  // so it draws a panel with a divider on the right.
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  // THE FILE-TYPE GLYPHS (owner, 2026-09-12, holding Lovable's explorer beside
  // ours: "ok do that"). Every row in the code tree drew `code` — one chevron
  // pair for a readme, a lock file and a stylesheet alike — so the tree read as
  // a LIST where theirs reads as a project. These five are what `stFileIcon`
  // resolves to; they are in this table rather than beside it so they inherit
  // the one thing that makes the set coherent, `ic()`'s stroke-only emitter.
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  braces: '<path d="M8.5 3H8a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h.5"/><path d="M15.5 3h.5a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-.5"/>',
  // A DROPLET FOR A STYLESHEET, not a hash. What `src/styles.css` holds here is
  // the theme's colour tokens, so colour is the honest thing to draw.
  paint: '<path d="M12 3.2s6 6.5 6 10.1a6 6 0 0 1-12 0c0-3.6 6-10.1 6-10.1z"/>',
  // SLIDERS RATHER THAN A GEAR, and it was drawn both ways before choosing. A
  // cog needs eight teeth to read as a cog, and at the 13px these rows use the
  // teeth close up into an asterisk — a smudge, not a symbol. Two tracks and two
  // knobs stay legible at any size, and "settings" is what they say.
  sliders: '<path d="M4 8h9"/><path d="M17 8h3"/><path d="M4 16h3"/><path d="M11 16h9"/><circle cx="15" cy="8" r="2.1"/><circle cx="9" cy="16" r="2.1"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  // THE SEARCH BOX'S CLEAR (owner, 2026-09-12: "add the search box too"). Two
  // strokes rather than a circled cross: at the 12px it is drawn the ring closes
  // up against the arms and the whole mark reads as a blob. Named for the SHAPE,
  // not the job — this is the only x in the set and the next thing that needs one
  // will not be a search box.
  x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  // THE ROW MENU'S HANDLE (owner, 2026-09-12: "add the ... menu on each row").
  // Three dots, FILLED — at 14px a stroked circle of r=1.4 is a ring with a hole
  // and the trio reads as dotted-i's. `ic()` stamps `fill="none"` on the <svg>,
  // so each circle carries its own paint.
  more: '<circle cx="5.5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor"/>',
};
function ic(name, size) { size = size || 16; return '<svg class="st-svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ST_ICONS[name] || '') + '</svg>'; }
// THE TWO PLATFORM MARKS (owner, 2026-09-08: "instead of the names, the names
// plus their logo"), and they are their OWN table because they cannot go through
// `ic()`. That emitter stamps `fill="none" stroke="currentColor"` on the <svg>,
// which is the whole of what makes `ST_ICONS` one coherent line set — and it
// would draw the apple as an outline and the robot's head as a horseshoe. These
// are FILLED, so the wrapper carries no paint at all and each path carries its
// own. A second table rather than a flag on the first, because "line icon" and
// "solid mark" are two sets, not one set with an exception.
//
// DRAWN HERE, NOT FETCHED. The paths are our own rendering of the two
// platforms' marks, used to say which phone the panel is drawn as, so there is
// no asset to download at runtime and no file to keep in step with anything.
// Everything is `currentColor`, so a mark takes the segment's own ink and flips
// with it between --muted and --on-accent without a rule of its own.
//
// SIZED FOR 13px BY LOOKING AT IT, WHICH IS THE ONLY SIZE ANYTHING ASKS FOR.
// The robot's first draft was a small dome low in the box with long thin
// antennae; at the 0.54x a 24-unit box renders at 13px its eyes closed up and
// the antennae read as two stray hairs. The dome fills the box now and the
// antennae are shorter, splayed wider and thicker. The apple needed no change —
// it is one solid shape and survives the reduction as it is.
//
// KEYED BY THE PLATFORM'S OWN NAME, so the segment asks for a mark with the
// value it already holds (`MOBILE_OSES`) and there is no second list to drift.
const BRAND_MARKS = {
  // Two subpaths — the leaf and the body — that do not overlap, so no fill rule
  // has anything to decide and none is set. (It carried `evenodd` for an hour;
  // rendering both rules gave identical pixels, so it was an attribute saying
  // nothing.)
  ios: '<path fill="currentColor" d="M15.72 3.06c.62-.76 1.04-1.8.93-2.86-.9.04-1.98.6-2.62 1.35-.58.67-1.09 1.74-.95 2.76 1 .08 2.02-.51 2.64-1.25zM19.4 12.66c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.61 2.25 2.75 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.67-2.15.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.34-3.54z"/>',
  // The dome and both eyes are ONE path, so the eyes are holes knocked through
  // the head rather than two paper-coloured discs laid on it — the difference
  // between a mark that works on any ground and one that only works on the
  // ground it was drawn against. TWO THINGS MAKE THEM HOLES AND ONLY ONE IS
  // LOAD-BEARING: each eye's arcs carry sweep 0 where the dome carries sweep 1,
  // so they wind the opposite way and cancel — which is why `evenodd` here is
  // INERT, measured by rendering both rules to identical pixels. It stays as the
  // second wall (a later edit that changes a winding still gets holes) and is
  // said out loud rather than pretended to be covered by a guard; what the guard
  // holds is the winding, which is the half that actually decides.
  // The antennae are stroked, so they keep one weight instead of having to be
  // drawn as tapered outlines.
  android: '<path fill="currentColor" fill-rule="evenodd" d="M2 20.5a10 10 0 0 1 20 0ZM6.95 15.6a1.45 1.45 0 1 0 2.9 0 1.45 1.45 0 1 0-2.9 0ZM14.15 15.6a1.45 1.45 0 1 0 2.9 0 1.45 1.45 0 1 0-2.9 0Z"/>'
    + '<path fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" d="M6 5.2 9 10.9M18 5.2 15 10.9"/>',
};
// `Object.hasOwn`, never truthiness: `BRAND_MARKS["constructor"]` is a function,
// and a name that is not a mark must draw nothing rather than a stringified one.
function brandMark(name, size) {
  size = size || 13;
  return '<svg class="st-svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true">'
    + (Object.hasOwn(BRAND_MARKS, name) ? BRAND_MARKS[name] : '') + '</svg>';
}
// `siteFileName` WENT WITH ITS TWO CALLERS (2026-09-08). It turned a static
// site's route into `menu.html`, and both places that asked — the Code tab's
// file tree and its per-file Download — now read the React source, whose files
// are named by `stSrcPath` from what the container really writes. The recorded
// "when you delete a consumer, grep for what fed it": nothing else called it.
// WHERE A SOURCE FILE LIVES IN THE SITE, and there is ONE of these.
//
// A page is stored as `{path, source}` with `path` already a file name
// (`index.tsx`, `prices.tsx`); a component written for this site is stored as
// `{name, source}` with a kebab-case name. The container writes the first under
// `src/routes/` and the second under `src/routes/-parts/<name>.tsx`, and this is
// the browser's copy of those two rules — so `test/site-source.test.mjs` DERIVES
// the expectation from `build-server.mjs`'s own `safeRoute` and `safePart` and
// fails if the two ever disagree. The names are what the customer sees in the
// tree AND what they get inside the zip, so a drift here would hand somebody an
// archive whose layout is not their site's.
function stSrcPath(f) {
  if (!f || typeof f !== 'object') return '';
  // A PART IS NAMED EXACTLY AS `safePart` NAMES IT — trimmed, lowercased, and
  // REFUSED when it is not a kebab name. Both halves matter and both were wrong.
  //
  // Without the normalising, a component stored as `Foo` showed in the tree as
  // `-parts/Foo.tsx` while the container had written `-parts/foo.tsx`: a name in
  // the explorer that no file on the site answers to.
  //
  // Without the refusal, a name the container REFUSES still drew a row here —
  // and `SiteZip.safeName` refuses it too, so the file appeared in the tree and
  // was silently absent from the download, with no sentence anywhere. One rule
  // now, the container's; anything it will not name is reported by the caller as
  // unplaced rather than shown as a file that exists.
  if (typeof f.name === 'string') {
    const n = f.name.trim().toLowerCase();
    return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(n) ? 'src/routes/-parts/' + n + '.tsx' : '';
  }
  const p = typeof f.path === 'string' ? f.path.replace(/^(?:src\/)?routes\//, '') : '';
  return p ? 'src/routes/' + p : '';
}
// THE TREE, GROUPED BY WHOSE FILE IT IS.
//
// FOUR HEADINGS, NOT ONE FLAT LIST (owner, 2026-09-11, on Lovable's explorer
// beside ours: *"their stuff is files organized ours is all on one file"*).
// The customer's own pages and components come first, then what the build made
// for this site, then the scaffold every site shares — and the last group is
// SEPARATED rather than flagged, because "this is yours" and "this is the
// platform's" is the distinction a reader most needs and a flag on a row is the
// one a reader skims past.
//
// EACH GROUP IS DRAWN ONLY WHEN IT HAS FILES, so a site with no drawn mark and
// no stylesheet shows no empty "Made by the build" heading — a heading over
// nothing reads as something missing rather than something absent.
//
// THE DISPLAY NAME DROPS `src/routes/` ONLY IN THE CUSTOMER'S OWN GROUPS, which
// is where every file shares that prefix and it is noise repeated down the list.
// Everything else keeps its real path — `public/icon.svg` and `src/lib/rows.ts`
// are only meaningful with it, and the SHARED group holds `src/routes/__root.tsx`,
// which stripped reads as a file sitting beside the customer's pages instead of
// the platform's own root route.
const ST_CODE_GROUPS = [
  ['page', 'Pages'],
  ['part', 'Components'],
  ['asset', 'Made by the build'],
  // THE KIT PARTS THIS SITE IMPORTS, as their own heading between the site's own
  // files and the platform's. They are neither: a page the model wrote is the
  // customer's, `src/router.tsx` is ours on every site, and these are ours but
  // only on the sites that reach for them — which is why they are stored per
  // slug and why the count differs between two sites. Folded into "Shared with
  // every site" the heading would be a lie about half its rows.
  ['kit', 'Design system'],
  ['shared', 'Shared with every site'],
];
/**
 * One group's files as the DIRECTORY TREE they really are (owner, 2026-09-11,
 * drawing `1. / 1.a. / 2.`: *"Why"*).
 *
 * The groups say what a file IS to the customer; they never said where it lives,
 * and the flat list underneath printed the path as text — `-parts/` repeated on
 * nine rows, `public/` on four. Worse, the display rule stripped `src/routes/`
 * in the customer's own groups and kept it everywhere else, so the tree showed
 * HALF a hierarchy: a path fragment where a folder should be. This is the other
 * half, and it deletes that special case rather than adding to it — a file row
 * carries its own name now, because the folders above it carry the rest.
 */
function stDirTree(files) {
  const root = { dirs: new Map(), files: [] };
  for (const f of files) {
    const segs = String((f && f.name) || '').split('/');
    const base = segs.pop();
    let at = root;
    for (const seg of segs) {
      if (!at.dirs.has(seg)) at.dirs.set(seg, { dirs: new Map(), files: [] });
      at = at.dirs.get(seg);
    }
    at.files.push({ ...f, base });
  }
  stSortTree(root);
  return root;
}
// A–Z, WHICH IS WHAT AN EXPLORER DOES (owner, 2026-09-12: "ok do that", holding
// Lovable's tree beside ours). Until this the tree came out in INSERTION order —
// whatever order the file list happened to arrive in — so the project root read
// in the hand-chosen order `builder/gen-foundation.mjs` lists its paths, and a
// customer looking for `tsconfig.json` had to read every row to find it.
//
// IT OVERRIDES A WRITTEN DECISION, said out loud rather than left to be found:
// `FOUNDATION_PATHS`'s own comment says "Never alphabetical — `components.json`
// is not where anybody starts reading a project", and that reasoning is sound
// about READING a project start to finish. It is the wrong order for FINDING one
// file among twenty-five, which is what this panel is for. The list keeps its
// order (it is also the download's), and the corrected comment there says the
// tree no longer inherits it.
//
// LOWERCASE CODE POINTS, NOT `localeCompare`. A locale comparison commonly
// ignores leading punctuation, which would scatter `.gitignore`, `.prettierrc`
// and `.prettierignore` in among the letters; `.` is 0x2E and sorts before every
// letter, which puts the dotfiles together at the top exactly as they sit in
// every editor. Ties fall back to the raw name so the order is total.
function stSortTree(node) {
  const by = (a, b) => {
    const x = String(a).toLowerCase(), y = String(b).toLowerCase();
    if (x !== y) return x < y ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
  };
  node.files.sort((a, b) => by(a.base, b.base));
  // A Map keeps insertion order, so re-inserting in sorted order IS the sort.
  const dirs = [...node.dirs].sort((a, b) => by(a[0], b[0]));
  node.dirs = new Map(dirs);
  for (const [, child] of dirs) stSortTree(child);
}
/**
 * A CHAIN OF ONE-CHILD DIRECTORIES IS ONE ROW — `src/routes/-parts`, never
 * `src` then `routes` then `-parts`, which is three clicks and two rows of
 * nothing to reach nine files. What VS Code calls compact folders, and the
 * reason it exists here is that our own paths are deep and narrow: every page
 * and every component lives under `src/routes/`, so without this the Pages group
 * is a ladder holding one file at the bottom.
 *
 * ONE COLLAPSE RULE, ASKED IN BOTH PLACES. The renderer walks the tree and the
 * default-open chain walks it again to name the folders holding the open file;
 * two copies of "where does this chain stop" would drift, and the failure is a
 * folder the tree draws under a key the toggle cannot match — a row that does
 * nothing when clicked.
 */
function stCollapse(name, node) {
  let label = name, at = node;
  while (at.dirs.size === 1 && !at.files.length) {
    const one = [...at.dirs][0];
    label += '/' + one[0];
    at = one[1];
  }
  return { label, node: at };
}
/** How many files are under a node, at any depth — what a folded folder says. */
function stDirCount(node) {
  let n = node.files.length;
  for (const child of node.dirs.values()) n += stDirCount(child);
  return n;
}
/**
 * Which nodes the tree draws OPEN — the four groups and every folder inside them
 * (owner, 2026-09-11: *"components you click and the 8 or 0 or whatever how many
 * they appear"*, then the nesting).
 *
 * THE THIRD STATE IS THE WHOLE OF THE FIRST DRAW. `chosen` is what the customer
 * has folded and unfolded; `null` means they have touched nothing yet, which is
 * NOT an empty Set. Uninitialised opens exactly the CHAIN holding the file on
 * screen — its group and every folder down to it — and leaves everything else
 * folded, which is what a file explorer does when you open a file by path. An
 * empty Set is a customer who has closed every folder, and re-deriving the
 * default for them would re-open one on the next click, for ever. The recorded
 * "cannot-tell must never read as a value", pointed at a preference.
 *
 * THE DEFAULT IS DERIVED FROM THE OPEN FILE rather than naming `page`, because
 * the first draw is not the only draw that can find `chosen` null — a rebuild
 * replaces the file list while the customer's chosen file may be a component —
 * and a hardcoded `page` would fold the folder holding the file being shown.
 */
function stOpenGroups(files, openName, chosen) {
  if (chosen instanceof Set) return chosen;
  const list = Array.isArray(files) ? files : [];
  const holds = list.find((f) => f && f.name === openName);
  const kind = (holds && holds.kind) || ST_CODE_GROUPS[0][0];
  const keys = new Set([kind]);
  if (!holds) return keys;
  // THE CHAIN, walked through the SAME collapse rule the renderer uses, so every
  // key here is a key the tree really draws.
  let at = stDirTree(list.filter((f) => f.kind === kind));
  let prefix = '';
  const segs = String(holds.name).split('/');
  segs.pop();
  let i = 0;
  while (i < segs.length && at.dirs.has(segs[i])) {
    const step = stCollapse(segs[i], at.dirs.get(segs[i]));
    const path = prefix + step.label;
    keys.add(kind + '/' + path);
    i += step.label.split('/').length;
    prefix = path + '/';
    at = step.node;
  }
  return keys;
}
/** A row that folds: a group heading, or a folder inside one. */
function stFoldRow(key, label, count, shown, depth, cls) {
  // ONE CHEVRON, TURNED. `chevronleft` points left when the folder is shut — the
  // universal collapsed state — and the open rule rotates it to point down. A
  // second icon entry would be a second glyph to keep in step with the first for
  // no gain; the disclosure triangle IS one mark that turns.
  //
  // AND THE COUNT IS WHAT MAKES A FOLDED FOLDER HONEST rather than a hidden one.
  // "Made by the build 4" says there are four things in there; a bare heading
  // over nothing says a group exists and nothing about whether it is empty.
  return '<button type="button" class="' + cls + (shown ? ' on' : '') +
    '" data-srcfold="' + esc(key) + '" aria-expanded="' + (shown ? 'true' : 'false') + '"' +
    (depth ? ' style="--d:' + depth + '"' : '') + '>' +
    '<span class="st-code-caret">' + ic('chevronleft', 12) + '</span>' +
    '<span class="st-code-hn">' + esc(label) + '</span>' +
    '<span class="st-code-count">' + count + '</span></button>';
}
/** The rows under one node: its folders first, then its own files. */
// WHICH ICON A FILE GETS, FROM ITS OWN NAME (owner, 2026-09-12: "ok do that").
// Every row drew `code` before this, so a readme, a lock file and a stylesheet
// were the same chevron pair and the tree read as a list of strings rather than
// a project.
//
// THE ORDER OF THE RULES IS THE WHOLE OF IT, most specific first:
//
//   1. A LOCK FILE BY NAME, not by extension. `package-lock.json` is JSON and
//      braces would be true and useless — what a reader wants to know is that
//      this is the pinned one, and it is the file they will never open. Named
//      rather than extension-matched because the lock is `.json` here and
//      `.lock` elsewhere.
//   2. By extension, when there IS one — a dot that is not the first character.
//      `.gitignore`'s only dot is at index 0, so it has no extension, which is
//      what sends it to the rule below instead of matching a phantom one.
//   3. A DOTFILE WITH NO EXTENSION IS CONFIGURATION. `.prettierrc`,
//      `.prettierignore`, `.gitignore` — every one of them is a setting, and
//      sliders say that where a page glyph would not.
//   4. Everything else is `code`, which is what every row used to get. A type
//      nobody has taught this function reads as source rather than as nothing,
//      because a blank icon column is worse than a slightly wrong one.
function stFileIcon(name) {
  const base = String(name || '').split('/').pop();
  if (/(^|[.-])lock\.[a-z]+$/i.test(base) || /\.lock$/i.test(base)) return 'lock';
  const dot = base.lastIndexOf('.');
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
  if (ext === 'md' || ext === 'txt' || ext === 'mdx') return 'doc';
  if (ext === 'json' || ext === 'jsonc') return 'braces';
  if (ext === 'css' || ext === 'scss') return 'paint';
  if (/^(svg|png|jpe?g|webp|gif|ico|avif)$/.test(ext)) return 'image';
  if (!ext && base.startsWith('.')) return 'sliders';
  return 'code';
}
// THE SEARCH BOX'S FILTER (owner, 2026-09-12: "add the search box too", holding
// Lovable's "Search code" beside ours).
//
// IT SEARCHES THE CODE AND NOT ONLY THE NAMES, and that is the whole reason the
// box can carry that label honestly. Every file's text is ALREADY in the browser
// — `stSrcFiles` hands the tab the whole project and the download zips the same
// list — so matching contents costs no request and no server work, and a box
// named "Search code" that only filtered filenames would be this app's dead
// control wearing a new coat: a promise the thing behind it cannot keep.
//
// AND A ROW SAYS WHY IT IS THERE. A match inside a file carries the number of
// times the words appear, which is what answers "why is README.md in my results
// for booking" without opening it. A name-only match carries no number, so the
// absence is the answer: it matched the path you can read on the row.
//
// COUNTING STOPS AT `ST_FIND_MAX`, both for the column and for the work. A
// one-letter query against `package-lock.json` (310,981 bytes) has tens of
// thousands of hits, which is an unreadable number in a 210px column and an
// unbounded loop on every keystroke. The ceiling is a DISPLAY decision that
// cannot change the answer — one hit is enough to be in the list, and the
// counting only ever stops ABOVE the ceiling.
//
// CASE-INSENSITIVE, because a customer typing `Button` and missing
// `<button>` would read as the search being broken. Never a regular expression:
// a query is a person's words, and `(` or `*` typed into a box that compiles
// them is either a throw or a silently different search.
const ST_FIND_MAX = 99;
function stCodeFind(files, q) {
  const list = Array.isArray(files) ? files : [];
  // A NON-STRING IS NOT A QUERY. `String(['a'])` is `'a'`, so a coerced array
  // would filter the whole tree down to whatever its one element spells — this
  // repository's own recorded coercion, three shipped bugs deep.
  const needle = (typeof q === 'string' ? q : '').trim().toLowerCase();
  if (!needle) return { on: false, files: list, shown: list.length, total: list.length };
  const out = [];
  for (const f of list) {
    const named = String((f && f.name) || '').toLowerCase().includes(needle);
    const text = (f && typeof f.text === 'string') ? f.text : '';
    const hay = text.toLowerCase();
    let hits = 0;
    for (let i = hay.indexOf(needle); i !== -1 && hits <= ST_FIND_MAX; i = hay.indexOf(needle, i + needle.length)) hits += 1;
    if (named || hits) out.push({ ...f, hits });
  }
  return { on: true, files: out, shown: out.length, total: list.length };
}
function stCodeRows(node, keyBase, prefix, depth, open, openName) {
  let out = '';
  // FOLDERS ABOVE FILES, which is what every explorer does and what keeps a long
  // file list from burying the one folder under it.
  for (const entry of node.dirs) {
    const step = stCollapse(entry[0], entry[1]);
    const path = prefix + step.label;
    const key = keyBase + '/' + path;
    const shown = open.has(key);
    out += stFoldRow(key, step.label, stDirCount(step.node), shown, depth, 'st-code-d');
    if (shown) out += stCodeRows(step.node, keyBase, path + '/', depth + 1, open, openName);
  }
  for (const f of node.files) {
    // THE ROW IS A WRAPPER AROUND TWO BUTTONS, and the wrapper is not decoration:
    // a `<button>` inside a `<button>` is invalid HTML, and browsers recover from
    // it by hoisting the inner one OUT — so the menu handle nested in the file
    // row would land beside it as a sibling of the row instead, taking its own
    // line and firing the wrong handler. Two siblings under one hover target is
    // the only shape that works.
    //
    // `--d` STAYS ON THE FILE BUTTON, not the wrapper: `.st-code-d, .st-file`
    // carries the depth padding, and moving the variable up would indent the
    // menu handle along with the name and push it off a deep row.
    out += '<div class="st-file-row">';
    // THE ROW CARRIES ITS OWN NAME AND THE FULL PATH. The name is what the reader
    // sees, since the folders above it carry the rest; `data-srcname` is the full
    // one, because that is what the click handler looks a file up by and two
    // files can share a basename across folders.
    out += '<button type="button" class="st-file' + (f.name === openName ? ' on' : '') +
      (f.unplaced ? ' st-file-lost' : '') + '" data-srcname="' + esc(f.name) + '"' +
      (depth ? ' style="--d:' + depth + '"' : '') + '>' +
      '<span class="st-file-ic">' + ic(stFileIcon(f.base), 13) + '</span>' +
      '<span class="st-file-n">' + esc(f.base) + '</span>' +
      // HOW MANY TIMES THE SEARCH FOUND IT IN THERE — drawn only when a search
      // found it in the CONTENTS, so a row with no number matched the path the
      // reader can already see on it. `ST_FIND_MAX + '+'` rather than a second
      // literal, so raising the ceiling cannot leave the label saying the old one.
      (f.hits ? '<span class="st-file-hits">' + (f.hits > ST_FIND_MAX ? ST_FIND_MAX + '+' : f.hits) + '</span>' : '') +
      '</button>';
    // THE HANDLE IS ON FILES AND NOT ON FOLDERS, deliberately. Every action it
    // offers is about one file's bytes — its path, its contents, its download —
    // and a folder has none of those, so a handle there would open a menu with
    // nothing in it that works. That is this app's own dead-control finding, and
    // a menu is the easiest place in the world to hide one.
    //
    // NAMED FOR THE FILE, because a row of identical "More" buttons down a tree
    // is unreadable to anything that cannot see the screen.
    out += '<button type="button" class="st-file-more" data-srcmore="' + esc(f.name) + '"' +
      ' aria-haspopup="menu" aria-expanded="false" title="More for ' + esc(f.base) + '"' +
      ' aria-label="More for ' + esc(f.base) + '">' + ic('more', 14) + '</button>';
    out += '</div>';
  }
  return out;
}
// EVERY FOLDER, WITHOUT NAMING ONE. A search has to draw its matches OPEN or the
// tree answers a query with four shut headings — the one shape that reads as
// "nothing found" while holding the answer. A Set would have to be built by
// walking the filtered tree, which is a second copy of the renderer's own
// collapse rule and the exact drift `stCollapse` exists to stop; a thing that
// says yes to every key is the same answer with nothing to keep in step.
//
// AND IT IS NEVER STORED. `siteCodeOpenGroups` keeps the customer's own folds
// untouched while a query is up, so clearing the box puts the tree back exactly
// as they left it.
const ST_ALL_OPEN = { has: () => true };
function stCodeTree(files, openName, chosen, all) {
  const list = Array.isArray(files) ? files : [];
  const open = all ? ST_ALL_OPEN : stOpenGroups(list, openName, chosen);
  let out = '';
  for (const g of ST_CODE_GROUPS) {
    const mine = list.filter((f) => f.kind === g[0]);
    if (!mine.length) continue;
    const shown = open.has(g[0]);
    out += stFoldRow(g[0], g[1], mine.length, shown, 0, 'st-code-h');
    if (shown) out += stCodeRows(stDirTree(mine), g[0], '', 1, open, openName);
  }
  return out;
}
/**
 * The search box itself, above the tree.
 *
 * THE FIELD IS DRAWN ONCE AND NEVER RE-RENDERED WHILE IT IS BEING TYPED IN —
 * `drawSiteCode` replaces the whole panel's HTML, which destroys the input, takes
 * the focus with it and loses the caret, so a customer would type one character
 * and be thrown out of the box. Everything the query changes lives in three
 * places OUTSIDE this field (the rows, the count line, and a class here for the
 * clear button), and the keystroke handler rewrites exactly those.
 *
 * THE CLEAR BUTTON IS ALWAYS IN THE MARKUP AND HIDDEN BY A CLASS, for the same
 * reason: drawing it in and out on each keystroke would mean rebuilding this
 * element, which is the thing the paragraph above exists to avoid.
 */
function stFindBox(q) {
  return '<div class="st-code-find' + (q ? ' on' : '') + '">' +
    '<span class="st-find-ic">' + ic('search', 13) + '</span>' +
    '<input type="text" id="stCodeFind" class="st-find-in" value="' + esc(q || '') +
      '" placeholder="Search files and code" aria-label="Search files and code"' +
      ' autocomplete="off" autocorrect="off" spellcheck="false">' +
    '<button type="button" id="stCodeFindX" class="st-find-x" title="Clear the search" aria-label="Clear the search">' +
      ic('x', 12) + '</button>' +
  '</div>' +
  '<div class="st-find-said" id="stCodeFindSaid" aria-live="polite"></div>';
}
// WHAT THE FILTER DID, IN WORDS, and it is not decoration: a filtered tree that
// looks exactly like an unfiltered one is a lying instrument — a customer who
// forgets the box has something in it reads missing files as missing files. The
// count says the tree is showing a part of the project and how big a part.
//
// EMPTY WHEN NOTHING IS FILTERED, so the line is the SIGN that a filter is on
// rather than a permanent label reading "25 of 25 files".
function stFindSaid(found) {
  if (!found || !found.on) return '';
  return found.shown + ' of ' + found.total + (found.total === 1 ? ' file' : ' files');
}
// WHAT THE ROW MENU OFFERS (owner, 2026-09-12: "add the ... menu on each row").
//
// THREE THINGS, AND THE LIST IS SHORT BECAUSE THE PANEL DOES NOT WRITE. Rename,
// delete and new-file are what a menu like this holds in an editor; here they
// would each be a control that promises something the Code tab cannot do — the
// customer changes their site by asking in the chat. Every entry acts on ONE
// file's bytes, which is also why folders have no handle.
//
// `Download` REPEATS THE BAR'S BUTTON ON PURPOSE and is not a duplicate control:
// the bar downloads the file that is OPEN, and this downloads the row you are
// pointing at, without opening it first.
const ST_ROW_ACTS = [
  ['path', 'Copy path', 'code'],
  ['text', 'Copy contents', 'doc'],
  ['file', 'Download', 'download'],
];
// ONE MENU FOR THE WHOLE TREE, moved to whichever row asked for it. Twenty-eight
// rows would otherwise carry twenty-eight hidden menus, and only one can ever be
// open — the extra twenty-seven are markup nobody reads and a second place for
// the open state to live.
function stRowMenuHtml() {
  return '<div class="st-row-menu" id="stRowMenu" role="menu" aria-label="File actions">' +
    ST_ROW_ACTS.map((a) => '<button type="button" class="st-row-item" role="menuitem" data-act="' + a[0] + '">' +
      '<span class="st-row-ic">' + ic(a[2], 13) + '</span>' + esc(a[1]) + '</button>').join('') +
  '</div>';
}
/**
 * What one entry DOES, and the answer is the sentence to toast.
 *
 * THE DEPS ARE HANDED IN so this is drivable without a clipboard or a disk —
 * `navigator.clipboard` rejects in a headless context and `stSaveBlob` reaches
 * for `document`, so a decision written inline would be a decision no test can
 * ask. The route the value takes (which field of the file each entry reads) is
 * the part worth guarding, and it is all here.
 *
 * A FILE IT CANNOT FIND ANSWERS NOTHING rather than copying the empty string: a
 * toast saying "copied" over an empty clipboard is this app's own "doing less
 * than was asked while saying it was done".
 */
function stRowMenuAct(act, file, deps) {
  const d = deps || {};
  if (!file || !file.name) return '';
  const base = String(file.name).split('/').pop();
  if (act === 'path') { if (d.copy) d.copy(file.name); return 'Path copied — ' + file.name; }
  if (act === 'text') {
    // THE WHOLE FILE, never the clipped `<pre>`. The pane shows the first
    // 120,000 characters so a megabyte cannot lock the tab; a copy that quietly
    // lost the end of a page would be the lying instrument the clip exists to
    // avoid, one control over.
    const text = typeof file.text === 'string' ? file.text : '';
    if (!text) return 'Nothing to copy — ' + base + ' is empty.';
    if (d.copy) d.copy(text);
    return 'Copied ' + base + ' — ' + text.split('\n').length + ' lines';
  }
  if (act === 'file') { if (d.save) d.save(String(file.text == null ? '' : file.text), base); return ''; }
  return '';
}
// NOTHING MATCHED IS A SENTENCE NAMING THE QUERY, never an empty column. An empty
// tree is indistinguishable from a project whose files are gone, and this panel
// has already shipped one empty state that said nothing about which empty it was.
//
// IT RETURNS TEXT AND THE CALLER ESCAPES IT, which is the split the pair above
// forces: `stFindSaid` goes into `textContent` and must NOT be escaped or the
// customer reads `&amp;`, and this goes into `innerHTML` and must be. Escaping
// here would double-escape at the one call site that exists.
function stFindNone(q) {
  return 'No file matches “' + String(q || '').trim() + '”.';
}
// EVERY FILE OF THE PROJECT, in ONE list the tree, the download and the counter
// all read. Two lists would let the tree show a file the download leaves out —
// which it did, silently, until 2026-09-11.
//
// FOUR GROUPS, IN READING ORDER: the pages, the components written for this
// site, the files the build made (the favicon, the wordmark, the codes, the
// stylesheet), and last the shared scaffold every site is built from. `shared`
// is marked rather than mixed in, so the tree can say which files are the
// customer's own and which are the platform's.
//
// A FILE THAT CANNOT BE NAMED IS REPORTED, NEVER DROPPED. It used to vanish:
// `if (name) out.push(...)` and nothing else, so a page with a malformed path
// left the tree, left the zip and left the count, with no sentence anywhere —
// and if it was the only page, the panel said "Nothing stored for this site
// yet" about a store that had something in it. The entry is kept with the name
// we could not resolve so the customer sees that something is there and that we
// could not place it.
function stSrcFiles(src) {
  const out = [];
  let lost = 0;
  const add = (list, kind, key) => {
    for (const p of (src && Array.isArray(src[key])) ? src[key] : []) {
      if (!p || typeof p.source !== 'string') continue;
      const name = stSrcPath(p);
      if (name) { out.push({ name, text: p.source, kind: kind, note: typeof p.note === 'string' ? p.note : '' }); continue; }
      // A REAL, UNIQUE, DOWNLOADABLE NAME — never a label. `(unnamed file)` would
      // read fine in the tree and then be the entry name inside the archive, and
      // two of them would collide there. `unplaced/<n>.txt` is a path the zip
      // admits and a folder a customer can open, which is what keeps the tree,
      // the download and the count showing the same set.
      lost += 1;
      out.push({
        name: 'unplaced/' + lost + '.txt', text: p.source, kind: kind, unplaced: true,
        note: 'This file is stored under a name the project cannot use, so it is shown here but is not part of the built site.',
      });
    }
  };
  add(src, 'page', 'pages');
  add(src, 'part', 'parts');
  // THE ASSETS AND THE FOUNDATION CARRY REAL PATHS ALREADY — `public/icon.svg`,
  // `src/router.tsx` — so they go in as they are rather than through
  // `stSrcPath`, which exists to compose a path for the two stores that carry
  // none. Sending them through it would prefix `src/routes/` onto a file that
  // is nowhere near it.
  for (const a of (src && Array.isArray(src.assets)) ? src.assets : []) {
    if (!a || typeof a.path !== 'string' || !a.path || typeof a.source !== 'string') continue;
    out.push({ name: a.path, text: a.source, kind: 'asset', note: typeof a.note === 'string' ? a.note : '' });
  }
  // THE SITE'S OWN FILE WINS A PATH THE SHARED SET ALSO CLAIMS, and today there
  // is exactly one: `src/styles.css`. The shared copy is the template's base and
  // the site's is the layer written over it, so both are real — but they are one
  // PATH, and a tree showing it twice under two headings with different contents
  // is a project nobody has. It also breaks the set: the download collapses two
  // entries of one name, so the tree would list a file the archive does not
  // hold, which is the disagreement this whole change exists to end.
  const claimed = new Set(out.map((f) => f.name));
  for (const f of (src && Array.isArray(src.shared)) ? src.shared : []) {
    if (!f || typeof f.path !== 'string' || !f.path || typeof f.source !== 'string') continue;
    if (claimed.has(f.path)) continue;
    out.push({ name: f.path, text: f.source, kind: 'shared', note: '' });
    claimed.add(f.path);
  }
  // THE COMPONENTS THIS SITE'S PAGES IMPORT (owner, 2026-09-12, holding
  // Lovable's tree beside ours: *"look at all of this, we dont have all of
  // it"*). The kit is 3,394 files and 17 MB and is NOT this: what a site has is
  // the closure of what it imports, measured over 100 real generated sites at
  // 9 to 53 files. The container resolves it at publish time and the route
  // hands it back per slug.
  //
  // WITHOUT THEM THE DOWNLOAD WAS NOT A PROJECT. `src/routes/__root.tsx` is in
  // the shared set above and imports `@/components/ui/sonner`; the zip carried
  // the importer and not the module, so `npm run build` on it could not resolve
  // its own first import.
  //
  // THEY GO IN LAST AND THROUGH `claimed`, so a site that somehow carries its
  // own copy of a kit path keeps the site's — the `src/styles.css` rule above,
  // applied to the one list that is resolved rather than authored.
  for (const f of (src && Array.isArray(src.kit)) ? src.kit : []) {
    if (!f || typeof f.path !== 'string' || !f.path || typeof f.source !== 'string') continue;
    if (claimed.has(f.path)) continue;
    out.push({ name: f.path, text: f.source, kind: 'kit', note: '' });
    claimed.add(f.path);
  }
  return out;
}
// THE CODE TAB. Its file tree, its one open file, and its own download.
//
// THE HOST IS RENDERED AND FILLED AFTERWARDS, the Data view's shape: the source
// is a fetch (`/api/site/source`), and `renderSiteWorkspace` is synchronous.
//
// AND THE EMPTY STATE SAYS WHICH EMPTY IT IS. This tab used to be drawn only on
// a project that had never built — where it rendered a two-pane editor with an
// empty tree, an empty filename and a Download button that did nothing. A tab
// that opens onto nothing is the dead control this app has now found four times
// in its own chrome; a sentence naming what is missing is not.
// THE MOBILE APP COLUMN (owner, 2026-09-08). A third column on the right of the
// workspace, opened, closed and resized from the edge tab `#stMobileTab` — the
// only control it has, since the top bar's toggle went on 2026-09-09.
//
// ALWAYS RENDERED, HIDDEN BY CSS — the chat rail's own pattern, one column over,
// and for its reason: the toggle then flips a class instead of re-rendering, so
// opening the panel never reloads the preview iframe and never eats a
// half-typed message. `.st-ws:not(.st-mob-open) .st-mob { display: none; }`.
//
// THERE IS NO BUTTON IN HERE (owner's call, asked directly: "no button, just the
// sentence"). Nothing can build a mobile app yet, and a control that promises
// one would be this repo's open dead-control finding in its own chrome for the
// fifth time — after `stMembers`, the Security panel's Run scan, the effort dial
// and the static-site Publish. The phone icon on the start screen's cards is
// disabled and says "not built yet" for exactly the same reason; this panel says
// the same thing in a full sentence.
//
// The sentence differs by state and both halves are TRUE. A project that has
// never built has no site to make an app from, so "ask me and I'll build one
// from this site" would be a false promise there — it is asked to build the
// website first. When the app is real: draw it here, and delete both sentences.
// THE ONE WRITER of which phone is drawn, and it REFUSES a name that is not one
// of the two rather than storing it — `data-os="undefined"` matches no rule in
// the stylesheet, so the frame would silently lose its shape. Answers whether
// anything changed, so the caller can skip a repaint on a second press of the
// segment that is already on.
function setMobileOs(os) {
  if (!MOBILE_OSES.includes(os) || os === siteMobileOs) return false;
  siteMobileOs = os;
  return true;
}
// The panel TAKES the phone rather than reading the module variable, so it can
// be evaluated and driven in a bare scope — a free identifier resolves when the
// line runs, not when the file loads, which is how four misses reached main in
// one session.
function siteMobilePanel(hasSite, os) {
  const on = MOBILE_OSES.includes(os) ? os : MOBILE_OSES[0];
  // THE MARK AND THE WORD, not the mark alone (owner: "instead of the names, the
  // names plus their logo") — so the button keeps an accessible name in text and
  // the mark is `aria-hidden` decoration beside it. `brandMark` is asked with
  // `v`, the same value that keys the button and the frame, so the mark cannot
  // end up on the wrong segment.
  const seg = (v) =>
    '<button type="button" class="st-mob-osbtn' + (on === v ? ' on' : '') + '" data-os="' + v + '">'
      + brandMark(v, 13) + MOBILE_LABELS[v] + '</button>';
  const words = '<div class="st-mob-empty">' +
    '<h4>No mobile app yet</h4>' +
    '<p>' + (hasSite
      ? 'Ask in the chat and I’ll build one from this site.'
      : 'Build your website first, then ask me for the app.') + '</p>' +
  '</div>';
  // BOTH PHONES ARE ALWAYS RENDERED, AND CSS DECIDES HOW MANY SHOW (owner,
  // 2026-09-09: "when is open until the chatbox … it can show the two layouts
  // one next to each other"). Wide enough and they sit side by side; narrow and
  // the switch picks one. A container query does the choosing, which is what
  // keeps DRAGGING free: the width is one custom property and the layout
  // follows it, so a drag never re-renders and the preview beside it never
  // reloads — the property this whole panel is built around.
  //
  // The SELECTION lives on `.st-mob`, not on the frame, precisely so that one
  // attribute can drive "which one when there is room for one" from the
  // stylesheet. Each phone still carries its own `data-os`, because that is
  // what shapes it.
  const one = (v) =>
    '<div class="st-mob-one" data-os="' + v + '">' +
      '<div class="st-mob-device" data-os="' + v + '">' + words + '</div>' +
      // Named only when BOTH are on screen — with one phone the switch above
      // already says which, and a second label would be the same fact twice.
      '<span class="st-mob-cap">' + brandMark(v, 12) + MOBILE_LABELS[v] + '</span>' +
    '</div>';
  return '<div class="st-mob" data-os="' + on + '">' +
    '<div class="st-mob-head"><span class="st-mob-title">Mobile app</span>' +
      '<div class="st-mob-os" role="group" aria-label="Which phone">' +
        seg('ios') + seg('android') +
      '</div>' +
    '</div>' +
    '<div class="st-mob-stage">' + MOBILE_OSES.map(one).join('') + '</div>' +
  '</div>';
}
function siteCodeView(site) {
  if (!(site && site.react && site.url)) {
    return '<div class="st-code"><div class="st-empty">Your site\u2019s code appears here once the first draft is built.</div></div>';
  }
  return '<div class="st-codewrap" id="stCode"><div class="st-empty">Loading your code\u2026</div></div>';
}
/**
 * THE FILE BEING READ — the bar, the note and the source, as its own renderer so
 * that clicking a row can repaint THE FILE without rebuilding the panel around it.
 *
 * IT IS ITS OWN FUNCTION BECAUSE OF AN ANIMATION, and that is worth saying out
 * loud or the next session inlines it again. `.st-code` carries an entrance in
 * `styles.css` — "builder Preview/Code/More/Data panels re-render on switch →
 * animate each in" — which was written when this panel was only ever built on a
 * TAB SWITCH. A file click rebuilding the panel's HTML puts a brand-new
 * `.st-code` into the document, so that entrance runs again: MEASURED in a real
 * browser, the whole panel drops 8px, fades to zero and slides back over 220ms,
 * on every single row press. The owner's word for it was "the screen vibrates".
 * Rewriting only the part that changed moves it 0.00px, which is the control.
 *
 * This is the file's own "a display control must not take down more of the panel
 * than the thing it displays", one layer further in — and the recorded "a rule
 * true because of a layer below it expires when that layer moves": the entrance
 * was correct for as long as nothing rebuilt the panel by itself.
 */
function stCodeFileHtml(open) {
  // CLIPPED FOR DISPLAY ONLY, and the zip gets the whole file. A `<pre>` of a
  // megabyte locks the tab; a download that quietly lost the end of a page
  // would be a lying instrument.
  const raw = String(open.text).slice(0, 120000);
  const gutter = Array.from({ length: raw.split('\n').length }, (_, i) => i + 1).join('\n');
  // THE "READ ONLY" PILL IS GONE (owner, 2026-09-12: "delete the thing that
  // says read only"). It was added because the panel has never been editable
  // and never said so; the owner's call is that the label was worth less than
  // the space and the noise it cost. The panel is still read-only — nothing
  // about the behaviour moved, only the sentence about it.
  return '<div class="st-code-bar"><span class="st-code-fname">' + esc(open.name) + '</span>' +
    '<button type="button" class="st-code-dl" id="stCodeDl" title="Download this file">' + ic('download', 14) + ' Download</button></div>' +
    (open.note ? '<div class="st-code-note">' + esc(open.note) + '</div>' : '') +
    '<div class="st-code-scroll"><pre class="st-code-gutter" aria-hidden="true">' + gutter + '</pre><pre class="st-code-pre"><code>' + esc(raw) + '</code></pre></div>';
}
// The fetched half. Answers rather than throws at every step, because a code
// view that cannot load must say so and never take the workspace down with it.
async function loadSiteCode(site) {
  const host = document.getElementById('stCode'); if (!host) return;
  const slug = String((site && site.slug) || '');
  if (!slug) { host.innerHTML = '<div class="st-empty">This site has no address yet.</div>'; return; }
  let src = null;
  try {
    const r = await apiFetch('/api/site/source?slug=' + encodeURIComponent(slug));
    const d = await r.json().catch(() => ({}));
    if (r.ok && d && d.ok) src = d;
  } catch (e) {}
  if (!src) { host.innerHTML = '<div class="st-empty">Couldn\u2019t read your code just now \u2014 try the tab again in a moment.</div>'; return; }
  drawSiteCode(src);
}
// THE DRAW IS NOT THE FETCH, and splitting them is what makes a fold free.
// Opening a folder changes nothing about the project \u2014 it is a preference, not a
// question for the server \u2014 so a fold that went back through `loadSiteCode`
// would buy eighteen files over the wire to hide four rows, AND a blip on that
// fetch would replace the whole panel with "couldn't read your code just now".
// A display control that can take the panel down is the wrong shape whatever it
// costs. Both click handlers redraw from the answer they were drawn from, which
// they close over; nothing is re-asked until the tab is opened again.
//
// The file picker went through the fetch too, from the day it shipped. Fixed by
// the same split rather than left standing beside the new one.
//
// AND THE SEARCH BOX SPLITS IT ONCE MORE, one level down (2026-09-12). A filter
// changes only the TREE, so it redraws only the tree: going back through
// `drawSiteCode` would replace the panel's whole HTML on every keystroke, which
// destroys the input mid-word and scrolls the file being read back to its top.
// Same argument, one layer in — a display control must not take down more of the
// panel than the thing it displays.
function drawSiteCode(src) {
  const host = document.getElementById('stCode'); if (!host) return;
  const files = stSrcFiles(src);
  siteCodeFiles = files;
  if (!files.length) {
    host.innerHTML = '<div class="st-empty">' + esc(src.why || 'Nothing stored for this site yet.') + '</div>';
    return;
  }
  // The chosen file, kept across renders by NAME rather than by index — a
  // rebuild can add or drop a part, and an index would then open a different
  // file than the one that was open.
  //
  // AND IT IS CHOSEN FROM THE WHOLE PROJECT, NEVER FROM THE SEARCH RESULTS.
  // Typing in a box must not change what you are reading: filtered through
  // `found.files`, a query that excludes the open file would fall to `[0]` and
  // swap the pane out from under the customer mid-word, and clearing the box
  // would not bring their file back.
  let open = files.find((f) => f.name === siteCodeOpen) || files[0];
  siteCodeOpen = open.name;
  // THE SHELL IS EMPTY IN BOTH COLUMNS, and each is filled by the one function
  // that owns it — `paintFile` and `paintTree` below. Writing either one's
  // markup here as well would be a second copy of it, and the copy that drifts
  // is the one nothing clicks.
  host.innerHTML = '<div class="st-code">' +
    '<div class="st-code-tree">' + stFindBox(siteCodeFind) + '<div class="st-code-rows"></div></div>' +
    '<div class="st-code-main"></div>' +
  '</div>' + stRowMenuHtml();
  // THE MENU IS A SIBLING OF THE EDITOR, not a child of the scrolling row list.
  // It is `position: fixed` off the handle's own rect, so a menu written inside
  // `.st-code-rows` would still escape that box — but it would be REMOVED and
  // rebuilt by every keystroke in the search box, which is the one thing that
  // happens while a menu can be open.
  const menu = host.querySelector('#stRowMenu');
  // WHICH FILE THE OPEN MENU IS POINTED AT — a name, never the file object, for
  // the same reason the open file is kept by name: a rebuild replaces every entry
  // in `files`, and a held object would go on answering for a row that is gone.
  let menuFor = '';
  const closeMenu = () => {
    menuFor = '';
    if (menu) menu.classList.remove('open');
    host.querySelectorAll('[data-srcmore][aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  };
  // ONE PLACE BUILDS THE TREE AND BINDS ITS ROWS, called on the first paint, on
  // every keystroke in the search box, and on every row and fold click. Two
  // copies would be "two lists of the same thing" with the rows' own handlers
  // inside them, and the failure is a filtered tree whose files do nothing when
  // clicked.
  const rows = host.querySelector('.st-code-rows');
  const said = host.querySelector('.st-find-said');
  const box = host.querySelector('.st-code-find');
  const main = host.querySelector('.st-code-main');
  // ONE PLACE REPAINTS THE FILE BEING READ, and it replaces the editor column
  // alone. Going back through `drawSiteCode` for a row click is what made the
  // whole panel twitch (see `stCodeFileHtml`), and it also threw the tree's own
  // scroll position back to the top on every press.
  const paintFile = () => {
    if (!main) return;
    main.innerHTML = stCodeFileHtml(open);
    // REBOUND HERE BECAUSE THE BUTTON IS INSIDE WHAT WE JUST REPLACED. It reads
    // `open` at press time rather than closing over a file, so it downloads what
    // is on screen and not whatever was open when the panel was drawn.
    const dl = main.querySelector('#stCodeDl');
    if (dl) dl.onclick = () => stSaveBlob(new Blob([open.text], { type: 'text/plain' }), open.name.split('/').pop());
  };
  const paintTree = () => {
    if (!rows) return;
    // THE LIST KEEPS ITS PLACE. `innerHTML` empties the box, which clamps
    // `scrollTop` to zero, so without this a customer reading a file near the
    // bottom of the tree is thrown back to PAGES every time they click one. A
    // NEW QUERY is the one case where the top is right, and its own handler
    // says so rather than this one guessing.
    const wasAt = rows.scrollTop;
    const found = stCodeFind(files, siteCodeFind);
    rows.innerHTML = found.files.length
      ? stCodeTree(found.files, open.name, siteCodeOpenGroups, found.on)
      : '<div class="st-find-none">' + esc(stFindNone(siteCodeFind)) + '</div>';
    if (said) said.textContent = stFindSaid(found);
    if (box) box.classList.toggle('on', found.on);
    // A ROW CLICK REPAINTS THE FILE AND THE TREE, NEVER THE PANEL. It used to
    // call `drawSiteCode`, which rebuilds `.st-code` — and a new `.st-code`
    // re-runs the entrance animation `styles.css` puts on it, so the whole
    // panel dropped 8px and faded on every press. `stCodeFileHtml` carries the
    // measurement and the reasoning.
    //
    // THE TREE IS REPAINTED TOO, rather than the `on` class being moved by hand,
    // because with no stored fold preference the open chain is DERIVED from the
    // file being read — so which folders stand open is part of what a row click
    // changes, and moving one class would leave the tree describing the file
    // before it.
    rows.querySelectorAll('[data-srcname]').forEach((b) => b.onclick = () => {
      closeMenu();
      const next = files.find((f) => f.name === b.dataset.srcname);
      // THE SAME FILE IS NOT A CHANGE. Repainting would scroll it back to its
      // first line for nothing, which is the defect one row over.
      if (!next || next.name === open.name) return;
      open = next;
      siteCodeOpen = next.name;
      paintFile();
      paintTree();
    });
    // THE HANDLE OPENS THE ONE MENU AT ITS OWN ROW. `stopPropagation` is what
    // keeps it from ALSO opening the file underneath — the two buttons sit in one
    // row and the document's close handler is listening on the way back up.
    rows.querySelectorAll('[data-srcmore]').forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      const was = b.getAttribute('aria-expanded') === 'true';
      closeMenu();
      if (was || !menu) return;                       // a second press shuts it
      menuFor = b.dataset.srcmore;
      b.setAttribute('aria-expanded', 'true');
      // POSITIONED OFF THE HANDLE'S OWN RECT, and flipped up when there is not
      // room below — a menu on the last row of a long tree would otherwise open
      // past the bottom of the panel with its entries unreachable.
      const r = b.getBoundingClientRect();
      const h = ST_ROW_ACTS.length * 30 + 12;
      menu.style.left = Math.max(8, Math.min(r.left - 150, window.innerWidth - 190)) + 'px';
      menu.style.top = (r.bottom + h > window.innerHeight ? Math.max(8, r.top - h) : r.bottom + 4) + 'px';
      menu.classList.add('open');
    });
    // A FOLD IS MATERIALISED BEFORE IT IS CHANGED. The first click has no stored
    // choice to toggle, so it takes the derived default as its starting point —
    // which is what keeps the chain holding the open file open after the customer
    // folds a different one, rather than everything snapping shut at once.
    //
    // ONE HANDLER FOR A GROUP AND A FOLDER, because they are the same thing at two
    // depths: a key that is either in the open set or not. A second handler would
    // be a second copy of "materialise, toggle, redraw" with nothing to gain.
    //
    // AND IT IS COMPUTED FROM THE WHOLE PROJECT (`files`), never from the filtered
    // list: a fold is the customer's own preference about their tree, and deriving
    // the default from a filtered list would store a chain that names folders the
    // query happened to leave standing.
    rows.querySelectorAll('[data-srcfold]').forEach((b) => b.onclick = () => {
      const now = new Set(stOpenGroups(files, open.name, siteCodeOpenGroups));
      const k = b.dataset.srcfold;
      if (now.has(k)) now.delete(k); else now.add(k);
      siteCodeOpenGroups = now;
      // THE TREE, NOT THE PANEL — the row click's argument, for the same reason
      // and with one more: a fold changes nothing about the file being read, so
      // rebuilding the editor beside it scrolled that file back to line 1.
      paintTree();
    });
    rows.scrollTop = wasAt;
  };
  paintFile();
  paintTree();
  // THE SEARCH BOX REDRAWS THE TREE AND NOTHING ELSE. Calling `drawSiteCode` per
  // keystroke would destroy the input the customer is typing in — focus and caret
  // gone after one character — and would also rebuild the `<pre>` beside it, so
  // the file being read would jump back to its first line on every letter.
  //
  // AND A NEW QUERY STARTS AT THE TOP. `paintTree` keeps the list's place, which
  // is right for a click on a tree that did not change; a different set of
  // results is a different list, and holding a scroll offset into it lands the
  // customer in the middle of matches they have not seen.
  const find = document.getElementById('stCodeFind');
  if (find) {
    find.oninput = () => { siteCodeFind = find.value; paintTree(); if (rows) rows.scrollTop = 0; };
    // ESCAPE CLEARS, AND STOPS THERE. The document has its own Escape handler that
    // closes whatever overlay is open, so without this a customer emptying the box
    // would also shut the panel they are searching in.
    find.onkeydown = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (!find.value) return;
      find.value = ''; siteCodeFind = ''; paintTree(); if (rows) rows.scrollTop = 0;
    };
  }
  const clear = document.getElementById('stCodeFindX');
  // FOCUS GOES BACK TO THE FIELD, because clearing a search is almost always the
  // start of the next one, and a cleared box the caret is not in costs a click.
  if (clear && find) clear.onclick = () => { find.value = ''; siteCodeFind = ''; paintTree(); if (rows) rows.scrollTop = 0; find.focus(); };

  // THE MENU'S OWN WIRING, bound once per draw rather than per row — the entries
  // never change, only which file they are pointed at.
  if (menu) {
    menu.onclick = (e) => e.stopPropagation();
    menu.querySelectorAll('[data-act]').forEach((it) => it.onclick = () => {
      // LOOKED UP FROM THE WHOLE PROJECT BY NAME, at the moment it is pressed.
      // Closing over the file object would hand back whatever the tree held when
      // the menu was drawn, and a rebuild between the two is an ordinary thing.
      const f = files.find((x) => x.name === menuFor);
      const said = stRowMenuAct(it.dataset.act, f, {
        copy: (t) => { try { navigator.clipboard.writeText(t); } catch (err) {} },
        save: (t, n) => stSaveBlob(new Blob([t], { type: 'text/plain' }), n),
      });
      closeMenu();
      if (said && typeof sbToast === 'function') sbToast(said);
    });
    // DISMISSED RATHER THAN LEFT FLOATING. It is `position: fixed` off a row's
    // rect, so a tree that scrolls underneath it leaves the menu pointing at a
    // different file than the one it was opened on — `closeApInfo`'s own
    // reasoning, one panel over, and the failure here would be copying the
    // wrong file's contents.
    if (rows) rows.addEventListener('scroll', closeMenu);
    host.addEventListener('click', closeMenu);
    // ESCAPE SHUTS IT AND STOPS THERE, so it does not also close the workspace
    // behind it — the search box's own rule, for the document handler that is
    // listening for exactly this key.
    menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); } });
  }
}
// ONE SAVER, so the two downloads cannot drift on how a file reaches the disk.
function stSaveBlob(blob, filename) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u; a.download = String(filename || 'download');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
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
  // A whole spreadsheet in one go (owner, 2026-09-03). Offered on exactly the
  // tables "+ Add" is — the ones whose rows are the owner's to add — and for
  // the same reason: a member-written table's rows can only be added by one.
  const importBtn = (canAdd && !siteDataForm) ? '<button type="button" class="st-data-import" id="stDataImport" title="Add rows from a CSV file — the first line names the columns">Import CSV</button>' : '';
  // Email-me-when-someone-submits, and the switch to stop it. Only meaningful
  // on a table visitors write to.
  const notifyBtn = (selTab.access === 'collect')
    ? '<button type="button" class="st-data-notify" id="stDataNotify" title="Email me when someone submits">…</button>' : '';
  host.innerHTML = '<div class="st-data-head"><span class="st-data-title">Data</span><span class="st-data-count">' + (rows.length ? rows.length + ' row' + (rows.length > 1 ? 's' : '') : '') + '</span>' + notifyBtn + importBtn + addBtn + '<button type="button" class="st-icon" id="stDataReload" title="Refresh">' + ic('reload', 15) + '</button></div><div class="st-data-body">' + side + '<div class="st-data-main">' + formHtml + main + '</div></div>';
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
  // Import a CSV: the file's TEXT is the body, the server matches its header
  // line to the table's columns and says what went in and what did not. The
  // size is refused here before an upload the server would refuse anyway.
  const imp = document.getElementById('stDataImport'); if (imp) imp.onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.csv,text/csv,text/plain';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      if (f.size > 2 * 1024 * 1024) { sbToast('That file is too big — keep it under 2 MB.'); return; }
      const was = imp.textContent; imp.textContent = 'Importing…'; imp.disabled = true;
      let done = false;
      try {
        const text = await f.text();
        const r = await apiFetch(base + '/rows/' + encodeURIComponent(sel) + '/import', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: text });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { sbToast(d.error || 'Couldn’t import that file.'); return; }
        sbToast(importWords(d));
        done = true;
      } catch (e) { sbToast('Couldn’t import that file — check your connection.'); }
      finally { imp.textContent = was; imp.disabled = false; }
      if (done) { siteDataForm = null; loadSiteData(site); }
    };
    inp.click();
  };
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

    emails: 'Set up in Secrets — add your provider key',   // no route; the key lives under Secrets
  };
  const cards = [
    ['users', 'Members', dataLive ? 'Accounts that sign up in your app' : (isReact ? 'Add a login to your app to collect members' : 'Publish to enable member accounts'), dataLive, 'members'],
    ['key', 'Security log', dataLive ? 'Sign-ins, failures and what you changed' : (isReact ? 'Add a login to your app to see this' : 'Publish to enable the security log'), dataLive, 'security'],
    ['inbox', 'Submissions', dataLive ? 'Form entries from your visitors' : (isReact ? 'Add a form to your app to collect entries' : 'Publish to collect submissions'), dataLive, 'inbox'],
    ['database', 'Database', dataLive ? 'Your app’s tables + rows' : (isReact ? 'Add data to your app to see it here' : 'Publish to enable collections'), dataLive, 'database'],
    ['chart', 'Insights', dataLive ? 'Traffic, top pages + error rate' : (isReact ? 'Add data/traffic to see insights' : 'Publish to see insights'), dataLive, 'insights'],
    ['download', 'Backups & export', dataLive ? 'A nightly copy of your data, kept 7 days — download any day' : (isReact ? 'Add data to enable backups' : 'Publish to enable backups'), dataLive, 'backups'],
    ['history', 'Versions', (isReact && !!site.slug) ? 'Roll back to a previous build' : (isReact ? 'Publish to enable versions' : 'React sites only'), (isReact && !!site.slug), 'versions'],
    ['key', 'Secrets', isReact ? 'API keys for payments, email + integrations (kept server-side)' : 'Encrypted keys for server-side features', fnLive, 'secrets'],
    ['history', 'Scheduled jobs', dataLive ? 'What your site does on a timer, and what it did' : (isReact ? 'Add data to your app to enable scheduled work' : 'Publish to enable scheduled work'), dataLive, 'functions'],
    ['mail', 'Emails', 'Send email from your own provider', auxLive, 'emails'],
    ['card', 'Payments', dataLive ? 'Sell with your own Stripe' : (isReact ? 'Publish your app to take payments' : 'Publish to take payments'), fnLive, 'payments'],
    ['image', 'Files', 'Pictures and documents \u2014 add a PDF to hand out', dataLive, 'files'],
    ['alert', 'Errors', dataLive ? 'Problems visitors hit on your live site' : (isReact ? 'Add data to enable error reports' : 'Publish to enable error reports'), dataLive, 'errors'],
    // OFF THE WEB AND BACK, AND THIS CARD IS THE ONLY DOOR TO IT (owner,
    // 2026-09-08: "add the card"). `sitePublishPanel` holds "Take it offline"
    // and "Put it back online", and its ONLY caller was the Publish button on
    // the top bar — gated `isReact ? '' : …`, so it appeared only on a project
    // that had never built. The capability has been live on the server and
    // unreachable in the product ever since; deleting Publish did not bury it,
    // it was already buried.
    //
    // THE SENTENCE SAYS WHAT THE CARD DOES, NEVER WHAT STATE THE SITE IS IN.
    //
    // WHEN THIS WAS WRITTEN THAT WAS FORCED, AND AN HOUR LATER IT BECAME A
    // CHOICE — corrected here rather than left, since a reason that has expired
    // is how the next session re-derives the wrong rule. The state was a
    // localStorage flag carried by nothing on the wire, so a card claiming
    // "Live at its address" would have been a false statement about a site
    // taken off the web from another machine. `offline_at` and
    // `SiteList.offlineFor` fixed that, and the panel behind this card really
    // does show the live state now.
    //
    // It still says nothing about state, because a card in a grid of thirteen
    // that changes its words on a live fact is noise, and the panel says it in
    // its own heading the moment you open it. That is where the state belongs.
    //
    // NEEDS ONLY A PUBLISHED SITE — the Domains rule directly below, for its
    // reason: `siteSetLive` returns at once without a slug, and nothing on this
    // path touches the database, so a brochure site with no backend has exactly
    // as much use for it as an app does.
    ['zap', 'Visibility', site.slug ? 'Take your site off the web, or put it back' : 'Build the first draft, then you can take it off the web', !!site.slug, 'visibility'],
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
  // WHICH FACE THIS PANEL SHOWS, asked of the one rule the grid asks (2026-09-08,
  // owner: "fix the offline flag on the server too"). It used to be
  // `site.offline === true` — a flag written into localStorage by whichever
  // browser pressed the button — so a site taken off the web on a laptop opened
  // this panel on a phone still offering to take it offline. `offlineFor`
  // prefers the server's answer, which every machine shares, and falls back to
  // this browser's only where the server could not tell.
  const offline = SiteList.offlineFor(sitesRemote, site);
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
      // AND IN THE CACHED COPY OF THE SERVER'S OWN LIST, which the start screen
      // now PREFERS over this record (`SiteList.merge`). That list is held for a
      // minute, so without this the merge would spend that minute answering with
      // a row read before the press and the card would show the face this press
      // just changed. Nothing is invented: the POST came back ok, so this is the
      // server's answer, recorded rather than guessed.
      sitesRemote = SiteList.markOffline(sitesRemote, slug, !live);
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
  // THE MOBILE APP COLUMN BELONGS TO THE PREVIEW (owner, 2026-09-09: "so i wanna
  // to tell to only show it in the preview"). It showed on Code and More too,
  // beside a pane it has nothing to do with.
  //
  // The gate asks what the stage is SHOWING, not what was asked for, because
  // those differ — see `stStageView`. Gated on `siteView === 'preview'` instead,
  // a site carrying 'data' with no Data tab would show the preview with the
  // phone hidden beside it, which is the thing being asked against.
  const stageView = stStageView(siteView, !!(isReact && site.backend));
  view.innerHTML =
    // BOTH HALVES OF THE PANEL'S STATE LAND HERE, and that is the whole reason
    // the width is written at the render rather than left where the drag put
    // it. `setMobileW` sets `--mob-w` as an inline property on THIS element,
    // and this element is replaced on every render — which the workspace does
    // on every builder reply. So the open class rode the re-render and the
    // width did not: drag the panel wide, send a message, and it snapped back
    // to the clamp. Measured 1004px → 393px on a view switch.
    // The clamp stays the FALLBACK, so an undragged panel is exactly the
    // default it always was and the attribute only ever carries a width a
    // person chose.
    //
    // AND `st-pv` IS THE THIRD THING THIS ELEMENT CARRIES: whether the stage is
    // showing the preview. It is here rather than on the panel because three
    // separate controls read it — the column, the edge tab that opens and
    // resizes it, and the top bar's toggle — and they sit in two different rows.
    // Written from `stageView` with no boolean in between, so there is nothing
    // for a later edit to leave behind when the chain below changes.
    '<div class="st-ws st-lv' + (siteRailHidden ? ' st-rail-hidden' : '') + (siteMobileOpen ? ' st-mob-open' : '') + (stageView === 'preview' ? ' st-pv' : '') + '"' +
      (Number.isFinite(siteMobileW) ? ' style="--mob-w:' + siteMobileW + 'px"' : '') + '>' +
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
            // THE SAME TABS WHETHER OR NOT IT HAS BUILT (owner, 2026-09-08: "2
            // different screens when theres a build and not"). This was
            // `isReact ? '' : …`, so Code showed ONLY on a project that had
            // never built — the one state where it had nothing to open — and
            // vanished the moment the site had code worth reading. It shows
            // always now and says which empty it is when there is nothing yet.
            '<button type="button" class="st-vtab' + (siteView === 'code' ? ' on' : '') + '" data-view="code">' + ic('code', 14) + ' Code</button>' +
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
          // THE MOBILE APP PANEL'S DOOR IS THE EDGE TAB, AND ONLY THE EDGE TAB
          // (owner, 2026-09-09, on a screenshot of the button that used to sit
          // here: "OPK YOU CAN DELETE THIS BUTTON SINCE WE HAVE THE DRAG
          // THING"). A `#stMobile` toggle stood here beside the width buttons,
          // drawn `ic('sidebar', 17)`, and it opened and closed the column.
          //
          // WHAT MADE IT REDUNDANT WAS THE DRAG, not this deletion. The tab
          // opened only, once, and could not shut — which is why a second
          // control had to exist at all. Since the drag work a press that does
          // NOT move is a click, and a click on an open panel closes it, so the
          // tab is a door that swings both ways and this was the second one to
          // the same room. The recorded "a rule true because of a layer below
          // it expires when that layer moves": the button's whole reason went
          // when the tab learned to close, and nothing announced it.
          //
          // The glyph STAYS in `ST_ICONS`. `sidebar` has no other caller now,
          // and deleting an icon because its one caller went quiet is how a
          // feature becomes expensive to put back — the card phone's own
          // precedent, kept for its reason rather than by habit.
          // FORM SUBMISSIONS AND SITE MEMBERS ARE OFF THIS BAR (owner,
          // 2026-09-07: "DELETE THIS 2 THINGS"). Both were SECOND doors to a
          // Cloud card that already exists and describes itself — "Submissions:
          // form entries from your visitors", "Members: accounts that sign up
          // in your app" — so the panels are untouched and still open from
          // there; what went is the duplicate icon.
          //
          // AND ONE OF THEM WAS ALREADY DEAD. `stMembers` was drawn with a
          // title and an aria-label and never given a handler: the line below
          // read `const mb = document.getElementById('stMembers');` and nothing
          // used `mb`. It looked live to every customer and did nothing when
          // pressed — the repo's own open dead-control finding, in the chrome
          // rather than in a generated page.
          // DOWNLOAD IS THE SITE'S SOURCE, ZIPPED, and it is drawn on both
          // screens for the reason the Code tab is. It used to be
          // `Download page HTML` — one file, the static-site era's stored
          // page — hidden on every React site and greyed on the only screen
          // that drew it.
          //
          // DIMMED RATHER THAN HIDDEN BEFORE THE FIRST BUILD, and the tooltip
          // says what to do: the card icons settled that rule, and hiding a
          // control is how a customer never learns it is there.
          '<button type="button" class="st-icon" id="stDl" title="' + (isReact ? 'Download your code' : 'Nothing to download yet \u2014 build the first draft') + '" aria-label="Download your code"' + (isReact ? '' : ' disabled') + '>' + ic('download', 16) + '</button>' +
          '<button type="button" class="st-share" id="stShare">Share</button>' +
          // THE "Live ↗" LINK IS GONE (owner's call, 2026-08-08). A React site
          // publishes as part of the build, so there was nothing for it to do
          // that Share does not already do — and it opened the raw
          // `/s/<slug>/` URL in a new tab, which reads as "here is your site on
          // some weird page" rather than as the customer's own address. Share
          // is the one way out of this screen now.
          //
          // AND PUBLISH WENT THE SAME WAY (owner, 2026-09-08). It was gated
          // `isReact ? '' : …` too, so it was already absent from every real
          // site — a React site goes live as part of its build and has nothing
          // to publish. What it drew on the one screen that had it was a
          // disabled button on a project with nothing to put anywhere.
          //
          // WHAT WENT WITH IT IS WORTH SAYING: `sitePublishPanel` was its only
          // caller, and that panel is the only door to "Take it offline" and
          // "Put it back online" — a capability the server really has
          // (`siteSetLive`). It has therefore had NO door on any live site
          // since the `isReact` gate went in; this deletion does not bury it,
          // it was already buried. The panel and `siteSetLive` are kept, the
          // way `gif` and the effort dial were kept.
          //
          // AND IT HAS A DOOR AGAIN (owner, 2026-09-08: "add the card"). This
          // note used to end by saying what to build; the Visibility card in
          // `moreCloud` is that thing, so it now says where the capability
          // lives instead. Cloud is the established home for a panel — it is
          // where the two icons removed on 2026-09-07 point — and the whole of
          // "take it off the web / put it back" is reached from there.
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
                  // THE EFFORT DIAL IS OFF THE ROW (2026-09-07, owner: "DELETE THE
                  // EFFORT THING FOR NOW"). It had been visible-and-inert by an
                  // earlier call of theirs — 2026-08-08, "leave it there but
                  // doesn't work, i want it like that" — and that is the whole
                  // reason it goes now: a control that does nothing says nothing.
                  // The three disabled controls on a site card each earn their
                  // place by naming a true sentence ("not built yet", "ask me in
                  // the chat"); a five-level dial with no effect names none.
                  // `buildEffortHTML` and its table are parked, not deleted — see
                  // them for the three lines that put it back.
                  (siteBusy
                    ? '<button type="button" class="st-sendc st-stopc" id="stStop" title="Stop" aria-label="Stop generating">■</button>'
                    : '<button type="button" class="st-sendc" id="stSend" title="Send" aria-label="Send">↑</button>') +
                '</div>' +
              '</div>') +
        '</div>' +
        '<div class="st-stage" id="stStage" data-dev="' + siteDevice + '">' +
          (stStageBuilding(site)
            // A first React build has no preview yet → show a compile placeholder in
            // the stage; the live code is in the chat. (A React revise keeps its
            // existing preview visible and just reloads it when done.)
            // THE STAGE IS DRAWN FROM `buildStageHTML()` HERE AND IN
            // `paintReactLive`, AND NOWHERE ELSE. The label used to be built
            // inline on this line and repainted nowhere, which is why the panel
            // said "Thinking…" for a seventeen-minute build while the thread
            // moved: two halves that can be painted apart will eventually
            // disagree. One composition, two call sites, and a guard counts them.
            //
            // AND `stBuildRunning()` IS THE OTHER HALF OF THAT SAME LESSON, one
            // gate up (2026-09-08). Drawing was unified and the QUESTION was
            // not: this branch asked `siteBusy`, which is true from the instant
            // any message is sent, so typing "hey" replaced the whole preview
            // with a build rail for a message that was never a build. The rail
            // asks the predicate, this asks the predicate, and neither spells
            // the state itself.
            //
            // BOTH ARE NOW `stStageBuilding` / `stBuildFrameHTML` (2026-09-10),
            // because the whole condition and the whole panel were still
            // written out here — so `paintReactLive` could update this panel and
            // never create it, and a first build sat on the invitation for its
            // whole run. See those two functions.
            ? stBuildFrameHTML(site)
            : !hasSite
              // THE CLASSIC LOG BOX IS THE CLASSIC BUILD'S, and it took a react
              // build's thinking window with it once the gate above narrowed:
              // `paintBuildLog` returns early for a react build, so that div is
              // one nothing ever fills — a blank right-hand side where the
              // invitation used to be. A react build in `thinking` is a message
              // we do not yet know the shape of, so the panel stays exactly what
              // it was before it was sent.
              ? (siteBusy && siteBuild && !siteBuild.react
                  ? '<div class="st-empty"><div class="st-livelog st-livelog-stage"></div></div>'
                  : '<div class="st-empty">' + (siteBusy && stBuildRunning() ? 'Building your site — this takes a minute or two…' : 'Describe your site on the left to build the first draft.') + '</div>')
              // THE PANE IS NOT GATED ON `isReact`, AND THAT WAS THE DEFECT THE
              // TAB'S OWN FIX LEFT BEHIND. Making Code real took three hops —
              // draw the tab, render the host, fetch into it — and only two were
              // changed: this branch kept `!isReact &&`, which is false on every
              // site that has ever built, so pressing Code highlighted the tab,
              // fired the fetch, found no host (`loadSiteCode` returns early on
              // a missing `#stCode`) and fell through this whole chain to the
              // preview iframe. Live on hartleys-barbers, and silent: no error,
              // no console, just the wrong pane.
              //
              // `siteCodeView` ALREADY asks `site.react && site.url` itself and
              // answers the empty sentence when there is nothing built, so the
              // outer test was redundant with the function's own gate and
              // inverted against it. The condition is the view, and nothing else.
              //
              // AND THE CHAIN ASKS `stageView`, which is this chain written
              // once as a function. The panel's gate has to agree with what
              // lands here, and the only way two readings cannot drift is for
              // there to be one reading.
              : (stageView === 'code')
                ? siteCodeView(site)
                : (stageView === 'data')
                  ? '<div class="st-datawrap" id="stData"><div class="st-empty">Loading your data…</div></div>'
                  : stageView === 'more'
                    ? siteMoreView(site)
                    : '<div class="st-frame"><div class="st-frame-bar"><span class="st-frame-url">' + esc(previewUrl) + '</span></div><iframe id="stFrame" sandbox="' + FRAME_SANDBOX + '" title="Site preview"></iframe></div>') +
          // The fix bar overlays the preview iframe, so it asks the stage's own
          // question rather than keeping a second copy of it — found by the
          // guard that counts copies, which is what that guard is for.
          ((hasSite && stageView === 'preview')
            ? '<div class="st-fixbar" id="stFixBar" hidden><span class="st-fixbar-ic">' + ic('alert', 15) + '</span><span class="st-fixbar-n"></span><button type="button" class="st-fixbar-btn" id="stFixBtn">Fix with AI</button><button type="button" class="st-fixbar-x" id="stFixX" aria-label="Dismiss">×</button></div>'
            : '') +
          ((siteErr && siteErr.chatId === site.id)
            // THE CARD READS THE OUTCOME, IT DOES NOT ASSERT ONE. This sentence
            // ended "— you weren't charged" as a string literal, with no
            // response anywhere in scope: it said that over a build that had
            // just taken 10 credits. `buildCostWords` answers "" when the cost
            // was never read, so the card simply stops talking about money
            // rather than guessing.
            ? '<div class="st-errcard"><div class="st-err-h"><span class="st-err-ic">' + ic('alert', 16) + '</span> Error</div><div class="st-err-b">' + esc('That change didn’t go through.' + buildCostWords(siteErr)) + '</div>' +
              '<div class="st-err-row"><button type="button" class="st-err-logs" id="stErrLogs">Dismiss</button><button type="button" class="st-err-fix" id="stErrFix">Try to fix ⏎</button></div></div>'
            : '') +
        '</div>' +
        siteMobilePanel(hasSite, siteMobileOs) +
        // THE PANEL'S OWN EDGE (owner, 2026-09-09: "it gotta show it like a
        // hidden sidebar tho, not like a button opens it"). A tab on the
        // workspace's right border, so a closed panel is VISIBLY there — before
        // this the only way to learn the feature existed was to press an
        // unlabelled icon in the top bar, which is the discovery problem the
        // card icons already settled once: a control earns its place by SAYING
        // something, and an invisible one says nothing at all.
        //
        // IT OPENS, CLOSES AND RESIZES — it is the panel's ONLY control since
        // 2026-09-09. The comment here used to say "it only opens, and that is
        // why its handler is not a toggle: the stylesheet hides it the moment
        // the panel is open". Both halves stopped being true when the tab
        // became the drag handle: it stays on screen and rides out to
        // `right: var(--mob-w)`, and a press that does not move is a click that
        // closes. The sentence outlived its layer by a day before the top bar's
        // toggle went and made it load-bearing.
        //
        // SO ITS NAME FOLLOWS THE STATE, and that is this deletion's own
        // consequence rather than a flourish. The button that went was the only
        // control that said "Hide the mobile app"; with it gone, a fixed "Show
        // the mobile app" would be the single name a screen reader ever gets
        // for a control that also hides. Drawn from the flag HERE as well as
        // moved by the setter, because the workspace re-renders on every
        // builder reply and a name written only by the handler goes stale on
        // the next one — the recorded sweep survivor, one control over.
        //
        // Inside `.st-body` because that is the row it belongs to; it is
        // positioned against that row's right edge, which when the panel is
        // closed is the stage's edge.
        '<button type="button" class="st-mob-tab" id="stMobileTab" title="' + (siteMobileOpen ? 'Hide the mobile app' : 'Show the mobile app') + '" aria-label="' + (siteMobileOpen ? 'Hide the mobile app' : 'Show the mobile app') + '">' + ic('chevronleft', 13) + '</button>' +
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
    loadSiteFrame(fr, site.url + (at !== '/' ? String(at).replace(/^\//, '') : '') + '?v=' + (site.previewV || 1));
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
  // THE CODE TAB'S OWN WIRING LIVES WITH ITS MARKUP, in `loadSiteCode`, because
  // that markup arrives after this function has returned — the Data panel's
  // shape. What stood here was the STATIC-SITE version: a file tree keyed on
  // `data-codepath` that set `site.active`, and a Download that wrote
  // `curHtml`, the page's stored HTML. Neither has anything to act on now: the
  // tab shows the site's real generated source, fetched.
  // More sub-nav (Analytics / Cloud / Security / SEO).
  view.querySelectorAll('[data-more]').forEach((b) => b.onclick = () => { siteMoreTab = b.dataset.more; renderSites(); });
  if (siteView === 'more' && siteMoreTab === 'analytics' && site.slug) loadSiteAnalytics(site);
  if (isReact && site.backend && siteView === 'data') loadSiteData(site);
  // The Code tab fetches its own source once the markup it fills is on the page
  // — `loadSiteData`'s hop, one tab over.
  if (isReact && siteView === 'code') loadSiteCode(site);
  // Cloud cards that are live open their real panels.
  view.querySelectorAll('[data-cloud]').forEach((b) => b.onclick = () => {
    if (b.dataset.cloud === 'database') siteDatabase(site);
    else if (b.dataset.cloud === 'insights') siteInsights(site);
    else if (b.dataset.cloud === 'backups') siteBackups(site);
    else if (b.dataset.cloud === 'errors') siteErrors(site);
    else if (b.dataset.cloud === 'versions') siteVersions(site);
    else if (b.dataset.cloud === 'secrets') siteSecrets(site);
    else if (b.dataset.cloud === 'functions') siteFunctions(site);
    else if (b.dataset.cloud === 'files') siteFiles(site);
    else if (b.dataset.cloud === 'emails') siteEmails(site);
    else if (b.dataset.cloud === 'payments') sitePayments(site);
    else if (b.dataset.cloud === 'domains') siteDomains(site);
    // The door that was missing. Everything behind it already worked.
    else if (b.dataset.cloud === 'visibility') sitePublishPanel(site);
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
  // Open/close the mobile app column, the same way and for the same reason: a
  // class on `.st-ws`, never a re-render, so the preview iframe does not reload
  // and a half-typed message survives.
  //
  // ONE SETTER, ONE CONTROL — the edge tab, since the top bar's toggle went on
  // 2026-09-09. It was two, and the setter is kept as a setter rather than
  // folded back into the tab's handler because the panel is opened from THREE
  // places in this function (the tab's pointerdown, its click-to-close, and the
  // drag's own open-first), and three copies of "flip the class, then move the
  // control's name" is the recorded "two lists of the same thing" with an extra
  // copy.
  //
  // WHAT IT UPDATES MOVED WITH THE DELETION rather than being dropped. The
  // button carried the lit state and the tooltip; the tab carries the NAME, and
  // it is the only thing that ever says "Hide the mobile app" now. It gets no
  // lit class: the tab is not a state indicator, it is an edge that slides out
  // to the panel's border, and `.st-ws.st-mob-open .st-mob-tab` already says
  // where it is by moving it.
  const setMobileOpen = (open) => {
    siteMobileOpen = !!open;
    const ws = view.querySelector('.st-ws');
    if (ws) ws.classList.toggle('st-mob-open', siteMobileOpen);
    const tab = document.getElementById('stMobileTab');
    if (tab) {
      const name = siteMobileOpen ? 'Hide the mobile app' : 'Show the mobile app';
      tab.title = name;
      tab.setAttribute('aria-label', name);
    }
  };

  // THE TAB IS A DRAG HANDLE (owner, 2026-09-09: "that tab can be dragaable and
  // open until the chatbox in the left"). Pull it left and the panel widens;
  // far enough and two phones sit side by side.
  //
  // THE CEILING IS MEASURED, NEVER A CONSTANT. "Until the chatbox" is a place
  // on screen: the row's width less the chat rail and the gaps. With the rail
  // hidden the ceiling is simply larger, which falls out of measuring rather
  // than needing a second rule — and a number typed here would be wrong at
  // every window size but the one it was typed at.
  //
  // THE ARITHMETIC IS UNCHANGED BY THE OVERLAY AND THAT IS WORTH SAYING, since
  // it now holds for a different reason. It used to be flex space: the panel was
  // an item in the row, so the widest it could get was whatever was left after
  // the rail and the two gaps, with the stage squeezed to nothing. The panel is
  // absolute now and takes no space at all, so what this bounds is its LEFT
  // EDGE — anchored right, a width of `body - rail - gaps` puts that edge just
  // past the rail's gap, which is the same place the flex sum used to leave it.
  // Both readings give one formula; only one of them is still the mechanism.
  const mobRoom = () => {
    const body = view.querySelector('.st-body');
    if (!body) return MOBILE_MIN_W;
    const rail = view.querySelector('.st-rail');
    const railW = rail && rail.offsetParent ? rail.getBoundingClientRect().width : 0;
    const gaps = railW ? 26 : 13;              // `.st-body`'s .8rem gap, once per gap
    return Math.max(MOBILE_MIN_W, Math.round(body.getBoundingClientRect().width - railW - gaps));
  };
  // The width reaches the layout as ONE custom property, which is what keeps a
  // drag from re-rendering: the panel's flex-basis, the tab's own offset and
  // the container query all read it, so moving it moves everything and the
  // preview iframe beside it never reloads.
  // A WIDTH THAT IS NOT A NUMBER IS REFUSED RATHER THAN STORED, because this
  // value is written into a style attribute by the render below and the module
  // variable is the only thing standing between a caller and that attribute.
  // `Math.round(undefined)` is NaN, which would bake `--mob-w:NaNpx`.
  const setMobileW = (px) => {
    const n = Math.round(px);
    if (!Number.isFinite(n)) return;
    siteMobileW = Math.max(MOBILE_MIN_W, Math.min(mobRoom(), n));
    const ws = view.querySelector('.st-ws');
    if (ws) ws.style.setProperty('--mob-w', siteMobileW + 'px');
  };
  // AND A STORED WIDTH IS RE-CLAMPED ON EVERY RENDER. The render above bakes
  // whatever the last drag stored; the room it was clamped against can have
  // changed since — the window resized, the chat rail hidden — so this narrows
  // it to what fits now and is a no-op when it already does. `mobRoom` needs
  // the row on screen, which is why it is here and not in the markup.
  if (Number.isFinite(siteMobileW)) setMobileW(siteMobileW);
  const mobTab = document.getElementById('stMobileTab');
  if (mobTab) {
    let from = null;                           // { x, w } while a drag is live
    mobTab.onpointerdown = (e) => {
      // A DRAG THAT STARTS CLOSED OPENS FIRST, so one gesture both opens the
      // panel and sizes it — which is what "drag it open" means. The starting
      // width is whatever is on screen, so the panel never jumps under the
      // cursor on the first pixel of movement.
      //
      // `wasOpen` IS READ BEFORE THE PANEL IS OPENED, and that order is the
      // whole of it. Written the other way round it is always true — the line
      // above has just set it — so `end()` below closed the panel again on
      // every press and clicking the tab did nothing at all. MEASURED, not
      // reasoned: a probe on the tab answered pointerdown:shut, pointerup:open,
      // click:shut, which is the close happening between the last two.
      const wasOpen = siteMobileOpen;
      const panel = view.querySelector('.st-mob');
      const now = wasOpen && panel ? panel.getBoundingClientRect().width : (siteMobileW || MOBILE_MIN_W);
      if (!wasOpen) setMobileOpen(true);
      from = { x: e.clientX, w: now, moved: false, wasOpen };
      mobTab.setPointerCapture && mobTab.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    mobTab.onpointermove = (e) => {
      if (!from) return;
      // Leftward is wider: the panel's left edge follows the pointer.
      const dx = from.x - e.clientX;
      if (Math.abs(dx) > 3) from.moved = true;
      if (from.moved) setMobileW(from.w + dx);
    };
    const end = () => {
      // A PRESS THAT DID NOT MOVE IS A CLICK, and a click on an open panel
      // closes it. This used to be argued as "otherwise the top bar's button
      // would be the only way back"; that button is gone (owner, 2026-09-09),
      // so the branch is not a convenience any more — it is the ONLY way to
      // shut the panel, and deleting it would strand every customer who opened
      // one. Stated the strong way round because the weak way was true for a
      // day and would have read as optional.
      //
      // IT ASKS WHAT THE PANEL WAS AT POINTERDOWN, NOT WHAT IT IS NOW. A press
      // on a CLOSED tab has already opened it two lines up, so reading the live
      // flag here would close it again and a click would do nothing at all —
      // found by tracing the two presses rather than by running it.
      if (from && !from.moved && from.wasOpen) setMobileOpen(false);
      from = null;
    };
    mobTab.onpointerup = end;
    mobTab.onpointercancel = end;
  }
  // iPhone / Android. Same rule as the toggle above: move the attribute and the
  // lit segment BY HAND rather than re-rendering, so the preview iframe beside
  // it never reloads and a half-typed message survives switching phone.
  view.querySelectorAll('.st-mob-osbtn').forEach((b) => b.onclick = () => {
    if (!setMobileOs(b.dataset.os)) return;          // already on it, or not a phone
    // THE SELECTION MOVED TO THE PANEL (2026-09-09). Both phones are rendered
    // now and the stylesheet decides how many show, so what this attribute
    // picks is WHICH ONE when there is only room for one — the frames keep
    // their own `data-os`, which is what shapes each of them.
    const panel = view.querySelector('.st-mob');
    if (panel) panel.dataset.os = siteMobileOs;
    view.querySelectorAll('.st-mob-osbtn').forEach((o) => o.classList.toggle('on', o.dataset.os === siteMobileOs));
  });
  view.querySelectorAll('[data-restore]').forEach((b) => b.onclick = () => siteRestore(siteOpenId, +b.dataset.restore));
  // "Try to fix" error card.
  const errFix = document.getElementById('stErrFix');
  if (errFix) errFix.onclick = () => { siteErr = null; siteSend('There was an error on this page — please find and fix it.'); };
  const errLogs = document.getElementById('stErrLogs');
  if (errLogs) errLogs.onclick = () => { siteErr = null; renderSites(); };
  const back = document.getElementById('stBack');
  if (back) back.onclick = () => openProject(null, 'push');
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
  // DOWNLOAD: the site's own source, as a zip named after the site.
  //
  // IT FETCHES RATHER THAN READING THE TAB. The Code tab fills `siteCodeFiles`,
  // but a customer may press this having never opened it — so the button asks
  // for the source itself and the tab's list is only a cache. Reading the tab
  // alone would have made the button work or not depending on where they had
  // clicked first, which is the worst kind of control: one that is sometimes
  // right.
  const dl = document.getElementById('stDl');
  if (dl) dl.onclick = async () => {
    if (dl.disabled) return;
    const stamp = dl.title;
    dl.disabled = true; dl.title = 'Getting your code\u2026';
    try {
      let files = siteCodeFiles;
      if (!files.length) {
        const r = await apiFetch('/api/site/source?slug=' + encodeURIComponent(site.slug || ''));
        const d = await r.json().catch(() => ({}));
        files = (r.ok && d && d.ok) ? stSrcFiles(d) : [];
        siteCodeFiles = files;
      }
      // NOTHING TO ZIP IS SAID, NEVER SHIPPED AS AN EMPTY ARCHIVE. A zip with
      // no entries opens to an empty folder, which reads as "my code is gone".
      if (!files.length) { if (typeof sbToast === 'function') sbToast('No code stored for this site yet.'); return; }
      const name = String(site.slug || site.name || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site';
      stSaveBlob(new Blob([SiteZip.zipFiles(files)], { type: 'application/zip' }), name + '.zip');
    } catch (e) {
      if (typeof sbToast === 'function') sbToast('Couldn\u2019t get your code just now \u2014 try again in a moment.');
    } finally { dl.disabled = false; dl.title = stamp; }
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
  // THE PUBLISH HANDLER WENT WITH ITS BUTTON (owner, 2026-09-08). It set the
  // label to "Live" or "Offline" and opened `sitePublishPanel` — on a button
  // the `isReact` gate had already stopped drawing for every real site, so
  // both halves were unreachable code that read as live. The panel itself is
  // kept; the comment on the deleted button says how to give it a door.
  // The inbox and members handlers went with their buttons (above). Both
  // panels are still reached from their own Cloud cards, which is the door
  // that describes what it opens.
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
  siteBuild = { phase: 'plan', pages: [], done: [], tick: 0, react: !!react, code: '', file: '', rphase: 'thinking', images: [], filesSeen: [], agents: {}, startedAt: Date.now() };
  if (siteTicker) clearInterval(siteTicker);
  // React builds repaint on stream events, not on a timer — the timer only drives
  // the classic rotating activity log.
    // A REACT BUILD REPAINTS ON THIS TICK NOW, for the clock alone (2026-09-07).
  // It returned early here because a react build was meant to repaint on stream
  // events — from a stream that has never arrived on this path — so between
  // six-second polls nothing moved at all. A repaint can lose no expand state
  // today because no live row has a body any more; the day one comes back, that
  // stops being true and this has to preserve it.
  //
  // THE TIMER IS CLEARED BY `siteBuildStop`, which is the only thing that nulls
  // `siteBuild` — a clock outliving its build is this repo's recorded shape.
  siteTicker = setInterval(() => {
    if (!siteBuild) return;
    if (siteBuild.react) { paintReactLive(); return; }
    siteBuild.tick++; paintBuildLog();
  }, 1500);
}
function siteBuildStop() { siteBuild = null; if (siteTicker) { clearInterval(siteTicker); siteTicker = null; } }
// ---- React builder: Claude-Code-style "what it did" step rows (live + finished) ----
function stHlCode(t) { return esc(t).replace(/\b(import|from|export|default|function|return|const|let|className)\b/g, '<span class="kw">$1</span>').replace(/(&quot;[^&]*?&quot;)/g, '<span class="str">$1</span>'); }
function stStepRow(o) { // {label, meta, state:'run'|'done'|'wait', body, open}
  // ONE GLYPH COLUMN, FOUR CHARACTERS (owner, 2026-09-07, treatment E). These
  // were a styled dot, a tick, a cross and a ring — two of them drawn in CSS and
  // two as text, so they never sat on one baseline. As characters in the rail's
  // own monospace they line up by construction, and the class names are kept
  // because they are what the state is read by, here and in the guards.
  //
  // A STEP THAT FAILED. There were three states and none of them could say
  // "this did not work", which is why the compile step reported a tick on a
  // build that had just failed to compile.
  const mark = o.state === 'run' ? '<span class="st-step-run">●</span>'
    : o.state === 'done' ? '<span class="st-step-tick">✓</span>'
    : o.state === 'fail' ? '<span class="st-step-fail">✕</span>'
    : '<span class="st-step-wait">○</span>';
  return '<div class="st-step' + (o.open ? ' open' : '') + (o.body ? '' : ' st-step-nobody') + '">' +
    '<div class="st-step-h"' + (o.body ? ' data-steptog' : '') + '><span class="st-step-chev">' + (o.body ? '▶' : '') + '</span>' + mark +
    '<span class="st-step-lbl">' + esc(o.label) + '</span>' + (o.meta ? '<span class="st-step-meta">' + esc(o.meta) + '</span>' : '') + '</div>' +
    (o.body ? '<div class="st-step-b">' + o.body + '</div>' : '') + '</div>';
}
function stFilesBody(files) { return '<div class="st-fchips">' + (files || []).map((f) => '<span class="st-fchip">' + esc(String(f).split('/').pop()) + '</span>').join('') + '</div>'; }
function stImgsBody(imgs) { return '<div class="st-ithumbs">' + (imgs || []).map((im) => '<span class="st-ithumb"><img src="' + esc(im.url) + '" alt="" loading="lazy"><em>' + esc(String(im.prompt || '').slice(0, 70)) + '</em></span>').join('') + '</div>'; }
// THE CODE PANE. `from` is the file line the window starts on (owner, 2026-09-07,
// picking treatment E: "a dense log — line numbers, flush left").
//
// NO GUTTER WITHOUT A TRUE NUMBER. The pane is a WINDOW on the last few thousand
// characters of a file that is still being written, so numbering it from 1 would
// say `1` for what is really line 47 — a lying instrument, pointed at the
// customer's own source. `from` is 0 when nothing upstream could establish it,
// and 0 draws the pane with no numbers rather than inventing them.
//
// HIGHLIGHTED PER LINE, which is not a compromise: `stHlCode`'s string rule is
// non-greedy between two quote entities, so a line-at-a-time pass is if anything
// tighter than one that can run across a newline.
function stCodeBody(txt, cursor, from) {
  const cur = cursor ? '<span class="st-lc-cur"></span>' : '';
  // A NUMBER, NEVER SOMETHING THAT LOOKS LIKE ONE. `Number('47')` is 47 and
  // `Number(['47'])` is 47 too — the recorded coercion, on the value that
  // decides what the gutter claims about the customer's own file.
  const n = typeof from === 'number' && isFinite(from) ? Math.floor(from) : 0;
  if (n < 1) return '<pre class="st-lc">' + stHlCode(txt) + cur + '</pre>';
  const body = String(txt).split('\n')
    .map((l, i) => '<span class="st-lc-n">' + (n + i) + '</span>' + stHlCode(l)).join('\n');
  return '<pre class="st-lc st-lc-num">' + body + cur + '</pre>';
}
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
  // "1 files" — visible the moment the rail went monospace and the meta stopped
  // being a right-aligned column nobody read. The images row directly below has
  // pluralised correctly since it was written; this one never did.
  const nFiles = (b.files && b.files.length) || 0;
  rows.push(stStepRow({ label: 'Wrote the code', meta: nFiles ? nFiles + (nFiles === 1 ? ' file' : ' files') : '', state: 'done', body: stFilesBody(b.files) }));
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
// THE PHASES A BUILD MOVES THROUGH, IN ORDER, READ BY NAME AND NEVER BY NUMBER.
// Hoisted out of `reactLiveStepsHTML` (2026-09-07) because `setBuildPhase` below
// needs the same list to refuse a backwards move, and two copies of an ordered
// vocabulary is the recorded "two lists of the same thing" on the list most
// likely to grow.
//
// `planning` IS NEW AND IT IS THE FIRST HONEST WORD THIS SCREEN HAS SAID. A build
// spends its first minutes designing the site, claiming the address, making the
// database and merging the look — and `reactSend` used to set `generating` before
// the POST even left, so the panel said "Writing the code" over a design call and
// the code pane sat empty underneath it. That one line is most of what the owner
// saw. The screen cannot know more than this during that window — the build POST
// holds the socket until the generation is fired — but it can at least not lie.
const ST_PHASE_ORDER = ['planning', 'generating', 'compiling', 'fixing', 'publishing', 'database'];

// IS A BUILD ACTUALLY RUNNING? ONE QUESTION, ASKED BY EVERY DISPLAY THAT SHOWS
// BUILD PROGRESS (2026-09-08, owner: "it shows that screen to the right
// everytime, even if its just talking back, that should only be on the build
// step").
//
// `siteBuildStart` runs the instant a message is sent — before the router has
// said whether "hey" is a build at all — so `siteBusy && siteBuild.react` is
// true for EVERY message on a new project. `thinking` is the state it starts
// in, and it leaves that state in exactly one place: `reactSend`, under a
// comment that says "WE KNOW IT IS A BUILD NOW". That is the signal.
//
// The rail has always asked it. The stage panel beside it never did, and gated
// on `siteBusy` instead — so a greeting drew a four-stage Design·Code·Compile·
// Publish rail over the whole right-hand side while the rail one pane over
// correctly said "Thinking". Two halves that can be painted apart will
// eventually disagree — which is the comment already written at the panel's own
// call site, about the layer below this one. A second way of asking this is a
// second thing that can disagree with the rail, so there is one.
//
// NAMED POSITIVELY — A BUILD IS RUNNING WHEN IT IS IN A PHASE THE ORDER KNOWS,
// and that is not a style choice. Written as `rphase !== 'thinking'` this
// answered TRUE for a build carrying no phase at all, which is the opposite of
// the rule the comment above claims: cannot-tell must read as the earliest
// state, never as work in flight. Found by driving it rather than reading it.
//
// `thinking` is deliberately absent from `ST_PHASE_ORDER`, which is the same
// fact `setBuildPhase`'s own `next < 0` wall rests on — so asking the list is
// asking the one question, and junk, an empty object and `thinking` all answer
// alike without any of them being spelled here.
function stBuildRunning() {
  return !!siteBuild && ST_PHASE_ORDER.indexOf(siteBuild.rphase) >= 0;
}

// THE ONE WRITER OF THE LIVE PHASE, and it refuses three things.
//
// A FOREIGN ORIGIN: the customer may have opened another site while this build
// runs, and a poll that lands then must not repaint somebody else's workspace.
//
// A WORD IT DOES NOT KNOW: `indexOf` answers -1 for one, and `Math.max(0, -1)`
// downstream would snap the display back to the first step — the magic-index
// hazard the comment inside `reactLiveStepsHTML` already warns about, reached
// from the outside.
//
// AND A BACKWARDS MOVE, which is the one that is not obvious: the build is polled
// every six seconds and two answers can land out of order, so a stale one must
// never un-say what the customer has already been told. Compared by INDEX, never
// by string — a string comparison here is an ordering that only looks like one.
function setBuildPhase(origin, ph) {
  if (!siteBuild || siteOpenId !== origin) return false;
  if (typeof ph !== 'string') return false;
  const next = ST_PHASE_ORDER.indexOf(ph);
  // THIS REFUSAL IS INERT TODAY AND STAYS, and the reason is worth writing down
  // rather than rediscovering. A sweep cut it and no test moved, so I drove all
  // 126 reachable (current, incoming) pairs both ways: the answers are identical,
  // because `indexOf` gives -1 for a word the list does not have and the clamp
  // below refuses every -1 already. It is not dead code — it is the wall that
  // becomes load-bearing the moment the clamp is loosened to `next < now`, when a
  // build sitting on `thinking` (deliberately not in the list, so -1 as well)
  // would accept any nonsense as its next phase. Kept as the second wall, said
  // out loud, and NOT pretended to be covered by a guard.
  if (next < 0) return false;
  const now = ST_PHASE_ORDER.indexOf(siteBuild.rphase);
  if (next <= now) return false;
  siteBuild.rphase = ph;
  paintReactLive();
  return true;
}
/**
 * THE CODE THE BUILD IS WRITING, onto this workspace's own build.
 *
 * The phase setter's rules, for the phase setter's reasons: a foreign origin
 * never repaints somebody else's screen, and nothing repaints unless something
 * changed — this is asked on every poll, and rewriting the DOM every six
 * seconds for identical text is work with no answer.
 *
 * IT NEVER CLEARS. A poll that carries no code means the container has not
 * sent since the last one — a quiet model, a failed courtesy call, a phase
 * that has moved on — and blanking the panel for any of those would make a
 * working generation flicker. The code leaves the screen when the step does.
 */
function setBuildCode(origin, got) {
  if (!siteBuild || siteOpenId !== origin) return false;
  if (!got || typeof got.code !== 'string' || !got.code) return false;
  if (siteBuild.code === got.code && siteBuild.file === got.file) return false;
  siteBuild.code = got.code;
  if (typeof got.file === 'string') siteBuild.file = got.file;
  // 0 IS KEPT AS 0, never left at the previous update's number: a window that
  // moved and a number that did not is exactly the wrong pairing.
  siteBuild.codeLine = typeof got.line === 'number' && got.line >= 1 ? got.line : 0;
  paintReactLive();
  return true;
}
// "4m 12s" / "48s" — the elapsed clock on the running row and in the stage panel.
function stAgo(ms) {
  const t = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  return t < 60 ? t + 's' : Math.floor(t / 60) + 'm ' + (t % 60) + 's';
}
// Live steps while a React build/revise streams (reads siteBuild).
function reactLiveStepsHTML() {
  const sb = siteBuild || {};
  // NOTHING CLAIMS TO BE HAPPENING YET. Carries `st-steps-live` because that is
  // the selector `paintReactLive` swaps — without it the transition from
  // thinking to the real steps would never repaint, which is invisible in the
  // markup and total at runtime.
  // WAITING IS NOT THINKING (stage 3b): a queued job refused by its site's
  // lock or a deploy's gate says so, in the sentence the poll module chose.
  if (!stBuildRunning()) return '<div class="st-steps st-steps-live"><div class="st-think"><i></i>' + (sb.waitNote ? esc(sb.waitNote) : 'Thinking') + '</div></div>';
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
  const order = ST_PHASE_ORDER;
  const idx = Math.max(0, order.indexOf(sb.rphase || order[0]));
  const st = (name) => { const i = order.indexOf(name); return i < idx ? 'done' : i === idx ? 'run' : 'wait'; };
  // BY NAME, NOT BY NUMBER. These were `idx > 0`, `idx > 2`, `idx >= 4` — magic
  // indices into the array above, so removing one phase from it silently
  // re-pointed all of them at the wrong step. Named, the list can change without
  // the labels quietly following it.
  const past = (name) => order.indexOf(name) < idx;
  const reached = (name) => order.indexOf(name) <= idx;
  const rows = [];
  // THE CLOCK GOES ON THE RUNNING ROW AND NOWHERE ELSE. A time beside work that
  // has not started is the same lie the images row was removed for — a step
  // reporting what was planned rather than what happened.
  const clk = (name) => (st(name) === 'run' && sb.startedAt ? stAgo(Date.now() - sb.startedAt) : '');
  rows.push(stStepRow({ label: past('planning') ? 'Planned your site' : 'Planning your site', meta: clk('planning'), state: st('planning') }));
  // NO BODY, AND THE EMPTY PANE IS GONE WITH IT (2026-09-07). This row carried
  // `open: true` and a `stCodeBody` fed from `siteBuild.code`, which is written
  // only by `readReactStream` — reachable only from an NDJSON response the site
  // build route has never sent. So `stCodeBody('', true)` rendered exactly an
  // empty bordered box with one blinking caret, for the whole build. It was not
  // an unfed placeholder: it was a real control whose source could not ever be
  // non-empty. The owner saw it for seventeen minutes and asked what it was.
  // THE CODE, WHEN THERE IS CODE (2026-09-07, owner: "send the code out as it
  // writes"). `sb.code` is filled by the build poll from what the container
  // sends while the model writes; the row opens only when something has
  // actually arrived, so the empty bordered box with one blinking caret — the
  // thing that stood here for a seventeen-minute build — cannot render.
  const wrote = past('generating');
  const codeNow = !wrote && typeof sb.code === 'string' && sb.code ? sb.code : '';
  // THE FILE GOES IN THE LABEL, NOT THE META (treatment E). It was
  // `clk(...) || sb.file`, and the clock is never empty while the stage runs —
  // so the name was carried the whole way down the chain and then never had a
  // slot to render in. Here it is part of the sentence: `writing index.tsx`.
  const codeLbl = wrote ? 'Wrote the code' : (sb.file ? 'Writing ' + sb.file : 'Writing the code');
  rows.push(stStepRow({
    label: codeLbl,
    meta: clk('generating'),
    state: st('generating'),
    open: !!codeNow,
    body: codeNow ? stCodeBody(codeNow, true, sb.codeLine) : '',
  }));
  if (sb.images && sb.images.length) rows.push(stStepRow({ label: 'Generated images', meta: sb.images.length + (sb.images.length === 1 ? ' photo' : ' photos'), state: 'done', body: stImgsBody(sb.images) }));
  if (sb.rphase === 'fixing') rows.push(stStepRow({ label: 'Fixing a build error', state: 'run' }));
  else rows.push(stStepRow({ label: past('compiling') ? 'Compiled React' : 'Compiling React', meta: clk('compiling'), state: st('compiling') }));
  if (reached('publishing')) rows.push(stStepRow({ label: past('publishing') ? 'Published' : 'Publishing', meta: clk('publishing'), state: st('publishing') }));
  if (sb.rphase === 'database') rows.push(stStepRow({ label: 'Setting up the database', state: 'run' }));
  return '<div class="st-steps st-steps-live">' + rows.join('') + '</div>';
}
// ── B1: the stage panel IS the display (owner, 2026-09-07: "OK B1") ─────────
//
// The panel that holds this is the biggest thing on the screen and for a
// seventeen-minute build it held a spinner and the word "Thinking…". It now
// carries, in one composition: the stages already finished as chips with the
// time each took, the current stage as the hero, a line saying what that stage
// is doing, the elapsed clock, and a four-segment rail under a four-word legend.
//
// ONE FUNCTION, TWO CALL SITES — the workspace's own render and `paintReactLive`.
// That is the whole point: the label and the rail lived in different places and
// only one of them was ever repainted, so the panel said "Thinking…" while the
// thread said "Writing the code". Two halves that cannot be painted apart cannot
// disagree.
const ST_STAGE_STEPS = [
  { p: 'planning',   leg: 'Design',   chip: 'Designed' },
  { p: 'generating', leg: 'Code',     chip: 'Wrote the code' },
  { p: 'compiling',  leg: 'Compile',  chip: 'Compiled' },
  { p: 'publishing', leg: 'Publish',  chip: 'Published' },
];
// HOW FULL THE RUNNING SEGMENT IS, AND WHY IT CAN NEVER BE FULL.
//
// Within a stage we do not know how far along we are — the generation's text
// never leaves its container until it is finished — so this is elapsed time
// against a rough sense of how long that stage runs. It approaches 92% and stops.
// A segment that reached the end would be claiming the stage had finished, which
// is a claim only the build gets to make; a progress display that invents
// progress is a lying instrument, and this one has to be honest for a quarter of
// an hour at a stretch.
const ST_STAGE_TYPICAL_MS = 4 * 60 * 1000;
function stStageFill(ms) {
  const t = Math.max(0, Number(ms) || 0);
  return Math.min(0.92, t / ST_STAGE_TYPICAL_MS);
}
function buildStageHTML() {
  const sb = siteBuild || {};
  const idx = Math.max(0, ST_PHASE_ORDER.indexOf(sb.rphase || ST_PHASE_ORDER[0]));
  const at = (p) => ST_PHASE_ORDER.indexOf(p);
  const el = sb.startedAt ? Date.now() - sb.startedAt : 0;
  // THE CHIPS ARE DERIVED FROM WHAT IS ACTUALLY PAST, never a fixed pair: a build
  // that has only just started shows none, and each one appears as its stage ends.
  const chips = ST_STAGE_STEPS.filter((x) => at(x.p) < idx)
    .map((x) => '<span class="st-bchip">✓ ' + esc(x.chip) + '</span>').join('');
  const segs = ST_STAGE_STEPS.map((x) => {
    const i = at(x.p);
    const w = i < idx ? 1 : i === idx ? stStageFill(el) : 0;
    return '<i style="--w:' + Math.round(w * 100) + '%"></i>';
  }).join('');
  const legs = ST_STAGE_STEPS.map((x) => '<span>' + esc(x.leg) + '</span>').join('');
  return '<div class="st-b1">' +
    (chips ? '<div class="st-bchips">' + chips + '</div>' : '') +
    '<div class="st-building-t">' + esc(reactStageLabel()) + '</div>' +
    '<div class="st-bsub">' + esc(reactStageDetail()) + '</div>' +
    '<div class="st-bclock">' + esc(sb.startedAt ? stAgo(el) : '') + '</div>' +
    '<div class="st-brail">' + segs + '</div>' +
    '<div class="st-bleg">' + legs + '</div>' +
  '</div>';
}
// IS THE STAGE SHOWING A BUILD, AND WHAT DOES THAT PANEL LOOK LIKE — asked in
// the full render and in `paintReactLive`, and that pair is the whole of this
// change (2026-09-10, owner: "WHEN IT STARTS NOTHING APPEARS IN THE BIG SCREEN,
// IT WOULD ONLY APPEAR IF I CLICK A BUTTON AND THEN PRESS PREVIEW AGAIN").
//
// The two comments above record unifying the DRAWING and then the QUESTION the
// rail asks. This is the same lesson one gate further out: the question the
// STAGE asks was still spelled inline on the render's own line, so the live
// painter could only ever UPDATE a panel the render had already drawn and could
// never CREATE one. On a first build the render runs while the phase is still
// `thinking` — deliberately absent from `ST_PHASE_ORDER`, so `stBuildRunning()`
// is false — the stage falls through to "Describe your site on the left", and
// `reactSend` sets the phase a moment LATER. Nothing renders the workspace
// again until the build ends, so `paintReactLive` found no `.st-b1`, skipped,
// and the invitation sat there for the whole build. Only a re-render somebody
// triggered by hand converted it, which is what "click a button and then press
// Preview again" is. A drawing shared between two call sites is not shared
// until the DECISION is too.
//
// `!isReact` STAYS, and it is why this takes the site rather than reading a
// global: on a site that has already built, the stage holds the live preview
// iframe, and painting a build panel over it would tear that iframe down and
// reload it mid-edit — which the render's own branch says a revise must not do.
function stStageBuilding(site) {
  return !!(siteBusy && siteBuild && siteBuild.react
    && !(site && site.react && site.url) && stBuildRunning());
}
function stBuildFrameHTML(site) {
  const active = siteActivePage(site);
  return '<div class="st-frame"><div class="st-frame-bar"><span class="st-frame-url">' +
    esc(siteChipUrl(site, active && active.path)) + '</span></div>' +
    '<div class="st-building">' + buildStageHTML() + '</div></div>';
}
// WHAT THE CURRENT STAGE IS ACTUALLY DOING — the line under the hero, and the
// body of the expanded row. Its own sentences, NOT `budgetNote`'s: those read
// "This build ran out of time before your data model was ready", which is the
// DEADLINE sentence. The stage names match, which is exactly what makes reusing
// it tempting and what makes it the worst available lie — a running build told
// it has already failed.
function reactStageDetail() {
  const p = (siteBuild && siteBuild.rphase) || ST_PHASE_ORDER[0];
  return {
    thinking: 'Working out what you asked for.',
    planning: 'Designing the site, claiming the address and setting up the database.',
    generating: 'Writing your pages — this is the long one.',
    compiling: 'Turning the pages into an app and checking every route opens.',
    fixing: 'A page did not compile. Trying a fix before publishing.',
    publishing: 'Putting the finished site at its address.',
    database: 'Setting up the tables your site stores things in.',
  }[p] || '';
}
function paintReactLive() {
  const host = document.querySelector('#stThread .st-steps-live');
  if (host) host.outerHTML = reactLiveStepsHTML();
  // AND THE STAGE PANEL, which is the defect this whole change is about. This
  // function rewrote the thread and nothing else, so `.st-building-t` kept the
  // label baked at the last FULL render — which happens while the phase is still
  // `thinking` — and the next full render is the one that ends the build. Hence
  // "Thinking…" on the right for seventeen minutes while the left rail moved.
  // Painting only the label would leave that mechanism intact; the whole
  // composition is swapped, from the one function that builds it.
  //
  // AND IT CREATES THE PANEL WHEN THERE IS NONE, which is the second half and
  // the one the owner saw (2026-09-10). `.st-b1` only exists once a FULL render
  // has drawn the build frame, and on a first build the full render happens
  // while the phase is still `thinking` — so there was nothing to swap, `if
  // (st)` skipped, and the stage kept "Describe your site on the left" until
  // some other action re-rendered the workspace. The site is looked up here
  // rather than passed in because every caller is an event, not a render; it is
  // the same site the render draws (`renderSites` opens `siteById(siteOpenId)`),
  // so this branch gives the answer that render would give — and it is asked
  // only when there is no panel, so the ordinary tick pays nothing for it.
  const stage = document.getElementById('stStage');
  const st = stage && stage.querySelector('.st-b1');
  if (st) st.outerHTML = buildStageHTML();
  else if (stage) {
    const s = siteById(siteOpenId);
    if (stStageBuilding(s)) stage.innerHTML = stBuildFrameHTML(s);
  }
  // THE THREAD IS ONLY DRAGGED DOWN IF IT WAS ALREADY THERE. This repaints on a
  // 1.5s tick now, and yanking the scroll away from somebody reading their own
  // build log every 1.5 seconds is worse than the stale scroll it fixes.
  const th = document.getElementById('stThread');
  if (th && th.scrollHeight - th.scrollTop - th.clientHeight < 80) th.scrollTop = th.scrollHeight;
}
function reactStageLabel() {
  const p = (siteBuild && siteBuild.rphase) || 'generating';
  // No `images` entry — see reactLiveStepsHTML. Nothing sets that phase, so the
  // label was unreachable and said something untrue if it ever were reached.
  return { thinking: 'Thinking…', planning: 'Planning your site…', generating: 'Writing the code…', compiling: 'Compiling your app…', fixing: 'Fixing a build error…', publishing: 'Publishing…', database: 'Setting up the database…' }[p] || 'Building…';
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
    //
    // `picker` IS WHICH MODEL DECIDES, and it was missing for as long as the
    // route has existed. The build, the revise and the edit all send it; this
    // one did not, and `modelsFor(undefined)` falls to `DEFAULT_PICKER` — so
    // every routing call on the platform ran on Grok no matter which model the
    // customer had chosen and no matter what the chip above the send button
    // said. The wiring layer again, and the guard that exists for exactly this
    // bug (`test/picked-model.test.mjs`, written after `routeMessage` took a
    // model and never handed it to `askRequest`) drives the module with a model
    // passed in, so it proved the hop below the break and never this one.
    //
    // It is not only a wrong label. The owner's rule when the cheap ladder came
    // off Haiku was "if grok is picked then that will be it" — the point being
    // that no one provider decides every message, which is what run 93 cost
    // when Anthropic refused on billing and every routing call died in 5.3s.
    // Pinned to the default, the router is that shape again with a different
    // provider in the seat, and a dead one sends every customer to the fallback
    // intent: a build on an empty project, an add-on on a live site.
    body: JSON.stringify({ message: t, site: digest, picker: buildPicker, firstBuild: !!isBuild, brief: brief, qa: qa, answering: !!answering, attached: !!(imgs && imgs.length), slug: site.slug || '', hasSite: !!(site.slug && sitePages(site).length) }),
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
    if (d.intent === 'addon' && site.slug) return siteAddon(site, t, origin, finish, go, d);
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
// ── ONE EDIT IN FLIGHT PER SITE, AND ONE KEY PER ASK ─────────────────────
//
// `editInFlight` is what stops a double submission while the first POST is
// unresolved: a second click before the 202 lands would otherwise be a second
// job with its own key, its own charge and its own publish racing the first.
//
// `editIdem` is the retry key for the ask that is in flight. It is minted when
// the customer asks for something and reused for every retry of THAT POST — a
// key per attempt would defeat the whole mechanism, since the server's
// idempotency is `(uid, slug, op, idem_key)` and a fresh key is by definition a
// new job.
//
// `editBlocked` is the sites whose last edit stopped mid-publish. The server
// refuses those too — `edit_create` answers `needs-review` — and this is the
// half that stops the customer spending a round trip to be told so.
const editInFlight = new Set();
const editIdem = new Map();
const editBlocked = new Set();
// `editWatched` is the jobs this page has a live watch on (stage 2b,
// 2026-09-05). The resume runs on every render of the open workspace, and a
// second watcher on one job would apply the reply twice — the exactly-once
// latch inside a watch is per WATCH, not per job.
const editWatched = new Set();

function siteEdit(site, d, instruction, origin, finish, fallback, imgs, handedOff) {
  const slug = String(site.slug || '');
  if (!slug) return fallback();
  if (editBlocked.has(slug)) { finish('⚠️ ' + EditPoll.outcomeMessage('needs_review')); return; }
  // A SIDEWAYS HOP IS THE SAME ASK. `handedOff` means one lane escalated to
  // another within one message, so it must not be refused as a double
  // submission — it IS the first submission, redirected.
  if (!handedOff) {
    if (editInFlight.has(slug)) return;
    editInFlight.add(slug);
  }
  // ── THE LATCH IS PER ASK. THE KEY IS PER POST. ──────────────────────────
  //
  // These were one statement, and the hop carried the FIRST post's key. That
  // was correct while an escalate created nothing: the sideways hop was the
  // same ask reaching a different lane, and one key for one ask was the honest
  // description. It stopped being true when the queue landed.
  //
  // `edit_create` keys on `(uid, slug, op, idem_key)` and THE LAYER IS NOT IN
  // IT — so a hop reusing the key does not file the cheaper job at all. It
  // matches the row the first post created, comes back `duplicate: true`
  // naming the job that just escalated, and the watcher reads that job's
  // stored escalate straight back. The hop silently becomes a no-op.
  //
  // So: one key per POST, minted where the POST is decided. Two posts in one
  // ask are two jobs, deliberately, because the second is at a rung the first
  // could not reach. What must NOT happen is a mint at the point of use as a
  // fallback for an empty map — that is a second key for a RETRY, which is the
  // double charge the key exists to stop. Absent, the POST carries none and the
  // server refuses with `bad-idem`: a visible refusal rather than a silent
  // double charge, and the right direction to fail in.
  editIdem.set(slug, EditPoll.newIdemKey());
  const idem = editIdem.get(slug);
  const clearFlight = () => { if (!handedOff) editInFlight.delete(slug); };
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
      // AND WHERE IT IS MOVING TO. A string or nothing — the server refuses
      // anything that is not a path, and `renameRoute` owns every refusal that
      // needs to see the site.
      rename: typeof d.rename === "string" ? d.rename : "",
      // WHICH SLOT THE ATTACHED ARTWORK GOES IN — the header, or the browser
      // tab. A real boolean like `remove`, so nothing merely truthy on the wire
      // can send a wide wordmark to a 16-pixel tab and leave the header bare.
      tab: d.tab === true,
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
      // THE RETRY KEY. Ignored entirely while the async flag is off, which is
      // what keeps the synchronous path byte-identical.
      idem: idem,
    }),
  }).then(async (r) => {
    const e = await r.json().catch(() => null);
    // ── A QUEUED EDIT ANSWERS WITH A JOB, NOT AN OUTCOME ─────────────────
    //
    // Flag off, this is never taken and every line below runs as it did. Flag
    // on, the reply is a receipt and the real answer is fetched by polling —
    // and `duplicate` means this exact ask was already filed, so the right move
    // is to watch the ORIGINAL rather than treat it as new.
    if (e && e.ok && e.job && !e.result) {
      clearFlight();
      // THE ASK RIDES THE RECORD (stage 2b, 2026-09-05), with the route that
      // filed the job and the layer and page a sideways hop re-posts with — so
      // a watch resumed after a refresh hops or falls to the revise exactly as
      // this one would, instead of answering that the message was lost. The
      // attachments are not kept: the logo lane's job is already filed.
      EditPoll.rememberJob(slug, e.job, undefined, { ask: instruction, op: 'edit', layer: String(d.layer || ''), page: d.page ? String(d.page) : '' });
      watchEditJob(site, d, e.job, origin, finish, fallback, instruction, imgs);
      return;
    }
    return editAnswer(r && r.ok, e, { site, d, instruction, origin, finish, fallback, imgs, handedOff, clearFlight, slug });
  }).catch((err) => { clearFlight(); return fallback(err); });
}

/**
 * READ ONE EDIT REPLY — the same object, whichever path carried it.
 *
 * The server's own comment on the poll route promises this: "a finished job
 * hands back its stored reply, byte for byte what the synchronous path would
 * have returned… one object, reached two ways". Only one way ever read it.
 * `watchEditJob` had its own tail, and it had already drifted three ways: an
 * escalate rendered as '✅ Done.', a deleted page left in the picker, and an
 * undo neither remembered nor cleared. So the reading is one function now, and
 * the paths differ only where they genuinely differ — how the reply ARRIVED.
 *
 * `httpOk` rather than the Response, because the queued path's `ok` is its
 * poll's and the synchronous path's is its POST's, and both mean the same thing
 * about the reply: a stored 422 says the edit did not compile exactly as an
 * inline 422 does.
 */
function editAnswer(httpOk, e, o) {
  const clearFlight = o.clearFlight || function () {};
  // A body we cannot read is not a refusal — it is us not knowing, and the
  // rung above still works.
  if (!e) { clearFlight(); return o.fallback ? o.fallback() : o.finish('⚠️ ' + EditPoll.outcomeMessage('failed')); }
  if (e.escalate) return escalatedEdit(e, o);
  if (!httpOk || !e.ok) {
    // The server's own sentence when it has one. `buildDownMsg` already knows
    // to drop the "try again in a few seconds" advice on a failure that no
    // amount of retrying fixes.
    clearFlight();
    // A SITE UNDER REVIEW TAKES NO MORE EDITS until somebody establishes
    // whether its last one shipped. The server refuses as well; this stops
    // the customer spending a round trip to find out.
    if (e.error === 'needs-review') { editBlocked.add(o.slug); o.finish('⚠️ ' + EditPoll.outcomeMessage('needs_review')); return; }
    if (e.msg) { o.finish('⚠️ ' + e.msg); return; }
    // NO SENTENCE AND NO ASK IS NOT A REASON TO SPEND. A watch resumed after a
    // refresh has no `fallback` to fall to, and inventing a ~25-credit rewrite
    // there would charge for a message nobody re-typed.
    if (typeof o.fallback !== 'function') { o.finish('⚠️ ' + EditPoll.outcomeMessage('failed')); return; }
    return o.fallback();
  }
  clearFlight();
  return applyEditResult(e, o);
}

/**
 * WHAT A PUBLISHED EDIT CHANGES ON THIS SIDE — one copy, both paths.
 *
 * FOUND THE SAME DAY AND THE SAME WAY AS `escalatedEdit`, which is the point:
 * the queued watcher had its own success handling, and it had already drifted
 * from this one. It bumped the preview and stopped, so a queued edit
 *
 *   * that DELETED a page left that page in the site picker — "told it is gone
 *     and still offered" is the same lie whichever path carried it; and
 *   * that removed ROWS stored no undo, so "put that back" had nothing to refer
 *     to and `siteEdit` sent no `recent` on the next message. The CLEAR was
 *     missing too, which is worse than the offer being absent: a stale undo
 *     from an earlier synchronous edit survived, standing as an offer to re-add
 *     a row that is already back.
 *
 * Neither fails, neither logs, and both are invisible until a customer deletes
 * something. Two copies of one decision, exactly as this repo's own rule warns.
 */
function applyEditResult(e, o) {
  // PUBLISHED. Bump the cache-buster the same way a revise does, or the preview
  // keeps showing the old bundle and the change reads as not applied.
  scheduleCreditRefresh();
  const s = siteById(o.origin);
  if (s) {
    s.previewV = (s.previewV || 0) + 1;
    // REMEMBER WHAT WENT, so the next message can undo it. Replaced by a later
    // removal and CLEARED by an add, because once a row has been put back,
    // carrying it forward is a standing offer to put it back again on an
    // unrelated change.
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
  o.finish(editReply(e) + renderTail(e) + alsoTail(o.d));
}

/**
 * AN ESCALATE IS THE SAME ANSWER WHICHEVER PATH CARRIED IT.
 *
 * The queued reply body IS the synchronous one — the consumer stores exactly
 * what the route returned — so both paths must read it the same way. They did
 * not. `watchEditJob` applied every terminal answer as an outcome, and
 * `editReply` ends `return '✅ Done.'`, so a queued edit that escalated told the
 * customer their change was made, never ran the revise that would have made it,
 * and bumped the preview to show a site that had not changed. A green tick for
 * nothing — the one failure this whole path is written to avoid, and it was
 * live behind the canary flag.
 *
 * ONE FUNCTION, CALLED BY BOTH, because two copies of a decision drift and the
 * drift is silent. Extracted rather than duplicated for exactly that reason.
 *
 * ── ONE HOP SIDEWAYS, THEN UP ─────────────────────────────────────────────
 *
 * A lane that cannot answer may name a CHEAPER one that can: the picture layer
 * cannot insert a `<SafeImage>` and the `page` layer can, so "add a photo to
 * the about page" costs one page instead of the whole-site rewrite `fallback`
 * performs.
 *
 * BOUNDED HERE, NOT TRUSTED FROM THE SERVER, and that is the whole safety
 * argument: `handedOff` allows exactly one, and only to a DIFFERENT layer, so
 * no sequence of server answers can loop between two lanes. A second escalation
 * goes up the ladder.
 */
function escalatedEdit(e, o) {
  const clearFlight = o.clearFlight || function () {};
  // DECIDED IN `edit-poll.js`, ACTED ON HERE. Three outcomes, one of which
  // spends ~25 credits, so the choice between them is driven by a test rather
  // than read out of this file.
  const act = EditPoll.escalateAction(e, {
    handedOff: !!o.handedOff,
    layer: o.d && o.d.layer,
    // THE ASK ITSELF IS WHAT A HOP AND A FALLBACK BOTH NEED, and a watch
    // resumed after a refresh holds neither — only the job id survived in
    // storage.
    hasAsk: !!o.instruction && typeof o.fallback === 'function',
  });
  if (act === 'lost') {
    clearFlight();
    o.finish('⚠️ I couldn’t make that change the cheap way, and I’ve lost the original message. Say it again and I’ll do the full rewrite.');
    return;
  }
  // THE MIDDLE RUNG, when the edit names it: the ask adds something the site
  // does not have, and the addon step is the one that adds (owner, 2026-09-02:
  // "add will always go in addon"). Same sentence, same picker; it falls to
  // the revise below only if the addon itself cannot.
  if (act === 'addon') {
    clearFlight();
    return siteAddon(o.site, o.instruction, o.origin, o.finish, o.fallback, o.d);
  }
  if (act === 'hop') {
    // THE LATCH IS NOT CLEARED HERE. The hop is the same ask continuing, so
    // releasing it would let a second click in while this one is still
    // running — the exact double submission it exists to stop.
    return siteEdit(o.site, { ...(o.d || {}), layer: e.layer, page: e.page ? String(e.page) : (o.d && o.d.page) },
      o.instruction, o.origin, o.finish, o.fallback, o.imgs, true);
  }
  clearFlight();
  return o.fallback();
}

/**
 * WATCH A QUEUED EDIT UNTIL IT ENDS, OR UNTIL THIS BROWSER STOPS LOOKING.
 *
 * ── STOPPING WATCHING IS NOT CANCELLING ───────────────────────────────────
 *
 * Nothing here cancels. A closed tab, a navigation, a flat battery or a dropped
 * connection ends the polling and leaves the work running — it is in a queue
 * consumer, it has been paid for, and the site is mid-edit. Cancelling on a lost
 * connection would throw away work somebody bought because they switched apps.
 * Cancelling is a separate DELETE the server has to confirm; see `cancelEditJob`.
 */
// `answer` IS WHICH READER GETS THE STORED REPLY (2026-09-03). The edit's by
// default; the addon route hands its own, because its stored reply is a
// different object — kinds, added pages, tables — read by a different tail.
// The WATCH is one copy for both routes, which is the point: the poll route,
// the two voices, the exactly-once latch and the bounded retry are the same
// whichever route filed the job, and a second copy of them would drift.
function watchEditJob(site, d, job, origin, finish, fallback, instruction, imgs, answer) {
  const slug = String(site.slug || '');
  const w = EditPoll.makeWatch(job, slug);
  const reader = typeof answer === 'function' ? answer : editAnswer;
  // ONE WATCH PER JOB IN THIS PAGE (stage 2b, 2026-09-05). The resume runs on
  // every render of the open workspace, so a job already being watched would
  // otherwise gain a second watcher, and two watchers apply the reply twice —
  // the exactly-once latch below is per WATCH, not per job. Released when the
  // watch ends, except when it GAVE UP: a render must not start the next four
  // hundred attempts on a job this page has already given up on. The sentence
  // tells the customer to reload, and a reload is what resumes it.
  if (editWatched.has(w.job)) return;
  editWatched.add(w.job);
  const release = () => { editWatched.delete(w.job); };
  const apply = (e, r0) => {
    // ── EXACTLY ONCE ──────────────────────────────────────────────────────
    //
    // A final answer can arrive more than once: a retry that raced the first,
    // a resumed watch after a refresh, two tabs on one job. Applying twice
    // bumps the preview twice, prints the reply twice, and on a `data` edit
    // offers an undo for rows that are already back.
    const once = w.take(e);
    if (!once) return;
    EditPoll.forgetJob(slug);
    release();
    // ── THE SAME READER THE SYNCHRONOUS PATH USES, ON THE SAME OBJECT ─────
    //
    // Including the escalate, which this function briefly checked for itself —
    // and a second copy of the check is the thing the whole extraction exists
    // to remove, so it went the moment `editAnswer` landed. Everything about
    // what the reply MEANS is decided there; all this side knows is that the
    // edit is over.
    //
    // AFTER `w.take`, deliberately. The latch is what makes an answer act once,
    // and an escalate that fires twice is two hops — two jobs for one ask,
    // which is the exact thing the idempotency chain exists to stop.
    //
    // `httpOk` is the POLL's, which for a stored reply IS the edit's own
    // status: a 422 handed back by the poll says the edit did not compile
    // exactly as an inline 422 does.
    return reader(!!(r0 && r0.ok), once, { site, d, instruction, origin, finish, fallback, imgs, handedOff: false, slug });
  };
  const step = async () => {
    let r = null;
    let e = null;
    try {
      r = await apiFetch('/api/site/edit/' + encodeURIComponent(job), { method: 'GET' });
      e = await r.json().catch(() => null);
    } catch (err) { r = null; }
    // ── ONE READING OF THE POLL, AND EVERY BRANCH IS A CASE OF IT ────────
    //
    // This was three separate questions asked of three different things — a
    // retry gate on the status, a 404 on the status again, then `classify` on
    // the BODY — and the third could not see what it needed. A finished job
    // hands back its stored reply, which has no job-state field, so
    // `classify(undefined)` answered `running` and this loop polled a finished,
    // charged, PUBLISHED edit for ever. `wait` has no attempt bound, so it
    // never even gave up. Every queued success and every queued escalate.
    //
    // `readPoll` is one function with the four cases in a stated order, driven
    // by a test. A thrown fetch never reaches it: no response is a poll that
    // failed, which is not an edit that failed.
    const read = r
      ? EditPoll.readPoll(r.status, r.headers && r.headers.get(EditPoll.FINAL_HEADER), e)
      : { act: 'retry' };
    if (read.act === 'retry') {
      w.attempt++;
      // BOUNDED. Past this the job has certainly ended one way or another and
      // the customer is better told we lost sight of it than watched for ever.
      if (w.attempt > 400) { w.stopped = 'gave-up'; finish('⚠️ I lost track of that edit. Reload to pick it back up.'); return; }
      setTimeout(step, EditPoll.pollDelayMs(w.attempt));
      return;
    }
    if (read.act === 'gone') {
      // THE SAME ANSWER A JOB THAT IS NOT YOURS GETS, deliberately, so nothing
      // here can be used to find out whether an id exists. All this side knows
      // is that it can no longer follow the edit.
      EditPoll.forgetJob(slug);
      release();
      w.stopped = 'gone';
      finish('⚠️ I lost track of that edit. Your site is unchanged unless it had already published.');
      return;
    }
    if (read.act === 'wait') {
      w.attempt++;
      // A JOB WAITING BEHIND ANOTHER CHANGE, OR A PLATFORM UPDATE, SAYS SO
      // (stage 3b): the sentence replaces "Thinking" in the live steps for as
      // long as the poll says `waiting`, and the ordinary poll paints nothing.
      const waitNote = EditPoll.waitingMessage(e);
      if (siteBuild && siteOpenId === origin && (siteBuild.waitNote || '') !== waitNote) { siteBuild.waitNote = waitNote; paintReactLive(); }
      setTimeout(step, EditPoll.pollDelayMs(w.attempt));
      return;
    }
    // THE STORED REPLY. What it MEANS is `editAnswer`'s to decide; this side
    // only knows the edit is over.
    if (read.act === 'reply') { apply(e, r); return; }
    // AND `ended` IS THE JOB DESCRIBING ITSELF — the branch taken when there is
    // no stored reply to hand back at all: lost, cancelled, under review.
    if (w.take(true) === null) return;
    EditPoll.forgetJob(slug);
    release();
    if (read.kind === 'needs_review') editBlocked.add(slug);
    scheduleCreditRefresh();
    // THE SERVER'S OWN SENTENCE WHEN IT WROTE ONE FOR A CUSTOMER TO READ, and a
    // fixed one otherwise. Never `kind`, never `phase`, never a provider
    // message — the poll route has nowhere to put one, and this is the side
    // that renders, so the choice is made here rather than trusted from there.
    finish('⚠️ ' + ((e && typeof e.msg === 'string' && e.msg) || EditPoll.outcomeMessage(read.kind)));
  };
  setTimeout(step, EditPoll.pollDelayMs(0));
}

/**
 * ASK THE SERVER TO STOP. Only the server can say it stopped.
 *
 * `cancelled` is displayed when the server confirms it and at no other time —
 * an aborted fetch here means this browser gave up asking, which says nothing
 * about the job. And a refusal because publishing has started is not an error:
 * the edit is going to land, so the right move is to keep watching.
 */
// `instruction` and `imgs` are carried, not used here: a cancel that is refused
// or unconfirmed goes back to WATCHING, and a watch without the ask can neither
// hop sideways nor fall back when the answer turns out to be an escalate.
function cancelEditJob(site, d, job, origin, finish, fallback, instruction, imgs) {
  const slug = String(site.slug || '');
  return apiFetch('/api/site/edit/' + encodeURIComponent(job), { method: 'DELETE' })
    .then(async (r) => {
      const e = await r.json().catch(() => null);
      if (EditPoll.isCancelTooLate(r.status, e)) { watchEditJob(site, d, job, origin, finish, fallback, instruction, imgs); return 'too-late'; }
      if (!EditPoll.isCancelConfirmed(e)) { watchEditJob(site, d, job, origin, finish, fallback, instruction, imgs); return 'unconfirmed'; }
      // The job is not finished the moment a cancel is accepted — the consumer
      // sees it at its next boundary — so this keeps watching for the terminal
      // state rather than announcing one it has not been told about.
      watchEditJob(site, d, job, origin, finish, fallback, instruction, imgs);
      return 'requested';
    })
    // A FAILED CANCEL IS NOT A CANCEL. Keep watching; the edit is still running.
    .catch(() => { watchEditJob(site, d, job, origin, finish, fallback, instruction, imgs); return 'unconfirmed'; });
}

/**
 * PICK BACK UP AFTER A REFRESH. A queued edit outlives the page that started
 * it, so the alternative to resuming is the customer sending a second one.
 *
 * THE ASK COMES BACK WITH THE JOB (stage 2b, 2026-09-05). The record the two
 * enqueue sites write carries the customer's own words, which route filed the
 * job, and the layer and page a sideways hop re-posts with — so an escalate
 * read after a reload hops or falls to the revise exactly as it would have
 * before the reload, instead of answering that the message was lost. A record
 * written before the ask was stored still resumes: with no ask and no
 * fallback, `escalatedEdit` reads that as its own `lost` case and says so,
 * because falling straight through to `fallback` would start a ~25-credit
 * rewrite on page load for a sentence nobody re-typed. The attachments are
 * gone with the page either way.
 *
 * WIRED SINCE STAGE 2b: `resumeOpenSite` below calls it for the open
 * workspace, once per job — `editWatched` is the latch, so a render never
 * puts a second watcher on a job this page is already watching.
 */
function resumeEditJob(site, origin, finish, fallback) {
  const slug = String(site.slug || '');
  const rec = EditPoll.resumableRecord(slug);
  if (!rec) return false;
  if (editWatched.has(rec.job)) return false;
  const d = { layer: rec.layer, page: rec.page };
  // THE READER THE ROUTE THAT FILED IT USES: an addon's stored reply is a
  // different object — kinds, added pages, tables — read by a different tail.
  const reader = rec.op === 'addon' ? addonAnswer : editAnswer;
  // THE ASK, WHEN THE RECORD HAS ONE — and the fallback only beside it: the
  // revise runs on the ask, and a fallback with no ask is a rewrite of nothing
  // in particular.
  const ask = rec.ask || '';
  watchEditJob(site, d, rec.job, origin, finish, ask ? fallback : undefined, ask || undefined, undefined, reader);
  return true;
}
/**
 * THE OPEN WORKSPACE RESUMES ITS SITE'S JOB before it is drawn — `renderSites`
 * calls this for the open site, so the step rows show a change in flight and
 * the send box refuses a second edit on the site until it ends, as they did
 * before the refresh. `finish` is the send path's own tail: the reply onto the
 * thread, saved, the workspace re-drawn. The fallback is the revise
 * `siteRoute`'s `go` would have run, on the ask the record kept, without the
 * attachments a refresh lost.
 *
 * NOTHING HAPPENS while the site is busy (an edit filed in this page is
 * already watched), and nothing happens twice: `resumeEditJob` refuses a job
 * this page is watching, and a job the page GAVE UP on stays latched, so the
 * next render does not start another four hundred attempts — the sentence
 * says to reload, and a reload is what resumes it. Busy is set only once a
 * watch really started, or a site with nothing to resume would be stuck busy.
 */
function resumeOpenSite(site) {
  if (!site || !site.slug || siteBusy) return false;
  const origin = site.id;
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
  const rec = EditPoll.resumableRecord(String(site.slug));
  const go = () => reactSend(site, rec ? rec.ask : '', origin, 'revise', [], finish, []);
  if (!resumeEditJob(site, origin, finish, go)) return false;
  siteBusy = true;
  siteBuildStart(true);
  return true;
}
// The middle rung: add a page or a table, keep everything else.
//
// Same contract as `siteEdit` — every failure falls through to the revise, and
// an escalation is never surfaced as an error — but this one CAN take a while
// (a model call plus a container build), so the step rows stay running rather
// than being stopped the way a question stops them.
// `d` IS THE ROUTING DECISION, carried only for `alsoAsked` — the second thing
// they asked for, which this turn is not doing. It is optional so nothing that
// calls this without one changes shape.
function siteAddon(site, instruction, origin, finish, fallback, d) {
  const slug = String(site.slug || '');
  if (!slug) return fallback();
  // ONE KEY PER POST, minted where the POST is decided — `siteEdit`'s rule.
  // Ignored entirely while the async flag is off, which is what keeps the
  // synchronous path byte-identical; on, it is what stops a retry after a lost
  // 202 from filing a second charged addition.
  const idem = EditPoll.newIdemKey();
  apiFetch('/api/site/' + encodeURIComponent(slug) + '/addon', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    // `tz` IS THE OWNER'S ZONE (2026-09-03): a scheduled job's clock time
    // ("every day at 09:00") is read in it, and only the browser knows it.
    body: JSON.stringify({ instruction: instruction, picker: buildPicker, idem: idem, tz: browserTimeZone() }),
  }).then(async (r) => {
    const a = await r.json().catch(() => null);
    // ── A QUEUED ADDON ANSWERS WITH A JOB, NOT AN OUTCOME (2026-09-03) ────
    //
    // Run 21: the first live addon was reset at 257.6s on the customer's
    // connection, so the route files a job the way the edit route does and
    // answers with the same receipt. Watched by the same watcher — the poll
    // route, the two voices and the exactly-once latch are one copy for both
    // — and read, when the stored reply lands, by this route's own reader.
    if (a && a.ok && a.job && !a.result) {
      // THE ASK RIDES THE RECORD with the route that filed it (stage 2b), so a
      // watch resumed after a refresh reads the reply with THIS route's reader
      // and can re-post the ask on a hop — `siteEdit`'s rule, one rung up.
      EditPoll.rememberJob(slug, a.job, undefined, { ask: instruction, op: 'addon', layer: d && typeof d.layer === 'string' ? d.layer : '', page: d && d.page ? String(d.page) : '' });
      watchEditJob(site, d, a.job, origin, finish, fallback, instruction, undefined, addonAnswer);
      return;
    }
    return addonAnswer(r && r.ok, a, { site, d, instruction, origin, finish, fallback, slug });
  }).catch(fallback);
}

/**
 * READ ONE ADDON REPLY — the same object, whichever path carried it.
 *
 * The `editAnswer` shape one rung down, for the same reason: the queued reply
 * body IS the synchronous one, the consumer stores exactly what the route
 * returned, and a tail that only the synchronous path ran would be a second
 * copy the moment the queue carried the first. Everything about what the
 * reply MEANS — escalate, refusal, applied — is decided here, once.
 *
 * `httpOk` is the response's own, which for a stored reply IS the addon's
 * status: a 422 handed back by the poll says the addition did not compile
 * exactly as an inline 422 does.
 */
function addonAnswer(httpOk, a, o) {
  // THE REVISE, when there is an ask to re-post. A watch resumed after a
  // refresh holds only the job id, and starting a ~25-credit rewrite there
  // would charge for a sentence nobody re-typed — `escalatedEdit` reads that
  // as its own case and says so; this does the same, in its own words.
  const canFall = typeof o.fallback === 'function' && !!o.instruction;
  const fall = () => (canFall ? o.fallback() : o.finish('⚠️ ' + EditPoll.outcomeMessage('failed')));
  if (!a) return fall();
  if (a.escalate) {
    // ONE HOP SIDEWAYS, when the addon names a cheaper rung that does this
    // (2026-09-02): "add a photograph" is the picture rung's job, and the
    // add step says so with the layer's name. Same sentence, same picker,
    // handed to the edit route with the hop already spent — the addon route
    // never escalates back here, so this cannot loop. An escalate that names
    // no layer, or names the addon itself, still falls to the revise.
    var layer = typeof a.layer === 'string' ? a.layer : '';
    if (!canFall) { o.finish('⚠️ I couldn’t add that the cheap way, and I’ve lost the original message. Say it again and I’ll do the full rewrite.'); return; }
    if (layer && layer !== 'addon') {
      return siteEdit(o.site, { ...(o.d || {}), layer: layer, page: a.page ? String(a.page) : (o.d && o.d.page) }, o.instruction, o.origin, o.finish, o.fallback, undefined, true);
    }
    return fall();
  }
  if (!httpOk || !a.ok) {
    if (a.msg) { o.finish('⚠️ ' + a.msg); return; }
    return fall();
  }
  return applyAddonResult(a, o);
}

/** WHAT A PUBLISHED ADDITION CHANGES ON THIS SIDE — one copy, both paths. */
function applyAddonResult(a, o) {
  const d = o.d;
  const finish = o.finish;
  scheduleCreditRefresh();
  const s = siteById(o.origin);
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
    // A NEW TABLE HAS TO REACH THE ROUTER'S DIGEST the same way a new page
    // reaches the picker — the addon is the lane that ADDS tables, and a
    // digest that never learns them keeps routing "where do my bookings
    // go?" blind. Union like the build path: the response names what this
    // addon touched, not the whole site.
    const tnames = (Array.isArray(a.tables) ? a.tables : []).filter((x) => typeof x === 'string' && x);
    if (tnames.length) s.tables = [...new Set([...(Array.isArray(s.tables) ? s.tables : []), ...tnames])].slice(0, 48);
    sitesSave();
  }
  finish(addonReplyText(a) + renderTail(a) + alsoTail(d));
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
  const cut = rel.lastIndexOf('/');
  const dir = cut < 0 ? '' : rel.slice(0, cut + 1);
  const segs = (cut < 0 ? rel : rel.slice(cut + 1)).split('.').filter(Boolean).map((s) => s.replace(/_$/, ''));
  if (segs.some((s) => s.charAt(0) === '_')) return '';
  if (segs[segs.length - 1] === 'index') segs.pop();
  return '/' + (dir + segs.join('/')).replace(/\/$/, '');
}
// What the addon did, naming the pages — including the one they did not ask
// about. The nav link is a page this lane touches on its own, and not saying so
// is how a legitimate change reads as the site being altered behind them.
/** A scheduled job as a customer reads it: its name and how often it runs. */
// What an import did, as one sentence — the reply's counts and its first
// named problem, because "Imported 118 of 120" without WHICH two is a number
// the owner cannot act on.
function importWords(d) {
  const kept = Number(d && d.kept) || 0;
  const bits = ['Imported ' + kept + (kept === 1 ? ' row.' : ' rows.')];
  const problems = Array.isArray(d && d.problems) ? d.problems : [];
  if (problems.length) {
    const first = problems[0];
    bits.push(problems.length + (problems.length === 1 ? ' row skipped' : ' rows skipped') +
      (first && first.line ? ' — line ' + first.line + ': ' + (first.reason || 'not usable') : '') + '.');
  }
  if (Array.isArray(d && d.ignored) && d.ignored.length) bits.push('Ignored columns: ' + d.ignored.join(', ') + '.');
  if (Number(d && d.truncated) > 0) bits.push(d.truncated + ' rows past the 5,000 cap were left out.');
  if (d && d.stopped) bits.push('Stopped at line ' + d.stopped + ' — try again from there.');
  return bits.join(' ');
}
function jobWords(j) {
  if (!j || typeof j !== 'object' || !j.name) return '';
  const m = Number(j.everyMinutes);
  const every = !Number.isFinite(m) || m <= 0 ? ''
    : m % 10080 === 0 ? (m === 10080 ? 'every week' : 'every ' + (m / 10080) + ' weeks')
    : m % 1440 === 0 ? (m === 1440 ? 'every day' : 'every ' + (m / 1440) + ' days')
    : m % 60 === 0 ? (m === 60 ? 'every hour' : 'every ' + (m / 60) + ' hours')
    : 'every ' + m + ' minutes';
  // A CLOCK TIME (2026-09-03): "every day at 09:00", in the zone the job was
  // added from — the owner's own, so it is said only when it differs from
  // the browser's now.
  const at = typeof j.at === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(j.at)
    ? ' at ' + j.at + (typeof j.tz === 'string' && j.tz && j.tz !== browserTimeZone() ? ' (' + j.tz + ')' : '')
    : '';
  return j.name + (every ? ' (' + every + at + ')' : '');
}
/** The browser's IANA zone, or '' where it cannot say. Sent with an addon so a job's clock time is the owner's. */
function browserTimeZone() {
  try { return String(Intl.DateTimeFormat().resolvedOptions().timeZone || ''); } catch (e) { return ''; }
}
function addonReplyText(a) {
  // THE SWEEP'S REPLY, BEFORE ANYTHING IS COUNTED (stage 2a, 2026-09-05) —
  // the same rule `editReply` has, because an addon job that committed and
  // died before its finalize is finalized by the same sweep with the same
  // reply, and this is the reader its watcher hands it to. Counted, it would
  // read as '✅ Done.' with every list empty.
  if (EditPoll.isRecovered(a)) return EditPoll.outcomeMessage('recovered');
  const added = (Array.isArray(a.added) ? a.added : []).map(sitePathOf).filter(Boolean);
  const changed = (Array.isArray(a.changed) ? a.changed : []).map(sitePathOf).filter(Boolean);
  const removed = (Array.isArray(a.removed) ? a.removed : []).map(sitePathOf).filter(Boolean);
  const bits = [];
  if (added.length) bits.push('added ' + added.join(', '));
  if (removed.length) bits.push('removed ' + removed.join(', '));
  // WHAT A CHANGED PAGE MEANS DEPENDS ON WHETHER A PAGE WAS ADDED (run 35,
  // 2026-09-04). Beside a new page it is the nav link — "linked it from /" —
  // and on its own it is the page the addition landed on: a section, a code,
  // a scene or a hand-written component changes the page it sits on and adds
  // no page, and "linked it from /" then names a link that does not exist.
  if (changed.length) bits.push((added.length ? 'linked it from ' : 'updated ') + changed.join(', '));
  if (Array.isArray(a.tables) && a.tables.length) bits.push('now storing ' + a.tables.join(', '));
  // THE OTHER THREE TIERS OF THE BACKEND (2026-09-03): what the engine
  // really made, by name — a function a page can call, an outside service
  // the platform reads for it, a job on a timer — and, once, that the site
  // got its own database for it.
  if (Array.isArray(a.functions) && a.functions.length) bits.push('added the function' + (a.functions.length > 1 ? 's ' : ' ') + a.functions.join(', '));
  if (Array.isArray(a.apis) && a.apis.length) bits.push('connected ' + a.apis.join(', '));
  if (Array.isArray(a.jobs) && a.jobs.length) bits.push('scheduled ' + a.jobs.map(jobWords).filter(Boolean).join(', '));
  let out = bits.length ? '✅ Done — ' + bits.join(', ') + '.' : '✅ Done.';
  if (a.provisioned === true) out += ' Your site has its own database now.';
  // A FUNCTION THE DATABASE REFUSED IS SAID, with its own reason: the rest
  // of the addition landed, and "added the function" would be a lie for
  // this one. The server names it in `functionErrors`, never in `functions`.
  for (const fe of (Array.isArray(a.functionErrors) ? a.functionErrors : []).slice(0, 3)) {
    if (!fe || !fe.name) continue;
    out += ' The function ' + fe.name + ' couldn’t be created' + (fe.error ? ' — ' + String(fe.error).slice(0, 140) : '') + '.';
  }
  // A CONNECTION WITH A KEY TO PASTE IS SAID, and where: it answers nothing
  // until the owner's own key is in the vault.
  if (Array.isArray(a.needsSecrets) && a.needsSecrets.length) {
    out += ' To switch it on, add ' + a.needsSecrets.join(', ') + ' under Cloud → Secrets.';
  }
  out += photoNote(a.photos);
  // A KIND SET ASIDE IS SAID (2026-09-02): a photograph asked for beside a
  // page is the picture rung's job and did not ride this addition, so the
  // customer is told to ask for it on its own rather than left looking for it.
  if (Array.isArray(a.skipped) && a.skipped.indexOf('photo') >= 0) {
    out += ' The photograph is a separate step — ask for it on its own and I’ll place it.';
  }
  // AN ENTRY LEFT OUT OF A LIST IS SAID, with the server's own reason: a
  // message may add several pages or components at once, and one refused
  // among them must not read as added.
  for (const n of (Array.isArray(a.notAdded) ? a.notAdded : []).slice(0, 3)) {
    if (!n || !n.msg) continue;
    out += ' I left out ' + (n.name ? '“' + n.name + '”' : 'one ' + (n.kind || 'entry')) + ': ' + n.msg;
  }
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
// The render check's sentence, when the container found something worth a
// look. Appended at the CALL sites so every layer's reply carries it without
// touching each return — reporting only, beside an edit that IS live: it says
// "worth a second look", never "we stopped". Same contract as the build
// path's note block (2026-08-14 audit — the lanes paid for the check and
// discarded the result).
function renderTail(d) {
  return (d && typeof d.renderNote === 'string' && d.renderNote.trim()) ? '\n' + d.renderNote.trim() : '';
}
// THE SECOND THING THEY ASKED FOR, WHICH THIS TURN DID NOT DO.
//
// `layer` is one value, so a message naming two different parts of the site has
// half of it silently dropped — and the reply then reports the half that ran as
// a plain success, which reads as the builder ignoring them rather than as one
// change per turn.
//
// THEIR OWN WORDS, so the follow-up is a paste rather than a re-explanation. The
// router copies them out of the message; nothing here rewrites them, because a
// second wording is a second thing that can be wrong about what they meant.
//
// Absent by default — the router is told to stay silent when unsure, since a
// wrong one costs a sentence about something nobody asked for.
function alsoTail(d) {
  const also = d && typeof d.alsoAsked === 'string' ? d.alsoAsked.trim() : '';
  if (!also) return '';
  return '\nI only did one thing this time. Say “' + also.slice(0, 200) + '” and I\u2019ll do that next.';
}
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
  // THE SWEEP'S REPLY, BEFORE ANY LAYER (stage 2a, 2026-09-05). A job that
  // committed and died before storing its reply is finalized by the sweep
  // with `{ ok, recovered }` and nothing else: no layer, no pages, no words.
  // Read past this, the switch below would say '✅ Done.' — true, and not
  // the half the customer needs, which is that the details were lost. The
  // decision lives in edit-poll.js so a test can drive it.
  if (EditPoll.isRecovered(e)) return EditPoll.outcomeMessage('recovered');
  if (e.layer === 'text') {
    // NAMES WHAT IT NOW SAYS. "Updated the wording in 3 places" is a number the
    // owner cannot check — the same class as the two silent partials this file
    // already fixed, one notch milder. The server returns the new strings.
    const n = Number(e.applied) || 0;
    const said = (Array.isArray(e.changed) ? e.changed : [])
      .filter((x) => typeof x === 'string' && x.trim()).slice(0, 3)
      .map((x) => '“' + x.slice(0, 60) + '”');
    let out = '✅ Updated the wording' + (n > 1 ? ' in ' + n + ' places' : '') +
      (said.length ? ' — now ' + said.join(', ') : '') + '.';
    // THE CALL LINK STILL HAS THE OLD NUMBER. A phone number is one fact in two
    // encodings and this lane only reaches the words, so without saying it the
    // customer sees the right number on the page and the button rings the wrong
    // one — the worst failure this lane can produce for a trade.
    const stale = Array.isArray(e.staleTel) ? e.staleTel : [];
    if (stale.length) {
      const isMail = /^mailto:/.test(stale[0].href || '');
      out += isMail
        ? ' One thing I couldn’t change: the email link still sends to ' +
          stale[0].href.replace(/^mailto:/, '') + '. Say “point the email link at the new address” and I’ll fix it.'
        : ' One thing I couldn’t change: the Call link still dials ' +
          stale[0].href.replace(/^tel:/, '') + '. Say “make the call button use the new number” and I’ll fix it.';
    }
    return out + problemNote(e.problems);
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
    // WHAT ORDER THE LIST COMES OUT IN, when that is what changed. The server
    // composes the sentence because it is the only thing that knows which pages
    // work their own order out and could not be rewritten from outside — and
    // this is the one data change that publishes, so a lane that reported
    // nothing would leave somebody waiting for a rebuild they were not told
    // about.
    const sorted = typeof e.sortMsg === 'string' && e.sortMsg.trim() ? e.sortMsg.trim() : '';
    let out = bits.length ? '✅ ' + bits.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.' : (sorted || '✅ Done.');
    if (sorted && bits.length) out += ' ' + sorted;
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
  if (e.layer === 'rename') {
    // THE SERVER NAMES THE ADDRESS, for the reason the nav branch below gives:
    // it is the only side that knows what name was actually granted. The model
    // asked for one, `cleanAlias` may have read it slightly differently, and a
    // second opinion here would eventually tell an owner they are at an address
    // they are not at — on the one field where being wrong is permanent.
    //
    // THE OLD ADDRESS STILL WORKING IS THE HALF THAT NEEDS SAYING. An owner who
    // has printed cards, put the address on a van, or is carrying a QR code that
    // points at it will assume a rename broke all three, and will not ask.
    return e.msg || ('✅ Your site is now at ' + (e.renamed || 'its new address') + '. The old address still works.');
  }
  if (e.layer === 'nav') {
    // THE SERVER NAMES THE MENU, because it is the only thing that knows what
    // was DROPPED and why — an item pointing at a page the site does not have
    // is left out, and a second copy here would eventually report that as a
    // plain success and leave the owner wondering where their link went.
    //
    // HOW MANY PAGES IS THE PART WORTH SAYING. The whole reason this layer
    // exists is that the menu is a separate copy in every page file, so "it
    // changed on all 5 pages" is exactly the thing the owner could not get
    // before without paying for a full rewrite.
    //
    // THE SAME GOES FOR THE LINKS IN THE COPY, which this lane also repoints
    // site-wide. `navReply` is the only place that knows which of those were
    // REFUSED — a typed link cannot point at an anchor — and a second copy of
    // that sentence here would eventually report a link that never moved.
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
    // A LIST THIS REORDERED THAT OTHER PAGES ALSO SHOW. The server is the only
    // side that can know — it holds both the page before and every other page —
    // and without saying it, "order the menu by price" leaves the site
    // disagreeing with itself under a reply that says it worked.
    const reord = Array.isArray(e.reordered) ? e.reordered.filter(Boolean) : [];
    if (reord.length) {
      out += ' Heads up: ' + reord.join(' and ') + (reord.length === 1 ? ' is' : ' are') +
        ' listed on other pages too, and I only changed this one — say “do the same everywhere” if you want them to match.';
    }
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
    const SAY = { lang: 'language', brand: 'name', description: 'the description', theme: 'the theme', favicon: 'the tab icon', wordmark: 'the logo' };
    // NOTHING TO DO IS ITS OWN ANSWER, and it has to come before the sentence
    // below: an ask that was already satisfied moves nothing, so "✅ Updated the
    // look." with no list reads as a change that silently failed. The server
    // composes the words because it is the side that knows the difference
    // between "you already have that" and "I could not do it".
    if (typeof e.lookNote === 'string' && e.lookNote.trim()) return '✅ ' + e.lookNote.trim();
    const moved = (Array.isArray(e.moved) ? e.moved : []).slice(0, 4);
    const tokens = (Array.isArray(e.tokens) ? e.tokens : []).slice(0, 4);
    // ALREADY PLAIN NAMES when they arrive — the server maps the axis keys
    // through `saidFor`, because this file cannot import the module that knows
    // `display` means the heading colour.
    const style = (Array.isArray(e.style) ? e.style : []).slice(0, 4);
    // THE STYLESHEET IS ONE BIT, NOT A LIST. `css` on the wire is a bare
    // boolean — since 2026-08-23 the whole look is one string, so there are no
    // named axes to enumerate — and without a word here a colour change reads
    // "✅ Updated the look." with nothing after it, which is the shape a change
    // that silently failed has.
    const bits = moved.map(function (k) { return SAY[k] || k; })
      .concat(tokens, style, e.css ? ['the design'] : []);
    // WHICH PAGE, when it was one page rather than the site. Without it a
    // scoped change and a site-wide one read identically — and the customer
    // goes and looks at the home page, sees nothing, and concludes it failed.
    var where = typeof e.tokensPage === 'string' && e.tokensPage ? ' on ' + e.tokensPage : '';
    let out = '✅ Updated the look' + (bits.length ? ' — ' + bits.join(', ') : '') + where + '.';
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
    // AND WHAT WAS ASKED FOR AND REFUSED. `style` above lists what LANDED, so
    // an axis or a colour the engine could not use moved nothing and appeared
    // nowhere: "make the background yellow and the buttons cornflower" answered
    // "✅ Updated the look — page colour." with total silence about the buttons.
    // A silent partial reads as the builder being broken rather than as a
    // request that did not land, which is why `site-tokens.mjs`'s own doc says a
    // dropped token must be NAMED. Both sentences are composed server-side, for
    // the reason every other note here is.
    // `cssNote` IS IN THE SAME LIST AND CARRIES A DIFFERENT KIND OF FACT: a
    // typeface we cannot host, a remote url() the site's own security policy
    // refuses, a sheet longer than we store. Every one of those is invisible
    // from the page — the browser falls back or drops the rule and says nothing.
    for (const n of [e.styleNote, e.tokenNote, e.cssNote]) {
      if (typeof n === 'string' && n.trim()) out += ' ' + n.trim();
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
// ── FOLLOWING A BUILD THAT FIRED ITS GENERATION AND WENT AWAY ────────────────
//
// A build hands page generation to the container and the Worker RETURNS — 202,
// `stage: "resuming"`, and a job id — so no consumer invocation is ever long
// enough to be killed at the queue's fifteen minutes. The build then finishes
// in a DIFFERENT invocation and leaves its answer under that id.
//
// WITHOUT THIS THE CUSTOMER IS TOLD A LIE, and that is what makes it part of
// the change rather than a nicety. A 202 is `r.ok`, carries a `slug` and no
// `error`, so it takes the success branch below unaltered and renders
// "✅ Built “X”. Tell me what to change." over a site whose pages are still
// being written — and then invites a revise against a build still in flight.
//
// THE REPLAY IS BYTE FOR BYTE; WHAT WAS STORED WAS NOT THE SAME SHAPE. The
// result route really does hand back the stored status, content-type and body
// untouched, which is the whole reason this is a follow rather than a second
// reader — and this comment used to stop there, saying "everything below runs
// unchanged whichever invocation actually finished". The first half was true
// and the second half was a defect: the two invocations composed DIFFERENT
// answers. The inline route wrote `{ok, slug, url, backend, brand, …}`; the
// collector wrote `{ok, resumed, ...pages}`, and `publishPages` takes the slug
// as an input and never puts it on its output — so a collected build carried
// no slug, failed the success gate below, and fell to the catch-all, which
// told a customer with a live site and 14 credits gone that it had not come
// together and they had not been charged. Measured on `hearth-paper`,
// 2026-09-08. Both answers are composed by `builder/build-answer.mjs` now, so
// the sentence is true again — but it is true because ONE function makes both,
// not because the replay is faithful, and that distinction is the bug.
const BUILD_POLL_MS = 6000;
// Past the Worker's own 16-minute queue wait plus the container's tail. A build
// still unanswered here has not failed — it is told honestly and left running.
const BUILD_FOLLOW_MS = 20 * 60 * 1000;
async function followBuildJob(job, signal, origin) {
  const until = Date.now() + BUILD_FOLLOW_MS;
  // A RUN of unreadable answers gives up, a single one does not. The route
  // answers 503 both for "the bucket blinked" and for "the stored answer will
  // not parse", and polling for ever against the second is worse than saying
  // so — but treating one blip as the second abandons a build that is fine.
  let bad = 0;
  while (Date.now() < until) {
    await new Promise((res) => setTimeout(res, BUILD_POLL_MS));
    let r = null;
    try { r = await apiFetch('/api/site/build/' + encodeURIComponent(job), { signal }); }
    catch (e) {
      // A Stop press aborts these too, and that is right: it lands in the
      // caller's own catch, which already says the build may still finish.
      if (e && e.name === 'AbortError') throw e;
      if (++bad > 5) return null;
      continue;
    }
    // NOT AN ERROR — the ordinary answer while the pages are being written.
    //
    // AND IT CARRIES PROGRESS, WHICH THIS LOOP THREW AWAY (2026-09-07). For up to
    // twenty minutes it read the status code and nothing else, while the body was
    // already telling it which state the build was in. That is why the screen
    // never moved: not a missing signal, an unopened envelope.
    //
    // THE BODY IS A COURTESY AND THE 202 IS THE ANSWER. One that will not parse
    // must never end the follow — the same rule the server keeps for `flight`.
    if (r.status === 202) {
      bad = 0;
      const p = await r.json().catch(() => null);
      if (p) {
        setBuildPhase(origin, EditPoll.buildPhase(p));
        // AND THE CODE, from the same envelope. Read through the poll module
        // like the phase is — it is the half a test can drive, and "is this a
        // string somebody may put on a screen" is exactly the question that
        // belongs there rather than here.
        setBuildCode(origin, EditPoll.buildCode(p));
      }
      continue;
    }
    if (r.status === 503) { if (++bad > 5) return null; continue; }
    const d = await r.json().catch(() => null);
    if (!d) return null;
    return { r, d };
  }
  return null;
}
// The React build/revise send path (cutover engine). Build = first message on a
// project → /api/site/react-build; revise = any later message on a React site →
// /api/site/react-revise (same slug/URL). Streams live steps; charge-after.
function reactSend(site, t, origin, mode, imgs, finish, qa) {
  // WE KNOW IT IS A BUILD NOW, so the steps may appear. Set here rather than in
  // `siteRoute` because an attachment skips the router and comes straight here —
  // one place, so neither entry can leave it stuck on `thinking`.
  // THE FIRST PHASE, NOT THE LAST. This said `'generating'` and it is the single
  // line that put "Writing the code" on the screen over a design call: the build
  // POST holds the socket through design, provisioning, the schema and the look,
  // so for the first minutes the only true word is the first one.
  if (siteBuild) { siteBuild.rphase = ST_PHASE_ORDER[0]; paintReactLive(); }
  const endpoint = mode === 'build' ? '/api/site/react-build' : '/api/site/react-revise';
  // `picker` on BOTH, and it was on neither in any way that mattered until
  // 2026-08-08: the build sent it and the server read it zero times, and the
  // REVISE did not even send it. So the one path where somebody has already seen
  // a result and is reaching for a better model was the path that could not ask
  // for one.
  //
  // `effort` NO LONGER RIDES ALONG (2026-09-07, owner: "DELETE THE EFFORT THING
  // FOR NOW"). It was sent on both and read by nothing, which was survivable
  // only while the control was on screen: with the chip gone, `buildEffort`
  // would have kept sending whatever that browser last stored — this account's
  // was `max`, the multi-agent fan-out — with nobody able to see it and nobody
  // able to change it. Harmless today, and the exact shape of the defect fixed
  // an hour earlier: a value on the wire that the person it belongs to cannot
  // read. If a future reader ever picks `body.effort` up, it must not find a
  // choice made months ago by a control that no longer exists.
  // `qa` is what they were asked before the build and what they said. Sent RAW,
  // not folded into the brief here — the server composes it, so there is one
  // version of the sentence the designer ends up reading. Build only: questions
  // are never asked on a revise, so a revise has none to send.
  // `chat` IS THE WORKSPACE THIS BUILD WAS ASKED FOR IN, and until 2026-09-08
  // the server had never seen it. `origin` is minted by `siteCreate` per
  // project and threaded through every call in this file; sending it is what
  // lets the finished site belong to the chat that asked for it instead of
  // turning up on the start screen as a card of its own. Build ONLY: a revise
  // names its slug, which already says which site it is, and a revise sent
  // from a second chat must not re-bind the site away from the first.
  const body = mode === 'build'
    ? { brief: t, images: imgs, picker: buildPicker, qa: qa || [], chat: origin }
    : { slug: site.slug, instruction: t, images: imgs, picker: buildPicker };
  siteAbort = new AbortController();
  apiFetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: siteAbort.signal }).then(async (r) => {
    const ct = r.headers.get('content-type') || '';
    let d = (r.ok && ct.indexOf('ndjson') >= 0) ? await readReactStream(r, origin) : await r.json().catch(() => ({}));
    // ── FIRED, NOT FINISHED ────────────────────────────────────────────────
    //
    // 202 means the generation is running in the container and this route has
    // already returned. Follow the job; the answer that comes back IS the one
    // this POST would have given, so `r` and `d` are replaced and every branch
    // below runs exactly as it always has.
    //
    // `r` IS REASSIGNED RATHER THAN THE BLOCK RESTRUCTURED, deliberately: the
    // alternative is renaming it at six read sites in a 150-line handler for a
    // change that is three lines of behaviour.
    let firedJob = '';
    if (r.status === 202 && d && d.stage === 'resuming' && d.job) {
      const done = await followBuildJob(d.job, siteAbort ? siteAbort.signal : undefined, origin);
      if (done) { r = done.r; d = done.d; }
      // STILL RUNNING WHEN WE STOPPED WATCHING. Not a failure and not a build:
      // the site has a real page at its real address and the pages are still
      // being written. The recording below still runs — the slug is CLAIMED, so
      // a project that forgets it sends the next message as a fresh first build
      // against a name it already owns and gets a 409 it cannot explain.
      else firedJob = d.job;
    }
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
        // THE TABLE NAMES, for the router's digest. Nothing ever stored these,
        // so the digest at the top of siteSend sent `tables: []` on every
        // message of every site — while the routing tool's own tie-break and
        // its cheapest "data" layer are both conditioned on "the tables it has
        // are named above". The router was deciding blind on the one fact that
        // separates a free data edit from a ~25-credit addon (2026-08-14
        // audit). `d.schema` is the MERGED spec's [{name, access}] and is
        // preferred; `d.tables` is what THIS apply touched, which on a revise
        // is the delta only — either way it is a UNION into what is already
        // known, never a replace, so a delta cannot erase the rest. Names
        // only, same rule as the digest itself.
        const tnames = (Array.isArray(d.schema) ? d.schema.map((x) => x && x.name) : (Array.isArray(d.tables) ? d.tables : []))
          .filter((x) => typeof x === 'string' && x);
        if (tnames.length) s.tables = [...new Set([...(Array.isArray(s.tables) ? s.tables : []), ...tnames])].slice(0, 48);
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
        // AND WHICH OF THE OTHER TWELVE LOOK DECISIONS MOVED, for the same
        // reason and from the same kind of server-composed sentence: an axis we
        // could not use is a request that silently did nothing.
        (d && typeof d.styleNote === 'string') ? d.styleNote.trim() : '',
        // AND WHAT THE MODEL'S OWN STYLESHEET COSTS THE SITE — a family we
        // cannot fetch, a remote url() the CSP refuses, a sheet we truncated.
        // Same reason as every other line here: each one is a failure the page
        // itself has no way to report, because the browser falls back or drops
        // the rule silently.
        (d && typeof d.cssNote === 'string') ? d.cssNote.trim() : '',
        (d && typeof d.imagesNote === 'string') ? d.imagesNote.trim() : '',
        // WHICH PAGE CAME BACK AS A STUB. There is now a middle outcome — the
        // site publishes with one page showing a placeholder — and this is the
        // only thing that names it. In the note block rather than glued to
        // `notes`, or it reads mid-paragraph the way contextNote once did.
        (d && typeof d.salvageNote === 'string') ? d.salvageNote.trim() : '',
        // AND WHAT THE FINISHED PAGES ACTUALLY LOOK LIKE. The one check in the
        // whole build path that opens the site in a browser — every other one is
        // textual, so a page that renders blank, throws on load or paints text
        // nobody can read passes all of them and publishes. Reporting only, so
        // this sentence sits beside a site that IS live: it says "worth a second
        // look", never "we stopped".
        (d && typeof d.renderNote === 'string') ? d.renderNote.trim() : '',
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
      // THREE OUTCOMES, NOT TWO. A build that fired its generation and had not
      // answered by the time we stopped following is neither built nor failed —
      // it is being written right now. `built` reads TRUE there (`page` is
      // absent on a 202, so it is not 'placeholder'), which is how the success
      // sentence came to be said over a site that does not exist yet. The
      // server composed the honest sentence; this renders it rather than
      // writing a second version that can disagree with it.
      const reply = firedJob
        ? '⏳ ' + ((d && d.msg) || 'Your site is being written now — there’s a page at your address already; refresh it in a few minutes.')
        : (built ? '✅ ' : '⚠️ ') + (said || canned);
      siteFinishBuild(origin, reply, build, note, buildWhy(d));
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
    else {
      siteErr = buildErrOutcome(origin, d);
      // THE SERVER'S SENTENCE STILL WINS where it wrote one; the fallback no
      // longer asserts a charge it has not read. `buildCostWords` is appended
      // rather than baked in, so the one reading serves this and the card.
      finish('⚠️ ' + ((d && d.msg) || ('That didn’t come together.' + buildCostWords(siteErr) + ' Try again in a moment.')));
    }
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

async function siteErrors(site) {
  // The read half of runtime error reporting. The template has captured and
  // packaged every error a visitor's browser hits since the preview shell
  // existed — and on a live site the report went to the visitor's console and
  // died. Now the page POSTs it to the platform and this panel is where the
  // owner reads it. List only, newest first: there is nothing to configure and
  // nothing to press, because the useful action — fix the page — happens in
  // the chat, not here.
  const slug = site.slug || (site.liveUrl || '').split('/s/')[1] || '';
  if (typeof sbToast === 'function' && !slug) { sbToast('Publish the site first — then it can report problems here.'); return; }
  if (!slug) return;
  const { bodyEl } = stCloudModal('siteErrorsModal', 'Errors');
  bodyEl.innerHTML = '<p class="sp-intro">When a page breaks in a visitor’s browser, the site reports it here — so you hear about it from us, not from customers going quiet.</p>' +
    '<div id="erList">Loading…</div>';
  // An unreadable log is NOT an empty one — "no errors" reads as "all is
  // well", which is the one wrong answer this panel can give.
  apiFetch('/api/site/' + encodeURIComponent(slug) + '/errors')
    .then(async (r) => {
      const d = await r.json().catch(() => null);
      const box = document.getElementById('erList'); if (!box) return;
      if (!r.ok || !d || !Array.isArray(d.errors)) { box.innerHTML = '<div class="st-sec-empty"><b>Couldn’t load the error log</b><span>Try again in a moment.</span></div>'; return; }
      if (!d.errors.length) { box.innerHTML = '<div class="st-sec-empty"><b>No errors reported</b><span>Nothing has gone wrong in a visitor’s browser. New reports appear here on their own.</span></div>'; return; }
      // WHAT IT COST THE VISITOR, in words, leading the line. `source` is the
      // one field that separates "they saw a broken page" from "something
      // failed in the background they may never have noticed" — which is the
      // only severity signal there is here, and the owner's first question.
      // Never the raw enum: "unhandledrejection" is jargon that tells a barber
      // nothing. An unknown value degrades to the vaguest true sentence rather
      // than being printed raw.
      const felt = { error_boundary: 'The page didn’t load', onerror: 'Something broke on the page', unhandledrejection: 'A background request failed' };
      box.innerHTML = '<div class="bk-rows">' + d.errors.map((e2) =>
        '<div class="bk-row er-row"><div class="bk-tx"><b>' + esc(String(e2.message || '').slice(0, 160)) + '</b>' +
        '<span>' + esc(felt[e2.source] || 'Something went wrong') + ' · ' + esc(String(e2.route || '/')) + ' · ' + esc(String(e2.at || '')) + ' UTC</span></div></div>').join('') + '</div>';
    })
    .catch(() => { const box = document.getElementById('erList'); if (box) box.innerHTML = '<div class="st-sec-empty"><b>Lost the connection</b><span>Try again.</span></div>'; });
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
  const { bodyEl } = stCloudModal('siteBackupsModal', 'Backups & export');
  bodyEl.innerHTML = '<p class="sp-intro">Every night we keep a copy of everything your site has collected — bookings, orders, messages — for the last 7 days. Download any day, or export one table below.</p>' +
    '<div class="bk-sec"><b class="bk-h">Nightly copies</b><div id="bkNightly">Loading…</div></div>' +
    '<div class="bk-sec"><b class="bk-h">Export one table</b><div id="bkList">Loading…</div></div>';

  // The nightly list. An unreadable list is NOT an empty one — "no backups"
  // reads as the feature not existing, the jobs panel's own rule.
  const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  apiFetch('/api/site/' + encodeURIComponent(slug) + '/backups')
    .then(async (r) => {
      const d = await r.json().catch(() => null);
      const box = document.getElementById('bkNightly'); if (!box) return;
      if (!r.ok || !d || !Array.isArray(d.backups)) { box.innerHTML = '<div class="st-sec-empty"><b>Couldn’t load the backups</b><span>Try again in a moment.</span></div>'; return; }
      if (!d.backups.length) { box.innerHTML = '<div class="st-sec-empty"><b>No copies yet</b><span>The first nightly copy is made tonight, and each is kept for 7 days.</span></div>'; return; }
      box.innerHTML = '<div class="bk-rows">' + d.backups.map((b2) =>
        '<div class="bk-row"><div class="bk-tx"><b>' + esc(b2.day) + '</b><span>' + kb(Number(b2.size) || 0) + '</span></div>' +
        '<div class="bk-btns"><button type="button" class="bk-dl" data-day="' + esc(b2.day) + '">Download</button></div></div>').join('') + '</div>';
      box.querySelectorAll('.bk-dl').forEach((b2) => b2.onclick = async () => {
        try {
          const rr = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/backups/' + encodeURIComponent(b2.getAttribute('data-day')));
          if (!rr.ok) { if (typeof sbToast === 'function') sbToast('Download failed — try again.'); return; }
          const blob = await rr.blob();
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = slug + '-backup-' + b2.getAttribute('data-day') + '.json';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 1500);
        } catch (e) { if (typeof sbToast === 'function') sbToast('Download failed — try again.'); }
      });
    })
    .catch(() => { const box = document.getElementById('bkNightly'); if (box) box.innerHTML = '<div class="st-sec-empty"><b>Lost the connection</b><span>Try again.</span></div>'; });

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
    '<div id="sdList">Loading…</div>' +
    // SEARCH ENGINES ARE THE OTHER HALF OF "MY OWN ADDRESS", which is why this
    // lives here rather than behind a fifteenth Cloud card. Somebody who has
    // just pointed a domain at their site is exactly the person about to ask why
    // Google cannot find it.
    '<div class="sv-block"><h4 class="sv-h">Search engines</h4>' +
    '<p class="sp-intro">Prove the site is yours, so it can be indexed and you can see what it ranks for. ' +
    'Paste the code each one gives you \u2014 the whole meta tag is fine. Takes effect straight away; no rebuild.</p>' +
    '<div id="svList">Loading\u2026</div></div></div></div>';
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

  // ── SEARCH-ENGINE VERIFICATION ────────────────────────────────────────────
  //
  // THE PROVIDER LIST COMES FROM THE SERVER, never from a copy here. A hand
  // written list in the client is a second opinion about which providers exist,
  // and the day they disagree the panel offers a field whose value the server
  // silently drops — which reads to the owner as the save not working.
  const svEl = box.querySelector('#svList');
  const loadVerify = async () => {
    try {
      const r = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/verify');
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { svEl.innerHTML = '<div class="si-count">' + esc(d.error || 'Couldn\u2019t load this just now.') + '</div>'; return; }
      const provs = Array.isArray(d.providers) ? d.providers : [];
      const cur = d.verify || {};
      svEl.innerHTML = provs.map((p) =>
        '<div class="sv-row"><label class="sv-lb" for="sv-' + esc(p.name) + '">' + esc(p.label) + '</label>' +
        '<input class="st-in sv-in" id="sv-' + esc(p.name) + '" data-prov="' + esc(p.name) + '" ' +
        'value="' + esc(cur[p.name] || '') + '" placeholder="paste the code, or the whole meta tag" ' +
        'autocomplete="off" spellcheck="false">' +
        '<span class="sv-hint">' + esc(p.hint || '') + '</span></div>').join('') +
        '<div class="sv-save"><button type="button" class="st-publish" id="svSave">Save</button>' +
        '<span class="sv-msg" id="svMsg"></span></div>';
      const msg = svEl.querySelector('#svMsg');
      svEl.querySelector('#svSave').onclick = async () => {
        const btn = svEl.querySelector('#svSave');
        // EVERY FIELD IS SENT, INCLUDING THE EMPTY ONES, because an empty field
        // is how somebody takes a verification off. Absent would mean unchanged,
        // and then a cleared box would silently keep verifying.
        const verify = {};
        svEl.querySelectorAll('.sv-in').forEach((i) => { verify[i.dataset.prov] = i.value.trim(); });
        btn.disabled = true; msg.textContent = 'Saving\u2026';
        try {
          const r2 = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/verify', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verify }),
          });
          const d2 = await r2.json().catch(() => ({}));
          if (!r2.ok) { msg.textContent = d2.error || 'Couldn\u2019t save that.'; return; }
          // WHAT ACTUALLY HAPPENED, not "saved". A refusal names the provider,
          // and `live` is the difference between "on your site now" and "with
          // your next publish" — which is the only thing that decides whether
          // pressing Verify at Google will work in the next tab.
          msg.textContent = (d2.note ? d2.note + ' ' : '') +
            (d2.live ? 'Live on your site now.' : 'Saved \u2014 it goes live with your next publish.');
          loadVerify();
        } catch (e) { msg.textContent = 'Couldn\u2019t save that \u2014 check your connection.'; }
        finally { btn.disabled = false; }
      };
    } catch (e) { svEl.innerHTML = '<div class="si-count">Lost the connection.</div>'; }
  };

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
  loadVerify();
}

// Edge functions — server-side logic the builder DECLARES from chat (call a
// third-party API with a saved secret, aggregate collection data, multi-step
// flows). Read-only list + delete here; you add/change them by asking in the
// builder. Owner-only, RLS-scoped.
// Scheduled jobs — what the site does on a timer, and what it ACTUALLY DID.
//
// REWRITTEN 2026-08-13. The old panel rendered `spec.steps` from the eight-verb
// runner (`read save fetch ai email notify checkout respond`), which was deleted
// with the D1 runtime — so it described a feature that no longer exists, against
// a route (`/api/site/functions`) that no longer exists, from a card forced Off
// in DEAD_PANELS. Three layers of dead, and the comment above DEAD_PANELS warns
// about exactly this: `versions` sat Off for four days after its route shipped.
//
// THE POINT OF THIS PANEL IS THE LAST LINE OF EACH ROW. `runJob` has always
// computed an honest four-way outcome and every caller threw it into a
// Cloudflare log, which is not a surface a small business has — so "sent 14
// reminders", "your SQL is broken", "you never pasted a mail key" and "nothing
// was due" were one silence. For a REMINDER that is the worst failure there is:
// the customer does not know they were meant to get one either, and the only
// symptom is a no-show months later that looks like ordinary business.
async function siteFunctions(site) {
  const slug = site.slug || (site.liveUrl || '').split('/s/')[1] || '';
  if (!slug) { if (typeof sbToast === 'function') sbToast('Publish the site first — then its scheduled jobs show up here.'); return; }
  let box = document.getElementById('siteFnModal');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'siteFnModal';
  box.className = 'si-modal';
  box.innerHTML = '<div class="si-card"><div class="si-head"><b>Scheduled jobs</b><button type="button" class="si-x" aria-label="Close">×</button></div><div class="si-body"><p class="sp-intro">Work your site does on a timer with nobody there — reminding tomorrow\u2019s customers, a weekly summary. Ask in the builder to add or change one.</p><div id="fnList">Loading…</div></div></div>';
  document.body.appendChild(box);
  const close = () => box.remove();
  box.querySelector('.si-x').onclick = close;
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  const listEl = box.querySelector('#fnList');
  const every = (m) => (m === 60 ? 'Hourly' : m === 1440 ? 'Daily' : m >= 1440 ? 'Every ' + Math.round(m / 1440) + ' days' : m >= 60 ? 'Every ' + Math.round(m / 60) + 'h' : 'Every ' + m + 'm');
  const when = (iso) => {
    const t = Date.parse(iso || '');
    if (!Number.isFinite(t)) return '';
    const mins = Math.round((Date.now() - t) / 60000);
    if (mins < 2) return 'just now';
    if (mins < 60) return mins + ' minutes ago';
    if (mins < 48 * 60) return Math.round(mins / 60) + ' hours ago';
    return Math.round(mins / 1440) + ' days ago';
  };
  const load = async () => {
    try {
      const r = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/jobs');
      // AN UNREADABLE LIST IS NOT AN EMPTY ONE. "No scheduled jobs" reads as the
      // feature not existing and the owner stops looking, which is the one wrong
      // answer here that costs something.
      if (!r.ok) { listEl.innerHTML = '<div class="si-empty">Couldn\u2019t load the schedule — try again.</div>'; return; }
      const d = await r.json().catch(() => null);
      const jobs = d && Array.isArray(d.jobs) ? d.jobs : null;
      if (!jobs) { listEl.innerHTML = '<div class="si-empty">Couldn\u2019t load the schedule — try again.</div>'; return; }
      if (!jobs.length) { listEl.innerHTML = '<div class="si-empty">No scheduled jobs. In the builder, say what you want to happen on a timer — e.g. “email people the day before their appointment”.</div>'; return; }
      listEl.innerHTML = jobs.map((j) => {
        const ran = j.lastRun ? when(j.lastRun) : '';
        // NEVER RUN AND RAN-WITH-NOTHING-TO-DO ARE DIFFERENT FACTS. Inventing a
        // cheerful line for the first is how a brand-new site reads as working
        // before it ever has.
        const result = j.lastResult
          ? '<div class="fn-flow"><span class="fn-step">' + esc(j.lastResult) + '</span></div>'
          : '<div class="fn-flow"><span class="fn-step">Hasn\u2019t run yet.</span></div>';
        // THE BADGE IS THE OFF SWITCH now, not a label. It reads the state
        // ("On"/"Paused") and clicking it flips it — the one write this panel
        // has, wired to POST /jobs {name, enabled}. Before this the only path
        // to "stop the weekly digest" was asking the builder, which has no
        // lane that can do it (the 2026-08-13 audit) — so the switch lives
        // where the owner is already looking at what the job did.
        // THE CLOCK TIME, when the job has one (2026-09-03): "Daily at 09:00",
        // with the zone only when it is not the browser's own.
        const at = typeof j.at === 'string' && j.at
          ? ' at ' + j.at + (typeof j.tz === 'string' && j.tz && j.tz !== browserTimeZone() ? ' (' + j.tz + ')' : '')
          : '';
        return '<div class="fn-item"><div class="fn-top"><span class="fn-ic">' + ic('history', 15) + '</span><b class="fn-name">' + esc(j.name) + '</b>' +
          '<span class="fn-sch">' + esc(every(Number(j.everyMinutes) || 0) + at) + '</span>' +
          (ran ? '<span class="fn-trig">ran ' + esc(ran) + '</span>' : '') +
          (j.enabled === false
            ? '<button type="button" class="fn-tgl fn-off" data-job="' + esc(j.name) + '" data-on="" title="Paused — click to resume">Paused</button>'
            : '<button type="button" class="fn-tgl" data-job="' + esc(j.name) + '" data-on="1" title="Running on schedule — click to pause">On</button>') +
          // RUN NOW (owner, 2026-09-03): the one way to see a job work without
          // waiting a day. It sends for real, on the owner's own key, and the
          // sentence that comes back is the same one the schedule writes.
          '<button type="button" class="fn-tgl fn-run" data-run="' + esc(j.name) + '" title="Run it now — sends for real, on your own key">Run now</button>' +
          '</div>' + result + '</div>';
      }).join('');
      listEl.querySelectorAll('.fn-run').forEach((b) => b.onclick = async () => {
        b.disabled = true;
        try {
          const r = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: b.dataset.run, run: true }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) { if (typeof sbToast === 'function') sbToast(d.error === 'no such job' ? 'That job isn’t on the schedule any more.' : 'Couldn’t run it — try again.'); return; }
          if (typeof sbToast === 'function') sbToast(d.result || 'Ran.');
          load();
        } catch (e) { if (typeof sbToast === 'function') sbToast('Couldn’t run it — check your connection.'); }
        finally { b.disabled = false; }
      });
      listEl.querySelectorAll('.fn-tgl').forEach((b) => b.onclick = async () => {
        // The next state is the opposite of what the server last said, read
        // off the button — the notify toggle's idiom, including repainting
        // from the server's stored answer (a reload) rather than optimism.
        const next = b.dataset.on !== '1';
        b.disabled = true;
        try {
          const r = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: b.dataset.job, enabled: next }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) { if (typeof sbToast === 'function') sbToast(d.error === 'no such job' ? 'That job isn’t on the schedule any more.' : 'Couldn’t change that — try again.'); return; }
          load();
        } catch (e) { if (typeof sbToast === 'function') sbToast('Couldn’t change that — check your connection.'); }
        finally { b.disabled = false; }
      });
    } catch (e) { listEl.innerHTML = '<div class="si-empty">Couldn\u2019t load the schedule — try again.</div>'; }
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
  bodyEl.innerHTML =
    '<p class="sp-intro">Pictures and documents on your site — the ones you added, and the ones visitors sent with a form. ' +
    'Add a PDF here, then ask me to put a download link on a page. ' +
    'Pick a picture as your <b>link preview</b> — what WhatsApp, iMessage and Slack show when someone shares your site’s link.</p>' +
    '<div class="fl-add"><button type="button" class="st-btn" id="flAdd">Add a file</button>' +
    '<span class="fl-hint">Pictures up to 5 MB \u00b7 PDF, Word, Excel and ZIP up to 10 MB</span></div>' +
    '<div id="flList">Loading…</div>';
  // NO `accept` FILTER, deliberately, and for the reason the composer's own
  // picker carries none: the dialog hiding a format answers the question before
  // the owner asks it, and the honest refusal — with the list of what we do
  // take — comes back from the server in a sentence they can act on.
  const addBtn = document.getElementById('flAdd');
  if (addBtn) addBtn.onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const was = addBtn.textContent; addBtn.textContent = 'Uploading…'; addBtn.disabled = true;
      try {
        // The name rides in the query string because the BODY is the bytes. It
        // decides nothing about what the file IS — the leading bytes do that,
        // server-side — only what a download is called once it is there.
        const r = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/uploads?name=' + encodeURIComponent(f.name || ''), {
          method: 'POST', headers: { 'Content-Type': f.type || 'application/octet-stream' }, body: f,
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.url) { if (typeof sbToast === 'function') sbToast(d.error || 'Couldn\u2019t upload that file.'); return; }
        list();
      } catch (e) { if (typeof sbToast === 'function') sbToast('Couldn\u2019t upload that file — check your connection.'); }
      finally { addBtn.textContent = was; addBtn.disabled = false; }
    };
    inp.click();
  };
  const list = () => Promise.all([
    apiFetch('/api/site/' + encodeURIComponent(slug) + '/uploads'),
    // The stored link-preview choice, fetched beside the list so the grid can
    // mark it. A failed read degrades to no badge, never to a dead panel.
    apiFetch('/api/site/' + encodeURIComponent(slug) + '/share').then((r) => r.json()).catch(() => ({})),
  ])
    .then(async ([r, sd]) => {
      const d = await r.json().catch(() => ({}));
      const box = document.getElementById('flList'); if (!box) return;
      if (!r.ok) { box.innerHTML = '<div class="st-sec-empty"><b>Couldn\u2019t load your files</b><span>Try again in a moment.</span></div>'; return; }
      const shareChoice = (sd && typeof sd.share === 'string') ? sd.share : '';
      const files = Array.isArray(d.files) ? d.files : [];
      if (!files.length) { box.innerHTML = '<div class="st-sec-empty"><b>No files yet</b><span>Pictures and documents you add, or that visitors upload with a form, appear here.</span></div>'; return; }
      const mb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
      box.innerHTML =
        '<div class="fl-bar"><b>' + files.length + ' file' + (files.length === 1 ? '' : 's') + '</b>' +
        '<span>' + mb(d.used || 0) + ' of ' + mb(d.max || 0) + '</span></div>' +
        '<div class="fl-grid">' + files.map((f) => {
          // A DOCUMENT GETS NO <img>. Pointing one at a PDF paints the browser's
          // broken-image icon on every card, which reads as "this panel is
          // broken" — the exact failure the onerror below was added for, except
          // it would fire on every document rather than on a missing file.
          const doc = f.kind === 'doc';
          const label = f.download || f.name;
          const face = doc
            ? '<span class="fl-doc" aria-hidden="true">' + esc((f.name.split('.').pop() || '').toUpperCase()) + '</span>'
            // A thumbnail that 404s paints the browser's broken-image icon — a
            // torn page in a tall grey box, which reads as "this panel is broken"
            // rather than "this one file is missing". Seen on a stubbed render.
            // The class swap leaves the tile its own size and says what happened.
            : '<img src="' + esc(f.url) + '" alt="" loading="lazy" ' +
              'onerror="this.closest(\'.fl-item\').classList.add(\'fl-gone\');this.remove()" />';
          // The link-preview toggle: only a PICTURE the OWNER added is offered.
          // A document renders nothing in a chat app's card and a visitor's
          // upload must not become the business's preview \u2014 the server refuses
          // both, and a button it would refuse teaches the owner a dead click.
          const canShare = !doc && !f.visitor;
          const isShare = canShare && shareChoice && f.name === shareChoice;
          const shareBtn = !canShare ? '' :
            '<button type="button" class="fl-share' + (isShare ? ' fl-share-on' : '') + '" data-share="' + esc(f.name) + '" data-on="' + (isShare ? '1' : '0') + '" ' +
            'title="' + (isShare ? 'Link previews use this picture. Click to let your site pick again.' : 'Show this picture when someone shares your site\u2019s link') + '">' +
            (isShare ? 'Link preview \u2713' : 'Use in link previews') + '</button>';
          return '<figure class="fl-item' + (doc ? ' fl-isdoc' : '') + '">' +
            '<a href="' + esc(f.url) + '" target="_blank" rel="noreferrer">' + face + '</a>' +
            '<figcaption><span class="fl-nm" title="' + esc(label) + '">' + esc(label) + '</span>' +
            '<span class="fl-sz">' + mb(f.size) + '</span>' +
            '<button type="button" class="fl-del" data-file="' + esc(f.name) + '" aria-label="Delete ' + esc(label) + '">\u00d7</button></figcaption>' +
            shareBtn + '</figure>';
        }).join('') +
        '</div>';
      // Setting or clearing the link preview. Clicking the current one clears
      // it — back to the site picking — and the toast says which of the two
      // worlds the change is in: live on the site now, or waiting for the next
      // publish (the server's own `live` flag; "saved" and "live right now"
      // are different facts).
      box.querySelectorAll('.fl-share').forEach((b) => b.onclick = async () => {
        const name = b.getAttribute('data-share');
        const wasOn = b.dataset.on === '1';
        b.disabled = true;
        try {
          const r2 = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/share', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: wasOn ? null : name }),
          });
          const d2 = await r2.json().catch(() => ({}));
          if (!r2.ok) { b.disabled = false; if (typeof sbToast === 'function') sbToast(d2.error || 'Couldn’t change that — try again.'); return; }
          if (typeof sbToast === 'function') {
            sbToast(wasOn ? 'Your site picks the preview picture again.'
              : (d2.live ? 'Link previews show this picture now.' : 'Saved — link previews use it from your next change.'));
          }
          list();
        } catch (e) { b.disabled = false; if (typeof sbToast === 'function') sbToast('Couldn’t change that — check your connection.'); }
      });
      // Deleting is irreversible and the file may be on a live page, so it asks
      // first — the preview toggle above is reversible in one click and does not.
      box.querySelectorAll('.fl-del').forEach((b) => b.onclick = async () => {
        const name = b.getAttribute('data-file');
        if (!window.confirm('Delete ' + name + '? If a page uses it, that picture or download will stop working.')) return;
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

// ── Workspace views (Home / Projects / Gallery / Studio) ──
// Navigation is a dropdown in the topbar; the left sidebar (chat history) shows
// on Home only, so every other view gets the full width.
const VIEW_LABELS = { sites: 'Builder', settings: 'Settings' };
// Every view this app has. `showView` falls back to the builder for anything
// else — including a remembered value from before the media side was deleted,
// which is the case that would otherwise paint a blank main: a refresh-proof
// preference outlives the view it names.
const KNOWN_VIEWS = ['sites', 'settings'];
const VIEW_KEY = 'zephyr_view_v1';
function showView(name) {
  // HOME IS THE BUILDER (2026-09-12, owner: "yeah thats right, home is the
  // builder now"). It used to be the media composer, and `home` was already
  // LABELLED 'Builder' from an earlier renaming — two different things called
  // the builder, one of which was the video generator. With the generator gone
  // there is one, and `home` is an alias for it rather than a view of its own:
  // `viewHome` was deleted, so a bare `home` would find no element and show a
  // blank main. `landing` has aliased this way since the old home screen went,
  // and this is the same move one product later.
  if (name === 'landing' || name === 'home') name = 'sites';
  // Anything that names a view this app no longer has (a remembered
  // localStorage value from before the media side was deleted, an old link)
  // lands on the builder rather than on nothing. A refresh-proof preference is
  // exactly the thing that outlives the view it points at.
  //
  // THESE TWO LINES ARE DELIBERATELY REDUNDANT AND A SWEEP PROVED IT: 'home'
  // and 'landing' are not in KNOWN_VIEWS, so the fallback below already sends
  // them here and cutting the alias above changed no answer for any input.
  // Both are kept, because they say different things — the alias is a NAME this
  // app answers to (the Back arrow still carries data-view="home", and old
  // links say it), the fallback is a wall against anything at all. Said out
  // loud because a sweep cannot say it, and the next session deletes what
  // nothing appears to need.
  if (!KNOWN_VIEWS.includes(name)) name = 'sites';
  // Refresh-proof: remember where the user is so a reload reopens the same
  // view instead of bouncing back to the Builder.
  try { localStorage.setItem(VIEW_KEY, name); } catch {}
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const el = document.getElementById('view' + name.charAt(0).toUpperCase() + name.slice(1));
  if (el) el.classList.add('active');
  // The builder runs full-width with no studio chrome, and since it is now home
  // that is the ordinary state rather than a mode.
  document.body.classList.toggle('in-sites', name === 'sites');
  if (name === 'sites') renderSites();
  if (name === 'settings') renderSettings();
  document.querySelectorAll('.side-item[data-view], .top-tab[data-view]').forEach((i) =>
    i.classList.toggle('active', i.dataset.view === name));
  // Back-to-Builder arrow: only while a section view (Settings) is open.
  const back = document.getElementById('topBack');
  if (back) back.classList.toggle('show', name !== 'sites');
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
  'side-toggle': () => toggleSidebar(),
  'credits': () => openCredits(),
  'credits-topup': () => openCredits(true),
  'profile-menu': (e) => toggleProfileMenu(e),
  'sign-out': () => doSignOut(),
  'landing': () => goLanding(),
};
// THE MEDIA SIDE'S ACTIONS ARE GONE, AND SO IS THEIR MARKUP. This table used to
// carry thirty entries — the attach rows, the image-source chooser, the mask
// editor, the mode switch, the model and settings menus, Send, the gallery's
// filter/sort/import, the jump-to-latest chevron — every one of them bound to an
// element in `viewHome` or `viewGallery`, both of which were deleted on
// 2026-09-12. An entry left behind would be the quietest kind of dead code: it
// binds nothing (nothing carries that data-act any more), so it never fails and
// never runs, while naming a function that no longer exists. The builder's own
// chrome does not go through this table at all — it wires its handlers as it
// renders — which is why so little is left here.
const CHANGE_ACTIONS = {};
const INPUT_ACTIONS = {};
const KEYDOWN_ACTIONS = {
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

initAuthGate();

const params = new URLSearchParams(location.search);
// `?q=` IS A BRIEF NOW, NOT A PROMPT. It used to hand the text to the media
// director; the one thing a typed sentence can start here is a build, so it
// goes where the landing's own chatbox sends one. Held for after the gate when
// the visitor is not signed in, exactly as before — losing somebody's sentence
// at a sign-up screen is the thing this holder exists to prevent.
const firstBrief = params.get('q');
if (firstBrief) {
  window.history.replaceState({}, '', location.pathname);
  if (window.Auth && Auth.isSignedIn()) { showView('sites'); siteCreate(firstBrief); }
  else pendingSiteBrief = firstBrief;
}
// Back from Stripe: the webhook mints the credits — poll the balance so the
// chip catches up even if the webhook lands a few seconds after we do. Said as
// a toast rather than a message in a thread: the media side's chat thread was
// where this line used to land, and the builder has no equivalent to write an
// unprompted platform message into.
if (params.get('credits') === 'added') {
  window.history.replaceState({}, '', location.pathname);
  if (window.Auth && Auth.isSignedIn()) {
    if (typeof sbToast === 'function') sbToast('✦ Payment received — your credits are landing now.');
    setTimeout(fetchCredits, 2500);
    setTimeout(fetchCredits, 8000);
  }
}

