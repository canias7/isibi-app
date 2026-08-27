import { cn } from "@/lib/utils";
/**
 * Tags sized by how much they are used, as a set of filter toggles.
 *
 * FOUR SIZE STEPS, NOT A CONTINUOUS SCALE. A true proportional cloud makes the
 * long tail unreadably small — which is exactly the half somebody is browsing a
 * cloud to discover. Buckets keep every tag legible while still ranking them.
 *
 * THE COUNT IS PRINTED, not encoded only in the size. Size gives the shape of
 * the collection at a glance and cannot answer "how many is that?", and it is
 * the thing that disappears completely for anybody who cannot see the layout.
 *
 * EACH TAG IS A `<button aria-pressed>`, so the cloud is a filter rather than
 * decoration and a keyboard can reach every one — the usual implementation is a
 * div of spans with onClick.
 *
 * ALPHABETICAL WITHIN THE CLOUD, deliberately. Sorting by count puts the same
 * five tags at the front forever and makes a specific one impossible to find;
 * the size already carries the ranking, so the order can do the other job.
 */
export type CloudTag = { id: string; label: string; count: number };

const STEPS = ["text-xs", "text-sm", "text-base", "text-lg"];

export function TagCloud({ tags, selected = [], onToggle, className }: {
  tags: CloudTag[];
  selected?: string[];
  onToggle: (id: string) => void;
  className?: string;
}) {
  if (!tags.length) return null;
  const max = Math.max(...tags.map((t) => t.count), 1);
  const sorted = [...tags].sort((a, b) => a.label.localeCompare(b.label));
  return (
    <ul data-slot="tag-cloud" className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1.5", className)}>
      {sorted.map((t) => {
        const step = Math.min(STEPS.length - 1, Math.floor((t.count / max) * STEPS.length));
        const on = selected.includes(t.id);
        return (
          <li key={t.id}>
            <button type="button" aria-pressed={on} onClick={() => onToggle(t.id)}
              className={cn("rounded-full border px-2.5 py-0.5",
                STEPS[step],
                on ? "border-foreground bg-foreground text-background" : "border-border")}>
              {t.label}
              <span className={cn("ms-1.5 text-xs tabular-nums", !on && "text-muted-foreground")}>{t.count}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
