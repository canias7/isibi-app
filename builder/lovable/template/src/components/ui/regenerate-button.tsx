import * as React from "react";
import { RefreshCw, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
/**
 * "Try again" — with the option to say what should be different.
 *
 * A bare retry re-rolls the same prompt and usually produces the same kind of
 * answer, so the person presses it three times and gives up. The variants —
 * shorter, more detail, a different approach — are the difference between
 * rerolling and steering, and they cost one dropdown.
 *
 * The plain press is still the DEFAULT action, because most of the time "just
 * try again" is genuinely what is wanted. The variants are behind the chevron,
 * not in front of it.
 *
 * The button is disabled while generating, unlike most things in this kit —
 * here a second press does not queue an edit, it starts a second billable
 * generation whose result will replace the first.
 */
const VARIANTS = [
  { key: "retry", label: "Try again", hint: "Same request" },
  { key: "shorter", label: "Make it shorter" },
  { key: "longer", label: "Add more detail" },
  { key: "simpler", label: "Explain it more simply" },
  { key: "different", label: "Take a different approach" },
];

export function RegenerateButton({ onRegenerate, busy, variants = VARIANTS, className }: {
  onRegenerate: (variant: string) => void;
  busy?: boolean;
  variants?: { key: string; label: React.ReactNode; hint?: React.ReactNode }[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <span className={cn("inline-flex items-center rounded-md border border-border", className)}>
      <button type="button" onClick={() => onRegenerate("retry")} disabled={busy}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-s-md px-2 py-1 text-xs font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-50">
        <RefreshCw aria-hidden className={cn("size-3.5", busy && "motion-safe:animate-spin")} />
        {busy ? "Working…" : "Try again"}
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" disabled={busy} aria-label="Try again, differently"
            className="cursor-pointer rounded-e-md border-s border-border px-1 py-1 hover:bg-muted disabled:pointer-events-none disabled:opacity-50">
            <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1">
          <ul>
            {variants.map((v) => (
              <li key={v.key}>
                <button type="button" onClick={() => { setOpen(false); onRegenerate(v.key); }}
                  className="w-full cursor-pointer rounded px-2 py-1.5 text-start text-sm hover:bg-muted">
                  {v.label}
                  {v.hint ? <span className="block text-xs text-muted-foreground">{v.hint}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </span>
  );
}
