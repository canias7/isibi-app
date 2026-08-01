import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/**
 * One defect — where it is, who owes it, and whether it has been checked.
 *
 * "FIXED" AND "CHECKED" ARE DIFFERENT STATES and conflating them is how a snag
 * list closes with defects still present. The trade marks it done; somebody
 * else has to look. A two-state list means whoever caused the problem also
 * signs it off.
 *
 * THE LOCATION IS AS IMPORTANT AS THE DESCRIPTION. "Cracked tile" on a
 * four-storey job is unfindable; "Cracked tile — Flat 12, bathroom, behind the
 * door" is a five-minute fix. This is the field snag lists always compress.
 *
 * THE TRADE RESPONSIBLE IS NAMED, because a snag with no owner is one that
 * arrives at the main contractor and stops. Disputed ownership is normal and
 * gets its own state rather than being left blank.
 *
 * `SafeImage`, since a photograph is the usual evidence and is frequently
 * missing at the moment the item is raised.
 */
export function SnagItem({ number, description, location, trade, state, raisedBy, due, photo, className }: {
  number?: number;
  description: string;
  /** Where — "Flat 12, bathroom, behind the door". */
  location?: string;
  /** Who owes it. */
  trade?: string;
  state: "open" | "fixed" | "checked" | "disputed";
  raisedBy?: string;
  /** Free text — "before handover". */
  due?: string;
  photo?: string;
  className?: string;
}) {
  const WORD = { open: "Open", fixed: "Says fixed", checked: "Checked and closed", disputed: "Disputed" } as const;
  const outstanding = state !== "checked";
  return (
    <li className={cn("flex items-start gap-3 px-3 py-2 text-sm", className)}>
      {photo !== undefined && (
        <SafeImage src={photo} alt="" className="size-12 shrink-0 rounded object-cover" />
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block", outstanding && "font-medium")}>
          {number !== undefined && <span className="tabular-nums text-muted-foreground">{number}. </span>}
          {description}
        </span>
        <span className="block text-xs text-muted-foreground">
          {location ?? "No location given — this will be hard to find"}
        </span>
        <span className="block text-xs text-muted-foreground">
          {trade ?? "Nobody assigned"}
          {raisedBy && ` · raised by ${raisedBy}`}
          {due && ` · due ${due}`}
        </span>
      </span>
      <span className={cn("shrink-0 text-right text-xs", state === "checked" ? "text-muted-foreground" : "font-medium")}>
        {WORD[state]}
      </span>
    </li>
  );
}
