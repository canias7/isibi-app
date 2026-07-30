import * as React from "react";
/**
 * The page skeleton, with real landmark elements.
 *
 * `<main id="main" tabIndex={-1}>` is the half that matters, and it is the
 * half `SkipLink` needs to work at all: without the id there is nothing to
 * skip to, and without the tabindex the jump moves the viewport but not the
 * focus, so the next Tab starts again from the top.
 *
 * A page with no `<main>` gives a screen reader no way to reach the content
 * except by reading through the navigation.
 */
export function PageMain({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <main id="main" tabIndex={-1} className={className ? `outline-none ${className}` : "outline-none"}>{children}</main>;
}
/** Named so two navs on one page are told apart — "Main" and "Footer", not "navigation" twice. */
export function PageNav({ label, children, className }: {
  label: string; children?: React.ReactNode; className?: string;
}) {
  return <nav aria-label={label} className={className}>{children}</nav>;
}
/** A complementary region — a sidebar of related links, an aside of extra detail. */
export function PageAside({ label, children, className }: {
  label?: string; children?: React.ReactNode; className?: string;
}) {
  return <aside aria-label={label} className={className}>{children}</aside>;
}
