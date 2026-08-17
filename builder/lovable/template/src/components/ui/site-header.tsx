import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_LOGO } from "@/site-brand";

export type NavLink = { label: string; href: string };

/**
 * One nav destination, rendered as whichever kind of link it actually is.
 *
 * THIS COMPONENT EXISTS BECAUSE A PLAIN `<a href>` CANNOT BE RIGHT AT BOTH
 * MOUNTS. The same bundle is served at `/s/<slug>/` on gofarther.dev and at `/`
 * on `<slug>.gofarther.app` and on the owner's own domain, so `href="/book"` is
 * the site's booking page on two of those and the PLATFORM's `/book` on the
 * third. `<Link>` resolves against the router's basepath, so it is correct on all
 * three without this component knowing which it is on.
 *
 * That basepath is TanStack Start's `ROUTER_BASEPATH`, applied by
 * `createStartHandler` on the server and `hydrateStart` in the browser — which
 * is why `src/router.tsx` deliberately sets none. It was derived at runtime in
 * `main.tsx` before Start, from where the bundle had really been loaded from;
 * the conclusion for this file is the same either way, which is the point of
 * reading it off the router rather than computing it here.
 *
 * It used to be `href="#/book"`, and the comment here said a hash was "real
 * client-side navigation". That was true while the app ran on
 * `createHashHistory()` and stopped being true on 2026-08-09 when it moved to
 * browser history — at which point every nav link on every generated site
 * became a no-op that changed the URL fragment and rendered nothing. Nothing
 * caught it: it compiles, it bundles, it publishes, and it is only visible by
 * clicking.
 *
 * An EXTERNAL address still gets a plain anchor — an Instagram profile in the
 * footer is a real thing a business site has, and `<Link>` would try to route
 * it. `//evil.example` is deliberately NOT treated as internal: it starts with
 * a slash and the browser reads it as another origin, which is the one shape a
 * naive `startsWith("/")` gets wrong.
 */
export function SiteLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  // `href` IS REQUIRED AND CAN STILL ARRIVE EMPTY, which is why this reads it
  // defensively. `Row` carries an index signature, so a page building nav from
  // database rows — `links={rows.map((r) => ({ label: r.name, href: r.slug }))}`
  // — passes `undefined` for a column the owner has not filled in, and still
  // typechecks. Undefended, `href.startsWith` throws during render, and this
  // component is in the header AND the footer of every generated page: one
  // empty slug takes the whole site down through the error boundary, not just
  // the link.
  const to = typeof href === "string" ? href : "";
  const internal = to.startsWith("/") && !to.startsWith("//");
  if (internal) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }
  // `rel="noreferrer"` on anything leaving the site: without it the page we
  // open can reach back through `window.opener`.
  const offsite = /^[a-z][a-z0-9+.-]*:/i.test(to) && !/^(mailto|tel):/i.test(to);
  return (
    <a
      href={to}
      className={className}
      {...(offsite ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

/** The site's top bar, with a real mobile menu rather than links that vanish. */
export function SiteHeader({
  brand,
  links = [],
  action,
  className,
}: {
  brand: string;
  links?: NavLink[];
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <header className={cn("sticky top-0 z-40 border-b bg-background/85 backdrop-blur", className)}>
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
        {/* THE BUSINESS'S OWN LOGO, when it has attached one.
         *
         * IT REPLACES THE NAME RATHER THAN SITTING BESIDE IT, and the name
         * becomes the `alt`. Most small-business logos are lockups that already
         * contain the name, so showing both prints it twice — and the alt keeps
         * it for a screen reader, for a text browser, and for the case that
         * matters most here: the image failing to load, where the header falls
         * back to exactly what every site has today rather than to nothing.
         *
         * `max-w` is not decoration. A wide wordmark with no bound pushes the
         * nav off the right-hand edge, and the person who notices is a visitor
         * who cannot find the booking link. */}
        <SiteLink href="/" className="font-semibold tracking-tight">
          {SITE_LOGO ? (
            <img
              src={SITE_LOGO}
              alt={brand}
              className="h-7 w-auto max-w-[180px] object-contain"
            />
          ) : (
            brand
          )}
        </SiteLink>
        <nav className="ml-auto hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <SiteLink
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {l.label}
            </SiteLink>
          ))}
        </nav>
        {action && (
          <div className="ml-auto md:ml-0">
            <Button size="sm" asChild={!!action.href} onClick={action.onClick}>
              {action.href ? <SiteLink href={action.href}>{action.label}</SiteLink> : <span>{action.label}</span>}
            </Button>
          </div>
        )}
        {links.length > 0 && (
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="md:hidden" aria-label="Menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetTitle>{brand}</SheetTitle>
              <nav className="mt-6 flex flex-col gap-3">
                {links.map((l) => (
                  <SiteLink key={l.href} href={l.href} className="text-sm">
                    {l.label}
                  </SiteLink>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </header>
  );
}
