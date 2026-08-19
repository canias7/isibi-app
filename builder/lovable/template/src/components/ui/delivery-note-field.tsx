import { cn } from "@/lib/utils";
/**
 * "Leave it with the neighbour" — instructions for whoever turns up.
 *
 * IT SAYS WHO WILL READ IT AND WHEN, because that is what stops people writing
 * the wrong thing here. Left unlabelled, this box collects order changes, refund
 * requests and complaints — none of which reach anybody, because the only
 * person who sees it is holding a parcel on a doorstep.
 *
 * THE LIMIT IS SHOWN BEFORE IT IS HIT, and it is short on purpose. These notes
 * are printed on a label or shown on a five-line handheld screen, so a
 * paragraph is silently truncated somewhere nobody controls — better to say 120
 * characters up front.
 *
 * SUGGESTIONS ARE ONE TAP, since the same four instructions cover most cases
 * and typing them on a phone at checkout is friction that makes people skip the
 * field entirely.
 *
 * NO PERSONAL DETAIL PROMPTED. The placeholder never asks for a door code or a
 * key location — that text ends up printed on a label and photographed at the
 * door, and a component should not encourage it.
 */
export function DeliveryNoteField({ value, onChange, suggestions = [], maxLength = 120, id = "delivery-note", audience = "the driver", className }: {
  value: string;
  onChange: (v: string) => void;
  suggestions?: string[];
  maxLength?: number;
  id?: string;
  /** Who reads it — "the driver", "our fitter". */
  audience?: string;
  className?: string;
}) {
  const left = maxLength - value.length;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        Anything {audience} should know?
        <span className="ms-1.5 font-normal text-muted-foreground">optional</span>
      </label>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => onChange(s)}
              className={cn("rounded-full border px-2.5 py-0.5 text-xs",
                value === s ? "border-foreground bg-foreground text-background" : "border-border")}>
              {s}
            </button>
          ))}
        </div>
      )}
      <textarea id={id} rows={2} value={value} maxLength={maxLength}
        aria-describedby={`${id}-help`}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm" />
      <p id={`${id}-help`} className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
        <span>Only {audience} sees this, on the day.</span>
        <span className="tabular-nums">{left} characters left</span>
      </p>
    </div>
  );
}
