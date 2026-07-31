import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Every page on the site, grouped — the footer sitemap or a dedicated page.
 *
 * IT IS PLAIN LINKS IN NESTED LISTS, and that is the whole design. This block
 * exists to be crawled and to be read by somebody who could not find something
 * through the navigation — both of which want ordinary markup, not a widget.
 * No collapsing, no search, no JavaScript.
 *
 * The group headings are `<h2>`/`<h3>`, not styled divs, so a screen reader can
 * jump between sections. On a page that is nothing but links, that is the only
 * structure there is.
 *
 * The CURRENT page is marked and not linked, the same rule `breadcrumb-collapse`
 * follows: a link to the page you are on is a control that does nothing.
 *
 * External links carry `rel="noreferrer"` and say they open elsewhere, because
 * a sitemap is where third-party links usually hide among first-party ones.
 */
export function SitemapList({ groups, current, className }: {
  groups: { key: string; title: React.ReactNode; links: { href: string; label: React.ReactNode; external?: boolean }[] }[];
  current?: string;
  className?: string;
}) {
  return (
    <nav aria-label="Sitemap" className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {groups.map((g) => (
        <section key={g.key}>
          <h2 className="mb-1.5 text-[11px] font-semibold tracking-wide uppercase">{g.title}</h2>
          <ul className="flex flex-col gap-1">
            {g.links.map((l) => (
              <li key={l.href}>
                {l.href === current ? (
                  <span aria-current="page" className="text-sm font-medium">{l.label}</span>
                ) : (
                  <a href={l.href}
                    {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                    {l.label}
                    {l.external ? <span className="sr-only"> (opens in a new tab)</span> : null}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
