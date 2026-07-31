import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The top of a category page — title, count, and the description that is
 * usually SEO filler.
 *
 * THE DESCRIPTION IS CLAMPED WITH A REAL "MORE". Category copy exists for
 * search engines and is written at length; dumping 300 words above the
 * products pushes the actual goods below the fold, and hiding it entirely
 * loses the ranking. Two lines with a toggle serves both.
 *
 * THE COUNT SITS WITH THE TITLE, because "Coats" and "Coats (3)" set very
 * different expectations of the scroll ahead.
 */
export function CollectionHeader({ title, count, description, image, className }: {
  title: React.ReactNode;
  count?: number;
  description?: React.ReactNode;
  image?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <header className={cn("flex flex-col gap-2", className)}>
      {image ? (
        <span className="block overflow-hidden rounded-lg" style={{ aspectRatio: "21/9" }}>
          <img src={image} alt="" className="h-full w-full object-cover" />
        </span>
      ) : null}
      <h1 className="text-2xl font-bold tracking-tight">
        {title}
        {count != null ? <span className="ml-2 text-base font-normal tabular-nums text-muted-foreground">{count}</span> : null}
      </h1>
      {description ? (
        <div>
          <p className={cn("max-w-prose text-sm text-muted-foreground", !open && "line-clamp-2")}>{description}</p>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
            className="cursor-pointer text-xs underline underline-offset-2">
            {open ? "Less" : "More"}
          </button>
        </div>
      ) : null}
    </header>
  );
}
