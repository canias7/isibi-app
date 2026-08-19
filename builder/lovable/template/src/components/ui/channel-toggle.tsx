import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A grid of what gets sent where — email, push, in-app — per kind of event.
 *
 * A CHANNEL THAT IS NOT SET UP IS DISABLED WITH A REASON AND A LINK. "Push" as
 * an unticked box on a browser that never granted permission is a setting
 * somebody ticks, saves, and then waits for messages that will never arrive.
 *
 * SOME ROWS CANNOT BE TURNED OFF and say so — a password reset, a receipt.
 * Rendering them as an ordinary unticked box invites a silent refusal on save,
 * and rendering them as ticked-and-editable is worse.
 *
 * The grid has real `<th>` headers in both directions, so a screen reader can
 * announce "Email, New bookings, checked". A grid of bare checkboxes is 24
 * unlabelled controls.
 *
 * Changes apply immediately; there is no Save. A settings grid with a save
 * button loses changes when somebody navigates away, and the individual
 * toggles are already atomic.
 */
export function ChannelToggle({ channels, kinds, value, onChange, className }: {
  channels: { key: string; label: string; unavailable?: boolean; reason?: React.ReactNode; setupHref?: string }[];
  kinds: { key: string; label: string; hint?: React.ReactNode; required?: string[] }[];
  value: Record<string, string[]>;
  onChange: (kind: string, channel: string, on: boolean) => void;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="px-3 py-2 text-start font-medium">Tell me about</th>
            {channels.map((c) => (
              <th key={c.key} scope="col" className="px-3 py-2 text-center align-bottom font-medium">
                <span className="block">{c.label}</span>
                {c.unavailable ? (
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    {c.setupHref ? <a href={c.setupHref} className="underline">{c.reason ?? "Not set up"}</a> : (c.reason ?? "Not set up")}
                  </span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {kinds.map((k) => (
            <tr key={k.key} className="border-b border-border last:border-0">
              <th scope="row" className="px-3 py-2 text-start font-normal">
                <span className="block">{k.label}</span>
                {k.hint ? <span className="block text-xs text-muted-foreground">{k.hint}</span> : null}
              </th>
              {channels.map((c) => {
                const required = k.required?.includes(c.key);
                const on = required || (value[k.key] ?? []).includes(c.key);
                return (
                  <td key={c.key} className="px-3 py-2 text-center">
                    {required ? (
                      <span className="text-xs text-muted-foreground">Always</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={on && !c.unavailable}
                        disabled={c.unavailable}
                        onChange={(e) => onChange(k.key, c.key, e.target.checked)}
                        aria-label={`${k.label} by ${c.label}`}
                        title={c.unavailable ? (typeof c.reason === "string" ? c.reason : "Not set up") : undefined}
                        className="size-4 cursor-pointer accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
