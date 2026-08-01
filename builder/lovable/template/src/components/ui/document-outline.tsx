import { cn } from "@/lib/utils";
/**
 * The headings of a document, as a jumpable list.
 *
 * A REAL NESTED `<ol>`, because the nesting IS the outline — flattening it with
 * indentation classes loses the structure for a screen reader, which is the
 * audience an outline helps most.
 *
 * `aria-current="location"` rather than "page" on the active heading. The reader
 * has not navigated anywhere: they are scrolled to a section of the same
 * document, and "page" is the wrong claim.
 *
 * DEPTH IS CLAMPED. A document with an h6 nested six deep produces an outline
 * indented off the side of a narrow column, and past three levels nobody is
 * using it to navigate anyway.
 */
export type OutlineItem = { id: string; label: string; depth?: number };

export function DocumentOutline({ items, activeId, maxDepth = 3, label = "On this page", className }: {
  items: OutlineItem[];
  activeId?: string;
  maxDepth?: number;
  label?: string;
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <nav aria-label={label} className={cn("flex flex-col gap-1", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <ol className="flex flex-col gap-0.5 text-sm">
        {items.map((it) => {
          const d = Math.min(Math.max(it.depth ?? 1, 1), maxDepth);
          const active = it.id === activeId;
          return (
            <li key={it.id} style={{ paddingLeft: `${(d - 1) * 12}px` }}>
              <a href={`#${it.id}`}
                aria-current={active ? "location" : undefined}
                className={cn("underline-offset-4 hover:underline",
                  active ? "font-medium" : "text-muted-foreground")}>
                {it.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
