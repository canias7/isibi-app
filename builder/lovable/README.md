# Lovable clone — a parallel pipeline

A step-for-step mirror of how Lovable builds an app, kept **alongside** the existing pipeline so the
two can be run on the same brief and compared. Nothing in `builder/` outside this directory is
affected by anything in here.

Reconstructed from two real Lovable outputs (a barbershop booker and a theatre seat picker) plus
shadcn's own registry, all read directly rather than from memory.

## What Lovable actually does

1. **Clarify** — a cheap model asks two or three questions.
2. **Copy a fixed template** — Vite + React + Tailwind, 46 shadcn components, the shadcn theme,
   Supabase client, TanStack Router. Identical in every project.
3. **Plan** — the model writes out the pages, routes and tables it intends to build.
4. **Database first** — the model writes `CREATE TABLE` and RLS policies as SQL, then a security
   linter reads the policies back looking for holes.
5. **Generate pages** — one complete file per route, streamed.
6. **Build and repair** — compile, feed errors back, patch.
7. **Preview and iterate** — follow-ups are targeted edits to named files.

## What the two apps prove about the template

Diffing their barbershop against their seat picker: **66 of the 73 shared files are byte-identical.**
That is the fixed template. The seven that differ are what the model writes per app:

| file | why it differs |
|---|---|
| `src/routes/index.tsx` | the page itself |
| `src/routes/__root.tsx` | **the app shell** — header, nav, site-wide meta, favicon, webfont `<link>`s |
| `src/styles.css` | this app's own tokens (`--color-tier-premium`, `--font-display: Fraunces`) |
| `package.json`, `bun.lock` | deps differ (the barbershop pulls in Supabase; the seat picker does not) |
| `src/routeTree.gen.ts` | generated from the routes, so it follows them |
| `src/start.ts` | one line — the barbershop attaches Supabase auth middleware |

`__root.tsx` being per-app matters: it is where `--font-display` is actually **loaded** from Google
Fonts. A theme token without the matching `<link>` falls back silently, so the two files have to be
written together.

Worth noting as a quality data point: the seat picker's `__root.tsx` still says
`title: "Lovable App"` and `description: "Lovable Generated Project"`. Their pipeline customised
every page's own meta and left the site-wide fallback as the placeholder.

## The finding that shaped this template

**Neither sample app imports a single shadcn component.** Both ship 46 and use zero — nine route
files across the two apps, and every import is React, TanStack or Supabase. The apps are built from
raw `<div>`/`<button>` with Tailwind classes.

What they *do* use everywhere is the shadcn **theme**: `bg-background`, `text-muted-foreground`,
`bg-card`, `border-border`. So the components are effectively the delivery mechanism for the token
vocabulary, plus provisioning for whoever downloads the repo later.

Both are reproduced here, because the point is to mirror what they do, not to improve on it.

## The build service

`Dockerfile` + `build-server.mjs`, deliberately separate from `builder/Dockerfile` — the two stacks
cannot share an image (React 19 + Tailwind v4 + TanStack Router here, React 18 + Tailwind v3 +
react-router there). Same HTTP contract, so the Worker can talk to either.

Three differences forced by the stack: `tsr generate` runs before vite (the route tree is derived
and absent from a clean checkout), there is no `tailwind.config.js`/`postcss.config.js` under
Tailwind v4, and the config is `vite.config.ts`.

One addition neither service had: **a runtime smoke check**. esbuild does not resolve names, so a
page referencing an undefined variable compiles cleanly and then white-screens. Every route is
loaded headlessly after the build and a crash fails it, which puts the error in front of the repair
loop instead of a customer. Lovable's equivalent (`lib/lovable-error-reporting.ts`) catches the same
class of fault in production instead.

Getting that check to actually fire took two fixes worth remembering: **React 19 does not rethrow a
render error to `window.onerror`**, it logs it — so `pageerror` never fires — and the app shell
still renders around the broken page, so "did anything mount" misses it too. The reliable signal is
a console error carrying a real exception name, with network failures excluded because the smoke
test runs with no backend reachable.

## Deliberate divergences

| | Lovable | here | why |
|---|---|---|---|
| SSR | TanStack Start + nitro | client-rendered SPA | published apps are static files on R2; there is no per-app server |
| routing history | browser | hash | same reason — a deep link to `/book` has no server route to answer it |
| database | Supabase (Postgres) | D1 (SQLite) | per-app Postgres provisioning is an infra and billing change, not a code change |
| package manager | bun | npm (`--legacy-peer-deps`) | `@hookform/resolvers` has an optional-peer conflict npm resolves differently than bun |
| `routeTree.gen.ts` | committed | gitignored, generated by `tsr generate` before every build | a committed generated file goes stale silently; generating it also fixed a real clean-checkout build failure |

Everything else — React 19, Tailwind v4 CSS-first, file-based routing, the 46 components, the token
values, `components.json` — is theirs verbatim.

## Layout

```
template/          the fixed template, copied per build
  src/components/ui/       46 shadcn components, exactly as Lovable ships them
  src/styles.css           the shadcn theme: 87 tokens, oklch, light + dark
  src/routes/              file-based routing (__root.tsx is written per app)
  src/integrations/db/     the data client + row types generated from the schema
rules.mjs          the generation rules, derived from reading their output
pipeline.mjs       clarify → plan → schema → theme → shell → pages → build → repair
check-clone.mjs    keeps the rules true against the template
smoke/             pages that mount all 46 components; proves the template behaves
*.test.mjs         pipeline order (stub model) and end to end (real build + browser)
```

## The data client

Their template ships `@/integrations/supabase/client` plus a generated `types.ts`, and every page
reads through it. Ours ships `@/integrations/db/client` with deliberately the same ergonomics —
`db.from('bookings').select().eq(...)`, `{ data, error }` on every result — over the isibi per-app
REST API, because that is the shape a model reaches for by default.

`db.publicFrom(table)` reads a table's declared `publicView`: the PII-filtered projection a
signed-out visitor may see. That is the equivalent of the `busy_slots` function in their barbershop.

Row types in `src/integrations/db/types.ts` are generated from `isibi.schema.json` for zero tokens,
mirroring theirs (stamped "This file is automatically generated"). Verified to catch a column typo
and an out-of-enum write at compile time, while an unknown table still falls back to `any` so a
build never dies over a table the schema has not caught up with.

## Verified

`npm install --legacy-peer-deps` · `vite build` clean · 17 components render · the dialog traps
focus, moves focus inside on open, and closes on Escape · no console errors · light and dark both
render from the token set.
