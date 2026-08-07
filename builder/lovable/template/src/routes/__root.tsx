import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { SpamGuard } from "@/lib/spam-guard";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  component: RootLayout,
});

// <HeadContent /> is what makes each route's `head: () => ({ meta })` block actually reach the
// document. TanStack Start renders it for you server-side; this app is a client-rendered SPA, so
// without it every page's title and og tags are computed and then silently thrown away.
//
// <Toaster /> is mounted here for the same reason: sonner's `toast()` queues into a container
// that has to exist somewhere in the tree. Every generated form reports success and failure
// through it, so without this the submit button works and the visitor is told nothing.
//
// <SpamGuard /> is mounted here rather than offered to the generator as a component, so a form
// cannot be built without it. It renders NOTHING and fetches no third-party script on a site whose
// owner has not configured Turnstile, which is almost all of them.
function RootLayout() {
  return (
    <>
      <HeadContent />
      <Outlet />
      <Toaster />
      <SpamGuard />
    </>
  );
}
