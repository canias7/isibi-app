import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Read more.
 *
 * The collapsed copy stays in the DOM rather than being swapped in on click, so
 * it is findable by the browser's own search and by a crawler. Clamping is
 * visual; removing is not.
 */
export function ExpandableText({ lines = 3, more = "Read more", less = "Show less", className, children }: {
  lines?: 2 | 3 | 4 | 5; more?: string; less?: string;
  className?: string; children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const c: Record<number,string> = {2:"line-clamp-2",3:"line-clamp-3",4:"line-clamp-4",5:"line-clamp-5"};
  return (
    <div className={className}>
      <div className={open ? undefined : c[lines]}>{children}</div>
      <button type="button" onClick={() => setOpen(!open)}
        className={cn("mt-1 cursor-pointer text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground")}>
        {open ? less : more}
      </button>
    </div>
  );
}
