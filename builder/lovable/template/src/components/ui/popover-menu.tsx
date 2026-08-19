import * as React from "react";
import { Check, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, labelText } from "@/lib/utils";
/**
 * A menu of actions, from a declarative list.
 *
 * A DESTRUCTIVE item is separated by a rule and sits last, always. The
 * expensive mis-click in any menu is Delete directly under Duplicate, and
 * ordering is the fix that costs nothing — a confirmation dialog is what gets
 * added afterwards, and it is a worse fix because people click through it.
 *
 * The item list is DATA, not children. That is what lets the destructive rule
 * be enforced here rather than remembered at every call site, and it is the
 * difference between a component and a wrapper.
 *
 * A disabled item states WHY on hover and in its accessible name. A greyed
 * "Delete" with no reason is the most common dead end in an app — the answer is
 * usually one short clause.
 *
 * Type-ahead is left to the platform. This is built on the kit's Popover rather
 * than a menu primitive, so it is a list of buttons: fine for five actions,
 * which is what a row menu is. For a long searchable list use `command`.
 */
export type MenuItem = {
  key: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  reason?: string;
  checked?: boolean;
  destructive?: boolean;
  submenu?: boolean;
};

export function PopoverMenu({ trigger, items, align = "end", className }: {
  trigger: React.ReactNode;
  items: MenuItem[];
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  // Destructive last, in order, so Delete is never under Duplicate.
  const safe = items.filter((i) => !i.destructive);
  const risky = items.filter((i) => i.destructive);

  const row = (i: MenuItem) => (
    <li key={i.key}>
      <button
        type="button"
        disabled={i.disabled}
        title={i.disabled ? i.reason : undefined}
        aria-label={i.disabled && i.reason && typeof i.label === "string" ? `${labelText(i.label)} — ${i.reason}` : undefined}
        onClick={() => { if (!i.submenu) setOpen(false); i.onSelect?.(); }}
        className={cn("flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-muted",
          i.disabled && "cursor-default text-muted-foreground hover:bg-transparent",
          i.destructive && !i.disabled && "font-medium")}
      >
        {i.checked != null ? (
          <Check aria-hidden className={cn("size-3.5 shrink-0", i.checked ? "" : "invisible")} />
        ) : i.icon ? (
          <span className="shrink-0 text-muted-foreground">{i.icon}</span>
        ) : null}
        <span className="min-w-0 flex-1">
          {i.label}
          {i.disabled && i.reason ? (
            <span className="block text-xs text-muted-foreground">{i.reason}</span>
          ) : i.hint ? (
            <span className="block text-xs text-muted-foreground">{i.hint}</span>
          ) : null}
        </span>
        {i.submenu ? <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" /> : null}
      </button>
    </li>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className={cn("w-56 p-1", className)}>
        <ul>{safe.map(row)}</ul>
        {risky.length ? (
          <>
            <hr className="my-1 border-border" />
            <ul>{risky.map(row)}</ul>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
