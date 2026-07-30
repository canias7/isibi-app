import * as React from "react";
/**
 * Sets `document.title` for a route.
 *
 * A single-page app changes the URL without reloading, so nothing updates the
 * title unless something does it deliberately — and a site whose every tab,
 * every bookmark and every browser-history entry says the same thing is
 * unnavigable once somebody has three of them open.
 *
 * It restores the previous title on unmount, so a modal route that sets one
 * does not leave it behind on the page underneath.
 */
export function PageTitle({ title, suffix }: { title: string; suffix?: string }) {
  React.useEffect(() => {
    const before = document.title;
    document.title = suffix ? `${title} · ${suffix}` : title;
    return () => { document.title = before; };
  }, [title, suffix]);
  return null;
}
