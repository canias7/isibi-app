import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Choosing what somebody is allowed to do.
 *
 * Each role says what it MEANS, in the same place the choice is made. A select
 * containing "Admin / Manager / Staff" and a help link elsewhere makes the
 * owner guess, and the guess that gets made is the generous one — which is how
 * a Saturday assistant ends up able to refund payments.
 *
 * A real `RadioGroup` shape (`role="radiogroup"`, one tab stop, arrow keys
 * between options) rather than a set of clickable divs, which is unreachable
 * from a keyboard and announces nothing.
 *
 * The role the person ALREADY has is marked as current and stays selectable, so
 * closing without changing anything is obvious. And a role that would remove
 * the caller's own access carries a warning rather than being hidden: the owner
 * may genuinely mean it, and a silently missing option looks like a bug.
 */
export function RolePicker({
  roles, value, onChange, current, name, warnKeys = [], className,
}: {
  roles: { key: string; label: React.ReactNode; description?: React.ReactNode; warning?: React.ReactNode }[];
  value: string;
  onChange: (key: string) => void;
  current?: string;
  name?: string;
  warnKeys?: string[];
  className?: string;
}) {
  const auto = React.useId();
  const group = name ?? auto;
  const move = (d: 1 | -1) => {
    const i = roles.findIndex((r) => r.key === value);
    const next = roles[(i + d + roles.length) % roles.length];
    if (next) onChange(next.key);
  };
  return (
    <div data-slot="role-picker" role="radiogroup" aria-label="Role"
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); move(1); }
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
      }}
      className={cn("flex flex-col gap-2", className)}>
      {roles.map((r) => {
        const on = r.key === value;
        return (
          <label key={r.key}
            className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3",
              on ? "border-foreground bg-muted/50" : "border-border hover:bg-muted/40")}>
            <input
              type="radio"
              name={group}
              value={r.key}
              checked={on}
              tabIndex={on ? 0 : -1}
              onChange={() => onChange(r.key)}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2 text-sm font-medium">
                {r.label}
                {current === r.key ? (
                  <span className="text-xs font-normal text-muted-foreground">Current</span>
                ) : null}
              </span>
              {r.description ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">{r.description}</span>
              ) : null}
              {on && (r.warning || warnKeys.includes(r.key)) ? (
                <span className="mt-1.5 block text-xs font-medium">
                  {r.warning ?? "This removes your own access to these settings."}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
