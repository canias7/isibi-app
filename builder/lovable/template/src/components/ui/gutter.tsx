import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The page's horizontal padding, defined once.
 *
 * ONE DEFINITION, because gutters drift: a page whose header uses px-4,
 * hero px-6 and cards px-5 reads as slightly broken without anyone
 * being able to say why — the misalignment of left edges is visible
 * before it is nameable. This wrapper is the single answer (16 → 24 →
 * 32px by breakpoint), and full-bleed's `inner` re-applies the same
 * scale so escaped sections line their content back up.
 */
export function Gutter({ as: Tag = "div", children, className }: {
  as?: "div" | "section" | "header" | "footer" | "main" | "nav";
  children?: React.ReactNode;
  className?: string;
}) {
  return <Tag className={cn("px-4 sm:px-6 lg:px-8", className)}>{children}</Tag>;
}
