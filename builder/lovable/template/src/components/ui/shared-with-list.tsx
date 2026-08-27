import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * The people on this, with their level changeable in place.
 *
 * CHANGING A LEVEL IS ONE ACTION, in the row. The common alternative — open a
 * dialog, find the person again, change, save — is enough friction that
 * permissions simply do not get tidied up, which is how leavers keep access for
 * years.
 *
 * THE OWNER'S ROW HAS NO CONTROL and says why. A dropdown that includes the only
 * owner invites an action that has to be refused, and a refusal after the click
 * is worse than no control at all.
 *
 * Removal is a labelled button naming the person, because a column of identical
 * "Remove" controls is exactly where the wrong one gets pressed.
 */
export type SharedPerson = { id: string; name: string; email?: string; level: string; owner?: boolean };

export function SharedWithList({ people, levels, onLevelChange, onRemove, className }: {
  people: SharedPerson[];
  levels: { value: string; label: string }[];
  onLevelChange: (id: string, level: string) => void;
  onRemove?: (id: string) => void;
  className?: string;
}) {
  if (!people.length) return null;
  return (
    <ul data-slot="shared-with-list" className={cn("divide-y divide-border", className)}>
      {people.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm">{p.name}</p>
            {p.email && <p className="truncate text-xs text-muted-foreground">{p.email}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {p.owner ? (
              <span className="text-sm text-muted-foreground">Owner</span>
            ) : (
              <>
                <NativeSelect value={p.level} aria-label={`Access level for ${p.name}`}
                  className="h-8 w-auto text-sm"
                  onChange={(e) => onLevelChange(p.id, e.target.value)}>
                  {levels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </NativeSelect>
                {onRemove && (
                  <button type="button" onClick={() => onRemove(p.id)}
                    aria-label={`Remove ${p.name}`}
                    className="cursor-pointer text-xs underline underline-offset-2">Remove</button>
                )}
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
