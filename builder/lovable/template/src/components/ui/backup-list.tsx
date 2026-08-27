import { cn, isoAttr, toDate } from "@/lib/utils";
/**
 * The backups that exist, with the one fact that decides their worth.
 *
 * "LAST VERIFIED" IS THE COLUMN THAT MATTERS. A backup nobody has ever restored
 * is a hypothesis, not a backup — and every backup list shows size and time
 * while omitting whether the file has ever been proved readable. Untested ones
 * are marked as such.
 *
 * THE OLDEST IS AS IMPORTANT AS THE NEWEST. Recovering from corruption
 * discovered a fortnight late needs a backup from before it started, so how far
 * BACK the set reaches is the real coverage — a nightly backup with seven days
 * of retention cannot fix a three-week-old mistake.
 *
 * A FAILED BACKUP IS A ROW, NOT AN ABSENCE. A missing night reads as a gap
 * somebody has to notice; a row saying it failed and why is the one that gets
 * acted on.
 *
 * SIZES IN THE UNIT PEOPLE THINK IN, and a size that suddenly drops is worth
 * seeing — a backup a tenth of yesterday's is usually a broken one that
 * "succeeded".
 */
export type Backup = {
  id: string;
  /** ISO date-time. */
  at?: string;
  state: "ok" | "failed" | "running";
  /** Pre-formatted — "1.2 GB". */
  size?: string;
  /** Free text — "3 days ago", or absent if never. */
  verifiedAt?: string;
  /** Why it failed. */
  error?: string;
};

export function BackupList({ backups, coversBackTo, emptyNote = "No backups yet", className }: {
  /** Newest first. */
  backups: Backup[];
  /** Free text — "14 days". */
  coversBackTo?: string;
  emptyNote?: string;
  className?: string;
}) {
  if (!backups.length) return <p data-slot="backup-list" className={cn("text-sm text-muted-foreground", className)}>{emptyNote}</p>;
  const unverified = backups.filter((b) => b.state === "ok" && !b.verifiedAt).length;
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs text-muted-foreground">
        {coversBackTo && <span>Goes back {coversBackTo}. </span>}
        {unverified > 0 && (
          <span className="text-foreground">
            {unverified} {unverified === 1 ? "has" : "have"} never been checked by restoring.
          </span>
        )}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {backups.map((b) => {
          const d = b.at ? toDate(b.at) : null;
          const ok = d && !Number.isNaN(d.getTime());
          return (
            <li key={b.id} className="flex items-start gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className={cn("block", b.state === "failed" && "font-medium")}>
                  {ok
                    ? <time dateTime={isoAttr(d)}>
                        {d!.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </time>
                    : "Unknown time"}
                  {b.state === "running" && <span className="text-muted-foreground"> · running</span>}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {b.state === "failed"
                    ? (b.error ?? "Failed, no reason recorded")
                    : b.verifiedAt
                      ? `Checked by restoring ${b.verifiedAt}`
                      : "Never checked by restoring"}
                </span>
              </span>
              <span className="shrink-0 text-end text-xs">
                {b.size && <span className="block tabular-nums">{b.size}</span>}
                {b.state === "failed" && <span className="block font-medium">Failed</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
