# 2026-10-28 — The model can write the site's own server code (rails 1–3)

The owner: "the model should be able to write everything" (recorded in
`docs/owner-preferences.md`). Pages run in the visitor's browser and database
functions in the site's database; neither can hold a key and call an outside
service. This adds a third place: code for the site's own Worker.

## What was built (steps 1–3 of the plan)

1. **The place.** A site part named `server-<name>` is the site's server code.
   It lives under `src/routes/-parts/` (the directory the shared container wipes
   between sites; invisible to the route generator) and is reached at
   `/api/db/<site>/fn/<name>`, any method. Shape:
   `export const hosts = [...]` and `export default async function (request, site)`.
   Runtime: `builder/lovable/template/src/lib/site-functions.ts`, wired into
   `server.ts` before the error and job routes.
2. **The `site` helper (keys it can use, never see).** `site.key("NAME")` is a
   stand-in (`@@gfkey:NAME@@`); only `site.fetch` swaps it for the owner's key,
   on the way out to a host the module declared, over https, past the
   private-address guard, at most 10 calls per request, 30 s each.
   `site.sql` runs on the site's database login. 30 calls a minute per visitor
   per function. An answer, header or error that contains an owner's key value
   is withheld.
3. **The check before publishing** (`builder/server-code.mjs`, called in
   `publishPages` before photographs and the compile): a server part must have a
   default export and a plain `hosts` list, and may not import code, read
   `env`/`process`/the global object, build or load code at run time, call
   `fetch` directly, open sockets, or index into `site`. A failing part is left
   out of the build with a sentence for the reply; a page or component importing
   server code is named.

## Not done yet (the owner chose 1–3 for now)

- The model is not yet told about any of this (its instructions and the
  build/add-on tools): no build writes server code until it is.
- Hooks (on a form, on a payment, on a schedule), a failed check sent back to the
  model to fix, the Keys panel wording, and the live proof builds.

## Tests

`test/site-functions.test.mjs`, 7 cases: the key reaches only the declared host
and never the code; undeclared host, http, private address and missing key
refused with no call; the call cap; the route (own mark, 404, other slug, an
answer or error carrying a key withheld); the checker's pass and ten refusals,
prose ignored; vetting leaves a bad part out and names a leaking page; the
wiring in `server.ts` and `publishPages`. Kit typecheck 4/4 with the new file.
