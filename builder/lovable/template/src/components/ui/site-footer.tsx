import { SiteLink, type NavLink, type SiteLayout } from "@/components/ui/site-header";
import { SocialLinks } from "@/components/ui/social-links";
import { cn } from "@/lib/utils";

/** The details a visitor looks at the bottom of a page to find. */
export type SiteContact = {
  /** Rendered as a `tel:` link — see the note on `telHref`. */
  phone?: string;
  /** Rendered as a `mailto:` link. */
  email?: string;
  /** Free text. Newlines become line breaks, so a postal address reads as one. */
  address?: string;
  /** ONE LINE — "Mon–Sat 9–6". A real timetable belongs in a table on the page. */
  hours?: string;
};

/**
 * A PHONE NUMBER THAT IS NOT TAPPABLE IS THE COMMONEST SMALL-BUSINESS FOOTER
 * FAULT, and most visitors to one of these sites are on a phone. So the caller
 * supplies the number as a person writes it and the link is derived here,
 * rather than being a second prop somebody can get wrong or forget.
 *
 * Everything but digits and a leading `+` is stripped, which is exactly what
 * `tel:` wants. A number written "0113 200 0000", "(0113) 200-0000" or
 * "+44 113 200 0000" all dial correctly; the DISPLAYED text is never touched,
 * because how a business writes its own number is a local convention and
 * normalising it would be us overruling them on their own page.
 */
function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  // A leading + is meaningful and one in the middle is not, so only the first
  // character may keep it.
  return "tel:" + (cleaned.startsWith("+") ? "+" + cleaned.slice(1).replace(/\+/g, "") : cleaned.replace(/\+/g, ""));
}

/** The bottom of every page: the business, how to reach it, some links, the year. */
export function SiteFooter({
  brand, tagline, links = [], contact, legal = [], social = [], layout, className,
}: {
  brand: string;
  tagline?: string;
  links?: NavLink[];
  /** Phone, email, address, opening line — the small print a visitor scrolls for. */
  contact?: SiteContact;
  /** Privacy, Terms, Accessibility. SEPARATE from `links`, which is navigation. */
  legal?: NavLink[];
  /** `{ network, href }` — "instagram", "facebook", "email"… */
  social?: { network: string; href: string }[];
  /** Shares the header's frame. A full-width header over a contained footer
   *  reads as a mistake, so `width` moves both or neither. */
  layout?: SiteLayout;
  className?: string;
}) {
  const wide = layout?.width === "full";
  // See `SiteLayout.divider` — off unless asked for, strictly `=== true`.
  const divider = layout?.divider === true;
  const hasContact = !!(contact && (contact.phone || contact.email || contact.address || contact.hours));

  // A PHONE NUMBER IN THE NAV **AND** IN THE CONTACT BLOCK PRINTS TWICE ON ONE
  // ROW, and it looks like a fault rather than a convention — measured by
  // rendering the reference page, whose `links` carry the shop's number because
  // for that trade ringing IS the action. The header still shows it; here the
  // contact block is the authoritative place for that channel, so the duplicate
  // goes.
  //
  // BY CHANNEL, NEVER BY NUMBER. "0114 270 0000" and "+441142700000" are the
  // same line written two ways and matching them needs country-code knowledge
  // this kit deliberately refuses elsewhere (`phone-input` does not validate for
  // the same reason). The cost, stated: a business with a bookings line in the
  // nav and a main line in `contact` loses the nav one FROM THE FOOTER — it is
  // still in the header, which is where a call-now link belongs anyway.
  const footerLinks = links.filter((l) => {
    const href = typeof l.href === "string" ? l.href.toLowerCase() : "";
    if (contact?.phone && href.startsWith("tel:")) return false;
    if (contact?.email && href.startsWith("mailto:")) return false;
    return true;
  });

  return (
    <footer className={cn(divider && "border-t", className)}>
      <div className={cn("mx-auto flex flex-col gap-8 px-6 py-10 sm:flex-row sm:items-start sm:justify-between", wide ? "max-w-none" : "max-w-6xl")}>
        <div className="max-w-sm">
          <div className="font-semibold tracking-tight">{brand}</div>
          {tagline && <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>}
          {social.length > 0 && <SocialLinks links={social} className="mt-4" />}
        </div>

        {hasContact && (
          // `<address>` is the element for the contact details of its nearest
          // section, which is what these are — and browsers italicise it, hence
          // `not-italic`.
          <address className="not-italic text-sm text-muted-foreground">
            {contact!.phone && (
              <div>
                <a href={telHref(contact!.phone)} className="hover:text-foreground">{contact!.phone}</a>
              </div>
            )}
            {contact!.email && (
              <div className="mt-1">
                <a href={`mailto:${contact!.email}`} className="hover:text-foreground">{contact!.email}</a>
              </div>
            )}
            {/* A postal address is several lines and arrives as one string with
                newlines in it, so it needs `pre-line` or it renders as a run-on. */}
            {contact!.address && <div className="mt-2 whitespace-pre-line">{contact!.address}</div>}
            {contact!.hours && <div className="mt-2">{contact!.hours}</div>}
          </address>
        )}

        {footerLinks.length > 0 && (
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {footerLinks.map((l) => (
              <SiteLink key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground">{l.label}</SiteLink>
            ))}
          </nav>
        )}
      </div>

      <div className={cn(divider && "border-t", "px-6 py-4")}>
        <div className={cn("mx-auto flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between", wide ? "max-w-none" : "max-w-6xl")}>
          <p>&copy; {new Date().getFullYear()} {brand}</p>
          {legal.length > 0 && (
            <nav className="flex flex-wrap gap-x-4 gap-y-1">
              {legal.map((l) => (
                <SiteLink key={l.href} href={l.href} className="hover:text-foreground">{l.label}</SiteLink>
              ))}
            </nav>
          )}
        </div>
      </div>
    </footer>
  );
}
