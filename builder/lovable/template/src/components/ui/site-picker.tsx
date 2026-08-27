import { useId } from "react";
import { cn } from "@/lib/utils";
/**
 * Choosing which branch you are looking at — with the scope made obvious.
 *
 * THE CURRENT SITE IS SHOWN OUTSIDE THE CONTROL AS WELL AS INSIDE IT. Somebody
 * reading a figure needs to know which branch it belongs to without opening a
 * dropdown, and every multi-site tool produces the same mistake: a manager acts
 * on another branch's numbers.
 *
 * "ALL SITES" IS A DELIBERATE CHOICE, NOT A DEFAULT. Aggregate figures hide the
 * one branch that is failing, and landing on them makes the group look fine
 * every morning.
 *
 * SITES SOMEBODY CANNOT ACT ON ARE SHOWN AS READ-ONLY rather than hidden. A
 * regional manager needs to see a branch they cannot change, and hiding it
 * makes the tool look broken.
 *
 * IT IS A REAL `<select>`. Branch lists get long, this is used constantly, and
 * a native control is faster with a keyboard than any custom one.
 */
export type Site = { id: string; name: string; readOnly?: boolean; closed?: boolean };

export function SitePicker({ sites, value, onChange, allowAll = true, allLabel = "All sites", label = "Site", className }: {
  sites: Site[];
  /** Empty string means all sites. */
  value?: string;
  onChange?: (next: string) => void;
  allowAll?: boolean;
  allLabel?: string;
  label?: string;
  className?: string;
}) {
  const id = useId();
  const chosen = sites.find((s) => s.id === value);
  const all = allowAll && !value;
  return (
    <div data-slot="site-picker" className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
      >
        {allowAll && <option value="">{allLabel}</option>}
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.closed ? " — closed" : s.readOnly ? " — view only" : ""}
          </option>
        ))}
      </select>
      <p className={cn("text-xs", all ? "font-medium" : "text-muted-foreground")}>
        {all
          ? `Showing ${allLabel.toLowerCase()} together. An average hides the branch that is struggling.`
          : `Everything below is ${chosen?.name ?? "this site"} only.`}
      </p>
      {chosen?.readOnly && (
        <p className="text-xs text-muted-foreground">You can see this site but not change anything in it.</p>
      )}
    </div>
  );
}
