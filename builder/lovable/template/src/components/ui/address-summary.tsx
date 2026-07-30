import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * A confirmed address, read back before something is sent to it.
 *
 * `<address>`, and the empty lines are dropped rather than rendered as gaps —
 * most addresses have no second line, and a blank row in the middle of one
 * looks like something failed to load.
 *
 * Editing stays available right up to the last screen. The commonest reason a
 * parcel goes astray is a flat number somebody spotted on the confirmation
 * page and could not change.
 */
export function AddressSummary({ name, lines, postcode, country, onEdit, className }: {
  name?: string; lines?: (string | null | undefined)[];
  postcode?: string; country?: string; onEdit?: () => void; className?: string;
}) {
  const parts = (lines ?? []).filter((l): l is string => !!l && l.trim() !== "");
  return (
    <div className={cn("flex items-start justify-between gap-3 rounded-md border border-border p-3", className)}>
      <address className="text-sm not-italic">
        {name && <span className="block font-medium">{name}</span>}
        {parts.map((l) => <span key={l} className="block text-muted-foreground">{l}</span>)}
        {postcode && <span className="block text-muted-foreground">{postcode}</span>}
        {country && <span className="block text-muted-foreground">{country}</span>}
      </address>
      {onEdit && <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>}
    </div>
  );
}
