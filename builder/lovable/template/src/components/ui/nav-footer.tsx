import { cn } from "@/lib/utils";
export type FooterColumn = { title: string; links: { label: string; href: string }[] };
/** Columns of links, for a footer with more than a handful. */
export function NavFooter({ columns, className }: { columns: FooterColumn[]; className?: string }) {
  return (
    <div className={cn("grid gap-8 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {columns.map((c) => (
        <nav key={c.title}>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{c.title}</div>
          <ul className="mt-3 flex flex-col gap-2">
            {c.links.map((l) => (
              <li key={l.href}><a href={l.href} className="text-sm hover:underline underline-offset-4">{l.label}</a></li>
            ))}
          </ul>
        </nav>
      ))}
    </div>
  );
}
