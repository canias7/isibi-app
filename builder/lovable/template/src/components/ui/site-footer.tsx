import { SiteLink, type NavLink } from "@/components/ui/site-header";
import { cn } from "@/lib/utils";

/** The bottom of every page: a line about the business, some links, the year. */
export function SiteFooter({
  brand, tagline, links = [], className,
}: {
  brand: string;
  tagline?: string;
  links?: NavLink[];
  className?: string;
}) {
  return (
    <footer className={cn("border-t", className)}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <div className="font-semibold tracking-tight">{brand}</div>
          {tagline && <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>}
        </div>
        {links.length > 0 && (
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map((l) => (
              <SiteLink key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground">{l.label}</SiteLink>
            ))}
          </nav>
        )}
      </div>
      <div className="border-t px-6 py-4">
        <p className="mx-auto max-w-6xl text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} {brand}
        </p>
      </div>
    </footer>
  );
}
