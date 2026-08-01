import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * "Tell me when I pass 80%" — an alert set before the bill arrives.
 *
 * IT IS SET AT A THRESHOLD, NOT AT THE LIMIT. An alert that fires when the
 * allowance is exhausted is a notification of something already broken;
 * eighty per cent is where somebody can still do something about it, which is
 * why the presets stop short of a hundred.
 *
 * IT SAYS WHO GETS TOLD. An alert routed to whoever created it is useless when
 * that person has left, and billing alerts are exactly the ones that outlive
 * their author.
 *
 * ONE ALERT PER THRESHOLD PER PERIOD, and it says so. Without that a metric
 * hovering on the boundary sends a message every few minutes, and the whole
 * channel gets muted — which is how the ninety-per-cent alert goes unread.
 *
 * A REAL `<select>` of thresholds rather than a free number: 80, 90 and 100 are
 * what people mean, and a text field invites 8000 and a typo nobody notices.
 */
export function UsageAlertRule({ metrics, metric, onMetricChange, threshold, onThresholdChange, recipients, onRecipientsChange, thresholds = [50, 80, 90, 100], className }: {
  metrics: { id: string; label: string }[];
  metric: string;
  onMetricChange: (id: string) => void;
  threshold: number;
  onThresholdChange: (n: number) => void;
  /** Who is told. */
  recipients?: string[];
  onRecipientsChange?: (v: string[]) => void;
  thresholds?: number[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-end gap-2">
        <span className="space-y-1">
          <label htmlFor="uar-metric" className="block text-sm font-medium">Tell me when</label>
          <NativeSelect id="uar-metric" value={metric} className="h-9 w-auto text-sm"
            onChange={(e) => onMetricChange(e.target.value)}>
            {metrics.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </NativeSelect>
        </span>
        <span className="space-y-1">
          <label htmlFor="uar-threshold" className="block text-sm font-medium">passes</label>
          <NativeSelect id="uar-threshold" value={String(threshold)} className="h-9 w-auto text-sm"
            onChange={(e) => onThresholdChange(Number(e.target.value))}>
            {thresholds.map((t) => <option key={t} value={t}>{t}%</option>)}
          </NativeSelect>
        </span>
      </div>
      {recipients && onRecipientsChange && (
        <div className="space-y-1">
          <label htmlFor="uar-to" className="block text-sm font-medium">Send it to</label>
          <input id="uar-to" value={recipients.join(", ")}
            onChange={(e) => onRecipientsChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
          <p className="text-xs text-muted-foreground">
            Separate addresses with commas. Add somebody other than yourself, so it still works if you leave.
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        You will be told once per period for each threshold, not every time it goes over.
      </p>
    </div>
  );
}
