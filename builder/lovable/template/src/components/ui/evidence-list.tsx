import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/**
 * Photos and documents attached to a record, with when each was taken.
 *
 * THE CAPTURE TIME IS THE EVIDENCE, not the upload time. A photo of damage
 * taken on the day and one taken three weeks later are worth different amounts
 * in any dispute, and every attachment list shows the upload timestamp — which
 * is the one a claimant controls completely.
 *
 * IT SAYS WHEN THE TWO DISAGREE. A photo taken in March and uploaded in July is
 * not necessarily suspicious, but it is a fact whoever is assessing needs, and
 * only this component is positioned to state it.
 *
 * `SafeImage`, BECAUSE A THUMBNAIL IS OFTEN MISSING — a PDF has none, and a
 * just-uploaded file has not been processed yet. A bare `<img>` paints a broken
 * icon across the whole list.
 *
 * WHO ADDED IT is on every row, since evidence gathered by the customer and by
 * the inspector carry different weight and a mixed list is otherwise
 * indistinguishable.
 */
export type Evidence = {
  id: string;
  name: string;
  thumbnail?: string;
  /** See `Shot` in gallery.tsx — every picture type drawn through SafeImage carries this. */
  fallbackSeed?: string;
  /** ISO date-time the photo was taken. */
  takenAt?: string;
  /** ISO date-time it reached us. */
  uploadedAt?: string;
  by?: string;
};

export function EvidenceList({ items, emptyNote = "Nothing attached", className }: {
  items: Evidence[];
  emptyNote?: string;
  className?: string;
}) {
  if (!items.length) return <p className={cn("text-sm text-muted-foreground", className)}>{emptyNote}</p>;
  const fmt = (s?: string) => {
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  return (
    <ul className={cn("divide-y divide-border rounded-md border border-border", className)}>
      {items.map((e) => {
        const taken = fmt(e.takenAt);
        const up = fmt(e.uploadedAt);
        const gap = taken && up && Math.abs(up.getTime() - taken.getTime()) > 86_400_000;
        return (
          <li key={e.id} className="flex items-start gap-3 px-3 py-2 text-sm">
            {/* Seeded on the name: the alt is empty by design (the name is beside it),
              and with neither the seed nor an alt every row paints the same panel. */}
            <SafeImage src={e.thumbnail} alt="" fallbackSeed={e.fallbackSeed ?? e.name} className="size-10 shrink-0 rounded object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{e.name}</span>
              <span className="block text-xs text-muted-foreground">
                {taken
                  ? <>Taken <time dateTime={taken.toISOString()}>{taken.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</time></>
                  : "Taken date unknown"}
                {e.by && <span> · added by {e.by}</span>}
              </span>
              {gap && up && (
                <span className="block text-xs text-muted-foreground">
                  Uploaded <time dateTime={up.toISOString()}>{up.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</time>
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
