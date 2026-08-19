import * as React from "react";
import { Check, Minus, Lock } from "lucide-react";
import { cn, labelText } from "@/lib/utils";
/**
 * Roles across the top, permissions down the side, a tick where they meet.
 *
 * A permission is described by WHAT IT LETS SOMEBODY DO, not by its identifier.
 * `bookings:write` is a name only this codebase knows; "Change or cancel a
 * booking" is the sentence the owner is actually deciding about, and getting
 * that decision wrong is how a part-time member of staff ends up able to refund
 * payments.
 *
 * A cell can be LOCKED — a permission a role always has, or can never have.
 * Rendering it as an ordinary unticked box invites somebody to tick it, and the
 * silent refusal that follows reads as a broken screen.
 *
 * A locked cell still shows the TICK OR DASH, with a small padlock beside it.
 * The first version drew a padlock alone for both, differing only in grey
 * versus black — so "always allowed" and "never allowed" were the same shape,
 * separated by the one channel that does not survive greyscale or print. Seen
 * exactly that way on a refund permission, where the two readings are opposite.
 *
 * Read-only and editable are the same grid, because the two versions of this
 * screen diverging is how "what the owner sees" stops matching "what the server
 * enforces". A tick and a dash carry it either way — never colour.
 */
export function PermissionMatrix({
  roles, groups, value, onToggle, readOnly, className,
}: {
  roles: { key: string; label: React.ReactNode; hint?: React.ReactNode }[];
  groups: { key: string; label?: React.ReactNode; permissions: { key: string; label: React.ReactNode; hint?: React.ReactNode }[] }[];
  value: (role: string, permission: string) => boolean | "locked-on" | "locked-off";
  onToggle?: (role: string, permission: string) => void;
  readOnly?: boolean;
  className?: string;
}) {
  const cell = (role: string, perm: string, label: string) => {
    const v = value(role, perm);
    const locked = v === "locked-on" || v === "locked-off";
    const on = v === true || v === "locked-on";
    // BOTH halves, not just the first. `roles[].label` is a ReactNode too, so
    // the role name went into this accessible name as "[object Object]" while
    // the permission name beside it read correctly — the kind of half-fix that
    // looks done from the diff.
    const name = `${labelText(label)} for ${labelText(roles.find((r) => r.key === role)?.label) || role}`;

    if (readOnly || locked || !onToggle) {
      return (
        <span className="inline-flex items-center justify-center gap-0.5"
          title={locked ? (on ? "Always allowed — cannot be changed" : "Never allowed — cannot be changed") : undefined}>
          {on ? <Check aria-hidden className="size-4" /> : <Minus aria-hidden className="size-4 text-muted-foreground" />}
          {locked ? <Lock aria-hidden className="size-2.5 text-muted-foreground" /> : null}
          <span className="sr-only">{name}: {on ? "allowed" : "not allowed"}{locked ? ", cannot be changed" : ""}</span>
        </span>
      );
    }
    return (
      <button type="button" role="switch" aria-checked={on} aria-label={name}
        onClick={() => onToggle(role, perm)}
        className="cursor-pointer rounded p-1 hover:bg-muted">
        {on ? <Check aria-hidden className="size-4" /> : <Minus aria-hidden className="size-4 text-muted-foreground" />}
      </button>
    );
  };

  return (
    <div className={cn("overflow-x-auto rounded-md border border-border", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="sticky start-0 z-1 bg-muted px-3 py-2 text-start font-medium">Can do</th>
            {roles.map((r) => (
              <th key={r.key} scope="col" className="min-w-24 bg-muted px-3 py-2 text-center align-top font-medium">
                <span className="block whitespace-nowrap">{r.label}</span>
                {r.hint ? <span className="block text-xs font-normal text-muted-foreground">{r.hint}</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.key}>
            {g.label ? (
              <tr className="border-b border-border bg-muted/40">
                <th scope="colgroup" colSpan={roles.length + 1}
                  className="px-3 py-1.5 text-start text-xs font-semibold tracking-wide uppercase">{g.label}</th>
              </tr>
            ) : null}
            {g.permissions.map((p) => (
              <tr key={p.key} className="border-b border-border last:border-0">
                <th scope="row" className="sticky start-0 z-1 bg-background px-3 py-2 text-start font-normal">
                  <span className="block">{p.label}</span>
                  {p.hint ? <span className="block text-xs text-muted-foreground">{p.hint}</span> : null}
                </th>
                {roles.map((r) => (
                  <td key={r.key} className="px-3 py-2 text-center">
                    {cell(r.key, p.key, typeof p.label === "string" ? p.label : p.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
