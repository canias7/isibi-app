import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
/**
 * The on/off switch for a rule, with when it last did something.
 *
 * "LAST RAN" IS BESIDE THE SWITCH DELIBERATELY. A rule that is on and has not
 * fired in three months is the most common broken state in any automation
 * system, and the switch alone reports it as healthy. Putting the date here
 * makes the two facts impossible to read separately.
 *
 * TURNING IT OFF DOES NOT ASK, but turning it ON warns when the rule would
 * act on the backlog. A newly enabled rule that immediately texts three hundred
 * old bookings is the expensive accident, and it happens on the enable, never
 * on the disable.
 *
 * OFF IS SAID IN A WORD, since a switch position alone is exactly the state
 * people misread at a glance in a list of fifteen.
 *
 * `pending` disables it and says "Saving…", because these round-trip and a
 * switch that springs back with no explanation reads as a refusal.
 */
export function RuleEnabled({ enabled, onChange, lastRan, backlogCount, pending, id = "rule-enabled", className }: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  /** Free text — "3 months ago", "20 minutes ago". */
  lastRan?: string;
  /** Existing records this rule would act on when switched on. */
  backlogCount?: number;
  pending?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Switch id={id} checked={enabled} disabled={pending}
        onCheckedChange={(v) => {
          const on = v === true;
          if (on && backlogCount && backlogCount > 0) {
            const msg = `This will act on ${backlogCount.toLocaleString()} ${backlogCount === 1 ? "record" : "records"} straight away. Continue?`;
            if (!window.confirm(msg)) return;
          }
          onChange(on);
        }} />
      <label htmlFor={id} className="min-w-0 text-sm">
        <span className="block">{enabled ? "On" : "Off"}</span>
        <span className="block text-xs text-muted-foreground">
          {pending ? "Saving…" : lastRan ? `Last ran ${lastRan}` : "Has not run yet"}
        </span>
      </label>
    </div>
  );
}
