// The fallback a visitor sees when a route throws. Mirrors Lovable's src/lib/error-page.ts, with the
// one change our stack forces: theirs is a raw HTML string because it is rendered by the server for
// a 500 response. Nothing renders our app but the browser, so ours is the router's
// defaultErrorComponent — which means it can use the app's own theme tokens instead of hard-coded
// greys, and it can offer a real "try again" that re-runs the route rather than reloading the page.
//
// It also REPORTS. React does not rethrow a boundary-caught error to window.onerror, so if this
// component stayed silent the single most common production failure would produce no signal at all.

import { useEffect } from "react";
import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { reportAppError } from "./error-reporting";

export function ErrorPage({ error, reset }: ErrorComponentProps) {
  useEffect(() => {
    reportAppError(error, "error_boundary");
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-muted-foreground">
          Something went wrong on our end. You can try again or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link to="/">Go home</Link>
          </Button>
        </div>
        {import.meta.env.DEV && (
          <pre className="mt-6 overflow-x-auto rounded-md border border-border bg-muted p-3 text-start text-xs text-muted-foreground">
            {error instanceof Error ? (error.stack ?? error.message) : String(error)}
          </pre>
        )}
      </div>
    </div>
  );
}
