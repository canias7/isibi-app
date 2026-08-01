import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavLink = { label: string; href: string };

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
        {/* "#/" and not "/". The app is hash-routed and a published site is served
            from /s/<slug>/, so href="/" is a full reload to the SERVER root —
            the platform, not the site. Measured: the page reloads and the app
            is lost. A hash href is real client-side navigation. */}
        <a href="#/" className="font-semibold tracking-tight">
          {brand}
        </a>
        <nav className="ml-auto hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
        {action && (
          <div className="ml-auto md:ml-0">
            <Button size="sm" asChild={!!action.href} onClick={action.onClick}>
              {action.href ? <a href={action.href}>{action.label}</a> : <span>{action.label}</span>}
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
                  <a key={l.href} href={l.href} className="text-sm">
                    {l.label}
                  </a>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </header>
  );
}
