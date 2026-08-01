import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Staying on one version deliberately, with the cost of staying stated.
 *
 * PINNING IS SENSIBLE AND ALSO ACCUMULATES DEBT, and both halves belong on
 * screen. A pin set for one release and forgotten is how an account ends up
 * four versions behind and out of support — so the age of the pin is shown
 * beside it, which is the fact that prompts anybody to revisit it.
 *
 * IT SAYS WHAT IS BEING MISSED. Security fixes and features are different
 * losses: missing a feature is a choice, missing security fixes is a decision
 * somebody should make consciously and usually has not.
 *
 * IT NAMES WHEN THE PIN STOPS BEING HONOURED. Every pinned version eventually
 * leaves support, and a pin that silently stops working is worse than one with
 * a stated end.
 *
 * UNPINNING IS ONE CONTROL AND SAYS WHERE IT LANDS — "unpin" that jumps four
 * versions without saying so is the upgrade nobody planned for.
 */
export function PinVersion({ versions, pinned, onChange, latest, pinnedSince, missing = [], supportEndsOn, onUnpin, className }: {
  versions: { id: string; label: string; unsupported?: boolean }[];
  /** "" when not pinned. */
  pinned: string;
  onChange: (id: string) => void;
  /** The version they would be on unpinned. */
  latest?: string;
  /** Free text — "8 months". */
  pinnedSince?: string;
  /** What staying costs — "3 security fixes". */
  missing?: string[];
  /** Free text — "1 December". */
  supportEndsOn?: string;
  onUnpin?: () => void;
  className?: string;
}) {
  const isPinned = pinned !== "";
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="space-y-1">
        <label htmlFor="pin-version" className="block text-sm font-medium">Version</label>
        <NativeSelect id="pin-version" value={pinned} className="w-auto" onChange={(e) => onChange(e.target.value)}>
          <option value="">Always the latest{latest ? ` (now ${latest})` : ""}</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              Stay on {v.label}{v.unsupported ? " — no longer supported" : ""}
            </option>
          ))}
        </NativeSelect>
      </div>
      {isPinned && (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {pinnedSince && <p>Pinned for {pinnedSince}.</p>}
          {missing.length > 0 && (
            <p>
              Staying here means missing{" "}
              <span className="text-foreground">
                {missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`}
              </span>.
            </p>
          )}
          {supportEndsOn && <p>This version stops being supported on {supportEndsOn}.</p>}
          {onUnpin && latest && (
            <Button type="button" size="sm" variant="outline" className="mt-1" onClick={onUnpin}>
              Move to {latest}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
