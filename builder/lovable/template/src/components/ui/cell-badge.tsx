import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A status pill sized for a table cell rather than for a page.
 *
 * Monochrome, by the same rule as the rest of the kit: the tone is fill,
 * outline or hollow, and the WORD carries the meaning. A column of pills that
 * differ only in colour is unreadable in greyscale, in print, and to anyone who
 * cannot separate those hues — and a status column is exactly where a reader
 * scans down rather than reading each row.
 *
 * `dot` puts a small mark in front so a scan can find the odd row out by shape
 * before the eye has read a single word.
 */
export function CellBadge({ children, tone = "neutral", dot, className }: {
  children: React.ReactNode;
  tone?: "neutral" | "strong" | "quiet" | "outline";
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={cn(
      "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs whitespace-nowrap",
      tone === "strong" && "bg-foreground font-medium text-background",
      tone === "neutral" && "bg-muted text-foreground",
      tone === "quiet" && "text-muted-foreground",
      tone === "outline" && "border border-border text-foreground",
      className)}>
      {dot ? (
        <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full",
          tone === "strong" ? "bg-background"
            : tone === "quiet" ? "border border-current" : "bg-current")} />
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
