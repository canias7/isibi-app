// The router, as TanStack Start wants it: ONE factory, called on both sides.
//
// Start imports this from `#tanstack-router-entry` and calls `getRouter()` in
// two places — `createStartHandler` on the server and `hydrateStart` in the
// browser — so the two can no longer drift. That is the point: `main.tsx` and
// `entry-server.tsx` each built their own router and they disagreed on purpose
// (memory history vs browser history, retry off vs the tuned policy), which was
// fine while the server render was a throwaway snapshot and is not fine now
// that the client HYDRATES it.
//
// NO BASEPATH. Start bakes `ROUTER_BASEPATH` at build time and OVERWRITES
// whatever is set here — `router.update({ basepath })` in `createStartHandler`
// on the server and in `hydrateStart` on the client — so a runtime-derived one
// is not an option. It does not need to be: the platform Worker strips
// `/s/<slug>/` before dispatch, and since the slug cleaner started refusing an
// edge hyphen every site has a pretty host, so `/` is the only mount there is.
// FIRST, AND THE ORDER IS THE WIRING. `pinSiteLocale` mutates the formatting
// built-ins, and it has to have done so before anything formats — so it is
// imported ABOVE `routeTree.gen`, which pulls in every page module. Below it, a
// page that formats at module scope would evaluate against the runtime's own
// locale on the server and the visitor's in the browser, which is the exact
// mismatch this exists to remove.
//
// THIS FILE IS THE ONE PLACE BOTH SIDES GO THROUGH: Start calls `getRouter()`
// from `createStartHandler` on the server and from `hydrateStart` in the
// browser, so a single import here covers the render and the hydration, and the
// two cannot disagree about the locale by construction.
import { pinSiteLocale } from "./site-locale";
pinSiteLocale();

import { createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";
import { ErrorPage } from "./lib/error-page";
import { NotFound } from "@/components/ui/not-found";

export function getRouter() {
  // The retry policy is tuned for THIS API rather than left at the library
  // default (3 retries, 1s/2s/4s backoff). That default meant a visitor watched
  // empty skeletons for 7.4 seconds before being told anything was wrong —
  // measured, not estimated — and it spent those retries even on answers that
  // can never change.
  //
  // A 4xx from the data API is a statement of fact: 403 for a `collect` table
  // that is not readable, 404 for a table or site that does not exist. Retrying
  // it is pure delay, so it fails immediately. A 5xx or a dropped connection is
  // worth retrying, because those do recover — just twice, and quickly.
  //
  // BUILT PER CALL, not module-scope. A Worker isolate serves many requests and
  // a shared client would leak one visitor's cache into the next one's page.
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

  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // The whole reason a thrown route does not white-screen: without it React
    // unmounts the tree and the visitor gets a blank page with the error only
    // in the console.
    defaultErrorComponent: ErrorPage,
    // Without this TanStack renders its own bare "Not Found" text — nine
    // characters on a white page, no site name, no way back (the render check
    // literally measured it as `blank: only 9 characters`). `homeHref` is a
    // bare "/" now that a site has exactly one mount.
    defaultNotFoundComponent: () => <NotFound homeHref="/" />,
    // `Wrap` goes around the WHOLE tree including the root route, so the query
    // client is in scope for a loader on any route. Mounting the provider
    // inside `__root.tsx`'s component instead would put it below the point
    // Start resolves route loaders from.
    Wrap: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
