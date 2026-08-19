import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The commonest list row there is: a title, a line under it, something on the
 * right.
 *
 * BOTH LINES TRUNCATE. A row that wraps when the title is long makes every
 * row a different height, and a list of different-height rows cannot be
 * scanned — which is the only thing a list of forty is for.
 *
 * `href` renders an anchor and `onClick` a button, so the row is never a div
 * with a click handler: that version cannot be reached by keyboard, opened in
 * a new tab, or read as interactive.
 */
export function TwoLineRow({ title, subtitle, leading, trailing, href, onClick, className }: {
  title: React.ReactNode; subtitle?: React.ReactNode;
  leading?: React.ReactNode; trailing?: React.ReactNode;
  href?: string; onClick?: () => void; className?: string;
}) {
  const body = (
    <>
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </>
  );
  const base = "flex w-full items-center gap-3 border-b border-border py-2.5 text-start last:border-0";
  if (href) return <a href={href} className={cn(base, "hover:bg-muted/50", className)}>{body}</a>;
  if (onClick) return <button type="button" onClick={onClick} className={cn(base, "cursor-pointer hover:bg-muted/50", className)}>{body}</button>;
  return <div className={cn(base, className)}>{body}</div>;
}
