import { cn } from "@/lib/utils";
/**
 * Where the page should break when printed.
 *
 * INVISIBLE ON SCREEN, load-bearing on paper. An invoice or a report printed
 * without break control splits a table across two sheets mid-row, or strands a
 * heading alone at the foot of a page — and neither is discoverable until
 * somebody prints it.
 *
 * `break-before` and `break-after` are the modern properties; `page-break-*` is
 * the legacy spelling still needed by some engines, so both are set.
 *
 * `avoid` is the more useful mode and the one people forget exists: keeping a
 * signature block or a table row together matters more than forcing a new page,
 * because the forced break is at least visible in a preview.
 */
export function PrintBreak({ mode = "after", children, className }: {
  /** "after" and "before" force a break; "avoid" keeps the children together. */
  mode?: "before" | "after" | "avoid";
  children?: React.ReactNode;
  className?: string;
}) {
  const style =
    mode === "avoid" ? { breakInside: "avoid" as const, pageBreakInside: "avoid" as const }
    : mode === "before" ? { breakBefore: "page" as const, pageBreakBefore: "always" as const }
    : { breakAfter: "page" as const, pageBreakAfter: "always" as const };
  if (mode === "avoid") {
    return <div style={style} className={cn(className)}>{children}</div>;
  }
  return <div aria-hidden style={style} className={cn("h-0", className)} />;
}
