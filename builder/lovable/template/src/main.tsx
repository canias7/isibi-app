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
const queryClient = new QueryClient();
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
