import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Content a printed copy should not get — buttons, navigation, a cookie bar.
 *
 * The commonest printing bug is not a layout one: it is eight pages of
 * navigation and a "Book now" button nobody can press, printed because
 * nothing said not to.
 */
export function ScreenOnly({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div data-slot="screen-only" className={cn("print:hidden", className)}>{children}</div>;
}
