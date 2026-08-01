import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * "A new version is ready" — with what it costs to take it.
 *
 * IT SAYS WHETHER ANYTHING WILL BREAK. An upgrade prompt with no risk statement
 * gets postponed indefinitely by anybody sensible, because the unknown downside
 * is worse than the known present. "Nothing you use changes" is what makes
 * somebody press it.
 *
 * IT SAYS HOW LONG AND WHETHER IT INTERRUPTS. A thirty-second upgrade and one
 * that takes the system down for an hour need scheduling differently, and
 * finding that out afterwards is how an upgrade happens at the wrong time.
 *
 * "LATER" IS A REAL OPTION AND SAYS WHEN. A dismissible prompt that returns
 * tomorrow is fine; one that returns in ten minutes is why people upgrade
 * carelessly to make it stop.
 *
 * NO AUTOMATIC COUNTDOWN TO A FORCED UPGRADE unless the caller sets one, and
 * then it is stated as a date rather than implied.
 */
export function UpgradePrompt({ version, headline, breaking, downtime, duration, forcedAfter, onUpgrade, onLater, busy, className }: {
  version: string;
  /** The one-line reason to take it. */
  headline?: string;
  /** True when something the reader uses changes. */
  breaking?: boolean;
  /** True when the system is unavailable during it. */
  downtime?: boolean;
  /** Free text — "about 2 minutes". */
  duration?: string;
  /** Free text — "14 August", when it stops being optional. */
  forcedAfter?: string;
  onUpgrade: () => void;
  onLater?: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2 rounded-md border border-border p-3", className)}>
      <p className="text-sm">
        <span className="font-medium">Version {version} is ready</span>
        {headline && <span className="block text-xs text-muted-foreground">{headline}</span>}
      </p>
      <p className="text-xs text-muted-foreground">
        {breaking
          ? <span className="font-medium text-foreground">Some things you use change — read the notes before upgrading. </span>
          : "Nothing you use today changes. "}
        {downtime
          ? `The system is unavailable while it runs${duration ? `, ${duration}` : ""}.`
          : `You can keep working while it runs${duration ? ` — ${duration}` : ""}.`}
      </p>
      {forcedAfter && (
        <p className="text-xs text-muted-foreground">Optional until {forcedAfter}.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onUpgrade} disabled={busy}>
          {busy ? "Upgrading…" : "Upgrade now"}
        </Button>
        {onLater && (
          <Button type="button" size="sm" variant="outline" onClick={onLater} disabled={busy}>
            Not now
          </Button>
        )}
      </div>
    </div>
  );
}
