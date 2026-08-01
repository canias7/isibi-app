import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
/**
 * "What if I added a second chair?" — a switch whose effect is stated.
 *
 * THE EFFECT IS ON THE CONTROL, not on a figure elsewhere. A toggle that
 * silently changes a total three sections down leaves the reader flipping it
 * back and forth trying to spot what moved; stating the delta beside it removes
 * the whole hunt.
 *
 * The delta keeps its SIGN and its direction word, never a colour: "+£240 a
 * month" and "2 days sooner" both read correctly in greyscale and to a screen
 * reader.
 *
 * `role="status"` on the effect so it is announced when the switch changes,
 * which is the one moment it has something new to say.
 */
export function WhatIfToggle({ label, checked, onCheckedChange, effect, note, id, className }: {
  label: string; checked: boolean; onCheckedChange: (v: boolean) => void;
  /** The consequence — "+£240 a month". Computed by the caller. */
  effect: string;
  note?: string; id?: string; className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 rounded-md border border-border p-3", className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        <p role="status" className="mt-0.5 text-sm tabular-nums">{effect}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}
