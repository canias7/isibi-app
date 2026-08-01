import { PermissionPrompt } from "@/components/ui/permission-prompt";
/**
 * Asking for the device's location, with a place to type one instead.
 *
 * THE DIFFERENCE FROM `location-consent` IS WHERE IT SITS. That one is the
 * standing panel on a page whose whole job is finding somewhere near you — it
 * explains and persuades. This is the in-line ask that appears mid-task, on the
 * `PermissionPrompt` shape shared with camera and notifications, so the three
 * behave identically wherever they turn up.
 *
 * PRECISION IS STATED, because "your location" means a city to some readers and
 * a doorstep to others, and browsers hand over the doorstep. Somebody who knows
 * we only need the town is much more likely to agree.
 *
 * THE MANUAL ROUTE IS A CHILD, not a prop of its own, so the caller can put a
 * postcode field, a saved-address picker, or a link there. Hard-coding a
 * postcode box would be wrong outside one country.
 *
 * IT NEVER FIRES `getCurrentPosition` ITSELF — the caller does, on the gesture
 * this produces. A component that reaches for a permission on render is the
 * whole problem.
 */
export function LocationAccess({ state, onAsk, purpose = "to show what is nearest", precision, manual, className }: {
  state: "ask" | "asking" | "denied" | "granted" | "unavailable";
  onAsk: () => void;
  purpose?: string;
  /** e.g. "We only use the town, never your exact position." */
  precision?: string;
  /** The type-it-in alternative. */
  manual?: React.ReactNode;
  className?: string;
}) {
  return (
    <PermissionPrompt className={className} title="Use your location" state={state} onAsk={onAsk}
      askLabel="Use my location"
      reason={`We need your location ${purpose}.${precision ? ` ${precision}` : ""}`}
      fallback={manual} />
  );
}
