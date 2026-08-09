// Render a route to HTML at BUILD time, so a published page is a real document.
//
// Until this existed, a published site was an empty `<div id="root">` plus a
// bundle. Google runs JavaScript so it got there eventually; a link preview does
// not, so every page shared on WhatsApp, iMessage or Slack showed whatever the
// home page's tags said. This produces the first frame of each page as HTML,
// which is what both of them actually want.
//
// NOT HYDRATION, deliberately. `main.tsx` still calls `createRoot`, so React
// throws this markup away and renders for real on mount. Hydrating instead would
// be faster by a frame and would make every difference between the server render
// and the client render a bug class — on 500+ components we do not control the
// runtime assumptions of. This way a prerender that comes out wrong can only
// ever make a snapshot wrong; the live page is unaffected.
//
// WHAT THE SNAPSHOT CONTAINS is the first paint: headings, copy, nav, the form,
// the words the model wrote. Rows come from the data API at runtime, so lists
// appear in their loading state — which is correct, since a snapshot of somebody
// else's data would go stale the moment they edited a price.
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter, createMemoryHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ErrorPage } from "./lib/error-page";

export async function render(pathname: string): Promise<string> {
  // A FRESH CLIENT PER ROUTE, and `retry: false`. There is no network here and
  // nothing awaits a query, so a retrying client would only schedule timers in a
  // process that is about to exit; a shared one would leak one route's cache
  // into the next page's snapshot.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const router = createRouter({
    routeTree,
    // Memory history, so this needs no `window` and no basepath: the path is
    // handed in directly. The basepath only matters in a browser, where
    // `main.tsx` derives it from where the bundle was really loaded from.
    history: createMemoryHistory({ initialEntries: [pathname] }),
    context: { queryClient },
    defaultErrorComponent: ErrorPage,
  });
  // AWAITED, and without it every page came out as ZERO BYTES. A router that
  // has not loaded has no resolved match, so `renderToString` walks an empty
  // tree and returns "" — silently, with no error anywhere. Measured on the
  // first run: four routes, four empty strings.
  await router.load();
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
