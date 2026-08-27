import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The frame everything else sits in — header, sidebar, main, optional aside.
 *
 * ONE `<main>` and a SKIP LINK. Every keyboard user starts each page by tabbing
 * past the header and the whole sidebar, and a skip link is the two lines that
 * fix it — invisible until focused, and it is the single most valuable
 * accessibility feature a shell can carry. It only works if the target has an
 * id and is focusable, so `tabIndex={-1}` is on the main element.
 *
 * `min-h-svh`, not `min-h-screen`. `vh` on a phone means the viewport with the
 * browser chrome hidden, so a full-height shell is always taller than the
 * screen and the page rocks as the toolbars slide away. `svh` is the small
 * viewport and stays put.
 *
 * The sidebar and aside are `<nav>` and `<aside>` landmarks with accessible
 * names, so a screen reader can jump straight to either. Unnamed landmarks are
 * announced as "navigation" three times over and become useless.
 *
 * The main column has `min-w-0`. A grid child defaults to `min-width: auto`,
 * so one wide table inside stretches the whole layout and the sidebar is
 * pushed off screen — the commonest shell bug there is.
 *
 * THIS IS THE PAGE FRAME AND IT IS AT LEAST A VIEWPORT TALL. Rendering it
 * inside another layout gives that layout a screen-height block with a lot of
 * empty space under the content — the same trap `rail` documents. One per page,
 * at the root.
 */
export function AppShell({
  header, sidebar, aside, children, sidebarLabel = "Main", asideLabel = "Details", className,
}: {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  sidebarLabel?: string;
  asideLabel?: string;
  className?: string;
}) {
  return (
    <div data-slot="app-shell" className={cn("flex min-h-svh flex-col bg-background", className)}>
      <a href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-sm focus:text-background">
        Skip to the main content
      </a>
      {header ? (
        <header className="sticky top-0 z-30 border-b border-border bg-background">{header}</header>
      ) : null}
      <div className="flex min-h-0 flex-1">
        {sidebar ? (
          <nav aria-label={sidebarLabel} className="hidden w-60 shrink-0 border-e border-border md:block">
            {sidebar}
          </nav>
        ) : null}
        {/* min-w-0, or one wide table stretches the whole shell. */}
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">{children}</main>
        {aside ? (
          <aside aria-label={asideLabel} className="hidden w-72 shrink-0 border-s border-border lg:block">
            {aside}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
