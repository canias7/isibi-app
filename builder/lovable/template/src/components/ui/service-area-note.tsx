import { cn } from "@/lib/utils";
/**
 * "We come to you within 10 miles" — where a business will travel to.
 *
 * THE ANSWER TO A CHECKED ADDRESS IS THREE-WAY, NOT TWO. Inside, outside, and
 * outside-but-for-a-fee — that third case is how most mobile trades actually
 * work, and a yes/no answer either loses the business or promises free travel
 * it never offered.
 *
 * IT IS ALSO USEFUL WITH NOTHING CHECKED. Before anybody types an address the
 * component still states the area and the base radius, which is the passive
 * form every services page needs and the reason this is not just a validator.
 *
 * OUTSIDE IS NOT AN ERROR AND IS NOT STYLED AS ONE. The customer did nothing
 * wrong; the business simply does not go there. It says so plainly and, where
 * the caller supplies one, offers the nearest thing that is covered.
 *
 * `role="status"` only once an address has been checked, so it announces the
 * answer without shouting the static description on every page load.
 */
export function ServiceAreaNote({ area, radius, result, fee, nearest, className }: {
  /** Free text — "North London", "within the M25". */
  area?: string;
  /** Pre-formatted — "10 miles". */
  radius?: string;
  /** The answer for a checked address. Omit for the passive description. */
  result?: "inside" | "surcharge" | "outside";
  /** Pre-formatted travel charge, for the surcharge case. */
  fee?: string;
  /** Suggestion when outside — "our Camden branch". */
  nearest?: string;
  className?: string;
}) {
  const base = [area, radius && `up to ${radius}`].filter(Boolean).join(", ");
  if (!result) {
    if (!base) return null;
    return <p className={cn("text-sm text-muted-foreground", className)}>We cover {base}.</p>;
  }
  return (
    <p role="status" className={cn("text-sm", className)}>
      {result === "inside" && <span className="font-medium">That address is covered.</span>}
      {result === "surcharge" && (
        <>
          <span className="font-medium">That address is a little outside our usual area.</span>
          <span className="text-muted-foreground">
            {fee ? ` We can still come, for ${fee} travel.` : " We can still come, for a travel charge."}
          </span>
        </>
      )}
      {result === "outside" && (
        <>
          <span className="font-medium">We do not travel that far.</span>
          {nearest && <span className="text-muted-foreground"> Try {nearest}.</span>}
        </>
      )}
      {base && <span className="block text-xs text-muted-foreground">We cover {base}.</span>}
    </p>
  );
}
