import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A list row with a preview line — an inbox, a comment list, a changelog.
 *
 * The third line CLAMPS TO TWO and no more, so a long message cannot make one
 * row four times the height of its neighbours. That is the difference between
 * this and just letting the text flow, and it is why a mail list stays
 * scannable however long the emails are.
 *
 * Unread is carried by WEIGHT as well as the dot, so it survives greyscale
 * and does not depend on noticing a 6px circle.
 */
export function ThreeLineRow({ title, meta, preview, unread, leading, href, onClick, className }: {
  title: React.ReactNode; meta?: React.ReactNode; preview?: React.ReactNode;
  unread?: boolean; leading?: React.ReactNode; href?: string; onClick?: () => void; className?: string;
}) {
  const body = (
    <>
      {leading && <span className="mt-0.5 shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-sm", unread && "font-semibold")}>{title}</span>
          {meta && <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>}
        </span>
        {preview && (
          <span className={cn("mt-0.5 line-clamp-2 text-xs", unread ? "text-foreground" : "text-muted-foreground")}>
            {preview}
          </span>
        )}
      </span>
      {unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-foreground" aria-label="Unread" />}
    </>
  );
  const base = "flex w-full items-start gap-3 border-b border-border py-3 text-start last:border-0";
  if (href) return <a data-slot="three-line-row" href={href} className={cn(base, "hover:bg-muted/50", className)}>{body}</a>;
  if (onClick) return <button type="button" onClick={onClick} className={cn(base, "cursor-pointer hover:bg-muted/50", className)}>{body}</button>;
  return <div className={cn(base, className)}>{body}</div>;
}
