// THE DOCUMENT ITSELF, not a fragment inside one.
//
// Under Start there is no `index.html` — the build emits none, measured — so
// this file IS the shell: `<html>`, `<head>`, `<body>`, produced per request.
// That is the change with the widest blast radius in the whole migration,
// because a static shell was what `writeIndexHtml` edited in the container,
// what `injectMeta` patched at publish, what carried the SEO manifest, and what
// the site's Worker spliced the render into.
//
// `lang` AND THE FAVICON COME FROM `site-brand.ts`, which the container already
// writes per build. They used to be applied by `applyIdentity` doing surgery on
// the shell's HTML; here they are ordinary props, so there is nothing to patch
// and nothing to get wrong with a regex.
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { SpamGuard } from "@/lib/spam-guard";
import { SITE_LANG, SITE_ICON } from "@/site-brand";
// The stylesheet and the site's typeface, imported here rather than in a client
// entry so the SERVER render emits their <link> tags too. Imported in
// `main.tsx` before this, where they reached the client only — which was fine
// while the server render was a throwaway snapshot and is not fine now that the
// browser hydrates it: an unstyled first paint is what the visitor sees.
import "../styles.css";
import "../fonts";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    links: [{ rel: "icon", href: SITE_ICON, type: "image/svg+xml" }],
  }),
  component: RootDocument,
});

// <HeadContent /> is what makes each route's `head: () => ({ meta })` block
// actually reach the document. Start renders it server-side; without it every
// page's title and og tags are computed and then silently thrown away.
//
// <Scripts /> is the other half and has no equivalent in the old shell: it
// emits the module tags that load the client bundle. `index.html` carried a
// hardcoded `<script src="/src/main.tsx">`; this emits the built, hashed names,
// which is also why `absolutizeAssets` stops being needed.
//
// <Toaster /> is mounted here because sonner's `toast()` queues into a
// container that has to exist somewhere in the tree. Every generated form
// reports success and failure through it, so without this the submit button
// works and the visitor is told nothing.
//
// <SpamGuard /> is mounted here rather than offered to the generator as a
// component, so a form cannot be built without it. It renders NOTHING and
// fetches no third-party script on a site whose owner has not configured
// Turnstile, which is almost all of them.
function RootDocument() {
  return (
    <html lang={SITE_LANG}>
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Toaster />
        <SpamGuard />
        <Scripts />
      </body>
    </html>
  );
}
