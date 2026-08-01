import * as React from "react";
import { SiteFooter } from "@/components/ui/site-footer";
import { SiteHeader, type NavLink } from "@/components/ui/site-header";
import { cn } from "@/lib/utils";

/**
 * The frame every page of a site sits in.
 *
 * WHY IT EXISTS. A generated site used to put its header inside the home page,
 * so the home page was a site and every other page was a bare document — no
 * name, no navigation, no way back. Measured on the reference pages themselves:
 * three of four had no chrome at all.
 *
 * IT COMPOSES `SiteHeader` AND `SiteFooter` RATHER THAN REDRAWING THEM. The
 * first version of this file hand-wrote both, and they were worse than the ones
 * already in the kit — `SiteHeader` is sticky, blurs what scrolls under it, and
 * carries a real mobile menu in a Sheet rather than links that vanish under
 * `md`. Rebuilding a component that already exists is the mistake this whole
 * layer is meant to stop.
 *
 * WHAT IT ADDS is the three things neither of them can own alone: a SKIP LINK,
 * the page's single `<main>`, and the column that pins the footer to the bottom
 * on a short page. The skip link is the reason this is worth a component even at
 * one page — every keyboard user starts each page by tabbing through the whole
 * header, two lines fix it, and no generated page has ever written them.
 *
 * LINKS ARE `#/...` HREFS, and that is not a compromise: the app uses hash
 * history, so a hash anchor is real client-side navigation. Measured — no page
 * load, window state survives, the router renders the new route. (`href="/"` is
 * NOT: that is a full reload to the server root, which on a published site is
 * the platform rather than the site.) Inside a page's own body prefer
 * `<Link to="/book">`, which is typed against the routes that exist and fails
 * the build if the page was never written.
 */
export function SiteChrome({
  name,
  tagline,
  links = [],
  action,
  children,
  className,
}: {
  /** The business's name, in the header and the footer. */
  name: string;
  /** One line under the name in the footer — what the business is. */
  tagline?: string;
  /** `{ label, href }`, with hash hrefs: `{ label: "Book", href: "#/book" }`. */
  links?: NavLink[];
  /** The one thing you want them to do, as a button in the header. */
  action?: { label: string; href?: string; onClick?: () => void };
  children: React.ReactNode;
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

      <SiteHeader brand={name} links={links} action={action} />

      {/* ONE <main> per page, and it is focusable so the skip link can land on
          it — a skip link pointing at something unfocusable moves the scroll and
          leaves the keyboard where it was. */}
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>

      <SiteFooter brand={name} tagline={tagline} links={links} />
    </div>
  );
}
