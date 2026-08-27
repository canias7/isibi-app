import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A table of contents that follows the reader.
 *
 * Tracks headings with IntersectionObserver rather than on scroll, so it costs
 * nothing per frame. Falls back to a plain list where the API is missing.
 */
export function AnchorNav({ items, className }: {
  items: { id: string; label: string }[]; className?: string;
}) {
  const [active, setActive] = React.useState(items[0]?.id);
  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (es) => { const v = es.filter((e) => e.isIntersecting)[0]; if (v) setActive(v.target.id); },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const it of items) { const el = document.getElementById(it.id); if (el) io.observe(el); }
    return () => io.disconnect();
  }, [items]);
  return (
    <nav data-slot="anchor-nav" className={cn("flex flex-col gap-1 border-s text-sm", className)}>
      {items.map((it) => (
        <a key={it.id} href={"#" + it.id}
          className={cn("-ml-px border-s-2 ps-3 py-1",
            active === it.id ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
          {it.label}
        </a>
      ))}
    </nav>
  );
}
