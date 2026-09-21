
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

// `GROUP_META` STOOD HERE and went in stage 4. It labelled the collapsed
// video-family rows (Seedance, Kling, Veo) in the media model picker, and its
// one reader left with that picker in stage 2b. `MODELS_ORDER` and `MODELS_TAB`
// above it STAY: the landing's pipeline still walks them, which is the one piece
// of the media side deliberately left standing.

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
// THE PAID FLAG IS TRI-STATE and stays so: until /api/credits resolves,
// `paidKnown` is false and every reader fails toward "paid", so a slow or failed
// credits call never labels a paying member as free. Its three readers are the
// account badge, the free-credits greeting and the start screen's plan pill.
//
// THE ON-SCREEN WATERMARK LEFT WITH THE MEDIA SIDE (2026-09-12, stage 4). A
// "✦ gofarther.dev" mark went over video players for accounts known free, and
// `refreshVideoBadges` put it on or took it off as the flag resolved — over
// `.msg.video` and `.wm-spot`, the chat thread's clip bubbles, the gallery cards
// and the lightbox. All three views went in stage 2b, so the query could not
// match anything: a live call on every credits answer, over a document that
// cannot hold what it is looking for.
let isPaid = false;
let paidKnown = false;
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
      isPaid = d.paid; paidKnown = true;
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
  // Reflect a credit spend as it happens. ONE ROUTE DOES THIS NOW: the builder's
  // message router (/api/site/route), which debits before it answers. The list
  // used to hold the orchestrator and the three generation endpoints, and those
  // four names outlived the routes themselves by one commit — the media side's
  // server half went on 2026-09-12 and this array kept naming them. An entry for
  // a route nobody calls is the quietest kind of dead code: it never runs and
  // never fails. Exact-match, and 501 = the feature isn't configured, so nothing
  // was charged.
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
  if (res.status !== 501 && p === '/api/site/route') {
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
      // ⚠ THE AGENTS ARE STAMPED, NOT DELETED, and they are the one key here
      // that is somebody's WRITING rather than a cache. Wiping them satisfied
      // half the requirement — the next account must not see them — by breaking
      // the other half: they are the only copy of agents written before this
      // screen had an account behind it, and an import that has not been pressed
      // yet is the only thing standing between them and being gone for good.
      //
      // `prevOwner` is the outgoing account and this is the ONE moment it is
      // known, so it is the one moment ownership can be assigned. Records are
      // stamped with it and left where they are; `agentsLocal` then shows a
      // record only to the account it belongs to, so the incoming account sees
      // nothing and the outgoing one still has everything when it comes back.
    }
    // ⚠ OWNERSHIP IS DECIDED FROM THE MARKER, AND BEFORE THE MARKER IS
    // OVERWRITTEN. Both halves are load-bearing.
    //
    // `zephyr_owner_v1` is the only thing in this browser that says which
    // account was last in it, so it is the only thing that can establish whose
    // the unstamped legacy records are. Two cases, and they are not symmetrical:
    //
    //  · THERE IS A MARKER → that account owns them, whether it is the one
    //    arriving now (the ordinary upgrade: the same person, with records
    //    written before this code stamped anything) or a different one (the
    //    switch above). Either way the claim takes the MARKER and never the uid
    //    that has just arrived, so arriving is not a way to acquire anything.
    //  · THERE IS NO MARKER → nobody can say. The records are SEALED: kept in
    //    full and shown to no one. That is the direction that fails closed, and
    //    it is why the seal runs ABOVE the `setItem` below — write the marker
    //    first and the next sign-in would read it as "the same account as last
    //    time" and hand the records to whoever happened to arrive first, one
    //    step removed from the bug this is fixing.
    //
    // THE COST, SAID OUT LOUD: a browser whose last sign-out ran the old code
    // has no marker, so anything written there is preserved and permanently
    // hidden. The alternative is showing one person's written instructions to
    // the next person who signs in on their machine.
    const settled = prevOwner ? agentsClaimFor(prevOwner) : agentsSealUnknown();
    // ⚠ AND THE MARKER NEVER MOVES AHEAD OF THE OWNERSHIP RECORD. A refused
    // write (a full or blocked store) leaves the records unstamped, and moving
    // the marker to the account that has just arrived would make the browser say
    // "these belong to whoever is here now" — which is the bug, reached through
    // a failed write instead of through a sign-out. So the marker stays where it
    // is and the next sign-in tries again.
    //
    // THE COST IS A REAL ONE AND IS NOT A LEAK: while that write keeps failing,
    // every reload reads a marker naming a different account and re-runs the
    // cache wipe above. Those keys are caches — the sites list, the credit
    // high-water mark, the welcome flag, the remembered view — so the price is
    // re-fetching them, against handing one person's written instructions to the
    // next. And the moment the store accepts a write the claim lands on the right
    // account and the marker moves on.
    if (settled) { try { localStorage.setItem('zephyr_owner_v1', uid); } catch {} }
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
  //
  // ⚠ OWNERSHIP IS RECORDED BEFORE THE IDENTITY IS CLEARED, and that order is
  // the whole of this block. `zephyr_owner_v1` used to be wiped below with the
  // caches, which erased the one record of whose the unstamped legacy agents
  // were — so A could sign out, B could sign in, and B's page met records
  // nothing could place. This is the last moment that identity exists, and
  // therefore the last moment ownership can be written down.
  //
  // **THE CLAIM TAKES THE MARKER, NOT `Auth.userId()`**, and the two can
  // disagree: `enterApp` only moves the marker once ownership is settled, so a
  // browser whose store refused that write is signed in as B with the marker
  // still naming A — and the unstamped records really are A's. The marker is the
  // one authority on whose these are, everywhere. An absent marker claims
  // nothing, which leaves the records hidden from everyone rather than given to
  // the account that happens to be signing out.
  let outgoing = '';
  try { outgoing = localStorage.getItem('zephyr_owner_v1') || ''; } catch {}
  const claimed = agentsClaimFor(outgoing);
  try {
    [SITES_KEY, CRED_MAX_KEY, WELCOME_KEY, VIEW_KEY,
     'zephyr_chats_v1', 'zephyr_memory_v1', 'zephyr_studio_v1',
     'zephyr_avatars_v1', 'zephyr_products_v1']
      .forEach((k) => localStorage.removeItem(k));
    // ⚠ THE IDENTITY MARKER GOES ONLY ONCE OWNERSHIP IS WRITTEN DOWN SOMEWHERE
    // ELSE. A refused write (a full or blocked store) means the records are
    // still unstamped, and erasing the marker as well would throw away the only
    // other place the answer exists — so it stays, and the next sign-in gets
    // another go at recording it. Nothing is exposed either way: `agentOwns`
    // wants an exact match, so an unstamped record is invisible to every
    // account, the incoming one included. Keeping the marker preserves; the
    // reader protects. Neither stands in for the other.
    if (claimed) localStorage.removeItem('zephyr_owner_v1');
  } catch {}
  if (everywhere) await Auth.signOutEverywhere();
  else await Auth.signOut();
  location.reload();
}

// Settings page — a plain, conventional settings view (grouped list rows),
// rebuilt each time it opens so account/credits/prefs are current.
// ── The agent builder ──────────────────────────────────────────────────────
//
// A LIST OF AGENTS, EACH ONE A CHAT, and `+` makes another. The shape is the
// owner's: a messages list, the compose control top left.
//
// ⚠ THE AGENTS ARE ON THE ACCOUNT NOW, not in this browser. `/api/agent/*` is
// the source of truth: a first build of this screen kept them in
// `localStorage`, where they were gone on another machine and gone when the
// browser's storage was cleared.
//
// THE LOCAL STORE IS STILL READ AND IS NEVER DELETED. `AGENTS_KEY` holds what
// anybody wrote before this, and those agents belong to whoever wrote them —
// so they are OFFERED (a line at the top of the list, with a button) and never
// uploaded on their own. Two conditions before an import is even drawn, and
// both are about ownership rather than convenience:
//
//   1. the server answered a list for this account — which means `authUser`
//      verified a token, so there IS an established account to put them in;
//   2. the local record has not already been brought over.
//
// A record that has been imported is MARKED, not removed: `imported` gets the
// server's id and everything else stays exactly as it was. The mark is the only
// thing this code ever writes to that store. Nothing here deletes an agent
// anybody typed, on any path, including a failed import.
const AGENTS_KEY = 'zephyr_agents_v1';
/** The composer's ceiling. Long enough for a real brief, short enough to store. */
const AGENT_MAX = 4000;
const AGENT_NAME_MAX = 60;
/**
 * How long a reason for taking a tool away may be — `agent.tool_revocations.note`'s own
 * CHECK, which is also `TOOL_NOTE_MAX` on the route. **A copy, and censused as one**
 * (`test/agent-send.test.mjs` reads the cap out of the migration), because a box that lets
 * somebody type more than the column takes is a refusal after the words are written.
 */
const AGENT_REV_WHY_MAX = 2000;

/**
 * The account's agents as the server last answered, or `null`.
 *
 * **`null` IS "NOT ASKED YET" AND `[]` IS "THIS ACCOUNT HAS NONE".** They draw
 * differently — a spinner against "No agents yet" — and collapsing them would
 * make every first paint claim the account is empty before anybody has looked.
 * The same distinction the code explorer's fold state needed, for the same
 * reason.
 */
let agentRows = null;
/** `loading` · `ready` · `error`. What the LAST list read did. */
let agentState = 'loading';
/** Why a read failed, in the server's own sentence, for the error panel. */
let agentErr = '';
/** The open thread's messages, the agent they belong to, and any read failure. */
let agentMsgs = null;
// ── tool calls waiting for a person ─────────────────────────────────────────
//
// ⚠ `null` IS "NOT ASKED YET" AND `[]` IS "NOTHING IS WAITING", and the two must stay
// apart: a failed read that answered `[]` would tell somebody there is nothing to do
// while their agent sits stopped — which is the one wrong answer this screen can give.
// A failed read keeps the rows it had.
let agentApprovals = null;     // what this account has waiting, as the server last said
let agentApprovalsFor = null;  // the agent it was read for
let agentApprovalsErr = '';
let agentApprovalBusy = '';    // the id of the request a press is in flight for
let agentMsgsFor = null;
let agentMsgsErr = '';
/**
 * What is in the composer, kept across a failed save.
 *
 * **A SAVE THAT FAILS MUST NOT COST SOMEBODY THEIR WORDS.** The panel is
 * redrawn from `innerHTML` on every state change, so a draft that lived only in
 * the DOM would be wiped by the very re-render that shows the error. This holds
 * it; `agentDraftFor` says which agent it belongs to so an edit of one cannot
 * leak into another.
 */
let agentDraft = null;
let agentDraftFor = null;
/**
 * THE TOOL CATALOG, AS THE SERVER SENT IT — and `null` until it has.
 *
 * **THE BROWSER NEVER INVENTS AN ENTRY.** A selection is a list of names chosen
 * from this list; the route refuses a name that is not in it, and the engine
 * resolves a name it does not have to no tool at all. So what this holds is a
 * DRAWING of the server's answer, never a source of truth about what exists.
 *
 * `null` (not asked yet) and `[]` (this platform offers none) are two answers, the
 * same way `agentRows` separates loading from empty — and the empty one is a real
 * branch rather than a decoration: a Worker that predates the catalog answers no
 * `tools` key at all, which lands here as `[]` and draws a sentence saying so.
 */
let agentTools = null;
// ── a permission taken away, which is NOT the tick above ────────────────────
//
// ⚠ **TWO ACTS THAT LOOK ALIKE ON A SCREEN AND ARE OPPOSITE IN WHAT THEY REACH.**
// The tick decides what the agent's NEXT run is ACCEPTED with, and a run already
// going keeps the snapshot it was accepted with — deliberately, because a run that
// loses a tool half way through is a run whose plan no longer works. A REVOCATION is
// the other act: it says *stop using this now*, the engine re-reads it on every
// delivery, and it withdraws whatever was waiting for that tool. Neither can stand in
// for the other, so the screen draws both and says which is which.
//
// ⚠ `null` IS "NOT ASKED YET" AND `[]` IS "NOTHING IS TAKEN AWAY", for the same reason
// the approvals list keeps them apart: a failed read answering `[]` would tell somebody
// their agent may use a tool the server refuses on every call.
let agentRevoked = null;       // the tools withheld from the open agent, the server's answer
let agentRevokedFor = null;    // the agent it was read for
let agentRevokedErr = '';
/**
 * ⚠ **A PRESS'S REFUSAL IS ITS OWN, AND KEEPING IT IN THE READ'S HOLDER LOSES IT —
 * MEASURED.** Every press re-reads the list afterwards, deliberately, so that what is drawn
 * is the server's answer rather than what the press hoped for. That read then SUCCEEDS and
 * clears its own error — so a refusal written into the same field was wiped by the very
 * re-read that followed it, and somebody pressing a control that failed saw nothing at all.
 *
 * Two facts, two holders: this one is *what your press did*, `agentRevokedErr` is *whether we
 * can tell you what is taken away*. The automations screen keeps the same two apart for the
 * same reason (`agentAutoErr` and `agentAutoActErr`).
 */
let agentRevokeActErr = '';
let agentRevokeBusy = '';      // the tool a press is in flight for
/**
 * Why somebody is taking a tool away, kept across a re-render and a failed press.
 *
 * ⚠ **IT IS NOT DECORATION: it is what the agent is TOLD.** `revoke_agent_tool` writes this
 * onto every request the revocation just answered, and the engine reads it back to the model
 * as *"the authority for this was withdrawn: …"*. So it reaches somebody, which is the whole
 * reason the box is offered — and why a failed press must not cost the words.
 */
let agentRevokeWhy = '';
/**
 * WHAT THE SERVER SAID JUST HAPPENED — its sentence, never one of ours.
 *
 * Both routes answer a `say`, and the one about restoring is the one nobody would guess:
 * *anything that was waiting for it stays withdrawn*. Composing that here would be a second
 * copy of a claim about somebody's data in a second language, and the copy a person reads is
 * the one that drifts.
 */
let agentRevokeSaid = '';
/** Whether the settings just saved, for the one line that says so. */
let agentSaved = false;
/**
 * What is typed in each conversation's message box, KEYED BY AGENT.
 *
 * **IT WAS ONE STRING FOR THE WHOLE SCREEN**, which is a defect the moment a
 * request is in flight: send in A, open B, and A's answer landing cleared — or
 * restored — whatever was typed in B. Keyed by agent there is nothing to
 * confuse: A's unsent words wait in A, B's in B, and an answer for A can only
 * ever touch A's entry.
 */
let agentMsgDrafts = {};
/**
 * AND KEYED BY ACCOUNT TOO, which the first version was not.
 *
 * These maps live in memory and `doSignOut` ends in `location.reload()`, so today a
 * switch discards them with the page — which made the account half look unnecessary.
 * It is not a wall that should rest on a reload three hundred lines away: this
 * repository has the expiry of exactly that kind of reasoning recorded four times.
 * The key carries the uid, so an unsent message is unreadable to anybody else even
 * if the page survives.
 */
/**
 * ⚠ AND THE ACCOUNT IS THE **BOUND** ONE WHEREVER ONE IS HELD, never whoever is
 * signed in when the answer arrives — which is the same rule as every other write
 * on this screen, and an existing guard is what found it missing.
 *
 * A send that succeeds clears its draft. Computing the key from `agentUid()` at that
 * moment means a session that expired mid-request deletes a key belonging to NOBODY
 * and leaves the real draft behind for ever, carrying words the person who typed them
 * cannot see any more. So the uid travels with the request, exactly as the
 * conversation does; `undefined` (not falsy) is what means "whoever is here now",
 * because a signed-out `''` is a real answer and must not silently become the
 * current account.
 */
const agentDraftKey = (id, uid) => (uid === undefined ? agentUid() : uid) + '|' + String(id || '');
const agentDraftOf = (id, uid) => {
  const k = agentDraftKey(id, uid);
  return (id && Object.hasOwn(agentMsgDrafts, k)) ? agentMsgDrafts[k] : '';
};
const agentDraftSet = (id, text, uid) => { if (id) agentMsgDrafts[agentDraftKey(id, uid)] = text; };
const agentDraftDrop = (id, uid) => { if (id) delete agentMsgDrafts[agentDraftKey(id, uid)]; };
const agentKeyDrop = (id, uid) => { if (id) delete agentSendKeys[agentDraftKey(id, uid)]; };
/**
 * ⚠ AND THE BOX ITSELF IS EMPTIED, NOT ONLY THE DRAFT — which is not belt and
 * braces, it is the other half of the same fact.
 *
 * Every render READS the box before redrawing it (`agentComposerRead`), so a draft
 * dropped after a successful send is RESURRECTED by the very next redraw out of the
 * text still sitting in the textarea — the words came back, and the next press sent
 * them again. FOUND ON THE LIVE SITE, and missed by every unit case because the fake
 * element carried no `data-agent`, so the read wrote nothing: the fixture was less
 * capable than the render it stood in for.
 *
 * Only this conversation's box, asked of the ELEMENT rather than of whatever is open.
 *
 * ⚠ AND ONLY WHILE IT STILL HOLDS WHAT WAS SENT — which the first cut did not check,
 * and the live screen showed the cost: the answer lands about a second after the press,
 * so anybody who starts typing their NEXT message inside that second had the first
 * characters wiped mid-word (measured: 12 of them, leaving "ake card payments"). The
 * text we are entitled to remove is the text we sent; anything else is somebody's new
 * message, and the next redraw keeps it because the read puts it back in the draft.
 */
const agentBoxClear = (id, sent) => {
  if (typeof document === 'undefined' || !id) return;
  const el = document.getElementById('agMsg');
  if (!el || ((el.getAttribute && el.getAttribute('data-agent')) || '') !== String(id)) return;
  if (el.value === sent) el.value = '';
};

/**
 * WHAT IS IN THE BOX RIGHT NOW, AND WHERE THE CURSOR IS — read before every
 * re-render and put back after it.
 *
 * **THE POLL REBUILDS THIS PANEL EVERY 2.5 SECONDS.** `renderAgents` writes
 * `innerHTML`, so while a run is going the textarea was DESTROYED and recreated
 * eight times a minute, redrawn from a draft that was only written on Send — so
 * anything typed while waiting for an answer was lost at the next tick, along with
 * the focus and the cursor. A quiet reload already kept the thread on screen; it
 * did not keep the person's half-typed reply.
 *
 * **THE BOX SAYS WHICH CONVERSATION IT BELONGS TO** (`data-agent`), so a render that
 * CHANGES conversations cannot write one person's words into another's draft — the
 * id is read off the element being replaced, never from whatever is open now.
 */
function agentComposerRead() {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById('agMsg');
  if (!el) return null;
  const id = (el.getAttribute && el.getAttribute('data-agent')) || '';
  if (id) agentDraftSet(id, el.value);
  return {
    id,
    start: typeof el.selectionStart === 'number' ? el.selectionStart : null,
    end: typeof el.selectionEnd === 'number' ? el.selectionEnd : null,
    focused: document.activeElement === el,
  };
}
function agentComposerRestore(prev) {
  if (!prev || !prev.id || typeof document === 'undefined') return;
  const el = document.getElementById('agMsg');
  // A DIFFERENT CONVERSATION IS DRAWN NOW, so there is nothing of this one's to put
  // back — and forcing focus into somebody else's box would be a worse bug than the
  // one this fixes.
  if (!el || ((el.getAttribute && el.getAttribute('data-agent')) || '') !== prev.id) return;
  if (prev.focused && typeof el.focus === 'function') {
    try { el.focus({ preventScroll: true }); } catch { try { el.focus(); } catch { /* no focus here */ } }
  }
  // ONLY INTO THE SAME TEXT. A send that succeeded has emptied the box, and putting
  // a cursor from the old value into the new one is how a caret lands mid-word.
  if (prev.start !== null && el.value === agentDraftOf(prev.id) && typeof el.setSelectionRange === 'function') {
    try { el.setSelectionRange(prev.start, prev.end); } catch { /* not a text field */ }
  }
}

/**
 * WHERE THE CURSOR IS ANYWHERE ELSE ON THIS SCREEN — and `#agMsg` is deliberately NOT
 * among them, because it has its own pair three functions up.
 *
 * ⚠ **THE CONVERSATION BOX WAS THE ONLY CONTROL THAT KEPT ITS FOCUS, and every other form
 * on this screen lost it on every redraw.** `renderAgentsNow` writes `innerHTML`, so a
 * press that adds a step, a `data-change` select, a save landing and the executions watch
 * poll (`AUTO_WATCH_MS`, 1.5 s, six reads after a Run now) each replaced the control that
 * had focus and dropped the caret to the body. The VALUES were already kept — five readers
 * put them in the draft before anything moves — so what was lost was where you were.
 *
 * **A CONTROL IS IDENTIFIED BY THE SAME WALK ITS VALUE IS READ BY, never by a second
 * attribute.** `agentAutoValues` says a step field's identity is its row's position plus
 * its own `data-field`; this composes exactly that, so there is ONE statement of which
 * control is which and a redraw that reorders the rows moves the caret with them. An
 * element carrying an `id` is keyed on the id, which needs no walk and no list to keep.
 *
 * ⚠ **AND THE CARET GOES BACK ONLY INTO THE SAME TEXT**, which is the composer's own rule
 * one function up and is here for the same measured reason: a redraw that changed a value
 * (a save landing, a step's choice changing which controls exist) would otherwise put a
 * cursor from the old string into the new one, mid-word.
 */
function agentFocusSpots() {
  const out = [];
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return out;
  const all = (sel) => [...document.querySelectorAll(sel)];
  const rows = all('[data-step-type]');
  rows.forEach((row, i) => {
    const one = typeof row.querySelectorAll === 'function' ? row.querySelectorAll.bind(row) : null;
    if (!one) return;
    for (const f of [...one('[data-field]')]) {
      const n = (f.getAttribute && f.getAttribute('data-field')) || '';
      if (n) out.push(['s' + i + '.' + n, f]);
    }
    for (const d of [...one('[data-day]')]) {
      const n = (d.getAttribute && d.getAttribute('data-day')) || '';
      if (n) out.push(['s' + i + '.day.' + n, d]);
    }
  });
  for (const row of all('[data-input-row]')) {
    const at = (row.getAttribute && row.getAttribute('data-input-row')) || '';
    const one = typeof row.querySelectorAll === 'function' ? row.querySelectorAll.bind(row) : null;
    if (at === '' || !one) continue;
    for (const f of [...one('[data-in]')]) {
      const n = (f.getAttribute && f.getAttribute('data-in')) || '';
      if (n) out.push(['i' + at + '.' + n, f]);
    }
  }
  for (const el of all('[data-note]')) {
    const id = (el.getAttribute && el.getAttribute('data-note')) || '';
    if (id) out.push(['n' + id, el]);
  }
  for (const el of all('[data-sched-day]')) {
    const d = (el.getAttribute && el.getAttribute('data-sched-day')) || '';
    if (d) out.push(['w' + d, el]);
  }
  return out;
}
function agentFocusRead() {
  if (typeof document === 'undefined') return null;
  const el = document.activeElement;
  // NOT THE CONVERSATION BOX. It has its own reader, which also puts the words in the
  // draft; two writers on one control is how a value gets restored twice from two rules.
  if (!el || el === document.body || el.id === 'agMsg') return null;
  let key = el.id ? '#' + el.id : '';
  if (!key) for (const [k, cand] of agentFocusSpots()) if (cand === el) { key = k; break; }
  if (!key) return null;
  return {
    key,
    was: typeof el.value === 'string' ? el.value : null,
    start: typeof el.selectionStart === 'number' ? el.selectionStart : null,
    end: typeof el.selectionEnd === 'number' ? el.selectionEnd : null,
  };
}
function agentFocusRestore(prev) {
  if (!prev || !prev.key || typeof document === 'undefined') return;
  let el = null;
  if (prev.key.charAt(0) === '#') el = document.getElementById(prev.key.slice(1));
  else for (const [k, cand] of agentFocusSpots()) if (k === prev.key) { el = cand; break; }
  // THE CONTROL IS NOT DRAWN ANY MORE — the step was removed, the choice above it hid this
  // field, or another screen is open. Forcing focus somewhere else would be worse than
  // leaving it where the redraw put it.
  if (!el || typeof el.focus !== 'function') return;
  try { el.focus({ preventScroll: true }); } catch { try { el.focus(); } catch { /* no focus here */ } }
  if (prev.start !== null && prev.was !== null && el.value === prev.was
      && typeof el.setSelectionRange === 'function') {
    try { el.setSelectionRange(prev.start, prev.end); } catch { /* not a text field */ }
  }
}

/**
 * ONE KEY PER PRESS, NOT PER REQUEST — and that distinction is the whole of retry
 * safety on this screen.
 *
 * A double click and a lost response are the same event from here, and both must
 * produce ONE message and ONE run. The server absorbs a repeat on this key (the
 * database holds `(agent_id, send_key)` unique), so what the browser has to
 * guarantee is that a RETRY carries the SAME key. Minting one inside `agentSend`
 * would make every call a new press: two clicks landing before the re-render
 * disables the button would be two messages, which is exactly the duplicate the
 * key exists to prevent.
 *
 * So it is minted per AGENT, beside the draft, and cleared with it — on success
 * only. A failed send keeps the words AND the key, so pressing again is the same
 * press said twice.
 */
let agentSendKeys = {};
/**
 * ⚠ AND IT IS BOUND TO THE PAYLOAD IT WAS MINTED FOR, which the first version was
 * not — a defect in exactly the case the key exists for.
 *
 * A send commits and its response is lost. The words are still in the box, so the
 * person EDITS them and presses again. With the key held per conversation alone,
 * that retry carried the FIRST message's key: the server absorbed it, answered
 * `repeat` with the original body, the browser read `ok` and cleared the box — so
 * the edit was silently discarded and the conversation kept the text nobody wanted.
 *
 * So the key travels WITH its body. The same text retried is the same press (one
 * message, one run, absorbed as before); changed text is a different press and gets
 * a fresh key, which is a new message rather than a silent no-op. Retry safety is
 * unchanged — it was never about the conversation, it was always about the payload.
 */
function agentKeyFor(id, body, uid) {
  if (!id) return '';
  const k = agentDraftKey(id, uid);
  const held = Object.hasOwn(agentSendKeys, k) ? agentSendKeys[k] : null;
  if (held && held.key && held.body === body) return held.key;
  return agentMintKey(k, body);
}
function agentMintKey(k, body) {
  {
    // `crypto.randomUUID` is absent on older browsers and over plain HTTP, and the
    // server accepts this fallback deliberately: turning retry safety off for the
    // browsers least likely to have a reliable connection is the wrong trade.
    const key = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2);
    agentSendKeys[k] = { key, body };
  }
  return agentSendKeys[k].key;
}

/**
 * WHO AND WHERE A REQUEST WAS MADE FROM.
 *
 * Every call below leaves the screen, waits, and comes back to a screen that may
 * have moved — to another conversation, or to another ACCOUNT. `agentBind` is
 * taken before the request and `agentSame` asked after it, and nothing that
 * fails that question may write to the screen's state. The account half is not
 * theoretical: a session can expire and a second person can sign in on the same
 * machine while a save is still in the air, and the answer must not land in
 * their screen.
 *
 * What a refused answer does NOT mean is that the work failed. A message whose
 * binding moved is still saved on the server; it appears the next time that
 * conversation is opened, because the list and the thread are read from the
 * account rather than from what this tab remembers.
 */
const agentUid = () => ((window.Auth && Auth.userId) ? Auth.userId() : '');
const agentBind = () => ({ uid: agentUid(), thread: agentThread, editing: agentEditing });
/** Same account AND same conversation. */
const agentSame = (b) => !!b && b.uid === agentUid() && b.thread === agentThread;
/** Same account AND the same thing open in the composer. */
const agentSameEdit = (b) => !!b && b.uid === agentUid() && b.editing === agentEditing;
/** A sentence under the control that just failed. */
let agentActErr = '';
/** True while a write is in flight, so a button can say so and not double-fire. */
let agentBusy = false;

/** Every legacy record in this browser, whoever it belongs to. Corrupt or absent is EMPTY. */
function agentsStored() {
  try {
    const v = JSON.parse(localStorage.getItem(AGENTS_KEY) || '[]');
    return Array.isArray(v) ? v.filter((a) => a && typeof a.id === 'string') : [];
  } catch { return []; }
}

/**
 * Write the whole store back, and say whether it really landed.
 *
 * **THE ANSWER IS READ BACK**, not inferred from `setItem` not throwing. A
 * caller that needs to know whether ownership was recorded cannot act on a
 * write it only hopes happened — a full or blocked store is exactly the case
 * where the next account must not inherit anything. The ONLY writer, and it
 * never drops a record.
 */
function agentsStore(list) {
  try {
    localStorage.setItem(AGENTS_KEY, JSON.stringify(list));
    return localStorage.getItem(AGENTS_KEY) === JSON.stringify(list);
  } catch { return false; }
}

/**
 * The owner stamped on a record whose real owner can never be established.
 *
 * **IT IS A VALUE, NOT AN ABSENCE, and that is the whole point.** A record with
 * no `uid` is merely unclaimed — the next thing that can establish an identity
 * may legitimately claim it. A record stamped with this can never be claimed by
 * anything, because no account id can equal it. It is what "we do not know, and
 * we will never know" looks like in storage: preserved, and invisible.
 *
 * The `?` is what makes it safe: Supabase user ids are uuids, so no real account
 * can collide with it however the id format changes.
 */
const AGENT_OWNER_UNKNOWN = '?unknown';

/**
 * ⚠ THE ONE OWNERSHIP TEST, asked by the list AND by the import.
 *
 * **AN EXACT MATCH, WITH NO PASS FOR AN UNSTAMPED RECORD.** It used to read
 * `!a.uid || a.uid === uid`, on the reasoning that unstamped meant "never been
 * through an account switch, so it can only be the current account's". That was
 * wrong, and `doSignOut` is why: signing out ERASES `zephyr_owner_v1`, the one
 * marker that carried the outgoing identity, so A could sign out, B could sign
 * in, and every one of A's records read as unstamped-and-therefore-B's. B could
 * see them and import them.
 *
 * So unknown ownership is HIDDEN. That fails closed in the only direction that
 * matters: the cost of being wrong here is one person reading another's written
 * instructions, against the cost of somebody having to write an agent again.
 */
const agentOwns = (a, uid) => !!uid && !!a && a.uid === uid;

/**
 * The legacy records THIS account may see.
 *
 * One line, one rule, and the rule is `agentOwns`. It is a filter rather than a
 * deletion: another account's records are still in the browser, still theirs,
 * and invisible here — and so are the ones nobody can vouch for.
 */
function agentsLocal() {
  return agentsStored().filter((a) => agentOwns(a, agentUid()));
}

/**
 * Record that these records belong to `owner` — an identity that is ESTABLISHED
 * at this moment, never one that is merely present.
 *
 * Answers whether the store now says so, because two callers act on that: sign-out
 * keeps the outgoing identity marker when this fails, and nothing anywhere treats
 * a failed claim as a claim.
 *
 * ADDITIVE, and it never re-assigns: a record that already carries an owner is
 * left exactly as it is, so a second switch cannot hand the first account's
 * agents to the second, and a sealed record can never be un-sealed.
 */
function agentsClaimFor(owner) {
  if (!owner) return false;
  const list = agentsStored();
  if (!list.some((a) => !a.uid)) return true;       // nothing unclaimed
  return agentsStore(list.map((a) => (a.uid ? a : { ...a, uid: owner })));
}

/**
 * Seal every unclaimed record as belonging to nobody we can name.
 *
 * **THIS IS WHAT STOPS UNKNOWN OWNERSHIP BEING LAUNDERED.** Without it, a
 * browser holding unstamped records and no identity marker would write a marker
 * for whoever signed in, and on the NEXT sign-in that marker would say "the same
 * account as last time" — so the records would be claimed for an account that
 * merely arrived first, one step removed. Sealing happens the first time this
 * code meets records it cannot place, and `agentsClaimFor` never overwrites a
 * stamp, so the seal is permanent.
 *
 * The records stay. Every field, every message. They are simply not shown to
 * anyone, which is the honest rendering of "we cannot tell whose these are".
 */
function agentsSealUnknown() {
  const list = agentsStored();
  if (!list.some((a) => !a.uid)) return true;
  return agentsStore(list.map((a) => (a.uid ? a : { ...a, uid: AGENT_OWNER_UNKNOWN })));
}

/**
 * The ones not yet brought over: what the OFFER counts.
 *
 * It is not what `agentImport` iterates, and that is deliberate. This decides
 * whether to draw a line and a button; the action asks `agentOwns` itself, of
 * each record, at the moment it would be sent. One predicate, two questions —
 * "what may I show" and "may I send this" — so a later change to how the list
 * is computed cannot become a change to what leaves the browser.
 */
const agentsToImport = () => agentsLocal().filter((a) => !a.imported);

/**
 * Mark one local record as brought over. ADDITIVE — the record keeps every
 * field it had, including its messages, so somebody can still go and look.
 */
function agentMarkImported(localId, serverId) {
  // THE WHOLE STORE, not the filtered view: `agentsLocal` hides other accounts'
  // records, so mapping over IT and writing the result back would delete every
  // one of them — the wipe returning through the back door, in the function
  // whose job is to preserve them.
  agentsStore(agentsStored().map((a) =>
    a.id === localId ? { ...a, imported: String(serverId || ''), importedAt: Date.now() } : a));
}

/**
 * The time column. Today shows a clock, anything older shows a date — which is
 * what the reference does and what makes the column worth its width.
 */
function agentWhen(ms) {
  const t = Number(ms);
  if (!Number.isFinite(t) || t <= 0) return '';
  const d = new Date(t);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** The circle. One letter, and never an empty one. */
const agentInitial = (name) => ((String(name || '').trim()[0] || '·').toUpperCase());

/**
 * What the row says underneath the name: the LAST MESSAGE once there is one,
 * and the instructions until then.
 *
 * The server sends `preview` — SQL NULL from `agent.agent_overview` arrives as
 * `""` — so the fallback below is what draws a row for an agent nobody has
 * written to yet. It is a correct rendering of an empty conversation, which is
 * why the server does not need to compose a sentence for it.
 */
function agentPreview(a) {
  if (a && a.preview) return a.preview;
  return (a && a.instructions) || 'No instructions yet';
}

/** Which agent the composer is editing: null = closed, '' = a new one. */
let agentEditing = null;
/** Which agent's thread is open, or null for the list. */
let agentThread = null;

/**
 * Ask the server for this account's agents.
 *
 * `quiet` redraws without flashing the spinner — for a refresh after a write,
 * where the screen already has a list on it and blanking it would read as the
 * list having been lost.
 */
async function agentsLoad(quiet) {
  const bound = agentBind();
  if (!quiet) { agentState = 'loading'; agentErr = ''; renderAgents(); }
  try {
    const res = await apiFetch('/api/agent/list');
    const j = await res.json().catch(() => ({}));
    // A LIST IS AN ACCOUNT'S. If a different one is signed in by the time this
    // lands, writing these rows would show one person another's agents — the
    // same leak the account-switch stamp exists to prevent, arriving by wire
    // instead of out of storage.
    if (bound.uid !== agentUid()) return;
    if (!res.ok || !j.ok) {
      // A FAILED READ IS NOT AN EMPTY ACCOUNT. `agentRows` is left exactly as it
      // was — so a refresh that fails after a good read keeps showing the list
      // it had, and a first read that fails shows an error rather than "No
      // agents yet", which would read as the account having been emptied.
      agentState = 'error';
      agentErr = (j && j.error) || 'Couldn’t load your agents.';
    } else {
      agentRows = Array.isArray(j.agents) ? j.agents : [];
      // THE CATALOG RIDES WITH THE LIST. Anything but a list is an empty catalog —
      // an older Worker, a shape we cannot read — and the form says so honestly
      // rather than drawing an empty box that reads as a rendering fault.
      // ANYTHING BUT A LIST OF NAMED ENTRIES IS AN EMPTY CATALOG. `j.tools || []`
      // would be right for an ABSENT key and wrong for a string or an object, which
      // the form then tries to map over — a screen that throws where it should say
      // there is nothing to allow.
      agentTools = Array.isArray(j.tools) ? j.tools.filter((t) => t && typeof t.name === 'string') : [];
      agentState = 'ready';
      agentErr = '';
    }
  } catch {
    agentState = 'error';
    agentErr = 'Couldn’t reach the server.';
  }
  renderAgents();
}

/** One thread, asked for when it is opened. */
async function agentThreadLoad(id, quiet) {
  const bound = agentBind();
  // A QUIET RELOAD KEEPS WHAT IS ON SCREEN. A poll that blanked the thread and drew
  // "loading" every two and a half seconds would make a running conversation
  // unreadable — and a scroll position is lost with it. Only a first open, or a
  // deliberate retry, shows the loading state.
  if (!quiet) { agentMsgs = null; agentMsgsErr = ''; }
  agentMsgsFor = id;
  agentPollStop();
  renderAgents();
  try {
    const res = await apiFetch('/api/agent/messages?id=' + encodeURIComponent(id));
    const j = await res.json().catch(() => ({}));
    // MOVED ON, OR SIGNED IN AS SOMEBODY ELSE. The thread check was here from the
    // start; the ACCOUNT half was not, and a session that expires mid-read would
    // otherwise paint one person's conversation into the next person's screen.
    if (agentMsgsFor !== id || bound.uid !== agentUid()) return;
    if (!res.ok || !j.ok) {
      agentMsgsErr = (j && j.error) || 'Couldn’t load this conversation.';
      // An agent the server no longer has is not an empty thread: the whole
      // screen goes back to the list, which re-reads and tells the truth.
      if (res.status === 404) { agentThread = null; agentsLoad(true); return; }
    } else {
      agentMsgs = Array.isArray(j.messages) ? j.messages : [];
      agentMsgsErr = '';
    }
  } catch {
    if (agentMsgsFor === id) agentMsgsErr = 'Couldn’t reach the server.';
  }
  renderAgents();
  // ASKED AFTER THE DRAW, off the rows that were just drawn. A poll scheduled on a
  // FAILED read would keep asking a server that is not answering, at this interval,
  // for as long as the screen is open — so it is the presence of live work in a
  // successful answer that arms the next one, and nothing else.
  if (!agentMsgsErr && agentLive(agentMsgs)) agentPollSoon(id);
  // ⚠ ASKED ON EVERY READ INCLUDING THE QUIET ONES, because a run reaches a gated call
  // WHILE somebody is looking at the conversation — that is the whole point of the gate —
  // and a banner that only appeared on a deliberate reload would leave them watching a
  // run that has stopped and will not start again until they press something.
  if (!agentMsgsErr) agentApprovalsLoad(id);
}

/**
 * What this agent has waiting for a person.
 *
 * Read with the thread and again on every poll, because a run that reaches a gated call
 * produces one of these WHILE somebody is looking at the conversation — the whole point
 * being that the work stops until they answer.
 *
 * **IT IS SCOPED TO THE AGENT ON THE WIRE**, not filtered here: the route takes the id,
 * checks it belongs to this account, and answers that agent's. Reading the account's
 * whole list and narrowing it in the browser would put another agent's waiting calls in
 * this screen's memory for no reason.
 */
async function agentApprovalsLoad(id) {
  const bound = agentBind();
  try {
    const res = await apiFetch('/api/agent/tool-approvals?agent=' + encodeURIComponent(id));
    const j = await res.json().catch(() => ({}));
    // MOVED ON, OR SIGNED IN AS SOMEBODY ELSE — the same wall every other read here has,
    // for the same reason: an answer landing in a screen that has since changed is
    // somebody being shown a decision that is not theirs to make.
    if (agentMsgsFor !== id || bound.uid !== agentUid()) return;
    if (!res.ok || !j.ok) {
      agentApprovalsErr = (j && j.error) || 'Couldn’t check what is waiting.';
    } else {
      agentApprovals = Array.isArray(j.approvals) ? j.approvals : [];
      agentApprovalsFor = id;
      agentApprovalsErr = '';
    }
  } catch {
    if (agentMsgsFor === id) agentApprovalsErr = 'Couldn’t reach the server.';
  }
  renderAgents();
}

/**
 * ⚠ **THE THREE THINGS A PERSON MAY DO WITH A WAITING CALL, AND THE DOOR EACH GOES
 * THROUGH — chosen together, in one entry, because the route and the body are ONE
 * decision.**
 *
 * `/api/agent/tool-approve` carries a verdict and `/api/agent/tool-withdraw` carries
 * none, and `agent.decide_tool_approval` REFUSES `revoked` as a verdict on purpose: a
 * withdrawal is not a third verdict, because nobody looked at the call and said no.
 * So a body naming one at the wrong door would be this screen turning a request being
 * taken back into a rejection somebody never made. **Two fields chosen in two places is
 * how that happens; one entry per act is how it cannot.**
 *
 * `say` is what the LOSER of a race is told, and it is per act for the same reason: the
 * sentence for a press that arrived second is about what the first one did.
 */
const AGENT_AP_ACTS = {
  approved: { path: '/api/agent/tool-approve', body: (id) => ({ id: id, verdict: 'approved' }) },
  rejected: { path: '/api/agent/tool-approve', body: (id) => ({ id: id, verdict: 'rejected' }) },
  withdrawn: { path: '/api/agent/tool-withdraw', body: (id) => ({ id: id }) },
};

/**
 * WHAT BECAME OF A REQUEST, IN WORDS NOBODY HAD TO LEARN.
 *
 * The three verdicts are the DATABASE's — `approved · rejected · revoked` — and two of
 * them are not English about a decision. *"it was revoked"* reads as something done to
 * the person who just pressed, where what happened is that the request was taken back
 * before anybody answered it. **An unknown word is passed through rather than dropped**:
 * a deployment answering a fourth verdict must not read as nothing having happened.
 */
function agentVerdictWord(v) {
  if (v === 'approved') return 'approved';
  if (v === 'rejected') return 'turned down';
  if (v === 'revoked') return 'taken back';
  return (typeof v === 'string' && v) ? v : 'already answered';
}

/**
 * Answer one of them, or take it back.
 *
 * **THE SCREEN SENDS THE ID AND THE ACT AND NOTHING ELSE.** Who decided is taken by
 * the server from the verified session; there is no field for it here, and there is no
 * tool anywhere that reaches either route — an agent cannot answer its own request
 * because it has no way to be a session.
 *
 * ⚠ **AND ONE PRESS AT A TIME PER REQUEST, which is what `agentApprovalBusy` is for.**
 * Every button on that row goes dead while one is in flight, so a double click cannot
 * send a second press and an Approve cannot chase a Withdraw. What it does NOT do is
 * make the act happen twice if it somehow did: the database's verdict is write-once and
 * the second press is told whose answer stands.
 */
async function agentApprovalAct(id, act) {
  const door = Object.hasOwn(AGENT_AP_ACTS, act) ? AGENT_AP_ACTS[act] : null;
  if (!id || !door || agentApprovalBusy) return;
  const bound = agentBind();
  const forAgent = agentMsgsFor;
  agentApprovalBusy = id;
  agentApprovalsErr = '';
  renderAgents();
  try {
    const res = await apiFetch(door.path, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(door.body(id)),
    });
    const j = await res.json().catch(() => ({}));
    if (agentMsgsFor !== forAgent || bound.uid !== agentUid()) return;
    if (!res.ok || !j.ok) {
      agentApprovalsErr = (j && j.error) || 'Couldn’t record that.';
    } else if (j.repeat === true) {
      // ⚠ THE LOSER OF A RACE IS TOLD WHOSE ANSWER STANDS. Two people pressing at once is
      // one decision, and showing the loser their own verdict would be this screen saying
      // something the database did not.
      //
      // ⚠ **AND A WITHDRAWAL IS NOT AN ANSWER, SO IT DOES NOT GET THE ANSWER'S SENTENCE.**
      // This printed the verdict verbatim — *"it was revoked"* — which is both unreadable
      // and wrong about what happened: nobody decided it, it was taken back. It is the
      // exact case a stale tab produces, pressing Approve on a request that has since been
      // withdrawn, and the one thing that must never read as an approval.
      agentApprovalsErr = j.verdict === 'revoked'
        ? 'That request was taken back before anybody answered it, so it won’t run.'
        : 'Somebody already answered that one — it was ' + agentVerdictWord(j.verdict) + '.';
    }
  } catch {
    if (agentMsgsFor === forAgent) agentApprovalsErr = 'Couldn’t reach the server.';
  }
  agentApprovalBusy = '';
  // RE-READ BOTH, and in this order: the decision put the run back on the queue, so the
  // conversation is the thing that changes next. The list is re-read because this row is
  // gone from it either way — answered by us, or by whoever won the race.
  if (agentMsgsFor === forAgent && bound.uid === agentUid()) {
    agentApprovalsLoad(forAgent);
    agentThreadLoad(forAgent, true);
  } else {
    renderAgents();
  }
}

/**
 * "2 actions", with whatever punctuation the sentence around it needs.
 *
 * ONE PLACE, because three branches of `agentRunHtml` say it and three copies of a
 * pluralisation drift in the direction where one of them says "1 actions".
 */
function agentCalls(n, before, after) {
  if (typeof n !== 'number' || !(n > 0)) return '';
  return before + esc(String(n)) + ' action' + (n === 1 ? '' : 's') + after;
}

/**
 * ⚠ **CAN THESE ARGUMENTS BE PUT IN FRONT OF A PERSON AT ALL.** One test, asked by the
 * banner above the message box AND by the automation history, because the two screens draw
 * the same fact and two copies of the question drift into two different answers about one
 * row. A plain object only: `null` is *nobody could read them* and an array or a string is a
 * shape no tool declares and no honest key/value drawing exists for.
 */
function agentArgsReadable(args) {
  return !!args && typeof args === 'object' && !Array.isArray(args);
}

/**
 * WHICH ARGUMENT TO READ FIRST.
 *
 * **AN ORDERING AND NOTHING ELSE — every key is drawn whether or not it is named here**, and
 * that is what stops this being a second copy of anything: a field the engine adds, renames
 * or drops still reaches the screen, so drift cannot hide one. What it buys is that a send's
 * own `{connection, provider, account, to, body}` does not put a uuid in front of somebody
 * and leave the WORDS last, which is the one field the whole decision is about.
 */
const AGENT_ARGS_FIRST = ['account', 'to', 'body'];
function agentArgKeys(args) {
  const all = Object.keys(args);
  const first = AGENT_ARGS_FIRST.filter((k) => all.includes(k));
  return first.concat(all.filter((k) => !first.includes(k)));
}

/**
 * The arguments of one waiting call, as a list. ONE drawing, shared for the reason above.
 *
 * **`{}` IS *there are none* AND IS NOT *we could not read them*** — the caller asks
 * `agentArgsReadable` first and says its own sentence for the second, because what to DO
 * about it differs by screen (ask the agent again; ask for the automation again).
 */
function agentArgsHtml(args) {
  const keys = agentArgKeys(args);
  return keys.length
    ? '<ul class="ag-ap-args">' + keys.map((k) =>
        '<li><span class="ag-ap-k">' + esc(k) + '</span> ' +
        '<span class="ag-ap-v">' + esc(agentApprovalValue(args[k])) + '</span></li>').join('') + '</ul>'
    : '<div class="ag-ap-none">with nothing filled in</div>';
}

/**
 * ⚠ **WHAT TAKING ONE REQUEST BACK DOES AND DOES NOT REACH — three scopes, named.**
 *
 * Modelled on `AUTO_STOP_SCOPE` and for the same reason: a screen offering one word for
 * several scopes has somebody cancelling tonight's call when they meant to stop the job, or
 * taking a tool away for ever when they meant to say no once. The three here are ONE
 * REQUEST (this control), ONE RUN (stopping it, which ends the whole job) and ONE TOOL
 * FOR GOOD (a revocation, in the agent's settings).
 *
 * **IT DOES NOT PROMISE A STOP CONTROL FOR EVERY RUN, because there is not one.** An
 * automation's executions have Stop on their own history; a run started by a message has no
 * such button, so this says where the control IS rather than implying one everywhere.
 */
const AGENT_AP_SCOPE = 'Taking it back cancels just this request — the agent is told it may '
  + 'not make the call and carries on with something else. It is not the same as stopping the '
  + 'run, which ends the whole job; an automation’s runs can be stopped from its history. And '
  + 'it does not change what this agent may do next time — to take a tool away for good, use '
  + 'Taken away right now in its settings.';

/**
 * ⚠ **WHAT A REVOCATION REACHES, SAID AS WHAT THE BACKEND REALLY DOES.**
 *
 * Read off `agent.tool_revocations` and `agent.revoke_agent_tool` rather than from an idea
 * of what it ought to be:
 *
 *   * the primary key is `(tenant, agent, tool)`, so it is THIS AGENT and ONE TOOL — not the
 *     account, not this agent's other tools, and not another agent that has the same one;
 *   * **there is no connection-scoped restriction anywhere in the backend**, so this must not
 *     imply one: stopping an agent reaching one account is disconnecting that account, which
 *     is its own screen, and saying otherwise here would send somebody to a control that
 *     does not exist;
 *   * it is enforced BEFORE the next action of a run already going — the runner re-reads it
 *     on every delivery — and it withdraws whatever was already waiting for that tool;
 *   * it is not the tick above it. That decides what the NEXT run is accepted with.
 */
const AGENT_REV_SCOPE = 'This is this agent and one tool — not your other agents, and not '
  + 'anything else this one may use. It stops the tool mid-job: a run already going cannot '
  + 'use it again, and anything waiting to be approved for it is taken back. It is not the '
  + 'ticks above, which decide what the agent is allowed next time it starts. To stop it '
  + 'reaching one connected account, disconnect that account instead.';

/**
 * A RUN, SHORT ENOUGH TO READ AND LONG ENOUGH TO TELL TWO APART.
 *
 * **NOT A LINK AND NOT A NAME.** There is no screen that opens one run of a conversation, and
 * inventing a friendly word for it would be a label somebody could match against nothing.
 * What it is FOR is telling two waiting requests apart, which is the whole reason it is drawn
 * — so an id this cannot read says so rather than drawing an empty gap.
 */
function agentRunTag(run) {
  const s = typeof run === 'string' ? run : '';
  return s ? s.slice(0, 8) : 'not recorded';
}

/** One waiting call, as a sentence somebody can act on. */
function agentApprovalHtml(r) {
  // ⚠ THE ARGUMENTS ARE SHOWN, NOT SUMMARISED. Approving what you were not shown is the
  // one mistake here that cannot be taken back, so the whole object is drawn.
  //
  // ⚠ **AND THERE ARE THREE STATES HERE, NOT TWO — this drew two and stated the wrong one.**
  // `toolApprovalRow` used to fold an unreadable argument set to `{}`, which is the same
  // value a call that really takes no arguments answers, and this said *"with nothing filled
  // in"* about both: **a positive claim about a value nobody could read**, in the one place a
  // person is deciding. `null` is *we could not read them* now and `{}` is *there are none*,
  // so the third row says so and **does not offer Approve at all** — a decision whose subject
  // cannot be put on screen is not one to offer. "Don’t" stays, because refusing a call you
  // cannot see is a reasonable thing to do and it is what gets the run moving again.
  const unreadable = !agentArgsReadable(r.args);
  const args = unreadable
    ? '<div class="ag-ap-none">Its arguments couldn’t be read, so there is nothing to show ' +
      'you — don’t approve this one. Ask the agent for it again.</div>'
    : agentArgsHtml(r.args);
  // ⚠ **THE WINDOW, WHICH NEVER REACHED THIS SCREEN.** `agent.pending_approvals` has answered
  // `expiresAt` since the approval-controls round and the site's own reader dropped it, so a
  // request just vanished from the banner when it closed with nothing having said it would.
  // The words are the execution history's own (`Runs out …`), because it is the same fact one
  // screen over. Absent is drawn as nothing rather than as "never": a row from before the
  // window existed has no deadline, and inventing one would be this screen making a promise.
  const until = typeof r.expiresAt === 'string' && r.expiresAt
    ? '<div class="ag-ap-when">Runs out ' + esc(autoWhen(r.expiresAt)) + '</div>'
    : '';
  // ⚠ **WHICH AGENT AND WHICH RUN ASKED, and the run is the half that was missing.** The
  // agent is named rather than left to the header, because this row is what a person reads
  // when they come back to a screen they left; the RUN is what tells two waiting requests of
  // one agent apart, and until now nothing on screen did.
  //
  // **`pending_approvals` SAYS WHICH RUN AND NOTHING ABOUT WHAT KIND OF RUN IT IS** — a
  // gated call inside a conversation and an automation's send approval both arrive in this
  // list — so this names the run and stops, rather than composing a sentence about an
  // automation nobody has read. A name we do not hold is left out rather than guessed.
  const who = (agentRows || []).find((x) => x && x.id === r.agent) || null;
  const from = '<div class="ag-ap-who">' + (who ? esc(who.name) + ' · ' : '') +
    'run ' + esc(agentRunTag(r.run)) + '</div>';
  const busy = agentApprovalBusy === r.id;
  return '<div class="ag-ap" data-ap="' + esc(r.id) + '">' +
    '<div class="ag-ap-t">Waiting for you</div>' +
    '<div class="ag-ap-s">This agent wants to run <b>' + esc(agentToolLabel(r.tool)) + '</b>. ' +
      'Nothing has happened yet.</div>' +
    from +
    args +
    until +
    '<div class="ag-ap-acts">' +
      (unreadable
        ? ''
        : '<button class="ag-ap-yes" data-act="agent-tool-approve" data-id="' + esc(r.id) + '"' +
          (busy ? ' disabled' : '') + '>Approve</button>') +
      '<button class="ag-ap-no" data-act="agent-tool-reject" data-id="' + esc(r.id) + '"' +
        (busy ? ' disabled' : '') + ' title="Somebody looked at this and said no">Don’t</button>' +
      // ⚠ **THE THIRD ACT, AND THE ROUTE FOR IT HAS BEEN THERE ALL ALONG WITH NOTHING
      // REACHING IT.** `/api/agent/tool-withdraw` is not a third verdict: nobody decided
      // the call, the request is being taken back, and the model is told the AUTHORITY was
      // withdrawn rather than that a person declined. **Drawn even when the arguments
      // cannot be read**, unlike Approve — taking back a request you cannot see is a
      // reasonable thing to do, and it is what gets the run moving again.
      '<button class="ag-ap-no" data-act="agent-tool-withdraw" data-id="' + esc(r.id) + '"' +
        (busy ? ' disabled' : '') + ' title="Take the request back without deciding it">' +
        'Take it back</button>' +
    '</div>' +
    // WHAT EACH OF THOSE REACHES, beside the buttons rather than only in a confirm — a
    // person deciding needs it before they press.
    '<div class="ag-ap-who">' + esc(AGENT_AP_SCOPE) + '</div>' +
  '</div>';
}

/** One argument, as text. Objects and lists are shown as JSON rather than as [object Object]. */
function agentApprovalValue(v) {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return '(nothing)';
  try { return JSON.stringify(v); } catch { return String(v); }
}

/**
 * The tool's own label from the catalog, or its name.
 *
 * THE CATALOG IS THE SERVER'S and rides on the agent list; a deployment that predates it
 * answers no `tools` key, and then the NAME is what there is. Inventing a prettier one
 * here would be this screen making up a description of something it does not own.
 */
function agentToolLabel(name) {
  const t = (agentTools || []).find((x) => x && x.name === name);
  return (t && t.label) || name || 'that';
}

/**
 * WHICH RUNS ARE STILL GOING, out of the thread the server sent.
 *
 * Derived from the rows rather than remembered, so a reload mid-run is the ordinary case
 * and not a recovery path — the browser holds no state about a run at all.
 *
 * ⚠ **ALL SEVEN OF `runView`'S STATES, AND THE FIVE THAT ARE NOT LIVE ARE NOT LIVE FOR A
 * REASON.** This list was written when there were four, and its own comment enumerated
 * that world — which would have gone quietly wrong the day a live state was added. The
 * rule is *will anything move on its own*:
 *   • `queued`, `working`  — yes, so the conversation is re-read;
 *   • `waiting`            — no: the work row is off the queue and nothing will deliver it
 *                            until a PERSON answers. The banner above the box is what they
 *                            act on, and it is re-read with the thread; pressing Approve
 *                            reloads it, after which the run is `queued` again and polling
 *                            resumes on its own;
 *   • `unresolved`         — no: nobody can move it, which is the whole meaning of the word;
 *   • `answered`, `cancelled`, `failed` — no: they have ended.
 * A poll armed for any of the five would ask the same question for as long as the screen
 * is open and never get a different answer. `test/agent-binding.test.mjs` requires every
 * state in `RUN_STATES` to be classified, so an eighth forces this decision rather than
 * defaulting to "not live".
 */
const AGENT_LIVE_STATES = ['queued', 'working'];
const agentLive = (msgs) =>
  (Array.isArray(msgs) ? msgs : []).some((m) => m && m.run && AGENT_LIVE_STATES.indexOf(m.run.state) >= 0);

/**
 * How often the conversation is re-read while something is running.
 *
 * The engine's sweeper offers a queued run on its own minute-by-minute cron, so a
 * run can sit for up to that long before its first step. Two and a half seconds is
 * chosen against how it FEELS rather than against that: it is the interval at which
 * a step appearing looks immediate, and the read is one small request against a
 * view. It is not a lease, a timeout or a bound on anything — nothing breaks if a
 * poll is missed, because the next one reads the same rows.
 */
const AGENT_POLL_MS = 2500;
let agentPollTimer = null;

/**
 * Stop polling. Called before every start, on leaving the thread, and on a failed
 * read — so there is never more than one timer, and a timer can never outlive the
 * screen that wanted it.
 */
function agentPollStop() {
  if (agentPollTimer !== null) { clearTimeout(agentPollTimer); agentPollTimer = null; }
}

/**
 * Re-read this conversation in a moment, IF it is still the one on screen and
 * something in it is still running.
 *
 * **THE BINDING IS RE-ASKED WHEN THE TIMER FIRES, not when it is set.** Between the
 * two, somebody can open another conversation, sign out, or sign in as somebody
 * else — and a poll that painted the old thread's rows into the new screen is the
 * defect this whole file's binding rules exist to stop, arriving on a timer instead
 * of on a response.
 */
function agentPollSoon(id) {
  agentPollStop();
  const bound = agentBind();
  agentPollTimer = setTimeout(() => {
    agentPollTimer = null;
    if (!agentSame(bound) || agentMsgsFor !== id) return;
    agentThreadLoad(id, true);
  }, AGENT_POLL_MS);
}

/**
 * ONE RUN, DRAWN — progress, result or failure, and nothing invented.
 *
 * `m.run` is `null` for a message that started nothing, which every imported
 * conversation is and every message sent before this existed: those draw as the
 * message alone, because there is no work to report and a bubble saying so would be
 * a sentence about the platform in the middle of somebody's conversation.
 *
 * **THE LABEL IS DRAWN FROM `run.simulated`, WHICH IS ABOUT THE RUN THAT
 * ANSWERED** — read from the model recorded in that run's own log. So the day a real
 * provider is connected, the runs that used it are not labelled and this needs no
 * change. A label from a constant would keep saying "simulated" over a real answer.
 *
 * **AND IT IS THE SECOND COPY OF THAT LABEL, DELIBERATELY.** The answer's own TEXT
 * carries `[simulated]` from the engine, and this is the chrome's. Neither replaces
 * the other: the chrome is visible before you read a word, and the text survives
 * being copied into an email. Both are asserted by their own guards.
 */
function agentRunHtml(run) {
  if (!run) return '';
  var tag = run.simulated
    ? '<span class="ag-sim" title="No model is connected yet. This is a stand-in test result, not an answer from an AI.">Simulated</span>'
    : '';
  if (run.state === 'queued') {
    return '<div class="ag-msg ag-msg-bot">' +
      '<div class="ag-run ag-run-wait">' + tag +
        '<span class="ag-run-t">Queued\u2026</span>' +
      '</div></div>';
  }
  if (run.state === 'working') {
    return '<div class="ag-msg ag-msg-bot">' +
      '<div class="ag-run ag-run-wait">' + tag +
        '<span class="ag-run-t">Working\u2026 step ' + esc(String(run.step)) + '</span>' +
      '</div></div>';
  }
  // ⚠ **THREE STATES THE BACKEND ANSWERS AND THIS FUNCTION DREW AS FAILURES — MEASURED,
  // not inferred.** `runView` has answered seven states since the run-states round; this
  // drew four and let the rest fall to the failure branch. What a customer really saw:
  // `waiting` and `unresolved` BOTH read *"It stopped, and there is no reason recorded."*
  // in the warn colour — so a run needing one press of Approve was a broken run, and a
  // stranded one was indistinguishable from it — and `cancelled` read *"It stopped:
  // cancelled."* with the who, the words and the counts thrown away, which tells somebody
  // their own decision was a fault. The three need three different things done about them,
  // which is the whole reason the backend tells them apart.
  //
  // **THE WORDS ARE THE EXECUTION HISTORY'S OWN**, because these are the same facts one
  // screen over and a customer must not read two accounts of one thing. No class is
  // invented either: the conversation has exactly two treatments (`ag-run-wait` italic,
  // `ag-run-fail` warn) plus the plain row, and a cancellation is deliberately the plain
  // one — nothing went wrong.
  if (run.state === 'waiting') {
    return '<div class="ag-msg ag-msg-bot">' +
      '<div class="ag-run ag-run-wait">' + tag +
        '<span class="ag-run-t">Waiting for you' + agentCalls(run.open, ' — ', '') + '. ' +
          'Nothing has happened yet.</span>' +
      '</div></div>';
  }
  if (run.state === 'unresolved') {
    // ⚠ **NOT A FAILURE, AND IT MUST NOT INVITE A SECOND ATTEMPT.** The calls may well have
    // happened; what is missing is an answer. So the sentence says what to DO and names how
    // many, because "something is unconfirmed" is not actionable.
    return '<div class="ag-msg ag-msg-bot">' +
      '<div class="ag-run ag-run-fail">' + tag +
        '<span class="ag-run-t">It stopped part-way and can’t carry on by itself.</span>' +
        '<div class="ag-run-why">' +
          (run.open > 0
            ? agentCalls(run.open, '', ' were started and never answered, so they can’t be confirmed either way. ')
            : 'Something was started and never answered. ') +
          'Check before asking for it again — it may already have gone.' +
        '</div>' +
      '</div></div>';
  }
  if (run.state === 'cancelled') {
    // ⚠ **WHAT HAD ALREADY RUN, AND NEVER THAT IT WAS UNDONE.** The counts are the only
    // honest thing to say: stopping a run ends what is still to come and cannot reach back.
    // **WHO is deliberately NOT drawn** — `by` is an account id, and a raw uuid is not
    // something a person can read; this screen has no name to put beside it.
    var done = '';
    if (typeof run.steps === 'number' && run.steps >= 0) {
      done = esc(String(run.steps)) + ' step' + (run.steps === 1 ? '' : 's') + ' had already run' +
        (typeof run.calls === 'number' && run.calls > 0
          ? ' and ' + agentCalls(run.calls, '', '') + ' had already gone out'
          : '') + '. ';
    }
    return '<div class="ag-msg ag-msg-bot">' +
      '<div class="ag-run">' + tag +
        '<span class="ag-run-t">Stopped' + (run.note ? ' — ' + esc(run.note) : '') + '.</span>' +
        '<div class="ag-run-why">' + done +
          'Stopping it ends what was still to come — anything already sent stays sent.' +
        '</div>' +
      '</div></div>';
  }
  if (run.state === 'answered') {
    // AN ANSWERED RUN WITH NO WORDS IS SAID, not drawn as an empty bubble. It is a
    // thing that happened, and an empty bubble reads as a rendering fault.
    var body = run.text
      ? '<div class="ag-bubble ag-bubble-bot">' + esc(run.text) + '</div>'
      : '<div class="ag-run ag-run-fail"><span class="ag-run-t">It finished without saying anything.</span></div>';
    return '<div class="ag-msg ag-msg-bot">' +
      (tag ? '<div class="ag-run ag-run-tag">' + tag + '</div>' : '') +
      body +
      (run.at ? '<div class="ag-msg-when">' + esc(agentWhen(run.at)) + '</div>' : '') +
    '</div>';
  }
  // FAILED. The reason is the engine's own word and is shown rather than hidden: a
  // run that stopped on a bound and one whose model call died need different things
  // done about them, and "something went wrong" cannot tell them apart.
  return '<div class="ag-msg ag-msg-bot">' +
    '<div class="ag-run ag-run-fail">' + tag +
      '<span class="ag-run-t">' + esc(agentWhyText(run.why)) + '</span>' +
    '</div></div>';
}

/**
 * The engine's stop reason, as a sentence.
 *
 * **AN UNKNOWN REASON IS SHOWN AS ITSELF, never swallowed into "something went
 * wrong".** A reason this list has not met is still the most useful thing anybody
 * has, and the engine gains stop reasons without this file being edited.
 */
function agentWhyText(why) {
  if (why === 'spent') return 'It stopped: it reached one of its limits.';
  if (why === 'call-failed') return 'It stopped: the model call failed.';
  if (why === 'unmeasured') return 'It stopped: its spending could not be measured.';
  if (why === 'unknown' || !why) return 'It stopped, and there is no reason recorded.';
  return 'It stopped: ' + why + '.';
}

/**
 * How many messages one thread shows.
 *
 * The SERVER bounds this now (`MAX_THREAD` in `agent-store.mjs`, newest first
 * and turned round), so this is no longer a storage limit — the old one existed
 * because an unbounded thread in `localStorage` eventually throws on write and
 * takes the sites list with it. It is kept as the number the import may carry,
 * which is the one place the browser still decides.
 */
/**
 * ═══════════════════════════════════════════════════════════════════════
 * AUTOMATIONS — a trigger, a condition, an action, a saved result.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * A THIRD SCREEN FOR ONE AGENT, reached from its conversation. It is not inside the
 * settings form deliberately: that form is what the agent IS — its name, its
 * instructions, what it may use — and this is what it does on its own. Two short
 * screens read better than one long one, and each has a different thing at stake.
 *
 * **NULL IS "NOT ASKED YET" AND `[]` IS "THIS AGENT HAS NONE"**, the same distinction
 * the agent list needs and for the same reason: collapsing them makes every first paint
 * claim there is nothing before anybody has looked.
 */
let agentAuto = null;          // which agent's automations are open
let agentAutoRows = null;      // its automations, as the server last answered
let agentAutoState = 'loading';
let agentAutoErr = '';
/**
 * The step catalog, AS THE SERVER SENT IT.
 *
 * **THE BROWSER DRAWS WHAT THIS SAYS AND CAN NEVER ADD TO IT.** A step type is code in
 * the engine; this is the server's answer to "what may I configure", and a Worker that
 * predates it answers no `steps` key at all — which draws an honest sentence rather than
 * an empty form somebody could fill in and never save.
 */
let agentAutoCat = null;
let agentAutoEditing = null;   // an automation id, '' for a new one, null for the list
/**
 * ⚠ **WHICH OPENING OF THE FORM THIS IS — because `''` is not an identity.**
 *
 * Every in-flight answer is walled against the screen having moved, and that wall compares
 * `agentAutoEditing`. For an EDIT that is an id and the comparison means something; for a
 * CREATE it is `''`, and `'' !== ''` is false — so a create's answer landing after the form
 * was closed and reopened as another create passed the wall and wrote one configuration's
 * id and baseline onto the other's form. MEASURED: name a new automation, press Save, press
 * Cancel, press "Start from an example", let the answer land — and the NEXT press sent
 * `automation-update {id: <the one just created>, ...the example}`, overwriting it.
 *
 * A monotonic count of openings is the identity `''` cannot be. It is bumped in exactly one
 * place, `agentAutoOpenForm`, which every opener and every exit goes through — so a door
 * added next month carries this by construction rather than by being added to a list.
 */
let agentAutoOpen = 0;
/**
 * The form's values, kept across a failed save AND across every re-render.
 *
 * The panel is rebuilt from `innerHTML` whenever anything changes — adding a step,
 * reordering one, an error arriving — so values that lived only in the DOM would be
 * wiped by the very redraw that shows the change. `agentAutoFormRead` puts them here
 * FIRST, through the same one door the message composer goes through.
 */
let agentAutoDraft = null;
/**
 * ⚠ **THE VALUES THIS FORM WAS DRAWN WITH, so a save can send what really changed.**
 *
 * Captured ONCE per drawing, by reading the form the instant after it is drawn — so the baseline
 * and the save's own read come out of the SAME reader and are structurally identical by
 * construction. Reading it at save time instead would capture whatever has been typed, and every
 * edit would read as no change at all.
 *
 * **IT MUST NOT FOLLOW THE ROW.** The list reloads while a form is open, so a baseline recomputed
 * from `agentAutoRow()` would move to whatever somebody else has just saved — and a person who
 * changed nothing would then be told they had changed it back. It is cleared with the draft and
 * recaptured on the next drawing, which is exactly when the form is showing something new.
 *
 * It carries the automation it is about: a reset this file forgot would otherwise diff one
 * automation's form against another's values, which is every field "changed" and the whole-row
 * replace back again. Here that is a refusal instead.
 */
let agentAutoWas = null;
let agentAutoBusy = false;
let agentAutoActErr = '';
let agentAutoSaved = false;
/**
 * ⚠ **WHAT A CHECK ANSWERED, WHICH IS NOT THE SAME THING AS A SAVE'S REFUSAL.**
 *
 * Every refusal these validators can make was reachable only by pressing Save, so a person
 * with a twenty-step workflow found out one refusal at a time — and a dependency that is not
 * about the steps at all (an account not connected, a permission withheld, a time zone nobody
 * set) could only be found by running the automation and reading the failure afterwards.
 *
 * `null` is "not asked". A structural refusal goes into `agentAutoActErr`, the SAME place a
 * save's does, so the step it is about is marked on that step by the code that already does
 * it — two places for one kind of sentence would be two accounts of it. What lives here is
 * only what a save does not answer: what the workflow NEEDS, and what could not be checked.
 */
let agentAutoCheck = null;
let agentAutoRuns = null;      // the open automation's executions
let agentAutoRunsFor = null;
let agentAutoRunsErr = '';
/**
 * ⚠ **WHICH EXECUTION SOMEBODY ASKED TO BE SHOWN — `{of, run}`, never a bare id.**
 *
 * An arrival names a run AND its automation, and "open the run" hands both over. Holding only
 * the run id would leak: `agentAutoRunsFor` moves on a Run now (which sets it and then reloads
 * quietly), so a want left over from an arrival would mark a row in a DIFFERENT automation's
 * history. Bound to the automation it is about, a want for anything else is ignored by
 * construction — which is stronger than remembering to clear it at each of the doors.
 */
let agentAutoRunsWant = null;
/**
 * The three doors that close a history null it too, and that is TIDINESS RATHER THAN THE WALL:
 * the `of` binding above is what makes a want for another automation unreadable, so a door
 * added next month that forgets this line cannot mark the wrong row — it can only leave a dead
 * id in memory. Both are kept because they say different things.
 */

/** How long to keep asking after a Run now, and how often. */
const AUTO_WATCH_MS = 1500;
const AUTO_WATCH_TRIES = 6;
let agentAutoWatch = null;

/**
 * ── WHAT AN AUTOMATION IS BEING ASKED FOR BEFORE IT RUNS ──────────────────────
 *
 * `null` until Run now is pressed on an automation that declares inputs, then
 * `{id, values}`. **AN AUTOMATION THAT ASKS FOR NOTHING STILL RUNS STRAIGHT AWAY** — a
 * form with no boxes in it is a door for the sake of a door.
 */
let agentAutoAsk = null;

/**
 * WHICH PRESS OF "start from the example" IS THE NEWEST.
 *
 * ⚠ **THE SEED READS THE ACCOUNT'S OWN CONNECTIONS FIRST, so it is a request and not an
 * assignment — and a request can land after the screen has moved on.** Two presses in a row
 * means the LAST one decides what the form holds; an answer from an earlier press writing
 * itself over a form somebody has since started editing is the defect this counter closes.
 * It is not a substitute for the account-and-agent binding below it, which asks a different
 * question: this one says *is this still the press that was made*, and that says *is this
 * still the person and the agent it was made for*.
 */
let agentAutoEgAsk = 0;

// ── connected accounts ───────────────────────────────────────────────────────
//
// ⚠ **ITS OWN SCREEN, OPENED OVER THE CONVERSATION, exactly as the automations list is** —
// and for the same one rule that makes all of this safe without a per-input guard: nothing
// redraws behind somebody who is typing.
let agentConn = null;          // which agent's connected accounts are open
let agentConnRows = null;      // its connections, as the server last answered
let agentConnCat = null;       // what may be connected, and each permission's own words
let agentConnState = 'loading';
let agentConnErr = '';
let agentConnActErr = '';
let agentConnNew = false;      // whether the connect form is open
/**
 * ⚠ **THE DRAFT IS THE PERSON'S OWN TYPING AND IS READ BACK BEFORE EVERY REDRAW**, the way
 * every other form on this screen is. There is NO credential field in it and there cannot
 * be: the server mints one, and a box for a credential would be a place for somebody to
 * paste a real account's password into a fake provider.
 */
let agentConnDraft = null;

// ── WHERE THINGS ARRIVE ─────────────────────────────────────────────────────
//
// ⚠ **ITS OWN SCREEN, for the same reason the accounts have one**: an address somebody sets
// up and the arrivals it has taken are a thing to sit with, not a row on a list of
// automations. Two halves on it — the addresses, and what has arrived at them.
let agentWh = null;            // which agent's arrival addresses are open
let agentWhRows = null;        // its endpoints, as the server last answered
let agentWhMax = 0;            // how many one agent may hold, the server's own number
let agentWhEvents = null;      // what has arrived, newest first
let agentWhEventsErr = '';
let agentWhState = 'loading';
let agentWhErr = '';
let agentWhActErr = '';
let agentWhNew = false;        // whether the make-an-address form is open
let agentWhDraft = null;
let agentWhBusy = false;
/**
 * ⚠ **WHICH OPENING OF THE FORM THIS IS — a monotonic count, bumped in exactly one place.**
 *
 * `agentWhNew` is a boolean and cannot tell two openings apart, so an answer that landed after
 * somebody cancelled and opened a NEW form passed every wall there was: same account, same
 * agent, a form open — and it closed that form, threw away what had been typed into it, and
 * put the OLD address's signing key on screen in its place. Counting the openings is what makes
 * "the form this answer is about" a thing that can be asked. `agentAutoOpen` is the same fix on
 * the automations form, for the same reason.
 */
let agentWhOpen = 0;
/**
 * ⚠ **AN ANSWER WHOSE FORM HAD MOVED ON — held, named, and never written over the newer one.**
 *
 * `{uid, agent, name, event, made, why}`, and exactly one of `made`/`why` is set because one
 * request had one outcome.
 *
 * **`made` IS AN ADDRESS THAT REALLY EXISTS.** The request succeeded; the endpoint is live and
 * takes deliveries whatever this screen went on to show. Its signing key came back in that one
 * answer and comes back nowhere else, so dropping it silently would cost somebody a key for an
 * address they now have and cannot sign for — they would have to find it, delete it and make
 * another. It is offered instead, as a press.
 *
 * **`why` IS A REFUSAL ABOUT VALUES THAT ARE NO LONGER ON SCREEN.** Put into `agentWhActErr` it
 * would be drawn over a form holding different words, blaming this address for the last one's
 * problem; so it NAMES what it was about.
 *
 * **BOUND TO THE ACCOUNT AND THE AGENT, and read at DRAW time rather than only at write time.**
 * That is what keeps a key from reaching another account: the notice is drawn only while the
 * account that made it is signed in and that agent's addresses are open. **And it is memory and
 * only memory** — not `localStorage`, not the URL, never logged, and a reload loses it, exactly
 * as the panel below already promises.
 *
 * ⚠ **ONE SLOT IS ENOUGH, and that is a property rather than a hope**: Save is `disabled`
 * while `agentWhBusy`, so two creates can never be in flight at once and a second hold can
 * never overwrite a first one's key.
 *
 * ⚠ **IT IS NOT CLEARED BY THE NEXT SAVE PRESS, deliberately.** Two presses can make two
 * addresses, and each has its own key that exists in its own one answer; dropping the held one
 * because somebody made another would be exactly the harm this prevents, quietly. So a made
 * address's offer outlives a later save, and the only things that end it are showing it,
 * signing out and a reload.
 */
let agentWhHeld = null;
/**
 * ⚠ **THE SECRET, HELD IN MEMORY FOR AS LONG AS THE SCREEN SHOWS IT AND NOWHERE ELSE.**
 *
 * `agent.create_webhook` takes it and does not hand it back, and `agent.list_webhooks` never
 * selects the column — so the create's own answer is the ONE time it exists outside the
 * database, and if this screen does not put it in front of somebody it is gone for good.
 *
 * **NOT IN `localStorage`, NOT IN THE URL, AND NOT RE-READ FROM ANYWHERE.** A reload loses it,
 * deliberately: the alternative is a copy of a signing key sitting in a browser's storage
 * with nothing that ever cleans it up. The sentence beside it says so, because a person who
 * is not told will close the panel and come back for it.
 */
let agentWhSecret = null;

/**
 * ── ANSWERING AN APPROVAL ─────────────────────────────────────────────────────
 *
 * The note somebody is typing beside a waiting execution, keyed by run id, and which
 * press is in flight. **KEYED BY RUN**, because a history can show more than one waiting
 * execution and one string for the screen would put A's words under B.
 */
const agentAutoNotes = new Map();
let agentAutoDeciding = '';
/**
 * WHICH RUN IS BEING STOPPED RIGHT NOW, so the button says so and cannot be pressed twice.
 *
 * ⚠ **A SECOND PRESS IS HARMLESS EITHER WAY AND THIS IS NOT WHAT MAKES IT SO.**
 * `agent.cancel_run` refuses to write a second ending and answers what really happened, so
 * two presses are one cancellation in the database. This is the screen not asking twice.
 */
let agentAutoStopping = '';

/**
 * ── REFERENCE MATERIAL AND MEMORY ─────────────────────────────────────────────
 *
 * One screen per agent holding both, because they are the two kinds of thing an agent
 * KNOWS — and a separate door for each would be two places to look for the same question.
 * `null` for "not asked yet" against `[]` for "this agent has none", which is what makes
 * loading, empty and failed three screens rather than one.
 */
let agentKnow = null;          // which agent's reference material is open
let agentKnowRows = null;
let agentKnowErr = '';
let agentKnowCat = null;       // the bounds the list answered with
let agentKnowEditing = null;   // a source id, '' for a new one, null for the list
let agentKnowDraft = null;
let agentKnowBusy = false;
let agentKnowActErr = '';
let agentMemRows = null;
let agentMemErr = '';
let agentMemCat = null;
let agentMemDraft = null;      // {name, value} being added or corrected
let agentMemBusy = false;
let agentMemActErr = '';
/**
 * ⚠ WHAT A FORGET REACHED, IN THE DATABASE FUNCTION'S OWN WORDS.
 *
 * `agent.delete_memory` answers a sentence and `/api/agent/memory-delete` forwards it, and
 * this screen threw it away — so somebody pressed Forget, the row vanished, and nothing said
 * that a run already under way keeps what it started with and the history keeps whatever it
 * quoted. *Deleted is not erased*, which is the one thing a person needs told here, and the
 * whole chain existed except the last hop.
 *
 * **IT IS THE SERVER'S SENTENCE AND NEVER ONE OF OURS.** A fallback written here would be a
 * second account of what a delete does, in a second language, and the copy that drifts is the
 * one a person reads. A delete that answered no note shows none.
 */
let agentMemSaid = '';

const AGENT_THREAD_MAX = 200;

// ── automations: reading ────────────────────────────────────────────────────

/** The automation being edited, out of the list the server sent. */
const agentAutoRow = () => (agentAutoRows || []).find((a) => a.id === agentAutoEditing) || null;

/** An instant as a person reads it, or an em dash. Absolute, because "next run" is. */
function autoWhen(iso) {
  if (typeof iso !== 'string' || !iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  try { return new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return new Date(t).toISOString().slice(0, 16).replace('T', ' '); }
}

/** How an automation starts, in one line. */
function autoTrigger(a) {
  /**
   * ⚠ **IT SAID "Run now only" FOR EVERY SCHEDULE BUT `daily`, which was true of what the
   * form could make and false of the platform.** A weekly automation created in the chat read as
   * manual in the one place a person looks at the list — so the row and the row's own Edit form
   * disagreed about what starts it. Four schedules, four sentences, and the fifth (a schedule
   * this deployment does not know) says so rather than claiming it runs by hand.
   */
  if (!a || typeof a.schedule !== 'string' || a.schedule === 'manual') return 'Run now only';
  const when = (a.at || '—') + (a.zone ? ' (' + a.zone + ')' : '');
  if (a.schedule === 'daily') return 'Every day at ' + when;
  if (a.schedule === 'weekly') {
    const days = Array.isArray(a.days) ? a.days : [];
    return (days.length ? days.map(autoDayName).join(', ') : 'Chosen days') + ' at ' + when;
  }
  /**
   * ⚠ **A ONE-OFF WHOSE DAY HAS GONE SAYS SO, and the fact comes from the DATABASE rather than
   * from comparing the date here.** `automation_next_run` answers `null` for a `once` schedule
   * once its instant is past, so a missing `nextRunAt` on such a row IS "it will not run" — and
   * asking the browser's own clock would be a second answer that can disagree with the one the
   * scheduler acts on, across a time zone this screen does not hold.
   */
  if (a.schedule === 'once') {
    const gone = !a.nextRunAt ? ' \u2014 that date has passed, so it won\u2019t run' : '';
    return 'Once on ' + (a.onDate || 'a date') + ' at ' + when + gone;
  }
  return 'On a schedule this screen can\u2019t describe yet';
}

/** What the platform calls each step type, out of the catalog the server sent. */
function autoStepLabel(type) {
  const cat = (agentAutoCat && agentAutoCat.steps) || [];
  const def = cat.find((d) => d.type === type);
  return (def && def.label) || type || 'a step';
}

/**
 * One step, as a sentence.
 *
 * **IT READS THE STORED CONFIGURATION, NOT THE CATALOG'S DESCRIPTION.** "Only on
 * Mondays" and "Only on certain days" are different things to show somebody, and the
 * second one is what a step list full of the same words looks like.
 */
function autoStepLine(st) {
  if (!st || typeof st !== 'object') return 'a step this can’t read';
  if (st.type === 'weekday') {
    const days = Array.isArray(st.days) ? st.days : [];
    return days.length ? 'Only on ' + days.map(autoDayName).join(', ') : 'Only on certain days';
  }
  if (st.type === 'note') return 'Save a note: “' + String(st.text || '') + '”';
  return autoStepLabel(st.type);
}

const AUTO_DAY_NAMES = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' };
const autoDayName = (d) => AUTO_DAY_NAMES[d] || d;

/**
 * Load one agent's automations, and the catalog with them.
 *
 * ONE READ FOR THE WHOLE SCREEN — the list and what may be configured — because the
 * form is only reachable from here, so a catalog arriving separately would be a second
 * thing to fail and a second state to draw.
 */
async function agentAutoLoad(quiet) {
  const bound = agentBind();
  const forAgent = agentAuto;
  if (!quiet) { agentAutoState = 'loading'; agentAutoErr = ''; renderAgents(); }
  try {
    const res = await apiFetch('/api/agent/automations?agent=' + encodeURIComponent(forAgent));
    const j = await res.json().catch(() => ({}));
    // THE SCREEN MAY HAVE MOVED ON, or another account may be signed in. Writing this
    // answer into a screen showing another agent's automations would be showing somebody
    // a list that is not theirs.
    if (agentAuto !== forAgent || bound.uid !== agentUid()) return;
    if (!res.ok || !j.ok) {
      // A FAILED READ IS NOT AN EMPTY AGENT. The rows it had are left exactly as they
      // were, so an error does not look like everything having been deleted.
      agentAutoState = 'error';
      agentAutoErr = (j && j.error) || 'Couldn’t load the automations.';
    } else {
      agentAutoRows = Array.isArray(j.automations) ? j.automations : [];
      // ⚠ **EVERY CATALOG KEY THE ROUTE SENDS IS KEPT, and `maxInputs` was NOT — measured.**
      // It was dropped here while two readers below asked for it, so both fell through to a
      // hardcoded `8`. That agrees with `MAX_AUTOMATION_INPUTS` today, which is exactly why
      // nothing noticed: it is two copies of one number, and the day the server's cap moves
      // the form either offers a ninth input the server refuses or refuses one it allows.
      // *A value computed and never forwarded*, invisible because the fallback was right.
      agentAutoCat = {
        steps: Array.isArray(j.steps) ? j.steps : [], days: Array.isArray(j.days) ? j.days : [],
        max: j.max, maxInputs: j.maxInputs,
        // ⚠ **AN EXAMPLE THAT IS NOT A WHOLE WORKFLOW IS NO EXAMPLE.** An older Worker sends
        // no `example` key at all, and the button is simply not drawn — which is what this
        // screen did before the example existed. A half-read one would seed a form that
        // cannot save, which is worse than no button.
        example: (j.example && Array.isArray(j.example.steps) && j.example.steps.length) ? j.example : null,
      };
      agentAutoState = 'ready';
      agentAutoErr = '';
    }
  } catch {
    if (agentAuto !== forAgent || bound.uid !== agentUid()) return;
    agentAutoState = 'error';
    agentAutoErr = 'Couldn’t reach the server.';
  }
  renderAgents();
}

/**
 * The wanted execution, but only while it is about the history that is open.
 *
 * ONE READER, so the URL that asks for it, the sentence that names it and the marker on its
 * row cannot disagree about which run that is.
 */
function agentAutoWantedRun() {
  const w = agentAutoRunsWant;
  return w && w.of === agentAutoRunsFor ? w.run : '';
}

/**
 * One automation's history, newest first.
 *
 * ⚠ **AND THE WANTED RUN IS ASKED FOR ON EVERY READ, not only the first.** A want outside the
 * newest page is in the answer only because the route went and fetched it; a quiet reload —
 * the watcher's, or the one after a Stop — that dropped `run=` would drop that row and its
 * marker with it, so the run somebody pressed to see would vanish while they watched it.
 */
async function agentAutoRunsLoad(id, quiet, want) {
  const bound = agentBind();
  const forId = String(id || '');
  if (!forId) return;
  if (!quiet) {
    agentAutoRuns = null; agentAutoRunsErr = ''; agentAutoRunsFor = forId;
    /**
     * A FRESH OPEN REPLACES THE WANT, so opening a history by hand never inherits the mark from
     * an arrival somebody followed earlier.
     *
     * ⚠ **THIS AND THE `of` BINDING ARE TWO WALLS ON ONE PROPERTY, and it is MEASURED: neither
     * mutant dies alone.** With this line intact nothing stale can exist; with `of` intact a
     * stale one could not be read. Both are kept because they say different things — this one
     * that a want belongs to the open it was made in, `of` that it belongs to a HISTORY — and
     * the sweep mutates the PAIR. The three doors that also null it (`agentAutomations`,
     * `agentAutoBack`, the delete's success) are tidiness on top of both: with the history
     * closed, `agentAutoRunsFor` is `null` and nothing can read a want at all.
     */
    agentAutoRunsWant = want ? { of: forId, run: String(want) } : null;
    renderAgents();
  }
  const asked = agentAutoRunsWant && agentAutoRunsWant.of === forId ? agentAutoRunsWant.run : '';
  try {
    const res = await apiFetch('/api/agent/automation-history?id=' + encodeURIComponent(forId) +
      (asked ? '&run=' + encodeURIComponent(asked) : ''));
    const j = await res.json().catch(() => ({}));
    if (agentAutoRunsFor !== forId || bound.uid !== agentUid()) return;
    if (!res.ok || !j.ok) agentAutoRunsErr = (j && j.error) || 'Couldn’t load the history.';
    else { agentAutoRuns = Array.isArray(j.executions) ? j.executions : []; agentAutoRunsErr = ''; }
  } catch {
    if (agentAutoRunsFor !== forId || bound.uid !== agentUid()) return;
    agentAutoRunsErr = 'Couldn’t reach the server.';
  }
  renderAgents();
}

/**
 * Watch one automation's history for a few seconds after a Run now.
 *
 * **BOUNDED, AND IT STOPS ITSELF.** An execution of this milestone's steps finishes in
 * well under a second once the doorbell rings, so a handful of tries covers it and a
 * permanent poll would be a redraw every two seconds for as long as the screen is open.
 * **IT DOES NOT RUN WHILE THE FORM IS OPEN** — nothing may redraw a form behind
 * somebody, and saying that in one line is better than a rule about which inputs are
 * safe to replace.
 */
function agentAutoWatchStop() {
  if (agentAutoWatch !== null) { clearTimeout(agentAutoWatch); agentAutoWatch = null; }
}
function agentAutoWatchSoon(id, left) {
  agentAutoWatchStop();
  if (!(left > 0)) return;
  const bound = agentBind();
  agentAutoWatch = setTimeout(async () => {
    agentAutoWatch = null;
    // ASKED WHEN THE TIMER FIRES, not when it was armed: between the two, somebody can
    // open another agent, open the form, or sign in as somebody else.
    if (!agentSame(bound) || agentAutoRunsFor !== id || agentAutoEditing !== null) return;
    await agentAutoRunsLoad(id, true);
    if (agentAutoRunsFor === id && agentAutoEditing === null) agentAutoWatchSoon(id, left - 1);
  }, AUTO_WATCH_MS);
}

// ── automations: the form's own values ──────────────────────────────────────

/** A blank automation, and the shape every draft has. */
const autoBlank = () => ({ name: '', enabled: true, schedule: 'manual', at: '09:00', zone: autoGuessZone(),
  days: [], on_date: '', on_event: '', steps: [], inputs: [], gen: 0 });

/**
 * The browser's own zone, offered as the default.
 *
 * ASKED OF `Intl`, never guessed from an offset: an offset is not a zone, and two places
 * sharing one today part company in March. A browser that will not say answers `UTC`,
 * which the person can change.
 */
function autoGuessZone() {
  try { return new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
  catch { return 'UTC'; }
}

/**
 * Read the form out of the DOM.
 *
 * **THE TYPES COME OFF THE ROWS THEMSELVES**, so the draft can be rebuilt from the
 * screen alone — a step list held half in the DOM and half in a variable is two lists
 * that disagree the first time one of them is rewritten.
 */
function agentAutoValues() {
  const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
  const checked = (id) => { const el = document.getElementById(id); return !!(el && el.checked); };
  const rows = typeof document.querySelectorAll === 'function'
    ? [...document.querySelectorAll('[data-step-type]')] : [];
  const steps = rows.map((row) => {
    const type = (row.getAttribute && row.getAttribute('data-step-type')) || '';
    const st = { type };
    const fields = typeof row.querySelectorAll === 'function' ? [...row.querySelectorAll('[data-field]')] : [];
    for (const f of fields) {
      const name = (f.getAttribute && f.getAttribute('data-field')) || '';
      if (!name) continue;
      const kind = (f.getAttribute && f.getAttribute('data-kind')) || 'text';
      // ⚠ **A NUMBER BOX ANSWERS A STRING, AND THE SERVER REFUSES ONE.** "Refused, never
      // coerced" is the server's rule precisely so a bad value cannot slip through; the
      // form's job is to send what the control MEANS, and reading a number box as a number
      // is what the box is for. An empty one sends nothing rather than 0, because 0 is a
      // value somebody could have typed and an empty box is not an answer.
      if (kind === 'number') {
        const n = f.value === '' ? null : Number(f.value);
        if (n !== null && Number.isFinite(n)) st[name] = Math.trunc(n);
        continue;
      }
      // ⚠ **AN OPTIONAL CHOICE'S BLANK OPTION MEANS THE DEFAULT, AND SENDS NOTHING.**
      // A `<select>` always has a value, so without this every step would carry the first
      // option explicitly — which for an error path means every workflow the form saves
      // stores `on_error: "stop"`, bytes no workflow saved before it had, and the server's
      // "absent means the default" stops being reachable from the one door that matters.
      // Sending `""` instead would be a second way to say nothing on the wire.
      if (kind === 'choice' && f.value === '') continue;
      st[name] = f.value;
    }
    const days = typeof row.querySelectorAll === 'function' ? [...row.querySelectorAll('[data-day]')] : [];
    if (days.length) {
      st.days = days.filter((d) => d.checked)
                    .map((d) => (d.getAttribute && d.getAttribute('data-day')) || '')
                    .filter(Boolean);
    }
    return st;
  });
  // WHAT IT ASKS FOR WHEN IT IS STARTED, read off its own rows the same way the steps are.
  const inRows = typeof document.querySelectorAll === 'function'
    ? [...document.querySelectorAll('[data-input-row]')] : [];
  const inputs = inRows.map((row) => {
    const one = (sel) => (typeof row.querySelector === 'function' ? row.querySelector(sel) : null);
    const nm = one('[data-in="name"]');
    const lb = one('[data-in="label"]');
    const df = one('[data-in="default"]');
    const rq = one('[data-in="required"]');
    return {
      name: nm ? String(nm.value || '').trim().toLowerCase() : '',
      label: lb ? String(lb.value || '').trim() : '',
      default: df ? String(df.value || '') : '',
      required: !!(rq && rq.checked),
    };
  }).filter((d) => d.name !== '');
  /**
   * ⚠ **THE DAYS A SCHEDULE RUNS ON ARE READ FROM `data-sched-day` AND NOT FROM `data-day`.**
   * The weekday STEP already uses `data-day`, and its reader is scoped to that step's own row —
   * so the two would not collide today. A distinct attribute is what keeps that true if either
   * scan is ever widened, and it says which of the two a checkbox belongs to at the markup.
   */
  const schedDays = typeof document.querySelectorAll === 'function'
    ? [...document.querySelectorAll('[data-sched-day]')] : [];
  return {
    name: val('agAutoName').trim().slice(0, AGENT_NAME_MAX),
    // OFF is what the box says, so the control and the value cannot disagree.
    enabled: !checked('agAutoOff'),
    // ⚠ **A SCHEDULE THE FORM DOES NOT OFFER READS AS `manual`, and that is the wall rather
    // than a coercion.** A `<select>` always answers one of its own options, so the only way a
    // value outside the list arrives is a markup change — and `agentAutoUnshowable` refuses the
    // save before this is reached for any stored schedule the list does not carry.
    schedule: AGENT_FORM_SCHEDULES.indexOf(val('agAutoSched')) >= 0 ? val('agAutoSched') : 'manual',
    at: val('agAutoAt') || '09:00',
    zone: val('agAutoZone').trim(),
    // THE WEEK'S OWN ORDER, never the ticking order, so two savings of one selection are the
    // same body — which is what lets `autoSame` read an untouched day list as unchanged.
    days: schedDays.filter((d) => d.checked)
                   .map((d) => (d.getAttribute && d.getAttribute('data-sched-day')) || '')
                   .filter(Boolean),
    on_date: val('agAutoDate').trim(),
    // AN EMPTY BOX IS THE REMOVAL, which is what makes this control able to take a binding OFF
    // as well as put one on. `cleanPatch` reads a blank as `null`, so the two doors agree.
    on_event: val('agAutoEvent').trim(),
    steps, inputs,
  };
}

/**
 * Put whatever is on screen into the draft, before anything redraws it.
 *
 * ⚠ **ONLY WHEN THE FORM ON SCREEN IS A DRAWING OF THE DRAFT THIS HOLDS, and that
 * condition is the whole of why adding a step works.** Found in a real browser and by
 * nothing else: pressing "+ Save a note" builds a NEW draft with one more step and asks
 * for a redraw — and this ran first, read the form that is still showing the OLD step
 * list, and wrote it straight back over the step just added. Zero steps, every time,
 * with every unit case passing.
 *
 * A generation number is what tells them apart. The form carries the one it was drawn
 * with; a structural change bumps the draft's. They agree exactly when the screen is
 * showing what this variable holds, which is the only state in which reading the screen
 * back is right. A step COUNT would not do it — reordering keeps the count.
 */
function agentAutoFormRead() {
  if (agentAuto === null || agentAutoEditing === null) return;
  const form = document.getElementById('agAutoForm');
  if (!form) return;                                    // the form is not drawn
  // ⚠ **A FORM THAT DECLARES NO GENERATION IS NOT ONE THIS READ MAY TRUST.** `|| '0'`
  // turned "there is no attribute" into generation zero — which is exactly what a fresh
  // draft holds — so an element found before the form had ever been drawn passed the
  // gate and the draft was overwritten with an EMPTY form. Cannot-tell must never read
  // as a value, and the value it read as was the one that always matches.
  const drawn = form.getAttribute ? form.getAttribute('data-gen') : null;
  // A DECLARED REDUNDANCY, and it is mutated as a PAIR because on its own it is INERT:
  // with `|| '0'` gone, `null !== String(gen)` already returns. It stays because the
  // two say different things — that line is about the DEFAULT, this one about the
  // STATE — and the one a later edit reaches for is the default.
  if (drawn === null) return;                           // nothing has drawn it yet
  if (drawn !== String(autoGen(agentAutoDraft))) return; // it is older than what we hold
  agentAutoDraft = { ...agentAutoValues(), gen: autoGen(agentAutoDraft) };
}

/** Which drawing of the form a draft is. Absent is 0, so a stored automation starts there. */
const autoGen = (d) => (d && Number.isFinite(d.gen) ? d.gen : 0);

/**
 * Change the SHAPE of the workflow — add a step, move one, take one out.
 *
 * ONE DOOR FOR ALL THREE, so none of them can forget the order that makes it work:
 * read what is on screen, apply the change to THAT, and mark the drawing stale.
 */
function agentAutoStructural(mutate) {
  agentAutoFormRead();                    // whatever is typed, before anything moves
  const draft = agentAutoForm();
  const next = mutate(draft);
  if (!next) return;
  agentAutoDraft = { ...next, gen: autoGen(draft) + 1 };
  agentAutoSaved = false;
  // ⚠ **A CHECK'S ANSWER IS ABOUT THE WORKFLOW IT WAS ASKED ABOUT, so a structural change
  // throws it away.** Left on screen it would say "nothing is missing" about a list somebody
  // has since added a step to — a control that ANSWERS, wrongly, which is the worst shape of
  // the dead-control finding this repository records.
  agentAutoCheck = null;
  renderAgents();
}

/** The draft, or the stored automation, or a blank one — in that order. */
function agentAutoForm() {
  if (agentAutoDraft) return agentAutoDraft;
  const cur = agentAutoRow();
  if (!cur) return autoBlank();
  /**
   * ⚠ **THE ROW ANSWERS `onDate`/`onEvent` AND THE WIRE WANTS `on_date`/`on_event`, so the
   * translation happens HERE, once.** `automationRow` is the reader and `cleanPatch`/`cleanSchedule`
   * are the writers, and they spell these two differently — a camel-cased key on the wire is a
   * field the server ignores, which this repository has already shipped once and measured.
   */
  return {
    name: cur.name, enabled: cur.enabled, schedule: cur.schedule,
    at: cur.at || '09:00', zone: cur.zone || autoGuessZone(),
    days: Array.isArray(cur.days) ? cur.days.slice() : [],
    on_date: cur.onDate || '', on_event: cur.onEvent || '',
    steps: (cur.steps || []).map((st) => ({ ...st })),
    inputs: (cur.inputs || []).map((d) => ({ ...d })),
    gen: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// REFERENCE MATERIAL AND MEMORY — two lists, one screen
//
// **THE TWO READS ARE SEPARATE AND BOTH ARE STARTED AT ONCE.** One request answering both
// would make a failure in either hide the other, and they are different things a person
// manages independently — a failed search corpus should not empty the preferences panel.
//
// ⚠ **A FAILED READ IS NOT AN EMPTY AGENT**, in both of them: the rows that were there stay
// exactly as they were, so an error never reads as everything having been deleted.
// ═══════════════════════════════════════════════════════════════════════════

async function agentKnowLoad(quiet) {
  const bound = agentBind();
  const forAgent = agentKnow;
  if (!quiet) { agentKnowErr = ''; renderAgents(); }
  try {
    const res = await apiFetch('/api/agent/knowledge?agent=' + encodeURIComponent(forAgent));
    const j = await res.json().catch(() => ({}));
    if (agentKnow !== forAgent || bound.uid !== agentUid()) return;
    if (!res.ok || !j.ok) agentKnowErr = (j && j.error) || 'Couldn’t load the reference material.';
    else {
      agentKnowRows = Array.isArray(j.sources) ? j.sources : [];
      agentKnowCat = { max: j.max, bodyMax: j.bodyMax, formats: Array.isArray(j.formats) ? j.formats : ['text'] };
      agentKnowErr = '';
    }
  } catch {
    if (agentKnow !== forAgent || bound.uid !== agentUid()) return;
    agentKnowErr = 'Couldn’t reach the server.';
  }
  renderAgents();
}

async function agentMemLoad(quiet) {
  const bound = agentBind();
  const forAgent = agentKnow;
  if (!quiet) { agentMemErr = ''; renderAgents(); }
  try {
    const res = await apiFetch('/api/agent/memory?agent=' + encodeURIComponent(forAgent));
    const j = await res.json().catch(() => ({}));
    if (agentKnow !== forAgent || bound.uid !== agentUid()) return;
    if (!res.ok || !j.ok) agentMemErr = (j && j.error) || 'Couldn’t load what it remembers.';
    else {
      agentMemRows = Array.isArray(j.memories) ? j.memories : [];
      agentMemCat = { max: j.max, valueMax: j.valueMax };
      agentMemErr = '';
    }
  } catch {
    if (agentKnow !== forAgent || bound.uid !== agentUid()) return;
    agentMemErr = 'Couldn’t reach the server.';
  }
  renderAgents();
}

function agentKnows(id) {
  agentPollStop(); agentAutoWatchStop();
  agentKnow = String(id || '');
  agentKnowRows = null; agentKnowErr = ''; agentKnowEditing = null; agentKnowDraft = null; agentKnowActErr = '';
  agentMemRows = null; agentMemErr = ''; agentMemDraft = null; agentMemActErr = ''; agentMemSaid = '';
  agentKnowLoad();
  agentMemLoad(true);
}
function agentKnowBack() {
  agentKnow = null; agentKnowRows = null; agentMemRows = null;
  agentKnowEditing = null; agentKnowDraft = null; renderAgents();
}
function agentKnowNew() { agentKnowEditing = ''; agentKnowDraft = null; agentKnowActErr = ''; renderAgents(); }
function agentKnowCancel() { agentKnowEditing = null; agentKnowDraft = null; agentKnowActErr = ''; renderAgents(); }

/**
 * Open one source for editing — which needs its MATERIAL, and the list does not carry it.
 *
 * **THE LIST DELIBERATELY HAS NO BODIES** (twenty sources at 200,000 characters is four
 * megabytes to draw a few lines), so opening one is a read. Until it arrives the form shows
 * what the list knows and says it is loading, rather than an empty box that looks like a
 * document somebody has lost.
 */
async function agentKnowEdit(id) {
  const target = String(id || '');
  const bound = agentBind();
  agentKnowEditing = target; agentKnowActErr = '';
  const row = (agentKnowRows || []).find((k) => k.id === target) || null;
  agentKnowDraft = { title: (row && row.title) || '', body: null, format: (row && row.format) || 'text' };
  renderAgents();
  try {
    const res = await apiFetch('/api/agent/knowledge?agent=' + encodeURIComponent(agentKnow) + '&source=' + encodeURIComponent(target));
    const j = await res.json().catch(() => ({}));
    if (agentKnowEditing !== target || bound.uid !== agentUid()) return;
    const one = (Array.isArray(j.sources) ? j.sources : []).find((k) => k.id === target);
    agentKnowDraft = {
      title: (one && one.title) || (row && row.title) || '',
      body: one && typeof one.body === 'string' ? one.body : '',
      format: (one && one.format) || (row && row.format) || 'text',
    };
  } catch {
    if (agentKnowEditing !== target || bound.uid !== agentUid()) return;
    agentKnowActErr = 'Couldn’t load that source’s text.';
  }
  renderAgents();
}

/** Read the source form back, so a redraw cannot lose a document somebody is typing. */
function agentKnowFormRead() {
  if (agentKnowEditing === null) return;
  const t = document.getElementById('agKnowTitle');
  const b = document.getElementById('agKnowBody');
  const f = document.getElementById('agKnowFormat');
  if (!t && !b) return;
  agentKnowDraft = {
    title: t ? String(t.value || '') : ((agentKnowDraft && agentKnowDraft.title) || ''),
    body: b ? String(b.value || '') : ((agentKnowDraft && agentKnowDraft.body) || ''),
    format: f ? String(f.value || 'text') : ((agentKnowDraft && agentKnowDraft.format) || 'text'),
  };
}

async function agentKnowSave() {
  agentKnowFormRead();
  const d = agentKnowDraft || { title: '', body: '', format: 'text' };
  const say = (m) => { agentKnowActErr = m; renderAgents(); };
  if (!String(d.title || '').trim()) { say('Give the source a name, so an answer can say where it came from.'); return; }
  if (!String(d.body || '').trim()) { say('There’s nothing in that source to read.'); return; }
  const bound = agentBind();
  const editing = agentKnowEditing;
  const forAgent = agentKnow;
  agentKnowBusy = true; agentKnowActErr = ''; renderAgents();
  let failed = '';
  try {
    const res = await apiFetch('/api/agent/knowledge-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing
        ? { id: editing, title: d.title, body: d.body, format: d.format }
        : { agent: forAgent, title: d.title, body: d.body, format: d.format }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t save that.';
  } catch { failed = 'Couldn’t reach the server.'; }
  agentKnowBusy = false;
  if (!agentSame(bound) || agentKnow !== forAgent) { renderAgents(); return; }
  if (failed) { agentKnowActErr = failed; renderAgents(); return; }
  agentKnowEditing = null; agentKnowDraft = null;
  await agentKnowLoad(true);
}

async function agentKnowDelete(id) {
  const target = String(id || '');
  const bound = agentBind();
  agentKnowBusy = true; agentKnowActErr = ''; renderAgents();
  let failed = '';
  try {
    const res = await apiFetch('/api/agent/knowledge-delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: target }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t delete that.';
  } catch { failed = 'Couldn’t reach the server.'; }
  agentKnowBusy = false;
  if (!agentSame(bound) || agentKnow === null) { renderAgents(); return; }
  if (failed) { agentKnowActErr = failed; renderAgents(); return; }
  agentKnowEditing = null; agentKnowDraft = null;
  await agentKnowLoad(true);
}

/** Read the memory form back. One row, two boxes, and the same rule as everywhere else. */
function agentMemFormRead() {
  const n = document.getElementById('agMemName');
  const v = document.getElementById('agMemValue');
  if (!n && !v) return;
  agentMemDraft = {
    name: n ? String(n.value || '') : ((agentMemDraft && agentMemDraft.name) || ''),
    value: v ? String(v.value || '') : ((agentMemDraft && agentMemDraft.value) || ''),
  };
}

/** Correcting one puts it in the boxes; saving over the same name is the correction. */
function agentMemEdit(key, value) {
  agentMemDraft = { name: String(key || ''), value: String(value || '') };
  agentMemActErr = '';
  renderAgents();
}

async function agentMemSave() {
  agentMemFormRead();
  const d = agentMemDraft || { name: '', value: '' };
  const say = (m) => { agentMemActErr = m; renderAgents(); };
  if (!String(d.name || '').trim()) { say('Give it a name, so a step can ask for it.'); return; }
  if (!String(d.value || '').trim()) { say('Say what to remember. To forget it, delete it instead.'); return; }
  const bound = agentBind();
  const forAgent = agentKnow;
  agentMemBusy = true; agentMemActErr = ''; agentMemSaid = ''; renderAgents();
  let failed = '';
  try {
    const res = await apiFetch('/api/agent/memory-save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: forAgent, name: d.name, value: d.value }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t save that.';
  } catch { failed = 'Couldn’t reach the server.'; }
  agentMemBusy = false;
  if (!agentSame(bound) || agentKnow !== forAgent) { renderAgents(); return; }
  if (failed) { agentMemActErr = failed; renderAgents(); return; }
  // SAVED, so the boxes are cleared — they are a new memory's boxes, not this one's.
  agentMemDraft = null;
  await agentMemLoad(true);
}

async function agentMemDelete(key) {
  const name = String(key || '');
  const bound = agentBind();
  const forAgent = agentKnow;
  agentMemBusy = true; agentMemActErr = ''; agentMemSaid = ''; renderAgents();
  let failed = '';
  let reached = '';
  try {
    const res = await apiFetch('/api/agent/memory-delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: forAgent, name }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t delete that.';
    // ⚠ WHAT THE DELETE SAID IT REACHED, kept rather than dropped. The route forwards
    // `agent.delete_memory`'s own sentence and this read it as far as `j.error` and no
    // further, so the one fact a person needs — that forgetting does not reach a run already
    // going or the history it quoted — reached nobody.
    else if (typeof j.note === 'string' && j.note.trim()) reached = j.note.trim();
  } catch { failed = 'Couldn’t reach the server.'; }
  agentMemBusy = false;
  if (!agentSame(bound) || agentKnow !== forAgent) { renderAgents(); return; }
  if (failed) { agentMemActErr = failed; renderAgents(); return; }
  // NAMED, because the list is about to redraw without it and "forgot tone" is the only thing
  // tying the sentence to what was pressed. A delete that answered no sentence says only that
  // much: inventing the rest here is the second copy this fix exists to remove.
  agentMemSaid = 'Forgot “' + name + '”' + (reached ? ' — ' + reached : '.');
  await agentMemLoad(true);
}

// ── automations: what the buttons do ────────────────────────────────────────

function agentAutomations(id) {
  agentPollStop();
  // ⚠ AND THE OTHER WAY ROUND — see `agentConnections`. No two screens over one conversation
  // can be open, and each clearing the others is what says so.
  agentConn = null; agentConnNew = false; agentConnDraft = null;
  agentWh = null; agentWhOpenForm(false);
  agentAuto = String(id || '');
  agentAutoOpenForm(null);
  agentAutoRows = null; agentAutoRuns = null; agentAutoRunsFor = null; agentAutoRunsWant = null;
  agentAutoLoad();
}
/**
 * OPEN THE FORM ON ONE AUTOMATION, OR CLOSE IT — the single writer of which one is open.
 *
 * ⚠ **IT NULLS THE BASELINE AND THE CHECK, and three doors used not to.** `agentAutoBack`, the
 * success path of `agentAutoDelete` and `agentAutoExample` each changed which automation the form
 * was about and left `agentAutoWas` (and, in the example's case, `agentAutoCheck`) from whatever
 * was open before — harmless while a create ignored the baseline, and load-bearing now that both
 * drawn answers are DERIVED from it. `agentAutoSaved` is reset here for the same reason: it is
 * not about the form being opened, and "Saved." drawn over one nobody has saved is the dead
 * control that ANSWERS.
 *
 * `null` closes it; `''` is a new one; anything else is that automation's id.
 */
function agentAutoOpenForm(editing) {
  agentAutoOpen++;
  agentAutoEditing = editing === null ? null : String(editing);
  agentAutoDraft = null; agentAutoWas = null; agentAutoCheck = null;
  agentAutoActErr = ''; agentAutoSaved = false;
}

function agentAutoBack() {
  agentAutoWatchStop();
  const back = agentAuto;
  agentAuto = null; agentAutoOpenForm(null);
  agentAutoRunsFor = null; agentAutoRuns = null; agentAutoRunsWant = null;
  // BACK TO THE CONVERSATION IT BELONGS TO, which is where this was opened from.
  if (back) agentOpen(back); else renderAgents();
}
function agentAutoNew() { agentAutoWatchStop(); agentAutoOpenForm(''); renderAgents(); }

/** The worked example the server offers, or `null` when it sent none. */
function autoExample() { return (agentAutoCat && agentAutoCat.example) || null; }

/**
 * START FROM THE EXAMPLE — a SEED for the form, never a template anybody is stuck with.
 *
 * ⚠ **IT OPENS THE SAME NEW-AUTOMATION FORM A BLANK ONE OPENS, with the draft filled in**, so
 * there is no second editor and nothing is read-only: the person can change a word, swap a
 * step or delete the lot before saving. An example that could not be edited would be a demo.
 *
 * ⚠ **THE SEND STEP'S CONNECTION IS FILLED FROM THE FIRST ACCOUNT OF THIS AGENT'S THAT COULD
 * REALLY CARRY A SEND, and left EMPTY when there is none.** The example carries no connection
 * deliberately — an id belongs to one account and cannot be invented — and an empty one is what
 * the form's own refusal names (*say which connected account to send from*), which is
 * actionable. Filling it with anything else would be seeding somebody else's account.
 *
 * ⚠ **AND "COULD REALLY CARRY A SEND" IS TWO CONDITIONS, BOTH READ OFF THE SERVER'S ANSWER.**
 * The account has to be `active` — a connection whose credential has run out, whose access the
 * provider withdrew, or which somebody disconnected cannot send, and seeding one is a form that
 * saves and then fails at its last step. And it has to hold the permission a send needs, which
 * is the provider's own `sendScope`: an account connected for READING only is active and cannot
 * send, so status alone would offer it.
 */
function agentConnSendable(rows, providers) {
  const cat = Array.isArray(providers) ? providers : [];
  for (const c of (Array.isArray(rows) ? rows : [])) {
    // THE ANSWER'S OWN FIELD. `connectionRow` names this `status`; there is no `state` on it.
    if (!c || c.status !== 'active') continue;
    const p = cat.find((x) => x && x.name === c.provider);
    const needs = p && typeof p.sendScope === 'string' ? p.sendScope : '';
    // ⚠ CANNOT-TELL IS NOT A YES. A provider this answer does not describe, or one that names
    // no send scope (a Worker older than that field), leaves us unable to say the account may
    // send — so it is not offered, and the form's own refusal names the box to fill in.
    if (!needs) continue;
    if (!Array.isArray(c.scopes) || !c.scopes.includes(needs)) continue;
    return typeof c.id === 'string' ? c.id : '';
  }
  return '';
}

async function agentAutoExample() {
  const eg = autoExample();
  if (!eg) return;
  /**
   * ⚠ **THE CONNECTIONS ARE READ FOR THIS AGENT, HERE, AND NEVER TAKEN FROM `agentConnRows`.**
   * That variable belongs to the connected-accounts SCREEN and is scoped to `agentConn`, which
   * `agentAutomations` sets to `null` on the way in WITHOUT clearing the rows — so reading it
   * meant seeding from whichever agent's accounts had last been looked at, or from nothing at
   * all if none had. It is the same route the screen itself reads, so there is one backend
   * answer to *what has this agent connected* whichever door asks.
   */
  const bound = agentBind();
  const forAgent = agentAuto;
  const ask = ++agentAutoEgAsk;
  let rows = null, cat = null;
  try {
    const res = await apiFetch('/api/agent/connections?agent=' + encodeURIComponent(forAgent));
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.ok) { rows = j.connections; cat = j.providers; }
  } catch { /* a read we could not make seeds no connection — see below */ }
  // THE PRESS, THE PERSON AND THE AGENT, all three asked once, after the request.
  if (ask !== agentAutoEgAsk || agentAuto !== forAgent || bound.uid !== agentUid()) return;
  /**
   * ⚠ **A FAILED READ SEEDS NO CONNECTION, and it does not refuse to seed the example.** The
   * workflow is what the button is for and the connection is the one field a person fills in
   * anyway, so an outage costs them a pick rather than the example; and an account we could
   * not establish must never be picked, which is what `rows: null` through the filter answers.
   */
  const pick = agentConnSendable(rows, cat);
  agentAutoWatchStop();
  agentAutoOpenForm('');
  agentAutoDraft = {
    name: typeof eg.name === 'string' ? eg.name : '',
    enabled: true,
    schedule: typeof eg.schedule === 'string' ? eg.schedule : 'manual',
    at: '09:00', zone: autoGuessZone(),
    /**
     * ⚠ **EVERY TRIGGER FIELD THE FORM DRAWS, BECAUSE THE MARKUP ECHOES WHAT IS NOT THERE.**
     * These three were absent, so the boxes were drawn `value="undefined"` — MEASURED on the
     * real example: `id="agAutoDate"` and `id="agAutoEvent"` both held the literal string,
     * the next form read put it into the draft, and a save from the example carried
     * `on_event: "undefined"` — which `cleanSchedule` ACCEPTS, binding the automation to an
     * event named `undefined`. Pre-existing, and found while fixing the baseline beside it.
     */
    days: Array.isArray(eg.days) ? eg.days.slice() : [],
    on_date: typeof eg.onDate === 'string' ? eg.onDate : '',
    on_event: typeof eg.onEvent === 'string' ? eg.onEvent : '',
    // COPIED, not referenced: the server's answer must not be edited in place, or a second
    // press of the button would offer whatever the last one was changed into.
    steps: (Array.isArray(eg.steps) ? eg.steps : []).map((st) => {
      const copy = { ...st };
      // ⚠ **`!copy.connection` IS A DECLARED SECOND WALL AND IS MEASURED INERT TODAY.** The
      // example is censused as carrying no connection at all, so this test is true for every
      // send it can hold — driven over the real object and over five falsy shapes, all
      // byte-identical with it and without. What separates the two readings is an example
      // that ALREADY names one, which is exactly what the census forbids. It stays because it
      // says out loud that a seed may never replace a choice somebody made, and the sweep
      // mutates the OBSERVABLE half of this line (the fill never happening) instead.
      if (copy.type === 'send' && !copy.connection) copy.connection = pick;
      return copy;
    }),
    inputs: (Array.isArray(eg.inputs) ? eg.inputs : []).map((d) => ({ ...d })),
    gen: 0,
  };
  renderAgents();
}
function agentAutoEdit(id) { agentAutoWatchStop(); agentAutoOpenForm(id || ''); renderAgents(); }
function agentAutoCancel() { agentAutoOpenForm(null); renderAgents(); }
function agentAutoReload() { agentAutoLoad(); }
function agentAutoHistory(id, want) {
  agentAutoWatchStop();
  const target = String(id || '');
  // A SECOND PRESS CLOSES IT, so the row is a toggle and not a one-way door. ⚠ AND IT CLOSES
  // WITHOUT REOPENING EVEN WHEN A RUN IS NAMED: a press is a press, and the want goes with
  // the history it was about.
  if (agentAutoRunsFor === target) {
    agentAutoRunsFor = null; agentAutoRuns = null; agentAutoRunsWant = null;
    renderAgents(); return;
  }
  agentAutoRunsLoad(target, false, want);
}

/** Add a step of one type, with the catalog's own fields empty. */
function agentAutoStepAdd(type) {
  agentAutoStructural((draft) => {
    const max = (agentAutoCat && agentAutoCat.max) || 20;
    if (draft.steps.length >= max) {
      agentAutoActErr = 'That’s as many steps as one automation can hold (' + max + ').';
      renderAgents();
      return null;
    }
    // ⚠ **SEEDED FROM THE CATALOG, NOT FROM A LIST OF TYPES HERE.** This was two `if`s
    // naming `weekday` and `note`, which is a third copy of the catalog — and a step type
    // added to it would arrive with none of its fields set, be refused by the first Save,
    // and read as a broken control. What each kind's blank value IS, is a property of the
    // kind: a choice starts on its first option because that is what the control draws, a
    // day list starts on one day because an empty one is refused, and everything else
    // starts empty.
    const st = { type: String(type || '') };
    const def = ((agentAutoCat && agentAutoCat.steps) || []).find((d) => d.type === st.type);
    for (const fd of (def && def.fields) || []) {
      if (fd.kind === 'days') st[fd.name] = ['mon'];
      // ⚠ A REQUIRED CHOICE STARTS ON ITS FIRST OPTION, because the control draws one
      // either way and nothing selected would save whichever happened to be first. An
      // OPTIONAL one starts on NOTHING, because there absent is a real answer the server
      // owns — and seeding it would make a new step store a default nobody chose.
      else if (fd.kind === 'choice') { if (fd.required === true) st[fd.name] = (fd.options || [])[0]; }
      else if (fd.kind === 'number') st[fd.name] = fd.min === undefined ? 1 : fd.min;
      else if (fd.kind === 'time') st[fd.name] = '09:00';
      else if (fd.kind === 'name') st[fd.name] = '';
      else st[fd.name] = '';
    }
    agentAutoActErr = '';
    return { ...draft, steps: [...draft.steps, st] };
  });
}
/** Move one step, or take it out. The ORDER is the workflow, so this is the workflow. */
function agentAutoStepMove(at, by) {
  agentAutoStructural((draft) => {
    const i = Number(at);
    const to = i + Number(by);
    if (!(i >= 0 && i < draft.steps.length) || !(to >= 0 && to < draft.steps.length)) return null;
    const steps = [...draft.steps];
    const [one] = steps.splice(i, 1);
    steps.splice(to, 0, one);
    return { ...draft, steps };
  });
}
function agentAutoStepDrop(at) {
  agentAutoStructural((draft) => {
    const i = Number(at);
    if (!(i >= 0 && i < draft.steps.length)) return null;
    return { ...draft, steps: draft.steps.filter((_, n) => n !== i) };
  });
}

/**
 * The same three, for what the automation asks for.
 *
 * **THROUGH `agentAutoStructural` TOO**, and that is the whole reason they are here rather
 * than inline: adding an input is a change to the form's SHAPE, so it has to read what is
 * typed, apply the change to that, and mark the drawing stale — exactly as adding a step
 * does. Written any other way it would wipe the row somebody was half way through.
 */
function agentAutoInputAdd() {
  agentAutoStructural((draft) => {
    const max = (agentAutoCat && agentAutoCat.maxInputs) || 8;
    const ins = draft.inputs || [];
    if (ins.length >= max) {
      agentAutoActErr = 'That’s as many things as one automation can ask for (' + max + ').';
      renderAgents();
      return null;
    }
    agentAutoActErr = '';
    return { ...draft, inputs: [...ins, { name: '', label: '', default: '', required: false }] };
  });
}
function agentAutoInputMove(at, by) {
  agentAutoStructural((draft) => {
    const ins = draft.inputs || [];
    const i = Number(at);
    const to = i + Number(by);
    if (!(i >= 0 && i < ins.length) || !(to >= 0 && to < ins.length)) return null;
    const next = [...ins];
    const [one] = next.splice(i, 1);
    next.splice(to, 0, one);
    return { ...draft, inputs: next };
  });
}
function agentAutoInputDrop(at) {
  agentAutoStructural((draft) => {
    const ins = draft.inputs || [];
    const i = Number(at);
    if (!(i >= 0 && i < ins.length)) return null;
    return { ...draft, inputs: ins.filter((_, n) => n !== i) };
  });
}

/**
 * Check what is on the form without saving it.
 *
 * ⚠ **IT SENDS THE WHOLE SHAPE, unlike the save, and that is not an inconsistency.** A save
 * sends what CHANGED because writing a field this browser read minutes ago is how another
 * browser's edit gets reverted. A check writes nothing at all, so there is nothing to revert —
 * and asking about a patch would be asking about a workflow nobody has, since the answer
 * depends on the steps and the declarations TOGETHER. So it asks about exactly what is on
 * screen, which is what the person wants to know about.
 *
 * ⚠ **A STRUCTURAL REFUSAL IS DRAWN WHERE A SAVE'S IS AND HELD WHERE A CHECK'S IS, and the
 * two halves of that are separate.** It is DRAWN through `agentAutoErrShown`, the one reader both
 * the bottom line and the step marker go through — a second place for the same kind of sentence
 * would be two accounts of one fact, and the marking would only work through one of them. It is
 * HELD on `agentAutoCheck`, because it is a statement ABOUT A CONFIGURATION and `agentAutoActErr`
 * is a remembered string with no configuration on it: written there, a refusal answered late
 * landed on whatever the workflow had become, and once drawn it could not go away when the step
 * it named was corrected.
 *
 * ⚠ **A REQUEST FAILURE IS NOT ONE OF THOSE, so it stays where a save's does.** *"Couldn't reach
 * the server"* is a fact about the request and not about the steps, so a keystroke must leave it —
 * unbinding it on an edit would read as the problem having gone away. What bounds it is the wall
 * below, which is about the screen rather than about the workflow.
 *
 * ⚠ **AND IT IS NOT PERMISSION.** Nothing is recorded anywhere, so a save cannot read "this
 * was checked" — it reads every field again, and a run checks ownership, permissions, approval
 * and limits again after that. The answer says so, and so does the panel.
 */
async function agentAutoCheckNow() {
  if (agentAuto === null) return;
  /**
   * ⚠ **THE CONFIGURATION THIS CHECK IS ABOUT, TAKEN BEFORE ANYTHING AWAITS.** An answer is only
   * ever about the workflow it was asked about, and nothing in the walls below is a question
   * about the steps: the account, the agent and the open automation can all be unchanged while
   * the workflow itself has changed under it. So the answer carries this, and the panel is drawn
   * only where it still applies.
   */
  /**
   * ⚠ **THROUGH THE SAME READ-FIRST DOOR THE SAVE GOES THROUGH, and that is what makes the
   * binding above robust rather than merely correct.** Reading the DOM directly would make the
   * panel's own visibility depend on a draft → markup → read round trip being structurally
   * identical in every browser; through the door, both sides of the comparison are the DRAFT, and
   * a read the generation gate legitimately refuses compares it with itself.
   */
  agentAutoFormRead();
  const asked = autoSnap(agentAutoForm());
  const bound = agentBind();
  const forAgent = agentAuto;
  const editing = agentAutoEditing;
  // WHICH OPENING OF THE FORM THIS PRESS BELONGS TO — the save's own wall, for the same reason:
  // `editing` is `''` on every opening of a create, so it cannot tell two of them apart.
  const opened = agentAutoOpen;
  agentAutoBusy = true; agentAutoActErr = ''; agentAutoCheck = null; renderAgents();
  let failed = '';
  let answer = null;
  try {
    const res = await apiFetch('/api/agent/automation-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: forAgent, ...asked }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t check that.';
    else answer = j;
  } catch { failed = 'Couldn’t reach the server.'; }

  // THE SCREEN MAY HAVE MOVED ON, exactly as on a save: writing an answer into a form
  // somebody has since opened, or into another account's, is acting on another screen. ALL THREE
  // OUTCOMES ARE BEHIND IT — a refusal and a failure are as capable of arriving late as a success,
  // and two of them used to be written past it because they were written straight into a string.
  if (!agentSame(bound) || agentAuto !== forAgent || agentAutoEditing !== editing
      || agentAutoOpen !== opened) {
    agentAutoBusy = false; renderAgents(); return;
  }
  agentAutoBusy = false;
  if (failed) { agentAutoActErr = failed; renderAgents(); return; }
  // ⚠ A STRUCTURAL PROBLEM RIDES ON THE ANSWER IT IS, carrying the configuration it is about —
  // so it is drawn only where it is still true, and the step marking still works through the one
  // reader every refusal on this form goes through.
  if (answer && answer.error) {
    agentAutoCheck = { error: String(answer.error), of: asked };
    renderAgents();
    return;
  }
  agentAutoCheck = {
    steps: Number.isInteger(answer && answer.steps) ? answer.steps : 0,
    needs: Array.isArray(answer && answer.needs) ? answer.needs : [],
    unchecked: Array.isArray(answer && answer.unchecked) ? answer.unchecked : [],
    // ⚠ WHAT IT IS AN ANSWER ABOUT. A result with no configuration on it is one that can be
    // drawn over any workflow, which is what it was.
    of: asked,
  };
  renderAgents();
}

/**
 * Save it — a create or an edit, and the same body either way.
 *
 * **THE DRAFT IS KEPT BEFORE ANYTHING CAN FAIL**, including the refusals below: the
 * panel is redrawn to show a sentence, and without this the words would be gone by the
 * time the sentence appeared.
 */
async function agentAutoSave() {
  // THROUGH THE SAME GATE, so a Save pressed straight after adding a step sends the
  // step rather than the form that has not been redrawn with it yet.
  agentAutoFormRead();
  const values = agentAutoForm();
  agentAutoDraft = values;
  agentAutoSaved = false;
  const say = (m) => { agentAutoActErr = m; renderAgents(); };
  if (!values.name) { say('Give it a name first.'); return; }
  // ⚠ **A SCHEDULE THIS FORM CANNOT SHOW MUST NOT BE ANSWERED BY WHAT IT CAN.** The select
  // answers its FIRST option for a stored schedule it does not offer, which is a WRONG value
  // rather than a missing one — so the save would ask for a schedule nobody chose.
  //
  // **TWO CLAUSES THAT USED TO CLOSE THIS PARAGRAPH ARE NO LONGER TRUE, so they are gone.** One
  // read "the route is a full REPLACE, so without this a save of the NAME alone dropped the
  // schedule and its days", which stopped being a fact when an edit became a patch; the other
  // read "the form still has no control for those schedules", which stopped being a fact when
  // the day and date controls landed. **The refusal is KEPT for the case it is really about: a
  // schedule the PLATFORM has and this list does not** — how the original defect arrived, and
  // reachable again the day `AUTOMATION_SCHEDULES` gains a fifth. `agentAutoUnshowable` reads
  // that list, so the refusal lifts by adding the option rather than by editing this.
  // ⚠ **A CREATE IS NEVER LOCKED, AND `agentAutoRow()` IS THE WHOLE OF WHY** — it is
  // `find(a => a.id === agentAutoEditing) || null`, so with nothing being edited there is no
  // stored schedule to lose and `locked` is `''`. A first draft said `&& !!agentAutoEditing`
  // here as well; a sweep mutant that removed that half SURVIVED every case, which is how it
  // was measured as the same condition written twice rather than a second wall. Reading it the
  // other way round — locking on any weekly row in the LIST — would make the button dead for
  // everybody the first time somebody made a weekly automation in the chat, and that is the
  // mutant in `scripts/mutants/form-locked-schedule.json`.
  const locked = agentAutoUnshowable(agentAutoRow());
  if (locked) {
    say('This one runs ' + agentSchedWord(locked) + ', and this form has no control for that yet — ' +
        'so it can’t save changes to this one. Ask the agent in the chat to change it instead.');
    return;
  }

  /**
   * ⚠ **WHAT THIS PRESS IS SUBMITTING — and it is not the same thing as the draft.** The draft is
   * what is on screen and goes on changing while the request is in the air; this is the
   * configuration the answer below will be an answer about. Snapshotted, so a step added or a
   * word typed in the meantime cannot move it.
   */
  const submitted = autoSnap(values);
  const bound = agentBind();
  const editing = agentAutoEditing;
  // WHICH OPENING OF THE FORM THIS PRESS BELONGS TO — see `agentAutoOpen`. `editing` alone
  // cannot say, because a create's is `''` on every opening.
  const opened = agentAutoOpen;
  /**
   * ⚠ **AN EDIT SENDS WHAT CHANGED AND A CREATE SENDS EVERYTHING, and the difference is that a
   * create has nothing to compare against.**
   *
   * Computed here, synchronously, before anything awaits — so a list that reloads mid-save
   * cannot move either side of the comparison.
   *
   * **A BASELINE THAT IS NOT THIS AUTOMATION'S IS A REFUSAL, never a fallback to sending
   * everything.** Falling back would be the whole-row replace returning through a door nobody
   * is watching; it cannot happen (the form must have been drawn for Save to be pressed, and
   * the drawing is what captures it), which is what makes it a wall rather than a path.
   */
  let changed = null;
  if (editing) {
    if (!agentAutoWas || agentAutoWas.of !== editing) {
      say('Something moved while that was open — open it again and make the change once more.');
      return;
    }
    changed = agentAutoChanges(agentAutoWas, values);
    // **NOTHING CHANGED IS NOTHING TO SEND.** What is on screen is what is stored, so there is
    // no request to make — and making one anyway would take the row's lock and move its
    // `updated_at` to say that somebody had changed something.
    if (!Object.keys(changed).length) { agentAutoSaved = true; renderAgents(); return; }
  }
  const forAgent = agentAuto;
  agentAutoBusy = true; agentAutoActErr = ''; renderAgents();
  let failed = '';
  let made = null;
  try {
    const res = await apiFetch(editing ? '/api/agent/automation-update' : '/api/agent/automation-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // ⚠ `gen` IS THIS SCREEN'S OWN BOOKKEEPING AND DOES NOT GO ON THE WIRE. It says
      // which drawing of the form a draft is, which is a fact about a browser; a body
      // should say what it means, and a server reading a field nobody meant to send is
      // how a field ends up load-bearing by accident.
      body: JSON.stringify(editing
        ? { id: editing, ...changed }
        : { agent: forAgent, ...submitted }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t save that.';
    else if (typeof j.id === 'string') made = j.id;
  } catch { failed = 'Couldn’t reach the server.'; }

  // THE SCREEN MAY HAVE MOVED ON. Closing a form, clearing a draft or writing an error
  // into one somebody has since opened would all be acting on another screen.
  if (!agentSame(bound) || agentAuto !== forAgent || agentAutoEditing !== editing || agentAutoOpen !== opened) {
    agentAutoBusy = false; renderAgents(); return;
  }

  agentAutoBusy = false;
  if (failed) { say(failed); return; }   // the draft stays, so pressing Save again sends the same thing
  /**
   * ⚠ **THE BASELINE ADVANCES TO WHAT THE SERVER ACCEPTED, never to what is on screen now.**
   *
   * This was `agentAutoDraft = null; agentAutoWas = null;`, on the reasoning that the next drawing
   * would recapture both from the row this save had just produced. It recaptured them from the
   * DOM instead — which by then held whatever had been typed while the request was in the air —
   * so a name nobody had sent became part of what this browser believed the server held: the
   * panel said Saved, and the next press diffed the newer name against itself and sent nothing at
   * all. With the draft's generation bumped by an added step it was worse, because clearing the
   * draft made the generation gate refuse the read-back and the form was redrawn from the stored
   * row, discarding the step and the words typed into it.
   *
   * `submitted` is WHAT WAS SENT, and that is deliberately a weaker claim than what the server
   * STORED: `changed` is the difference from the old baseline, so old + changed is exactly what went
   * out, and a create sent the whole shape. **It has to be that rather than the row the reload
   * brings back**, because the other side of every diff is a reading of the FORM — so a row-derived
   * baseline would report whatever the server normalised as a change on a form nobody touched, and
   * send it back.
   *
   * ⚠ **THE COST IS STATED RATHER THAN GLOSSED: a value the server normalises goes on being shown
   * as it was sent, under a "Saved." line, until the form is next opened.** MEASURED:
   * `readStepField` trims, so a step whose text was sent `'Hello  '` is stored `'Hello'` while the
   * box keeps the spaces; `cleanWorkflow` adds an `id` to every step and `cleanInputs` a `type`.
   * The alternative is the defect above — nulling both and letting the next drawing recapture them
   * from the DOM — so this is the lesser of two, and it is BOUNDED rather than permanent:
   * `agentAutoOpenForm` nulls the draft, so reopening the form shows the stored row.
   *
   * **AND THE DRAFT IS KEPT**, so everything done since the press is still on screen and still
   * eligible for the next one. Whether the panel may call any of it saved is asked of the
   * configuration rather than remembered — see `agentAutoSavedShown`.
   */
  /**
   * ⚠ **A CREATE WHOSE ANSWER NAMES NO AUTOMATION ADVANCES NOTHING.** This used to fall back
   * to `editing`, which on a create is `''` — so the form stayed a create, "Saved." was drawn,
   * and the next press made a SECOND identical automation. There is nothing to tie what was
   * sent to, so the honest answer is to say so rather than to guess an id or to go quiet.
   * `/api/agent/automation-create` always answers one, so this is a belt rather than a path.
   */
  if (!editing && !made) {
    say('Saved, but the server didn’t say which automation it made — open it from the list to carry on.');
    return;
  }
  // ⚠ **`editing || made` IS SAFE ONLY BECAUSE OF THE REFUSAL ABOVE IT**, and that is worth
  // saying where somebody might tidy one of the two away: MEASURED over the three inputs that
  // can reach this line — an edit, an edit whose answer carried no id, and a create — it is
  // byte-identical to the longer `(!editing && made) ? made : editing`, because the only input
  // that separates them is the one the refusal has already turned away. Which is why the
  // sweep's mutant here is `= editing` (a create that never becomes an edit of what it made)
  // rather than the old fallback, which is inert by construction.
  const savedAs = editing || made;
  // A CREATE BECOMES AN EDIT OF WHAT IT JUST MADE, so the next press adjusts the same automation
  // rather than making a second one — and the baseline is about that same id, or the next press
  // meets the "something moved while that was open" refusal over its own save.
  agentAutoEditing = savedAs;
  agentAutoWas = { ...submitted, of: savedAs };
  agentAutoSaved = true;
  await agentAutoLoad(true);
}

/** On or off. Its own narrow write, so a toggle cannot carry a stale configuration. */
async function agentAutoToggle(id, on) {
  const target = String(id || '');
  const bound = agentBind();
  agentAutoBusy = true; agentAutoActErr = ''; renderAgents();
  let failed = '';
  try {
    const res = await apiFetch('/api/agent/automation-enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: target, enabled: on === 'on' }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t change that.';
  } catch { failed = 'Couldn’t reach the server.'; }
  agentAutoBusy = false;
  if (!agentSame(bound)) { renderAgents(); return; }
  if (failed) agentAutoActErr = failed;
  await agentAutoLoad(true);
}

/** Run it now — the same workflow the schedule starts, through the same queue. */
/**
 * Run one now.
 *
 * ⚠ **IT ASKS FIRST WHEN THE AUTOMATION ASKS FOR ANYTHING**, and that is not a
 * confirmation dialog: the values are part of the execution, snapshotted at acceptance, so
 * running without them would start something whose inputs are all empty and then report it
 * as done. An automation that declares nothing runs straight away.
 */
function agentAutoRunPress(id) {
  const target = String(id || '');
  const row = (agentAutoRows || []).find((a) => a.id === target);
  const asks = (row && row.inputs) || [];
  if (!asks.length) { agentAutoRun(target, {}); return; }
  // ITS DEFAULTS ARE WHAT THE BOXES START WITH, so pressing Run again after one run is
  // the same press rather than a form to fill in twice.
  const values = {};
  for (const d of asks) values[d.name] = typeof d.default === 'string' ? d.default : '';
  agentAutoAsk = { id: target, values };
  agentAutoActErr = '';
  renderAgents();
}

/** Read the ask-form's boxes back, so a redraw cannot lose what is typed in them. */
function agentAutoAskRead() {
  if (!agentAutoAsk) return;
  const rows = typeof document.querySelectorAll === 'function'
    ? [...document.querySelectorAll('[data-ask]')] : [];
  if (!rows.length) return;
  const values = { ...agentAutoAsk.values };
  for (const el of rows) {
    const n = (el.getAttribute && el.getAttribute('data-ask')) || '';
    if (n) values[n] = String(el.value || '');
  }
  agentAutoAsk = { ...agentAutoAsk, values };
}

function agentAutoAskCancel() { agentAutoAsk = null; agentAutoActErr = ''; renderAgents(); }
function agentAutoAskGo() {
  agentAutoAskRead();
  if (!agentAutoAsk) return;
  const { id, values } = agentAutoAsk;
  agentAutoAsk = null;
  agentAutoRun(id, values);
}

async function agentAutoRun(id, input) {
  const target = String(id || '');
  const bound = agentBind();
  agentAutoBusy = true; agentAutoActErr = ''; renderAgents();
  let failed = '';
  try {
    const res = await apiFetch('/api/agent/automation-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: target, input: input || {} }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t start that.';
  } catch { failed = 'Couldn’t reach the server.'; }
  agentAutoBusy = false;
  if (!agentSame(bound) || agentAuto === null) { renderAgents(); return; }
  if (failed) { agentAutoActErr = failed; renderAgents(); return; }
  // OPEN ITS HISTORY AND WATCH IT BRIEFLY. The work is committed by now, so this is
  // about how soon it appears and never about whether it happened.
  agentAutoRunsFor = target;
  await agentAutoRunsLoad(target, true);
  agentAutoWatchSoon(target, AUTO_WATCH_TRIES);
}

/**
 * Delete. CONFIRMED FIRST, because the history goes with it by the foreign key's own
 * cascade and there is no copy of it anywhere else.
 */
/**
 * Approve or reject one waiting execution.
 *
 * **THE WORDS ARE KEPT ON EVERY FAILURE**, including the two refusals, because the note is
 * somebody's own writing and the panel is redrawn to show a sentence. They are cleared only
 * when the server has the decision.
 *
 * **A SECOND PRESS IS ABSORBED BY THE SERVER, and it says so**: the first decision stands,
 * because by then the execution may already have carried on.
 */
/**
 * ⚠ **WHICH DOOR ANSWERS THIS PAUSE, and pressing the wrong one answers `ok` and does
 * nothing.**
 *
 * The history draws ONE Approve button for two mechanisms that look identical from the row.
 * A `Wait for approval` STEP is answered by the automation's own decision, keyed by the run
 * and the step. A `send` step is gated by a TOOL approval bound to the payload's hash and
 * answered by the request's id — which the engine names on the pause, because nothing else
 * could tell them apart (the pause's step is `"s3"` and the request's is the index `2`).
 *
 * MEASURED before this existed: pressing Approve on a send sent the step's decision, the
 * database answered `ok`, the run was requeued, the send step found its request still pending
 * and it paused at the same step again — for ever, nothing sent, and the decision recorded
 * where nothing reads it. *A dead control that ANSWERS, which is this repository's own worst
 * shape of that finding.*
 *
 * **A pause with no `request` takes the automation's door**, which is right for every approval
 * step and is exactly what a pause written before the engine carried the field already did.
 */
function agentAutoDoor(runId) {
  const w = ((agentAutoRuns || []).find((r) => r.id === runId) || {}).waiting || {};
  if (typeof w.request === 'string' && w.request) {
    return { path: '/api/agent/tool-approve', body: { id: w.request } };
  }
  const step = String(w.step || '');
  return step ? { path: '/api/agent/automation-approve', body: { run: runId, step } } : null;
}

async function agentAutoDecide(runId, verdict) {
  const target = String(runId || '');
  if (!target || agentAutoDeciding) return;
  const door = agentAutoDoor(target);
  if (!door) { agentAutoActErr = 'That run isn’t waiting to be approved any more.'; renderAgents(); return; }
  /**
   * ⚠ **AND AN APPROVAL IS REFUSED HERE TOO, not only left undrawn.**
   *
   * `agentWaitApprovable` takes the Approve button away, so an ordinary press cannot reach
   * this — but the button that was drawn stays in the DOM until the next render, and the
   * watch timer can re-read the history in between and come back without the payload (the
   * approvals read is allowed to fail on its own). Then the subject of the decision is gone
   * and the control is still there. A REJECTION is deliberately not gated: refusing a send
   * you cannot see is exactly the right thing to do with it.
   */
  const wait = ((agentAutoRuns || []).find((r) => r.id === target) || {}).waiting;
  if (verdict === 'approved' && !agentWaitApprovable(wait)) {
    agentAutoActErr = 'What that would send can’t be read just now, so it can’t be approved — ' +
      'reject it and run the automation again.';
    renderAgents();
    return;
  }
  const note = agentAutoNoteFor(target);
  const bound = agentBind();
  agentAutoDeciding = target; agentAutoActErr = ''; renderAgents();
  let failed = '';
  let said = '';
  try {
    const res = await apiFetch(door.path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...door.body, verdict, note: note || null }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t send that.';
    else if (j.repeat) said = 'That was already answered — the first answer stands.';
  } catch { failed = 'Couldn’t reach the server.'; }
  agentAutoDeciding = '';
  if (!agentSame(bound) || agentAuto === null) { renderAgents(); return; }
  if (failed) { agentAutoActErr = failed; renderAgents(); return; }
  // THE DECISION IS DURABLE BY NOW, so the note has done its job and the box is cleared.
  agentAutoNotes.delete(target);
  agentAutoActErr = said;
  // WATCH IT BRIEFLY: the doorbell has rung, so the execution carries on in seconds.
  await agentAutoRunsLoad(agentAutoRunsFor, true);
  if (agentAutoRunsFor) agentAutoWatchSoon(agentAutoRunsFor, AUTO_WATCH_TRIES);
}

/**
 * ⚠ **STOP ONE RUN — and the whole of the care here is about not claiming too much.**
 *
 * **NOTHING ALREADY DONE IS UNDONE, and the answer is what says how far it got.** The counts
 * come from `agent.cancel_run`, which reads them off the execution's own outcomes, so the
 * sentence drawn afterwards is a fact about that run rather than a reassurance composed here.
 *
 * **AND `heldByWorker` IS WHAT SEPARATES *recorded* FROM *stopped*.** The stop is written
 * synchronously, so the run reads `Stopped` the instant this returns — but a process already
 * inside a model call or a tool batch is walled off at its NEXT checkpoint, so the step it had
 * started may finish before it notices. When a claim was live, that is said; when it was not,
 * saying it would be a warning about something that was not happening.
 *
 * The confirm is `window.confirm`, which is what the delete beside it uses — and it NAMES THE
 * SCOPE, because *stop this run*, *turn the automation off* and *pause the agent* are three
 * different reaches and a person pressing one may mean another.
 */
/**
 * ⚠ **READ THE NOTE BOXES AT THE POINT OF USE, NOT ONLY AT A RENDER — a browser found this.**
 *
 * `agentAutoNotesRead` runs inside `renderAgents`, which is what keeps a note alive across the
 * 1.5-second history poll. But a person who types a reason and presses the button in the same
 * breath has typed it since the last render, so `agentAutoNotes` still holds what the box held
 * BEFORE — and the reason goes nowhere. MEASURED in a real browser: a stop with
 * "we posted it instead" typed into the box stored `note: null`.
 *
 * The poll makes it narrow rather than harmless: it is armed only by live work, so on a run
 * nothing is working on — which is every run waiting for a person, the one place a note is most
 * likely to be typed — no render intervenes at all and the words are lost every time.
 *
 * One line at the top of each handler, through the reader that already exists rather than a
 * second copy of it. Both doors, because the approval note has the identical shape and had it
 * first; this was inherited rather than introduced.
 *
 * ⚠ A `function` DECLARATION AND NOT A `const`, because one of its two callers sits textually
 * above it — a `const` there is the temporal dead zone, which this repository has paid for in
 * exactly this shape.
 */
function agentAutoNoteFor(id) {
  agentAutoNotesRead();
  return String(agentAutoNotes.get(id) || '').trim();
}

async function agentAutoStop(runId) {
  const target = String(runId || '');
  if (!target || agentAutoStopping) return;
  const run = (agentAutoRuns || []).find((r) => r.id === target) || null;
  // ⚠ REFUSED HERE TOO, not only left undrawn. The button that was drawn stays in the DOM
  // until the next render, and the watch timer can re-read the history in between and come
  // back with the run already finished — the same window `agentAutoDecide` guards, for the
  // same reason. `cancel_run` would answer `alreadyStopped` and nothing would be harmed;
  // what this avoids is telling somebody they stopped something that had already ended.
  if (!run || AUTO_STOPPABLE.indexOf(run.state) === -1) {
    agentAutoActErr = 'That run isn’t under way any more, so there is nothing to stop.';
    renderAgents();
    return;
  }
  if (!window.confirm('Stop this run? ' + AUTO_STOP_SCOPE
    + ' Anything it has already done stays done — stopping cannot take a message back.')) return;
  const note = agentAutoNoteFor(target);
  const bound = agentBind();
  agentAutoStopping = target; agentAutoActErr = ''; renderAgents();
  let failed = '';
  let said = '';
  try {
    const res = await apiFetch('/api/agent/run-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run: target, reason: note || null }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t stop that.';
    else said = agentStopSaid(j);
  } catch { failed = 'Couldn’t reach the server.'; }
  agentAutoStopping = '';
  // ⚠ AN ANSWER THAT LANDS AFTER THE SCREEN MOVED WRITES NOTHING — the same wall every other
  // in-flight read on this screen has. The cancellation is durable either way.
  if (!agentSame(bound) || agentAuto === null) { renderAgents(); return; }
  if (failed) { agentAutoActErr = failed; renderAgents(); return; }
  agentAutoNotes.delete(target);
  agentAutoActErr = said;
  await agentAutoRunsLoad(agentAutoRunsFor, true);
}

/**
 * WHAT TO SAY ONCE IT HAS STOPPED — composed from the answer's own facts and never from a
 * constant, so a run that had done nothing is not told it had done something.
 *
 * ⚠ **AND THE SERVER'S OWN SENTENCE IS PREFERRED FOR THE *not undone* HALF**, because that
 * claim is `agent.cancel_run`'s to make: a second copy of it here is one that can drift from
 * what a cancellation really reaches. What this adds is the part the server cannot know —
 * whether the person is looking at something that has finished stopping or something whose
 * last step may still be finishing.
 */
function agentStopSaid(j) {
  const steps = Number.isInteger(j && j.completedSteps) ? j.completedSteps : null;
  const calls = Number.isInteger(j && j.completedCalls) ? j.completedCalls : null;
  const parts = [];
  if (j && j.alreadyStopped === true) parts.push('That run had already stopped.');
  else parts.push('Stopped.');
  if (steps !== null) {
    parts.push(steps + ' step' + (steps === 1 ? '' : 's') + ' had already run'
      + (calls !== null && calls > 0
        ? ' and ' + calls + ' action' + (calls === 1 ? '' : 's') + ' had already gone out'
        : '') + '.');
  }
  parts.push(typeof (j && j.say) === 'string' && j.say
    ? j.say
    : 'What had already run has already run and was not undone.');
  // ⚠ SAID ONLY WHEN A CLAIM WAS LIVE. Otherwise there is nothing still finishing, and a
  // warning about one would be this screen inventing a delay the platform does not have.
  if (j && j.heldByWorker === true) {
    parts.push('Something was working on it, so the step it had already started may finish '
      + 'before it notices — nothing after that will run.');
  }
  return parts.join(' ');
}

async function agentAutoDelete(id) {
  const target = String(id || '');
  if (!target) return;
  const a = (agentAutoRows || []).find((x) => x.id === target);
  if (!window.confirm('Delete ' + ((a && a.name) || 'this automation') + ' and everything it has run? This cannot be undone.')) return;
  const bound = agentBind();
  agentAutoBusy = true; agentAutoActErr = ''; renderAgents();
  let failed = '';
  try {
    const res = await apiFetch('/api/agent/automation-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: target }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t delete that.';
  } catch { failed = 'Couldn’t reach the server.'; }
  agentAutoBusy = false;
  if (agentSame(bound)) {
    if (failed) agentAutoActErr = failed;
    else {
      agentAutoOpenForm(null);
      if (agentAutoRunsFor === target) {
        agentAutoRunsFor = null; agentAutoRuns = null; agentAutoRunsWant = null;
      }
    }
  }
  await agentAutoLoad(true);
}


// ── connected accounts: the screen ───────────────────────────────────────────

/**
 * ⚠ **IS THE SAME AGENT'S ACCOUNTS STILL OPEN, FOR THE SAME ACCOUNT?**
 *
 * Its own predicate rather than `agentSame`, which asks about the CONVERSATION — and the
 * first draft of this asked `bound.agent`, a field `agentBind()` does not carry. Every
 * comparison against `undefined` was true, so every answer would have been discarded and
 * the screen would have sat on "Loading…" for ever with the request having succeeded. *A
 * binding check that can never pass is worse than none, because it looks like care.*
 */
const connBind = () => ({ uid: agentUid(), conn: agentConn });
const connSame = (b) => !!b && b.uid === agentUid() && b.conn === agentConn;

function agentConnections(id) {
  agentPollStop();
  // ⚠ THE TWO SCREENS CLEAR EACH OTHER, so they cannot both be open — and the view switch
  // reads this one first, which is what makes that a property rather than a convention.
  agentAuto = null; agentAutoOpenForm(null);
  agentWh = null; agentWhOpenForm(false);
  agentConn = String(id || '');
  agentConnRows = null; agentConnCat = null; agentConnNew = false;
  agentConnDraft = null; agentConnActErr = '';
  agentConnLoad();
}
function agentConnBack() {
  const back = agentConn;
  agentConn = null; agentConnNew = false; agentConnDraft = null; agentConnActErr = '';
  if (back) agentOpen(back); else renderAgents();
}
function agentConnNewOpen() { agentConnNew = true; agentConnDraft = null; agentConnActErr = ''; renderAgents(); }
function agentConnCancel() { agentConnNew = false; agentConnDraft = null; agentConnActErr = ''; renderAgents(); }
function agentConnReload() { agentConnLoad(); }

/**
 * Read the connect form back out of the DOM, so a redraw cannot eat what is typed.
 *
 * ⚠ **THE PERMISSION TICKS KEEP THEIR OWN DOM STATE and are read from the boxes**, the way
 * the agent settings form's tool ticks already are — so ticking one redraws nothing and the
 * account box above keeps what is in it.
 */
function agentConnFormRead() {
  const form = document.getElementById('agConnForm');
  if (!form) return;
  const get = (n) => { const el = form.querySelector('[data-field="' + n + '"]'); return el ? el.value : ''; };
  const ticked = [];
  form.querySelectorAll('[data-scope]').forEach((b) => { if (b.checked) ticked.push(b.getAttribute('data-scope')); });
  agentConnDraft = {
    provider: get('provider'),
    account: get('account'),
    label: get('label'),
    scopes: ticked,
  };
}

async function agentConnLoad(quiet) {
  const bound = connBind();
  const forAgent = agentConn;
  if (!quiet) { agentConnState = 'loading'; agentConnErr = ''; renderAgents(); }
  try {
    const res = await apiFetch('/api/agent/connections?agent=' + encodeURIComponent(forAgent));
    const j = await res.json().catch(() => ({}));
    // THE SCREEN MAY HAVE MOVED ON, or another account may be signed in. Writing this answer
    // into a screen showing another agent's accounts would be showing somebody rows that are
    // not theirs.
    if (!connSame(bound) || agentConn !== forAgent) return;
    if (!res.ok || !j.ok) {
      // A FAILED READ IS NOT AN AGENT WITH NOTHING CONNECTED. The rows it had stay exactly as
      // they were, so an outage does not look like everything having been disconnected.
      agentConnState = 'error';
      agentConnErr = (j && j.error) || 'Couldn’t load the connected accounts.';
    } else {
      agentConnRows = Array.isArray(j.connections) ? j.connections : [];
      agentConnCat = { providers: Array.isArray(j.providers) ? j.providers : [], max: j.max };
      agentConnState = 'ready';
      agentConnErr = '';
    }
  } catch {
    if (!connSame(bound) || agentConn !== forAgent) return;
    agentConnState = 'error';
    agentConnErr = 'Couldn’t reach the server.';
  }
  renderAgents();
}

/** Connect one. The credential is the server's; this sends an account and some permissions. */
async function agentConnSave() {
  agentConnFormRead();
  const bound = connBind();
  const draft = agentConnDraft || {};
  agentConnActErr = '';
  try {
    const res = await apiFetch('/api/agent/connection-connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agent: agentConn, provider: draft.provider, account: draft.account,
        label: draft.label, scopes: draft.scopes || [],
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!connSame(bound)) return;
    if (!res.ok || !j.ok) {
      // THE WORDS STAY, because a refusal somebody can fix is one they should not have to
      // retype their way out of.
      agentConnActErr = (j && j.error) || 'Couldn’t connect that.';
      renderAgents();
      return;
    }
    agentConnNew = false; agentConnDraft = null;
    agentConnLoad(true);
  } catch {
    if (!connSame(bound)) return;
    agentConnActErr = 'Couldn’t reach the server.';
    renderAgents();
  }
}

/**
 * Disconnect one.
 *
 * ⚠ **IT ASKS FIRST, because the credential is DESTROYED and connecting again makes a new
 * one** — this is not a toggle, and a control that reads like one is how somebody turns a
 * live account off expecting to turn it back on.
 */
async function agentConnDisconnect(id) {
  const row = (agentConnRows || []).find((c) => c.id === id);
  const what = row ? (row.label || row.account) : 'that account';
  if (!window.confirm('Disconnect ' + what + '?\n\nIts credential is destroyed. Connecting it again makes a new one, and anything waiting to send through it will stop.')) return;
  const bound = connBind();
  agentConnActErr = '';
  try {
    const res = await apiFetch('/api/agent/connection-disconnect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent: agentConn, id }),
    });
    const j = await res.json().catch(() => ({}));
    if (!connSame(bound)) return;
    if (!res.ok || !j.ok) { agentConnActErr = (j && j.error) || 'Couldn’t disconnect that.'; renderAgents(); return; }
    agentConnLoad(true);
  } catch {
    if (!connSame(bound)) return;
    agentConnActErr = 'Couldn’t reach the server.';
    renderAgents();
  }
}


// ── where things arrive: the screen ──────────────────────────────────────────

/**
 * ⚠ **IS THE SAME AGENT'S ADDRESSES STILL OPEN, FOR THE SAME ACCOUNT?**
 *
 * Its own predicate, the way `connSame` is and for the same reason: `agentSame` asks about the
 * CONVERSATION, and an answer landing after somebody opened another agent's addresses would
 * show them rows that are not about what they are looking at.
 */
const whBind = () => ({ uid: agentUid(), wh: agentWh });
const whSame = (b) => !!b && b.uid === agentUid() && b.wh === agentWh;

/**
 * OPEN THE MAKE-AN-ADDRESS FORM, OR CLOSE IT — the single writer of whether it is open.
 *
 * ⚠ Every door goes through here so the OPENING COUNT cannot be forgotten by one of them, and
 * a door added next month carries it by construction. The secret panel is closed too, which is
 * what makes `webhooksHtml`'s "three states and no fourth" a property rather than a convention.
 */
function agentWhOpenForm(open) {
  agentWhOpen++;
  agentWhNew = !!open;
  agentWhDraft = null;
  agentWhActErr = '';
  agentWhSecret = null;
}

/**
 * ⚠ **IS THIS ANSWER STILL ABOUT WHAT IS ON SCREEN? Three questions, not one.**
 *
 * `whSame` asks about the account and the agent. This asks the two that were missing: is it the
 * SAME OPENING of the form — a cancel and a reopen is a different form, however identical it
 * looks — and are the values still the ones that were SUBMITTED. The second is what preserves
 * newer typing in the same form: the address named in the answer was made from the old words, so
 * closing the form and showing its key would take away the words somebody has since typed.
 *
 * The opening count alone would catch a cancel/reopen; the values alone would catch newer
 * typing. Neither catches the other, so both are asked.
 */
function whFormSame(b) {
  if (!whSame(b) || !b || b.open !== agentWhOpen) return false;
  const d = agentWhDraft || { name: '', event: '' };
  const sent = b.sent || { name: '', event: '' };
  return d.name === sent.name && d.event === sent.event;
}

function agentWebhooks(id) {
  agentPollStop();
  // ⚠ THE THREE SCREENS CLEAR EACH OTHER, so no two can be open — and the view switch reads
  // them in one order, which is what makes that a property rather than a convention.
  agentAuto = null; agentAutoOpenForm(null);
  agentConn = null; agentConnNew = false; agentConnDraft = null;
  agentWh = String(id || '');
  agentWhRows = null; agentWhEvents = null; agentWhEventsErr = '';
  // ⚠ THE SECRET IS CLEARED ON THE WAY IN — `agentWhOpenForm` does it — so one agent's key can
  // never be on screen while another agent's addresses are. It is the one value here that must
  // not outlive its context. **And opening this screen is an OPENING**: reaching the same agent's
  // addresses again closes any form that was open, so an answer still in flight for it has to
  // know that, or it writes into a screen that has been round the houses since.
  agentWhOpenForm(false);
  agentWhLoad();
}
function agentWhBack() {
  const back = agentWh;
  agentWh = null; agentWhOpenForm(false);
  if (back) agentOpen(back); else renderAgents();
}
function agentWhNewOpen() { agentWhOpenForm(true); renderAgents(); }
function agentWhCancel() { agentWhOpenForm(false); renderAgents(); }
function agentWhReload() { agentWhLoad(); }
/** Put the secret away. It is gone from everywhere once this runs — that is the point of it. */
function agentWhSecretDone() { agentWhSecret = null; renderAgents(); }

/** Read the form back out of the DOM, so a redraw cannot eat what is typed. */
function agentWhFormRead() {
  const form = document.getElementById('agWhForm');
  if (!form) return;
  const get = (n) => { const el = form.querySelector('[data-field="' + n + '"]'); return el ? el.value : ''; };
  agentWhDraft = { name: get('name'), event: get('event') };
}

/**
 * Both halves in one press: the addresses, and what has arrived at them.
 *
 * ⚠ **TWO READS, EACH IN ITS OWN `try`, because they answer different questions and one
 * outage must not silence the other.** The addresses are the configuration and the arrivals
 * are the history; a screen that showed neither because the log was unreadable would hide the
 * thing somebody came to change.
 */
async function agentWhLoad(quiet) {
  const bound = whBind();
  const forAgent = agentWh;
  if (!quiet) { agentWhState = 'loading'; agentWhErr = ''; renderAgents(); }
  try {
    const res = await apiFetch('/api/agent/webhooks?agent=' + encodeURIComponent(forAgent));
    const j = await res.json().catch(() => ({}));
    if (!whSame(bound) || agentWh !== forAgent) return;
    if (!res.ok || !j.ok) {
      // A FAILED READ IS NOT AN AGENT WITH NO ADDRESSES. The rows it had stay as they were,
      // so an outage does not read as everything having been deleted.
      agentWhState = 'error';
      agentWhErr = (j && j.error) || 'Couldn’t load the arrival addresses.';
    } else {
      agentWhRows = Array.isArray(j.webhooks) ? j.webhooks : [];
      agentWhMax = Number.isInteger(j.max) ? j.max : 0;
      agentWhState = 'ready';
      agentWhErr = '';
    }
  } catch {
    if (!whSame(bound) || agentWh !== forAgent) return;
    agentWhState = 'error';
    agentWhErr = 'Couldn’t reach the server.';
  }
  await agentWhEventsLoad(forAgent, bound);
  renderAgents();
}

async function agentWhEventsLoad(forAgent, bound) {
  try {
    const res = await apiFetch('/api/agent/events?agent=' + encodeURIComponent(forAgent));
    const j = await res.json().catch(() => ({}));
    if (!whSame(bound) || agentWh !== forAgent) return;
    if (!res.ok || !j.ok) {
      agentWhEventsErr = (j && j.error) || 'Couldn’t load what has arrived.';
    } else {
      agentWhEvents = Array.isArray(j.events) ? j.events : [];
      agentWhEventsErr = '';
    }
  } catch {
    if (!whSame(bound) || agentWh !== forAgent) return;
    agentWhEventsErr = 'Couldn’t reach the server.';
  }
}

/**
 * Make one.
 *
 * ⚠ **THE SECRET COMES BACK EXACTLY ONCE AND THIS IS THE ONLY PLACE IT IS EVER SEEN.** The
 * answer is held in memory, shown, and dropped; nothing stores it and nothing can ask for it
 * again. So the list is reloaded AFTER it is held, because a reload that failed must not be
 * what loses it.
 */
async function agentWhSave() {
  agentWhFormRead();
  const d = agentWhDraft || {};
  // ⚠ **WHAT WAS SUBMITTED, AND WHICH OPENING OF THE FORM SUBMITTED IT**, beside the account and
  // the agent. See `whFormSame`: those two were the missing halves.
  const bound = { ...whBind(), open: agentWhOpen, sent: { name: d.name || '', event: d.event || '' } };
  const forAgent = agentWh;
  agentWhBusy = true; agentWhActErr = ''; renderAgents();
  let failed = '';
  let secret = null;
  try {
    const res = await apiFetch('/api/agent/webhook-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: forAgent, name: d.name, event: d.event }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t make that address.';
    else secret = { id: j.id, name: j.name, event: j.event, path: j.path, secret: j.secret };
  } catch { failed = 'Couldn’t reach the server.'; }
  agentWhBusy = false;
  // WHAT IS IN THE BOXES RIGHT NOW, read off the DOM rather than off whatever the last
  // keystroke happened to write: the question below is about the screen as it stands.
  agentWhFormRead();

  // ── THE ORDINARY PATH: the same form, still holding the words that were sent. ────────
  if (whFormSame(bound)) {
    if (failed) { agentWhActErr = failed; renderAgents(); return; }
    // The opener closes the form AND clears the secret, so the secret is set after it.
    agentWhOpenForm(false);
    agentWhSecret = secret;
    await agentWhLoad(true);
    return;
  }

  /**
   * ── SUPERSEDED: the form this answer is about is not the one on screen. ────────────
   *
   * ⚠ **NOTHING THAT BELONGS TO THE FORM IS TOUCHED.** Not `agentWhNew`, not `agentWhDraft`,
   * not `agentWhActErr`: whatever somebody has since opened and typed is theirs, and this
   * answer is about words that are no longer on the screen. That is the defect — a save, a
   * cancel, a new form, and the first answer closed the new form, threw its draft away and put
   * the old address's signing key up in its place.
   *
   * ⚠ **AND THE ANSWER IS STILL DEALT WITH HONESTLY, because an address was really made.**
   * Dropping it silently would leave somebody with a live endpoint whose signing key existed in
   * exactly one HTTP response and is now gone. It is HELD — in memory, bound to the account and
   * the agent that made it — and offered as a press on that agent's own screen. A refusal is
   * held the same way and NAMES what it was about, because drawn over the newer form it would
   * read as that form's problem.
   *
   * The hold is keyed on the ACCOUNT, so an answer that came back after somebody signed in as
   * somebody else is dropped here and never drawn: `bound.uid` is who asked.
   */
  if (bound.uid && bound.uid === agentUid()) {
    agentWhHeld = {
      uid: bound.uid,
      agent: forAgent,
      name: (secret && secret.name) || bound.sent.name,
      event: (secret && secret.event) || bound.sent.event,
      made: secret,
      why: failed,
    };
  }
  // The list is worth refreshing while this agent's addresses are still open — a made address
  // belongs on it — and a quiet load redraws the form from the draft, which was preserved.
  if (whSame(bound)) await agentWhLoad(true); else renderAgents();
}

/**
 * DEAL WITH A HELD ANSWER, and that consumes the hold.
 *
 * ⚠ **ONE PRESS FOR BOTH OUTCOMES, because a refusal's button must not be a dead control.**
 * A made address hands its key to the one panel that shows one; a refusal has nothing to show
 * and the press is an acknowledgement, which is the whole of what it needs to be. A second
 * action that only dismissed would be a button answering nothing.
 *
 * ⚠ **THE KEY GOES TO THE SAME ONE-TIME PANEL A SAVE USES, deliberately** — one place says
 * the sentence about copying it now, so there is no second account of what that key is. The
 * form underneath is untouched, so "I have copied it" comes back to whatever was being typed.
 *
 * **SHOWING IT IS SPENDING IT.** The panel's own contract is that a key is seen once; keeping
 * the offer after it has been on screen would re-offer something already shown and leave a key
 * in memory with nothing that ends it.
 *
 * **THE ACCOUNT AND THE AGENT ARE ASKED AGAIN HERE**, not only at draw time: the button that
 * was drawn stays in the DOM until the next render, and a quiet reload can land in between.
 */
function agentWhHeldShow() {
  const held = agentWhHeld;
  if (!held || held.uid !== agentUid() || held.agent !== agentWh) return;
  agentWhHeld = null;
  if (held.made) agentWhSecret = held.made;
  renderAgents();
}

/** Open or close one. Closing it stops deliveries being accepted at all. */
async function agentWhEnable(id, enabled) {
  const target = String(id || '');
  if (!target || agentWhBusy) return;
  const bound = whBind();
  agentWhBusy = true; agentWhActErr = ''; renderAgents();
  let failed = '';
  try {
    const res = await apiFetch('/api/agent/webhook-enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: agentWh, id: target, enabled: !!enabled }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t change that.';
  } catch { failed = 'Couldn’t reach the server.'; }
  agentWhBusy = false;
  if (!whSame(bound)) { renderAgents(); return; }
  if (failed) { agentWhActErr = failed; renderAgents(); return; }
  await agentWhLoad(true);
}

/**
 * Delete one.
 *
 * ⚠ **THE CONFIRM SAYS WHAT CANNOT BE PUT BACK.** There is no rotate — deliberately, because
 * a rotate has to hand out a new secret and the whole design is that exactly one door does —
 * so deleting an address is how a compromised key is dealt with, and whatever signs with the
 * old one stops working the moment this returns.
 */
async function agentWhDelete(id) {
  const target = String(id || '');
  if (!target || agentWhBusy) return;
  const row = (agentWhRows || []).find((w) => w.id === target);
  if (!window.confirm('Delete ' + ((row && row.name) || 'this address')
    + '? Anything sending to it stops working straight away, and its signing key cannot be '
    + 'recovered — you would make a new address and a new key.')) return;
  const bound = whBind();
  agentWhBusy = true; agentWhActErr = ''; renderAgents();
  let failed = '';
  try {
    const res = await apiFetch('/api/agent/webhook-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: agentWh, id: target }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t delete that.';
  } catch { failed = 'Couldn’t reach the server.'; }
  agentWhBusy = false;
  if (!whSame(bound)) { renderAgents(); return; }
  if (failed) { agentWhActErr = failed; renderAgents(); return; }
  await agentWhLoad(true);
}

/**
 * ⚠ **FROM AN ARRIVAL TO THE RUN IT STARTED — the requirement's *show the relevant execution*
 * as a control rather than as a sentence.**
 *
 * An execution is read through its AUTOMATION's history, so this leaves the addresses and
 * opens that automation with its history showing. `list_events` names both halves per run for
 * exactly this reason; a bare run id could not be opened from anywhere.
 *
 * ⚠ **AND BOTH HALVES ARE CARRIED, not just the automation — which is the defect this
 * closes.** One arrival can start one run and two arrivals can start two runs of the SAME
 * automation, so an id-less hop opened one history and left somebody to guess which of the
 * rows in it was the one they pressed. The run id goes through to the history, which marks
 * that row, fetches it when the newest page does not hold it, and says so when it cannot be
 * found rather than leaving another run reading as the target.
 */
function agentWhOpenRun(automationId, runId) {
  const target = String(automationId || '');
  /**
   * WHOSE ADDRESSES THESE ARE. `agentAutomations` is what clears this screen, so the value is
   * taken first — though that is CLARITY and not a wall, and saying so beats implying otherwise:
   * an argument is evaluated before the call it is passed to, so `agentAutomations(agentWh)`
   * would read the same value. **The `!owner` REFUSAL is the load-bearing half**: with no agent's
   * arrivals open there is nobody to open the automations for, and guessing would land somebody
   * on another agent's screen.
   */
  const owner = agentWh;
  if (!target || !owner) return;
  // The secret panel and any refusal go with the screen: `agentAutomations` calls
  // `agentWhOpenForm(false)`, which is the single writer that clears both.
  agentAutomations(owner);
  agentAutoHistory(target, String(runId || ''));
}

/**
 * One connection's own words: what it is, whose it is, what it may do, and its state.
 *
 * ⚠ **IT REUSES THE AUTOMATIONS ROW'S OWN CLASSES rather than a set of its own** — the owner
 * directs the design here, and *use the existing agent screen and design* is the milestone's
 * own instruction. **This was written twice**: the first draft invented `ag-conn-row`,
 * `ag-row-main`, `ag-row-name`, `ag-row-sub` and `ag-row-warn`, and MEASURED against the sheet
 * not one of the five had a rule — an unstyled screen that reads as broken. *A class with no
 * rule is a control nobody can see.*
 */
function agentConnRowHtml(c) {
  const state = String(c.status || '');
  const chip = state === 'active'
    ? ''
    : '<span class="ag-chip ag-chip-off">' + esc(state.charAt(0).toUpperCase() + state.slice(1)) + '</span>';
  // ⚠ THE SIMULATED CHIP IS READ FROM THE ROW, never from the provider's name — so connecting
  // a real provider stops the label with no change to this reader.
  const sim = c.simulated ? '<span class="ag-chip ag-chip-off">Simulated</span>' : '';
  const perms = (c.scopes || []).length
    ? (c.scopes || []).map((sc) => esc(sc)).join(' · ')
    : 'no permissions granted';
  return '<div class="ag-auto' + (state === 'active' ? '' : ' ag-auto-off') + '">' +
    '<div class="ag-auto-top">' +
      '<div class="ag-auto-m">' +
        '<div class="ag-auto-n">' + esc(c.label || c.account) + chip + sim + '</div>' +
        '<div class="ag-auto-s">' + esc(c.providerLabel || c.provider) + ' · ' + esc(c.account) + '</div>' +
        '<div class="ag-auto-steps">' +
          '<span class="ag-auto-step">Can: ' + perms + '</span>' +
          // ⚠ **WHY IT CANNOT BE USED, WHERE IT CANNOT BE USED** — and only when there is
          // something to say. Each state has its own sentence, so somebody meeting an expired
          // credential is not sent to reconnect and somebody meeting a revoked one is not sent
          // to refresh.
          (c.trouble ? '<span class="ag-auto-step ag-auto-none">' + esc(c.trouble) + '</span>' : '') +
          (c.stoppedWhy ? '<span class="ag-auto-step ag-auto-none">Noted: ' + esc(c.stoppedWhy) + '</span>' : '') +
          // THE ID, BECAUSE A SEND STEP NAMES A CONNECTION BY IT. Without it on screen the
          // workflow editor's connection box is a control nobody can fill in.
          '<span class="ag-auto-step ag-auto-none">id ' + esc(c.id) + '</span>' +
        '</div>' +
      '</div>' +
      (state === 'disconnected'
        ? ''
        : '<div class="ag-auto-acts">' +
            '<button class="ag-auto-btn" data-act="agent-conn-off" data-id="' + esc(c.id) + '">Disconnect</button>' +
          '</div>') +
    '</div>' +
  '</div>';
}

/** The connect form. One provider, one account, and the permissions to grant. */
function agentConnFormHtml() {
  const cat = agentConnCat || { providers: [] };
  const d = agentConnDraft || { provider: (cat.providers[0] || {}).name || '', account: '', label: '', scopes: [] };
  const chosen = cat.providers.find((p) => p.name === d.provider) || cat.providers[0] || null;
  if (!chosen) {
    // ⚠ A REAL BRANCH AND AN HONEST SENTENCE. A deployment that offers nothing to connect is
    // a real state, and a form with an empty picker would be a control that answers nothing.
    return '<div class="ag-form" id="agConnForm">' +
        '<div class="ag-nothing">This platform has nothing to connect yet. When it has, the kinds of account will be listed here.</div>' +
        '<div class="ag-actions"><button class="ag-cancel" data-act="agent-conn-cancel">Back</button></div>' +
      '</div>';
  }
  const picked = new Set(d.scopes || []);
  return '<div class="ag-form" id="agConnForm">' +
      '<label class="ag-lbl">What kind of account</label>' +
      '<select class="ag-in" data-field="provider" data-change="agent-conn-provider">' +
        cat.providers.map((p) =>
          '<option value="' + esc(p.name) + '"' + (p.name === chosen.name ? ' selected' : '') + '>' +
            esc(p.label) + '</option>').join('') +
      '</select>' +
      '<div class="ag-hint">' + esc(chosen.does) + '</div>' +

      '<label class="ag-lbl">Which account</label>' +
      '<input class="ag-in" data-field="account" data-input="agent-conn" maxlength="200" placeholder="shop@example.test" value="' + esc(d.account) + '">' +

      '<label class="ag-lbl">A name for it (optional)</label>' +
      '<input class="ag-in" data-field="label" data-input="agent-conn" maxlength="80" placeholder="The shop" value="' + esc(d.label) + '">' +

      '<label class="ag-lbl">What the agent may do with it</label>' +
      (chosen.scopes || []).map((sc) =>
        '<label class="ag-check">' +
          '<input type="checkbox" data-scope="' + esc(sc.name) + '"' + (picked.has(sc.name) ? ' checked' : '') + '>' +
          '<span class="ag-tool-m">' +
            '<span class="ag-check-t">' + esc(sc.label) + '</span>' +
            '<span class="ag-tool-d">' + esc(sc.does) + '</span>' +
          '</span>' +
        '</label>').join('') +

      // ⚠ **NO CREDENTIAL BOX, AND THE SENTENCE SAYS SO.** Nothing here asks for a password or
      // a key: the platform mints the credential, keeps it, and never hands it back. A box for
      // one would be somewhere for a real account's password to be pasted into a fake provider.
      '<div class="ag-hint">You don’t enter a password or a key. The platform makes the credential, keeps it on the server, and never shows it to anyone — not to you, not to the agent, not in a log.</div>' +
      (agentConnActErr ? '<div class="ag-err">' + esc(agentConnActErr) + '</div>' : '') +
      '<div class="ag-actions">' +
        '<button class="ag-save" data-act="agent-conn-save">Connect</button>' +
        '<button class="ag-cancel" data-act="agent-conn-cancel">Cancel</button>' +
      '</div>' +
    '</div>';
}

/** The whole screen: a list, or the connect form over it. */
function connectionsHtml() {
  const agent = (agentRows || []).find((a) => a.id === agentConn) || null;
  const head =
    '<div class="ag-head ag-thread-head">' +
      '<button class="ag-back" data-act="agent-conn-back" aria-label="Back to the conversation" title="Back">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>' +
      '</button>' +
      '<div class="ag-thread-name">Connected accounts' + (agent ? ' · ' + esc(agent.name) : '') + '</div>' +
      (!agentConnNew
        ? '<button class="ag-edit" data-act="agent-conn-new" aria-label="Connect an account" title="Connect an account">' +
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>' +
          '</button>'
        : '') +
    '</div>';

  if (agentConnNew) return '<div class="ag-page ag-thread-page">' + head + agentConnFormHtml() + '</div>';

  let body;
  if (agentConnState === 'loading' && agentConnRows === null) {
    body = '<div class="ag-empty"><div class="ag-empty-s">Loading…</div></div>';
  } else if (agentConnState === 'error' && agentConnRows === null) {
    body = '<div class="ag-empty">' +
             '<div class="ag-empty-t">Couldn’t load the connected accounts</div>' +
             '<div class="ag-empty-s">' + esc(agentConnErr) + '</div>' +
             '<button class="ag-retry" data-act="agent-conn-reload">Try again</button>' +
           '</div>';
  } else if (!(agentConnRows || []).length) {
    body = '<div class="ag-empty">' +
             '<div class="ag-empty-t">Nothing connected yet</div>' +
             '<div class="ag-empty-s">Connect an account and an automation can send through it. A person approves every message before it goes out — you are shown the account, who it is for and the exact words first.</div>' +
           '</div>';
  } else {
    body = (agentConnRows || []).map(agentConnRowHtml).join('');
  }
  return '<div class="ag-page ag-thread-page">' + head +
    (agentConnActErr ? '<div class="ag-err">' + esc(agentConnActErr) + '</div>' : '') +
    body + '</div>';
}


/**
 * ONE ARRIVAL ADDRESS: what it is called, what it raises, where it is, and whether it is open.
 *
 * ⚠ **IT REUSES THE AUTOMATIONS ROW'S OWN CLASSES rather than a set of its own**, for the
 * reason `agentConnRowHtml` records: the owner directs the design here, and a class with no
 * rule in `styles.css` is a control nobody can see. Every class below is one that already
 * has one.
 *
 * ⚠ **AND THE SECRET IS NOT ON THIS ROW, because it cannot be.** `agent.list_webhooks` never
 * selects the column, so there is nothing here to leave out — which is a stronger statement
 * than this renderer choosing not to draw one.
 */
function agentWhRowHtml(w) {
  const on = w.enabled === true;
  return '<div class="ag-auto' + (on ? '' : ' ag-auto-off') + '">' +
    '<div class="ag-auto-top">' +
      '<div class="ag-auto-m">' +
        '<div class="ag-auto-n">' + esc(w.name || w.id) +
          (on ? '' : '<span class="ag-chip ag-chip-off">Closed</span>') + '</div>' +
        // WHICH EVENT IT RAISES, because that is what an automation listens for — and the two
        // have to be the same word or nothing ever runs.
        '<div class="ag-auto-s">Raises ' + esc(w.event || '?') + '</div>' +
        '<div class="ag-auto-steps">' +
          // ⚠ **A PATH, NOT A URL, AND THE SENTENCE SAYS WHOSE.** This product rings the
          // engine through a queue binding, which carries no address, so composing a URL here
          // would mean inventing an origin — and an invented origin is what somebody
          // configures their system with and which never works.
          '<span class="ag-auto-step">POST ' + esc(w.path || '') + ' on the agent service</span>' +
          '<span class="ag-auto-step ag-auto-none">' +
            (w.lastAt ? 'Last arrival ' + esc(autoWhen(w.lastAt)) : 'Nothing has arrived yet') +
          '</span>' +
          '<span class="ag-auto-step ag-auto-none">id ' + esc(w.id) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="ag-auto-acts">' +
        // ⚠ CLOSING IT IS THE THING THE MILESTONE ASKS FOR — *disable incoming events* — and
        // it is a separate act from deleting: a closed address keeps its key and can be opened
        // again, a deleted one cannot be recovered at all.
        '<button class="ag-auto-btn" data-act="agent-wh-enable" data-id="' + esc(w.id) + '"' +
          ' data-on="' + (on ? '0' : '1') + '"' + (agentWhBusy ? ' disabled' : '') + '>' +
          (on ? 'Close' : 'Open') + '</button>' +
        '<button class="ag-auto-btn" data-act="agent-wh-delete" data-id="' + esc(w.id) + '"' +
          (agentWhBusy ? ' disabled' : '') + '>Delete</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/**
 * ⚠ **THE ONE TIME THE SIGNING KEY IS EVER SEEN, and the panel says so in as many words.**
 *
 * `agent.create_webhook` takes the secret and does not answer it, `agent.list_webhooks` never
 * selects the column, and there is no rotate — so this is not a convenience, it is the only
 * door. A person who closes this without copying it has to delete the address and make
 * another. **Nothing stores it**: not `localStorage`, not the URL, and a reload loses it,
 * which is deliberate — a copy of a signing key sitting in browser storage with nothing that
 * cleans it up is worse than having to make a new address.
 */
function agentWhSecretHtml() {
  const k = agentWhSecret;
  if (!k) return '';
  return '<div class="ag-form">' +
      '<div class="ag-auto-n">' + esc(k.name || 'Your new address') + ' is ready</div>' +
      '<label class="ag-lbl">Where to send to</label>' +
      '<input class="ag-in" readonly value="' + esc(k.path || '') + '">' +
      '<div class="ag-hint">Send a POST here on the agent service. It raises ' +
        esc(k.event || '') + ', so an automation set to start on that event will run.</div>' +
      '<label class="ag-lbl">The signing key</label>' +
      '<input class="ag-in" readonly value="' + esc(k.secret || '') + '">' +
      '<div class="ag-err">Copy this now. It is the only time it is shown — it is not stored ' +
        'anywhere you can read it back, and there is no way to ask for it again. If you lose ' +
        'it, delete this address and make another.</div>' +
      '<div class="ag-hint">Sign each delivery with it: an <code>x-agent-timestamp</code> ' +
        'header, and <code>x-agent-signature</code> as HMAC-SHA256 over ' +
        '<code>timestamp.body</code>. Deliveries more than a few minutes out are refused.</div>' +
      '<div class="ag-actions">' +
        '<button class="ag-save" data-act="agent-wh-secret-done">I have copied it</button>' +
      '</div>' +
    '</div>';
}

/**
 * ⚠ **AN ANSWER WHOSE FORM HAD MOVED ON, said out loud above whatever is on screen now.**
 *
 * Drawn only while the account that asked is signed in AND that agent's addresses are open, so
 * a key can never reach another account and never appears beside another agent's things. Read
 * at DRAW time, so signing out or walking away takes it off the screen without anything having
 * to remember to clear it.
 *
 * **THE KEY ITSELF IS NOT IN THIS MARKUP.** It is behind a press, which is what keeps it out of
 * a screenshot of the list, out of a page somebody leaves open, and out of the markup of every
 * render until it is asked for. The address is named so the press is about a known thing.
 *
 * **A REFUSAL NAMES WHAT IT WAS ABOUT**, for the same reason it is not in `agentWhActErr`: over
 * a form holding different words it would read as that form's problem.
 */
function agentWhHeldHtml() {
  const h = agentWhHeld;
  if (!h || h.uid !== agentUid() || h.agent !== agentWh) return '';
  const what = (h.name || '') + (h.event ? ' (' + (h.event) + ')' : '');
  const named = what.trim() ? esc(what.trim()) : 'the address you were making';
  if (h.why) {
    return '<div class="ag-form">' +
        '<div class="ag-auto-n">That earlier save didn\u2019t work</div>' +
        '<div class="ag-err">' + named + ' wasn\u2019t made: ' + esc(h.why) + '</div>' +
        '<div class="ag-hint">This is about the save you started before this one, not about ' +
          'anything on screen now. Nothing you have typed since has been touched.</div>' +
        '<div class="ag-actions">' +
          '<button class="ag-save" data-act="agent-wh-held-show">OK</button>' +
        '</div>' +
      '</div>';
  }
  return '<div class="ag-form">' +
      '<div class="ag-auto-n">' + named + ' was made</div>' +
      '<div class="ag-hint">You had moved on by the time the server answered, so it isn\u2019t ' +
        'shown below as a new form — but the address is live and takes deliveries. Its signing ' +
        'key came back in that one answer and comes back nowhere else.</div>' +
      // ⚠ THE SENTENCE SAYS WHAT THE HOLD REALLY SURVIVES, which is not the same as what the
      // panel below survives. The panel is cleared by every door (`agentWhOpenForm`); the hold
      // is memory bound to an account and an agent, so walking to the automations and back
      // still has it — losing a live address's only key to a stray click would be the harm
      // this exists to prevent. What ends it is a reload, signing out, or showing it.
      '<div class="ag-err">Reloading the page or signing out ends this offer, and then the ' +
        'only way to sign for that address is to delete it and make another. It is held in ' +
        'this page\u2019s memory and nowhere else.</div>' +
      '<div class="ag-actions">' +
        '<button class="ag-save" data-act="agent-wh-held-show">Show the signing key</button>' +
      '</div>' +
    '</div>';
}

/** The form: a name, and which event a delivery raises. */
function agentWhFormHtml() {
  const d = agentWhDraft || { name: '', event: '' };
  return '<div class="ag-form" id="agWhForm">' +
      '<label class="ag-lbl">What is it for</label>' +
      '<input class="ag-in" data-field="name" data-input="agent-wh" maxlength="120"' +
        ' placeholder="Our shop’s orders" value="' + esc(d.name) + '">' +

      '<label class="ag-lbl">What arriving here means</label>' +
      '<input class="ag-in" data-field="event" data-input="agent-wh" maxlength="64"' +
        ' placeholder="order.paid" value="' + esc(d.event) + '">' +
      // ⚠ **THE TWO NAMES HAVE TO MATCH OR NOTHING EVER RUNS**, and this is the only place
      // somebody is told so. An automation's trigger box takes the same word; an address
      // raising a name no automation listens for takes deliveries and starts nothing —
      // a control that answers, which the arrivals list below then shows honestly as
      // "nothing was listening".
      '<div class="ag-hint">Lower case, letters and digits, with dots or dashes — for example ' +
        '<code>order.paid</code>. Put the same name in an automation’s “It also starts when ' +
        'this happens” box and that automation will run whenever something arrives here.</div>' +

      '<div class="ag-hint">The signing key is made on the server when you save. You are shown ' +
        'it once, on the next screen, and it is never shown again.</div>' +
      (agentWhActErr ? '<div class="ag-err">' + esc(agentWhActErr) + '</div>' : '') +
      '<div class="ag-actions">' +
        '<button class="ag-save" data-act="agent-wh-save"' + (agentWhBusy ? ' disabled' : '') + '>' +
          (agentWhBusy ? 'Making…' : 'Make the address') + '</button>' +
        '<button class="ag-cancel" data-act="agent-wh-cancel">Cancel</button>' +
      '</div>' +
    '</div>';
}

/**
 * ⚠ **WHAT BECAME OF EACH ARRIVAL — four words, because the four are four different things.**
 *
 * The milestone asks for the difference between *received*, *rejected*, *ignored* and
 * *starting a run*, and three of those are in this list. **THE FOURTH IS NOT AND CANNOT BE**:
 * a wrong signature, a stale timestamp or an unknown address is refused before any row is
 * written — in one sentence deliberately, so the address cannot be used to find out which ids
 * exist — so there is nothing recorded to show. The sentence under the list says that, because
 * an empty section reads as *nothing has been rejected*, which is a claim nobody can make.
 *
 * The words come from the row's own `state`, which the server derived; a state this does not
 * recognise draws its own word rather than a blank.
 */
const WH_EVENT_WORDS = {
  queued: 'Just arrived',
  started: 'Started a run',
  woke: 'Released something waiting',
  ignored: 'Nothing was listening',
};

function agentWhEventsHtml() {
  if (agentWhEventsErr) {
    return '<div class="ag-err">' + esc(agentWhEventsErr) + '</div>';
  }
  if (agentWhEvents === null) return '<div class="ag-auto-none">Loading what has arrived…</div>';
  if (!agentWhEvents.length) {
    return '<div class="ag-auto-none">Nothing has arrived yet. When something does, it shows ' +
      'here with what it started.</div>';
  }
  return agentWhEvents.map((ev) =>
    '<div class="ag-run">' +
      '<div class="ag-run-top">' +
        '<span class="ag-chip ag-chip-' +
          // THE CHIP REUSES THE EXECUTION HISTORY'S OWN STATE CLASSES, so an arrival that
          // started something reads the way a run that is going does, and one nobody was
          // listening for reads the way a skipped step does. No new class, no new colour.
          esc(ev.state === 'ignored' ? 'skipped' : ev.state === 'queued' ? 'queued' : 'running') +
          '">' + esc(WH_EVENT_WORDS[ev.state] || ev.state) + '</span>' +
        '<span class="ag-run-when">' + esc(autoWhen(ev.at)) + '</span>' +
        '<span class="ag-run-how">' + esc(ev.name || '?') +
          (ev.source ? ' · ' + esc(ev.source) : '') + '</span>' +
      '</div>' +
      (ev.state === 'ignored'
        ? '<div class="ag-run-why">It arrived and nothing was set to start on it. Put ' +
            esc(ev.name || 'that name') + ' in an automation’s “It also starts when this ' +
            'happens” box and the next one will run it.</div>'
        : '') +
      (ev.state === 'queued'
        ? '<div class="ag-run-why">It has arrived and hasn’t been looked at yet — that happens ' +
            'within a minute.</div>'
        : '') +
      (ev.state === 'woke'
        ? '<div class="ag-run-why">It released ' + esc(String(ev.woke || 1)) + ' run that was ' +
            'waiting for exactly this.</div>'
        : '') +
      // ⚠ **FROM THE ARRIVAL TO THE RUN — a control and not a sentence, and it carries BOTH
      // IDS.** Each entry names its automation as well as its run, because an execution is read
      // through its automation's history and a bare run id could not be opened from anywhere;
      // and the RUN has to travel too, or two arrivals that started two runs of one automation
      // both open the same history with nothing saying which row either of them meant.
      ((ev.runs || []).length
        ? '<div class="ag-actions">' + (ev.runs || []).map((r, i) =>
            '<button class="ag-auto-btn" data-act="agent-wh-run" data-auto="' + esc(r.automation) + '"' +
              ' data-run="' + esc(r.id) + '">' +
              'Open the run' + ((ev.runs || []).length > 1 ? ' (' + (i + 1) + ')' : '') +
            '</button>').join('') + '</div>'
        : '') +
    '</div>').join('');
}

/**
 * THE WHOLE SCREEN: the addresses, then what has arrived at them.
 *
 * Three states and no fourth, the way the accounts screen has two: the LIST, the FORM over it,
 * and the SECRET over that. A form is drawn over the list rather than beside it, so nothing
 * redraws behind somebody who is typing.
 */
function webhooksHtml() {
  const agent = (agentRows || []).find((a) => a.id === agentWh) || null;
  const full = agentWhMax > 0 && (agentWhRows || []).length >= agentWhMax;
  const head =
    '<div class="ag-head ag-thread-head">' +
      '<button class="ag-back" data-act="agent-wh-back" aria-label="Back to the conversation" title="Back">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>' +
      '</button>' +
      '<div class="ag-thread-name">Where things arrive' + (agent ? ' · ' + esc(agent.name) : '') + '</div>' +
      // ⚠ NO PLUS WHILE THE FORM OR THE SECRET IS OPEN, and none when the agent is full: a
      // button that answers "that's as many as one agent can hold" is one nobody should press.
      (!agentWhNew && !agentWhSecret && !full
        ? '<button class="ag-edit" data-act="agent-wh-new" aria-label="Make an arrival address" title="Make an arrival address">' +
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>' +
          '</button>'
        : '') +
    '</div>';

  // ⚠ A HELD ANSWER IS DRAWN ABOVE ALL THREE STATES, not instead of any of them: it is about a
  // save that has already happened, and the form, the panel and the list are about now. It is
  // above rather than below because a key that is about to be lost is the most urgent thing on
  // the screen.
  const held = agentWhHeldHtml();

  if (agentWhSecret) return '<div class="ag-page ag-thread-page">' + head + held + agentWhSecretHtml() + '</div>';
  if (agentWhNew) return '<div class="ag-page ag-thread-page">' + head + held + agentWhFormHtml() + '</div>';

  let body;
  if (agentWhState === 'loading' && agentWhRows === null) {
    body = '<div class="ag-empty"><div class="ag-empty-s">Loading…</div></div>';
  } else if (agentWhState === 'error' && agentWhRows === null) {
    body = '<div class="ag-empty">' +
             '<div class="ag-empty-t">Couldn’t load the arrival addresses</div>' +
             '<div class="ag-empty-s">' + esc(agentWhErr) + '</div>' +
             '<button class="ag-retry" data-act="agent-wh-reload">Try again</button>' +
           '</div>';
  } else if (!(agentWhRows || []).length) {
    body = '<div class="ag-empty">' +
             '<div class="ag-empty-t">Nothing arrives here yet</div>' +
             '<div class="ag-empty-s">Make an address and your own systems can start this ' +
               'agent’s automations. Each address raises one event name; an automation set to ' +
               'start on that name runs whenever something arrives.</div>' +
           '</div>';
  } else {
    body = (agentWhRows || []).map(agentWhRowHtml).join('');
  }
  return '<div class="ag-page ag-thread-page">' + head + held +
    (agentWhActErr ? '<div class="ag-err">' + esc(agentWhActErr) + '</div>' : '') +
    body +
    '<div class="ag-auto-n">What has arrived</div>' +
    agentWhEventsHtml() +
    // ⚠ **A REFUSED DELIVERY LEAVES NO TRACE, AND SAYING SO IS THE POINT.** Without this
    // sentence an empty list reads as *nothing has been rejected*, which is a claim this
    // platform cannot make: a wrong signature is refused before anything is written.
    '<div class="ag-hint">Only deliveries that were accepted are listed. One that was refused ' +
      '— a wrong signature, a timestamp too far out, or an address that has been deleted — is ' +
      'turned away before anything is recorded, so it never appears here.</div>' +
    '</div>';
}

/**
 * ⚠ THE AUTOMATIONS SCREEN.
 *
 * Two states and no third: the LIST, and one automation's FORM. A form is opened over
 * the list rather than beside it, so nothing redraws behind somebody who is typing — the
 * one rule that makes the whole of this safe without a per-input guard.
 */
function automationsHtml() {
  const agent = (agentRows || []).find((a) => a.id === agentAuto) || null;
  const head =
    '<div class="ag-head ag-thread-head">' +
      '<button class="ag-back" data-act="agent-auto-back" aria-label="Back to the conversation" title="Back">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>' +
      '</button>' +
      '<div class="ag-thread-name">Automations' + (agent ? ' · ' + esc(agent.name) : '') + '</div>' +
      (agentAutoEditing === null
        ? (autoExample()
             ? '<button class="ag-edit" data-act="agent-auto-example" aria-label="Start from an example" title="Start from an example">' +
                 '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11h6M9 15h4"></path><path d="M6 3h9l3 3v15H6z"></path></svg>' +
               '</button>'
             : '') +
          '<button class="ag-edit" data-act="agent-auto-new" aria-label="New automation" title="New automation">' +
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>' +
          '</button>'
        : '') +
    '</div>';

  if (agentAutoEditing !== null) return '<div class="ag-page ag-thread-page">' + head + automationFormHtml(agent) + '</div>';
  // ⚠ THE ASK FORM IS ALSO A SCREEN OF ITS OWN, for the same reason the edit form is:
  // nothing may redraw behind somebody who is typing, and a form drawn INSIDE a list that
  // a watch is refreshing would be exactly that.
  if (agentAutoAsk) return '<div class="ag-page ag-thread-page">' + head + automationAskHtml() + '</div>';

  // ── the list ─────────────────────────────────────────────────────────────
  let body;
  if (agentAutoState === 'loading' && agentAutoRows === null) {
    body = '<div class="ag-empty"><div class="ag-empty-s">Loading…</div></div>';
  } else if (agentAutoState === 'error' && agentAutoRows === null) {
    body = '<div class="ag-empty">' +
             '<div class="ag-empty-t">Couldn’t load the automations</div>' +
             '<div class="ag-empty-s">' + esc(agentAutoErr) + '</div>' +
             '<button class="ag-retry" data-act="agent-auto-reload">Try again</button>' +
           '</div>';
  } else if (!(agentAutoRows || []).length) {
    body = '<div class="ag-empty">' +
             '<div class="ag-empty-t">No automations yet</div>' +
             '<div class="ag-empty-s">An automation runs a short list of steps — on its own every day, or whenever you press Run now. It doesn’t use the model.</div>' +
             '<button class="ag-retry" data-act="agent-auto-new">New automation</button>' +
             // ⚠ **THE EXAMPLE IS OFFERED WHERE SOMEBODY HAS NOTHING TO START FROM, and it
             // seeds the SAME form the blank one opens** — every field, step and input
             // editable the instant it is drawn. Not drawn at all when the server sent no
             // example, because a button that seeds nothing is a dead control.
             (autoExample() ? '<button class="ag-retry ag-auto-eg" data-act="agent-auto-example">' +
               'Start from an example' + '</button>' : '') +
           '</div>';
  } else {
    body = (agentAutoRows || []).map(automationRowHtml).join('');
  }

  return '<div class="ag-page ag-thread-page">' + head +
    '<div class="ag-autos">' +
      // A READ THAT FAILED WHILE ROWS WERE ALREADY ON SCREEN says so ABOVE them rather
      // than replacing them: what is drawn is still the last thing the server really said.
      (agentAutoState === 'error' && agentAutoRows !== null
        ? '<div class="ag-err">' + esc(agentAutoErr) + '</div>' : '') +
      (agentAutoActErr ? '<div class="ag-err">' + esc(agentAutoActErr) + '</div>' : '') +
      body +
    '</div>' +
  '</div>';
}

/** One automation in the list: what it is, when it next runs, and what it has done. */
function automationRowHtml(a) {
  const open = agentAutoRunsFor === a.id;
  return '<div class="ag-auto' + (a.enabled ? '' : ' ag-auto-off') + '">' +
    '<div class="ag-auto-top">' +
      '<div class="ag-auto-m">' +
        '<div class="ag-auto-n">' + esc(a.name) +
          (a.enabled ? '' : '<span class="ag-chip ag-chip-off">Off</span>') +
        '</div>' +
        '<div class="ag-auto-s">' + esc(autoTrigger(a)) +
          // THE NEXT SCHEDULED RUN, which is the one thing a schedule has to be able to say.
          // ⚠ GATED ON THERE BEING ONE rather than on the schedule being `daily`: a weekly one
          // has a next instant too, and a `once` one has none left after it has run — which is
          // the honest reading of an absent value rather than a fifth branch.
          (a.nextRunAt ? ' · next ' + esc(autoWhen(a.nextRunAt)) : '') +
          // AND THE OTHER WAY IN, on the row, because a person scanning the list has to be able
          // to see that something else starts it. The form is where it can be changed.
          (agentAutoListensFor(a) ? ' · also on ' + esc(agentAutoListensFor(a)) : '') +
        '</div>' +
        '<div class="ag-auto-steps">' +
          ((a.steps || []).length
            ? (a.steps || []).map((st, i) =>
                '<span class="ag-auto-step">' + (i + 1) + '. ' + esc(autoStepLine(st)) + '</span>').join('')
            : '<span class="ag-auto-step ag-auto-none">No steps yet</span>') +
        '</div>' +
      '</div>' +
      '<div class="ag-auto-acts">' +
        '<button class="ag-auto-btn" data-act="agent-auto-run" data-id="' + esc(a.id) + '"' +
          (agentAutoBusy ? ' disabled' : '') + '>Run now</button>' +
        '<button class="ag-auto-btn" data-act="agent-auto-toggle" data-id="' + esc(a.id) + '"' +
          ' data-on="' + (a.enabled ? 'off' : 'on') + '"' + (agentAutoBusy ? ' disabled' : '') + '>' +
          (a.enabled ? 'Turn off' : 'Turn on') + '</button>' +
        '<button class="ag-auto-btn" data-act="agent-auto-edit" data-id="' + esc(a.id) + '">Edit</button>' +
        '<button class="ag-auto-btn" data-act="agent-auto-history" data-id="' + esc(a.id) + '">' +
          (open ? 'Hide runs' : 'Runs') + '</button>' +
      '</div>' +
    '</div>' +
    (open ? automationRunsHtml() : '') +
  '</div>';
}

/**
 * How an execution started, in words, and there are THREE ways rather than two.
 *
 * ⚠ **THIS ROW USED TO SAY `trigger === 'schedule' ? 'Scheduled' : 'Run now'`, so an
 * execution an inbound ENDPOINT started read as one somebody had pressed** — a claim about a
 * person's own action, about an action nobody took. Found in a real browser: an event
 * delivered to `/deliver/<id>` produced a history row saying "Run now".
 *
 * ⚠ **AND THE FALLBACK CLAIMS NOTHING.** `executionRow` answers `null` for a trigger it
 * cannot read, and every word above is a statement about who or what started the run — so a
 * fourth value gets "Started", which is the one thing that is true of all of them.
 */
const AUTO_TRIGGER_WORDS = { manual: 'Run now', schedule: 'Scheduled', event: 'From an event' };
function autoHow(trigger) { return AUTO_TRIGGER_WORDS[trigger] || 'Started'; }

/** The words for each state, and they are six different things to say. */
const AUTO_STATE_WORDS = {
  queued: 'Queued', done: 'Done', skipped: 'Skipped',
  failed: 'Failed', missed: 'Missed', paused: 'Agent paused',
  // ⚠ TWO MORE, AND NEITHER IS A FAILURE. `waiting` is work in progress that is holding
  // nothing open; `rejected` is somebody having looked at it and said no, which is the
  // automation doing exactly what it was asked.
  waiting: 'Waiting', rejected: 'Rejected',
  // ⚠ **AND THREE MORE, EACH REPLACING A WORD THAT WAS WRONG.** `running` was `Queued`
  // (about a run half way through); `cancelled` and `unresolved` were both `Failed` —
  // one is somebody's own decision and the other is *nobody knows*, and neither is the
  // automation having broken. `Stopped` rather than `Cancelled` because it is what the
  // person did rather than a verdict on the work, and `Unconfirmed` rather than
  // `Unresolved` because the question is whether the send can be confirmed.
  running: 'Running', cancelled: 'Stopped', unresolved: 'Unconfirmed',
};

/**
 * ⚠ **WHICH STATES A RUN CAN BE STOPPED FROM — and the milestone's own words are *show Stop
 * only when applicable*.**
 *
 * These are exactly the three `executionRow` answers for a run that has NOT stopped
 * (`run_status !== 'stopped'` → `waiting` if it is holding, else `running` or `queued` by how
 * far it got). Every other state in `AUTOMATION_STATES` belongs to a run whose `stopped` entry
 * is already written, and `agent.cancel_run` answers `alreadyStopped` for one of those — so a
 * button there is a control that reports success and changes nothing.
 *
 * **`unresolved` IS THE ONE WORTH SAYING OUT LOUD.** It reads like something still in the air
 * and it is not: the run has ENDED, and what is unknown is whether a message the provider
 * never answered for went out. Stopping it would promise to reach something that is already
 * past reaching, which is the one claim a cancellation must never make.
 *
 * It is a DECLARED COPY of that partition — this file cannot import from `agent-store.mjs` —
 * and `test/agent-automations.test.mjs` censuses it against `executionRow` itself, driving a
 * row in each state rather than reading a list, so a fourth live state cannot arrive without
 * this being decided.
 */
const AUTO_STOPPABLE = ['queued', 'running', 'waiting'];

/**
 * ⚠ **THE THREE THINGS SOMEBODY MIGHT MEAN, AND THEY ARE THREE — the milestone asks for the
 * distinction in as many words.**
 *
 * | what | reaches |
 * |---|---|
 * | Stop | THIS run, and nothing else. The automation still runs next time. |
 * | turn the automation off | every future run of it. Nothing under way is touched. |
 * | pause the agent | every automation of that agent, and its conversation too. |
 *
 * Three different scopes, so a screen that offered one word for them would have somebody
 * stopping tonight's run when they meant to stop the automation, or the reverse. The sentence
 * beside the button says which this is; the other two have their own controls elsewhere on
 * this screen, and it names them rather than describing them.
 */
const AUTO_STOP_SCOPE = 'This stops this one run and nothing else — the automation stays on '
  + 'and will run again next time. To stop it running again, turn the automation off; to stop '
  + 'everything this agent does, pause the agent in its settings.';

/**
 * The form an automation's inputs are filled in on, before it runs.
 *
 * **ITS OWN SCREEN, AND ITS DEFAULTS ARE ALREADY IN THE BOXES** — so an automation run a
 * second time with the same answers is one press and a confirm rather than a form to fill
 * in twice.
 */
function automationAskHtml() {
  const row = (agentAutoRows || []).find((a) => a.id === agentAutoAsk.id) || null;
  const asks = (row && row.inputs) || [];
  const vals = agentAutoAsk.values || {};
  return '<div class="ag-form">' +
    '<div class="ag-auto-n">' + esc((row && row.name) || 'Run it now') + '</div>' +
    '<div class="ag-hint">These are saved with the run, so what it does is a record of what you asked for.</div>' +
    asks.map((d) =>
      '<label class="ag-lbl">' + esc(d.label || d.name) +
        (d.required ? '' : ' <span class="ag-step-k">optional</span>') + '</label>' +
      '<input class="ag-in" data-ask="' + esc(d.name) + '" maxlength="4000"' +
        ' placeholder="' + esc(d.default || '') + '" value="' + esc(vals[d.name] || '') + '">').join('') +
    '<div class="ag-actions">' +
      '<button class="ag-save" data-act="agent-auto-ask-go"' + (agentAutoBusy ? ' disabled' : '') + '>' +
        (agentAutoBusy ? 'Starting…' : 'Run it') + '</button>' +
      '<button class="ag-cancel" data-act="agent-auto-ask-cancel">Cancel</button>' +
    '</div>' +
    '<div class="ag-err">' + esc(agentAutoActErr) + '</div>' +
  '</div>';
}

/** One automation's history: what each run did, step by step. */
/**
 * Is there a sentence to draw here?
 *
 * The one test every optional line in an execution goes through, so `null`, an absent
 * key and an empty string are one answer — "nothing was said" — rather than three
 * shapes each reader has to remember.
 */
function autoSaid(v) { return typeof v === 'string' && v !== ''; }

/**
 * ⚠ **WHAT A WAITING SEND WOULD ACTUALLY SEND — and the screen used to offer Approve without
 * it.**
 *
 * The pause's own `ask` reads *"send to someone@example.com from ops@example.com"*: the
 * sender and the recipient, and **not one word of the message**. So somebody could approve
 * words they had never read, which is the one mistake on this path that cannot be taken back.
 *
 * **IT IS THE PERSISTED REQUEST'S ARGUMENTS AND NEVER THE AUTOMATION'S CURRENT FORM.** The
 * route joins them on from `agent.tool_approvals`; the editable configuration is the wrong
 * source twice over — it is not what was put up for approval, and it is not what the hash on
 * the request is over, so a workflow edited while a run waits would show a message the
 * database will refuse to match.
 *
 * **THREE STATES, AND `request` CARRIES THE THIRD.** No request is an approval STEP — there is
 * no payload, there never was, and this draws nothing so every ordinary workflow approval
 * reads exactly as it did. A request with no payload is *we could not load it*, which gets a
 * sentence and no Approve button. A payload is the thing itself.
 */
function agentWaitPayloadHtml(w) {
  if (!w || typeof w.request !== 'string' || !w.request) return '';
  if (!agentArgsReadable(w.payload)) {
    return '<div class="ag-ap-none">What this would send couldn’t be loaded, so there is ' +
      'nothing to show you — don’t approve it. Reject it and run the automation again, and it ' +
      'will be put up for approval afresh.</div>';
  }
  return agentArgsHtml(w.payload);
}

/**
 * ⚠ **MAY THIS BE APPROVED FROM HERE — asked of the pause, and it FAILS CLOSED.**
 *
 * Approving what you were not shown is the mistake this whole block exists to prevent, so a
 * request whose payload could not be loaded gets no Approve button at all. **A pause with no
 * request is approvable**: it is an approval STEP, whose subject is the question itself and
 * is already on the screen as `ask`.
 *
 * **THIS IS NOT THE WALL AND MUST NOT BE MISTAKEN FOR ONE.** What makes an approval bind to
 * the words that go out is the hash `agent.decide_tool_approval` compares inside the
 * statement that reads the row — a payload changed since it was shown answers `stale` and
 * nothing is sent. This is the screen declining to ASK for a decision it cannot put a subject
 * in front of.
 */
function agentWaitApprovable(w) {
  if (!w || w.kind !== 'approval') return false;
  if (typeof w.request !== 'string' || !w.request) return true;
  return agentArgsReadable(w.payload);
}

/**
 * ⚠ **THE RUN SOMEBODY ASKED TO SEE, SAID BEFORE THE LIST — or said to be missing.**
 *
 * Two sentences and they are two different facts. A want that IS in the list gets a line saying
 * where to look, and its row gets a mark. A want that is NOT gets a refusal, because the whole
 * defect being closed is a screen that answered a request for one execution by showing another
 * one: "here is the history" over a list that does not contain the thing pressed reads as *this
 * is it*. So it says, in as many words, that nothing below is that run.
 *
 * **BOTH ARE DECIDED FROM THE LIST THIS FUNCTION IS ABOUT TO DRAW**, never from a field on the
 * answer. That is what makes the sentence and the mark unable to disagree: "found" is exactly
 * "there is a row to mark".
 */
function automationWantHtml(want, found) {
  if (!want) return '';
  if (found) {
    return '<div class="ag-hint">The run that arrival started is marked below.</div>';
  }
  return '<div class="ag-err">That arrival’s run isn’t in this history — it may no longer ' +
    'exist. Nothing below is it.</div>';
}

function automationRunsHtml() {
  if (agentAutoRunsErr) return '<div class="ag-auto-runs"><div class="ag-err">' + esc(agentAutoRunsErr) + '</div></div>';
  if (agentAutoRuns === null) return '<div class="ag-auto-runs"><div class="ag-auto-none">Loading…</div></div>';
  const want = agentAutoWantedRun();
  const found = !!want && agentAutoRuns.some((r) => r && r.id === want);
  if (!agentAutoRuns.length) {
    return '<div class="ag-auto-runs">' + automationWantHtml(want, found) +
      '<div class="ag-auto-none">It hasn’t run yet.</div></div>';
  }
  return '<div class="ag-auto-runs">' + automationWantHtml(want, found) + agentAutoRuns.map((r) =>
    '<div class="ag-run">' +
      '<div class="ag-run-top">' +
        '<span class="ag-chip ag-chip-' + esc(r.state) + '">' + esc(AUTO_STATE_WORDS[r.state] || r.state) + '</span>' +
        // ⚠ **WHICH ROW THE ARRIVAL MEANT.** On the row itself rather than only in the line
        // above the list, because a history holds up to `MAX_EXECUTIONS` of them and a sentence
        // at the top cannot point at one forty rows down. No new class: the plain chip already
        // has a rule, and it deliberately carries none of the state colours — this says where
        // the row came from, not what became of it.
        (want && r.id === want ? '<span class="ag-chip">From that arrival</span>' : '') +
        '<span class="ag-run-when">' + esc(autoWhen(r.at)) + '</span>' +
        '<span class="ag-run-how">' + esc(autoHow(r.trigger)) +
          (r.occurrence ? ' · ' + esc(r.occurrence) : '') + '</span>' +
        // ⚠ **STOP, AND ONLY WHERE IT APPLIES.** `AUTO_STOPPABLE` is the three states a run
        // that has not stopped can be in; on any other state `agent.cancel_run` answers
        // `alreadyStopped`, so a button there would report success and change nothing — the
        // dead control that ANSWERS. It sits in the row's own top line rather than in a
        // section of its own, because it is about the run and not about what the run is
        // waiting for.
        (AUTO_STOPPABLE.indexOf(r.state) !== -1
          ? '<button class="ag-auto-btn" data-act="agent-auto-stop" data-run="' + esc(r.id) + '"' +
              (agentAutoStopping ? ' disabled' : '') + '>' +
              (agentAutoStopping === r.id ? 'Stopping…' : 'Stop') + '</button>'
          : '') +
      '</div>' +
      // ⚠ **WHAT STOPPING WOULD AND WOULD NOT REACH, beside the button rather than only in
      // the confirm.** A person deciding needs it before they press, and the confirm is gone
      // the instant they answer it. Three scopes, three controls, named — see
      // `AUTO_STOP_SCOPE`.
      (AUTO_STOPPABLE.indexOf(r.state) !== -1
        ? '<div class="ag-hint">' + esc(AUTO_STOP_SCOPE) + '</div>' : '') +
      // THE FINAL RESULT, THE REASON IT SKIPPED, OR THE ERROR — one of the three, never
      // two, because an execution ended exactly one way.
      //
      // ⚠ **ASKED AS "IS THERE A SENTENCE HERE", NEVER AS `!== null`.** `executionRow`
      // answers all three as `string | null`, so `!== null` was right for every row this
      // Worker can send — and `undefined !== null` is TRUE, so a row that simply does not
      // CARRY the key drew the literal word `undefined`, three times, in the execution
      // history. **Measured, in a render**: a row with the three keys absent produced
      // `<div class="ag-run-out">undefined</div>` and two more like it, the last of them in
      // the red error slot. No unit case saw it because every fixture was the real
      // producer's output. *Cannot-tell must never read as a value* — and a renderer is
      // exactly where a row from some other shape eventually arrives.
      (autoSaid(r.result) ? '<div class="ag-run-out">' + esc(r.result) + '</div>' : '') +
      (autoSaid(r.why) ? '<div class="ag-run-why">' + esc(r.why) + '</div>' : '') +
      (autoSaid(r.error) ? '<div class="ag-run-err">' + esc(r.error) + '</div>' : '') +
      (r.state === 'missed' && r.missed
        ? '<div class="ag-run-why">' + esc(String(r.missed)) + ' scheduled run' + (r.missed === 1 ? '' : 's') +
          ' went by while nothing was running them.</div>' : '') +
      (r.state === 'paused'
        ? '<div class="ag-run-why">The agent was paused, so this one didn’t start.</div>' : '') +
      // ⚠ **A STOPPED RUN SAYS WHO, WHY, AND HOW FAR IT GOT — AND NEVER THAT ANYTHING WAS
      // UNDONE.** The counts are the only honest thing to say about it: cancelling stops
      // what is still to come and cannot reach back to a message that has gone out. The
      // sentence says so in as many words rather than leaving somebody to assume either way.
      (r.state === 'cancelled'
        ? '<div class="ag-run-why">Stopped' +
            (autoSaid(r.cancelledWhy) ? ' — ' + esc(r.cancelledWhy) : '') + '. ' +
            (Number.isInteger(r.completedSteps)
              ? esc(String(r.completedSteps)) + ' step' + (r.completedSteps === 1 ? '' : 's') +
                ' had already run' +
                (Number.isInteger(r.completedCalls) && r.completedCalls > 0
                  ? ' and ' + esc(String(r.completedCalls)) + ' action' +
                    (r.completedCalls === 1 ? '' : 's') + ' had already gone out'
                  : '') + '. '
              : '') +
            'Stopping it ends what was still to come — anything already sent stays sent.' +
          '</div>' : '') +
      // ⚠ **AN UNCONFIRMED SEND IS NOT A FAILURE AND MUST NOT INVITE A SECOND ONE.** The
      // message may well have gone out; what is missing is the provider's answer. So the
      // sentence says what to DO — check at the provider — rather than offering a retry,
      // and it names which step, because *"something is unconfirmed"* is not actionable.
      (r.state === 'unresolved'
        ? '<div class="ag-run-why">This one sent something and never got an answer back, so' +
            ' it can’t be confirmed either way' +
            ((r.unresolved || []).length ? ' (' + esc((r.unresolved || []).join(', ')) + ')' : '') +
            '. Check at the provider before sending again — it may already have gone.' +
          '</div>' : '') +
      // ⚠ **WHAT IT IS WAITING FOR, AND THE ONE CONTROL THAT HELPS.** A `waiting` execution
      // is holding nothing open — its worker was released and the row is off the queue — so
      // this is the only place a person can see that and the only place they can answer it.
      // **THE BUTTONS ARE DRAWN ONLY FOR AN APPROVAL**: a timed wait resumes itself, and a
      // control that did nothing would be a dead control on the one screen that must be
      // trusted about what is happening.
      (r.state === 'waiting' && r.waiting
        ? '<div class="ag-run-wait">' +
            '<div class="ag-run-why">' +
              (r.waiting.kind === 'approval'
                ? esc(r.waiting.ask || 'Waiting to be approved.')
                : 'Waiting, and carrying on by itself.') +
              (r.waiting.until ? ' <span class="ag-run-when">' +
                (r.waiting.kind === 'approval' ? 'Runs out ' : 'Carries on ') + esc(autoWhen(r.waiting.until)) +
                '</span>' : '') +
            '</div>' +
            (r.waiting.kind === 'approval'
              ? agentWaitPayloadHtml(r.waiting) +
                '<div class="ag-hint">' +
                  (r.waiting.onTimeout === 'approve' ? 'If nobody answers, it carries on anyway.'
                    : r.waiting.onTimeout === 'reject' ? 'If nobody answers, it stops as though it were rejected.'
                    : 'If nobody answers, it stops as a failure.') +
                '</div>' +
                '<input class="ag-in" data-note="' + esc(r.id) + '" maxlength="1000"' +
                  ' placeholder="Why (optional)" value="' + esc(agentAutoNotes.get(r.id) || '') + '">' +
                '<div class="ag-actions">' +
                  // ⚠ **APPROVE IS NOT DRAWN FOR SOMETHING NOBODY CAN READ, and Reject IS.**
                  // See `agentWaitApprovable`. Refusing a send you cannot see is a reasonable
                  // thing to do and it is what gets the run moving again, so withholding both
                  // would leave it stuck — the same split the banner above the message box makes.
                  (agentWaitApprovable(r.waiting)
                    ? '<button class="ag-save" data-act="agent-auto-approve" data-run="' + esc(r.id) + '"' +
                        (agentAutoDeciding ? ' disabled' : '') + '>' +
                        (agentAutoDeciding === r.id ? 'Sending…' : 'Approve') + '</button>'
                    : '') +
                  '<button class="ag-cancel" data-act="agent-auto-reject" data-run="' + esc(r.id) + '"' +
                    (agentAutoDeciding ? ' disabled' : '') + '>Reject</button>' +
                '</div>'
              : '') +
          '</div>'
        : '') +
      // WHO ANSWERED, AND WHAT THEY SAID, once it has been answered. It is the one part of
      // an execution a person put there, so it is shown rather than summarised.
      (Object.keys(r.decisions || {}).length
        ? '<div class="ag-run-steps">' + Object.keys(r.decisions).map((k) => {
            const d = r.decisions[k] || {};
            return '<div class="ag-run-step ag-step-' + (d.verdict === 'rejected' ? 'skipped' : 'ran') + '">' +
              '<span class="ag-step-w">' + esc(k) + '</span>' +
              '<span class="ag-step-o">' + esc(d.verdict || '') + '</span>' +
              '<span class="ag-step-d">' + esc(d.note || '') + '</span>' +
            '</div>';
          }).join('') + '</div>'
        : '') +
      // EACH STEP'S OWN OUTCOME. Every step gets a line, including the ones that never
      // ran — a list that stopped short would show a workflow ending for no reason.
      ((r.outcomes || []).length
        ? '<div class="ag-run-steps">' + r.outcomes.map((o, i) =>
            '<div class="ag-run-step ag-step-' + esc(o.outcome) + '">' +
              '<span class="ag-step-n">' + (i + 1) + '</span>' +
              '<span class="ag-step-w">' + esc(autoStepLabel(o.type)) + '</span>' +
              '<span class="ag-step-o">' + esc(o.outcome) +
                // ⚠ **WHICH BRANCH RAN, AS ITS OWN WORD.** An `if` is always `ran` — it did
                // its job, which was to choose — so without this the history would show two
                // identical-looking branch steps and leave somebody to work out which arm
                // was taken from which steps below it were skipped.
                (autoSaid(o.took) ? ' · ' + esc(o.took === 'first' ? 'first arm' : 'other arm') : '') +
              '</span>' +
              // ⚠ **THE MESSAGE A PERSON APPROVED, AND WHETHER IT IS SIMULATED — the brief's
              // own *show the prepared message and the provider's actual recorded outcome*.**
              // `why`/`error`/`result` are all sentences ABOUT the send; none of them is the
              // text, and the text is the thing somebody checks. The simulated label is read
              // from the OUTCOME rather than written as a constant, so connecting a real
              // provider stops it with no change here — and it rides beside the message
              // because a chip above the panel is gone the moment somebody copies this out.
              (autoSaid(o.prepared)
                ? '<span class="ag-step-msg">' + esc(o.prepared) +
                    (o.simulated === true ? ' <em>[simulated]</em>' : '') + '</span>'
                : '') +
              '<span class="ag-step-d">' + esc(o.why || o.error || o.result || '') +
                // WHERE A LOOKUP'S ANSWER CAME FROM, with the version it was at. An excerpt
                // with no source is an assertion nobody can check.
                ((o.sources || []).length
                  ? ' — ' + esc((o.sources || []).map((src) =>
                      (src.title || src.key || '?') + (src.version ? ' v' + src.version : '')).join(', '))
                  : '') +
              '</span>' +
            '</div>').join('') + '</div>'
        : '') +
    '</div>').join('') + '</div>';
}

/** The form: a name, whether it is on, how it starts, and the ordered steps. */
/**
 * ⚠ **WHICH SCHEDULES THIS FORM CAN SHOW — and it is ALL FOUR the platform stores now.**
 *
 * **IT OFFERED TWO, AND THAT WAS A MEASURED DEFECT.** `AUTOMATION_SCHEDULES` is
 * `manual · daily · weekly · once` and this `<select>` offered the first two; a `<select>` with
 * no option marked `selected` answers its FIRST option, so a stored `weekly` drew as *"Only when
 * I press Run now"*, `agentAutoValues` read that box and sent `manual`, and while the route
 * REPLACED the whole automation **editing the NAME of a weekly automation silently turned it into
 * a manual one and dropped its days**, `next_run_at` with them. Reachable throughout, because the
 * agent's own `make_automation` really does create weekly ones.
 *
 * The first fix was a WALL — refuse the save and say where it can be changed — on the reasoning
 * that *not destroying somebody's configuration is not a design decision and the controls are*.
 * **The controls are here now** (day checkboxes and a date box, in the form's own style), so the
 * platform and this screen agree about what a person can configure.
 *
 * ⚠ **AND THE WALL IS KEPT, which is not tidiness.** It fires for a schedule this list does not
 * carry — and *the platform gaining one before this form does* is precisely how the original
 * defect arrived. Unreachable from a stored row today (`automationRow` fails an unreadable
 * schedule closed to `manual`, and every schedule the server has is listed), so it is driven at
 * the unit in `test/agent-binding.test.mjs` rather than left to a fixture nobody can build.
 *
 * DERIVED FROM THE MARKUP IT IS ABOUT: one list, named beside the select, so an option added
 * there has to be added here for the refusal to lift — and `test/agent-binding.test.mjs`
 * censuses it against the option values the form really emits, both ways.
 */
const AGENT_FORM_SCHEDULES = ['manual', 'daily', 'weekly', 'once'];

/** The schedule this form cannot express, or `''` when it can. */
function agentAutoUnshowable(row) {
  const s = row && typeof row.schedule === 'string' ? row.schedule : '';
  return s && AGENT_FORM_SCHEDULES.indexOf(s) < 0 ? s : '';
}

/**
 * ⚠ **AN EDIT SENDS WHAT CHANGED, AND THAT IS WHY NOTHING IS CARRIED FORWARD ANY MORE.**
 *
 * This used to be `AGENT_FORM_KEEPS` — a list of trigger fields the form has no control for,
 * copied out of the stored row into the body so a save could not drop them. It worked for an
 * ordinary edit and it was the wrong shape: copying a value out of a row this browser read
 * minutes ago and sending it in a whole-row replace means **whatever anybody else changed since
 * is overwritten with what we remembered** — and the field it protected is exactly the one
 * nobody here can see changing.
 *
 * So the save sends only the fields that really differ from what the form was DRAWN with, and
 * `agent.patch_automation` resolves every other one from the row under its own lock. A field this
 * form has no control for is therefore absent from every body it sends, which is stronger than
 * carrying it: absent cannot be stale.
 *
 * **THE FIELDS ARE THE ONES THIS FORM DRAWS**, listed once, so a control added next month is one
 * line here and `test/agent-binding.test.mjs` censuses the list against what `agentAutoValues`
 * really answers — a field it reads and this omits would be a control somebody sets that no save
 * ever sends.
 */
const AGENT_FORM_FIELDS = ['name', 'enabled', 'schedule', 'at', 'zone', 'days', 'on_date', 'on_event', 'steps', 'inputs'];

/**
 * ⚠ **A CONFIGURATION SNAPSHOT THAT A LATER EDIT CANNOT MOVE.**
 *
 * Two things in this form take a copy of what is on screen and then await an answer about it — a
 * save and a check — and both need the copy to still mean what it meant when it was taken. The
 * draft's own arrays are rebuilt wholesale by `agentAutoFormRead` today, so a shallow copy
 * happens to be safe; that is a property of code one screen away, and this repository has the
 * expiry of exactly that kind of reasoning recorded several times over.
 *
 * **IT IS DERIVED FROM `AGENT_FORM_FIELDS`, which buys two things at once**: nothing this form
 * has no control for can be in a snapshot, and the screen's own `gen` bookkeeping cannot reach
 * the wire — absent by construction rather than destructured out at each of the two call sites.
 */
function autoSnap(v) {
  const out = {};
  for (const f of AGENT_FORM_FIELDS) out[f] = autoCopy(v ? v[f] : undefined);
  return out;
}
function autoCopy(x) {
  if (Array.isArray(x)) return x.map(autoCopy);
  if (x && typeof x === 'object') {
    const out = {};
    for (const k of Object.keys(x)) out[k] = autoCopy(x[k]);
    return out;
  }
  return x;
}

/**
 * Is this the same configuration, field for field?
 *
 * **THE SAME TEN FIELDS AND THE SAME COMPARATOR THE SAVE'S OWN DIFF USES**, so "the workflow
 * changed" and "the next Save would send something" cannot disagree about what a change is — and
 * a key ORDER difference is not one, which is what stops a step list that was only rebuilt from
 * reading as a different workflow.
 */
function autoSameConfig(a, b) {
  return AGENT_FORM_FIELDS.every((f) => autoSame(a ? a[f] : undefined, b ? b[f] : undefined));
}

/**
 * ⚠ **WHAT THE FORM'S ANSWERS SAY, DERIVED AT EVERY DRAWING RATHER THAN REMEMBERED.**
 *
 * Both of this form's answers — what a Check found, and that a Save landed — are statements about
 * a CONFIGURATION, and both used to be booleans about a moment. So a success held open while a
 * step was added said "nothing is missing" about a workflow nobody had checked, and a name typed
 * while a save was in the air was called Saved. Asked of the configuration on screen instead,
 * neither can be shown for anything but the configuration it is really about — at every drawing,
 * including ones this screen does not cause — and both come BACK if the person undoes the edit,
 * which a cleared flag could not.
 */
function agentAutoOutstanding() {
  if (!agentAutoWas || agentAutoWas.of !== agentAutoEditing) return false;
  return Object.keys(agentAutoChanges(agentAutoWas, agentAutoForm())).length > 0;
}
/** Does what the last check answered still apply to the configuration on screen? */
function agentAutoCheckOn() {
  return !!agentAutoCheck && autoSameConfig(agentAutoCheck.of, agentAutoForm());
}
/** ...and was that answer a reading rather than a refusal? */
function agentAutoCheckShown() {
  return agentAutoCheckOn() && !agentAutoCheck.error;
}
/**
 * ⚠ **THE ONE REFUSAL ON SCREEN, from either of the two places one can come from.**
 *
 * Both the bottom line and the step marker read this and nothing else, so there is exactly one
 * sentence and the marking cannot work through one holder and not the other.
 *
 * **A PRESS SUPERSEDES WHAT IS DRAWN, which is what makes the order here right rather than
 * arbitrary.** `agentAutoActErr` is the newer, more specific fact whenever it is set — a save, a
 * delete, a run — and a Check press clears it first, so a check's own answer is never hidden
 * behind a stale one.
 */
function agentAutoErrShown() {
  if (agentAutoActErr) return agentAutoActErr;
  return agentAutoCheckOn() && agentAutoCheck.error ? agentAutoCheck.error : '';
}
function agentAutoSavedShown() {
  /**
   * ⚠ **A SAVE'S OWN ERROR AND NOT EVERY REFUSAL ON SCREEN, and that is deliberate.** Widening
   * this to `agentAutoErrShown` reads as tidier and is wrong: the one state that separates the two
   * is a stored workflow the checker refuses, opened and saved with nothing changed — where the
   * save really did land (there was nothing to send) and the workflow really is refused, so BOTH
   * sentences are true and the wider reading would hide one of them. A check's refusal is not a
   * statement about whether the save landed.
   */
  return agentAutoSaved && !agentAutoActErr && !agentAutoOutstanding();
}
/**
 * The two, as one value a keystroke can compare against itself.
 *
 * **IT EXISTS SO THAT TYPING REDRAWS THE PANEL ONCE AND NOT PER KEYSTROKE.** A redraw per
 * keystroke is the twitch the read-first door exists to remove; a redraw only when what the
 * screen SAYS has stopped being true is one redraw per answer, and none at all while there is
 * nothing on screen to invalidate.
 */
function agentAutoSays() {
  // **THE REFUSAL AS ITS OWN WORDS, after a separator**, because a bound refusal ceasing to apply
  // is exactly the change a keystroke makes and a flag could not tell two sentences apart. The
  // separator is what keeps `'c' + 's'` from ever colliding with a sentence that begins with one.
  return (agentAutoCheckShown() ? 'c' : '') + (agentAutoSavedShown() ? 's' : '') +
    '|' + agentAutoErrShown();
}

/**
 * ⚠ **WHAT EACH SCHEDULE ENTAILS — a declared copy of `automations_schedule_is_whole`.**
 *
 * The database makes a half-whole combination unstorable, and the rules are per schedule rather
 * than one list: `manual` may carry no time, no days and no date; `daily` needs a time and a zone
 * and may carry no days and no date; `weekly` needs a time, a zone and one to seven days; `once`
 * needs a time, a zone and a date. So a change of schedule has to carry the fields that choice
 * ENTAILS — including clearing the ones it forbids — or the transaction refuses it by name over
 * controls that are not on the screen.
 *
 * **IT REPLACED A FLAT `AGENT_SCHED_OWNS` LIST**, which was right while the form could show two
 * schedules and says nothing about which VALUE each field must take. `test/agent-binding.test.mjs`
 * censuses this table against the constraint read out of the migration, both ways and per arm, so a
 * fifth schedule cannot be offered here and refused there.
 */
const AGENT_SCHED_SHAPE = Object.freeze({
  manual: { at: false, days: false, on_date: false },
  daily: { at: true, days: false, on_date: false },
  weekly: { at: true, days: true, on_date: false },
  once: { at: true, days: false, on_date: true },
});

/**
 * Whether two answers to one field are the same answer.
 *
 * ⚠ **A DEEP COMPARISON RATHER THAN `JSON.stringify`, and the difference decides whether a
 * name-only save reverts somebody else's steps.** Both sides come from `agentAutoValues`, so
 * their keys are built in the same order today — and a comparison that depends on that is one
 * that starts reporting every step list as changed the day a control moves in the markup, after
 * which every save carries `steps` and the lost update is back for the one field most worth
 * protecting.
 *
 * `Object.hasOwn` rather than `in`, so a key on a prototype cannot make two objects match.
 */
function autoSame(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => autoSame(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    return ka.every((k) => Object.hasOwn(b, k) && autoSame(a[k], b[k]));
  }
  return false;
}

/**
 * What an edit really changed, against the values the form was drawn with.
 *
 * **THE BASELINE IS THE FORM'S OWN, NOT THE STORED ROW'S, and that is not a shortcut.** The form
 * normalises as it seeds — a manual automation with no time draws `09:00` in a hidden box, one
 * with no zone draws this browser's guess — so diffing against the row would report two fields as
 * changed on a form nobody touched, and send them. What the person changed is the difference from
 * what they were SHOWN.
 */
function agentAutoChanges(was, now) {
  const out = {};
  for (const f of AGENT_FORM_FIELDS) {
    if (!autoSame(was ? was[f] : undefined, now[f])) out[f] = now[f];
  }
  /**
   * ⚠ **A CHANGE OF SCHEDULE CARRIES WHAT THE SCHEDULE NEEDS — and MEASURED, both directions
   * were broken without this.** The time and the zone belong to the schedule rather than to
   * themselves, and the database makes a half-whole combination unstorable
   * (`automations_schedule_is_whole`), so an edit that names one without the others is refused
   * with nothing the person can do about it:
   *
   *   daily → manual : the time box is hidden and its VALUE is unchanged, so nothing carried it
   *                    — the transaction resolved the stored time and refused `bad-schedule`,
   *                    *"one that runs by hand can't also carry a time"*, over a control that is
   *                    not on the screen.
   *   manual → daily : the stored time is NULL and the form's `09:00` is what it was drawn with,
   *                    so nothing carried it either — refused `bad-time`.
   *
   * **THIS IS NOT THE ROUTE INVENTING A REMOVAL.** The customer named the schedule, and these are
   * what that choice entails; a form that hides a control while choosing "by hand" has really
   * cleared it. Which fields a schedule owns is declared once, so a third one is a line here.
   */
  if (Object.hasOwn(out, 'schedule')) {
    const needs = AGENT_SCHED_SHAPE[out.schedule] || AGENT_SCHED_SHAPE.manual;
    // THE ZONE RIDES ON EVERY CHANGE, because three of the four schedules require one and the
    // fourth does not forbid it — so there is no clearing case and no branch to get wrong.
    out.zone = now.zone;
    // AND EACH OF THE THREE IS EITHER THE ANSWER ON SCREEN OR THE CLEAR ITS SCHEDULE DEMANDS.
    // `null` and `[]` are the clears; saying NOTHING about them would leave the transaction
    // resolving a stored day list onto a schedule that may not have one.
    out.at = needs.at ? now.at : null;
    out.days = needs.days ? now.days : [];
    out.on_date = needs.on_date ? now.on_date : null;
  }
  return out;
}

/**
 * ⚠ **WHAT A SCHEDULE NEEDS, READ THROUGH ONE FUNCTION so the markup and the save cannot
 * disagree about it.** Both ask this: the form shows a control exactly where a change of schedule
 * would send its field, so a hidden control whose value still reaches the wire — which is every
 * one of this form's own recorded defects — is not expressible.
 *
 * An unknown schedule answers `manual`'s shape, which needs nothing: the fail-closed direction,
 * because showing a control for a schedule nobody can name would be a control that answers.
 */
function autoNeeds(schedule) {
  return AGENT_SCHED_SHAPE[schedule] || AGENT_SCHED_SHAPE.manual;
}

/**
 * ⚠ **WHICH STEP A REFUSAL IS ABOUT, so it can be shown beside that step.**
 *
 * Every validator on this path — `cleanWorkflow` here and `readWorkflow` in the engine — names
 * its step by POSITION, one-based, as `step 3: …`, because a step has no name a person gave it.
 * So the message a save comes back with already says where to look; drawing it only at the bottom
 * of a form with twenty steps in it makes the person count.
 *
 * **IT READS THE SENTENCE AND CHANGES NOTHING ELSE.** No second refusal vocabulary, no code on
 * the wire, and a message it cannot attribute answers `null` — which is the ordinary case for
 * *"give it a name first"* and for every refusal about the schedule.
 *
 * ONE-BASED THERE AND ZERO-BASED HERE, converted once, because the step list is an array and an
 * off-by-one would mark the wrong step — which is worse than marking none.
 */
function agentAutoFault(msg) {
  const m = /^step (\d+): ([\s\S]+)$/.exec(typeof msg === 'string' ? msg : '');
  if (!m) return null;
  const at = Number(m[1]) - 1;
  // A POSITION THAT IS NOT A POSITION IS NOT AN ATTRIBUTION. `Number('0')` is 0, so `step 0:`
  // would mark index -1 and read as no step at all; refusing is the honest answer.
  if (!Number.isInteger(at) || at < 0) return null;
  return { at, said: m[2] };
}

/** How an event binding reads to a person, or `''` when there is none.
 *
 * **IT IS NOT THE FORM'S SEED ANY MORE — the form has its own control and seeds from
 * `agentAutoForm`.** This is the LIST's reader: a row's own line says what starts it, and a
 * reader that failed closed on a non-string is what keeps a junk column out of the markup.
 */
function agentAutoListensFor(row) {
  return row && typeof row.onEvent === 'string' ? row.onEvent : '';
}

/** How a schedule this form has no control for reads to a person. */
function agentSchedWord(s) {
  if (s === 'weekly') return 'on chosen days of the week';
  if (s === 'once') return 'once, on one date';
  return s;
}

function automationFormHtml(agent) {
  void agent;
  const f = agentAutoForm();
  const cur = agentAutoRow();
  const cat = (agentAutoCat && agentAutoCat.steps) || [];
  const days = (agentAutoCat && agentAutoCat.days) || [];
  /**
   * ⚠ **ONE HOOK ON THE FORM RATHER THAN ONE PER CONTROL, because `input` events BUBBLE.** Every
   * box in here is one somebody types in, and a per-control attribute is a list to keep in step
   * with the markup — a control added next month arriving without it is a keystroke nobody reads.
   * On the container there is nothing to forget.
   */
  return '<div class="ag-form" id="agAutoForm" data-gen="' + autoGen(agentAutoDraft) + '" data-input="agent-auto-form">' +
    '<label class="ag-lbl" for="agAutoName">Name</label>' +
    '<input class="ag-in" id="agAutoName" maxlength="' + AGENT_NAME_MAX + '" placeholder="Morning check" value="' + esc(f.name) + '">' +

    '<label class="ag-lbl" for="agAutoSched">How it starts</label>' +
    // ⚠ WHAT THIS FORM CANNOT SHOW, SAID WHERE THE CONTROL THAT CANNOT SHOW IT IS. Without
    // this the box below reads "Only when I press Run now" about an automation that runs on
    // chosen days, because a `<select>` with nothing selected answers its first option.
    (agentAutoUnshowable(cur)
      ? '<div class="ag-hint">This one runs ' +
          esc(agentSchedWord(agentAutoUnshowable(cur))) +
          ', which this form can’t change yet — so it can’t be saved from here. ' +
          'Everything else about it is shown below, and you can ask the agent in the chat to change it.</div>'
      : '<div class="ag-hint">Either way it runs the same steps, through the same queue.</div>') +
    '<select class="ag-in" id="agAutoSched" data-change="agent-auto-sched">' +
      '<option value="manual"' + (f.schedule === 'manual' ? ' selected' : '') + '>Only when I press Run now</option>' +
      '<option value="daily"' + (f.schedule === 'daily' ? ' selected' : '') + '>Every day, at a time I choose</option>' +
      '<option value="weekly"' + (f.schedule === 'weekly' ? ' selected' : '') + '>On days of the week I choose</option>' +
      '<option value="once"' + (f.schedule === 'once' ? ' selected' : '') + '>Once, on one date</option>' +
    '</select>' +
    // ⚠ **THE TIME AND THE ZONE BELONG TO THREE OF THE FOUR, so the block is shown for
    // whichever needs one rather than for `daily` alone.** Which schedule needs what is
    // `AGENT_SCHED_SHAPE`, the same table the save reads, so a control cannot be hidden for a
    // schedule whose body still carries the field — which is the shape of every one of this
    // form's own recorded defects.
    '<div class="ag-auto-when' + (autoNeeds(f.schedule).at ? '' : ' ag-auto-when-off') + '">' +
      '<label class="ag-lbl" for="agAutoAt">At</label>' +
      '<input class="ag-in ag-in-time" id="agAutoAt" type="time" value="' + esc(f.at) + '">' +
      '<label class="ag-lbl" for="agAutoZone">In this time zone</label>' +
      '<input class="ag-in" id="agAutoZone" maxlength="200" placeholder="Europe/London" value="' + esc(f.zone) + '">' +
      // SAID OUT LOUD, because it is the one thing about a timed schedule that surprises
      // people, and it is what the arithmetic really does.
      '<div class="ag-hint">The time is local to that zone, so it stays at the same clock time when the clocks change.</div>' +
    '</div>' +
    // THE DAYS, drawn from the catalog's own list so the week's order is the server's.
    '<div class="ag-auto-when' + (autoNeeds(f.schedule).days ? '' : ' ag-auto-when-off') + '">' +
      '<label class="ag-lbl">On these days</label>' +
      (days.length
        ? '<div class="ag-step-days">' + days.map((d) =>
            '<label class="ag-day">' +
              '<input type="checkbox" data-sched-day="' + esc(d) + '"' +
                ((f.days || []).indexOf(d) >= 0 ? ' checked' : '') + '>' +
              '<span>' + esc(autoDayName(d)) + '</span>' +
            '</label>').join('') + '</div>'
        // A REAL BRANCH: a Worker that predates the catalog answers no `days`, and a row of
        // nothing somebody could tick would be a control that answers.
        : '<div class="ag-nothing">The days aren\u2019t listed yet — ask the agent in the chat to set them.</div>') +
      '<div class="ag-hint">Pick at least one. It runs at the time above, on each day you pick.</div>' +
    '</div>' +
    '<div class="ag-auto-when' + (autoNeeds(f.schedule).on_date ? '' : ' ag-auto-when-off') + '">' +
      '<label class="ag-lbl" for="agAutoDate">On this date</label>' +
      '<input class="ag-in ag-in-time" id="agAutoDate" type="date" value="' + esc(f.on_date) + '">' +
      '<div class="ag-hint">It runs once, then never again — it doesn\u2019t turn itself off, so it just has nothing left to do.</div>' +
    '</div>' +
    /**
     * ⚠ **A SECOND WAY IN, AND IT IS A CONTROL NOW RATHER THAN A SENTENCE.**
     *
     * Its own field rather than folded into the either/or above, because an event is independent
     * of the schedule: both can be true at once, and *"every morning AND whenever a payment
     * lands"* is a thing somebody wants. **AN EMPTY BOX IS THE REMOVAL** — which is what makes
     * this able to take a binding off as well as put one on, and is why the sentence beside it
     * says so: a person who clears a box and presses Save has to be able to predict what that
     * did. Before this the form carried no control at all, and a save left the binding exactly
     * as it was; that was correct and it made the binding unreachable from the only screen a
     * person has.
     */
    '<label class="ag-lbl" for="agAutoEvent">It also starts when this happens</label>' +
    '<div class="ag-hint">Optional. The name of something one of your endpoints reports, like order.paid — that starts it as well, whatever the box above says. Clear the box to stop it listening.</div>' +
    '<input class="ag-in" id="agAutoEvent" maxlength="120" placeholder="order.paid" value="' + esc(f.on_event) + '">' +

    '<label class="ag-lbl">What it asks for</label>' +
    '<div class="ag-hint">Optional. Anything you name here is filled in when you press Run now, and a step can use it by putting {{the name}} in its own text.</div>' +
    '<div class="ag-auto-ins">' +
      ((f.inputs || []).length
        ? (f.inputs || []).map((d, i) => automationInputHtml(d, i, (f.inputs || []).length)).join('')
        : '<div class="ag-auto-none">It asks for nothing, so Run now starts it straight away.</div>') +
    '</div>' +
    '<div class="ag-step-add">' +
      '<button class="ag-auto-btn" data-act="agent-auto-input-add"' +
        (((f.inputs || []).length >= ((agentAutoCat && agentAutoCat.maxInputs) || 8)) ? ' disabled' : '') +
        '>+ Something to fill in</button>' +
    '</div>' +

    '<label class="ag-lbl">Steps</label>' +
    '<div class="ag-hint">They run in order. A condition that doesn’t match stops the rest — that shows as Skipped, not as a failure.</div>' +
    '<div class="ag-steps">' +
      (f.steps.length
        ? (() => { const d = autoDepths(f.steps);
            return f.steps.map((st, i) => automationStepHtml(st, i, f.steps.length, cat, days, d[i])).join(''); })()
        : '<div class="ag-auto-none">No steps yet. Add one below.</div>') +
    '</div>' +
    (cat.length
      ? '<div class="ag-step-add">' + cat.map((d) =>
          '<button class="ag-auto-btn" data-act="agent-auto-step-add" data-type="' + esc(d.type) + '"' +
            ' title="' + esc(d.does) + '">+ ' + esc(d.label) + '</button>').join('') + '</div>'
      // A REAL BRANCH, not decoration: a Worker that predates the catalog answers no
      // `steps` key, and an empty form somebody could fill in and never save is worse
      // than a sentence.
      : '<div class="ag-nothing">There are no kinds of step to add yet. When there are, they’ll be listed here.</div>') +

    '<label class="ag-lbl">Status</label>' +
    '<label class="ag-check">' +
      '<input type="checkbox" id="agAutoOff"' + (f.enabled ? '' : ' checked') + '>' +
      '<span class="ag-tool-m">' +
        '<span class="ag-check-t">Off</span>' +
        '<span class="ag-tool-d">It keeps everything it has run. It just won’t start anything new — not on its schedule, and not from Run now.</span>' +
      '</span>' +
    '</label>' +

    '<div class="ag-actions">' +
      '<button class="ag-save" data-act="agent-auto-save"' + (agentAutoBusy ? ' disabled' : '') + '>' +
        (agentAutoBusy ? 'Saving…' : 'Save') + '</button>' +
      /**
       * ⚠ **CHECK, BESIDE SAVE, because everything these validators know was reachable only by
       * pressing Save.** It writes nothing, so it can be pressed as often as somebody likes
       * while they are building — which is the whole point of having it.
       */
      '<button class="ag-cancel" data-act="agent-auto-check"' + (agentAutoBusy ? ' disabled' : '') +
        ' title="Read it through without saving it">Check</button>' +
      '<button class="ag-cancel" data-act="agent-auto-cancel">' + (cur ? 'Back' : 'Cancel') + '</button>' +
      (cur ? '<button class="ag-del" data-act="agent-auto-delete" data-id="' + esc(cur.id) + '">Delete</button>' : '') +
    '</div>' +
    /**
     * ⚠ **A SAVE THAT LANDED AND COULD NOT BE READ BACK SAYS BOTH HALVES.** The save is
     * confirmed by the server's own answer, so "Saved" is true — but the re-read right after it
     * is what replaces the form with the STORED row, and when that fails the form is still
     * showing what was typed.
     *
     * ⚠ **AND SINCE THE DRAFT IS KEPT, THE RE-READ NO LONGER REPLACES THE OPEN FORM AT ALL**, so
     * a field the server normalises is shown as it was sent whether the re-read worked or not.
     * That cost is stated where the draft is kept (`agentAutoSave`); this line stays for what it
     * is really about, which is the one case the server's answer and our reading of it disagree
     * about whether anything is there to read.
     *
     * It is plain text on the line that is already there rather than a second line in a class
     * of its own: a new class is a design decision nobody made, and "Saved, but" is one fact.
     */
    /**
     * ⚠ **WHAT A CHECK FOUND, AND THE THREE ANSWERS ARE KEPT APART.** A structural problem is
     * already drawn where a save's refusal is drawn, on the step it is about — so what is here
     * is only what a save does not answer: what the workflow NEEDS from the account, and what
     * could not be checked from here.
     *
     * **NEEDS AND COULD-NOT-CHECK READ DIFFERENTLY ON PURPOSE.** A need is something to go and
     * do; a question nobody could put is not a fault of theirs at all, and drawing it in the
     * same voice would send somebody looking for a setting to change. No new class either way —
     * `ag-err` and `ag-hint` already exist, and a class with no rule is a design decision
     * nobody made.
     *
     * ⚠ **AND IT SAYS A CHECK IS NOT PERMISSION**, because a panel that says "nothing is
     * missing" is exactly what invites somebody to read the next step as allowed.
     */
    (agentAutoCheckShown()
      ? '<div class="ag-hint">Read it through: ' + agentAutoCheck.steps + ' step' +
          (agentAutoCheck.steps === 1 ? '' : 's') +
          (agentAutoCheck.needs.length || agentAutoCheck.unchecked.length ? '.' :
            ', and nothing is missing.') +
          ' Checking doesn’t save it or give it permission — saving still asks you, and ' +
          'running it checks everything again.</div>' +
        agentAutoCheck.needs.map((n) =>
          '<div class="ag-err">Before it can run: ' + esc(String(n && n.say || '')) + '</div>').join('') +
        agentAutoCheck.unchecked.map((u) =>
          '<div class="ag-hint">Couldn’t check: ' + esc(String(u && u.why || '')) + '</div>').join('')
      : '') +
    (agentAutoSavedShown()
      ? '<div class="ag-saved">Saved. It’s on your account, so it’s the same wherever you sign in.' +
        (agentAutoState === 'error' && agentAutoErr
          ? ' Couldn’t read it back just now, so what’s shown here may be older than what was saved.' : '') +
        '</div>' : '') +
    /**
     * ⚠ **A REFUSAL ABOUT A STEP IS SAID ON THAT STEP, and this line then says WHERE rather
     * than repeating WHAT.** Two accounts of one fact is what this form is not allowed to draw —
     * but "which step" and "what is wrong with it" are two different things a person needs, and
     * without the pointer a save of a twenty-step workflow changes nothing they can see.
     *
     * Everything this cannot attribute stays here whole, which is every refusal about the name,
     * the schedule, the days, the date or the event.
     */
    ((() => {
      // ⚠ **THROUGH THE ONE READER, so a check's refusal is said in the same place a save's is.**
      // Reading `agentAutoActErr` here was what made a refusal answered by a Check a remembered
      // string with no configuration on it — see `agentAutoErrShown`.
      // AND THE SLOT IS DRAWN EVEN WHEN IT IS EMPTY, exactly as it was. `.ag-err` carries
      // `min-height: 1.2em`, so the space is RESERVED on purpose: returning nothing here would
      // take ~1.2em + .6rem out of the panel and make the actions row jump the moment a refusal
      // appears — a design decision nobody made, in a change about when a sentence is true.
      const said = agentAutoErrShown();
      const fault = agentAutoFault(said);
      if (!fault) return '<div class="ag-err">' + esc(said) + '</div>';
      // AND ONLY WHEN THE STEP IS REALLY DRAWN. A position past the end of the list — a stored
      // workflow longer than the one on screen, or a step removed since the save — would mark
      // nothing, so the sentence stays here whole rather than disappearing.
      if (fault.at >= f.steps.length) return '<div class="ag-err">' + esc(said) + '</div>';
      return '<div class="ag-err">Step ' + (fault.at + 1) + ' needs a change — it’s marked above.</div>';
    })()) +
  '</div>';
}

/**
 * One thing an automation asks for.
 *
 * **THE NAME IS THE CONTRACT AND THE LABEL IS THE WORDS.** A step refers to the NAME, so
 * it follows the identifier rule; the label is what goes beside the box when somebody
 * fills it in, and it falls back to the name rather than being compelled — a name is
 * already readable and demanding a second string for every input is a form nobody finishes.
 */
function automationInputHtml(d, i, total) {
  return '<div class="ag-auto-in" data-input-row="' + i + '">' +
    '<div class="ag-step-head">' +
      '<span class="ag-step-n">' + esc(String.fromCharCode(97 + Math.min(i, 25))) + '</span>' +
      '<span class="ag-step-w">Asks for</span>' +
      '<span class="ag-step-move">' +
        '<button class="ag-auto-btn" data-act="agent-auto-input-up" data-at="' + i + '"' +
          (i === 0 ? ' disabled' : '') + ' aria-label="Move up" title="Move up">↑</button>' +
        '<button class="ag-auto-btn" data-act="agent-auto-input-down" data-at="' + i + '"' +
          (i === total - 1 ? ' disabled' : '') + ' aria-label="Move down" title="Move down">↓</button>' +
        '<button class="ag-auto-btn" data-act="agent-auto-input-del" data-at="' + i + '" aria-label="Remove" title="Remove">✕</button>' +
      '</span>' +
    '</div>' +
    '<div class="ag-step-lbl">Its name, for {{a step}} to use</div>' +
    '<input class="ag-in ag-step-in" data-in="name" maxlength="40" placeholder="topic" value="' + esc(d.name || '') + '">' +
    '<div class="ag-step-lbl">What to call it on the form</div>' +
    '<input class="ag-in ag-step-in" data-in="label" maxlength="120" placeholder="Topic" value="' + esc(d.label || '') + '">' +
    '<div class="ag-step-lbl">If it is left blank</div>' +
    '<input class="ag-in ag-step-in" data-in="default" maxlength="2000" placeholder="(nothing)" value="' + esc(d.default || '') + '">' +
    '<label class="ag-check">' +
      '<input type="checkbox" data-in="required"' + (d.required ? ' checked' : '') + '>' +
      '<span class="ag-tool-m"><span class="ag-check-t">It has to be filled in</span></span>' +
    '</label>' +
  '</div>';
}

/**
 * The words that go beside a field's box.
 *
 * **DISPLAY ONLY, AND THE SITE'S OWN**, deliberately not a third censused string per
 * field: the catalog already carries the words for a STEP, which is what somebody reads
 * when choosing one, and a field's own name is already readable ("query", "hours",
 * "ask"). A name with no entry falls back to itself, so a field added to the catalog
 * draws sensibly before anybody writes a phrase for it.
 */
const AUTO_FIELD_WORDS = {
  days: 'On these days', text: 'The note', out: 'Save the answer as',
  left: 'Compare', op: 'which', right: 'with', mode: 'Wait',
  minutes: 'For this many minutes', at: 'Until this time',
  ask: 'What is being approved', hours: 'Wait this many hours for an answer',
  on_timeout: 'If nobody answers', query: 'Search for', key: 'The saved fact called',
};
const AUTO_FIELD_HINTS = {
  out: 'Optional. A later step can then put {{that name}} in its own text.',
  left: 'Usually {{a name}} — an input, or an earlier step’s answer.',
};
/** What each choice reads as. A value with no phrase reads as itself. */
const AUTO_CHOICE_WORDS = {
  is: 'is', 'is not': 'is not', contains: 'contains',
  'is empty': 'is empty', 'is not empty': 'is not empty',
  for: 'for a while', until: 'until a time of day',
  approve: 'carry on anyway', reject: 'stop, as though it were rejected', fail: 'stop as a failure',
  each: 'each thing in a list', times: 'a fixed number of times',
  stop: 'stop the whole automation', continue: 'carry on with the next step', retry: 'try it again',
};
const autoWords = (n) => AUTO_FIELD_WORDS[n] || n;

/**
 * How deep in a branch a step sits, one entry per step.
 *
 * **THE EDITOR STAYS AN ORDERED LIST AND THE INDENT IS ONLY INK.** `if`/`otherwise`/`end`
 * are steps like any other — they move and delete with the same buttons — so nothing here
 * nests; this walks the types once and says how far in to draw each row. A list that does
 * not balance still draws, at whatever depth it reaches, because the form is where somebody
 * is in the middle of building one.
 */
function autoDepths(steps) {
  const out = [];
  let d = 0;
  for (const st of steps || []) {
    const t = st && st.type;
    if (t === 'end') d = Math.max(0, d - 1);
    // AN `otherwise` SITS AT ITS `if`'s OWN DEPTH, and the steps under it one further in —
    // which is what makes the two arms read as two arms rather than as one long list.
    out.push(t === 'otherwise' ? Math.max(0, d - 1) : d);
    if (t === 'if') d += 1;
  }
  return out;
}

/** One step in the form, with its own fields and its place in the order. */
function automationStepHtml(st, i, total, cat, days, depth) {
  const def = cat.find((d) => d.type === st.type) || null;
  const fields = (def && def.fields) || [];
  // ⚠ **THE REFUSAL THIS STEP EARNED, DRAWN ON IT.** `ag-err` is the class the form already
  // uses for a refusal, deliberately: a new one would be a design decision nobody made, and this
  // is the same kind of thing said in the same voice somewhere more useful.
  // THE SAME READER THE BOTTOM LINE USES, or a refusal held on the check's answer would be said
  // there and mark nothing here — the marking working through one holder and not the other.
  const fault = agentAutoFault(agentAutoErrShown());
  const said = fault && fault.at === i ? '<div class="ag-err">' + esc(fault.said) + '</div>' : '';
  return '<div class="ag-step" data-step-type="' + esc(st.type) + '"' +
      ' style="--ag-step-d:' + (Number.isFinite(depth) ? depth : 0) + '">' +
    said +
    '<div class="ag-step-head">' +
      '<span class="ag-step-n">' + (i + 1) + '</span>' +
      '<span class="ag-step-w">' + esc((def && def.label) || st.type) + '</span>' +
      '<span class="ag-step-k">' + esc((def && def.kind) || '') + '</span>' +
      '<span class="ag-step-move">' +
        '<button class="ag-auto-btn" data-act="agent-auto-step-up" data-at="' + i + '"' +
          (i === 0 ? ' disabled' : '') + ' aria-label="Move up" title="Move up">↑</button>' +
        '<button class="ag-auto-btn" data-act="agent-auto-step-down" data-at="' + i + '"' +
          (i === total - 1 ? ' disabled' : '') + ' aria-label="Move down" title="Move down">↓</button>' +
        '<button class="ag-auto-btn" data-act="agent-auto-step-del" data-at="' + i + '" aria-label="Remove" title="Remove">✕</button>' +
      '</span>' +
    '</div>' +
    (def && def.configless
      // A MARKER HAS NOTHING TO CONFIGURE AND SAYS SO, rather than drawing an empty body
      // that reads as a control somebody has not filled in yet.
      ? '<div class="ag-step-said">' + esc(def.does) + '</div>'
      : fields.map((fd) => {
        // ⚠ A FIELD THAT DOES NOT APPLY IS NOT DRAWN AT ALL, decided from the answers on
        // the same step. Drawing it would be a control whose value nothing reads — and
        // `cleanWorkflow` would drop it on the way through, so the screen would be showing
        // something the save had already thrown away.
        if (!autoFieldApplies(fd, st, fields)) return '';
        const lbl = '<div class="ag-step-lbl">' + esc(autoWords(fd.name)) + '</div>';
        const hint = AUTO_FIELD_HINTS[fd.name]
          ? '<div class="ag-hint ag-step-hint">' + esc(AUTO_FIELD_HINTS[fd.name]) + '</div>' : '';
        if (fd.kind === 'days') {
          const picked = Array.isArray(st.days) ? st.days : [];
          return lbl + '<div class="ag-step-days">' + days.map((d) =>
            '<label class="ag-day">' +
              '<input type="checkbox" data-day="' + esc(d) + '"' + (picked.includes(d) ? ' checked' : '') + '>' +
              '<span>' + esc(autoDayName(d)) + '</span>' +
            '</label>').join('') + '</div>';
        }
        if (fd.kind === 'choice') {
          const picked = st[fd.name];
          const must = fd.required === true;
          // ⚠ A REQUIRED CHOICE HAS NO BLANK OPTION AND NO SILENT DEFAULT: one with nothing
          // selected would save whichever value happened to be first, so the first option is
          // selected when the step has no answer yet and the control says what it will do.
          //
          // ⚠ AN OPTIONAL ONE OFFERS A BLANK, and that is the opposite rule for the opposite
          // reason: there the server owns what absent means, so a control with no way to say
          // "leave it alone" would make every step carry a default nobody chose. The blank
          // NAMES the default rather than being empty, so the row still says what will happen.
          const dflt = (fd.options || [])[0];
          const blank = must ? '' :
            '<option value=""' + (picked === undefined || picked === null || picked === '' ? ' selected' : '') + '>' +
            esc(dflt ? (AUTO_CHOICE_WORDS[dflt] || dflt) + ' — the default' : 'the default') + '</option>';
          return lbl + '<select class="ag-in ag-step-in" data-field="' + esc(fd.name) + '" data-kind="choice" data-change="agent-auto-step-field">' +
            blank +
            (fd.options || []).map((o, n) =>
              '<option value="' + esc(o) + '"' + (picked === o || (must && picked === undefined && n === 0) ? ' selected' : '') + '>' +
              esc(AUTO_CHOICE_WORDS[o] || o) + '</option>').join('') + '</select>' + hint;
        }
        if (fd.kind === 'number') {
          return lbl + '<input class="ag-in ag-step-in ag-in-num" type="number" data-kind="number" data-field="' + esc(fd.name) + '"' +
            (fd.min !== undefined ? ' min="' + fd.min + '"' : '') +
            (fd.max !== undefined ? ' max="' + fd.max + '"' : '') +
            ' value="' + esc(st[fd.name] === undefined || st[fd.name] === null ? '' : String(st[fd.name])) + '">' + hint;
        }
        if (fd.kind === 'time') {
          /**
           * ⚠ **ABSENT SEEDS `09:00`; CLEARED STAYS CLEARED — the number field's own shape, and
           * it has to be, because `draft → markup → read` must be a FIXED POINT.**
           *
           * The reader keeps `''` for a cleared box (`st[name] = f.value`, with no default), so
           * `|| '09:00'` here made the two disagree about one value — and the draft is rebuilt
           * from this markup at every render, so the disagreement reached both of the answers
           * this form derives. MEASURED on the platform's one such field, the `wait` step's time
           * when it waits UNTIL one: clear the box and press Check, and `asked` held `''` while
           * the redrawn form read back `'09:00'`, so `agentAutoCheckShown()` was false and the
           * panel was NEVER DRAWN — the customer waits and gets nothing, which is the exact
           * failure this round was written to remove. After a save it was worse and permanent:
           * the baseline held `''` against a draft re-read as `'09:00'`, so `steps` read as
           * changed for ever, "Saved." could never be drawn, and the next press re-sent the whole
           * step list — the lost update the patch-only edit exists to prevent.
           */
          return lbl + '<input class="ag-in ag-in-time ag-step-in" type="time" data-kind="time" data-field="' + esc(fd.name) + '"' +
            ' value="' + esc(st[fd.name] === undefined || st[fd.name] === null ? '09:00' : String(st[fd.name])) + '">' + hint;
        }
        if (fd.kind === 'name') {
          return lbl + '<input class="ag-in ag-step-in" data-field="' + esc(fd.name) + '" maxlength="40"' +
            ' placeholder="a_name" value="' + esc(st[fd.name] || '') + '">' + hint;
        }
        return lbl + '<input class="ag-in ag-step-in" data-field="' + esc(fd.name) + '"' +
          (fd.max ? ' maxlength="' + fd.max + '"' : '') +
          ' placeholder="' + esc(autoWords(fd.name)) + '" value="' + esc(st[fd.name] || '') + '">' + hint;
      }).join('')) +
  '</div>';
}

/**
 * Does this field apply, given what is answered on its own step?
 *
 * **ONE READING, SHARED WITH THE SERVER'S `fieldApplies` BY CONSTRUCTION**: both ask the
 * catalog's own `when`, which is censused against the engine's. A browser deciding this
 * differently would draw a control the save then dropped, which is the shape of a dead
 * control that ANSWERS.
 */
function autoFieldApplies(fd, st, fields) {
  if (!fd || !fd.when) return true;
  for (const on of Object.keys(fd.when)) {
    const allowed = fd.when[on] || [];
    // ⚠ THE FIRST OPTION IS WHAT AN UNANSWERED CHOICE WILL BE, because that is what the
    // control draws as selected — so a step just added shows the conditional fields it is
    // about to save rather than none of them. Without this a fresh `wait` would draw no
    // minutes box at all and the first Save would refuse it for a field nobody could see.
    let got = st ? st[on] : undefined;
    if (got === undefined) {
      const sib = (fields || []).find((o) => o && o.name === on);
      got = sib && Array.isArray(sib.options) ? sib.options[0] : undefined;
    }
    if (!allowed.includes(got)) return false;
  }
  return true;
}

/**
 * ⚠ REFERENCE MATERIAL AND MEMORY — one screen, two panels.
 *
 * **THE TWO ARE SIDE BY SIDE BECAUSE THEY ARE THE TWO KINDS OF THING AN AGENT KNOWS, and
 * apart because they are managed differently**: material is a document with a name and a
 * version that gets replaced, and a memory is a small named fact that gets corrected.
 * Collapsing them would make one of the two impossible to manage on its own.
 */
function agentKnowsHtml() {
  const agent = (agentRows || []).find((a) => a.id === agentKnow) || null;
  const head =
    '<div class="ag-head ag-thread-head">' +
      '<button class="ag-back" data-act="agent-know-back" aria-label="Back to the conversation" title="Back">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>' +
      '</button>' +
      '<div class="ag-thread-name">What it knows' + (agent ? ' · ' + esc(agent.name) : '') + '</div>' +
    '</div>';

  // ONE SOURCE OPEN IS A SCREEN OF ITS OWN, over the list, so nothing redraws behind a
  // document somebody is pasting into.
  if (agentKnowEditing !== null) {
    return '<div class="ag-page ag-thread-page">' + head + agentKnowFormHtml() + '</div>';
  }

  return '<div class="ag-page ag-thread-page">' + head +
    '<div class="ag-autos">' +
      // ── reference material ────────────────────────────────────────────────
      '<div class="ag-lbl">Reference material</div>' +
      '<div class="ag-hint">What this agent can look things up in. A workflow’s "Look something up" step searches it and quotes the passages that match, with the source they came from. It is never permission to do anything — only something to read.</div>' +
      (agentKnowErr ? '<div class="ag-err">' + esc(agentKnowErr) + '</div>' : '') +
      (agentKnowActErr ? '<div class="ag-err">' + esc(agentKnowActErr) + '</div>' : '') +
      (agentKnowRows === null
        ? '<div class="ag-auto-none">Loading…</div>'
        : !agentKnowRows.length
          ? '<div class="ag-auto-none">Nothing yet. Add a source and a workflow can search it.</div>'
          : agentKnowRows.map((k) =>
              '<div class="ag-auto">' +
                '<div class="ag-auto-top">' +
                  '<div class="ag-auto-m">' +
                    '<div class="ag-auto-n">' + esc(k.title) +
                      // THE VERSION IS WHAT A RUN QUOTES BACK, so it is on the row rather
                      // than hidden behind an open.
                      (k.version ? '<span class="ag-chip">v' + esc(String(k.version)) + '</span>' : '') +
                      (k.format === 'markdown' ? '<span class="ag-chip">Markdown</span>' : '') +
                    '</div>' +
                    '<div class="ag-auto-s">' + (k.updatedAt ? 'changed ' + esc(autoWhen(k.updatedAt)) : '') + '</div>' +
                  '</div>' +
                  '<div class="ag-auto-acts">' +
                    '<button class="ag-auto-btn" data-act="agent-know-edit" data-id="' + esc(k.id) + '">Open</button>' +
                    '<button class="ag-auto-btn" data-act="agent-know-delete" data-id="' + esc(k.id) + '"' +
                      (agentKnowBusy ? ' disabled' : '') + '>Delete</button>' +
                  '</div>' +
                '</div>' +
              '</div>').join('')) +
      '<div class="ag-step-add">' +
        '<button class="ag-auto-btn" data-act="agent-know-new"' +
          (((agentKnowRows || []).length >= ((agentKnowCat && agentKnowCat.max) || 20)) ? ' disabled' : '') +
          '>+ A source</button>' +
      '</div>' +

      // ── memory ────────────────────────────────────────────────────────────
      '<div class="ag-lbl">What it remembers</div>' +
      '<div class="ag-hint">Facts and preferences that stay between conversations. A workflow’s "Use something remembered" step reads one by name. You can correct or delete any of them, and a change reaches the next run — never one already going.</div>' +
      (agentMemErr ? '<div class="ag-err">' + esc(agentMemErr) + '</div>' : '') +
      (agentMemActErr ? '<div class="ag-err">' + esc(agentMemActErr) + '</div>' : '') +
      // ⚠ WHAT THE LAST FORGET REACHED, in the words the database answered. `ag-hint` already
      // has a rule; a class of its own would be a design decision nobody made.
      (agentMemSaid ? '<div class="ag-hint">' + esc(agentMemSaid) + '</div>' : '') +
      (agentMemRows === null
        ? '<div class="ag-auto-none">Loading…</div>'
        : !agentMemRows.length
          ? '<div class="ag-auto-none">Nothing remembered yet.</div>'
          : agentMemRows.map((m) =>
              '<div class="ag-auto">' +
                '<div class="ag-auto-top">' +
                  '<div class="ag-auto-m">' +
                    '<div class="ag-auto-n">' + esc(m.key) +
                      (m.version && m.version > 1
                        // HOW OFTEN IT HAS BEEN CORRECTED, which is what a version of a
                        // memory means — and a run records which one it used.
                        ? '<span class="ag-chip">corrected ' + esc(String(m.version - 1)) + '×</span>' : '') +
                    '</div>' +
                    '<div class="ag-auto-s">' + esc(m.value) + '</div>' +
                    '<div class="ag-auto-steps"><span class="ag-auto-step">' +
                      esc(m.source === 'run' ? 'saved by a run' : 'you saved this') +
                      (m.updatedAt ? ' · ' + esc(autoWhen(m.updatedAt)) : '') +
                    '</span></div>' +
                  '</div>' +
                  '<div class="ag-auto-acts">' +
                    '<button class="ag-auto-btn" data-act="agent-mem-edit" data-key="' + esc(m.key) + '"' +
                      ' data-value="' + esc(m.value) + '">Correct</button>' +
                    '<button class="ag-auto-btn" data-act="agent-mem-delete" data-key="' + esc(m.key) + '"' +
                      (agentMemBusy ? ' disabled' : '') + '>Forget</button>' +
                  '</div>' +
                '</div>' +
              '</div>').join('')) +
      '<div class="ag-form">' +
        '<div class="ag-step-lbl">Its name, for {{a step}} to use</div>' +
        '<input class="ag-in" id="agMemName" maxlength="40" placeholder="tone"' +
          ' value="' + esc((agentMemDraft && agentMemDraft.name) || '') + '">' +
        '<div class="ag-step-lbl">What to remember</div>' +
        '<input class="ag-in" id="agMemValue" maxlength="' + ((agentMemCat && agentMemCat.valueMax) || 4000) + '"' +
          ' placeholder="formal" value="' + esc((agentMemDraft && agentMemDraft.value) || '') + '">' +
        '<div class="ag-actions">' +
          '<button class="ag-save" data-act="agent-mem-save"' + (agentMemBusy ? ' disabled' : '') + '>' +
            (agentMemBusy ? 'Saving…' : 'Remember it') + '</button>' +
        '</div>' +
        // SAID OUT LOUD: saving over a name is how a memory is corrected, and the version
        // counting up is the record of it.
        '<div class="ag-hint">Saving over a name you already have corrects it.</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/** One source, open: its name, what kind of text it is, and the material itself. */
function agentKnowFormHtml() {
  const d = agentKnowDraft || { title: '', body: '', format: 'text' };
  const formats = (agentKnowCat && agentKnowCat.formats) || ['text'];
  const bodyMax = (agentKnowCat && agentKnowCat.bodyMax) || 200000;
  return '<div class="ag-form">' +
    '<label class="ag-lbl" for="agKnowTitle">What it is called</label>' +
    '<div class="ag-hint">This is the name an answer quotes it under, so it should say what the material is.</div>' +
    '<input class="ag-in" id="agKnowTitle" maxlength="200" placeholder="Price list" value="' + esc(d.title) + '">' +
    '<label class="ag-lbl" for="agKnowFormat">What kind of text</label>' +
    '<select class="ag-in" id="agKnowFormat">' +
      formats.map((f) => '<option value="' + esc(f) + '"' + (d.format === f ? ' selected' : '') + '>' +
        esc(f === 'markdown' ? 'Markdown' : 'Plain text') + '</option>').join('') + '</select>' +
    '<label class="ag-lbl" for="agKnowBody">The material</label>' +
    // ⚠ `null` IS "NOT LOADED YET" AND IS NOT AN EMPTY DOCUMENT. An empty box for a source
    // that really has text in it reads as a document somebody has lost — and saving over it
    // would then lose it for real.
    (d.body === null
      ? '<div class="ag-auto-none">Loading the text…</div>'
      : '<textarea class="ag-in ag-ta" id="agKnowBody" rows="12" maxlength="' + bodyMax + '"' +
        ' placeholder="Paste or type what this agent should be able to look up.">' + esc(d.body) + '</textarea>') +
    '<div class="ag-actions">' +
      '<button class="ag-save" data-act="agent-know-save"' + (agentKnowBusy || d.body === null ? ' disabled' : '') + '>' +
        (agentKnowBusy ? 'Saving…' : 'Save') + '</button>' +
      '<button class="ag-cancel" data-act="agent-know-cancel">Back</button>' +
      (agentKnowEditing
        ? '<button class="ag-del" data-act="agent-know-delete" data-id="' + esc(agentKnowEditing) + '">Delete</button>'
        : '') +
    '</div>' +
    '<div class="ag-err">' + esc(agentKnowActErr) + '</div>' +
  '</div>';
}

/** The agent the open thread belongs to, out of the list the server sent. */
const agentOpenRow = () => (agentRows || []).find((a) => a.id === agentThread) || null;

/**
 * DRAW IT — keeping whatever is in the message box across the redraw.
 *
 * The wrapper is what makes the poll safe: `renderAgentsNow` replaces `innerHTML`,
 * so the textarea it drew a moment ago is gone. Reading it first and putting the
 * cursor back after is the difference between a conversation you can type into
 * while it answers and one that eats a sentence every 2.5 seconds.
 *
 * ONE DOOR, so no caller has to remember: every `renderAgents()` in this file goes
 * through it, and the inner function is never called from anywhere else.
 */
function renderAgents() {
  const held = agentComposerRead();
  // ⚠ AND WHERE THE CURSOR IS, for every OTHER control on this screen — the same two points,
  // because the reason is the same: `renderAgentsNow` replaces the element it had. Read after
  // the composer's own read, so `#agMsg` is already accounted for and this one skips it.
  const spot = agentFocusRead();
  // ⚠ THE AUTOMATION FORM GOES THROUGH THE SAME DOOR, for the same reason: a redraw
  // replaces every input it drew, so anything typed since the last state change would be
  // gone. Reading it into the draft first is what makes "add a step" keep the note you
  // were half way through writing in the step above it.
  agentAutoFormRead();
  // ⚠ **AND SO DOES EVERY OTHER FORM ON THIS SCREEN, for exactly that reason.** The
  // execution history refreshes itself every 1.5 seconds while something is running, so an
  // approval note being typed beside a waiting run would be wiped between keystrokes; the
  // reference-material form holds a whole document, which is the most expensive thing on
  // this screen to lose. Four readers and ONE door, so no caller has to remember.
  agentAutoAskRead();
  agentAutoNotesRead();
  agentKnowFormRead();
  agentMemFormRead();
  renderAgentsNow();
  agentComposerRestore(held);
  agentFocusRestore(spot);
  // ⚠ AND THE AUTOMATION FORM'S BASELINE IS TAKEN AFTER THE DRAW, not before it: what a save
  // compares against is what the person was SHOWN, and the only moment that is readable is the
  // one right after the form is written. See `agentAutoWas`.
  agentAutoWasRead();
}

/**
 * Remember what the automation form was drawn with, once per drawing.
 *
 * **THE SAME READER THE SAVE USES**, so the two sides of the comparison cannot differ in shape —
 * which is what makes "nothing changed" mean nothing rather than mean "the two readers build
 * their objects differently".
 *
 * It captures only when nothing is held: a form being typed into is a drawing of the DRAFT, and
 * recapturing there would move the baseline to whatever has just been typed.
 */
function agentAutoWasRead() {
  if (agentAuto === null || agentAutoEditing === null) return;
  if (agentAutoWas !== null) return;                    // this drawing is already accounted for
  const form = document.getElementById('agAutoForm');
  if (!form) return;                                    // the form is not drawn
  agentAutoWas = { ...agentAutoValues(), of: agentAutoEditing };
}

/**
 * Keep every approval note that is being typed.
 *
 * **KEYED BY RUN, off the box's own attribute** — the history can show more than one
 * waiting execution at once, and one string for the screen would put A's words under B.
 * An empty box DELETES its entry rather than storing `''`, so "nothing typed" and "typed
 * and cleared" are one state and the map stays the size of what is really being written.
 */
function agentAutoNotesRead() {
  const boxes = typeof document.querySelectorAll === 'function'
    ? [...document.querySelectorAll('[data-note]')] : [];
  for (const el of boxes) {
    const id = (el.getAttribute && el.getAttribute('data-note')) || '';
    if (!id) continue;
    const v = String(el.value || '');
    if (v) agentAutoNotes.set(id, v); else agentAutoNotes.delete(id);
  }
}
function renderAgentsNow() {
  const view = document.getElementById('viewAgents');
  if (!view) return;

  // AUTOMATIONS FIRST, because it is a screen of its own rather than a panel inside
  // one: while it is open, neither the conversation nor the settings form is.
  // ⚠ CONNECTED ACCOUNTS ARE A SCREEN OF THEIR OWN, and they come FIRST so the two cannot
  // both be open: `agentConnections` and `agentAutomations` each clear the other's id, and
  // this order is what makes that a property rather than something to remember.
  if (agentConn !== null) { view.innerHTML = connectionsHtml(); wireActions(view); return; }
  // ⚠ WHERE THINGS ARRIVE IS A SCREEN OF ITS OWN TOO, read here for the same reason: each
  // of these openers clears the others' id, and this order is what makes "no two are open" a
  // property rather than something to remember.
  if (agentWh !== null) { view.innerHTML = webhooksHtml(); wireActions(view); return; }
  if (agentAuto !== null) { view.innerHTML = automationsHtml(); wireActions(view); return; }
  // REFERENCE MATERIAL AND MEMORY, also a screen of its own and for the same reason: it
  // holds a whole document in a box, and nothing may redraw behind somebody typing one.
  if (agentKnow !== null) { view.innerHTML = agentKnowsHtml(); wireActions(view); return; }

  // The thread. One agent, its messages, and a box to add another.
  if (agentThread !== null && agentEditing === null) {
    const a = agentOpenRow();
    // An agent that is gone — deleted on another machine — is not an empty
    // thread: that would be a screen pretending the conversation still exists.
    if (!a) { agentThread = null; renderAgents(); return; }
    const msgs = Array.isArray(agentMsgs) ? agentMsgs : [];
    // WHETHER THIS AGENT IS RESTING, off the row the server sent. The screen never
    // decides it — `agentRow` fails closed on a status it cannot read, so a row from
    // an older Worker draws the banner rather than a Send button that will refuse.
    const rest = a.status === 'paused';
    const body = agentMsgsErr
      ? '<div class="ag-thread-empty">' +
          '<div class="ag-empty-t">Couldn’t load this conversation</div>' +
          '<div class="ag-empty-s">' + esc(agentMsgsErr) + '</div>' +
          '<button class="ag-retry" data-act="agent-thread-retry" data-id="' + esc(a.id) + '">Try again</button>' +
        '</div>'
      : agentMsgs === null
        ? '<div class="ag-thread-empty"><div class="ag-empty-s">Loading…</div></div>'
        : msgs.length
          ? msgs.map((m) =>
              '<div class="ag-msg ag-msg-you">' +
                '<div class="ag-bubble">' + esc(m.text) + '</div>' +
                '<div class="ag-msg-when">' + esc(agentWhen(m.at)) + '</div>' +
              '</div>' +
              // WHAT THAT MESSAGE STARTED, IF ANYTHING. `agentRunHtml` answers '' for
              // a message with no run, which is every imported conversation and every
              // message sent before this existed.
              agentRunHtml(m.run)).join('')
          : '<div class="ag-thread-empty">' +
              '<div class="ag-empty-t">' + esc(a.name) + '</div>' +
              '<div class="ag-empty-s">' + esc(a.instructions) + '</div>' +
            '</div>';
    view.innerHTML =
      '<div class="ag-page ag-thread-page">' +
        '<div class="ag-head ag-thread-head">' +
          '<button class="ag-back" data-act="agent-list" aria-label="Back to agents" title="Back">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>' +
          '</button>' +
          '<span class="ag-av ag-av-sm">' + esc(agentInitial(a.name)) + '</span>' +
          '<div class="ag-thread-name">' + esc(a.name) + '</div>' +
          '<button class="ag-edit" data-act="agent-automations" data-id="' + esc(a.id) + '" aria-label="Automations" title="Automations">' +
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="12" cy="12" r="8"></circle><path d="M12 8v4l2.5 1.5"></path>' +
            '</svg>' +
          '</button>' +
          // ⚠ AND CONNECTED ACCOUNTS ARE A FOURTH DOOR, because they are a fourth thing an
          // agent is: what it can reach OUTSIDE. It sits next to the automations because that
          // is what uses one — a send step names a connection by its id, and this is where the
          // id is.
          '<button class="ag-edit" data-act="agent-connections" data-id="' + esc(a.id) + '" aria-label="Connected accounts" title="Connected accounts">' +
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M9 15l6-6"></path><path d="M11 6.5l1.8-1.8a3.5 3.5 0 0 1 5 5L16 11.5"></path><path d="M13 17.5l-1.8 1.8a3.5 3.5 0 0 1-5-5L8 12.5"></path>' +
            '</svg>' +
          '</button>' +
          // ⚠ AND WHERE THINGS ARRIVE IS A FIFTH, because it is the other direction: the
          // accounts are what the agent can reach OUT to, and these are the addresses things
          // reach IN at. It sits beside them because the pair is one idea — and because an
          // automation's event box and an address's event name have to be the same word, so
          // somebody setting one up needs the other within a press.
          '<button class="ag-edit" data-act="agent-webhooks" data-id="' + esc(a.id) + '" aria-label="Where things arrive" title="Where things arrive">' +
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M12 3v11"></path><path d="M8 10.5l4 4 4-4"></path><path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13A1.5 1.5 0 0 0 20 19.5V17"></path>' +
            '</svg>' +
          '</button>' +
          // ITS OWN DOOR, beside the automations and the instructions, because the three
          // are the three things an agent is: what it is told, what it knows, and what it
          // does on its own.
          '<button class="ag-edit" data-act="agent-knows" data-id="' + esc(a.id) + '" aria-label="What it knows" title="What it knows">' +
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"></path><path d="M8 7h7M8 11h7"></path>' +
            '</svg>' +
          '</button>' +
          '<button class="ag-edit" data-act="agent-edit" data-id="' + esc(a.id) + '" aria-label="Edit this agent" title="Instructions">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="ag-thread" id="agThread">' + body + '</div>' +
        // ⚠ ABOVE THE BOX, because it is the reason nothing is happening. A person who
        // cannot see why their agent has stopped has no way to start it again — and this
        // is the one control on this screen whose absence is silent.
        (agentApprovalsFor === a.id && (agentApprovals || []).length
          ? '<div class="ag-aps">' + (agentApprovals || []).map(agentApprovalHtml).join('') + '</div>'
          : '') +
        (agentApprovalsErr ? '<div class="ag-err ag-aps-err">' + esc(agentApprovalsErr) + '</div>' : '') +
        // THE TYPED TEXT SURVIVES A FAILED SEND, and it is THIS conversation's.
        // `agentMsgDrafts` is keyed by agent and written back into the box,
        // because this panel is rebuilt from innerHTML: a draft living only in
        // the DOM would be wiped by the re-render that shows the error, and a
        // draft living in one global would be wiped by another conversation.
        '<div class="ag-send">' +
          '<textarea class="ag-send-in" id="agMsg" rows="1" maxlength="' + AGENT_MAX + '" ' +
            'data-agent="' + esc(a.id) + '" data-input="agent-msg" ' +
            'data-keydown="agent-send-key" placeholder="Message ' + esc(a.name) + '">' + esc(agentDraftOf(a.id)) + '</textarea>' +
          '<button class="ag-send-btn" data-act="agent-send" aria-label="Send" ' +
            'title="' + (rest ? 'This agent is paused' : 'Send') + '"' + ((agentBusy || rest) ? ' disabled' : '') + '>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>' +
          '</button>' +
        '</div>' +
        // ⚠ A PAUSE IS SAID BESIDE THE BOX — under it, where the failed-send line and
        // the note about simulated answers already live, so every sentence about
        // sending is in one place. What tells somebody BEFORE they type is the dead
        // Send button; this says what a pause is NOT. The BOX STAYS ENABLED on purpose — whatever is half-written
        // is still theirs, and disabling a textarea is how a draft gets lost — while
        // the button is off, because the server will refuse the send and discovering
        // that after typing is worse than being told before.
        //
        // **THE SERVER IS STILL THE ENFORCEMENT.** This is a courtesy: a screen that
        // has not reloaded since somebody paused the agent elsewhere will still offer
        // Send, and `agentSend` handles that refusal by keeping the words and the key.
        (rest
          ? '<div class="ag-paused">' +
              '<div class="ag-paused-t">Paused, so it isn’t starting anything new. Everything you’ve said to it is still here, and anything already running will finish.</div>' +
              '<button class="ag-retry" data-act="agent-edit" data-id="' + esc(a.id) + '">Open settings</button>' +
            '</div>'
          : '') +
        (agentActErr ? '<div class="ag-err ag-err-send">' + esc(agentActErr) + '</div>' : '') +
        // **SAID BEFORE YOU SEND, NOT AFTER**, and it is a different sentence now
        // that something does answer. What it must not do is let a stand-in read
        // as an AI: the reply is real work, really queued, really executed and
        // really recorded — and what produced its words is a placeholder. Saying
        // that here AND on every answer is deliberate, because this line is gone
        // the moment an answer is copied somewhere else.
        '<div class="ag-note">Saved to your account and run on the server. ' +
          'No model is connected yet, so replies are stand-in test results rather than ' +
          'answers from an AI.</div>' +
      '</div>';
    wireActions(view);
    const box = document.getElementById('agThread');
    if (box) box.scrollTop = box.scrollHeight;
    const inp = document.getElementById('agMsg');
    if (inp) { inp.focus(); inp.selectionStart = inp.value.length; }
    return;
  }

  // The composer, when it is open, replaces the list rather than floating over
  // it: this view is one column and a modal here would cover the only thing
  // that gives it context.
  if (agentEditing !== null) {
    const cur = agentEditing ? ((agentRows || []).find((a) => a.id === agentEditing) || null) : null;
    // The draft wins over the stored values, and only for the agent it was
    // typed against — so a failed save is followed by the words that failed,
    // and opening a DIFFERENT agent never shows them.
    const draft = (agentDraft && agentDraftFor === agentEditing) ? agentDraft : null;
    const nameVal = draft ? draft.name : (cur ? cur.name : '');
    const instrVal = draft ? draft.instructions : (cur ? cur.instructions : '');
    // ⚠ THE SETTINGS COME OFF THE DRAFT FIRST TOO, and that matters more here than
    // for the text: a failed save that redrew an unticked box as ticked would tell
    // somebody a permission was stored when it was refused. A NEW agent has no
    // stored row, so its defaults are the honest ones — active, and nothing allowed.
    const paused = draft ? draft.status === 'paused' : !!(cur && cur.status === 'paused');
    const picked = draft ? draft.tools : ((cur && Array.isArray(cur.tools)) ? cur.tools : []);
    // ⚠ EMPTY IS THE HONEST DEFAULT AND IS NOT `UTC`. The agent's authoring tools refuse a
    // scheduled automation while this is blank and say so; a box pre-filled with a zone
    // nobody chose would make every such schedule fire at an hour nobody asked for.
    const zoneVal = draft ? (draft.zone || '') : ((cur && typeof cur.zone === 'string') ? cur.zone : '');
    const catalog = Array.isArray(agentTools) ? agentTools : [];
    // WHAT IS WITHHELD FROM *THIS* AGENT. `agentRevokedFor` is asked as well as the list
    // itself, so a read that answered for the agent opened before this one cannot mark a
    // tick here — the same rule the approvals banner follows about its own list.
    const revoked = (agentRevoked && agentRevokedFor === agentEditing) ? agentRevoked : [];
    view.innerHTML =
      '<div class="ag-page">' +
        '<div class="ag-head">' +
          '<button class="ag-back" data-act="agent-cancel" aria-label="Back to agents" title="Back">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>' +
          '</button>' +
          '<div class="ag-title">' + (cur ? 'Edit agent' : 'New agent') + '</div>' +
        '</div>' +
        '<div class="ag-form">' +
          '<label class="ag-lbl" for="agName">Name</label>' +
          '<input class="ag-in" id="agName" maxlength="' + AGENT_NAME_MAX + '" placeholder="Booking assistant" value="' + esc(nameVal) + '">' +
          '<label class="ag-lbl" for="agInstr">Instructions</label>' +
          '<div class="ag-hint">What it does, how it should answer, and anything it must never do. Its personality and tone belong in here too.</div>' +
          '<textarea class="ag-ta" id="agInstr" maxlength="' + AGENT_MAX + '" rows="10" ' +
            'placeholder="You answer questions about opening hours and take bookings. Ask for a date and a name before confirming anything. Never promise a time you have not checked.">' +
            esc(instrVal) + '</textarea>' +
          // ── the tools it may use ────────────────────────────────────────
          //
          // **A CHECKBOX KEEPS ITS OWN STATE, so nothing here needs a handler and
          // nothing re-renders while somebody makes up their mind** — which is what
          // keeps the two boxes above from losing what is typed in them. `agentSave`
          // reads the ticks out of the DOM.
          '<label class="ag-lbl">Tools it may use</label>' +
          (catalog.length
            ? '<div class="ag-hint">Only what this platform really has. Nothing is allowed unless you tick it.</div>' +
              '<div class="ag-tools">' + catalog.map((t) =>
                '<label class="ag-tool">' +
                  '<input type="checkbox" data-tool="' + esc(t.name) + '"' +
                    (picked.indexOf(t.name) >= 0 ? ' checked' : '') + '>' +
                  '<span class="ag-tool-m">' +
                    '<span class="ag-tool-n">' + esc(t.label || t.name) +
                      // ⚠ **A TICKED TOOL WHOSE PERMISSION HAS BEEN TAKEN AWAY READ
                      // "ALLOWED", AND THE SERVER REFUSES EVERY CALL OF IT.** The tick and
                      // the revocation are separate rows in separate tables — correctly, so
                      // that lifting one leaves the other as it was — and this form drew only
                      // the tick. So the one screen that says what an agent may do disagreed
                      // with the database, in the direction that reads as permission.
                      //
                      // Marked rather than unticked: unticking would say the CONFIGURATION
                      // changed, which it has not, and would be this screen making a
                      // decision nobody asked for.
                      (revoked.indexOf(t.name) >= 0
                        ? ' <span class="ag-chip ag-chip-off">taken away</span>' : '') +
                    '</span>' +
                    '<span class="ag-tool-d">' + esc(t.does || '') + '</span>' +
                  '</span>' +
                '</label>').join('') + '</div>'
            // THE HONEST EMPTY STATE. It says what is true — there is nothing to
            // allow yet — rather than drawing an empty list, which reads as a
            // rendering fault, or a promise about when there will be.
            : '<div class="ag-nothing">There are no tools to give an agent yet. When there are, they’ll be listed here and nothing will be allowed until you tick it.</div>') +
          // ── what has been taken away, which is not the ticks above ──────
          //
          // ⚠ **A SMALL SECTION AND NOT A SIXTH DOOR, and it is HERE for a reason**: the one
          // thing somebody will get wrong about a revocation is mistaking it for the tick, so
          // it sits directly under the ticks where the two can be read together and the
          // difference stated once. **Only for an agent that exists** — a create has no id to
          // revoke against, and the route would have nothing to answer.
          //
          // ⚠ **EVERY PRESS HERE ACTS AT ONCE AND NOT ON SAVE**, which is said out loud: a
          // control inside a form that does not wait for the form's own button is one
          // somebody will press expecting to be able to change their mind.
          (cur
            ? '<label class="ag-lbl">Taken away right now</label>' +
              '<div class="ag-hint">' + esc(AGENT_REV_SCOPE) + ' Each of these takes effect ' +
                'the moment you press it — Save is only for the settings above.</div>' +
              // THREE STATES, AND THE FIRST TWO ARE NOT THE SAME. `null` is "we have not
              // asked yet", `[]` is "nothing is taken away" — and a read that FAILED keeps
              // whatever it had and says so in the line below, rather than drawing an empty
              // list that reads as a clean bill of health.
              (agentRevoked === null
                ? '<div class="ag-hint">Checking what has been taken away…</div>'
                : (revoked.length
                    ? '<div class="ag-autos">' + revoked.map((name) =>
                        '<div class="ag-auto">' +
                          '<div class="ag-auto-top">' +
                            '<div class="ag-auto-m">' +
                              '<div class="ag-auto-n">' + esc(agentToolLabel(name)) + '</div>' +
                              '<div class="ag-auto-when">It cannot use this, whatever its ticks say.</div>' +
                            '</div>' +
                            '<div class="ag-auto-acts">' +
                              '<button class="ag-auto-btn" data-act="agent-revoke-back" ' +
                                'data-tool="' + esc(name) + '"' +
                                (agentRevokeBusy ? ' disabled' : '') + '>' +
                                (agentRevokeBusy === name ? 'Giving back…' : 'Give it back') +
                              '</button>' +
                            '</div>' +
                          '</div>' +
                        '</div>').join('') + '</div>'
                    : '<div class="ag-nothing">Nothing is taken away. This agent may use ' +
                      'whatever is ticked above.</div>')) +
              // THE CONTROL THAT TAKES ONE AWAY. A `select` of what is left, because the
              // catalog is the server's and a box somebody types a tool name into is a
              // refusal waiting to happen.
              (catalog.length
                ? (catalog.some((t) => revoked.indexOf(t.name) < 0)
                    ? '<div class="ag-auto-acts">' +
                        '<select class="ag-in" id="agRevPick">' +
                          catalog.filter((t) => revoked.indexOf(t.name) < 0).map((t) =>
                            '<option value="' + esc(t.name) + '">' + esc(t.label || t.name) +
                            '</option>').join('') +
                        '</select>' +
                        '<button class="ag-auto-btn" data-act="agent-revoke-take"' +
                          (agentRevokeBusy ? ' disabled' : '') + '>' +
                          // ⚠ WHICH PRESS IS IN FLIGHT, DERIVED RATHER THAN HELD. A restore's
                          // busy tool is one of `revoked` and a take's is not, so this says
                          // "Taking away…" only for its own press — and a restore in flight
                          // leaves this button disabled without claiming to be doing it.
                          (agentRevokeBusy && revoked.indexOf(agentRevokeBusy) < 0
                            ? 'Taking away…' : 'Take it away') +
                        '</button>' +
                      '</div>' +
                      // ⚠ THE REASON IS WHAT THE AGENT IS TOLD, not a note to ourselves —
                      // so the label says whose words they become. Optional: with none, the
                      // database fills in its own sentence.
                      '<input class="ag-in" id="agRevWhy" maxlength="' + AGENT_REV_WHY_MAX + '" ' +
                        'data-input="agent-revoke-why" placeholder="Why (optional)" ' +
                        'value="' + esc(agentRevokeWhy) + '">' +
                      '<div class="ag-hint">If it is waiting for permission to use that tool ' +
                        'right now, this is what it will be told.</div>'
                    : '<div class="ag-hint">Every tool this platform has is already taken away ' +
                      'from this agent.</div>')
                : '') +
              // THE SERVER'S OWN SENTENCE about what just happened — including the one
              // nobody would guess, that giving a tool back does not re-open the requests
              // the revocation took away.
              (agentRevokeSaid ? '<div class="ag-saved">' + esc(agentRevokeSaid) + '</div>' : '') +
              // BOTH, because they answer different questions: one is what your press did,
              // the other is whether we can tell you what is taken away at all.
              (agentRevokeActErr ? '<div class="ag-err">' + esc(agentRevokeActErr) + '</div>' : '') +
              (agentRevokedErr ? '<div class="ag-err">' + esc(agentRevokedErr) + '</div>' : '')
            : '') +
          // ── whether it is taking work ───────────────────────────────────
          '<label class="ag-lbl">Status</label>' +
          '<label class="ag-check">' +
            '<input type="checkbox" id="agPaused"' + (paused ? ' checked' : '') + '>' +
            '<span class="ag-tool-m">' +
              '<span class="ag-check-t">Paused</span>' +
              '<span class="ag-tool-d">It keeps every conversation it has and finishes anything already running. It just won’t start anything new until you turn this off.</span>' +
            '</span>' +
          '</label>' +
          // ── which time zone its schedules are in ────────────────────────
          //
          // ⚠ **A SETTING NO SCREEN COULD SET WOULD MAKE THE TOOL'S REFUSAL A DEAD END.**
          // An agent can be asked to set up a daily automation, and the one thing it must
          // not choose is the zone — "every day at nine" somewhere nobody lives is worse
          // than no schedule at all. So this is the door, and with it blank the tool
          // refuses and says to come here. A plain input like the two above it, because
          // the tz database has hundreds of names and a select of all of them is a worse
          // control than a box; what makes it safe is that the SERVER asks `Intl` and
          // refuses a name it does not know, by name.
          '<label class="ag-lbl" for="agZone">Time zone</label>' +
          '<div class="ag-hint">For anything it schedules — an IANA name like Europe/London or America/New_York. Leave it empty and it will ask you before setting up a schedule rather than guess.</div>' +
          '<input class="ag-in" id="agZone" maxlength="200" placeholder="Europe/London" value="' + esc(zoneVal) + '">' +
          '<div class="ag-actions">' +
            '<button class="ag-save" data-act="agent-save"' + (agentBusy ? ' disabled' : '') + '>' + (agentBusy ? 'Saving…' : 'Save') + '</button>' +
            '<button class="ag-cancel" data-act="agent-cancel">' + (cur ? 'Back' : 'Cancel') + '</button>' +
            (cur ? '<button class="ag-del" data-act="agent-delete" data-id="' + esc(cur.id) + '">Delete</button>' : '') +
          '</div>' +
          // SAVE FEEDBACK WHERE THE PERSON IS LOOKING. The form stays open, so
          // "Saved" sits under the button they just pressed rather than on a screen
          // they have been moved to.
          (agentSaved && !agentActErr ? '<div class="ag-saved">Saved. These settings are on your account, so they’re the same wherever you sign in.</div>' : '') +
          '<div class="ag-err" id="agErr">' + esc(agentActErr) + '</div>' +
        '</div>' +
      '</div>';
    wireActions(view);
    const f = document.getElementById('agName');
    if (f) f.focus();
    return;
  }

  // The list. Loading, empty and failed are three different screens.
  const rows = agentRows;
  const waiting = rows === null && agentState === 'loading';
  const failed = agentState === 'error' && rows === null;
  const pending = agentsToImport();
  // THE IMPORT IS ONLY OFFERED ONCE THERE IS AN ACCOUNT TO PUT THEM IN. `ready`
  // means the server answered a list for a token it verified; on a failed or
  // unfinished read the offer is not drawn at all, because uploading somebody's
  // written instructions into an account we cannot establish is the one mistake
  // here that cannot be taken back.
  const offerImport = agentState === 'ready' && pending.length > 0;

  view.innerHTML =
    '<div class="ag-page">' +
      '<div class="ag-head">' +
        '<button class="ag-new" data-act="agent-new" aria-label="New agent" title="New agent">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
        '</button>' +
        '<div class="ag-title">Agents</div>' +
      '</div>' +
      (offerImport
        ? '<div class="ag-import">' +
            '<div class="ag-import-t">' +
              esc(pending.length === 1 ? '1 agent saved in this browser' : pending.length + ' agents saved in this browser') +
            '</div>' +
            '<div class="ag-import-s">Written here before agents were kept on your account. Bring them over and they’ll be on every machine you sign in from. Your copy in this browser is left alone either way.</div>' +
            '<button class="ag-import-go" data-act="agent-import"' + (agentBusy ? ' disabled' : '') + '>' +
              (agentBusy ? 'Bringing them over…' : 'Bring them over') + '</button>' +
            (agentActErr ? '<div class="ag-err">' + esc(agentActErr) + '</div>' : '') +
          '</div>'
        : '') +
      (waiting
        ? '<div class="ag-empty"><div class="ag-empty-s">Loading your agents…</div></div>'
        : failed
          ? '<div class="ag-empty">' +
              '<div class="ag-empty-t">Couldn’t load your agents</div>' +
              '<div class="ag-empty-s">' + esc(agentErr) + '</div>' +
              '<button class="ag-retry" data-act="agent-reload">Try again</button>' +
            '</div>'
          : (rows || []).length
            ? '<div class="ag-list">' + (rows || []).map((a) =>
                '<button class="ag-row" data-act="agent-open" data-id="' + esc(a.id) + '">' +
                  '<span class="ag-av">' + esc(agentInitial(a.name)) + '</span>' +
                  '<span class="ag-meta">' +
                    '<span class="ag-name">' + esc(a.name || 'Untitled agent') + '</span>' +
                    '<span class="ag-line">' + esc(agentPreview(a)) + '</span>' +
                  '</span>' +
                  // SAID ON THE ROW, because the list is where somebody wonders why an
                  // agent has gone quiet. A word rather than a colour: ink is a
                  // hierarchy and never a label.
                  (a.status === 'paused' ? '<span class="ag-chip">Paused</span>' : '') +
                  '<span class="ag-when">' + esc(agentWhen(a.updated)) + '</span>' +
                  '<span class="ag-chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>' +
                '</button>').join('') + '</div>'
            : '<div class="ag-empty">' +
                '<div class="ag-empty-t">No agents yet</div>' +
                '<div class="ag-empty-s">Press + to write one. Tell it what it does and how to answer.</div>' +
              '</div>') +
      // A failed WRITE from the list screen (a delete) has nowhere else to go.
      ((!offerImport && agentActErr) ? '<div class="ag-err">' + esc(agentActErr) + '</div>' : '') +
      '<div class="ag-note">Saved to your account — signed in anywhere, these are here.</div>' +
    '</div>';
  wireActions(view);
}

function agentNew() { agentThread = null; agentEditing = ''; agentDraft = null; agentDraftFor = null; agentActErr = ''; renderAgents(); }
/** A row opens the CONVERSATION. The instructions are behind the pencil. */
function agentOpen(id) {
  agentEditing = null;
  agentThread = String(id || '');
  // The draft is NOT cleared here: it belongs to the conversation, so opening
  // one shows what was left in it and opening another shows that one's.
  agentActErr = '';
  agentThreadLoad(agentThread);
}
/** The pencil, from inside a thread: edit without losing your place. */
function agentEdit(id) {
  agentEditing = String(id || '');
  agentActErr = '';
  // ⚠ WHAT IS TAKEN AWAY IS READ WHEN THE FORM OPENS, and thrown away when it opens for
  // somebody else. Kept from the last agent it would draw another agent's restrictions
  // beside this one's ticks, which is the one thing this section must never do.
  agentRevoked = null; agentRevokedFor = null; agentRevokedErr = '';
  agentRevokeActErr = ''; agentRevokeBusy = ''; agentRevokeSaid = ''; agentRevokeWhy = '';
  if (agentEditing) agentRevokedLoad(agentEditing);
  renderAgents();
}

/**
 * WHICH TOOLS ARE WITHHELD FROM THIS AGENT RIGHT NOW.
 *
 * **SCOPED TO THE AGENT ON THE WIRE**, like every other read here: the route takes the id,
 * checks it belongs to this account, and answers that agent's. A 404 is what a stranger
 * gets and what a missing agent gets, so the two cannot be told apart from outside.
 *
 * ⚠ **A FAILED READ KEEPS WHAT IT HAD AND SAYS SO.** Answering `[]` would draw a form
 * claiming every tool is usable while the server refuses each call — *cannot-tell must
 * never read as a value*, in the one place the value is a permission.
 */
async function agentRevokedLoad(id) {
  const bound = agentBind();
  try {
    const res = await apiFetch('/api/agent/revoked-tools?agent=' + encodeURIComponent(id));
    const j = await res.json().catch(() => ({}));
    // MOVED ON, OR SIGNED IN AS SOMEBODY ELSE. `agentSameEdit` is the wall for this one
    // rather than `agentSame`: what decides whether this answer is still wanted is which
    // agent's FORM is open, not which conversation is.
    if (!agentSameEdit(bound)) return;
    if (!res.ok || !j.ok) {
      agentRevokedErr = (j && j.error) || 'Couldn’t check what has been taken away.';
    } else {
      agentRevoked = Array.isArray(j.revoked) ? j.revoked.filter((t) => typeof t === 'string') : [];
      agentRevokedFor = id;
      agentRevokedErr = '';
    }
  } catch {
    if (agentSameEdit(bound)) agentRevokedErr = 'Couldn’t reach the server.';
  }
  renderAgents();
}

/**
 * ⚠ **READ THE FORM BEFORE A PRESS THAT REDRAWS IT, or somebody's typing is the price of
 * taking a tool away.**
 *
 * This form is rebuilt from `innerHTML` and its draft was written in exactly one place —
 * `agentSave` — so until now the only thing that redrew it was a save. Taking a tool away
 * is a second thing that redraws it, and without this the name and the instructions in
 * front of somebody would be replaced by whatever is stored the moment they pressed it.
 *
 * **IT READS THE SAME FOUR FIELDS THE SAVE READS**, out of the DOM, so what is held is
 * what is on screen; and it is a no-op when the boxes are absent, which is what a form
 * closed between the press and this call looks like.
 */
function agentFormRead() {
  const name = document.getElementById('agName');
  const instr = document.getElementById('agInstr');
  if (!name || !instr) return;
  const zone = document.getElementById('agZone');
  const paused = document.getElementById('agPaused');
  agentDraft = {
    name: name.value || '',
    instructions: instr.value || '',
    status: (paused && paused.checked) ? 'paused' : 'active',
    tools: Array.prototype.slice.call(document.querySelectorAll('[data-tool]'))
      .filter((b) => b && b.checked).map((b) => b.getAttribute('data-tool')),
    zone: zone ? (zone.value || '') : '',
  };
  agentDraftFor = agentEditing;
}

/**
 * TAKE ONE TOOL AWAY FROM THIS AGENT, OR GIVE IT BACK.
 *
 * ⚠ **THIS IS NOT THE TICK AND IT DOES NOT TOUCH THE TICK.** The settings the Save button
 * writes are what the agent's NEXT run is accepted with; this is enforced against a run
 * already going, the engine re-reads it on every delivery, and it withdraws anything
 * waiting for that tool. The two are separate rows in separate tables on purpose, so the
 * two facts can be told apart afterwards.
 *
 * ⚠ **AND IT HAPPENS ON THE PRESS, NOT ON SAVE.** A control inside a form that acts
 * immediately has to say so, and the sentence beside it does.
 *
 * `reason` is deliberately offered for taking one away and not for giving one back: a
 * revocation's note is what the agent is TOLD about the calls it just answered
 * (`the authority for this was withdrawn: …`), and a restoration answers nobody — it does
 * not re-open the requests the revocation withdrew, so there is no message to carry.
 */
async function agentRevokeAct(tool, how) {
  const name = typeof tool === 'string' ? tool.trim() : '';
  const id = agentEditing;
  if (!name || !id || agentRevokeBusy) return;
  // WHAT IS TYPED SURVIVES THIS PRESS, which redraws the whole form.
  agentFormRead();
  const bound = agentBind();
  const back = how === 'restore';
  // THE BOX WHEN IT IS THERE, AND WHAT WAS TYPED INTO IT WHEN IT IS NOT. The input hook
  // keeps the two in step, so this is the same words either way — and a form closed between
  // the press and this line still sends what the person wrote.
  const box = back ? null : document.getElementById('agRevWhy');
  const why = (box ? (box.value || '') : agentRevokeWhy).trim();
  agentRevokeBusy = name;
  agentRevokeActErr = '';
  agentRevokeSaid = '';
  renderAgents();
  let failed = '';
  let said = '';
  try {
    const body = { agent: id, tool: name };
    // ⚠ **THE FIELD IS `note` ON THE WIRE — the route's own name — AND A BLANK ONE IS NOT
    // SENT AT ALL.** The route reads an absent note as "none given" and lets the database
    // fill in its own sentence; an empty string is a note that says nothing, and
    // `coalesce(p_note, …)` keeps it, so the agent would be told the authority was
    // withdrawn and given a blank where the reason should be.
    if (!back && why) body.note = why;
    const res = await apiFetch(back ? '/api/agent/tool-restore' : '/api/agent/tool-revoke', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!agentSameEdit(bound)) return;
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t change that.';
    else said = typeof j.say === 'string' ? j.say : '';
  } catch {
    if (!agentSameEdit(bound)) return;
    failed = 'Couldn’t reach the server.';
  }
  agentRevokeBusy = '';
  if (!agentSameEdit(bound)) return;
  agentRevokeActErr = failed;
  agentRevokeSaid = said;
  // ⚠ THE WORDS ARE KEPT WHEN THE PRESS FAILED and dropped when it landed. A reason that
  // reached the agent has done its job; one that reached nobody is still what somebody
  // wrote, and making them type it again is the cost of our own failure.
  if (!failed && !back) agentRevokeWhy = '';
  // RE-READ EITHER WAY. A refusal may still have been a race somebody else won, so what is
  // drawn afterwards is the server's answer rather than what this press hoped for.
  agentRevokedLoad(id);
}
function agentList() { agentPollStop(); agentThread = null; agentEditing = null; agentActErr = ''; renderAgents(); }
/** Cancel returns where you came from — the thread if one is open. */
function agentCancel() { agentEditing = null; agentDraft = null; agentDraftFor = null; agentActErr = ''; renderAgents(); }
/** The list's error panel, and the thread's. */
function agentReload() { agentsLoad(); }
function agentThreadRetry(id) { agentThreadLoad(String(id || '')); }

/**
 * Delete. CONFIRMED FIRST, because this one really is gone: the agent's whole
 * conversation goes with it by the foreign key's own cascade, and there is no
 * copy of it anywhere else once it was written on the account.
 */
async function agentDelete(id) {
  const target = String(id || '');
  if (!target) return;
  const a = (agentRows || []).find((x) => x.id === target);
  if (!window.confirm('Delete ' + ((a && a.name) || 'this agent') + ' and its whole conversation? This cannot be undone.')) return;
  const bound = agentBind();
  agentBusy = true; agentActErr = ''; renderAgents();
  let failed = '';
  try {
    const res = await apiFetch('/api/agent/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: target }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t delete that.';
  } catch { failed = 'Couldn’t reach the server.'; }
  agentBusy = false;
  // The delete really happened either way; what is guarded is the SCREEN. Closing
  // the thread and the composer is right only if they are still the ones this
  // delete was pressed in — otherwise it would shut a conversation somebody has
  // since opened, and the list reload below shows the agent is gone regardless.
  if (agentSame(bound) || agentSameEdit(bound)) {
    if (failed) agentActErr = failed;
    else {
      // Both screens are left, not just the composer: a thread whose agent is
      // gone is a conversation with nobody.
      agentEditing = null;
      agentThread = null;
    }
  }
  // The conversation went with it, so its unsent words are not worth keeping — and
  // neither is the key, which names a message in a conversation that no longer exists.
  if (!failed) { agentDraftDrop(target, bound.uid); agentKeyDrop(target, bound.uid); }
  await agentsLoad(true);
}

/**
 * Send. An empty message is refused rather than stored.
 *
 * **THE BOX IS NOT CLEARED UNTIL THE SERVER HAS IT**, and the box it means is
 * THIS conversation's. The draft (keyed by account and conversation) holds what
 * was typed across the re-render, so a failed send leaves the words where they
 * were typed with a sentence under them — rather than a message that looked sent
 * and is nowhere, or a clear that lands in whatever conversation is open when
 * the answer arrives.
 */
async function agentSend() {
  const el = document.getElementById('agMsg');
  const text = (el ? el.value : '').trim().slice(0, AGENT_MAX);
  if (!text) { if (el) el.focus(); return; }
  if (!agentThread) { agentList(); return; }
  // BOUND BEFORE THE REQUEST LEAVES. `bound.thread` is the conversation this
  // message belongs to; everything below writes through it rather than through
  // whatever happens to be open when the answer arrives.
  const bound = agentBind();
  const target = bound.thread;
  agentDraftSet(target, text, bound.uid);
  // TAKEN BEFORE THE REQUEST AND NOT MINTED INSIDE IT. Two presses landing before
  // the button is disabled carry the SAME key, so the server absorbs the second
  // into the first — one message, one run. See `agentKeyFor`.
  const key = agentKeyFor(target, text, bound.uid);
  agentBusy = true; agentActErr = ''; renderAgents();
  let failed = '';
  let saved = null;
  let mismatched = false;
  // ⚠ A PAUSE IS ITS OWN OUTCOME AND IS NOT A FAILURE. The server wrote nothing at
  // all — no message, no run — so the words are still this person's to send and the
  // key is still this press's key. Reading it as a failure would be nearly right;
  // what makes it worth its own flag is the SENTENCE, which has somewhere to go.
  let resting = false;
  try {
    const res = await apiFetch('/api/agent/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: target, body: text, key }),
    });
    const j = await res.json().catch(() => ({}));
    if (j && j.paused) resting = true;
    else if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn\u2019t send that.';
    // ⚠ ABSORBED UNDER THIS KEY, BUT NOT THIS TEXT. The server answers `ok` with the
    // message it really holds, so reading it as a plain success would clear the box and
    // throw the edit away — the defect this whole pairing closes, met from the server's
    // side. It cannot happen from THIS browser, because the key is bound to the body;
    // it is answered anyway, because another tab, an older cached script or a hand
    // request can all produce it, and the one thing that must never happen is the
    // person's edited words disappearing quietly.
    else if (j.repeat && j.mismatch) mismatched = true;
    else saved = j.message || null;
  } catch { failed = 'Couldn\u2019t reach the server.'; }

  // THE DRAFT IS THIS CONVERSATION'S WHEREVER THE SCREEN IS NOW. Clearing it on
  // success and leaving it on failure are both writes to THIS conversation's draft
  // — never to "the box", which may be showing another agent entirely.
  //
  // THE KEY GOES WITH THE DRAFT, AND ONLY ON SUCCESS. Clearing it after a FAILURE
  // would make the next press a different press, and a message the server may
  // already hold would be joined by a second copy with a second run — the lost
  // response case turned into the duplicate the key exists to prevent.
  //
  // A PAUSE CLEARS NEITHER, and that is the whole reason it is not folded into
  // `failed`: nothing was committed, so the same press against a resumed agent must
  // be the SAME press — same key, same words, one message.
  if (!failed && !mismatched && !resting) { agentDraftDrop(target, bound.uid); agentKeyDrop(target, bound.uid); agentBoxClear(target, text); }
  // A MISMATCH KEEPS THE WORDS AND DROPS THE KEY, which is the opposite of a failure
  // and deliberately so: the old message is safe on the server, so the next press must
  // be a NEW press — the edited text as its own message — rather than a third attempt
  // to absorb into a body nobody is trying to send any more.
  if (mismatched) agentKeyDrop(target, bound.uid);

  if (!agentSame(bound)) {
    // ANOTHER CONVERSATION — OR ANOTHER ACCOUNT — IS ON SCREEN. Nothing here is
    // allowed to touch it: not its messages, not its draft, not its error line.
    // The message is saved either way, and shows when that conversation is
    // opened again; a failure is not announced into somebody else's screen,
    // where it would read as their message having failed.
    agentBusy = false;
    renderAgents();
    return;
  }

  agentBusy = false;
  // ⚠ SAID, AND THE LIST IS RE-READ RATHER THAN THE ROW BEING PATCHED HERE. The
  // screen thought this agent was active, so it is out of date about more than this
  // one field — and a status composed in this function would be a second writer of a
  // fact the list already owns. The re-read is what draws the banner and takes the
  // Send button away.
  if (resting) {
    agentActErr = 'This agent is paused, so it didn\u2019t start anything. Your message is still here — resume it in its settings and send again.';
    renderAgents();
    await agentsLoad(true);
    return;
  }
  if (failed) { agentActErr = failed; renderAgents(); return; }
  if (mismatched) {
    agentActErr = 'Your first message was already sent. Press send again to add this edited one.';
    renderAgents();
    await agentThreadLoad(target, true);
    return;
  }
  // **APPENDED, THEN RE-READ, AND BOTH HALVES ARE LOAD-BEARING.**
  //
  // The append is what makes the message appear the instant it is saved: the answer
  // IS the stored row, so asking the server to repeat it would be latency for
  // nothing.
  //
  // The re-read is what starts the watching, and THE RUN'S STATE IS NEVER COMPOSED
  // HERE. A run has exactly one reader — the thread — so a `{state: 'queued'}`
  // written in this function would be a second composer of the same fact, and the
  // two would disagree the moment either changed. What is appended is the MESSAGE
  // with no run beside it, which draws as a message whose work has not been read
  // yet; the quiet re-read a moment later fills it in.
  if (Array.isArray(agentMsgs) && agentMsgsFor === target && saved) agentMsgs = agentMsgs.concat([saved]);
  renderAgents();
  // AWAITED, so a caller that waits for the send has waited for the reading too.
  // Un-awaited it is a race with nothing holding either side, and the appended row
  // is replaced by the server's a moment later — which is correct and is not
  // something a test, or a person reading this, should have to guess the order of.
  await agentThreadLoad(target, true);
  // The row's preview line and its place in the list both moved.
  agentsLoad(true);
}

/**
 * Save. A NAMELESS AGENT IS REFUSED rather than given a name of ours: the list
 * is read by the name, so an invented one is a row nobody can find again.
 *
 * The two refusals are checked here AND on the server — the server's are the
 * wall (a request can be made without this screen), these are what make the
 * message immediate.
 */
/**
 * WHAT THE SETTINGS FORM CURRENTLY HOLDS, read out of the DOM.
 *
 * ⚠ THE TICKS ARE READ FROM THE CHECKBOXES AND NOT FROM THE DRAFT, and that is the
 * whole reason the controls can be handler-free: a checkbox owns its own state, so
 * the DOM is where somebody's latest answer is. Reading the draft instead would
 * save whatever the form was DRAWN with and silently discard every tick since.
 *
 * `status` is two values and the control is one checkbox, so an absent element
 * reads as `active` — which is the value a form that could not be read should not
 * be able to invent a pause out of.
 */
function agentFormValues() {
  const nameEl = document.getElementById('agName');
  const instrEl = document.getElementById('agInstr');
  const pausedEl = document.getElementById('agPaused');
  const zoneEl = document.getElementById('agZone');
  const boxes = typeof document.querySelectorAll === 'function'
    ? [...document.querySelectorAll('[data-tool]')] : [];
  return {
    name: (nameEl ? nameEl.value : '').trim().slice(0, AGENT_NAME_MAX),
    instructions: (instrEl ? instrEl.value : '').trim().slice(0, AGENT_MAX),
    status: (pausedEl && pausedEl.checked) ? 'paused' : 'active',
    // ⚠ **THE EMPTY BOX IS SENT AS `null`, WHICH IS A CLEAR RATHER THAN A SILENCE.** The
    // route reads absent as *leave it alone* and `null` as *forget it* — and this form
    // always draws the box, so what it sends is always what it shows. Sending `''` instead
    // would make emptying it a save that changes nothing, which is the dead control again.
    zone: (zoneEl ? zoneEl.value : '').trim().slice(0, 200) || null,
    // ONLY WHAT IS TICKED, and each name off the box's own attribute rather than a
    // label or a position — a name read out of the drawing is a name that changes
    // when somebody rewords it.
    tools: boxes.filter((el) => el.checked)
                .map((el) => (el.getAttribute ? el.getAttribute('data-tool') : '') || '')
                .filter(Boolean),
  };
}

async function agentSave() {
  const { name, instructions, status, tools, zone } = agentFormValues();
  const say = (m) => { agentActErr = m; renderAgents(); };
  // KEPT BEFORE ANYTHING CAN FAIL, including the refusals below: `renderAgents`
  // rewrites the panel, so without this the words would be gone by the time the
  // sentence appeared. **ALL FOUR FIELDS, not just the two text ones** — a failed
  // save that redrew an unticked box as ticked would say a permission was stored
  // when it was refused.
  agentDraft = { name, instructions, status, tools, zone };
  agentDraftFor = agentEditing;
  agentSaved = false;
  if (!name) { say('Give it a name first.'); return; }
  if (!instructions) { say('Say what it should do.'); return; }

  const bound = agentBind();
  const editing = bound.editing;
  agentBusy = true; agentActErr = ''; renderAgents();
  let failed = '';
  // ⚠ DECLARED OUT HERE BECAUSE IT IS READ OUT HERE. `j` is `const` inside the try,
  // so reading the created agent's id below the block is a `ReferenceError` that
  // `node --check` cannot see — this repository's own temporal-dead-zone trap, met
  // by putting the value where its reader is rather than reaching into a block.
  let made = null;
  try {
    const res = await apiFetch(editing ? '/api/agent/update' : '/api/agent/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // ⚠ THE SAME FOUR FIELDS EITHER WAY, and a create used to send three. The form
      // draws the pause control whether or not the agent exists yet, so leaving
      // `status` out of the create body made that tick a control somebody sets and
      // nothing reads — the agent came back active, and the checkbox that said
      // otherwise was the only thing claiming it was paused.
      // ⚠ THE SAME FIVE FIELDS EITHER WAY. The form draws the zone box for a NEW agent as
      // well, so leaving it out of the create body would make that box a control somebody
      // fills in and nothing reads — which is exactly what happened to `status` once.
      body: JSON.stringify(editing
        ? { id: editing, name, instructions, status, tools, zone }
        : { name, instructions, status, tools, zone }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) failed = (j && j.error) || 'Couldn’t save that.';
    else if (j.agent && typeof j.agent.id === 'string') made = j.agent.id;
  } catch { failed = 'Couldn’t reach the server.'; }

  // THE COMPOSER MAY HAVE MOVED ON, or another account may be signed in. Closing
  // it, clearing its draft or writing an error into it would all be acting on
  // somebody else's screen — including the case that matters most, where a slow
  // failure for agent A would otherwise throw away what is being typed about B.
  if (!agentSameEdit(bound)) { agentBusy = false; renderAgents(); return; }

  agentBusy = false;
  if (failed) {
    // THE DRAFT IS LEFT IN PLACE. The composer stays open on the words that
    // failed, so pressing Save again sends the same thing.
    say(failed);
    return;
  }
  // ⚠ THE FORM STAYS OPEN AND SAYS SO. It used to close onto the list, which is
  // feedback of a sort and not one anybody reads as confirmation — "save feedback"
  // has to be where the button was. A CREATE becomes an EDIT of what it just made,
  // so the next press adjusts the same agent rather than making a second one.
  agentDraft = null;
  agentDraftFor = null;
  agentSaved = true;
  // An id we cannot read leaves the composer rather than pretending: closing onto
  // the list is the honest answer when we do not know what was made.
  if (!editing) agentEditing = made;
  // ⚠ **A CREATE THAT BECAME AN EDIT HAS TO READ WHAT IS TAKEN AWAY, or its new section
  // says "Checking…" for as long as the form stays open.** There can be nothing revoked for
  // an agent a moment old, so the answer is always `[]` — which is exactly why the read is
  // needed: `null` draws the loading line, and only an answer turns it into the sentence
  // that says nothing is taken away.
  if (!editing && made) agentRevokedLoad(made);
  await agentsLoad(true);
}

/**
 * Bring the agents in this browser over to the account.
 *
 * ONE REQUEST PER AGENT, and each one is a single transaction on the server
 * (`agent.import_agent`): the agent and its whole conversation land together or
 * neither does. That is what makes this safe to press twice — the local copy is
 * never deleted, so a half-finished import can be finished, and an agent that
 * already came over is skipped by its own mark rather than copied again.
 *
 * **NOTHING LOCAL IS DELETED, EVER**, and a failure stops where it is and says
 * how far it got. The ones that did not come over are still in the browser and
 * still offered.
 *
 * **AND ONLY THIS ACCOUNT'S RECORDS ARE SENT**, asked per record below rather
 * than inherited from whatever the screen last drew.
 */
async function agentImport() {
  // ⚠ THE ACTION READS THE STORE, NOT THE OFFER. What the list drew is what
  // somebody was OFFERED; this is what gets SENT, and the two are different
  // questions with different consequences — the first is what a person can see,
  // the second is another account's written instructions copied into this one
  // for good. So the ownership test below is asked HERE, of every record, at the
  // point its request is built, and it is the only thing standing between this
  // loop and a record it may not have.
  const pending = agentsStored().filter((a) => !a.imported);
  if (!pending.length) return;
  const bound = agentBind();
  agentBusy = true; agentActErr = ''; renderAgents();
  let done = 0;
  for (const a of pending) {
    // **THE BINDING CHECK IS ASKED ONCE IN THIS LOOP, NOT TWICE, AND THAT IS
    // MEASURED RATHER THAN ASSUMED.** `bound.uid !== agentUid()` at the top of
    // an iteration looks like a second wall and cannot be one: nothing between
    // the previous iteration's check and this point awaits, so the account
    // cannot change in between and the two can never disagree. A sweep caught it
    // as a survivor — a mutant deleting it changed no result — and the honest
    // answer to a wall nobody can drive is to keep the one that can. It is BELOW
    // the request, where the account really can have changed while the answer
    // was in the air.
    //
    // THE OWNERSHIP TEST BELOW IS NOT THAT CHECK AND IS NOT REDUNDANT WITH IT.
    // The binding check asks whether the account has changed SINCE THE PRESS;
    // this asks whether the record belongs to the account AT ALL. Signed in as B
    // with A's records in the browser, the binding check is satisfied from the
    // first line to the last — nothing changed — and it is the ownership test
    // that refuses. Measured: removing it sends A's record under B.
    // ⚠ THE OWNERSHIP TEST, ASKED OF THIS RECORD, AGAINST THE ACCOUNT THAT
    // WOULD MAKE THE REQUEST. `agentOwns` is the same predicate the list asks;
    // what differs is the question, which is why this is not a second copy of
    // anything: the list asks "what may I show", this asks "may I send THIS".
    //
    // SILENT, DELIBERATELY. Saying "skipped 2 that aren't yours" would tell the
    // person at this screen that another account has records in this browser,
    // which is the one thing the filter exists to prevent. The count at the end
    // is about their own records and stays honest.
    if (!agentOwns(a, agentUid())) continue;
    const name = String(a.name || '').trim().slice(0, AGENT_NAME_MAX);
    const instructions = String(a.instructions || '').trim().slice(0, AGENT_MAX);
    // A local record too broken to describe is SKIPPED AND SAID, never sent as
    // half an agent and never quietly dropped: it stays in the browser, and the
    // count at the end is what tells somebody to go and look.
    if (!name || !instructions) continue;
    const messages = (Array.isArray(a.messages) ? a.messages : [])
      .slice(-AGENT_THREAD_MAX)
      .map((m) => ({ text: String((m && m.text) || ''), at: Number((m && m.at) || 0) }))
      .filter((m) => m.text);
    try {
      const res = await apiFetch('/api/agent/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `a.id` IS THE IMPORT'S IDENTITY — the browser record's own id, stable
        // across retries, which is what lets a press whose answer was lost be
        // pressed again without making a second agent.
        body: JSON.stringify({ key: a.id, name, instructions, messages }),
      });
      const j = await res.json().catch(() => ({}));
      if (bound.uid !== agentUid()) { agentBusy = false; return; }
      if (!res.ok || !j.ok || !j.id) {
        agentActErr = (done ? 'Brought ' + done + ' over, then stopped: ' : '') +
          ((j && j.error) || 'Couldn’t bring that one over.') +
          ' Nothing was removed from this browser.';
        break;
      }
      agentMarkImported(a.id, j.id);
      done++;
    } catch {
      // THE THROW PATH NEEDS THE SAME WALL, and it did not have one — found by
      // the same sweep. A request that dies after the account changed would
      // otherwise write "couldn't reach the server" into the incoming account's
      // screen, about an import they never pressed.
      if (bound.uid !== agentUid()) { agentBusy = false; return; }
      agentActErr = (done ? 'Brought ' + done + ' over, then stopped: ' : '') +
        'Couldn’t reach the server. Nothing was removed from this browser.';
      break;
    }
  }
  agentBusy = false;
  await agentsLoad(true);
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
  // THE FOLD SET BELONGS TO A PROJECT, AND IT IS THE ONE CODE-TAB STATE THAT
  // CANNOT SURVIVE A SWITCH (2026-09-12, owner, on a screenshot of a Code tab
  // with every heading shut and no file on screen).
  //
  // The paragraph beside `siteCodeFind` argues that a carried-over QUERY is fine
  // because it is VISIBLE, and a carried-over FILENAME is fine because it falls
  // back to `files[0]`. The fold set has neither property: `stOpenFolders`
  // returns a stored Set wholesale (`chosen instanceof Set` short-circuits the
  // derive), so a customer who folded the tree up on one site opened the next one
  // to a shut tree, nothing on screen, and no sign of why — the first draw's
  // "open the chain holding the file" default never ran, because from the
  // renderer's side there WAS a choice to honour. It just belonged to a
  // different project.
  //
  // IT IS THE SAME DEFECT NOW THAT THE TREE IS ONE TREE, and cheaper to hit: the
  // keys were group names and folder paths under them, and they are folder paths
  // from the root, so folding `src` on one project used to hide one heading's
  // contents and now hides nearly the whole project on the next one.
  //
  // Reset on a real CHANGE of project, not on every call: re-opening the site
  // already open (the Data button, a re-render) must keep the folds the customer
  // just made. `null` and not an empty Set, because those two mean different
  // things here and the empty one is what the defect looked like.
  if ((id || null) !== siteOpenId) siteCodeFolds = null;
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
let siteBuild = null;       // { react, rphase, code, file, filesSeen[], agents, images[] } — the running build
let siteTicker = null;      // setInterval handle repainting the live step rail
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
let siteCodeFolds = null;
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
// ONE NAMER FOR A ROUTE, whatever told us the route exists.
//
// Two things now produce a page list — the file list on a build message in this
// browser's own thread (`reactRoutePages`, below) and the server's answer for a
// site this browser adopted (`siteRoutesFetch`) — and they must name a page the
// same way or the picker's label changes depending on which door the customer
// came through. That is the recorded "two lists of the same thing" with a
// display name as its subject, and the drift would be silent: both labels read
// fine on their own.
//
// `html: ''` IS PART OF THE SHAPE, not an omission. `switchSitePage` branches on
// `target.html` to choose the stored-draft loader over the live frame, so a page
// with no stored HTML must carry the empty string rather than nothing — this is
// a React page and the live frame is the right loader for it.
function pageFromPath(path) {
  const p = String(path || '/') || '/';
  const last = p === '/' ? 'Home' : p.split('/').pop().replace(/[-_]+/g, ' ');
  return { path: p, name: last.charAt(0).toUpperCase() + last.slice(1), html: '' };
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
    out.push(pageFromPath(path));
  }
  // Home first; the rest keep the order the model wrote them, which matches the
  // site's own nav far more often than alphabetical would.
  out.sort((a, b) => (a.path === '/' ? -1 : b.path === '/' ? 1 : 0));
  return out;
}
// WHICH PAGES A SITE HAS, ASKED OF THE SERVER (2026-09-13, owner on a
// three-page site whose picker read a dead "Homepage": "YES FIX THE PICKER").
//
// THE PAGE LIST ONLY EVER EXISTED IN THE BROWSER THAT BUILT THE SITE. `sitePages`
// above reads `site.pages` out of localStorage and recovers an older React
// site's list from the FILES on a build message in the thread — and a site this
// browser adopted off `/api/site/list` has neither, because `fromRow` in
// `site-list.js` carries no pages and no messages. So every site opened on a
// second machine showed one page however many it really had, and the other pages
// were unreachable in the preview. Nothing failed and nothing logged; the label
// is a legitimate rendering of an empty list.
//
// ONCE PER SLUG PER PAGE LOAD. `renderSiteWorkspace` runs on every render and
// every reply triggers one, so without the latch this is a request per render —
// `editWatched`'s reasoning one panel over. The latch is deliberately NOT
// cleared on a successful write: a site that publishes a new page mid-session
// has its list written by the build itself, and a site that answered nothing
// will answer nothing again this load.
//
// IT NEVER OVERWRITES A LIST THIS BROWSER ALREADY HAS, and the check is made at
// APPLY time rather than at fetch time — a build can land while the request is
// in the air, and that list is the better one: it is what was just written,
// where this answer is what was last published.
//
// SILENT ON EVERY FAILURE. A blip leaves the picker exactly as it was, which is
// the screen that shipped before this existed. There is nothing to tell the
// customer: they did not ask for this and cannot act on it.
const siteRoutesAsked = new Set();
function siteRoutesFetch(site) {
  if (!site || !site.slug || !site.react || !site.id) return;
  if (siteRoutesAsked.has(site.slug)) return;
  siteRoutesAsked.add(site.slug);
  apiFetch('/api/site/routes?slug=' + encodeURIComponent(site.slug)).then(async (r) => {
    const d = await r.json().catch(() => null);
    if (!r.ok || !d || d.ok !== true || !Array.isArray(d.routes) || !d.routes.length) return;
    const s = siteById(site.id);
    if (!s || (Array.isArray(s.pages) && s.pages.length > 1)) return;
    // STRINGS ONLY. This is a decoded JSON body: `String(["/menu"])` is "/menu",
    // the recorded coercion that has shipped three times here, so a shape we did
    // not send is dropped rather than made into a page nobody can open.
    const paths = d.routes.filter((p) => typeof p === 'string' && p.charAt(0) === '/');
    if (!paths.length) return;
    s.pages = paths.map(pageFromPath);
    sitesSave();
    if (siteOpenId === s.id) renderSites();
  }).catch(() => {});
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
// WHERE THE PREVIEW FRAME POINTS, in ONE place (2026-09-12).
//
// This expression was written out TWICE — in `switchSitePage` and in the
// workspace render — and the Refresh button needed a third. Three copies of
// "which URL is this site's preview" is the recorded two-lists-of-the-same-thing
// trap with a URL as its subject, and the drift is silent: a frame pointed at a
// path the router redirects away from looks like a slow site, not a bug.
//
// `?v=` IS LOAD-BEARING AND IS NOT DECORATION. Assigning `fr.src` a value it
// already has does not reload an iframe, so the cache-buster is the only thing
// that makes a re-point actually re-fetch. It is bumped on every revise
// (`previewV`), and the Refresh button bumps it for the same reason.
// THE DEFAULT GUARDS `String(null)`, NOT THE EMPTY STRING — measured, because
// it reads like tidiness and is not. `'' ` and `'/'` produce the same answer
// (the test below is `!== '/'`, and `''.replace(/^\//, '')` is `''`), so
// `|| '/'` against `|| ''` is INERT: identical on all seven path shapes tried.
// With NO default, a caller that has no active page yet hands over `null` and
// `String(null)` is `"null"` — the frame then points at `<site>/null`, a route
// no site has. Do not "simplify" this away.
function sitePreviewSrc(site, path) {
  const at = path || '/';
  return site.url + (at !== '/' ? String(at).replace(/^\//, '') : '') + '?v=' + (site.previewV || 1);
}
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
// Build the shim-injected preview HTML (error watcher + draft slug + nav shim)
// and load it into the frame from a blob URL.
//
// THE ROUND TRIP THAT USED TO COME FIRST IS GONE (2026-09-13, the dead-code
// census). It POSTed the shimmed document to `/api/site/preview` so the frame
// could load it from a real `/preview/` URL under the WEBSITE CSP, where the
// generated page's own inline <script>/<style> run — a blob inherits the APP's
// strict `script-src 'self'`, so dynamic content stays inert. That is still
// true and is still the cost; what changed is that the POST has had no route
// since the D1 page format went, so it has 404'd on every single call and the
// blob below has been the only path for as long as this function has had a
// caller. A request that cannot succeed is not a fallback chain, it is a failed
// request in front of the thing that runs. `client-routes.test.mjs` carried
// `/api/site/preview` on its KNOWN_DEAD ratchet, which is where that was
// written down.
//
// PUTTING IT BACK IS TWO HALVES, AND THE SERVER ONE IS STILL THERE: the Worker
// still serves `GET /preview/<uid>/<nonce>` out of `preview/<uid>.html`, and
// NOTHING WRITES THAT OBJECT — so the route answers "Preview not ready" to
// every request it has ever had. A working draft preview needs the POST route
// that writes it, and then this call in front of the blob again.
async function loadSitePreview(fr, html, slug) {
  if (!fr) return;
  const withShim = sitePreviewHtml(html, slug);
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
  else if (f && s.react && s.url) loadSiteFrame(f, sitePreviewSrc(s, path));
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
  // A DIAL, for the model-context panel: how full the window is. Drawn as a
  // half-round sweep with a needle rather than a full circle, because a full one
  // at 17px reads as the `cloud` blob beside it in the same nav column — checked
  // against the real strip rather than guessed, which is the lesson the file
  // tree's cog-versus-sliders choice already records.
  gauge: '<path d="M4 16a8 8 0 0 1 16 0"/><path d="M12 16l4.5-4"/><circle cx="12" cy="16" r="1.1"/>',
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
// WHAT KIND OF FILE EACH ONE IS — a fact the ROW carries, not a heading that
// cuts the tree (owner, 2026-09-12, holding Lovable's explorer beside ours:
// *"ITS BY FOLDERS . THATS THE DIFFERENCE I THINK"*, then *"OK GO"*).
//
// UNTIL TODAY THESE WERE FIVE HEADINGS and the tree was five trees under them:
// Pages · Components · Made by the build · Design system · Shared with every
// site, each holding the real directory tree of its own files. That was right
// about the distinction and wrong about the shape. A customer's project is ONE
// directory on disk, and cutting it five ways meant `src/routes` was drawn twice
// (once under Pages, once under Components), the project root was split between
// two headings, and no row anywhere sat where the file really lives. Lovable
// opens at the repo root and goes down; a customer reading their own project
// wants the project, not our classification of it.
//
// WHAT THE HEADINGS SAID IS NOT LOST, IT MOVED ONTO THE ROW. Which files are the
// customer's own and which are ours on every site is a real and useful thing to
// know — it is the ONE thing a flat directory cannot say — so the file rows the
// customer owns are drawn in full ink and the platform's stay muted, and every
// row carries its kind's name where a pointer or a screen reader can reach it.
// A flag on a row is the one a reader skims past, which is why the headings were
// chosen in the first place; the answer is not a flag but the type itself.
//
// `own: true` IS "THIS IS THE CUSTOMER'S FILE", and the split is by who decides
// what is in it. A page and a component are written for this site by the model
// the customer is talking to, and `src/site-brand.ts` is written by their own
// build — those three change when they ask for a change. `src/router.tsx` is
// ours on every site, and the kit parts are ours on every site that imports one:
// neither moves because the customer said anything, so neither is theirs.
const ST_FILE_KINDS = [
  ['page', 'Page', true],
  ['part', 'Component', true],
  ['asset', 'Made by the build', true],
  // THE KIT PARTS THIS SITE IMPORTS. They are not quite the shared scaffold:
  // `src/router.tsx` is on every site and these are only on the sites that reach
  // for them, which is why they are stored per slug and why the count differs
  // between two sites. The distinction is worth keeping in the words even now
  // that it no longer decides where the row is drawn.
  ['kit', 'Design system', false],
  ['shared', 'Shared with every site', false],
];
/** What a file's kind is called, and whether it is the customer's own. */
function stKindOf(kind) {
  const row = ST_FILE_KINDS.find((k) => k[0] === kind);
  return { label: row ? row[1] : '', own: !!(row && row[2]) };
}
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
 * Which folders the tree draws OPEN (owner, 2026-09-11: *"components you click
 * and the 8 or 0 or whatever how many they appear"*, then the nesting).
 *
 * A FOLDER'S KEY IS ITS PATH, and that is what the one tree bought. Under the
 * five headings it could not be: `src/routes` existed under Pages AND under
 * Components, two different folders drawn from two different file lists, so
 * every key had to carry its heading's name to tell them apart. One tree has one
 * `src/routes`, so the path identifies it and there is nothing to prefix.
 *
 * THE THIRD STATE IS THE WHOLE OF THE FIRST DRAW. `chosen` is what the customer
 * has folded and unfolded; `null` means they have touched nothing yet, which is
 * NOT an empty Set. Uninitialised opens exactly the CHAIN holding the file on
 * screen — every folder from the root down to it — and leaves everything else
 * folded, which is what a file explorer does when you open a file by path. An
 * empty Set is a customer who has closed every folder, and re-deriving the
 * default for them would re-open one on the next click, for ever. The recorded
 * "cannot-tell must never read as a value", pointed at a preference.
 *
 * THE DEFAULT IS DERIVED FROM THE OPEN FILE and from nothing else, because the
 * first draw is not the only draw that can find `chosen` null — a rebuild
 * replaces the file list while the customer's chosen file may be anything — and
 * a named folder would fold the one holding the file being shown.
 *
 * A FILE AT THE ROOT OPENS NOTHING, and that is right rather than a gap:
 * `package.json` has no folder above it, so the empty answer draws the whole
 * root — its twelve files and every top-level folder, shut — with the open file
 * among them.
 */
function stOpenFolders(files, openName, chosen) {
  if (chosen instanceof Set) return chosen;
  const list = Array.isArray(files) ? files : [];
  const keys = new Set();
  const holds = list.find((f) => f && f.name === openName);
  if (!holds) return keys;
  // THE CHAIN, walked through the SAME collapse rule the renderer uses, so every
  // key here is a key the tree really draws.
  let at = stDirTree(list);
  let prefix = '';
  const segs = String(holds.name).split('/');
  segs.pop();
  let i = 0;
  while (i < segs.length && at.dirs.has(segs[i])) {
    const step = stCollapse(segs[i], at.dirs.get(segs[i]));
    const path = prefix + step.label;
    keys.add(path);
    i += step.label.split('/').length;
    prefix = path + '/';
    at = step.node;
  }
  return keys;
}
/**
 * A row that folds: a folder, at any depth.
 *
 * IT TOOK A CLASS UNTIL 2026-09-12 because a group heading and a folder were two
 * kinds of fold row wearing two styles — `st-code-h` in tracked uppercase for the
 * five headings, `st-code-d` in sentence case for the real directories inside
 * them. There is one kind now, so the class is written here rather than passed:
 * a parameter with one possible value is a second copy of that value with a call
 * site between them.
 */
function stFoldRow(key, label, count, shown, depth) {
  // ONE CHEVRON, TURNED. `chevronleft` points left when the folder is shut — the
  // universal collapsed state — and the open rule rotates it to point down. A
  // second icon entry would be a second glyph to keep in step with the first for
  // no gain; the disclosure triangle IS one mark that turns.
  //
  // AND THE COUNT IS WHAT MAKES A FOLDED FOLDER HONEST rather than a hidden one.
  // `components/ui 25` says there are twenty-five things in there; a bare folder
  // over nothing says a folder exists and nothing about whether it is empty.
  return '<button type="button" class="st-code-d' + (shown ? ' on' : '') +
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
function stCodeRows(node, prefix, depth, open, openName) {
  let out = '';
  // FOLDERS ABOVE FILES, which is what every explorer does and what keeps a long
  // file list from burying the one folder under it.
  for (const entry of node.dirs) {
    const step = stCollapse(entry[0], entry[1]);
    // THE PATH IS THE KEY. It took a `keyBase` prefix until 2026-09-12, when the
    // tree was five trees and `src/routes` could be two different folders; one
    // tree has one of each path, so the path names it on its own.
    const path = prefix + step.label;
    const shown = open.has(path);
    out += stFoldRow(path, step.label, stDirCount(step.node), shown, depth);
    if (shown) out += stCodeRows(step.node, path + '/', depth + 1, open, openName);
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
    //
    // AND IT CARRIES ITS KIND, which is the half of the five headings worth
    // keeping (2026-09-12). A directory tree cannot say whether `router.tsx` is
    // something the customer's build wrote or something on every site we ship,
    // and that is worth knowing before you read a file — so the customer's own
    // files are drawn in full ink (`st-file-own`) and ours stay at the muted
    // resting colour every row had before today. NOTHING BECOMES HARDER TO READ:
    // the change is additive, some rows get darker, and the platform's rows are
    // exactly the ink they have always been.
    //
    // THE WORDS ARE ON THE ROW TOO, in `title`, because ink is a hierarchy and
    // not a label: it says these two rows differ and never says how. A pointer or
    // a screen reader gets "Shared with every site" in as many words, which is
    // what the heading used to spell out for a whole group at once.
    const kind = stKindOf(f.kind);
    out += '<button type="button" class="st-file' + (f.name === openName ? ' on' : '') +
      (kind.own ? ' st-file-own' : '') + (f.unplaced ? ' st-file-lost' : '') +
      '" data-srcname="' + esc(f.name) + '"' +
      (kind.label ? ' title="' + esc(f.base + ' — ' + kind.label) + '"' : '') +
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
// tree answers a query with a shut `src` — the one shape that reads as "nothing
// found" while holding the answer. A Set would have to be built by walking the
// filtered tree, which is a second copy of the renderer's own collapse rule and
// the exact drift `stCollapse` exists to stop; a thing that says yes to every
// key is the same answer with nothing to keep in step.
//
// AND IT IS NEVER STORED. `siteCodeFolds` keeps the customer's own folds
// untouched while a query is up, so clearing the box puts the tree back exactly
// as they left it.
const ST_ALL_OPEN = { has: () => true };
/**
 * THE WHOLE PROJECT, AS ONE TREE FROM ITS ROOT (owner, 2026-09-12, holding
 * Lovable's explorer beside ours: *"ITS BY FOLDERS . THATS THE DIFFERENCE I
 * THINK"* → *"OK GO"*).
 *
 * THIS FUNCTION USED TO BE A LOOP OVER FIVE HEADINGS, each building its own
 * `stDirTree` from its own slice of the list. Every part of that is still here
 * except the loop: the same tree builder, the same collapse rule, the same rows,
 * the same icons, the same A–Z sort — over ALL the files at once, starting at
 * depth 0 where the headings used to sit.
 *
 * WHAT IT COSTS, so the next session does not read it as a regression: a page is
 * one row deeper than it was. Under the headings, Pages held only the routes the
 * customer wrote, so `src/routes` collapsed to a single row and `index.tsx` sat
 * under it. In the real directory `src/routes` also holds `__root.tsx` and
 * `-parts/`, so the chain is `src` → `routes` → the file. That is the project as
 * it is on disk, and the fold preference means it is one click once.
 */
function stCodeTree(files, openName, chosen, all) {
  const list = Array.isArray(files) ? files : [];
  const open = all ? ST_ALL_OPEN : stOpenFolders(list, openName, chosen);
  return stCodeRows(stDirTree(list), '', 0, open, openName);
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
      ? stCodeTree(found.files, open.name, siteCodeFolds, found.on)
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
      const now = new Set(stOpenFolders(files, open.name, siteCodeFolds));
      const k = b.dataset.srcfold;
      if (now.has(k)) now.delete(k); else now.add(k);
      siteCodeFolds = now;
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
function siteMoreView(site) {
  const items = [['analytics', 'chart', 'Analytics'], ['cloud', 'cloud', 'Cloud'], ['security', 'shield', 'Security'], ['seo', 'search', 'SEO & AI search'], ['context', 'gauge', 'Model context']];
  const nav = items.map((it) => '<button type="button" class="st-mnav' + (siteMoreTab === it[0] ? ' on' : '') + '" data-more="' + it[0] + '"><span class="st-mnav-ic">' + ic(it[1], 17) + '</span>' + it[2] + '</button>').join('');
  const body = siteMoreTab === 'cloud' ? moreCloud(site) : siteMoreTab === 'security' ? moreSecurity(site) : siteMoreTab === 'seo' ? moreSeo(site) : siteMoreTab === 'context' ? moreContext(site) : moreAnalytics(site);
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
// ── MODEL CONTEXT: how full the window gets, and what fills it ──────────────
//
// Owner, 2026-09-13, holding up Claude Code's own context panel: "KINDA WANT
// SOMETHING LIKE THIS THAT TRACKS THE CONTEXT WINDOW THING."
//
// IT ANSWERS WHAT THE NEXT CALL CARRIES, not only what the last one did, and
// that is why it has something to draw on a site that has never built since this
// shipped — which is every site the account owns. A purely historical panel is
// the kit closure's own `Design system` folder again: correct, empty, and
// unexplained.
const siteCtx = {};
const siteCtxAsked = new Set();
function siteCtxFetch(site) {
  if (!site || !site.slug || siteCtxAsked.has(site.slug)) return;
  siteCtxAsked.add(site.slug);
  apiFetch('/api/site/context?slug=' + encodeURIComponent(site.slug)).then(async (r) => {
    const d = await r.json().catch(() => null);
    if (!r.ok || !d || d.ok !== true || !Array.isArray(d.shapes)) return;
    siteCtx[site.slug] = d;
    // Only redraw if this is still the panel being looked at — the answer can
    // land after the customer has moved on, and rebuilding the workspace under
    // them to paint a tab they left is the twitch the Code tab already records.
    if (siteOpenId === site.id && siteView === 'more' && siteMoreTab === 'context') renderSites();
  }).catch(() => {});
}
// 31915 -> "31,915". Plain grouping: these are counts, and a reader comparing
// two rows wants the digits to line up rather than to be rounded into agreement.
function ctxNum(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
// 500000 -> "500K", 1000000 -> "1M". The DENOMINATOR is rounded where the
// numerator is not, because a window is a headline figure and nobody needs to
// read it to the digit.
function ctxCap(n) {
  const v = Number(n) || 0;
  if (v >= 1000000) return (v % 1000000 ? (v / 1000000).toFixed(1) : v / 1000000) + 'M';
  if (v >= 1000) return Math.round(v / 1000) + 'K';
  return String(v);
}
// The four parts, in the order they are sent, each with its own colour. A fixed
// order rather than sorted by size: the chart is read against itself across two
// shapes and across builds, and a bar whose bands reorder when one grows is a
// chart nobody can compare.
const CTX_PARTS = [
  ['tools', 'Design tool', 'a'],
  ['system', 'System rules', 'b'],
  ['message', 'Brief + stored state', 'c'],
  ['attachments', 'Attachments', 'd'],
];
// THE BAR IS A FILL GAUGE AGAINST THE WINDOW, NOT A COMPOSITION CHART, and the
// difference is the whole honesty of the picture. Drawn as composition alone —
// each part taking its share of the full bar — every row is 100% full whatever
// the model, so three rows reading 2.2%, 2.2% and 4.4% looked identical and
// brim-full. The number and the picture said opposite things.
//
// So each band is its share of the CALL times the call's share of the WINDOW,
// and the track behind it is the free space. FOUND BY RENDERING IT: no markup
// assertion and no reading of this function could have shown it, because the
// code was correct about the thing it was computing and wrong about what the
// reader would take it to mean.
//
// AND THE SLIVER IS THE POINT rather than a problem to pad away. At 4% of a
// window the ink is a few pixels, and that IS the finding — this builder uses
// almost none of what it is given. A minimum band width would make every row
// legible by making every row a lie; the legend underneath carries the
// composition at full width, so nothing is lost by telling the truth here.
function ctxBar(parts, used) {
  const fill = typeof used === 'number' && used > 0 ? Math.min(1, used) : 0;
  const seg = CTX_PARTS.map(([key, , tone]) => {
    const p = (parts || []).find((x) => x && x.name === key);
    const pct = p ? p.share * fill * 100 : 0;
    if (pct <= 0) return '';
    return '<span class="st-ctx-seg st-ctx-' + tone + '" style="width:' + pct.toFixed(3) + '%"></span>';
  }).join('');
  return '<div class="st-ctx-bar">' + seg + '</div>';
}
function moreContext(site) {
  const head = '<div class="st-panel"><div class="st-panel-head"><h3>Model context</h3></div>';
  if (!site.slug) {
    return head + '<p class="st-ctx-none">Build your site to see what its next call carries.</p></div>';
  }
  const d = siteCtx[site.slug];
  if (!d) {
    siteCtxFetch(site);
    return head + '<p class="st-ctx-none">Reading what this site sends…</p></div>';
  }

  const shapes = d.shapes.map((s) => {
    const rows = (s.models || []).map((m) => {
      const pct = typeof m.used === 'number' ? (m.used * 100) : null;
      return '<div class="st-ctx-row">'
        + '<span class="st-ctx-model">' + esc(String(m.model || '')) + '</span>'
        + ctxBar(s.parts, m.used)
        + '<span class="st-ctx-of">' + ctxNum(m.tokens) + ' / ' + ctxCap(m.window) + '</span>'
        // A window we do not know gets an em dash, never 0% — a bar at zero says
        // "nothing was sent", which is the opposite of "we cannot say".
        + '<span class="st-ctx-pct">' + (pct === null ? '—' : pct.toFixed(1) + '%') + '</span>'
        + '</div>';
    }).join('');
    const legend = CTX_PARTS.map(([key, label, tone]) => {
      const p = (s.parts || []).find((x) => x && x.name === key);
      const share = p ? p.share * 100 : 0;
      return '<div class="st-ctx-key">'
        + '<span class="st-ctx-dot st-ctx-' + tone + '"></span>'
        + '<span class="st-ctx-key-l">' + label + '</span>'
        + '<span class="st-ctx-key-v">' + ctxNum(p ? p.chars : 0) + ' chars</span>'
        + '<span class="st-ctx-key-p">' + share.toFixed(1) + '%</span>'
        + '</div>';
    }).join('');
    return '<div class="st-ctx-shape"><h4 class="st-ctx-h">' + esc(String(s.name || '')) + '</h4>'
      + rows + '<div class="st-ctx-legend">' + legend + '</div></div>';
  }).join('');

  // THE HONESTY LINE, and it is not decoration. Every number above is characters
  // divided by three, because there is no tokenizer in a browser or a Worker for
  // either provider. Saying so is what keeps this from being the SEO tab, which
  // stated three confident falsehoods about a customer's own business.
  const note = '<p class="st-ctx-note">Estimated from what we send — characters at three per token. '
    + 'A build measures it exactly.</p>';
  const measured = d.measured && typeof d.measured === 'object'
    ? '<p class="st-ctx-note">Last build measured ' + ctxNum(d.measured.tokens) + ' tokens.</p>'
    : '';
  return head + shapes + note + measured + '</div>';
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
// SEO & social — what the site says about itself WHERE IT IS NOT THE SITE: the
// Google result, the grey line under it, and the picture a chat app unfurls.
//
// WHAT STOOD HERE UNTIL 2026-09-12 was eleven lines of hardcoded markup that
// stated three false facts about the customer's own site (owner, shown the tab:
// "WHAT IS THIS"). It drew the title as `<name> — built with Go Farther`, a
// suffix NO SITE HAS EVER SERVED; it drew a sentence of grey prose that reads as
// an empty field on a site with a perfectly good description; and it offered
// "Generate · soon" for a 1200×630 card that is composed on every build and has
// been live the whole time. Measured on `hebden-bike-repair` the same day: the
// served page answers `<title>Hebden Bike Repair</title>`, a 158-character
// description, and `og:image` at a card that really is 1200×630.
//
// That is worse than the dead controls this repo already tracks. A dead control
// does nothing; this one answered a question, wrongly, about somebody's own
// business — and the obvious next thought on reading it is "how do I get your
// branding off my title", about a thing that was never there.
//
// THE SHELL IS DRAWN SYNCHRONOUSLY AND FILLED BY `loadSiteSeo`, the Analytics
// tab's own split: `renderSites` composes markup, so a panel that has to ask the
// server draws its frame first and its answer when it arrives. THE SHELL HOLDS
// NO FIELDS AT ALL until then, rather than disabled ones carrying a guess — a
// box with a plausible wrong value in it is what this tab is being rebuilt for.

// THE BROWSER'S HALF OF `site-head-edit.mjs`, and it is a SECOND COPY because
// chat.js is a classic script and cannot import a module. That is this repo's
// recorded "two lists of the same thing", so the two are held equal by a guard
// rather than by habit: `test/site-seo.test.mjs` reads both numbers out of both
// files and drives both length readers over the same inputs.
const ST_SEO_MAX = 300;                     // = MAX_HEAD_DESCRIPTION
const ST_SEO_GOOD = { min: 50, max: 160 };  // = GOOD_DESCRIPTION
/**
 * How long is this description, and is that a good length?
 *
 * The twin of `describeLength`, plus the counter's own words. ADVISORY: it
 * colours a label and refuses nothing — a description outside the band is a
 * worse listing, not an invalid one, and this file's own rule is that a false
 * alarm is worse than a miss.
 *
 * `''` IS ITS OWN STATE, never `short`: a site with no description and a site
 * with a six-word one need different sentences, because one is missing a thing
 * and the other has a weak version of it.
 */
function stSeoLength(value) {
  const n = String(value || '').length;
  if (!n) return { state: 'empty', label: 'Nothing yet' };
  if (n < ST_SEO_GOOD.min) return { state: 'short', label: n + ' characters — on the short side' };
  if (n > ST_SEO_GOOD.max) return { state: 'long', label: n + ' characters — Google shows about ' + ST_SEO_GOOD.max };
  return { state: 'good', label: n + ' characters' };
}
function moreSeo(site) {
  return '<div class="st-panel" id="stSeoPanel"><div class="st-panel-head"><h3>SEO &amp; social</h3></div>' +
    '<p class="sp-intro">What your site looks like in a Google result and when its link is pasted into WhatsApp, Slack or a post. None of this shows on the page itself.</p>' +
    '<div class="st-seo-load" id="stSeoLoad">Reading your site…</div>' +
    // NO CLASS ON THE BODY, because it needs no rule: the fields inside carry
    // their own, and `hidden` does the one thing this box does. A class the
    // stylesheet never paints is decoration nothing can see, and the guard
    // beside this derives the panel's classes and asks the sheet for each —
    // which is how this one was found, on its first run.
    '<div id="stSeoBody" hidden></div>' +
  '</div>';
}
/**
 * The tab's real contents, once the server has answered.
 *
 * ONE FETCH FOR THE WHOLE TAB. The four facts live in three stores — the name
 * and the description in the site's config, the chosen file beside them, the
 * RESOLVED picture through the platform's precedence, and the uploads in R2 —
 * and four round trips from here would each have their own failure and their own
 * half-drawn panel.
 */
async function loadSiteSeo(site) {
  const slug = site.slug || '';
  const panel = document.getElementById('stSeoPanel');
  if (!panel || !slug) return;
  const loadEl = panel.querySelector('#stSeoLoad');
  const bodyEl = panel.querySelector('#stSeoBody');
  let d = null;
  try {
    const r = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/seo');
    d = await r.json().catch(() => null);
    if (!r.ok || !d || !d.ok) throw new Error('bad');
  } catch (e) {
    // SAYS WHICH IT IS. "Couldn't read" is a transient thing to retry; drawing
    // empty fields would invite somebody to save over a description they cannot
    // currently see, which is the mockup's own failure wearing a network error.
    loadEl.textContent = 'Couldn’t read your site’s settings just now — try again in a moment.';
    return;
  }
  loadEl.hidden = true;
  bodyEl.hidden = false;

  // The address, for the Google preview's breadcrumb line. `liveUrl` is what the
  // site list already carries; the slug's own address is the fallback, and it is
  // the same shape `publicUrlFor` produces server-side.
  const addr = String(site.liveUrl || ('https://' + slug + '.gofarther.app/')).replace(/\/+$/, '');
  const host = (() => { try { return new URL(addr).host; } catch (e) { return slug + '.gofarther.app'; } })();

  const draw = () => {
    const desc = String(d.description || '');
    const len = stSeoLength(desc);
    bodyEl.innerHTML =
      // ── THE TITLE, READ-ONLY AND SAID SO ────────────────────────────────
      // It is the BUSINESS'S NAME, not a page title: the same value paints the
      // site's own header, the composed share card and `og:site_name`. A box
      // here that changed only the `<title>` would leave Google calling the
      // business one thing while its own header called it another, so the door
      // is the `brand` edit lane, which moves all four together.
      '<div class="st-field"><label>Title</label>' +
        '<div class="st-inp st-seo-ro">' + esc(d.title || site.name || 'Your site') + '</div>' +
        '<span class="st-seo-hint">This is your site’s name — it’s also on the header and the share card. Ask in the chat to change it.</span>' +
      '</div>' +
      // ── THE DESCRIPTION, EDITABLE AND LIVE ──────────────────────────────
      '<div class="st-field"><label for="stSeoDesc">Description</label>' +
        '<textarea class="st-in st-seo-desc" id="stSeoDesc" rows="3" maxlength="' + ST_SEO_MAX + '" placeholder="One sentence about the business, for search results and shared links.">' + esc(desc) + '</textarea>' +
        '<div class="st-seo-row">' +
          '<span class="st-seo-count st-seo-' + esc(len.state) + '" id="stSeoCount">' + esc(len.label) + '</span>' +
          '<button type="button" class="st-publish" id="stSeoSave" disabled>Save</button>' +
          '<span class="st-seo-said" id="stSeoSaid"></span>' +
        '</div>' +
      '</div>' +
      // ── THE PREVIEWS, which are the whole reason to open this tab ────────
      // Most owners have never seen their own share card and do not know one
      // exists. Showing the two places this text actually appears is most of
      // the value here; the fields above are the smaller half.
      '<div class="st-field"><label>How it looks</label>' +
        '<div class="st-seo-previews">' +
          '<div><span class="st-seo-prev-k">Google</span>' +
            '<div class="st-seo-g">' +
              '<div class="st-seo-g-url">' + esc(host) + '</div>' +
              '<div class="st-seo-g-t">' + esc(d.title || site.name || 'Your site') + '</div>' +
              '<div class="st-seo-g-d">' + (desc ? esc(desc) : '<i>No description — Google will pick its own words off the page.</i>') + '</div>' +
            '</div>' +
          '</div>' +
          '<div><span class="st-seo-prev-k">Shared link</span>' +
            '<div class="st-seo-card">' +
              (d.image
                ? '<img class="st-seo-card-img" src="' + esc(d.image) + '" alt="" loading="lazy">'
                : '<div class="st-seo-card-img st-seo-card-none">no picture</div>') +
              '<div class="st-seo-card-tx"><b>' + esc(d.title || site.name || 'Your site') + '</b>' +
                '<span>' + (desc ? esc(desc) : 'No description') + '</span>' +
                '<i>' + esc(host) + '</i>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      // ── THE PICTURE ─────────────────────────────────────────────────────
      // `share` is the CHOICE and `image` is what actually serves, and they are
      // drawn apart on purpose: empty `share` with a live `image` is the
      // ordinary state — nobody has chosen, and the card the build composed is
      // what a chat app unfurls. Collapsing the two is how the old mockup drew
      // "no image" over a site that had one.
      '<div class="st-field"><label>Social image</label>' +
        // THREE CASES, BECAUSE THERE ARE THREE. Chosen; nothing chosen and the
        // platform's card serving; and nothing chosen and NOTHING serving —
        // which happens on a site published before the card existed, or one
        // whose card write failed. Saying "using the card made for you" over
        // that third state is the mockup's own mistake in a new place: an
        // absence the panel narrates as a presence.
        '<span class="st-seo-hint">' + (d.share
          ? 'Using your picture — <b>' + esc(d.share) + '</b>.'
          : d.image
            ? 'Using the card made for you when the site was built.'
            : 'No picture yet — a shared link shows just the name. Pick one below, or your card appears at your site’s next change.') + '</span>' +
        '<div class="st-seo-pick" id="stSeoPick">' +
          '<button type="button" class="st-seo-opt' + (d.share ? '' : ' on') + '" data-share="">' +
            '<span class="st-seo-opt-ph">' + ic('image', 16) + '</span><span>The built card</span></button>' +
          (d.uploads || []).map((u) =>
            '<button type="button" class="st-seo-opt' + (d.share === u.name ? ' on' : '') + '" data-share="' + esc(u.name) + '">' +
              '<img src="/u/' + esc(slug) + '/' + esc(u.name) + '" alt="" loading="lazy"><span>' + esc(u.name) + '</span></button>').join('') +
        '</div>' +
        ((d.uploads || []).length ? '' : '<span class="st-seo-hint">Upload a picture by attaching it in the chat, and it shows up here to choose.</span>') +
      '</div>';

    const descEl = bodyEl.querySelector('#stSeoDesc');
    const saveEl = bodyEl.querySelector('#stSeoSave');
    const countEl = bodyEl.querySelector('#stSeoCount');
    const saidEl = bodyEl.querySelector('#stSeoSaid');
    // SAVE IS DEAD UNTIL SOMETHING CHANGED. A button that is always live invites
    // a write that stores what is already stored — a publish-shaped no-op the
    // owner then has to wonder about.
    const sync = () => {
      const v = descEl.value;
      const l = stSeoLength(v.replace(/\s+/g, ' ').trim());
      countEl.textContent = l.label;
      countEl.className = 'st-seo-count st-seo-' + l.state;
      saveEl.disabled = v.replace(/\s+/g, ' ').trim() === String(d.description || '');
      saidEl.textContent = '';
    };
    descEl.oninput = sync;
    saveEl.onclick = async () => {
      const next = descEl.value.replace(/\s+/g, ' ').trim();
      saveEl.disabled = true;
      saidEl.textContent = 'Saving…';
      try {
        const r = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/seo', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: next }),
        });
        const o = await r.json().catch(() => ({}));
        if (!r.ok || !o.ok) { saidEl.textContent = o.error || 'Couldn’t save that.'; saveEl.disabled = false; return; }
        d.description = o.description;
        // SAYS WHICH OF THE TWO HAPPENED. The sidecar patch IS the deployment,
        // so the ordinary answer is that it is already live; a failed patch
        // means the words appear at the site's next publish instead, which is a
        // delay rather than a loss and is worth saying rather than glossing.
        saidEl.textContent = o.live ? 'Saved — live on your site now.' : 'Saved — it shows at your site’s next change.';
        draw();
      } catch (e) { saidEl.textContent = 'Lost the connection — try again.'; saveEl.disabled = false; }
    };
    bodyEl.querySelectorAll('[data-share]').forEach((b) => b.onclick = async () => {
      const want = b.getAttribute('data-share') || '';
      if (want === String(d.share || '')) return;
      // THROUGH THE SHARE ROUTE, not a second copy of it. That one validates the
      // name against this site's own live uploads, refuses a stranger's file and
      // refuses a document, and recomputes the sidecar through the one reader of
      // the precedence. Re-implementing any of that here is how the two drift.
      try {
        const r = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/share', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: want || null }),
        });
        const o = await r.json().catch(() => ({}));
        if (!r.ok || !o.ok) { if (typeof sbToast === 'function') sbToast(o.error || 'Couldn’t change the picture.'); return; }
        d.share = o.share || '';
        // RE-READ RATHER THAN ASSUMED. The picture that SERVES is the
        // precedence's answer, not the file just chosen — clearing the choice
        // falls back to the built card, and only the server knows whether one
        // exists. Guessing here is how a panel shows a picture the unfurl does
        // not have.
        try {
          const rr = await apiFetch('/api/site/' + encodeURIComponent(slug) + '/seo');
          const dd = await rr.json().catch(() => null);
          if (rr.ok && dd && dd.ok) d = dd;
        } catch (e) { /* the choice is stored either way */ }
        draw();
        if (typeof sbToast === 'function') sbToast(o.live ? 'Picture changed — live now.' : 'Picture changed — it shows at the next publish.');
      } catch (e) { if (typeof sbToast === 'function') sbToast('Lost the connection — try again.'); }
    });
  };
  draw();
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
  // AND IF THAT LIST IS SHORT, ASK THE SERVER WHAT PAGES THIS SITE REALLY HAS.
  // Fire-and-forget and re-renders when it lands — `sitesFetchRemote`'s own
  // pattern in `renderSites`, and for the same reason: this function is
  // synchronous, so the first paint is still the list this browser holds and
  // nothing waits on the network. Gated on the list being short because that is
  // the only state the answer can improve; a browser that built the site already
  // has the real list and must not spend a request per render to confirm it.
  if (pages.length <= 1) siteRoutesFetch(site);
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
          // EVERYTHING ELSE ON THIS SIDE IS PREVIEW-ONLY TOO (2026-09-13, owner
          // on a crop of exactly these four: "THIS STUFF SHOULD ONLY BE THERE ON
          // PREVIEW ONLY"). The widths, the download, Share and Publish — none
          // of them says anything about the Code, Data or More tabs, and on
          // those screens they are four controls describing something that is
          // not on the screen.
          //
          // IT WEARS `st-tb-pv-off`, THE SAME CLASS THE PICKER AND RELOAD WEAR,
          // and the class is the hard-won part rather than the markup. It is
          // `visibility: hidden`, NEVER `display: none`, because both side
          // groups are `flex: 1 1 0` and split the bar between them: a block
          // REMOVED on a view change shrinks this group's min-content, the
          // difference comes out of the left group, and the centred tabs move at
          // every width. Three attempts were needed to learn that; reserving the
          // space is what makes the two sides measure the same in every view.
          // Hiding four more controls without reserving their space would have
          // reintroduced exactly the bug the class exists to prevent, and it
          // would have looked right in every source check.
          //
          // ONE WRAPPER, NOT FOUR CLASSES, because the space to reserve is the
          // GROUP's — four separately-hidden children still collapse the gaps
          // between them, and `.st-tb-right`'s own `gap` would close up.
          '<div class="st-tb-end' + (siteView === 'preview' ? '' : ' st-tb-pv-off') + '"' +
            (siteView === 'preview' ? '' : ' aria-hidden="true"') + '>' +
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
          // PUBLISH IS BACK, AS A DOOR (owner, 2026-09-12: "NEXT TO SHARE ADD A
          // PUBLISH BUTTON"). The notes below record its deletion on 2026-09-08
          // and they are kept, because what was deleted and what is here are not
          // the same control — reading them as the same is how this comes back
          // round a third time.
          //
          // WHAT WAS WRONG WITH THE OLD ONE WAS THE GATE, and it is the one
          // thing deliberately not restored. It was drawn `isReact ? '' : …`, so
          // it appeared ONLY on a project that had never built — the single
          // state where it had nothing to open — and vanished the moment the
          // site had an address worth showing. Both halves of it were therefore
          // unreachable code that read as live. This one is gated on
          // `site.slug`, exactly as the Visibility card is, for the same stated
          // reason: `siteSetLive` returns at once without a slug.
          //
          // AND IT IS NOT A DEAD CONTROL, which is the question to ask of
          // anything labelled Publish on a platform that publishes as part of
          // the build. `sitePublishPanel` has three working actions behind it —
          // the live URL as a real link, Copy link, and Take it offline / Put it
          // back online over `POST /api/site/<slug>/offline` — and one true
          // sentence saying every change goes live on its own. The panel stopped
          // being a liar in its own right on 2026-09-08: the Publish and
          // Republish buttons INSIDE it, which POSTed a route deleted on
          // 2026-07-27, went then.
          //
          // WHAT THIS BUYS is that the capability stops being three clicks deep.
          // Its only door since 2026-09-08 has been More → Cloud → Visibility,
          // and "take my site off the web" is not a thing anybody finds under a
          // card called Visibility on a tab called More.
          //
          // THE TITLE CARRIES THE HONESTY, because the label cannot: a button
          // reading Publish over a panel reading "there is nothing to publish"
          // is a contradiction the customer meets in one second, and the tooltip
          // is what resolves it before the click rather than after.
          //
          // DIMMED RATHER THAN HIDDEN before the first build, with the tooltip
          // saying what to do — the Download button's rule two lines up, and the
          // card icons' before it. Hiding a control is how a customer never
          // learns it is there.
          '<button type="button" class="st-publish" id="stPublish"' +
            (site.slug
              ? ' title="Your site is live — see its link, or take it off the web"'
              : ' disabled title="Build the first draft — your site goes live on its own"') +
            '>Publish</button>' +
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
              // THE CLASSIC LOG BOX WAS THE CLASSIC BUILD'S, and it took a react
              // build's thinking window with it once the gate above narrowed: the
              // painter returned early for a react build, so that div was one
              // nothing ever filled — a blank right-hand side where the invitation
              // used to be. It was gated off for a react build and is DELETED now
              // (2026-09-13), since every caller starts a react build, so a react
              // message of unknown shape reaches the invitation by construction.
              // A react build in `thinking` is a message we do not yet know the
              // shape of, so the panel stays exactly what it was before it was
              // sent.
              ? ('<div class="st-empty">' + (siteBusy && stBuildRunning() ? 'Building your site — this takes a minute or two…' : 'Describe your site on the left to build the first draft.') + '</div>')
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
          ? '<div class="st-msg a st-busy st-busy-react">' + reactLiveStepsHTML() + '</div>'
          : '<div class="st-msg a st-busy">Working</div>')
      : '');
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
    loadSiteFrame(fr, sitePreviewSrc(site, active && active.path));
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
  // SEO & social asks the server for the three real values it shows. Same hop as
  // Analytics one line up: `moreSeo` drew the frame while this function was
  // composing markup, and the answer fills it once it arrives.
  if (siteView === 'more' && siteMoreTab === 'seo' && site.slug) loadSiteSeo(site);
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
  // REFRESH RELOADS THE FRAME THE PANEL ACTUALLY DRAWS (2026-09-12, owner:
  // "WHAT DOES THIS BUTTON DOES ?" → "YES FIX IT").
  //
  // IT DID NOTHING ON ANY REAL SITE, and it read as correct from every angle
  // but the one that mattered. The handler was the STATIC-SITE version: it
  // called `loadSitePreview(curHtml)` — the stored-page-HTML path — behind
  // `if (f && curHtml)`, and a React site's pages are written with `html: ''`,
  // so the gate was false and the click fell straight through. Meanwhile the
  // render three hundred lines up points the frame at the LIVE site through
  // `loadSiteFrame`. Proven by driving the real line, not by reading it: with
  // `curHtml` empty it called nothing, with a stored page it called the legacy
  // loader.
  //
  // It is the same shape as the Publish button restored the same night, one
  // control to the left: a handler gated on the legacy path while the thing it
  // acts on moved to the React one. `isReact ? '' : …` there, `if (curHtml)`
  // here — the same sentence in different words, which is why neither was
  // spotted by reading.
  //
  // THE BUMP IS NOT COSMETIC. Assigning `fr.src` a value it already holds does
  // not reload an iframe, so without moving `previewV` this would have gone on
  // doing nothing — the right symptom fixed by the wrong cause, which this
  // panel has already cost three rounds of once.
  //
  // AND A REFRESH IS A FRESH PAGE LOAD, so the collected runtime errors go with
  // it and the badge repaints: the render's own rule on the branch below, which
  // says so in as many words. Keeping them would leave "Fix with AI" offering
  // errors from a page that is no longer on screen.
  //
  // The legacy branch is kept rather than deleted — a site still carrying
  // stored HTML is exactly what it is for, and it is the branch that has always
  // worked.
  const rl = document.getElementById('stReload');
  if (rl) rl.onclick = () => {
    const f = document.getElementById('stFrame');
    if (!f) return;
    if (isReact) {
      site.previewV = (site.previewV || 0) + 1;
      sitePreviewErrs[previewErrKey()] = [];
      loadSiteFrame(f, sitePreviewSrc(site, active && active.path));
      paintPreviewErrBadge();
    } else if (curHtml) {
      sitePreviewErrs[previewErrKey()] = [];
      loadSitePreview(f, curHtml, site.slug);
      paintPreviewErrBadge();
    }
  };
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
  // PUBLISH: the door to `sitePublishPanel` (owner, 2026-09-12: "NEXT TO SHARE
  // ADD A PUBLISH BUTTON"). The handler deleted on 2026-09-08 set the label to
  // "Live" or "Offline" as well as opening the panel — a SECOND copy of the
  // state the panel reads for itself, and the panel's copy is the better one
  // because it asks `SiteList.offlineFor`, which prefers the server's answer
  // over this browser's. The label is constant now and the panel is the one
  // place that says which face a site is wearing.
  //
  // NO STATE IS READ HERE AT ALL, deliberately: a bar that says "Live" has to
  // be repainted when the site goes offline, and this render is not the thing
  // that would notice.
  const pub = document.getElementById('stPublish');
  if (pub) pub.onclick = () => sitePublishPanel(site);
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
// THE CLASSIC ROTATING ACTIVITY LOG IS GONE (2026-09-13, the dead-code census).
// A `ST_TICK` table of phrases, `buildActiveText` and `paintBuildLog` drove a
// rotating "current step" line for the pre-React engine, behind `!siteBuild.react`
// — and `siteBuildStart` is CALLED WITH `true` FROM EVERY CALL SITE, so that
// field has been constant since the classic engine's own send path went. Dead by
// construction rather than by stored data, which is what separated this from the
// legacy-`html` branches the same census left standing.
//
// `react` STAYS ON THE OBJECT and stays a parameter. `stBuildRunning` reads it,
// and a parameter with one live value is only a second copy of that value while
// nothing can pass the other one — the guard derives the call sites and requires
// every one to pass `true`, so a classic caller coming back fails by existing
// rather than quietly re-arming a branch that is no longer there to take.
function siteBuildStart(react) {
  // STARTS IN `thinking`, NOT `generating`. This runs the instant a message is
  // sent — before the router has said whether it is even a build — and starting
  // at `generating` is what made "hey" paint "Writing the code".
  siteBuild = { react: !!react, code: '', file: '', rphase: 'thinking', images: [], filesSeen: [], agents: {}, startedAt: Date.now() };
  if (siteTicker) clearInterval(siteTicker);
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
    paintReactLive();
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
  siteBusy = false; siteBuildStop();
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
      // A CLOCK, NOT A COUNT (2026-09-14). `w.attempt > 400` summed to 53.0
      // minutes of this backoff curve — arithmetic nobody had done, near
      // enough to the job's own hold to look deliberate, and it would move
      // silently the day the curve changed. `shouldGiveUp` is the JOB's own
      // horizon (edit-poll.js, derived from the one duration setting), so the
      // page stops looking only once the job could not still be running.
      if (EditPoll.shouldGiveUp(w)) { w.stopped = 'gave-up'; finish('⚠️ I lost track of that edit. Reload to pick it back up.'); return; }
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
  // AND A JOB THAT WOULD NOT REGISTER, the same way (2026-09-14). The server
  // used to log that failure to a console nobody reads and leave the job on
  // `jobs`, so this line said "scheduled a reminder every day at 09:00" about
  // something that will never run. It names it in `jobErrors` now and takes it
  // off `jobs`, so the two lines can never both be about the same job.
  for (const je of (Array.isArray(a.jobErrors) ? a.jobErrors : []).slice(0, 3)) {
    if (!je || !je.name) continue;
    out += ' The scheduled job ' + je.name + ' couldn’t be set up' + (je.error ? ' — ' + String(je.error).slice(0, 140) : '') + ', so it won’t run yet.';
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
  // ── WHAT THE CHANGE STILL OWES (owner, 2026-09-13) ────────────────────────
  //
  // "Make unresolved requirements affect completion reporting."
  //
  // The server composes the sentence (`requirementNote`), because deciding what
  // is still outstanding needs the list AND which steps really ran, and this
  // file cannot import the module that knows. Printed VERBATIM: a second
  // composer here would be two sentences about one fact, and the one with the
  // facts is the server's.
  //
  // AFTER the "Done" clause and before the refusals, so the order reads as it
  // happened: what landed, then what did not. A `✅ Done.` with nothing after
  // it still means nothing was left over, which is what it has always meant.
  if (typeof a.coverNote === 'string' && a.coverNote) out += ' ' + a.coverNote;
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
  // THE MIDDLE ARM WAS UNREACHABLE AND IS GONE (2026-09-13, the dead-code census).
  // It read `else if (isBuild) siteBuildStart();` — the classic engine's own
  // start — and `reactPath` is `isBuild || site.react`, so reaching it needed
  // `!isBuild && isBuild`. Provably dead from this line alone, which is what let
  // the classic activity log go with it: nothing could ever start a build whose
  // `react` was false.
  if (reactPath) siteBuildStart(true); else siteBuildStop();
  sitesSave();
  renderSites();
  const origin = siteOpenId;
  const finish = (reply) => {
    siteBusy = false;
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
// Every view this app has. `showView` falls back to the builder for anything
// else — including a remembered value from before the media side was deleted,
// which is the case that would otherwise paint a blank main: a refresh-proof
// preference outlives the view it names.
const KNOWN_VIEWS = ['sites', 'settings', 'agents'];
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
  // OPENING THE VIEW ASKS THE SERVER. `renderAgents` alone would paint whatever
  // the last read left — which on a first open is "Loading…" for ever, and after
  // a delete on another machine is a row for an agent that is gone.
  if (name === 'agents') { renderAgents(); agentsLoad(agentRows !== null); }
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
  'agent-new': () => agentNew(),
  'agent-open': (e, el) => agentOpen(el.dataset.id),
  'agent-save': () => agentSave(),
  'agent-cancel': () => agentCancel(),
  'agent-delete': (e, el) => agentDelete(el.dataset.id),
  'agent-edit': (e, el) => agentEdit(el.dataset.id),
  'agent-list': () => agentList(),
  'agent-send': () => agentSend(),
  'agent-import': () => agentImport(),
  'agent-reload': () => agentReload(),
  'agent-thread-retry': (e, el) => agentThreadRetry(el.dataset.id),
  'agent-automations': (e, el) => agentAutomations(el.dataset.id),
  'agent-connections': (e, el) => agentConnections(el.dataset.id),
  'agent-webhooks': (e, el) => agentWebhooks(el.dataset.id),
  'agent-wh-back': () => agentWhBack(),
  'agent-wh-new': () => agentWhNewOpen(),
  'agent-wh-cancel': () => agentWhCancel(),
  'agent-wh-reload': () => agentWhReload(),
  'agent-wh-save': () => agentWhSave(),
  // ⚠ THE FLAG COMES OFF THE BUTTON'S OWN ATTRIBUTE, not off the row read again: the row
  // this was drawn from is what the person looked at, and re-reading it could answer a state
  // the poll has since changed — so the press would toggle the opposite way from what it said.
  'agent-wh-enable': (e, el) => agentWhEnable(el.dataset.id, el.dataset.on === '1'),
  'agent-wh-delete': (e, el) => agentWhDelete(el.dataset.id),
  'agent-wh-secret-done': () => agentWhSecretDone(),
  'agent-wh-held-show': () => agentWhHeldShow(),
  'agent-wh-run': (e, el) => agentWhOpenRun(el.dataset.auto, el.dataset.run),
  'agent-conn-back': () => agentConnBack(),
  'agent-conn-new': () => agentConnNewOpen(),
  'agent-conn-cancel': () => agentConnCancel(),
  'agent-conn-save': () => agentConnSave(),
  'agent-conn-off': (e, el) => agentConnDisconnect(el.dataset.id),
  'agent-conn-reload': () => agentConnReload(),
  'agent-auto-back': () => agentAutoBack(),
  'agent-auto-new': () => agentAutoNew(),
  'agent-auto-example': () => agentAutoExample(),
  'agent-auto-edit': (e, el) => agentAutoEdit(el.dataset.id),
  'agent-auto-cancel': () => agentAutoCancel(),
  'agent-auto-save': () => agentAutoSave(),
  'agent-auto-check': () => agentAutoCheckNow(),
  'agent-auto-delete': (e, el) => agentAutoDelete(el.dataset.id),
  'agent-auto-toggle': (e, el) => agentAutoToggle(el.dataset.id, el.dataset.on),
  'agent-auto-run': (e, el) => agentAutoRunPress(el.dataset.id),
  'agent-auto-history': (e, el) => agentAutoHistory(el.dataset.id),
  'agent-auto-reload': () => agentAutoReload(),
  'agent-auto-step-add': (e, el) => agentAutoStepAdd(el.dataset.type),
  'agent-auto-step-up': (e, el) => agentAutoStepMove(el.dataset.at, -1),
  'agent-auto-step-down': (e, el) => agentAutoStepMove(el.dataset.at, 1),
  'agent-auto-step-del': (e, el) => agentAutoStepDrop(el.dataset.at),
  'agent-auto-input-add': () => agentAutoInputAdd(),
  'agent-auto-input-up': (e, el) => agentAutoInputMove(el.dataset.at, -1),
  'agent-auto-input-down': (e, el) => agentAutoInputMove(el.dataset.at, 1),
  'agent-auto-input-del': (e, el) => agentAutoInputDrop(el.dataset.at),
  'agent-auto-ask-go': () => agentAutoAskGo(),
  'agent-auto-ask-cancel': () => agentAutoAskCancel(),
  'agent-auto-approve': (e, el) => agentAutoDecide(el.dataset.run, 'approved'),
  'agent-auto-reject': (e, el) => agentAutoDecide(el.dataset.run, 'rejected'),
  'agent-auto-stop': (e, el) => agentAutoStop(el.dataset.run),
  // ⚠ NOT THE TWO ABOVE. Those answer an approval STEP in a workflow; these answer one
  // TOOL CALL a model made in a conversation. Two different things, and a screen that
  // sent one where the other was meant would answer somebody else's question.
  'agent-tool-approve': (e, el) => agentApprovalAct(el.dataset.id, 'approved'),
  'agent-tool-reject': (e, el) => agentApprovalAct(el.dataset.id, 'rejected'),
  'agent-tool-withdraw': (e, el) => agentApprovalAct(el.dataset.id, 'withdrawn'),
  // ⚠ THE TOOL COMES OFF THE ROW'S OWN ATTRIBUTE for a restore, and off the PICKER for a
  // take — in both cases what was on screen when somebody pressed, never a re-read of the
  // list, which a poll or a re-read could have changed in between.
  'agent-revoke-back': (e, el) => agentRevokeAct(el.dataset.tool, 'restore'),
  'agent-revoke-take': () => {
    const pick = document.getElementById('agRevPick');
    agentRevokeAct(pick ? pick.value : '', 'take');
  },
  // ── reference material and memory ─────────────────────────────────────────
  'agent-knows': (e, el) => agentKnows(el.dataset.id),
  'agent-know-back': () => agentKnowBack(),
  'agent-know-new': () => agentKnowNew(),
  'agent-know-edit': (e, el) => agentKnowEdit(el.dataset.id),
  'agent-know-cancel': () => agentKnowCancel(),
  'agent-know-save': () => agentKnowSave(),
  'agent-know-delete': (e, el) => agentKnowDelete(el.dataset.id),
  'agent-mem-save': () => agentMemSave(),
  'agent-mem-edit': (e, el) => agentMemEdit(el.dataset.key, el.dataset.value),
  'agent-mem-delete': (e, el) => agentMemDelete(el.dataset.key),
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
const CHANGE_ACTIONS = {
  // THE SCHEDULE CHOICE REDRAWS, because picking "every day" has to reveal the time and
  // the zone. Everything else in this form is read at Save — a redraw per keystroke is
  // the twitch the read-first door exists to remove.
  'agent-auto-sched': () => agentAutoStructural((draft) => draft),
  // ⚠ **A STEP'S CHOICE REDRAWS TOO, AND WITHOUT THIS LINE IT WAS A DEAD CONTROL THAT
  // ANSWERED.** The markup has carried `data-change="agent-auto-step-field"` since the
  // choice fields were written and NOTHING WAS BOUND TO THAT NAME — measured, one
  // occurrence in the file and none in this table — so picking "until a time" on a wait
  // changed the select and redrew nothing: no time box appeared, Save then sent a `mode`
  // with no `at`, and the server refused it naming a control that was not on the screen.
  // Every field whose `when` names a choice is in this position, which is the wait's two
  // and the comparison's third box.
  //
  // STRUCTURAL, because that is exactly what it is: which controls EXIST changes, so the
  // read-first door has to run before the redraw or the answer just picked is read back off
  // the older form. `agentAutoValues` reads the select itself, so nothing has to be passed
  // in — the mutation is the identity and the generation bump is the whole of the work.
  'agent-auto-step-field': () => agentAutoStructural((draft) => draft),
  /**
   * ⚠ **PICKING A PROVIDER CHANGES WHICH PERMISSIONS EXIST, so it has to redraw.** Each
   * provider offers its own, and a form that kept the old ticks would let somebody grant a
   * permission the new provider has never heard of — which `cleanScopes` then refuses, naming
   * a control that is no longer on the screen. This is the `agent-auto-step-field` defect one
   * form over, and it is bound rather than left to be found.
   */
  'agent-conn-provider': () => {
    agentConnFormRead();
    // A FORM THAT IS NO LONGER THERE LEAVES THE DRAFT ALONE rather than throwing: the change
    // can only have come from a control that existed, but a redraw can land between the event
    // and this line, and `null.scopes` is a screen that stops working.
    if (agentConnDraft) agentConnDraft.scopes = [];
    renderAgents();
  },
};
const INPUT_ACTIONS = {
  // TYPED WORDS ARE THE DRAFT, IMMEDIATELY — not on Send. A poll re-render reads the
  // box too (`agentComposerRead`), and the redundancy is deliberate: this covers the
  // instant an answer lands from anywhere else, that covers a browser which gave us
  // no input event. NO RE-RENDER HERE — redrawing the panel on every keystroke would
  // be the twitch this whole wrapper exists to remove.
  'agent-msg': (e, el) => { agentDraftSet((el.getAttribute && el.getAttribute('data-agent')) || '', el.value); },
  // THE CONNECT FORM'S OWN BOXES. Read back into the draft as they are typed, so a redraw
  // from anywhere else cannot eat them — and NO RE-RENDER, for the same reason as above.
  // ⚠ DRAWS NOTHING, like every other input hook here: a re-render per keystroke is the
  // twitch those hooks exist to remove. What it is for is that this box lives inside a form
  // something else redraws, so words only in the DOM are words a redraw can take.
  'agent-revoke-why': (e, el) => { agentRevokeWhy = el ? (el.value || '') : ''; },
  'agent-conn': () => agentConnFormRead(),
  // THE ARRIVAL-ADDRESS FORM'S TWO BOXES, read back into the draft as they are typed, for
  // the same reason and with the same NO RE-RENDER: a redraw from anywhere else must not
  // eat what is in them, and a redraw per keystroke is the twitch that would replace.
  'agent-wh': () => agentWhFormRead(),
  /**
   * ⚠ **THE AUTOMATION FORM, AND THE REDRAW IS CONDITIONAL — that is the whole of this entry.**
   *
   * Typing here used to reach nothing at all: no box in this form carries a change hook, so a
   * step's text could be edited under a panel still saying the workflow was fine. Clearing the
   * answer without redrawing would leave the stale sentence on screen; redrawing on every
   * keystroke is the twitch the read-first door exists to remove. So the words go into the draft
   * immediately, and the panel is rewritten ONLY when what it says has stopped being true — which
   * is once per answer, and never while there is no answer on screen to invalidate.
   *
   * `renderAgents` is safe to call from a keystroke because it already puts the cursor back
   * (`agentFocusRead`/`agentFocusRestore`); without that this would take somebody's caret away
   * mid-word, which is worse than the sentence it removes.
   */
  'agent-auto-form': () => {
    const said = agentAutoSays();
    agentAutoFormRead();
    if (agentAutoSays() !== said) renderAgents();
  },
};
const KEYDOWN_ACTIONS = {
  'agent-send-key': (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); agentSend(); }
  },
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

