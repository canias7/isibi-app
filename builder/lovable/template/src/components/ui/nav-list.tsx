import { cn } from "@/lib/utils";
/** A vertical list of links — a settings sidebar, a section index. */
export function NavList({ items, active, className }: {
  items: { label: string; href: string; icon?: React.ReactNode }[];
  active?: string; className?: string;
}) {
  return (
    <nav data-slot="nav-list" className={cn("flex flex-col gap-0.5", className)}>
      {items.map((l) => {
        const on = active === l.href;
        return (
          <a key={l.href} href={l.href} aria-current={on ? "page" : undefined}
            className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm [&_svg]:size-4",
              on ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
            {l.icon}{l.label}
          </a>
        );
      })}
    </nav>
  );
}
