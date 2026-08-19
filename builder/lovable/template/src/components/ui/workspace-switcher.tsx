import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
/**
 * Switching between organisations, shops or projects.
 *
 * THE CURRENT ONE IS ALWAYS VISIBLE ON THE TRIGGER, name and all. This control
 * answers "whose data am I looking at" — which is the question behind every
 * expensive mistake in a multi-tenant tool — and a trigger showing only an icon
 * or an avatar answers it for nobody.
 *
 * Switching is announced and, in a real app, should reload the view. That is
 * the caller's job, but the note is here because a switcher that changes a
 * label and leaves the page showing the previous tenant's rows is the worst
 * possible outcome.
 *
 * Workspaces are GROUPED by kind when there are groups, because "my shops" and
 * "shops I have been invited to" are different relationships and a flat list
 * hides which is which.
 *
 * "Create" is separated by a rule at the bottom — it is not a workspace, and
 * mixing it into the list is how somebody creates one while trying to switch.
 */
export function WorkspaceSwitcher({ workspaces, value, onChange, onCreate, groups, className }: {
  workspaces: { key: string; name: string; hint?: React.ReactNode; group?: string }[];
  value: string;
  onChange: (key: string) => void;
  onCreate?: () => void;
  groups?: string[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const current = workspaces.find((w) => w.key === value);
  const order = groups ?? Array.from(new Set(workspaces.map((w) => w.group ?? "")));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button"
          aria-label={`Workspace: ${current?.name ?? "choose one"}`}
          className={cn("flex w-full cursor-pointer items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm hover:bg-muted", className)}>
          <span className="grid size-5 shrink-0 place-items-center rounded bg-foreground text-[10px] font-semibold text-background">
            {(current?.name ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-start font-medium">{current?.name ?? "Choose a workspace"}</span>
          <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        {order.map((g) => {
          const rows = workspaces.filter((w) => (w.group ?? "") === g);
          if (rows.length === 0) return null;
          return (
            <div key={g || "_"}>
              {g ? <p className="px-2 pt-1.5 pb-1 text-[11px] font-medium text-muted-foreground">{g}</p> : null}
              <ul>
                {rows.map((w) => (
                  <li key={w.key}>
                    <button type="button" onClick={() => { onChange(w.key); setOpen(false); }}
                      aria-current={w.key === value ? "true" : undefined}
                      className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-muted">
                      <Check aria-hidden className={cn("size-3.5 shrink-0", w.key === value ? "" : "invisible")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{w.name}</span>
                        {w.hint ? <span className="block truncate text-xs text-muted-foreground">{w.hint}</span> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {onCreate ? (
          <>
            <hr className="my-1 border-border" />
            <button type="button" onClick={() => { setOpen(false); onCreate(); }}
              className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-muted">
              <Plus aria-hidden className="size-3.5 shrink-0" />
              Create a workspace
            </button>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
