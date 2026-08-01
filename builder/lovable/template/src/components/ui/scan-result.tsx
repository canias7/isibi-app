import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * What a scan found, confirmed before anything is done with it.
 *
 * THE HUMAN-READABLE THING COMES FIRST, THE CODE SECOND. A scanner that reports
 * `5012345678900` and immediately adds an item gives nobody a chance to notice
 * it scanned the shelf label rather than the product. The name is what somebody
 * checks against what is in their hand.
 *
 * AN UNRECOGNISED CODE IS NOT AN ERROR. It scanned perfectly; we just do not
 * know it — and that usually means adding it, not rescanning. Treating it as a
 * failure sends somebody scanning the same barcode four more times.
 *
 * IT KEEPS THE RAW CODE VISIBLE AND SELECTABLE, because that is what gets typed
 * into a supplier's site or pasted into a message when nothing else works.
 *
 * SCAN-AGAIN IS ALWAYS THERE, since the commonest outcome of looking at a scan
 * result is realising it is the wrong item.
 */
export function ScanResult({ code, name, detail, state = "known", onConfirm, onAdd, onAgain, busy, className }: {
  /** The raw scanned value. */
  code: string;
  /** What it is. */
  name?: string;
  detail?: string;
  state?: "known" | "unknown" | "duplicate";
  onConfirm?: () => void;
  /** For the unknown case. */
  onAdd?: () => void;
  onAgain?: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2 rounded-md border border-border p-3", className)}>
      <div>
        <p className="text-sm font-medium">
          {state === "known" ? (name ?? "Scanned") : state === "duplicate" ? (name ?? "Scanned") : "We do not know this code"}
        </p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        <code className="mt-0.5 block select-all font-mono text-xs text-muted-foreground">{code}</code>
      </div>
      {state === "duplicate" && (
        <p className="text-xs">
          <span className="font-medium">Already scanned.</span>
          <span className="text-muted-foreground"> Adding it again will count it twice.</span>
        </p>
      )}
      {state === "unknown" && (
        <p className="text-xs text-muted-foreground">
          The scan worked — this code is just not in your list yet.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {state === "unknown" && onAdd && (
          <Button type="button" size="sm" onClick={onAdd} disabled={busy}>Add it</Button>
        )}
        {state !== "unknown" && onConfirm && (
          <Button type="button" size="sm" onClick={onConfirm} disabled={busy}>
            {state === "duplicate" ? "Count it again" : "That is right"}
          </Button>
        )}
        {onAgain && (
          <Button type="button" size="sm" variant="outline" onClick={onAgain} disabled={busy}>Scan again</Button>
        )}
      </div>
    </div>
  );
}
