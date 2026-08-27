import { cn } from "@/lib/utils";
/**
 * The cell where a sticky header and a sticky column meet.
 *
 * THE ONE CELL EVERYBODY FORGETS. Pin a column, stick a header, and the top-left
 * cell belongs to both — with only one set of sticky rules it scrolls away under
 * the other, leaving a hole that shows rows sliding through the header.
 *
 * IT NEEDS A HIGHER z-index THAN EITHER, and an opaque background. Both are the
 * whole content of this component: it is four CSS declarations that are wrong in
 * almost every hand-rolled sticky table.
 *
 * Exported as a class string as well as a component, since the corner is
 * sometimes a `<th>` the caller must render themselves.
 */
export const FROZEN_CORNER = "sticky top-0 start-0 z-30 bg-background";

export function FrozenCorner({ children, className, ...rest }: {
  children?: React.ReactNode;
  className?: string;
} & React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th data-slot="frozen-corner" {...rest} className={cn(FROZEN_CORNER, "px-3 py-2 text-start", className)}>
      {children}
    </th>
  );
}
