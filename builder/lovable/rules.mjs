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

export const ROUTE_RULES =
  "FILE-BASED ROUTING. One file per page under `src/routes/`. `index.tsx` is `/`, `book.tsx` is " +
  "`/book`, `users/$id.tsx` is `/users/:id` (bare `$`, no braces), `_layout.tsx` is a layout route, " +
  "`__root.tsx` is the app shell and already exists — don't rewrite it. NEVER create `src/pages/`, " +
  "`app/layout.tsx`, or any Next.js/Remix convention. `src/routeTree.gen.ts` is generated; never " +
  "write or import it directly. " +
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
  "DATA. Read and write through TanStack Query (`useQuery`, `useMutation`), which is already " +
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
    ROUTE_RULES,
    STYLE_RULES,
    LAYOUT_RULES,
    ACCESSIBILITY_RULES,
    DATA_RULES,
    preferComponents ? COMPONENT_RULES : LITERAL_MIRROR_COMPONENT_RULES,
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

export default { buildPageRules, ROUTE_RULES, STYLE_RULES, LAYOUT_RULES, ACCESSIBILITY_RULES, DATA_RULES, COMPONENT_RULES, PLAN_RULES, SCHEMA_RULES };
