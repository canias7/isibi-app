import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { LangSwitch } from "@/components/ui/lang-switch";
import { SITE_LANGS } from "@/site-brand";
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
/**
 * THE FRAME'S OWN ARRANGEMENT — three decisions that were hardcoded.
 *
 * `SiteHeader` took brand/links/action and nothing else, and set `h-14`,
 * `max-w-6xl`, `ms-auto` and `sticky` itself. So "centre our logo", "run the
 * header full width" and "stop the menu following me down the page" had no path
 * at ANY price: not by typing, and not by rebuilding either, because there was
 * no slot to fill. `className` could not reach it — `SiteChrome` puts that on
 * the outer div, and 0 of 329 corpus pages pass one.
 *
 * ENUMS, NOT VALUES, the rule the 17 style axes already live under: there is no
 * "slightly wider header", and a free-form class reaching this component is a
 * way to break every page of a site at once.
 *
 * HEIGHT IS DELIBERATELY NOT HERE. It reads like a fourth axis and it is a
 * coupling: a centred brand stacks onto two rows, where a fixed height either
 * clips it or leaves a gap. The `density` style axis already moves spacing
 * site-wide, which is what "make it slimmer" usually means.
 *
 * `| (string & {})` IS LOAD-BEARING AND MUST NOT BE TIDIED AWAY. A page writes
 * its frame as `const CHROME = { ..., layout: { brand: "centre" } }` and spreads
 * it — 261 of the 318 exemplars use exactly that shape — and a `const` object's
 * property widens to `string`, which a bare union REFUSES. Measured: the plain
 * union fails `TS2322` on the reference pages, so a customer asking to centre
 * their logo would lose the whole site to a failed typecheck. The arm accepts
 * the widening while keeping both names visible to the model reading
 * `COMPONENT_API`, and an unrecognised value falls back to the default
 * arrangement below rather than rendering something broken. The real gate on
 * what may arrive is the nav tool's own `enum`, which is in code.
 */
export type SiteLayout = {
  /** "left" (default), or "centre" to stack the brand above the menu. */
  brand?: "left" | "centre" | (string & {});
  /** "contained" (default) caps the frame at the page width; "full" runs edge to edge. */
  width?: "contained" | "full" | (string & {});
  /** false stops the header following the reader down the page. Default true. */
  sticky?: boolean;
  /**
   * true draws a rule under the header and above the footer. Default FALSE —
   * and this one defaults the opposite way to `sticky` above, deliberately.
   *
   * These three rules were hardcoded and nobody could turn them off. Under a
   * theme that paints a background they read as clutter slicing one continuous
   * page into slabs, which is the same judgement `bandClearCss` already acts on
   * — "sections separate by spacing and type, not by tone". The header carries
   * `bg-background/85 backdrop-blur`, so it is a distinct band without a line.
   *
   * OFF BY DEFAULT IS A CHANGE, not a preserved behaviour: every published site
   * loses its rules on its next publish. Owner's call, 2026-08-19.
   */
  divider?: boolean;
};

export function SiteHeader({
  brand,
  links = [],
  action,
  layout,
  className,
}: {
  brand: string;
  links?: NavLink[];
  action?: { label: string; href?: string; onClick?: () => void };
  layout?: SiteLayout;
  className?: string;
}) {
  // ABSENT MEANS TODAY'S BEHAVIOUR, which is what makes this safe against every
  // site already published: `sticky` defaults ON, so only an explicit `false`
  // turns it off.
  const centred = layout?.brand === "centre";
  const wide = layout?.width === "full";
  const sticky = layout?.sticky !== false;
  // Strictly `=== true`: an absent divider is OFF, and so is anything merely
  // truthy arriving from a stored layout.
  const divider = layout?.divider === true;
  return (
    <header className={cn(sticky && "sticky top-0 z-40", divider && "border-b", "bg-background/85 backdrop-blur", className)}>
      {/* CENTRING IS FLEX-WRAP, NOT A SECOND LAYOUT. The brand takes a full row
          and everything else wraps below it and centres — so the nav, the button
          and the mobile menu button are rendered ONCE and read the same on both
          arrangements. Two branches of duplicated JSX is how one of them stops
          getting the next fix. */}
      <div className={cn("mx-auto flex items-center gap-4 px-6",
        wide ? "max-w-none" : "max-w-6xl",
        centred ? "flex-wrap justify-center py-3" : "h-14")}>
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
        <SiteLink href="/" className={cn("font-semibold tracking-tight", centred && "w-full text-center")}>
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
        <nav className={cn("hidden items-center gap-6 md:flex", !centred && "ms-auto")}>
          {links.map((l) => (
            <SiteLink
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {l.label}
            </SiteLink>
          ))}
          {/* RENDERED BY THE HEADER, not passed in. A switcher a page has to
              remember is one it eventually forgets, and forgetting it leaves a
              bilingual site whose second language is reachable only by typing a
              URL. It renders nothing at all on a site with one language, so no
              existing header changes. */}
          <LangSwitch />
        </nav>
        {action && (
          <div className={cn(!centred && "ms-auto md:ms-0")}>
            <Button size="sm" asChild={!!action.href} onClick={action.onClick}>
              {action.href ? <SiteLink href={action.href}>{action.label}</SiteLink> : <span>{action.label}</span>}
            </Button>
          </div>
        )}
        {/* THE SHEET IS THE ONLY PLACE THE SWITCHER EXISTS ON A PHONE, because
            the nav above it is `hidden md:flex`. Gated on links alone, a
            one-page bilingual site had a header with no way at all to reach its
            other language on the device most of these visitors use.
            `SITE_LANGS` is a build-time constant, so on a site with one language
            this condition is exactly what it was. */}
        {(links.length > 0 || SITE_LANGS.length > 1) && (
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
                {/* AND IN THE SHEET, because the desktop nav is `hidden md:flex`
                    — without this the switcher is invisible on a phone, which is
                    where most visitors to these sites are. */}
                <LangSwitch className="mt-2" />
              </nav>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </header>
  );
}
