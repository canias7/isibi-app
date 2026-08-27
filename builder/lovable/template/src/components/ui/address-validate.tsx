import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * A suggested correction to an address, which the person can refuse.
 *
 * KEEPING WHAT THEY TYPED IS ALWAYS AN OPTION, and that is the whole design. An
 * address validator that silently rewrites an entry gets new builds, flats
 * above shops and rural properties wrong — and the person who lives there knows
 * better than the database. Both versions are shown side by side and they
 * choose.
 *
 * THE DIFFERENCE IS SHOWN AS TWO WHOLE ADDRESSES, not a field-level diff. An
 * address is read as a block; a highlighted token in the middle of one makes
 * somebody parse rather than recognise.
 *
 * "NOT FOUND" IS NOT A REFUSAL. A validator that cannot match an address must
 * not block the form — plenty of valid addresses are not in any database, and
 * an undeliverable form is worse than an unverified address.
 *
 * `role="status"` — this appears after somebody types, and is the response to
 * what they did.
 */
export function AddressValidate({ state, entered, suggested, onAccept, onKeep, className }: {
  state: "match" | "suggestion" | "not-found";
  /** What the person typed, as lines. */
  entered: string[];
  /** The proposed version, as lines. */
  suggested?: string[];
  onAccept?: () => void;
  onKeep?: () => void;
  className?: string;
}) {
  if (state === "match") {
    return <p data-slot="address-validate" role="status" className={cn("text-xs text-muted-foreground", className)}>Address found.</p>;
  }
  if (state === "not-found") {
    return (
      <p role="status" className={cn("text-xs text-muted-foreground", className)}>
        We could not find that address, but you can carry on — plenty of addresses are not listed.
      </p>
    );
  }
  return (
    <div role="status" className={cn("space-y-2 rounded-md border border-border p-3", className)}>
      <p className="text-sm">Did you mean this?</p>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">You typed</p>
          <address className="not-italic">{entered.map((l) => <span key={l} className="block">{l}</span>)}</address>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">We found</p>
          <address className="not-italic font-medium">
            {(suggested ?? []).map((l) => <span key={l} className="block">{l}</span>)}
          </address>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {onAccept && <Button type="button" size="sm" onClick={onAccept}>Use the one we found</Button>}
        {onKeep && <Button type="button" size="sm" variant="outline" onClick={onKeep}>Keep what I typed</Button>}
      </div>
    </div>
  );
}
