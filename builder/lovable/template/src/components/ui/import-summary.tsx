import { Check, TriangleAlert, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * What the import actually did.
 *
 * Four numbers, not one: added, updated, skipped and failed. "412 rows
 * imported" hides the case that matters — 380 added and 32 quietly updating
 * records somebody did not mean to touch.
 *
 * Every count carries a word and an icon shape, so the three outcomes are
 * distinguishable without colour.
 */
export function ImportSummary({ added = 0, updated = 0, skipped = 0, failed = 0, className }: {
  added?: number; updated?: number; skipped?: number; failed?: number; className?: string;
}) {
  const rows = [
    { icon: Check, label: "added", n: added, tone: "text-success" },
    { icon: Check, label: "updated", n: updated, tone: "text-foreground" },
    { icon: MinusCircle, label: "skipped", n: skipped, tone: "text-muted-foreground" },
    { icon: TriangleAlert, label: "failed", n: failed, tone: "text-destructive" },
  ].filter((r) => r.n > 0);
  if (!rows.length) return <p data-slot="import-summary" className={cn("text-sm text-muted-foreground", className)}>Nothing was imported.</p>;
  return (
    <ul className={cn("flex flex-wrap gap-x-5 gap-y-1 text-sm", className)}>
      {rows.map((r) => {
        const Icon = r.icon;
        return (
          <li key={r.label} className={cn("flex items-center gap-1.5", r.tone)}>
            <Icon className="size-3.5" />
            <strong className="font-medium tabular-nums">{r.n.toLocaleString()}</strong> {r.label}
          </li>
        );
      })}
    </ul>
  );
}
