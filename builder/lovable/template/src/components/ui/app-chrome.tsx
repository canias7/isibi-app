import * as React from "react";
import { useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, CalendarDays, ShoppingBag, User, MessageCircle, Info, Search, Heart, MapPin, type LucideIcon } from "lucide-react";
import { SiteLink, type NavLink } from "@/components/ui/site-header";
import { cn } from "@/lib/utils";

/**
 * The frame every screen of a PHONE APP sits in (2026-10-20, owner: "everything
 * the same as the site … it's literally just the same process"). An app is
 * built by the same pipeline as a site; this is the one place it looks
 * different: a bar at the top with the app's name, and a TAB BAR at the bottom
 * where a site has its menu and footer.
 *
 * THE SAME PROPS AS `SiteChrome` FOR WHAT THEY SHARE — `name`, `links`,
 * `action` — so a screen is written exactly like a page, with `AppChrome` in
 * place of `SiteChrome`. `links` become the tabs (at most five fit a phone);
 * each picks an icon from its words, and the current screen's tab is lit.
 *
 * NO FOOTER, NO SKIP LINK TO A HEADER MENU: an app has neither. The screen's
 * content scrolls between the two bars, with room left for the tab bar and the
 * phone's own home indicator (`env(safe-area-inset-bottom)`).
 */
export function AppChrome({
  name,
  links = [],
  action,
  children,
  className,
}: {
  /** The app's name, in the top bar. */
  name: string;
  /** The tabs, `{ label, href }` with ordinary paths: `{ label: "Menu", href: "/menu" }`. Five at most. */
  links?: NavLink[];
  /** One small button at the right of the top bar — the thing you most want them to do. */
  action?: { label: string; href?: string; onClick?: () => void };
  children: React.ReactNode;
  className?: string;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const tabs = links.slice(0, 5);
  return (
    <div data-slot="app-chrome" className={cn("flex min-h-svh flex-col bg-background text-foreground", className)}>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <span className="truncate text-base font-semibold">{name}</span>
        {action ? (
          action.href ? (
            <SiteLink href={action.href} className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{action.label}</SiteLink>
          ) : (
            <button type="button" onClick={action.onClick} className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{action.label}</button>
          )
        ) : null}
      </header>

      <main id="main" tabIndex={-1} className="flex-1 outline-none" style={{ paddingBottom: tabs.length ? "calc(4rem + env(safe-area-inset-bottom))" : undefined }}>
        {children}
      </main>

      {tabs.length ? (
        <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <ul className="mx-auto flex h-16 max-w-md items-stretch justify-around">
            {tabs.map((t) => {
              const on = t.href === "/" ? path === "/" || path === "" : path === t.href || path.startsWith(t.href + "/");
              const Icon = tabIcon(t.label, t.href);
              return (
                <li key={t.href} className="flex-1">
                  <SiteLink href={t.href} className={cn("flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium", on ? "text-primary" : "text-muted-foreground")}>
                    <Icon className="size-5" aria-hidden="true" />
                    <span aria-current={on ? "page" : undefined}>{t.label}</span>
                  </SiteLink>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

/** An icon for a tab, read from its words; a grid when nothing matches. */
export function tabIcon(label: string, href: string): LucideIcon {
  const s = (label + " " + href).toLowerCase();
  if (href === "/" || /\bhome\b/.test(s)) return Home;
  if (/book|calendar|schedule|appoint|class/.test(s)) return CalendarDays;
  if (/shop|order|menu|cart|store|buy/.test(s)) return ShoppingBag;
  if (/account|profile|me\b|login|sign/.test(s)) return User;
  if (/chat|message|contact/.test(s)) return MessageCircle;
  if (/search|find|explore/.test(s)) return Search;
  if (/fav|saved|like/.test(s)) return Heart;
  if (/visit|map|where|location|find us/.test(s)) return MapPin;
  if (/about|info/.test(s)) return Info;
  return LayoutGrid;
}
