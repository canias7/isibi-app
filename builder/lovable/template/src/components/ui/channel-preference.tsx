import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
/**
 * Which way each kind of message reaches you.
 *
 * A GRID, NOT A LIST OF SWITCHES. The question is "how do I hear about
 * bookings", and answering it from a flat list of "Email bookings", "SMS
 * bookings", "Push bookings" means reading nine rows to reconstruct three.
 *
 * A ROW WITH NOTHING TICKED IS FLAGGED. Turning every channel off for a kind of
 * message means never hearing about it, which is occasionally intended and
 * usually an accident — and it is invisible in a grid of empty boxes.
 *
 * REQUIRED ROWS CANNOT BE FULLY DISABLED. Security alerts and payment failures
 * are not preferences, and a checkbox that silently refuses is worse than one
 * visibly fixed.
 */
export type ChannelRow = { key: string; label: string; channels: Record<string, boolean>; required?: boolean };

export function ChannelPreference({ rows, channels, onToggle, className }: {
  rows: ChannelRow[];
  channels: { key: string; label: string }[];
  onToggle: (row: string, channel: string) => void;
  className?: string;
}) {
  if (!rows.length || !channels.length) return null;
  return (
    <table data-slot="channel-preference" className={cn("w-full text-sm", className)}>
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className="py-2 text-start text-xs font-normal text-muted-foreground">Tell me about</th>
          {channels.map((c) => (
            <th key={c.key} scope="col" className="px-2 py-2 text-xs font-normal text-muted-foreground">{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const none = channels.every((c) => !r.channels[c.key]);
          return (
            <tr key={r.key} className="border-b border-border last:border-0">
              <th scope="row" className="py-2 text-start font-normal">
                {r.label}
                {none && <span className="block text-xs font-medium">You won&apos;t hear about these</span>}
              </th>
              {channels.map((c) => {
                const on = !!r.channels[c.key];
                const locked = r.required && on && channels.filter((x) => r.channels[x.key]).length <= 1;
                return (
                  <td key={c.key} className="px-2 py-2 text-center">
                    <Checkbox checked={on} disabled={locked}
                      onCheckedChange={() => onToggle(r.key, c.key)}
                      aria-label={`${r.label} by ${c.label}`} />
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
