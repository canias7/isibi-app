import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Choosing an area from the list a site actually serves.
 *
 * IT TAKES THE CALLER'S OWN REGIONS AND SHIPS NO LIST OF ITS OWN. A built-in
 * set of countries or states encodes one country's administrative divisions,
 * goes stale as borders and names change, and is wrong for the barber shop that
 * thinks in three neighbourhoods. Whatever the site serves is what it offers.
 *
 * GROUPING IS OPTIONAL AND USES REAL `<optgroup>`, which is what makes a long
 * list navigable — the browser's own picker on a phone renders the groups, and
 * a screen reader announces the group with the option.
 *
 * THE UNCHOSEN STATE IS A LABELLED OPTION, never a blank first entry. An empty
 * `<option>` reads as a rendering glitch and is indistinguishable from a value
 * that failed to load.
 *
 * A NATIVE `<select>` on purpose: on a phone this is the platform's own wheel,
 * which beats every custom listbox for a list of place names.
 */
export type Region = { id: string; name: string; group?: string; disabled?: boolean };

export function RegionPicker({ regions, value, onChange, label = "Area", placeholder = "Choose an area", id, className }: {
  regions: Region[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const selectId = id ?? "region";
  const groups = regions.some((r) => r.group);
  const names = groups ? Array.from(new Set(regions.map((r) => r.group ?? ""))) : [];
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={selectId} className="block text-sm font-medium">{label}</label>
      <NativeSelect id={selectId} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {groups
          ? names.map((g) => (
              <optgroup key={g || "other"} label={g || "Other"}>
                {regions.filter((r) => (r.group ?? "") === g).map((r) => (
                  <option key={r.id} value={r.id} disabled={r.disabled}>{r.name}</option>
                ))}
              </optgroup>
            ))
          : regions.map((r) => <option key={r.id} value={r.id} disabled={r.disabled}>{r.name}</option>)}
      </NativeSelect>
    </div>
  );
}
