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

## The finding that shaped this template

**Neither sample app imports a single shadcn component.** Both ship 46 and use zero — nine route
files across the two apps, and every import is React, TanStack or Supabase. The apps are built from
raw `<div>`/`<button>` with Tailwind classes.

What they *do* use everywhere is the shadcn **theme**: `bg-background`, `text-muted-foreground`,
`bg-card`, `border-border`. So the components are effectively the delivery mechanism for the token
vocabulary, plus provisioning for whoever downloads the repo later.

Both are reproduced here, because the point is to mirror what they do, not to improve on it.

## Deliberate divergences

| | Lovable | here | why |
|---|---|---|---|
| SSR | TanStack Start + nitro | client-rendered SPA | published apps are static files on R2; there is no per-app server |
| routing history | browser | hash | same reason — a deep link to `/book` has no server route to answer it |
| database | Supabase (Postgres) | D1 (SQLite) | per-app Postgres provisioning is an infra and billing change, not a code change |
| package manager | bun | npm (`--legacy-peer-deps`) | `@hookform/resolvers` has an optional-peer conflict npm resolves differently than bun |

Everything else — React 19, Tailwind v4 CSS-first, file-based routing, the 46 components, the token
values, `components.json` — is theirs verbatim.

## Layout

```
template/          the fixed template, copied per build
  src/components/ui/   46 shadcn components, exactly as Lovable ships them
  src/styles.css       the shadcn theme: 87 tokens, oklch, light + dark
  src/routes/          file-based routing
smoke/             a page importing 17 components; proves the template compiles and behaves
```

## Verified

`npm install --legacy-peer-deps` · `vite build` clean · 17 components render · the dialog traps
focus, moves focus inside on open, and closes on Escape · no console errors · light and dark both
render from the token set.
