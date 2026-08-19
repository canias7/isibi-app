import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Collect it from here.
 *
 * The opening hours are not optional detail — a collection point somebody
 * cannot reach before it shuts is a parcel that goes back. They sit with the
 * address rather than behind a "details" link for that reason.
 */
export function PickupPoint({ name, address, hours, note, selected, onSelect, className }: {
  name: string; address: string; hours?: string; note?: string;
  selected?: boolean; onSelect?: () => void; className?: string;
}) {
  const body = (
    <>
      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{name}</span>
        <span className="block text-sm text-muted-foreground">{address}</span>
        {hours && <span className="mt-0.5 block text-xs text-muted-foreground">{hours}</span>}
        {note && <span className="mt-0.5 block text-xs">{note}</span>}
      </span>
    </>
  );
  const cls = cn("flex w-full items-start gap-3 rounded-lg border p-3 text-start",
    selected ? "border-foreground" : "border-border", className);
  return onSelect
    ? <button type="button" onClick={onSelect} aria-pressed={selected}
        className={cn(cls, "cursor-pointer hover:bg-muted/40")}>{body}</button>
    : <div className={cls}>{body}</div>;
}
