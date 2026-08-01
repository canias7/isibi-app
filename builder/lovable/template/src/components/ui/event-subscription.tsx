import { cn } from "@/lib/utils";
/**
 * Which events an endpoint receives, grouped by what they are about.
 *
 * GROUPED BY SUBJECT, WITH A GROUP TOGGLE. A flat list of forty dotted names is
 * how people end up subscribed to everything — selecting them individually is
 * tedious, so they take the lot and then complain about volume. Grouping makes
 * "all booking events" one click and one honest decision.
 *
 * EACH EVENT SAYS WHEN IT FIRES, in plain words. `booking.updated` does not say
 * that it includes a customer editing their own phone number — which is the
 * difference between a quiet endpoint and one receiving thousands of events a
 * day.
 *
 * HIGH-VOLUME EVENTS ARE MARKED. That is the fact somebody needs before
 * subscribing, not after their endpoint falls over, and it is knowable from our
 * own traffic.
 *
 * REAL CHECKBOXES WITH A `<legend>` PER GROUP, and the group checkbox uses
 * `indeterminate` so partial selection is visible rather than reading as off.
 */
export type EventGroup = {
  id: string;
  label: string;
  events: { id: string; name: string; fires: string; highVolume?: boolean }[];
};

export function EventSubscription({ groups, selected, onChange, className }: {
  groups: EventGroup[];
  selected: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  const toggle = (id: string, on: boolean) =>
    onChange(on ? Array.from(new Set([...selected, id])) : selected.filter((x) => x !== id));
  return (
    <div className={cn("space-y-3", className)}>
      {groups.map((g) => {
        const ids = g.events.map((e) => e.id);
        const on = ids.filter((i) => selected.includes(i));
        const all = on.length === ids.length && ids.length > 0;
        const some = on.length > 0 && !all;
        return (
          <fieldset key={g.id} className="space-y-1">
            <legend className="sr-only">{g.label}</legend>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={all} className="size-4 accent-foreground"
                ref={(el) => { if (el) el.indeterminate = some; }}
                onChange={(e) => onChange(e.target.checked
                  ? Array.from(new Set([...selected, ...ids]))
                  : selected.filter((x) => !ids.includes(x)))} />
              {g.label}
              <span className="font-normal text-muted-foreground">{on.length} of {ids.length}</span>
            </label>
            <div className="space-y-0.5 pl-6">
              {g.events.map((e) => (
                <label key={e.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={selected.includes(e.id)} className="mt-0.5 size-4 accent-foreground"
                    onChange={(ev) => toggle(e.id, ev.target.checked)} />
                  <span className="min-w-0">
                    <code className="font-mono text-xs">{e.name}</code>
                    {e.highVolume && <span className="ml-1.5 text-xs font-medium">busy</span>}
                    <span className="block text-xs text-muted-foreground">{e.fires}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
