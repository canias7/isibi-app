import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Text that will be printed, engraved or embroidered onto the thing.
 *
 * THIS IS NOT AN ORDINARY TEXT FIELD, because what is typed becomes
 * physical and unreturnable. So: the character limit is hard and visible,
 * the allowed characters are stated (most engravers cannot do emoji or
 * accents), and a live preview shows exactly the glyphs that will be cut.
 *
 * IT WARNS THAT PERSONALISED MEANS NON-RETURNABLE, once, near the field —
 * that is the single most common dispute in personalised goods and it costs
 * one line to prevent.
 *
 * CASE IS SHOWN AS IT WILL BE MADE. An engraver working in caps should show
 * caps while typing, not silently transform the order later.
 */
export function PersonalisationField({ value, onChange, maxLength = 20, forceCase, allow = /^[A-Za-z0-9 .,'&-]*$/, className }: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  forceCase?: "upper" | "lower";
  allow?: RegExp;
  className?: string;
}) {
  const id = React.useId();
  const shown = forceCase === "upper" ? value.toUpperCase() : forceCase === "lower" ? value.toLowerCase() : value;
  const [rejected, setRejected] = React.useState(false);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-sm font-medium">Personalisation</label>
      <input id={id} value={shown} maxLength={maxLength}
        onChange={(e) => {
          const next = e.target.value;
          if (!allow.test(next)) { setRejected(true); return; }
          setRejected(false);
          onChange(forceCase === "upper" ? next.toUpperCase() : forceCase === "lower" ? next.toLowerCase() : next);
        }}
        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {rejected ? "Letters, numbers and . , ' & - only — engraving cannot do the rest." : "Letters, numbers and . , ' & -"}
        </p>
        <p className="text-[11px] tabular-nums text-muted-foreground">{shown.length}/{maxLength}</p>
      </div>
      {/* Exactly the glyphs that get cut. */}
      {shown ? (
        <p className="rounded border border-border bg-muted px-2 py-3 text-center font-serif text-lg tracking-widest">{shown}</p>
      ) : null}
      <p className="text-[11px] font-medium">Personalised items cannot be returned.</p>
    </div>
  );
}
