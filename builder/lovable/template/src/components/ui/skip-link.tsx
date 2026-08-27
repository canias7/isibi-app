/**
 * "Skip to content" — the first thing in the tab order, invisible until
 * focused.
 *
 * Without it, somebody navigating by keyboard tabs through the entire header
 * and every navigation link on EVERY page before reaching anything. It is the
 * single cheapest accessibility fix there is, and it is missing from almost
 * every site.
 *
 * `sr-only focus:not-sr-only` rather than `hidden`: hidden takes it out of
 * the tab order too, which removes the only thing it does.
 *
 * The target needs `id="main"` and `tabIndex={-1}` — without the tabindex the
 * jump moves the viewport but not the focus, and the next Tab goes back to
 * the top of the page.
 */
export function SkipLink({ href = "#main", label = "Skip to content" }: { href?: string; label?: string }) {
  return (
    <a data-slot="skip-link" href={href}
      className="sr-only rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50">
      {label}
    </a>
  );
}
