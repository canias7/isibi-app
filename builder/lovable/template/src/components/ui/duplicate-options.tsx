import { useState , useId } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
/**
 * "Duplicate" with a say in what comes along.
 *
 * A PLAIN COPY BUTTON IS EITHER TOO MUCH OR TOO LITTLE and there is no way to
 * know which. Duplicating a booking should not duplicate the customer's
 * payment; duplicating a project should probably keep its task list. Since the
 * right answer depends on the thing, the component asks, with the caller's own
 * defaults already ticked.
 *
 * THE NAME IS PRE-FILLED WITH A COPY SUFFIX AND SELECTABLE. Two records with
 * identical names is the standard result of duplicating, and it makes both
 * unfindable — but forcing somebody to invent a name every time is friction on
 * the common case, so it is filled in and editable.
 *
 * PARTS THAT CANNOT BE COPIED ARE SHOWN, DISABLED, WITH THE REASON. Hiding them
 * makes somebody duplicate a thing, look for the missing half, and conclude the
 * copy failed.
 *
 * Not a dialog — the caller places it wherever it belongs, so it works in a
 * popover, a sheet or inline on a phone.
 */
export type DuplicatePart = { key: string; label: string; detail?: string; disabled?: boolean; reason?: string };

export function DuplicateOptions({ originalName, parts, defaultParts, onDuplicate, onCancel, busy, suffix = "(copy)", className }: {
  originalName: string;
  parts: DuplicatePart[];
  /** Keys ticked to begin with. Defaults to every enabled part. */
  defaultParts?: string[];
  onDuplicate: (v: { name: string; parts: string[] }) => void;
  onCancel?: () => void;
  busy?: boolean;
  suffix?: string;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = useId();
  const [name, setName] = useState(`${originalName} ${suffix}`);
  const [picked, setPicked] = useState<string[]>(
    defaultParts ?? parts.filter((p) => !p.disabled).map((p) => p.key),
  );
  const ready = name.trim().length > 0;
  return (
    <form data-slot="duplicate-options" className={cn("space-y-3", className)}
      onSubmit={(e) => { e.preventDefault(); if (ready) onDuplicate({ name: name.trim(), parts: picked }); }}>
      <div className="space-y-1">
        <label htmlFor={uid + "-dup-name"} className="block text-sm font-medium">Name of the copy</label>
        <input id={uid + "-dup-name"} required value={name} onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Copy as well</legend>
        {parts.map((p) => (
          <label key={p.key}
            className={cn("flex items-start gap-2 text-sm", p.disabled && "opacity-60")}>
            <Checkbox className="mt-0.5" disabled={p.disabled} checked={picked.includes(p.key)}
              onCheckedChange={(v) => setPicked((k) => v === true ? [...k, p.key] : k.filter((x) => x !== p.key))} />
            <span className="min-w-0">
              {p.label}
              {(p.detail || p.reason) && (
                <span className="block text-xs text-muted-foreground">
                  {p.disabled ? (p.reason ?? "Cannot be copied") : p.detail}
                </span>
              )}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" disabled={!ready || busy}>Duplicate</Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>}
      </div>
    </form>
  );
}
