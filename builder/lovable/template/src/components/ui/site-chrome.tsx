import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The header and footer every page of a site shares.
 *
 * WHY THIS EXISTS. A generated site used to put its header inside the home page,
 * so the home page was a site and every other page was a bare document — no
 * name, no navigation, no way back. Measured on the reference pages themselves:
 * three of four had no chrome at all. It is the same argument as `DataList` —
 * the most repeated markup we generate should be a component, because getting it
 * wrong is invisible until somebody lands on the second page.
 *
 * `nav` IS A NODE AND NOT AN ARRAY OF PROPS, which looks like a lapse and is the
 * one honest option. TanStack types `<Link to>` as a union of the routes that
 * actually exist, so a `{ to: string }` prop would not compile without a cast —
 * and that cast would throw away the check that catches a link to a page the
 * site never built. The links stay in the page where they are typed; everything
 * around them lives here.
 *
 * The SKIP LINK is the reason this is worth a component even at one page. Every
 * keyboard user starts each page by tabbing through the whole header; two lines
 * fix it, and no generated page has ever written them.
 */
export function SiteChrome({
  name,
  nav,
  children,
  address,
  phone,
  note,
  className,
}: {
  /** The business's name, in the header and the footer. */
  name: string;
  /** The page's own typed <Link>s. */
  nav?: React.ReactNode;
  children: React.ReactNode;
  address?: string;
  phone?: string;
  /** A closing line — opening times, a licence number, "est. 1994". */
  note?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-svh flex-col bg-background text-foreground", className)}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>

      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">{name}</span>
          {nav && <nav className="flex items-center gap-5 text-sm">{nav}</nav>}
        </div>
      </header>

      {/* ONE <main> per page, and it is focusable so the skip link can land on
          it — a skip link pointing at something unfocusable moves the scroll and
          leaves the keyboard where it was. */}
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6 text-sm text-muted-foreground">
          <span>{address ?? name}</span>
          <div className="flex flex-wrap items-center gap-4">
            {note && <span>{note}</span>}
            {/* A real `tel:` link, because on the device most visitors are using
                it is the difference between a phone number and a phone call. */}
            {phone && (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="hover:text-foreground">
                {phone}
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
