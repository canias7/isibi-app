// rules.mjs — the generation rules for the Lovable-clone pipeline.
//
// Every rule here is derived from reading two real Lovable outputs (a barbershop booker and a
// theatre seat picker) rather than from a description of what they do. Where the two disagreed,
// the rule follows what BOTH did. Where only one did something, it is marked as such.
//
// The single most important finding, and the reason these rules look the way they do: NEITHER app
// imports a single shadcn component. Both ship 46 and use zero. Nine route files across the two
// apps and every import is React, TanStack or the database client. The apps are built from raw
// <div>/<button> with Tailwind classes drawn from the shadcn TOKEN set. These rules reproduce
// that, because the goal is to mirror what they do, not to improve on it.

// Learned from the first live run: five of nine stages spent their entire budget and returned
// nothing, because the model explained what it was about to do and was truncated before it ever
// emitted a file block. The format instruction has to be the first thing it reads and the last.
export const OUTPUT_RULES =
  "OUTPUT FORMAT — this overrides every other instinct. Reply with file blocks and NOTHING else:\n" +
  "```\n===FILE: src/routes/book.tsx===\n<the complete file>\n```\n" +
  "· Your very first characters must be `===FILE:`. No preamble, no \"Here's the…\", no summary " +
  "afterwards, no markdown fences around the code.\n" +
  "· Every file is COMPLETE and runnable. Never a diff, never a fragment, never `// … rest unchanged`.\n" +
  "· If you are running short on room, write LESS CODE — fewer comments, a smaller component — but " +
  "always finish the file. A truncated reply is worth nothing: it cannot be parsed and the whole " +
  "step is wasted.";

export const ROUTE_RULES =
  "FILE-BASED ROUTING. One file per page under `src/routes/`. `index.tsx` is `/`, `book.tsx` is " +
  "`/book`, `users/$id.tsx` is `/users/:id` (bare `$`, no braces), `_layout.tsx` is a layout route. " +
  "NEVER create `src/pages/`, `app/layout.tsx`, or any Next.js/Remix convention. " +
  "`src/routeTree.gen.ts` is generated; never write or import it directly. " +
  "EVERY route file has exactly this shape:\n" +
  "```tsx\n" +
  "import { createFileRoute } from '@tanstack/react-router'\n\n" +
  "export const Route = createFileRoute('/book')({\n" +
  "  head: () => ({ meta: [\n" +
  "    { title: '<Page> — <Business name>' },\n" +
  "    { name: 'description', content: '<one sentence, written for a search result>' },\n" +
  "    { property: 'og:title', content: '<same as title>' },\n" +
  "    { property: 'og:description', content: '<same as description>' },\n" +
  "  ] }),\n" +
  "  component: BookPage,\n" +
  "})\n\n" +
  "function BookPage() { … }\n" +
  "```\n" +
  "The `head` block is not optional — every page carries its own title, description and og tags. " +
  "Internal links are `<Link to=\"/book\">` from `@tanstack/react-router`; the router uses hash " +
  "history and handles the `#` for you, so never write it yourself.";

// Derived by diffing their two apps: 66 of 73 shared files are byte-identical, and __root.tsx is
// one of the seven that are not. It is written per app and carries the whole chrome — header, nav,
// footer, site-wide meta, favicon and the webfont <link>s.
export const SHELL_RULES =
  "THE APP SHELL — `src/routes/__root.tsx`. This is a file you WRITE, not one you leave alone. It " +
  "wraps every page and holds everything that is the same on all of them:\n" +
  "· the header, nav and footer — the site chrome, with `<Link to=\"/…\">` for each page\n" +
  "· `<HeadContent />`, which is what makes each page's own head block reach the document\n" +
  "· `<Outlet />`, where the current page renders — never remove it\n" +
  "· SITE-WIDE meta in its own `head`: title, description, author, `og:title`, `og:description`, " +
  "`og:type`, `twitter:card`. These are the fallback for any page that does not set its own, so " +
  "they must name THIS business — leaving a placeholder there is a bug.\n" +
  "· `links`: the favicon, and the WEBFONTS.\n" +
  "**If you set `--font-display` or `--font-sans` in `src/styles.css`, you MUST load that font here**, " +
  "or the CSS silently falls back to the generic stack and the app looks nothing like it should:\n" +
  "```tsx\n" +
  "links: [\n" +
  "  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },\n" +
  "  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },\n" +
  "  { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=<Family>:wght@400;500;600&display=swap' },\n" +
  "]\n" +
  "```\n" +
  "Pick fonts that suit the business rather than defaulting to the same pairing every time.";

export const STYLE_RULES =
  "STYLING — SEMANTIC TOKENS, NOT RAW COLOURS. The app has a design system in `src/styles.css`. " +
  "Use `bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`, `bg-muted`, " +
  "`text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `bg-secondary`, `bg-accent`, " +
  "`bg-destructive`, `border-border`, `ring-ring`, and `chart-1`…`chart-5`. " +
  "**NEVER write a raw palette colour** (`bg-slate-900`, `text-gray-500`, `bg-white`) — every token " +
  "has a light AND a dark value, and a raw colour silently breaks dark mode. " +
  "TO ADD A COLOUR THIS APP NEEDS (a price tier, a status, a brand accent): declare it in BOTH " +
  "`:root` and `.dark` in `src/styles.css`, register it in the `@theme inline` block as " +
  "`--color-<name>: var(--<name>)`, and then use it as `bg-<name>`. All colours are **oklch**. " +
  "Fonts go in the first `@theme` block as `--font-display` / `--font-sans` and are used as " +
  "`font-display` / `font-sans`. Emitting `src/styles.css` with the app's own tokens is part of " +
  "building the app, not an afterthought.";

// Measured across both apps: their pages are built from raw elements, and the recurring shapes
// below are the ones that appear more than once. This is a description of their house style.
export const LAYOUT_RULES =
  "LAYOUT AND FEEL. Build pages from raw HTML elements (`div`, `section`, `button`, `input`) styled " +
  "with Tailwind. Recurring shapes that make the result look considered:\n" +
  "· page container `mx-auto max-w-6xl px-6 py-10` (a narrow reading page uses `max-w-3xl`, a form " +
  "card `max-w-md`)\n" +
  "· a hero or confirmation screen gets `px-6 py-16`\n" +
  "· an eyebrow label above a heading: `text-[10px] uppercase tracking-[0.35em] text-muted-foreground`\n" +
  "· headings use `font-display`; body copy is default `font-sans`\n" +
  "· cards are `rounded-2xl border border-border bg-card p-6`; controls are `rounded-lg` or `rounded-md`\n" +
  "· a two-column working page is `grid lg:grid-cols-[1fr_320px] gap-10`, with the narrow column " +
  "`lg:sticky lg:top-6 h-fit` when it is a running summary\n" +
  "· vertical rhythm via `space-y-6` / `space-y-8`, not per-element margins\n" +
  "· every interactive element states its disabled condition: `disabled:opacity-30 " +
  "disabled:cursor-not-allowed`\n" +
  "Wide content (a grid of seats, a table) goes in its own `overflow-x-auto` so the page body never " +
  "scrolls sideways.";

export const ACCESSIBILITY_RULES =
  "ACCESSIBILITY. Anything clickable is a real `<button>` or `<a>`, never a `div` with an onClick. " +
  "An element whose only content is an icon or a shape carries an `aria-label` that says what it is " +
  "AND its current state — their seat grid labels every cell " +
  "`aria-label={`Seat ${id} — ${tier} $${price} — ${status}`}`, which is the standard to hit. " +
  "A disabled control uses the `disabled` attribute, not just a faded style, so it is skipped by the " +
  "keyboard. Form inputs are tied to their label with `htmlFor`/`id`.";

export const DATA_RULES =
  "DATA. The app has a typed database client at `@/integrations/db/client`. Import it as " +
  "`import { db } from '@/integrations/db/client'`. Never write a bare `fetch` to the database.\n" +
  "```ts\n" +
  "const { data, error } = await db.from('bookings').select().eq('status', 'confirmed').order('date')\n" +
  "const { error }       = await db.from('bookings').insert({ seat: 'G7', status: 'confirmed' })\n" +
  "await db.from('bookings').update(id, { status: 'cancelled' })\n" +
  "await db.from('bookings').delete(id)\n" +
  "const { data: session } = await db.auth.getSession()   // also signUp / signIn / signOut\n" +
  "```\n" +
  "Row types come from `@/integrations/db/types`, generated from the schema — so a column that is " +
  "not in the schema is a compile error, not a blank cell in production. " +
  "**`db.publicFrom(table)`** reads a table's declared `publicView`: the PII-filtered projection any " +
  "visitor may see. Use it when someone signed out must know which slots are taken without seeing " +
  "who took them.\n" +
  "Wrap every read in TanStack Query (`useQuery`) and every write in `useMutation`, both already " +
  "installed and provided. Never hand-roll `useState` + `useEffect` fetch plumbing. " +
  "**A write must invalidate what it changed** (`queryClient.invalidateQueries`), or the list the " +
  "user is looking at will not update and they will submit twice. " +
  "**Do not invent data.** If the page shows records, they come from the database. Generating rows " +
  "from a hash function or a hardcoded array is a mockup, not an app — their seat picker did exactly " +
  "this (`if (hash(id) < 0.22) SOLD.add(id)`) and the result cannot take a real booking.";

export const COMPONENT_RULES =
  "COMPONENTS. `src/components/ui/` holds 46 shadcn components (Button, Card, Dialog, Select, Table, " +
  "Calendar, Chart, Command, Form, Sidebar and the rest). They are available at " +
  "`@/components/ui/<name>`. " +
  "Prefer them for anything interactive — a Dialog, Select, Popover, Tooltip or DropdownMenu built by " +
  "hand will be missing focus trapping, arrow-key navigation, Escape handling and collision flipping, " +
  "and those failures are invisible until someone uses a keyboard. " +
  "Write raw elements for layout and for anything the library does not have. " +
  "If a shape repeats three or more times on a page (a seat, a card, a row), lift it into a local " +
  "component in the SAME file rather than pasting the classes again.";

// Note on COMPONENT_RULES above: this is the one place these rules deliberately DIVERGE from
// observed Lovable behaviour. Both their apps ignore the 46 components entirely and hand-build
// everything, including their overlays. Reproducing that faithfully would mean reproducing the
// accessibility holes it causes, so the rule points at the components for interactive widgets while
// keeping their raw-element approach for layout. Flip PREFER_COMPONENTS to false for a literal
// mirror — the comparison harness runs both ways.
export const PREFER_COMPONENTS = true;

export const LITERAL_MIRROR_COMPONENT_RULES =
  "COMPONENTS. Build everything from raw HTML elements styled with Tailwind. Do not import from " +
  "`@/components/ui/` — write the markup directly.";

export function buildPageRules({ preferComponents = PREFER_COMPONENTS } = {}) {
  return [
    OUTPUT_RULES,
    ROUTE_RULES,
    STYLE_RULES,
    LAYOUT_RULES,
    ACCESSIBILITY_RULES,
    DATA_RULES,
    preferComponents ? COMPONENT_RULES : LITERAL_MIRROR_COMPONENT_RULES,
    // Repeated at the end deliberately: it is the instruction most often lost in a long system prompt.
    "REMINDER: reply with `===FILE: …===` blocks and nothing else. Start with `===FILE:`.",
  ].join("\n\n");
}

// The plan step (their step 3). A model writes this before any page exists.
export const PLAN_RULES =
  "Plan the app before building it. Return the pages, their routes, and the database tables they " +
  "read and write. Keep it to what the brief actually asks for — no admin console unless the brief " +
  "implies staff, no auth unless something must be private to a person. " +
  "Name each page by its route file (`index.tsx`, `book.tsx`, `my-bookings.tsx`).";

// The schema step (their step 4) — and the ordering that matters. Lovable designs the database
// BEFORE writing pages; the existing isibi pipeline retro-fits a schema afterwards from whatever
// the pages guessed. This runs first so every page is written against a decided data model.
export const SCHEMA_RULES =
  "Design the database FIRST, before any page is written. Every page is then built against a data " +
  "model that already exists, instead of each page inventing its own field names. " +
  "Declare tables in `isibi.schema.json`. Encode the brief's rules as schema constraints, because " +
  "the database is the only enforcement that cannot be bypassed: a slot only one booking may hold " +
  "→ a partial `unique` on the slot columns; a value from a fixed set → `enum`; a must-fill field → " +
  "`required`; a record belonging to a parent → a `ref` column; bounds → `min`/`max`. " +
  "If a table is owner-scoped but a visitor must see which slots are taken, add a `publicView` " +
  "listing only the non-identifying columns — never widen the table's access to solve it.";

export default { buildPageRules, OUTPUT_RULES, ROUTE_RULES, STYLE_RULES, LAYOUT_RULES, ACCESSIBILITY_RULES, DATA_RULES, COMPONENT_RULES, PLAN_RULES, SCHEMA_RULES };
