import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ErrorPage } from "./lib/error-page";
import { installErrorReporting } from "./lib/error-reporting";
import { NotFound } from "@/components/ui/not-found";
import "./styles.css";
// The site's typeface. Generated per build — see build-server.mjs writeFonts().
import "./fonts";

// Anything that escapes React — an event handler, a timer, a rejected promise — reaches nothing
// unless it is hooked here, before the app mounts.
installErrorReporting();

// WHERE THIS APP IS MOUNTED, WORKED OUT AT RUNTIME.
//
// It used to run on `createHashHistory()`, because a published app is served from
// a sub-path on object storage and a deep link to /book had no server route to
// answer it. The Worker answers one now, so pages can have real addresses — which
// they need: a fragment never reaches a server, so with hash routing a search
// engine saw ONE page per site, every shared link previewed the home page, and
// every visit in a site's life was logged as "/".
//
// THE BASEPATH CANNOT BE BAKED IN, and that is the whole difficulty. The same
// bundle is served at `/s/<slug>/` on our own domain AND at `/` on the owner's
// custom domain — the Worker rewrites the Host — so a build-time constant would
// be wrong on one of them. It is derived from where THIS MODULE was loaded from
// instead: vite emits assets under `<root>/assets/`, so the app root is one level
// above this file, whatever the site is being served as. Same reason
// `vite.config` keeps `base: "./"`.
//
// `new URL("../", import.meta.url)` is resolved by the browser against the real
// script URL, so it needs no knowledge of the slug and cannot disagree with the
// server about it.
const basepath = (() => {
  try {
    const p = new URL("../", import.meta.url).pathname;
    return p.endsWith("/") ? p.slice(0, -1) || "/" : p;
  } catch {
    // A runtime with no import.meta.url is not one we ship to, but a router that
    // throws here would take the whole site down rather than mis-route it.
    return "/";
  }
})();
//
// The retry policy is tuned for THIS API rather than left at the library default
// (3 retries, 1s/2s/4s backoff). That default meant a visitor watched empty
// skeletons for 7.4 seconds before being told anything was wrong — measured, not
// estimated — and it spent those retries even on answers that can never change.
//
// A 4xx from the data API is a statement of fact: 403 for a `collect` table that
// is not readable, 404 for a table or site that does not exist. Retrying it is
// pure delay, so it fails immediately. A 5xx or a dropped connection is worth
// retrying, because those do recover — just twice, and quickly.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as Error & { status?: number }).status;
        if (status !== undefined && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2000),
    },
  },
});
// defaultErrorComponent is the whole reason a thrown route does not white-screen: without it React
// unmounts the tree and the visitor gets a blank page with the error only in the console.
const router = createRouter({
  routeTree,
  // No `history` — the default is browser history, so pages get real addresses.
  basepath,
  context: { queryClient },
  scrollRestoration: true,
  defaultErrorComponent: ErrorPage,
  // Without this TanStack renders its own bare "Not Found" text — nine
  // characters on a white page, no site name, no way back (the render check
  // literally measured it as `blank: only 9 characters`). The kit has had a
  // proper not-found page all along; this is the one line that had never
  // mounted it. `homeHref` carries the basepath because the same bundle serves
  // at `/s/<slug>/` and at `/` — a bare "/" would send a workspace-mounted
  // visitor to the platform's root instead of the site's.
  defaultNotFoundComponent: () => (
    <NotFound homeHref={basepath.endsWith("/") ? basepath : basepath + "/"} />
  ),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
