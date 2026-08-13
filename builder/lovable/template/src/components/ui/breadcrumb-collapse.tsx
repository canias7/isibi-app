import * as React from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { cn, labelText } from "@/lib/utils";
/**
 * A breadcrumb trail that folds its middle when there is no room.
 *
 * THE FIRST AND LAST ARE ALWAYS KEPT. Those are the two that carry meaning —
 * where the whole thing lives and where you are — and every scheme that
 * truncates from one end loses one of them. The middle is what folds.
 *
 * The fold EXPANDS rather than linking away, because the hidden crumbs are the
 * path back up and a menu that navigates on hover makes them unreachable at
 * exactly the moment somebody is trying to read them.
 *
 * The current page is `aria-current="page"` and NOT a link. A trail whose last
 * item links to the page you are on is a control that appears to do something
 * and does nothing.
 *
 * `<nav aria-label="Breadcrumb">` with an ordered list, so the hierarchy is
 * structure rather than a row of separated text — and the chevrons are
 * `aria-hidden`, or a screen reader reads "greater than" between every step.
 */
export function BreadcrumbCollapse({ items, maxVisible = 4, className }: {
  items: { label: React.ReactNode; href?: string }[];
  maxVisible?: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const folds = items.length > maxVisible && !open;
  // First, then the fold, then the last few — never truncate from an end.
  const head = folds ? items.slice(0, 1) : items;
  const tail = folds ? items.slice(items.length - (maxVisible - 2)) : [];
  const hidden = items.length - head.length - tail.length;

  const crumb = (item: { label: React.ReactNode; href?: string }, last: boolean) => (
    <li key={labelText(item.label)} className="flex min-w-0 items-center gap-1">
      {item.href && !last ? (
        <a href={item.href} className="truncate hover:underline">{item.label}</a>
      ) : (
        <span aria-current={last ? "page" : undefined} className={cn("truncate", last && "font-medium")}>
          {item.label}
        </span>
      )}
      {last ? null : <ChevronRight aria-hidden className="size-3 shrink-0 text-muted-foreground" />}
    </li>
  );

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0 text-sm text-muted-foreground", className)}>
      <ol className="flex min-w-0 items-center gap-1">
        {head.map((i, k) => crumb(i, !folds && k === items.length - 1))}
        {folds ? (
          <li className="flex items-center gap-1">
            <button type="button" onClick={() => setOpen(true)}
              aria-label={`Show ${hidden} hidden ${hidden === 1 ? "level" : "levels"}`}
              className="cursor-pointer rounded px-1 hover:bg-muted hover:text-foreground">
              <MoreHorizontal aria-hidden className="size-3.5" />
            </button>
            <ChevronRight aria-hidden className="size-3 shrink-0 text-muted-foreground" />
          </li>
        ) : null}
        {tail.map((i, k) => crumb(i, k === tail.length - 1))}
      </ol>
    </nav>
  );
}
