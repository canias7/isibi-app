# The page generator — contract

What the generator must emit, derived from the working reference page at
`lovable/template/src/routes/index.tsx`. That file is the spec; this document
is why it looks the way it does. When the two disagree, the file wins.

## Where it sits

```
brief ──► designSiteSchema ──► isibi.schema.json ──► real Postgres tables   ✅ live
                     │
                     └──────► generateSitePages ──► route files ──► vite build ──► R2
                                    ▲                                   ▲
                             THIS DOC, and                    builder/Dockerfile +
                          builder/page-gen.mjs                builder/build-server.mjs
```

All of it is wired into `POST /api/site/react-build`. The generator's deterministic
half — the rules, the tool, and the checks below — lives in `builder/page-gen.mjs`
and is tested by `test/page-gen.test.mjs`. What is DONE with those checks — pay for
a repair pass, keep the retry or not, publish or fall back to the placeholder — is
`builder/publish-pages.mjs`, tested by `test/publish-pages.test.mjs` against injected
fakes. The compile step is proved end to end by `test/integration/site-build.mjs`.
`worker.js` holds only the model call and the wiring.

The schema is designed **first** and is the generator's input. The generator
never invents a table, a column, or an access level — it can only use what the
schema declares, because those are the only things that exist in the database.

## Hard rules

1. **No fetch code in a page.** Read with `useRows`, write with `useCreateRow`
   from `@/lib/rows`. A page that calls `fetch` is wrong.

2. **Respect the access level.** This is not stylistic — the API enforces it:

   | level | page may | if you get it wrong |
   |---|---|---|
   | `display` | list/read it | a write gets 403 |
   | `collect` | submit a form to it | a read gets 403 |
   | `user` | read and write its OWN rows, signed in | 401 signed out |
   | `feed` | read every row, write its own — signed in | 401 signed out |
   | `admin` | read signed in; write only with the role | 401 signed out, 403 wrong role |

   **Visitor accounts were DELETED on 2026-07-30** when identity moved to Neon
   Auth, and the replacement is not wired yet. So the three member levels answer
   **401 to everybody** — the API has no way to tell who is asking — and there is
   no hook to sign anyone in with. Never build a login, a sign-up or an account
   page; if a schema somehow carries a member table, leave it alone rather than
   rendering an error where a sign-in used to go. The access rules still live in
   `site-access.mjs` and are still imported by both the API that enforces them and
   the lint that predicts them, so the two cannot disagree.

   So a menu comes from a `display` table, and a booking form writes to a
   `collect` table. **Never render a list from a `collect` table** — those rows
   are other people's submissions and the API will refuse.

3. **shadcn for every control.** Import from `@/components/ui/*`. Never
   hand-roll a button, input, select or dialog.

4. **Forms are react-hook-form + zod**, through shadcn's `Form`/`FormField`.
   TanStack Form is installed but shadcn's form components do not speak to it —
   mixing them produces inputs that silently do not validate.

5. **The zod schema mirrors the declared columns.** The API drops anything
   undeclared, so a field the schema does not have will vanish without an error.

6. **Never write a managed column.** `id`, `created_at`, `owner_id`, `_fts`,
   `_version`, `position`, `deleted_at` are set by the engine and are silently
   dropped from any write.

## Every list must handle four states

The reference page shows all four. A generated page that omits them looks fine
in a screenshot and broken in use:

- `isPending` → `<Skeleton />`, not a spinner and not nothing
- `isError` → a sentence a visitor can act on
- empty → say so; do not render an empty grid
- loaded → the rows

## Every form must

- disable its submit button while `isPending`
- `toast.success` and `form.reset()` on success
- `toast.error(e.message)` on failure — **the API's own message**, not a generic
  one. It distinguishes the caller's fault from a server fault and returns
  `code` for `duplicate`, `overlap`, `bad_ref` and `full`. "That time is already
  taken" is useful; "something went wrong" is not.

## Routing

File-based, TanStack Router. `src/routes/index.tsx` is `/`. A new page is a new
file exporting `createFileRoute("/path")({ component })`. `tsr generate` runs
before build — the generator does not write `routeTree.gen.ts`.

## Definition of done

A generated site is finished when `npx tsc --noEmit` is clean and `npx vite
build` succeeds. Both run in the build container; neither is optional. The
reference page builds at ~122 kB gzipped — a wildly larger bundle means
something was imported that should not have been.

## Not available yet

- **Changing a `display` table's content FROM A PAGE.** Writes to `display` are
  403 for every caller on the public API, and that has not changed — a visitor
  must never edit the menu. What changed on 2026-07-28 is that the *owner* can,
  through their own door (`/api/site/<slug>/rows/...`, an isibi session rather
  than a site one) and its panel in the builder. So a café corrects a price
  without rebuilding — but **not from a generated page**, and never from a page
  a visitor can reach. Keep generating `display` tables as read-only.
  The schema designer also ships starter rows in `seed`, inserted at build time,
  so a site is populated on arrival. (Before seeding, on 2026-07-28, every
  generated site launched with an empty list AND a form nobody could submit,
  because its required Service select read that empty table.) Still generate the
  empty state: seeding is best-effort, and a table can legitimately end up with
  no rows.
- **Visitor accounts** — built 2026-07-28, **deleted 2026-07-30**. Identity moved
  to Neon Auth and the hand-built layer went with it: `@/lib/rows` exports no
  `useMember`, no `useLogin`, no `useSignup`, no sessions, no passkeys. A member
  table is unreachable until it is rewired. Build with `collect` and `display`.
- **Editing or deleting rows** — `useUpdateRow`/`useDeleteRow` exist and needed a
  signed-in member, so they are unusable for now too: `collect` and `display` rows
  have no owner and never could be changed from a page. For the one case this
  actually served — somebody returning to the form they filled in — use the claim
  link (`useClaimedRow` / `useCancelClaim`), which needs no account at all.
- ~~File upload~~ — **built 2026-07-28, both halves.** The OWNER uploads from the
  builder's Data panel; a VISITOR can attach one to a form via `useUploadFile`, but
  **only when that table declares an image column** — a form of six text fields
  cannot upload at all, and asking gets a 403. Either way the value is a URL in a
  plain text column, so the row write stays plain JSON. PNG/JPEG/WebP/GIF only,
  SVG refused, 2 MB for a visitor. Guard `display` images: the owner fills those in
  after the build, so on a fresh site the value is empty.

If a brief needs one of these, generate what is possible and say plainly what
was left out. Do not generate UI that cannot work.
