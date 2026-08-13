import { useId } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * How often backups run and how long they are kept — stated as loss and reach.
 *
 * FREQUENCY IS HOW MUCH WORK YOU LOSE and retention is how far back you can go,
 * and neither is obvious from a cron expression. "Every 24 hours" means up to a
 * day's work gone; saying that outright is what makes somebody choose hourly for
 * the thing that matters.
 *
 * RETENTION IS PAIRED WITH THE FAILURE IT COVERS. Seven days protects against
 * an accident noticed this week; corruption found a month later needs a longer
 * tail, and that is the reasoning nobody applies when picking a number from a
 * dropdown.
 *
 * IT SAYS WHERE THE BACKUPS LIVE. A backup on the same infrastructure as the
 * thing it backs up survives a mistake and not an outage, and the difference
 * matters exactly once.
 *
 * NO CRON FIELD. A schedule expressed as a cron string is unreadable to the
 * person deciding, and this is a settings screen rather than an ops console.
 */
export function BackupSchedule({ frequencies, frequency, onFrequencyChange, retentions, retention, onRetentionChange, storedWhere, className }: {
  frequencies: { id: string; label: string; loses: string }[];
  frequency: string;
  onFrequencyChange: (id: string) => void;
  retentions: { id: string; label: string; covers: string }[];
  retention: string;
  onRetentionChange: (id: string) => void;
  /** Where they are kept — "a different provider, in another country". */
  storedWhere?: string;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = useId();
  const f = frequencies.find((x) => x.id === frequency);
  const r = retentions.find((x) => x.id === retention);
  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1">
        <label htmlFor={uid + "-bs-freq"} className="block text-sm font-medium">How often</label>
        <NativeSelect id={uid + "-bs-freq"} value={frequency} className="w-auto"
          onChange={(e) => onFrequencyChange(e.target.value)}>
          {frequencies.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </NativeSelect>
        {f && <p className="text-xs text-muted-foreground">If something goes wrong you lose {f.loses}.</p>}
      </div>
      <div className="space-y-1">
        <label htmlFor={uid + "-bs-ret"} className="block text-sm font-medium">Kept for</label>
        <NativeSelect id={uid + "-bs-ret"} value={retention} className="w-auto"
          onChange={(e) => onRetentionChange(e.target.value)}>
          {retentions.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </NativeSelect>
        {r && <p className="text-xs text-muted-foreground">Covers {r.covers}.</p>}
      </div>
      {storedWhere && (
        <p className="text-xs text-muted-foreground">Backups are kept on {storedWhere}.</p>
      )}
    </div>
  );
}
