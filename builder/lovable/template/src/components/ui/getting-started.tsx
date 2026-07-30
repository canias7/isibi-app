import * as React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
/** A grid of first things to do. Each tile is a link, not a card with a button inside it. */
export function GettingStarted({ items, className }: {
  items: { title: string; body?: string; href?: string; onClick?: () => void; icon?: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((it) => {
        const inner = (
          <>
            {it.icon && <span className="text-muted-foreground">{it.icon}</span>}
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {it.title}<ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
            {it.body && <span className="text-sm text-muted-foreground">{it.body}</span>}
          </>
        );
        const cls = "group flex cursor-pointer flex-col items-start gap-1.5 rounded-lg border border-border p-4 text-left hover:border-foreground/30 hover:bg-muted/40";
        return it.href
          ? <a key={it.title} href={it.href} className={cls}>{inner}</a>
          : <button key={it.title} type="button" onClick={it.onClick} className={cls}>{inner}</button>;
      })}
    </div>
  );
}
