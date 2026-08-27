import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/**
 * Country then region then city — each level narrowed by the one before.
 *
 * CHANGING A LEVEL CLEARS EVERYTHING BELOW IT. Leaving them is how a form
 * ends up submitting a city that is not in the selected country, and it looks
 * fine on screen because the stale label is still showing.
 *
 * Levels below an unanswered one are disabled rather than hidden, so the
 * shape of what is being asked is visible from the start and the form does
 * not grow as it is filled in.
 */
export function CascadingSelect({ levels, value, onChange, id = "cascade", className }: {
  levels: { key: string; label: string; options: (above: string[]) => { value: string; label: string }[] }[];
  value: string[]; onChange: (v: string[]) => void; id?: string; className?: string;
}) {
  return (
    <div data-slot="cascading-select" className={cn("space-y-3", className)}>
      {levels.map((lv, i) => {
        const above = value.slice(0, i);
        const ready = i === 0 || !!value[i - 1];
        const opts = ready ? lv.options(above) : [];
        return (
          <div key={lv.key} className="space-y-1.5">
            <Label htmlFor={`${id}-${lv.key}`} className="text-sm">{lv.label}</Label>
            <NativeSelect id={`${id}-${lv.key}`} disabled={!ready} value={value[i] ?? ""}
              onChange={(e) => onChange([...value.slice(0, i), e.target.value])}>
              <option value="">{ready ? `Choose a ${lv.label.toLowerCase()}` : `Pick a ${levels[i - 1].label.toLowerCase()} first`}</option>
              {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </NativeSelect>
          </div>
        );
      })}
    </div>
  );
}
