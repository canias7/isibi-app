import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
/**
 * One thing you can turn off, with the consequence stated.
 *
 * THE CONSEQUENCE OF TURNING IT OFF IS ON SCREEN, always. "Personalised
 * recommendations" as a bare switch gives nobody a basis to decide; "you will
 * see the same list as everyone else" does. Where switching off genuinely
 * breaks something, that is stated here rather than discovered later.
 *
 * OFF IS NEVER PENALISED IN THE STYLING. No warning colour, no "not
 * recommended" — this is a setting the reader is entitled to, and dressing the
 * off state as a mistake is the dark pattern this component exists to avoid.
 *
 * A REAL `Switch` WITH A REAL LABEL, so it is reachable by keyboard and
 * announces its state. Toggles built from styled divs are the standard here and
 * they are unusable without a mouse.
 *
 * `pending` DISABLES IT AND SAYS SO, since these settings usually round-trip to
 * a server and a switch that springs back with no explanation reads as a
 * refusal.
 */
export function OptOutRow({ label, effect, checked, onChange, pending, locked, lockedReason, className }: {
  label: string;
  /** What happens when it is off. */
  effect?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  pending?: boolean;
  locked?: boolean;
  lockedReason?: string;
  className?: string;
}) {
  const id = `optout-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className={cn("flex items-start gap-3 py-2", className)}>
      <span className="min-w-0 flex-1">
        <label htmlFor={id} className="text-sm">{label}</label>
        {effect && <span className="block text-xs text-muted-foreground">Off: {effect}</span>}
        {locked && lockedReason && <span className="block text-xs text-muted-foreground">{lockedReason}</span>}
        {pending && <span className="block text-xs text-muted-foreground">Saving…</span>}
      </span>
      <Switch id={id} checked={checked} disabled={pending || locked}
        onCheckedChange={(v) => onChange(v === true)} className="mt-0.5 shrink-0" />
    </div>
  );
}
