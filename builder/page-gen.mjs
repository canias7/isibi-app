// The page generator's model-facing half — the rules it writes against, the
// tool it fills in, and the deterministic checks its output has to survive.
//
// Kept out of worker.js on purpose: this is plain, dependency-free JavaScript,
// so it can be imported and tested outside the Worker (see test/page-gen.test.mjs)
// the same way site-schema.mjs and site-data.mjs are.
//
// The contract itself is builder/GENERATOR.md, and the page it is derived from is
// builder/lovable/template/src/routes/index.tsx. Both are reproduced here because
// the Worker has no filesystem; a test asserts this copy has not drifted from the
// file, and GENERATOR.md's rule stands — when the two disagree, the file wins.


// Generated from the component files by builder/gen-component-api.mjs. Kept in
// step by test/component-api.test.mjs, which regenerates and compares.
import { COMPONENT_API } from "./component-api.mjs";
/** Every component in src/components/ui. An import of anything else does not resolve. */
export const UI_COMPONENTS = [
  "accordion", "alert-dialog", "alert", "aspect-ratio", "avatar", "badge", "breadcrumb",
  "button", "calendar", "card", "carousel", "chart", "checkbox", "collapsible", "command",
  "context-menu", "dialog", "drawer", "dropdown-menu", "form", "hover-card", "input-otp",
  "input", "label", "menubar", "navigation-menu", "pagination", "popover", "progress",
  "radio-group", "resizable", "scroll-area", "select", "separator", "sheet", "sidebar",
  "skeleton", "slider", "sonner", "switch", "table", "tabs", "textarea", "toggle-group",
  "toggle", "tooltip",
  // Added 2026-07-30. `empty` and `spinner` because the rules already require
  // every list to handle "nothing yet" and every submit to show it is working,
  // and the model was hand-rolling both every time; `field` and `input-group`
  // because most generated sites are a form.
  "empty", "spinner", "field", "input-group",
  // The rest of what the registry actually ships for this style. `toast` is
  // deliberately NOT here: it is superseded by `sonner`, which we have, and
  // offering both would give the model two ways to raise a toast and it would
  // pick inconsistently between pages of the same site.
  "button-group", "item", "kbd",
  // From the new-york-v4 style, fetched by URL: this template declares style
  // "new-york" (v3), which is why the CLI could not resolve it by name. A plain
  // <select> — lighter than the Radix one for a three-option dropdown, which is
  // most of them.
  "native-select",
  // The rest of the v4-only set, added 2026-07-30 (owner's call: take everything
  // shadcn publishes). `combobox` had been refused twice — it wants v4's button
  // sizes and fails TS2322 without them — and it compiles now that button.tsx
  // carries `xs`/`icon-xs`/`icon-sm`/`icon-lg` alongside its own four.
  //
  // The five chat primitives are here because they EXIST, not because a business
  // site needs them. They are for building a chat UI; nothing in PAGE_RULES points
  // at them, and the lint only cares that a cited component is real.
  "combobox", "direction",
  "attachment", "bubble", "marker", "message", "message-scroller",

  // ── OURS, not shadcn's (2026-07-30) ────────────────────────────────────────
  // The 61 above are PRIMITIVES — button, input, dialog. A business site is made
  // of COMPOSITIONS, and every generated page was rebuilding them inline from
  // card and div: a hero, a price list, an opening-hours table, the four states
  // of a list. That is what every paid component registry sells, and writing them
  // ourselves costs no licence, no token and no npm dependency.
  //
  // Written rather than bought for a second reason that turned out to matter
  // more: the expensive part of a bigger kit was never storing it, it was
  // DESCRIBING it to the model. We own these APIs, so the usage notes are
  // accurate by construction — where 400 foreign components would be 400
  // unfamiliar APIs the model half-understands.
  //
  // Page sections.
  "hero", "hero-split", "section-header", "feature-grid", "stats-band",
  "pricing-table", "price-list", "menu-section", "testimonial", "cta-band",
  "faq", "steps", "team-grid", "gallery", "logo-cloud", "announcement-bar",
  "site-header", "site-footer", "before-after",
  // The business itself.
  "opening-hours", "contact-card", "location-card", "availability-grid",
  "review-stars", "social-links",
  // Data and state. `data-list` is the important one: all four list states in
  // one place, which the rules otherwise ask the model to hand-write on every
  // list of every page.
  "data-list", "stat-card", "timeline", "tag-list", "countdown", "marquee",
  "safe-image", "copy-button", "share-buttons",
  // Forms.
  "date-time-picker", "phone-input", "quantity-input", "file-drop", "success-panel",

  // ── The second hundred (2026-07-30) ───────────────────────────────────────
  // Utility-first: the shapes a page needs over and over, rather than more ways
  // to decorate one. Monochrome throughout — state is carried by fill, weight and
  // a written label, never by colour alone, which does not survive greyscale or
  // reach anyone who cannot see it.
  // Layout — structure a page without hand-rolling flex and grid every time.
  "container", "section", "stack", "inline", "auto-grid", "two-col",
  "center-box", "bento-grid", "masonry", "sticky-bar", "page-header",
  "scroll-top", "divider-text", "spacer", "toolbar", "overflow-scroller",
  // Typography.
  "prose", "heading", "text", "lead", "quote", "bullet-list", "clamp-text",
  "expandable-text",
  // Data display.
  "description-list", "key-value", "data-table", "sortable-header",
  "row-actions", "avatar-group", "status-dot", "status-badge",
  "progress-ring", "metric-delta", "count-badge", "comparison-table",
  "detail-panel", "record-header", "legend",
  // Feedback and state.
  "banner", "callout", "inline-alert", "loading-overlay", "stepper",
  "skeleton-text", "skeleton-card", "error-state", "confirm-dialog",
  "offline-banner", "busy-button", "retry-panel",
  // Navigation.
  "tab-nav", "nav-list", "anchor-nav", "back-link", "prev-next", "link-card",
  "mobile-nav", "side-nav", "step-nav", "nav-footer", "result-count",
  "external-link",
  // Forms. Every one carries the right autoComplete and inputMode, which is most of what makes a form fillable on a phone.
  "form-row", "form-section", "form-actions", "form-error-summary",
  "field-hint", "required-mark", "search-input", "password-input",
  "email-input", "url-input", "number-input", "currency-input",
  "percent-input", "textarea-count", "checkbox-group", "radio-cards",
  "switch-row", "multi-select", "address-fields", "name-fields",
  // Media.
  "video-embed", "audio-player", "cover-image", "media-grid", "image-strip",
  "avatar-upload", "icon-badge", "logo",
  // Utility.
  "theme-toggle", "print-button", "cookie-banner", "scroll-progress",
  "reveal", "time-ago", "duration", "visually-hidden", "avatar-name",

  // ── The third hundred (2026-07-30) ────────────────────────────────────────
  // Whole flows rather than more parts: a basket, a booking, an account, an
  // admin table. Same rules as the rest — prop-driven, monochrome unless the
  // meaning is genuinely semantic, and colour never the only signal.
  // Commerce.
  "product-card", "price-tag", "cart-line", "cart-summary", "order-summary",
  "coupon-input", "stock-badge", "variant-picker", "delivery-estimate",
  "payment-methods", "trust-strip", "order-tracker", "wishlist-button",
  "add-to-cart",
  // Booking and scheduling — the shapes this platform's sites are mostly made of.
  "calendar-month", "day-schedule", "week-strip", "duration-picker",
  "party-size", "booking-summary", "cancel-policy", "waitlist-form",
  "recurring-picker", "timezone-note",
  // Accounts and members.
  "login-form", "signup-form", "reset-form", "otp-form", "profile-card",
  "account-menu", "plan-card", "usage-meter", "invite-form",
  "permission-row", "danger-zone", "session-row",
  // Dashboard and admin.
  "metric-row", "filter-bar", "date-range-picker", "bulk-actions",
  "export-button", "column-toggle", "saved-views", "activity-feed",
  "audit-row", "inbox-list", "assignee-picker", "priority-badge",
  // Content and publishing.
  "article-card", "article-header", "author-byline", "reading-time",
  "post-meta", "related-list", "category-nav", "figure", "code-block",
  "changelog-entry", "glossary-item", "faq-search",
  // Social proof.
  "rating-summary", "review-card", "rating-input", "review-form",
  "verified-badge", "award-badge", "press-quote", "case-study-card",
  // Interaction.
  "like-button", "vote-buttons", "emoji-reaction", "nps-scale",
  "feedback-widget", "labeled-progress", "sticky-cta", "tour-step",
  "hotkey-list", "toggle-chip",
  // Formatting. All Intl-based, so they localise for free and add no dependency.
  "money", "number-format", "date-format", "list-format", "plural",
  "truncate-middle", "highlight-match", "file-size", "ordinal", "initials",
  // More layout.
  "split-view", "panel", "well", "card-grid", "list-row", "media-object",
  "empty-illustration", "sidebar-layout", "sticky-aside", "centered-form",
  "section-divider", "grid-item",

  // ── The fourth hundred (2026-07-30) ───────────────────────────────────────
  // Files, tables at scale, charts without a charting library, onboarding,
  // search, settings, status, events, and the cards for the trades this
  // platform actually builds sites for.
  // Files and attachments.
  "file-type-icon", "file-row", "file-list", "upload-progress", "download-card",
  "attachment-list", "storage-bar",
  // Notifications and discussion.
  "notification-item", "notification-list", "notification-bell", "unread-divider",
  "comment", "comment-thread", "reply-box", "mention-chip", "moderation-note",
  // Tables at scale. The four that matter are `select-all-banner` (page vs all),
  // `expandable-row`, `totals-row` and `grouped-rows` — the parts a table grows
  // once it has more rows than fit.
  "page-size-select", "row-select", "select-all-banner", "expandable-row",
  "totals-row", "grouped-rows", "table-skeleton", "sticky-table",
  "density-toggle", "inline-edit",
  // Charts, hand-drawn in SVG and CSS. Deliberately NOT recharts: these are the
  // small ones — a trend beside a number, a share of a total — where a charting
  // library is 90 KB to draw eight rectangles. `chart` and src/components/charts
  // are still there for a real one.
  "sparkline", "mini-bars", "bar-list", "donut-mini", "gauge", "heat-strip",
  "ratio-bar", "dot-plot", "progress-stack", "trend-arrow",
  // Onboarding and first run.
  "welcome-card", "setup-checklist", "spotlight", "whats-new",
  "sample-data-banner", "getting-started", "connect-card", "first-run",
  // Search.
  "search-header", "search-results", "recent-searches", "search-suggestions",
  "no-results", "search-facets", "sort-select", "applied-filters",
  // Settings and account admin.
  "settings-nav", "setting-item", "notification-prefs", "api-key-row",
  "webhook-row", "connected-account", "billing-summary", "invoice-row",
  "seat-usage", "two-factor-setup", "email-verify-banner",
  // System status.
  "uptime-bar", "incident-item", "status-list", "maintenance-notice",
  "latency-badge", "sync-status", "queue-depth",
  // Events and calendars.
  "event-card", "agenda-list", "time-slot", "rsvp-buttons", "event-meta",
  "all-day-row", "date-nav", "now-line", "ics-button",
  // The trades. A generated site is usually one of these, and each card is the
  // shape that trade's listings actually take.
  "job-card", "property-card", "course-card", "recipe-card", "dish-card",
  "service-card", "room-card", "vehicle-card", "ticket-card", "donation-card",
  "membership-card",
  // More inputs and utility.
  "tag-input", "slug-input", "unit-input", "weekday-picker", "color-swatch",
  "id-badge", "json-view", "diff-text", "word-count", "map-embed",

  // ── The fifth hundred (2026-07-30) ────────────────────────────────────────
  // Messaging (12) · printed documents and invoices (12) · the forms that are
  // actually hard (13) · what a page does when something breaks (10) ·
  // accessibility and page structure (10) · location and delivery (10) ·
  // bulk import (10) · time and availability (11) · people and org (12).
  // Messaging and support.
  "chat-message", "chat-thread", "chat-composer", "typing-indicator",
  "message-status", "conversation-row", "help-launcher", "canned-reply",
  "contact-form", "ticket-row", "sla-badge", "escalation-note",
  // Documents, invoices and print. `print-only`/`screen-only`/`page-break`
  // exist because the commonest printing bug is not layout — it is eight
  // pages of navigation printed because nothing said not to.
  "invoice-header", "invoice-lines", "invoice-totals", "receipt", "letterhead",
  "signature-block", "terms-block", "document-meta", "page-break",
  "print-only", "screen-only", "watermark",
  // Forms, the cases the first four hundred did not cover.
  "multi-step-form", "form-progress", "repeatable-field", "conditional-field",
  "signature-pad", "consent-checkbox", "date-of-birth", "time-input",
  "range-input", "scale-input", "matrix-question", "honeypot", "save-draft",
  // What the page does when something goes wrong.
  "error-boundary", "not-found", "forbidden", "rate-limited",
  "maintenance-page", "stale-data-note", "slow-note", "undo-toast",
  "conflict-note", "partial-failure",
  // Accessibility and page structure. `skip-link` + `landmark` are a PAIR —
  // the link needs the main region's id and tabindex to do anything.
  "skip-link", "live-region", "focus-trap", "heading-level", "lang-switch",
  "text-size", "landmark", "seo-jsonld", "share-preview", "page-title",
  // Location and delivery.
  "store-locator", "distance-badge", "service-area", "travel-time",
  "postcode-input", "pickup-point", "delivery-slot", "shipping-options",
  "address-summary", "country-select",
  // Getting existing data in.
  "csv-import", "column-mapper", "import-preview", "paste-table",
  "import-summary", "batch-progress", "row-errors", "dry-run-note",
  "dedupe-list", "template-download",
  // Time and availability. `open-now` answers the question a visitor has;
  // `opening-hours` shows the week.
  "open-now", "holiday-notice", "lead-time", "blackout-dates", "shift-badge",
  "time-until", "slot-hold", "timezone-picker", "recurrence-summary",
  "duration-bar", "date-badge",
  // People and org. `presence-dot` is about a PERSON and `status-dot` about a
  // system — they look alike and one component covering both ends up with a
  // colleague who is "Failed".
  "person-row", "presence-dot", "role-badge", "org-chart", "skill-tags",
  "on-call", "handoff-note", "availability-legend", "capacity-bar",
  "mention-picker", "directory-list", "approval-chain",
];

// Imported, not restated. The generator has to predict exactly what the API will
// refuse, and when these rules were written out in both files they drifted — the
// lint claimed a read of a `feed` or `admin` table returns 403, which the API
// does not do. site-access.mjs is dependency-free, so this module stays
// importable without the Worker's node_modules.
export { MANAGED_COLUMNS } from "../site-access.mjs";
import { MANAGED_COLUMNS, canReadAccess, canWriteAccess, whyNotReadable, needsMember, hasPublicView } from "../site-access.mjs";

export const MAX_PAGES = 6;
export const MAX_PAGE_CHARS = 24000;

// A byte-for-byte copy of builder/lovable/template/src/routes/index.tsx. The only
// change is the escape on the one `${` sequence, which a template literal would
// otherwise interpolate. test/page-gen.test.mjs fails if the two diverge.
export const REFERENCE_PAGE = `// Reference page. Hand-written against the schema the designer actually
// produced for "a small barber shop site": services(name, description, price,
// duration_minutes) and appointments(service, customer_name, customer_phone,
// date, time, notes).
//
// This exists to be imitated. It is the shape the generator should emit — read
// with useRows, write with useCreateRow, shadcn for every control, and no fetch
// code anywhere. If a generated page diverges from this, the generator is wrong.
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useRows, useCreateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/")({ component: Home });

type Service = Row & {
  name: string;
  description: string | null;
  price: number | null;
  duration_minutes: number | null;
};

// Mirrors the declared columns. The API rejects anything undeclared anyway, but
// validating here means the visitor is told before a round trip.
const booking = z.object({
  service: z.string().min(1, "Pick a service"),
  customer_name: z.string().min(2, "Tell us your name"),
  customer_phone: z.string().min(6, "We need a number to confirm on"),
  date: z.string().min(1, "Pick a date"),
  time: z.string().min(1, "Pick a time"),
  notes: z.string().max(500).optional(),
});

type Booking = z.infer<typeof booking>;

function Home() {
  const services = useRows<Service>("services", { order: "price", dir: "asc" });
  const create = useCreateRow("appointments");

  const form = useForm<Booking>({
    resolver: zodResolver(booking),
    defaultValues: { service: "", customer_name: "", customer_phone: "", date: "", time: "", notes: "" },
  });

  const onSubmit = (values: Booking) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Booked — we'll call to confirm.");
        form.reset();
      },
      // The API separates the caller's fault from a server fault, so its own
      // message is worth showing instead of a generic failure.
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Barber Shop</h1>
      <p className="mt-2 text-muted-foreground">Book a chair. We'll call to confirm.</p>

      <section className="mt-12">
        <h2 className="text-xl font-medium">Services</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {services.isPending && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}

          {services.isError && (
            <p className="text-sm text-destructive sm:col-span-2">
              Couldn't load the services. Refresh and try again.
            </p>
          )}

          {services.data?.length === 0 && (
            <p className="text-sm text-muted-foreground sm:col-span-2">Nothing listed yet.</p>
          )}

          {services.data?.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-baseline justify-between text-base">
                  <span>{s.name}</span>
                  {s.price != null && <span className="tabular-nums">\${s.price}</span>}
                </CardTitle>
                {s.duration_minutes != null && <CardDescription>{s.duration_minutes} min</CardDescription>}
              </CardHeader>
              {s.description && (
                <CardContent className="text-sm text-muted-foreground">{s.description}</CardContent>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-medium">Book an appointment</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="service"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Service</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose one" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {services.data?.map((s) => (
                        <SelectItem key={s.id} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customer_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customer_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Anything else?</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="sm:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Booking…" : "Request appointment"}
              </Button>
            </div>
          </form>
        </Form>
      </section>
    </main>
  );
}
`;

export const PAGE_RULES = `You write the pages of a small business website, as TypeScript React route files.

The site's database ALREADY EXISTS. A schema was designed from the same brief and its tables
are live Postgres. You are given exactly what was created. You cannot invent a table, a column
or an access level — anything not in the schema below does not exist.

## Hard rules

1. NO FETCH CODE. Read with \`useRows\`, write with \`useCreateRow\`, both from "@/lib/rows".
   A page that calls fetch, axios or XMLHttpRequest is wrong.

2. RESPECT THE ACCESS LEVEL. The API enforces it — this is not a matter of taste.
   - \`display\` — you may LIST and READ it. A write returns 403.
   - \`collect\` — you may SUBMIT a form to it. A read returns 403. These rows are other
     visitors' submissions; never list them, never count them, never show "3 people booked".
   - \`user\` — PRIVATE PER MEMBER. Signed in, they read and write only their OWN rows;
     signed out, both return 401. Build the signed-in view AND a sign-in prompt.
   - \`feed\` — SHARED, MEMBER-AUTHORED. Anyone signed in reads every row; a signed-in
     member writes rows that become theirs. Signed out, both return 401.
   - \`admin\` — SHARED, ROLE-WRITABLE. Anyone signed in reads it; only a member whose role
     the table names in \`writeRoles\` may write. Anyone else gets 403 with \`code: "role"\`.

3. SHADCN FOR EVERY CONTROL, imported from "@/components/ui/<name>". Never hand-roll a
   button, input, select, checkbox or dialog. These exist and nothing else does:
   ${UI_COMPONENTS.join(", ")}.
   There is no "toast" or "use-toast" component — toasts come from \`import { toast } from "sonner"\`.

4. FORMS ARE react-hook-form + zod, through shadcn's \`Form\`/\`FormField\`/\`FormControl\`.
   TanStack Form is installed but shadcn's form components do not speak to it — mixing them
   produces inputs that silently do not validate. Never import "@tanstack/react-form".

5. THE ZOD SCHEMA MIRRORS THE DECLARED COLUMNS. The API drops anything undeclared, so a field
   the schema does not have vanishes without an error.

6. NEVER WRITE A MANAGED COLUMN. These are set by the engine and dropped from any write:
   ${MANAGED_COLUMNS.join(", ")}.

7. A COLUMN NAMED FOR A PICTURE HOLDS A URL STRING. \`photo\`, \`image_url\`, \`avatar\`,
   \`logo\`, \`cover\`, \`hero_image\` and the like are ordinary text columns whose value is a
   path like "/u/<slug>/<hash>.jpg". Render one as a plain
   \`<img src={row.photo} alt="" className="..." />\`.
   ALWAYS GUARD IT: on a \`display\` table the owner fills these in after the build, so
   the value is often empty, and \`<img src="">\` renders as a broken image on a brand-new
   site. Write \`{row.photo ? <img .../> : <div className="..." />}\` — an image or a
   placeholder box, never a broken one.

8. A FORM MAY LET THE VISITOR ATTACH ONE, but only when its table declares an image
   column. Upload first, then submit the URL as an ordinary text field:

   \`\`\`tsx
   const upload = useUploadFile("bookings");           // from "@/lib/rows"
   // <Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" ... />
   const { url } = await upload.mutateAsync(file);
   form.setValue("photo", url);                        // then create the row as normal
   \`\`\`

   The row write is still plain JSON — there is no multipart and no "file field".
   Disable submit while \`upload.isPending\`, and surface \`error.message\` like any other
   write: the API says "that image is too big" or "that doesn't look like a PNG, JPEG,
   WebP or GIF", which is worth showing. **PNG, JPEG, WebP and GIF only — SVG is refused**
   — and the file is capped at 2 MB, so say so next to the control rather than letting
   someone pick a 12 MB photo and be told no afterwards.

9. A BOOKING PAGE SHOWS WHICH SLOTS ARE TAKEN with \`usePublicRows\`. A \`collect\` table
   cannot be read — that is the whole point of it — but if the schema declares a
   \`publicView\` on it, that projection CAN be read by anyone, and it is how a form greys
   out a time somebody already booked. \`usePublicRows("bookings")\` returns only the
   columns the schema chose to publish, never a name or an email.
   **The schema above says, per table, whether this works — do not infer it.** When it says
   NO, build the ordinary form and ship it: the visitor picks a time and the server refuses
   a taken one with a clear message. Greying slots out early is a nicety, and a page that
   fails because it could not have one is far worse than a page without one.
   **These rows have NO \`id\`** — a projection publishes only the columns listed above, and
   \`id\` is refused outright. Type them as \`PublicRow & { … }\`, never \`Row & { … }\`, and key
   the list on a published column or the index.

10. GIVE THE VISITOR THEIR SUBMISSION BACK. A \`collect\` table is write-only — no policy
    lets anybody list it — so the person who booked cannot see their appointment again
    unless the SCHEMA declares a way. When it does, the way is a database function:
    \`useClaimedRow("get_booking", token)\` reads one row by its claim token and
    \`useCancelClaim("cancel_booking")\` cancels it. Both take the FUNCTION NAME the schema
    declared, not a table.
    **Only build the manage page if the schema actually declares those functions** —
    check the digest. If it does not, the confirmation screen is the end of the flow, and
    that is a complete site rather than a broken one.
    When it does: \`useCreateRow\` resolves to the created ROW, so read the token off the
    column the schema publishes it in and put it in the link
    (\`/manage?t=\${row.claim_token}\`). **Never annotate a mutation callback's parameter.**
    Write \`onSuccess: (data) => …\`, not \`onSuccess: (data: Booking) => …\`. TanStack's
    callback takes four arguments and its types are contravariant, so ANY hand-written
    annotation is refused even when it looks right — that was three separate build
    failures. Let it infer.
    Build this whenever the schema declares the functions AND the form is an appointment,
    an order or a reservation — anything somebody would want to check or call off. Not for
    a plain contact form, which nobody comes back to.

11. ANYTHING THE SCHEMA DECLARES AS A FUNCTION, you can call: \`useRpc("fn", args)\` to read
    and \`useRpcAction("fn")\` to act. This is how a site does what a filter cannot — a
    total across tables, the slots left on a day, one row out of a write-only table. Only
    call functions the digest actually lists.

## Reading rows

\`useRows<T>(table, params)\` → a TanStack Query result whose \`.data\` is the rows.
- \`params\`: \`{ limit, offset, order, dir, q, <column>: value }\`. \`limit\` is capped at 100.
- \`order\` must be a DECLARED column or "id" — any other value silently falls back to id.
  \`created_at\` is NOT orderable unless the table declared it.
- a \`<column>: value\` pair is an equality filter, and only on declared columns.
- \`q\` is full-text search and only does something on a table that declared fts.
- rows come back with every column including \`id\` and \`created_at\`, so you can display those
  even though you cannot sort or filter on them.
- type it: \`type Service = Row & { name: string; price: number | null }\`. Every column the
  database did not mark required can be null — say so in the type and guard before rendering.

## Every list handles four states

Omit one and the page looks fine in a screenshot and broken in use:
- \`isPending\` → \`<Skeleton />\` placeholders, not a spinner and not nothing
- \`isError\` → one sentence a visitor can act on
- \`data?.length === 0\` → \`<Empty />\` from \`@/components/ui/empty\`, not a bare paragraph and
  never an empty grid. Give it a heading and a sentence saying what would put something there.
- loaded → the rows

## Every form must

- disable its submit button while \`mutation.isPending\`, and say so on the button — a
  \`<Spinner />\` inside it reads better than swapping the label, and keeps the width steady
- \`toast.success(...)\` and \`form.reset()\` on success
- \`toast.error(e.message)\` on failure — THE API'S OWN MESSAGE. It distinguishes the caller's
  fault from a server fault and returns a \`code\` for duplicate / overlap / bad_ref / required /
  full / invalid. "That time is already taken" is useful; "something went wrong" is not.

## Routing

File-based, TanStack Router. Each page is one file under src/routes/ exporting
\`export const Route = createFileRoute("<url>")({ component: X })\`.
  index.tsx → "/"      about.tsx → "/about"      menu/index.tsx → "/menu"
\`index.tsx\` is required. Link between pages with \`<Link to="/menu">\` from "@tanstack/react-router".
Never write routeTree.gen.ts, __root.tsx, src/pages/ or app/layout.tsx.

## Styling

Tailwind v4 with semantic tokens: bg-background, text-foreground, bg-card, text-muted-foreground,
border-border, bg-primary, text-destructive. A raw bg-slate-900 breaks dark mode. Also available:
lucide-react icons, date-fns, recharts. Import nothing that is not already a dependency.

## Visitor accounts

A site can have members — its own customers, nothing to do with isibi accounts.
Everything comes from \`@/lib/rows\`; there is no other auth API and no \`fetch\`:

- \`useMember()\` → \`{ data: member | null, isPending }\`. **Render neither view until it
  settles**, or the page flashes a sign-in form at somebody already signed in. A member is
  \`{ id, email, name, role, verified }\` and \`id\` is a UUID string, never a number.
- \`useSignup()\` → \`{ email, password, name }\`. \`useLogin()\` → \`{ email, password }\`.
  On success the session is stored and every read re-runs on its own. Passwords need 8+
  characters. Surface the error's \`message\` on failure — the server distinguishes a wrong
  password from an address that already has an account, and inventing your own text loses that.
- \`useLogout()\` → a mutation, no arguments.
- \`useRequestReset()\` → \`{ email }\`. Always succeeds; say "check your inbox" whether or
  not the address has an account, because saying which confirms who is a member. The link
  itself is handled by the platform.

Gate admin UI on \`member.role\`, which is \`"user"\` unless the owner granted something. An
\`admin\` table refuses a write from any other role with a 403, so a button that is always
visible is a button that sometimes fails.

Build sign-in and sign-up ONLY when the schema actually has a \`user\`, \`feed\` or \`admin\`
table. A site of \`display\` and \`collect\` tables needs no accounts, and adding them is
friction nobody asked for — for somebody returning to a form they filled in, the claim link
(rule 10) is the right tool and needs no account at all.

## What is not possible yet

- Editing and deleting work ONLY on a member's OWN rows, in a \`user\` or \`feed\` table, with
  \`useUpdateRow\`/\`useDeleteRow\` and a signed-in member. A \`collect\` or \`display\` row has no
  owner and can never be changed from a page. Someone else's row answers 404, so treat "not found"
  as "not yours" and say so gently.
- No owner/admin dashboard IN THE SITE — a \`collect\` table cannot be read back from a page.
  Its owner reads those submissions inside isibi, which is not something you build.
If the brief asks for one of these, build everything else and say plainly in \`notes\` what was
left out and why. Never generate UI that cannot work.

## Definition of done

\`tsc --noEmit\` must be clean and \`vite build\` must succeed. Write real TypeScript: no \`any\`,
no unresolved imports, no props a component does not take.

Keep it to the few pages the brief actually needs — usually one, at most ${MAX_PAGES}. Write warm,
specific copy for the business in the brief; never lorem ipsum, never a placeholder image URL.

## The page to imitate

This is a real, compiling page written against services(display) + appointments(collect). It is
the shape to copy — every rule above is visible in it.

${REFERENCE_PAGE}`;

export const SITE_PAGES_TOOL = {
  name: "write_pages",
  description: "Write the route files for the site.",
  input_schema: {
    type: "object",
    properties: {
      pages: {
        type: "array",
        description: "One entry per route file. Must include index.tsx.",
        items: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: 'Path under src/routes/, e.g. "index.tsx" or "menu.tsx". No leading directories.',
            },
            source: { type: "string", description: "The complete .tsx source for that route file." },
          },
          required: ["path", "source"],
        },
      },
      notes: {
        type: "string",
        description: "Anything the brief asked for that was left out, and why. Empty if nothing was.",
      },
    },
    required: ["pages"],
  },
};

export const ACCESS_NOTE = {
  display: "visitors READ it. List it, show it, search it. Writing to it returns 403.",
  collect: "visitors WRITE to it. Submit a form. Reading it returns 403 — never list these rows.",
  user: "PRIVATE PER MEMBER. Signed in, a member reads and writes only their OWN rows; signed out, both return 401. Build the signed-in view AND a sign-in prompt for when there is no member.",
  feed: "SHARED, MEMBER-AUTHORED. Anyone signed in reads every row; a signed-in member writes rows that become theirs. Signed out, both return 401.",
  admin: "SHARED, ROLE-WRITABLE. Anyone signed in reads it; only a member whose role is 'admin' (or one this table names in writeRoles) may write. A write by anyone else returns 403 with code 'role'.",
};

/** The tables, exactly as they exist, in the least ambiguous form we can put them. */
export function schemaDigest(spec) {
  const tables = (spec && Array.isArray(spec.tables) ? spec.tables : []).filter((t) => t && t.name);
  if (!tables.length) return "(the schema declares no tables)";
  return tables.map((t) => {
    const access = String(t.access || "collect").toLowerCase();
    // Columns arrive in two shapes and BOTH must work. normalizeSchema produces
    // rich objects ({name, type, notnull, ref}); the schema persisted in a
    // site's own `_meta` stores plain NAMES. Filtering on `c.name` silently
    // dropped every string, so a spec read back from _meta described each table
    // as having no columns at all — and the generator dutifully wrote pages that
    // said so. Live for one deploy on 2026-07-28.
    const cols = (t.columns || [])
      .map((c) => (typeof c === "string" ? { name: c } : c))
      .filter((c) => c && c.name);
    const described = cols.map((c) => {
      const bits = [String(c.type || "text").toLowerCase()];
      if (c.notnull) bits.push("required");
      if (c.ref) bits.push("names a row in " + c.ref);
      return c.name + " (" + bits.join(", ") + ")";
    });
    const lines = [
      "TABLE " + t.name + " — access \"" + access + "\": " + (ACCESS_NOTE[access] || ACCESS_NOTE.collect),
      "  columns: " + (described.length ? described.join(" · ") : "(none)"),
    ];
    if (access === "display") {
      lines.push("  order / filter by: " + cols.map((c) => c.name).concat("id").join(", "));
      lines.push("  full-text search: " + (t.fts ? "yes — pass { q } to useRows" : "no — do not pass q"));
    }
    // Whether `usePublicRows` works on this table, stated rather than left to be
    // guessed. Rule 9 says not to call it on a table with no public view — a
    // rule the model could not follow, because nothing here told it which tables
    // have one. Measured live 2026-07-29: it correctly worked out that
    // `bookings` had none, could not build the taken-slots hint, and the whole
    // site came out as the placeholder over one optional enhancement.
    //
    // Printed for EVERY table, not only the ones that have it. "No public view"
    // is the fact that stops a 404, and an absent line reads as an omission
    // rather than an answer.
    // `user` normally means private-to-me. `teamScope` changes that to
    // "ours", and a page that says "your notes" on a shared team table is
    // describing something the API does not do.
    if (t.teamScope && access === "user") {
      lines.push("  SHARED WITH THE TEAM: everyone in this member's team reads and edits the same rows. Say \"our\"/\"the team's\", not \"your\".");
    }
    if (access !== "display") {
      // `hasPublicView` decides, not a shape test written here — the data path
      // answers 404 on exactly this question, and a second copy of the rule
      // drifts into a digest that promises a read the API refuses.
      lines.push(hasPublicView(t)
        ? "  usePublicRows: YES — anyone may read " + t.publicView.columns.join(", ") + " from this table"
        : "  usePublicRows: NO — this table has no public view; calling it is a 404, so build the page without it");
    }
    return lines.join("\n");
  }).join("\n\n");
}

/**
 * The user turn: what to build, and what already exists to build it against.
 * The brand is the name the schema designer settled on, and it is already in the
 * published page's <title> — passing it here keeps the heading from disagreeing
 * with the browser tab.
 */
/**
 * What the generator is told a revise is FOR.
 *
 * A revise sends {slug, instruction}, so before this the generator's entire
 * knowledge of the site was one line like "add a gallery" — and since it rewrites
 * every page each time, a working barber shop came back as a page listing a
 * gallery and nothing else. The merged schema fixed the tables; this fixes the
 * intent.
 *
 * The ORIGINAL brief is the anchor and is never rewritten by an instruction: an
 * accumulating log would grow without bound and would keep contradicting itself
 * ("remove the gallery" stays true forever). What the site has BECOME is carried
 * by the merged schema, which is the authoritative half anyway.
 */
export function briefForPages({ brief, priorBrief } = {}) {
  const now = String(brief || "").trim();
  const before = String(priorBrief || "").trim();
  if (!before || before === now) return now;
  if (!now) return before;
  return "The site already exists. It was originally built from this brief:\n\n" + before +
    "\n\nWHAT TO CHANGE NOW\n" + now +
    "\n\nKeep everything the original brief asked for unless this change says otherwise.";
}

export function pagesPrompt(brief, spec, brand) {
  const name = String(brand || "").trim();
  return "Build the pages for this site.\n\nBRIEF\n" + String(brief || "").trim() +
    (name ? "\n\nTHE SITE IS CALLED\n" + name + " — use it as the heading; it is already the page title." : "") +
    "\n\nTHE SCHEMA THAT EXISTS\n" + schemaDigest(spec);
}

// A route path the container will accept: under src/routes, .tsx, no traversal,
// and not one of the files the template or the router owns. Checked on the name
// as written, BEFORE any extension is normalised — otherwise "routeTree.gen.ts"
// slips through as "routeTree.gen.tsx".
const RESERVED = /(^|\/)(__root|routeTree\.gen|readme)\b/i;
const SAFE_PATH = /^[a-z0-9_$][a-z0-9._$-]*(\/[a-z0-9._$-]+)*\.tsx$/i;

function cleanPath(raw) {
  let p = String(raw || "").trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  p = p.replace(/^(?:src\/)?routes\//, "");
  if (!p || p.includes("..") || RESERVED.test(p)) return null;
  if (!/\.[a-z]+$/i.test(p)) p += ".tsx";
  if (p.endsWith(".ts")) p = p.slice(0, -3) + ".tsx";
  return SAFE_PATH.test(p) ? p : null;
}

/**
 * Structural check on the tool's output: real paths, real source, an index.
 * Returns the files worth trying to compile plus everything wrong with them.
 */
export function validatePages(input) {
  const problems = [];
  const pages = [];
  const seen = new Set();
  const raw = (input && Array.isArray(input.pages)) ? input.pages : [];
  if (raw.length > MAX_PAGES) problems.push("More than " + MAX_PAGES + " pages were written; only the first " + MAX_PAGES + " were kept.");
  for (const p of raw.slice(0, MAX_PAGES)) {
    const source = p && typeof p.source === "string" ? p.source : "";
    if (!source.trim()) continue;
    const path = cleanPath(p.path);
    if (!path) { problems.push('"' + String(p && p.path).slice(0, 60) + '" is not a route file name — use something like index.tsx or menu.tsx.'); continue; }
    if (seen.has(path)) { problems.push(path + " was written twice; only the first was kept."); continue; }
    if (source.length > MAX_PAGE_CHARS) { problems.push(path + " is over " + MAX_PAGE_CHARS + " characters — split it or cut it down."); continue; }
    if (!/createFileRoute\s*\(/.test(source)) { problems.push(path + " does not export a Route — every page needs createFileRoute(...)."); continue; }
    seen.add(path);
    pages.push({ path, source });
  }
  if (pages.length && !seen.has("index.tsx")) problems.push("There is no index.tsx, so the site has no home page.");
  const notes = (input && typeof input.notes === "string") ? input.notes.trim().slice(0, 600) : "";
  return { pages, notes, problems };
}

// Reads the generated source for the mistakes that compile cleanly and then fail
// at runtime — a page that 403s against its own API looks perfect until it is
// loaded. Deliberately high-precision: every rule here is checked against the
// schema, so a hit is always a real defect, never a style opinion.
export function lintPages(pages, spec) {
  const problems = [];
  const tables = new Map();
  for (const t of (spec && Array.isArray(spec.tables) ? spec.tables : [])) {
    if (t && t.name) tables.set(String(t.name).toLowerCase(), t);
  }
  const ui = new Set(UI_COMPONENTS);
  const say = (path, msg) => problems.push(path + ": " + msg);
  const memberTables = [...tables.values()].filter((t) => needsMember(t.access));

  for (const { path, source } of pages) {
    // Strip comments and string literals before pattern-matching, so a rule in a
    // doc comment is not reported as the code doing it.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

    if (/\b(?:fetch|XMLHttpRequest)\s*\(/.test(code) || /\baxios\b/.test(code)) {
      say(path, "calls fetch directly. Read with useRows and write with useCreateRow from @/lib/rows — no fetch code in a page.");
    }
    if (/@tanstack\/react-form/.test(code)) {
      say(path, "imports @tanstack/react-form. shadcn's Form components only speak to react-hook-form; use useForm from react-hook-form with zodResolver.");
    }
    // Editing and deleting are allowed now, but ONLY on a member's own rows —
    // so a page that offers them without a member has nothing to scope by and
    // the API answers 401.
    const editsRows = /\buseUpdateRow\b|\buseDeleteRow\b/.test(code);
    if (editsRows && !/\buseMember\b/.test(code)) {
      say(path, "calls useUpdateRow/useDeleteRow without useMember(). Only a signed-in member can change a row, and only their own — put the edit UI behind a sign-in.");
    }
    if (editsRows && !memberTables.length) {
      say(path, "calls useUpdateRow/useDeleteRow, but this schema has no member table. `collect` and `display` rows have no owner and can never be edited from a page.");
    }

    for (const m of code.matchAll(/from\s+"@\/components\/ui\/([a-z0-9-]+)"/gi)) {
      if (!ui.has(m[1].toLowerCase())) say(path, 'imports "@/components/ui/' + m[1] + '", which does not exist. Available: ' + UI_COMPONENTS.join(", ") + ".");
    }

    // There was a rule here refusing `@/examples/*`, shadcn's own documentation
    // demos. It existed for one reason, stated in its own comment: every file in
    // that folder COMPILED, so nothing else in the pipeline could tell a real
    // page from one shipping "Our flagship product combines cutting-edge
    // technology with sleek design" to a barber shop's customers. The folder was
    // deleted 2026-07-31, which makes that import a missing module — caught by
    // `tsc` like any other, and no longer silent. The rule's whole justification
    // went with the files, so it went too rather than standing guard over a path
    // that no longer resolves.

    // Read and write are asked separately because the API answers them
    // separately: `feed` and `admin` serve reads and refuse writes, so flagging
    // a read of one would be reporting a defect that does not exist — and every
    // problem reported here costs a paid repair pass.
    // A member-scoped table without useMember() renders a permanent 401 to a
    // signed-out visitor and looks like a broken page rather than a locked one.
    for (const m of code.matchAll(/\buseRows\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (t && needsMember(t.access) && !/\buseMember\b/.test(code)) {
        say(path, 'reads "' + m[1] + '" (access "' + t.access + '") without useMember(). Signed out that returns 401, so the page must offer a sign-in rather than an error.');
      }
      if (!t) say(path, 'reads table "' + m[1] + '", which the schema does not declare.');
      // A member table is handled by the rule above: it is readable, just not
      // anonymously. Saying both would report one page twice and pay for a
      // repair pass to fix a problem that was already described.
      else if (!canReadAccess(t.access) && !needsMember(t.access)) {
        say(path, 'lists "' + m[1] + '", which is access "' + t.access + '" — reading it returns 403: ' + whyNotReadable(t.access) + '.');
      }
    }
    // `usePublicRows` is the one read that does NOT follow from a table's access
    // level — it works only where the schema declared a `publicView`, and on
    // every other table it is a 404 the visitor sees as a broken page. The same
    // class as the checks around it: a mismatch between what the page asks for
    // and what the schema actually permits, caught without running anything.
    for (const m of code.matchAll(/\busePublicRows\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (!t) say(path, 'reads table "' + m[1] + '", which the schema does not declare.');
      else if (!hasPublicView(t)) {
        say(path, 'calls usePublicRows("' + m[1] + '"), but that table declares no publicView — the request is a 404. Build the page without the taken-slots hint; the server still refuses a taken slot on submit.');
      }
    }
    for (const m of code.matchAll(/\buseRow\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (t && needsMember(t.access) && !/\buseMember\b/.test(code)) {
        say(path, 'reads one row of "' + m[1] + '" (access "' + t.access + '") without useMember(). Signed out that returns 401.');
      } else if (t && !canReadAccess(t.access) && !needsMember(t.access)) {
        say(path, 'reads one row of "' + m[1] + '", which is access "' + t.access + '" — reading it returns 403: ' + whyNotReadable(t.access) + '.');
      }
    }
    for (const m of code.matchAll(/\buseCreateRow\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (!t) say(path, 'writes to table "' + m[1] + '", which the schema does not declare.');
      // A member table accepts writes from someone signed in — that is the whole
      // point of the level — so the question is whether the page has a member,
      // not whether the table is writable.
      else if (needsMember(t.access)) {
        if (!/\buseMember\b/.test(code)) {
          say(path, 'writes to "' + m[1] + '" (access "' + t.access + '") without useMember(). Signed out that returns 401, so the form must be behind a sign-in.');
        }
      } else if (!canWriteAccess(t.access)) {
        say(path, 'submits to "' + m[1] + '", which is access "' + t.access + '" — writing to it returns 403. Only a `collect` table accepts a write from a published site.');
      }
    }
  }
  return [...new Set(problems)];
}

/** The repair turn: here is what you wrote, here is what is wrong, write it again. */
/**
 * The exact props of the components a page imported.
 *
 * The rules name 500 components and describe NONE of them, because a usage line
 * each is ~12,600 tokens on every build. So the model picks by name and guesses
 * the props — and the guess is wrong often enough to matter: `<ReviewStars
 * rating={4.5} />` is the obvious spelling and the prop is `value`, which is
 * TS2322, the one repair pass spent, and a site published as the placeholder.
 *
 * Handing them over on the REPAIR pass costs nothing on a build that worked and
 * ~500 tokens on one that did not — and a repair is exactly where a wrong prop
 * name has to be corrected. The imports are read off the code the model just
 * wrote, so it only ever gets the twenty or so it actually reached for.
 */
export function importedComponentApi(pages) {
  const want = new Set();
  for (const p of pages || []) {
    for (const m of String(p.source || "").matchAll(/from\s+["']@\/components\/ui\/([a-z0-9-]+)["']/gi)) {
      want.add(m[1].toLowerCase());
    }
  }
  const lines = [...want].sort()
    .filter((n) => COMPONENT_API[n])          // shadcn primitives are absent on purpose
    .map((n) => `${n} — ${COMPONENT_API[n]}`);
  return lines.length ? lines.join("\n") : null;
}

export function repairPrompt(brief, spec, pages, problems, brand) {
  const files = pages.map((p) => "=== src/routes/" + p.path + " ===\n" + p.source).join("\n\n");
  const api = importedComponentApi(pages);
  return "The pages you wrote did not work. Fix them and return the COMPLETE set of route files again — " +
    "every file, not a patch.\n\nWHAT IS WRONG\n" +
    problems.map((p) => "- " + p).join("\n") +
    (api
      ? "\n\nTHE EXACT PROPS OF WHAT YOU IMPORTED\n" +
        "These are the real signatures, taken from the components themselves. Where what you\n" +
        "wrote disagrees with one of these, the signature is right. Every one also takes\n" +
        "className. A `?` means optional; `= x` is the default.\n" + api
      : "") +
    "\n\nWHAT YOU WROTE\n" + files.slice(0, 60000) +
    "\n\n" + pagesPrompt(brief, spec, brand);
}

// ------------------------------------------------------- the request itself

/**
 * Page generation is a much bigger call than the schema design — whole .tsx
 * files rather than a handful of column names.
 *
 * Sized above what the pages themselves need: Sonnet 5 runs adaptive thinking
 * when `thinking` is omitted, and max_tokens caps thinking AND the response
 * together, so a budget tight around the files would spend part of itself
 * reasoning and truncate the last one.
 */
export const SITE_PAGES_MAX_TOKENS = 24000;

/**
 * The exact body the Worker POSTs to the model.
 *
 * Extracted so the eval harness issues the SAME request the Worker does. It was
 * built inline in worker.js, which cannot be imported — so any harness had to
 * restate the model, the budget, the tool and the prompt, and would then be
 * tuning against something subtly different from what production runs. A test
 * asserts worker.js calls this rather than rebuilding the body.
 *
 * THE SYSTEM BLOCK IS CACHED, and that is the whole reason it is an array here
 * rather than the plain string it used to be. `PAGE_RULES` is ~7,000 tokens and
 * is byte-identical on every generation on the platform — it does not vary with
 * the brief, the schema or the brand, all of which live in the user message. So
 * it was being paid for in full, every build, forever.
 *
 * Measured: input goes 7,523 -> 1,148 tokens per build in the steady state, an
 * 85% cut. The first call in a cache window pays a 1.25x write premium (9,294),
 * so it breaks even on the second build. The repair pass re-sends this exact
 * block within the same build, which makes it a guaranteed hit.
 *
 * The consequence to know about: a cache entry is keyed on the bytes, so ANY
 * edit to PAGE_RULES — including adding a component name — invalidates it and
 * the next call pays the write premium again. That is once per deploy that
 * touches the rules, against a saving on every build in between.
 */
export function pagesRequest({ brief, spec, brand, fix } = {}) {
  return {
    model: "claude-sonnet-5",
    max_tokens: SITE_PAGES_MAX_TOKENS,
    tools: [SITE_PAGES_TOOL],
    tool_choice: { type: "tool", name: "write_pages" },
    system: [{ type: "text", text: PAGE_RULES, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: fix
        ? repairPrompt(brief, spec, fix.pages, fix.problems, brand)
        : pagesPrompt(brief, spec, brand),
    }],
  };
}
