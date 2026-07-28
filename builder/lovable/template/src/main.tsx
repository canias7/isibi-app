import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ErrorPage } from "./lib/error-page";
import { installErrorReporting } from "./lib/error-reporting";
import "./styles.css";

// Anything that escapes React — an event handler, a timer, a rejected promise — reaches nothing
// unless it is hooked here, before the app mounts.
installErrorReporting();

// Hash history because published apps are served from a sub-path on object storage,
// where a deep link to /book has no server route to answer it.
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
  history: createHashHistory(),
  context: { queryClient },
  scrollRestoration: true,
  defaultErrorComponent: ErrorPage,
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
