// page-recipes.mjs — the INSTRUCTION BOOKLET for the component kit.
//
// The kit gives the model 258 parts. Nothing told it what to BUILD with them, so it re-derived the shape of a
// "list page" from scratch on every build — and arrived somewhere slightly different each time. A recipe is a
// short, ordered skeleton for one KIND of page: which components, in which order, and the states that must be
// handled. It is a starting point, not a straitjacket; the model still writes the page.
//
// Recipes are SELECTED, never hand-assigned. There are 279 capabilities and picking a layout for each by hand
// would rot immediately — so `recipeFor` reads the capability's own route shape (does it read? create? delete?
// is it public?) and infers the page kind. Add a capability and it gets the right recipe for free.
//
// Every component named below is checked against the real kit by builder/check-kit.mjs, so a recipe cannot
// quietly reference something that no longer exists — the exact drift that produced three bugs.

const has = (cap, method) => (cap.routes || []).some((r) => r.method === method);
const pathText = (cap) => (cap.routes || []).map((r) => r.path + ' ' + (r.desc || '')).join(' ');
const isPublic = (cap) => (cap.access || []).includes('public');
const idText = (cap) => `${cap.id || ''} ${cap.title || ''} ${cap.summary || ''}`.toLowerCase();

export const RECIPES = [
  {
    id: 'booking',
    title: 'Booking / scheduling page',
    when: (c) => /book|appoint|reserv|slot|schedul|calendar|class|session/.test(idText(c)),
    skeleton: [
      'PageHeader — title + what is being booked',
      'BookingWidget — date + time + confirm, wired to the create endpoint',
      'ReservationSummary — shown after a successful booking, with the reference',
      'EmptyState — when no slots are available',
    ],
    notes: 'TimeSlots and Calendar are already inside BookingWidget — do not rebuild them.',
  },
  {
    id: 'checkout',
    title: 'Checkout flow',
    when: (c) => /checkout|cart|payment|order|basket/.test(idText(c)) && has(c, 'POST'),
    skeleton: [
      'Stepper — the checkout stages',
      'AddressForm — shipping (and billing if different)',
      'ShippingOptions — delivery method',
      'PaymentForm — card fields',
      'OrderSummary — line items and totals, sticky beside the form',
      'PromoCodeInput — inside the summary',
    ],
    notes: 'Never POST raw card numbers to the app backend; wire PaymentForm to the provider tokenizer.',
  },
  {
    id: 'feed',
    title: 'Social feed',
    when: (c) => /post|feed|comment|discussion|forum|social|timeline/.test(idText(c)),
    skeleton: [
      'PostComposer — at the top, for signed-in users',
      'FeedPost — one per item, mapped over the list',
      'ReactionBar and CommentList — inside each post where relevant',
      'Skeleton while loading; EmptyState when the feed is empty',
    ],
  },
  {
    id: 'article',
    title: 'Long-form / docs page',
    when: (c) => /article|blog|post|doc|guide|knowledge|help|faq/.test(idText(c)) && !has(c, 'DELETE'),
    skeleton: [
      'ArticleHeader — category, title, standfirst, byline',
      'Prose — wraps the body ONCE (never style headings by hand)',
      'TableOfContents — sticky beside the body on wide screens',
      'FeedbackWidget then RelatedPosts at the foot',
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard / analytics page',
    when: (c) => /summary|stats|report|analytic|metric|overview/.test(pathText(c) + idText(c)),
    skeleton: [
      'DashboardShell — the page frame',
      'StatRow — the KPI strip across the top',
      'ChartPanel — the main trend, with a range switcher',
      'TopList or ActivityFeed — the supporting detail',
      'Skeleton placeholders while the figures load',
    ],
  },
  {
    id: 'crud-list',
    title: 'Records list with detail + delete',
    when: (c) => has(c, 'GET') && has(c, 'DELETE'),
    skeleton: [
      'useResource(<table>) for the data — data / loading / error / create / update / remove',
      'PageHeader — title + a primary "New …" action',
      'SearchFilterBar — search and any filters, above the table',
      'DataTable — the records, with StatusPill in the status column',
      'Drawer or Modal — the detail / edit form for a clicked row',
      'ConfirmDialog — ALWAYS before a delete',
      'EmptyState when there are no records; Skeleton while loading',
    ],
    notes: 'DataTable has loading and empty states built in — pass `loading` rather than branching by hand. useResource refreshes the list after every write; do not refetch by hand.',
  },
  {
    id: 'list-create',
    title: 'Records list with an add form',
    when: (c) => has(c, 'GET') && has(c, 'POST'),
    skeleton: [
      'useResource(<table>) for the data — data / loading / saving / create',
      'PageHeader — title + a primary "Add …" action',
      'DataTable or a card grid for the records',
      'Modal containing FormSection + fields + FormActions for the add form',
      'EmptyState when there are no records; Skeleton while loading',
    ],
    notes: 'Await create(values) and close the modal on success; the list refreshes itself. Bind the submit button to `saving`.',
  },
  {
    id: 'capture-form',
    title: 'Public capture form',
    when: (c) => isPublic(c) && has(c, 'POST') && !has(c, 'GET'),
    skeleton: [
      'A short intro — PageHeader, or Hero on a landing-style page',
      'FormSection + Input / Textarea / Select for the fields',
      'FormActions with a single primary submit Button',
      'Alert (tone="success") on submit; inline field errors on failure',
    ],
    notes: 'Disable the submit button while in flight and re-enable on error, so nothing double-submits.',
  },
  {
    // Admin-side POST-only tools: bulk import, a validator, a generator. Not a public capture form — the
    // shape is pick input → run → show the result, with the outcome mattering more than the form.
    id: 'tool-form',
    title: 'Admin tool / action page',
    when: (c) => has(c, 'POST') && !has(c, 'GET') && !isPublic(c),
    skeleton: [
      'PageHeader — what the tool does',
      'FileDropzone for an upload, or FormSection + fields for parameters',
      'A primary Button that runs it, disabled while in flight',
      'Alert or DataTable showing the RESULT — rows imported, errors found',
    ],
    notes: 'Report per-row failures rather than one blanket error; a bulk action that half-worked must say which half.',
  },
  {
    id: 'read-only',
    title: 'Read-only listing',
    when: (c) => has(c, 'GET'),
    skeleton: [
      'useResource(<table>) for the data — read `data`, `loading`, `error`',
      'PageHeader',
      'SearchFilterBar if the list can get long',
      'A card grid (ListingCard / ProductCard / EventCard) or DataTable',
      'Pagination when the list is paged; EmptyState when empty',
    ],
  },
];

// Non-capability pages the builder always produces.
export const FIXED_RECIPES = {
  Home: {
    id: 'landing',
    title: 'Landing page',
    skeleton: [
      'Hero — the product thesis, with a primary CTA',
      'FeatureGrid or BentoGrid — what it does (BentoGrid when the section needs hierarchy)',
      'HowItWorks — the process, if there is one',
      'TestimonialGrid / LogoCloud — proof',
      'PricingTable — if the product is paid',
      'FAQSection then CTASection to close',
    ],
    notes: 'Compose from section blocks; do NOT hand-roll marketing sections out of divs.',
  },
  SignIn: {
    id: 'auth',
    title: 'Sign in / sign up',
    skeleton: [
      'AuthCard — the centred shell',
      'SocialAuthButtons — if the app supports providers',
      'Input for email and PasswordInput for password (showStrength on sign-up)',
      'A full-width primary Button, and an Alert for auth errors',
    ],
    notes: 'Use useAuth() from lib/auth — never hand-roll the session.',
  },
  Admin: {
    id: 'admin',
    title: 'Admin console',
    skeleton: [
      'DashboardShell or SettingsLayout as the frame',
      'Tabs — one per managed resource',
      'DataTable per resource, with BulkActionBar for multi-select',
      'ConfirmDialog before every destructive action',
    ],
  },
};

// recipeFor(capability) → the first matching recipe, or null. Order matters: specific kinds are listed before
// the generic CRUD ones, so "booking" wins over "list with delete".
export function recipeFor(cap) {
  if (!cap) return null;
  return RECIPES.find((r) => { try { return r.when(cap); } catch { return false; } }) || null;
}

// recipeForName(pageName) — the fallback when a page has NO registry entry. The planner accepts free-text
// capabilities (a brief asking for "invoices" produces an Invoices page with no matching capability), and
// those were getting no shape at all — the very case recipes exist to fix. Match on the name's own words,
// then fall back to the commonest shape, a records list.
export function recipeForName(name) {
  const fixed = FIXED_RECIPES[name];
  if (fixed) return fixed;
  const fake = { id: String(name || '').toLowerCase(), title: '', summary: '', access: [], routes: [{ method: 'GET' }, { method: 'POST' }, { method: 'DELETE' }] };
  return recipeFor(fake) || RECIPES.find((r) => r.id === 'crud-list') || null;
}

// recipeForPage(name) → the fixed recipe for Home / SignIn / Admin.
export function recipeForPage(name) {
  return FIXED_RECIPES[name] || null;
}

// renderRecipe(recipe) → the compact block injected into a page prompt. Kept short on purpose: this rides along
// with every page step, so it earns its tokens by replacing structure the model would otherwise invent.
export function renderRecipe(recipe) {
  if (!recipe) return '';
  return `  SHAPE (${recipe.title}) — a starting point, adapt it to the brief:\n` +
    recipe.skeleton.map((s) => `    · ${s}`).join('\n') +
    (recipe.notes ? `\n    NOTE: ${recipe.notes}` : '');
}

// Every component name a recipe mentions, for the kit check to validate against the real kit.
// Quoted text is button COPY, not a component — `a primary "New …" action` must not read as a <New> component.
export function componentsNamedInRecipes() {
  const names = new Set();
  const scan = (r) => {
    for (const line of r.skeleton) {
      const withoutCopy = line.replace(/"[^"]*"/g, '').replace(/`[^`]*`/g, '');
      for (const m of withoutCopy.matchAll(/\b([A-Z][A-Za-z0-9]+)\b/g)) names.add(m[1]);
    }
  };
  RECIPES.forEach(scan);
  Object.values(FIXED_RECIPES).forEach(scan);
  return [...names];
}
