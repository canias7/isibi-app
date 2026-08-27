import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Content only a printed copy gets — a URL written out, a reference, terms.
 *
 * A printed page has no links, so "see our terms" is useless on paper and the
 * address has to be spelled out. This is where that goes.
 */
export function PrintOnly({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div data-slot="print-only" className={cn("hidden print:block", className)}>{children}</div>;
}
