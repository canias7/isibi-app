import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A product code, shown to be READ ALOUD and typed accurately.
 *
 * SKUs GET DICTATED DOWN A PHONE and typed into another system, so this is
 * not ordinary text: monospaced (so 0/O and 1/l are distinguishable at a
 * glance), grouped in fours (the card-input rule — people chunk when they
 * copy), and one-press copy because retyping is where the error enters.
 *
 * THE FULL VALUE IS ALWAYS COPIED even when the display is grouped or
 * truncated — copying what is on screen rather than what is real is the
 * classic bug in this shape.
 */
export function SkuField({ value, label = "SKU", group = 4, className }: {
  value: string;
  label?: string;
  group?: number;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const shown = group > 0 ? (value.match(new RegExp(`.{1,${group}}`, "g")) ?? [value]).join(" ") : value;
  return (
    <span data-slot="sku-field" className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span className="text-muted-foreground">{label}</span>
      <code className="font-mono tracking-wider">{shown}</code>
      <button type="button"
        onClick={async () => {
          // The real value, never the grouped display.
          try { await navigator.clipboard.writeText(value); } catch { /* denied */ }
          setCopied(true); setTimeout(() => setCopied(false), 1200);
        }}
        aria-label={`Copy ${label} ${value}`}
        className="cursor-pointer rounded p-0.5 hover:bg-muted">
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      </button>
    </span>
  );
}
