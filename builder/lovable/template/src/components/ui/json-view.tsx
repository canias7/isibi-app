import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
/**
 * Readable JSON — a webhook payload, a stored answer, a debug panel.
 *
 * Serialising is wrapped, because `JSON.stringify` THROWS on a circular
 * reference and on a BigInt, and a panel that exists to show you what went
 * wrong must not be the thing that takes the page down.
 */
export function JsonView({ value, collapsedHeight = 320, className }: {
  value: unknown; collapsedHeight?: number; className?: string;
}) {
  let text: string;
  try { text = JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? String(v) : v), 2) ?? "undefined"; }
  catch { text = String(value); }
  return (
    <div className={cn("relative rounded-md border border-border bg-muted/40", className)}>
      <div className="absolute right-1.5 top-1.5"><CopyButton value={text} label="Copy JSON" iconOnly /></div>
      <pre className="overflow-auto p-3 pr-10 font-mono text-xs leading-relaxed"
        style={{ maxHeight: collapsedHeight }}>{text}</pre>
    </div>
  );
}
