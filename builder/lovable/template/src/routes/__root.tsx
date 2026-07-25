import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

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
function RootLayout() {
  return (
    <>
      <HeadContent />
      <Outlet />
    </>
  );
}
