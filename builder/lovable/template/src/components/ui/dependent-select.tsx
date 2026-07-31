import * as React from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/**
 * A second choice whose options depend on the first, and which CLEARS ITSELF
 * when that first choice changes to something that no longer offers it.
 *
 * Different from `cascading-select`, which is a fixed chain of levels: this
 * is the two-field case, and the clearing is the whole component. A service
 * picked under "Cuts" that stays selected after switching to "Colour" is a
 * booking for something that is not on the menu — and it submits happily.
 *
 * It only clears when the value is genuinely no longer valid, so re-picking
 * the same parent does not wipe a choice that is still fine.
 */
export function DependentSelect({ parentLabel, childLabel, parentOptions, childOptions,
  parent, child, onChange, id = "dep", className }: {
  parentLabel: string; childLabel: string;
  parentOptions: { value: string; label: string }[];
  childOptions: (parent: string) => { value: string; label: string }[];
  parent: string; child: string;
  onChange: (v: { parent: string; child: string }) => void;
  id?: string; className?: string;
}) {
  const options = parent ? childOptions(parent) : [];
  React.useEffect(() => {
    if (child && !options.some((o) => o.value === child)) onChange({ parent, child: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent]);
  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-p`} className="text-sm">{parentLabel}</Label>
        <NativeSelect id={`${id}-p`} value={parent} onChange={(e) => onChange({ parent: e.target.value, child })}>
          <option value="">Choose</option>
          {parentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-c`} className="text-sm">{childLabel}</Label>
        <NativeSelect id={`${id}-c`} value={child} disabled={!parent}
          onChange={(e) => onChange({ parent, child: e.target.value })}>
          <option value="">{parent ? "Choose" : `Pick a ${parentLabel.toLowerCase()} first`}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </NativeSelect>
      </div>
    </div>
  );
}
