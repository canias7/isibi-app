import { Button } from "@/components/ui/button";
import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * Go back to how it was.
 *
 * THE CURRENT VERSION IS IN THE LIST AND CANNOT BE REVERTED TO. Leaving it out
 * makes the top row ambiguous — is that the live one or the last backup? —
 * and offering a button on it is an action that means nothing. It is marked
 * "Current" and has no control, which answers the question by construction.
 *
 * Reverting is described as CREATING a new version rather than deleting the
 * ones after it, because that is what a sane implementation does and because
 * "this will delete your recent work" is what people fear when they see the
 * word revert. If the caller's implementation really does destroy history,
 * `rollback-confirm` is the component for saying so.
 *
 * Each version carries who and when, since "revert to version 4" is not a
 * decision anybody can make and "revert to Sam's version from Tuesday" is.
 */
export type Version = { key: string; label?: string; by?: string; at: string | number | Date };

export function RevertPanel({ versions, currentKey, onRevert, className }: {
  /** Newest first. */
  versions: Version[];
  /** Which one is live. Marked, and given no control. */
  currentKey?: string;
  onRevert: (key: string) => void;
  className?: string;
}) {
  if (!versions.length) return null;
  return (
    <ul className={cn("divide-y divide-border rounded-md border border-border", className)}>
      {versions.map((v) => {
        const current = v.key === currentKey;
        return (
          <li key={v.key} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {v.label ?? <DateFormat date={v.at} withTime />}
                {current && <span className="ml-2 font-normal text-muted-foreground">Current</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {v.by ? `${v.by} · ` : ""}
                <DateFormat date={v.at} withTime />
              </p>
            </div>
            {!current && (
              <Button size="sm" variant="outline" onClick={() => onRevert(v.key)}>
                Revert to this<span className="sr-only"> version from {new Date(v.at).toISOString()}</span>
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
