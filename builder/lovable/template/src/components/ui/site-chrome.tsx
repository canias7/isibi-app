import * as React from "react";
import { SiteFooter, type SiteContact } from "@/components/ui/site-footer";
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
 * LINKS ARE ORDINARY PATHS — `{ label: "Book", href: "/book" }`. They go
 * through `SiteLink`, which routes an internal path with `<Link>` and leaves an
 * external address as a plain anchor, so the same value is correct at every
 * mount the bundle is served from: `/s/<slug>/` here, `/` on the site's own
 * subdomain, `/` again on the owner's domain.
 *
 * THEY WERE `#/...` UNTIL 2026-08-09 and this comment argued for it — a hash
 * WAS real client-side navigation while the app ran on `createHashHistory()`.
 * The router moved to browser history and the argument silently inverted: every
 * nav link on every generated site became a no-op that changed the fragment and
 * rendered nothing. It compiled, bundled and published, and could only be found
 * by clicking. A rule that is true because of something one layer down is a rule
 * that expires when that layer moves.
 *
 * Inside a page's own body prefer `<Link to="/book">` directly, which is typed
 * against the routes that exist and fails the build if the page was never
 * written.
 */
export function SiteChrome({
  name,
  tagline,
  links = [],
  action,
  contact,
  legal = [],
  social = [],
  children,
  className,
}: {
  /** The business's name, in the header and the footer. */
  name: string;
  /** One line under the name in the footer — what the business is. */
  tagline?: string;
  /** `{ label, href }` with ordinary paths: `{ label: "Book", href: "/book" }`. */
  links?: NavLink[];
  /** The one thing you want them to do, as a button in the header. */
  action?: { label: string; href?: string; onClick?: () => void };
  /** Phone, email, address, opening line — the footer's small print. */
  contact?: SiteContact;
  /** Privacy, Terms. Footer only, and separate from `links`, which is navigation. */
  legal?: NavLink[];
  /** `{ network, href }` — "instagram", "facebook", "email"… */
  social?: { network: string; href: string }[];
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

      {/* THE FOOTER TAKES CONTACT DETAILS AND THE HEADER DOES NOT, deliberately.
          The header holds one action; a phone number belongs there only when
          ringing IS the action, in which case it is a `links` entry or the
          `action` itself. Everything else — address, opening line, small print —
          is what somebody scrolls to the bottom for. */}
      <SiteFooter brand={name} tagline={tagline} links={links} contact={contact} legal={legal} social={social} />
    </div>
  );
}
