import { Button } from "@/components/ui/button";
import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * Saved copies you can go back to.
 *
 * Distinct from `revert-panel`, which lists every version the system kept
 * automatically. A snapshot is DELIBERATE — somebody named it before a risky
 * change — so the name is the primary text here where the timestamp leads
 * there.
 *
 * AUTOMATIC AND MANUAL SNAPSHOTS ARE LABELLED APART. They expire under
 * different rules (an automatic one is usually rotated away within days) and
 * somebody choosing where to roll back to needs to know which kind they are
 * trusting.
 *
 * Delete is offered only for manual ones, because an automatic snapshot is the
 * system's to manage and a button that appears to remove it either lies or
 * breaks the rotation.
 *
 * Size is shown when the caller knows it — a restore is a wait, and the number
 * is the only clue how long.
 */
export type Snapshot = {
  key: string; label: string; at: string | number | Date;
  by?: string; auto?: boolean; size?: string;
};

export function SnapshotList({ snapshots, onRestore, onDelete, empty = "No snapshots yet.", className }: {
  snapshots: Snapshot[];
  onRestore: (key: string) => void;
  onDelete?: (key: string) => void;
  empty?: string;
  className?: string;
}) {
  if (!snapshots.length) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{empty}</p>;
  }
  return (
    <ul className={cn("divide-y divide-border rounded-md border border-border", className)}>
      {snapshots.map((s) => (
        <li key={s.key} className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {s.label}
              <span className="ml-2 font-normal text-muted-foreground">{s.auto ? "Automatic" : "Manual"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              <time dateTime={new Date(s.at).toISOString()}><DateFormat date={s.at} withTime /></time>
              {s.by ? ` · ${s.by}` : ""}{s.size ? ` · ${s.size}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={() => onRestore(s.key)}>
              Restore<span className="sr-only"> {s.label}</span>
            </Button>
            {onDelete && !s.auto && (
              <Button size="sm" variant="outline" onClick={() => onDelete(s.key)}>
                Delete<span className="sr-only"> {s.label}</span>
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
