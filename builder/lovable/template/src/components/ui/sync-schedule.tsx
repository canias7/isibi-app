import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * How often a sync runs, and when the next one is.
 *
 * "NEXT RUN" IS THE FIELD PEOPLE COME FOR. Somebody who has just fixed a record
 * wants to know when it will reach the other side — and a frequency alone ("every
 * 6 hours") does not answer it, because they do not know when the cycle started.
 *
 * MANUAL IS A REAL OPTION AND SAYS WHAT IT COSTS. Plenty of integrations should
 * only run when somebody asks; the honest version says nothing will move until
 * they press the button, rather than leaving them to discover it.
 *
 * FREQUENCY IS OFFERED AS THE CALLER'S OWN LIST. Every provider has different
 * rate limits, and a fixed menu offering "every minute" against an API that
 * allows four calls an hour produces a permanently failing integration.
 *
 * IT SAYS SYNCS CAN BE SKIPPED WHEN ONE IS STILL RUNNING, because an
 * overlapping run is the standard cause of duplicated records and a schedule
 * screen is where somebody would set that up by accident.
 */
export function SyncSchedule({ options, value, onChange, nextRun, lastRun, running, className }: {
  options: { id: string; label: string }[];
  /** "" for manual only. */
  value: string;
  onChange: (v: string) => void;
  /** Free text — "in 40 minutes". */
  nextRun?: string;
  /** Free text — "2 hours ago". */
  lastRun?: string;
  running?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor="sync-freq" className="block text-sm font-medium">How often</label>
      <NativeSelect id="sync-freq" value={value} className="w-auto" onChange={(e) => onChange(e.target.value)}>
        <option value="">Only when I press the button</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </NativeSelect>
      <p className="text-xs text-muted-foreground">
        {value === "" ? (
          "Nothing will move until you run it yourself."
        ) : running ? (
          "Running now."
        ) : (
          <>
            {nextRun ? `Next run ${nextRun}.` : "Next run not scheduled yet."}
            {lastRun && ` Last run ${lastRun}.`}
          </>
        )}
      </p>
      {value !== "" && (
        <p className="text-xs text-muted-foreground">
          A run is skipped if the previous one has not finished.
        </p>
      )}
    </div>
  );
}
