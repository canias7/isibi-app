import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
/**
 * The email/push grid — one row per event, one column per channel.
 *
 * A grid rather than a list of toggles because the real question is per
 * channel, and a flat list forces "Email me about bookings" and "Push me about
 * bookings" to be two unrelated rows drifting apart.
 */
export function NotificationPrefs({ channels, rows, value, onChange, className }: {
  channels: { key: string; label: string }[];
  rows: { key: string; label: string; description?: string }[];
  value: Record<string, string[]>;
  onChange: (rowKey: string, channelKey: string, on: boolean) => void;
  className?: string;
}) {
  return (
    <table data-slot="notification-prefs" className={cn("w-full text-sm", className)}>
      <thead>
        <tr className="border-b border-border">
          <th className="py-2 text-start font-medium">Notify me about</th>
          {channels.map((c) => (
            <th key={c.key} className="w-20 py-2 text-center text-xs font-medium text-muted-foreground">{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-b border-border last:border-0">
            <td className="py-3 pe-4">
              <span className="block">{r.label}</span>
              {r.description && <span className="block text-xs text-muted-foreground">{r.description}</span>}
            </td>
            {channels.map((c) => (
              <td key={c.key} className="py-3 text-center">
                <Checkbox checked={(value[r.key] ?? []).includes(c.key)}
                  aria-label={`${c.label}: ${r.label}`}
                  onCheckedChange={(v) => onChange(r.key, c.key, v === true)} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
