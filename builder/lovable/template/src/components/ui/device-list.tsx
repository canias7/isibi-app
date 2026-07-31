import * as React from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Where an account is signed in, and dropping one of them.
 *
 * THIS DEVICE is marked and cannot be revoked by the per-row button. Signing
 * yourself out from the row that says "this device" is not wrong, it is just
 * never what the button was pressed for — the reason anyone opens this screen
 * is a device they no longer have, and mixing the two into one control makes
 * the common case a coin flip. "Sign out everywhere" is the separate,
 * deliberate action.
 *
 * A device is named by WHAT IT IS — "iPhone · Safari · United Kingdom" — not by
 * a token or an IP address. The question being answered is "do I recognise
 * this?", and a hex string answers it for nobody. The country is the useful
 * half of the location and needs no coordinates.
 *
 * Revoking is IMMEDIATE and says so, because the alternative — a change that
 * takes effect within thirty days — is not a security control anybody would
 * choose to rely on.
 */
export function DeviceList({ devices, onRevoke, onRevokeAll, busyId, className }: {
  devices: { id: string; device?: string; browser?: string; country?: string; lastSeen?: React.ReactNode; current?: boolean }[];
  onRevoke: (id: string) => void;
  onRevokeAll?: () => void;
  busyId?: string | null;
  className?: string;
}) {
  const icon = (d?: string) => {
    const s = (d ?? "").toLowerCase();
    if (/iphone|android|phone|pixel/.test(s)) return Smartphone;
    if (/ipad|tablet/.test(s)) return Tablet;
    return Monitor;
  };
  const others = devices.filter((d) => !d.current).length;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ul className="divide-y divide-border rounded-md border border-border">
        {devices.map((d) => {
          const Icon = icon(d.device);
          return (
            <li key={d.id} className="flex items-center gap-3 p-3">
              <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {[d.device, d.browser].filter(Boolean).join(" · ") || "Unknown device"}
                  {d.current ? (
                    <span className="ml-2 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
                      This device
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[d.country, d.lastSeen].filter(Boolean).map((x, i) => <React.Fragment key={i}>{i ? " · " : ""}{x}</React.Fragment>)}
                </p>
              </div>
              {d.current ? null : (
                <button type="button" onClick={() => onRevoke(d.id)} disabled={busyId === d.id}
                  className="shrink-0 cursor-pointer rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:pointer-events-none disabled:opacity-60">
                  {busyId === d.id ? "Signing out…" : "Sign out"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {onRevokeAll && others > 0 ? (
        <button type="button" onClick={onRevokeAll}
          className="cursor-pointer self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Sign out of the other {others === 1 ? "device" : `${others} devices`}
        </button>
      ) : null}
      <p className="text-xs text-muted-foreground">Signing a device out takes effect straight away.</p>
    </div>
  );
}
