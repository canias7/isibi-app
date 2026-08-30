// The fallback a visitor sees when a route throws. Mirrors Lovable's src/lib/error-page.ts, with the
// one change our stack forces: theirs is a raw HTML string because it is rendered by the server for
// a 500 response. Nothing renders our app but the browser, so ours is the router's
// defaultErrorComponent — which means it can use the app's own theme tokens instead of hard-coded
// greys, and it can offer a real "try again" that re-runs the route rather than reloading the page.
//
// It also REPORTS. React does not rethrow a boundary-caught error to window.onerror, so if this
// component stayed silent the single most common production failure would produce no signal at all.

import { useEffect } from "react";
// NO `Link`, DELIBERATELY — see the anchor below. A kit file that still imports
// it is one casual edit away from the TS2741 that cost run 82.
import { type ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { reportAppError } from "./error-reporting";

export function ErrorPage({ error, reset }: ErrorComponentProps) {
  useEffect(() => {
    reportAppError(error, "error_boundary");
  }, [error]);

  return (
    // `data-slot` SO THE RENDER CHECK CAN SEE A CRASH IT WOULD OTHERWISE MISS
    // (2026-08-24). This component is the reason the check was blind: React does
    // not rethrow a boundary-caught error, so `page.on("pageerror")` never
    // fires and the finding is `logged` rather than `threw`; and the card prints
    // ~109 characters of real text, comfortably over BLANK_TEXT_CHARS (40), so
    // it is not `blank` either. Measured on `the-lido-cafe`'s /book: the page
    // threw `useFormField should be used within <FormItem>` and the render
    // report would have called the site clean. A working safety net hiding the
    // fault from the one check that looks for it.
    //
    // AN ATTRIBUTE RATHER THAN THE COPY, and that is not tidiness: sites are
    // bilingual since 2026-08-19, so "This page didn't load" is translated on
    // every non-English site and a string match would go quietly blind on
    // exactly the sites nobody here reads. The attribute survives translation.
    <div data-slot="error-page" className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-muted-foreground">
          Something went wrong on our end. You can try again or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            {/* A PLAIN ANCHOR, NOT A ROUTER `Link` (2026-08-30, run 82).
                A generated page may declare `validateSearch` with REQUIRED
                fields on "/" — a configurator putting its timber and finish in
                the URL does exactly that — and the moment it does, every
                `<Link to="/">` in the KIT must supply `search` or stop
                compiling. That killed a real build in a file the model never
                saw and could not fix, and salvage rightly refused to stub it:
                "the error is in a file the build didn't write".
                An href does not participate in the route's search contract, so
                no page can ever break it. This is an ERROR BOUNDARY besides —
                the app is already in a bad state, and a full reload is the
                safer way home than a client-side navigation. */}
            <a href="/">Go home</a>
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
