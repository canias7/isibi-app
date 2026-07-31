import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A way into a category — picture, name, and how much is in it.
 *
 * THE COUNT IS THE PART THAT EARNS THE TILE. "Coats" tells a shopper
 * nothing about whether it is worth the tap; "Coats · 48" does, and an empty
 * category renders as unavailable rather than leading somewhere blank.
 *
 * THE WHOLE TILE IS ONE LINK. A picture-link plus a title-link plus a
 * count-link is three tab stops and three identical announcements for one
 * destination.
 *
 * The image is decorative here (`alt=""`), because the name is right beside
 * it — describing it twice is noise.
 */
export function CategoryTile({ href, name, count, image, className }: {
  href: string;
  name: React.ReactNode;
  count?: number;
  image?: string;
  className?: string;
}) {
  const empty = count === 0;
  const inner = (
    <>
      {image ? (
        <span className="block overflow-hidden rounded-md" style={{ aspectRatio: "4/3" }}>
          <img src={image} alt="" className="h-full w-full object-cover" />
        </span>
      ) : null}
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium">{name}</span>
        {count != null ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count}</span> : null}
      </span>
    </>
  );
  if (empty) {
    return (
      <div className={cn("flex flex-col gap-1.5 opacity-50", className)} aria-disabled>
        {inner}
        <span className="text-[11px] text-muted-foreground">Nothing in here yet</span>
      </div>
    );
  }
  return (
    <a href={href} className={cn("flex cursor-pointer flex-col gap-1.5 hover:underline", className)}>
      {inner}
    </a>
  );
}
