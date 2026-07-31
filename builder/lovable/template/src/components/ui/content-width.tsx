import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The reading measure — around 65 characters, held.
 *
 * `max-w-prose` IS THE POINT (~65ch): lines much longer lose the
 * reader's place on the way back left; much shorter chops the rhythm.
 * This exists as a component so "just this once full-width" has to be
 * a decision — the article that slowly widens to 1400px happens one
 * innocent div at a time.
 *
 * `wide` is the sanctioned exception (measure-and-a-half for tables
 * and figures that genuinely need it), still bounded.
 */
export function ContentWidth({ wide, children, className }: {
  wide?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(wide ? "max-w-4xl" : "max-w-prose", className)}>{children}</div>;
}
