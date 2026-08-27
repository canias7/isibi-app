import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Which place's rules apply — chosen from the ones the business handles.
 *
 * THE LIST IS THE CALLER'S, and that is not laziness. A built-in list of
 * countries or states goes stale, encodes one country's subdivisions, and
 * offers places the business cannot legally serve — which is worse than
 * offering none, because somebody picks one and expects service.
 *
 * IT SAYS WHAT CHANGES with the choice. Jurisdiction affects tax, delivery,
 * consumer rights and what data can be held, and a picker that changes all of
 * that silently is one people set wrongly and never revisit.
 *
 * "NOT LISTED" IS AN EXPLICIT OPTION where the caller allows it, because the
 * alternative is somebody choosing the nearest wrong place to get through the
 * form — which produces confidently incorrect tax.
 *
 * A NATIVE `<select>` with real `<optgroup>`, so a long list of regions is
 * navigable on a phone and announced with its group.
 */
export type Jurisdiction = { id: string; label: string; group?: string; note?: string };

export function JurisdictionPicker({ jurisdictions, value, onChange, affects = [], notListedLabel, label = "Where does this apply?", id = "jurisdiction", className }: {
  jurisdictions: Jurisdiction[];
  value: string;
  onChange: (id: string) => void;
  /** What the choice changes — "tax", "your cancellation rights". */
  affects?: string[];
  /** Set to offer an explicit not-listed option. */
  notListedLabel?: string;
  label?: string;
  id?: string;
  className?: string;
}) {
  const groups = Array.from(new Set(jurisdictions.map((j) => j.group ?? "")));
  const chosen = jurisdictions.find((j) => j.id === value);
  return (
    <div data-slot="jurisdiction-picker" className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose one</option>
        {groups.length > 1 || groups[0]
          ? groups.map((g) => (
              <optgroup key={g || "other"} label={g || "Other"}>
                {jurisdictions.filter((j) => (j.group ?? "") === g).map((j) => (
                  <option key={j.id} value={j.id}>{j.label}</option>
                ))}
              </optgroup>
            ))
          : jurisdictions.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
        {notListedLabel && <option value="__other">{notListedLabel}</option>}
      </NativeSelect>
      {chosen?.note && <p className="text-xs text-muted-foreground">{chosen.note}</p>}
      {affects.length > 0 && (
        <p className="text-xs text-muted-foreground">
          This decides {affects.length === 1 ? affects[0] : `${affects.slice(0, -1).join(", ")} and ${affects[affects.length - 1]}`}.
        </p>
      )}
    </div>
  );
}
