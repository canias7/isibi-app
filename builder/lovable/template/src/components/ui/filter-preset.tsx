import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Save the current filters under a name; apply them back in one press.
 *
 * A PRESET STORES THE FILTER OBJECT, and the chip says how much it holds
 * ("Weekend rush · 3 filters") — a bare name gives no sense of what
 * applying it will do to the view, and "why did my data vanish" is the
 * filter-bar lesson this inherits.
 *
 * SAVING ASKS FOR THE NAME INLINE, right where the button was — a prompt
 * dialog for six characters is ceremony. Empty names refuse quietly (the
 * Save stays disabled); duplicate names OVERWRITE, stated on the button,
 * because "Weekend rush (2)" forever is worse than updating the preset
 * you clearly meant.
 *
 * Deleting is per-chip and immediate — a preset is a shortcut, not data;
 * the fear that needs a confirm is not here.
 */
export function FilterPreset<T>({ storageKey, current, countOf, onApply, className }: {
  storageKey: string;
  current: T;
  countOf: (filters: T) => number;
  onApply: (filters: T) => void;
  className?: string;
}) {
  const [presets, setPresets] = React.useState<{ name: string; filters: T }[]>([]);
  const [naming, setNaming] = React.useState(false);
  const [name, setName] = React.useState("");

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setPresets(JSON.parse(raw));
    } catch { /* private mode or corrupt */ }
  }, [storageKey]);

  const persist = (next: { name: string; filters: T }[]) => {
    setPresets(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* best effort */ }
  };

  const exists = presets.some((p) => p.name === name.trim());
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {presets.map((p) => (
        <span key={p.name} className="inline-flex items-center overflow-hidden rounded-full border border-border text-xs">
          <button type="button" onClick={() => onApply(p.filters)}
            className="cursor-pointer py-1 ps-2.5 pe-1.5 hover:bg-muted">
            {p.name} <span className="text-muted-foreground">· {countOf(p.filters)} filter{countOf(p.filters) === 1 ? "" : "s"}</span>
          </button>
          <button type="button" aria-label={`Delete the ${p.name} preset`}
            onClick={() => persist(presets.filter((x) => x.name !== p.name))}
            className="cursor-pointer py-1 ps-0.5 pe-2 text-muted-foreground hover:text-foreground">
            ×
          </button>
        </span>
      ))}
      {naming ? (
        <span className="flex items-center gap-1.5">
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === "Escape") { setNaming(false); setName(""); } }}
            placeholder="Preset name"
            className="h-7 w-32 rounded-md border border-input bg-background px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <button type="button" disabled={!name.trim()}
            onClick={() => {
              persist([...presets.filter((p) => p.name !== name.trim()), { name: name.trim(), filters: current }]);
              setNaming(false); setName("");
            }}
            className="cursor-pointer rounded-md border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40">
            {exists ? "Overwrite" : "Save"}
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setNaming(true)}
          className="cursor-pointer rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground/50">
          Save these filters ({countOf(current)})
        </button>
      )}
    </div>
  );
}
