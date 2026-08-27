import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Saved combinations of settings, one tap each.
 *
 * "MODIFIED" IS THE STATE THAT MATTERS. Somebody picks a preset, changes one
 * filter, and the menu still shows the preset as active — so they save over it
 * believing nothing changed, or lose their change believing it was saved. The
 * caller passes `dirty` and the label says "Modified" rather than pretending.
 *
 * SAVE AND SAVE-AS ARE SEPARATE, and save-as is what appears when nothing is
 * selected. Overwriting a shared preset because the only button said "Save" is
 * a change to everybody else's view made by accident.
 *
 * SHARED PRESETS ARE MARKED, because editing one affects colleagues and there
 * is otherwise nothing on screen that says so.
 *
 * A `<ul>` of buttons rather than a `<select>`: presets carry a shared flag and
 * a delete action, and neither fits inside an `<option>`.
 */
export type Preset = { id: string; name: string; shared?: boolean };

export function PresetMenu({ presets, activeId, dirty, onApply, onSave, onSaveAs, onDelete, className }: {
  presets: Preset[];
  activeId?: string;
  /** The current settings differ from the active preset. */
  dirty?: boolean;
  onApply: (id: string) => void;
  /** Overwrite the active preset. Absent means it cannot be overwritten. */
  onSave?: () => void;
  onSaveAs: () => void;
  onDelete?: (id: string) => void;
  className?: string;
}) {
  const active = presets.find((p) => p.id === activeId);
  return (
    <div data-slot="preset-menu" className={cn("min-w-56 rounded-md border border-border p-1", className)}>
      {active && (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          {active.name}
          {dirty && <span className="font-medium text-foreground"> · Modified</span>}
        </p>
      )}
      <ul>
        {presets.map((p) => (
          <li key={p.id} className="flex items-center">
            <button type="button" onClick={() => onApply(p.id)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-muted">
              <Check className={cn("size-3.5 shrink-0", p.id !== activeId && "invisible")} aria-hidden="true" />
              <span className="min-w-0 truncate">{p.name}</span>
              {p.shared && <span className="ms-auto shrink-0 text-xs text-muted-foreground">Shared</span>}
            </button>
            {onDelete && (
              <button type="button" onClick={() => onDelete(p.id)} aria-label={`Delete ${p.name}`}
                className="shrink-0 rounded px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-1 border-t border-border pt-1">
        {onSave && active && dirty && (
          <button type="button" onClick={onSave}
            className="w-full rounded px-2 py-1.5 text-start text-sm hover:bg-muted">
            Save to “{active.name}”
          </button>
        )}
        <button type="button" onClick={onSaveAs}
          className="w-full rounded px-2 py-1.5 text-start text-sm hover:bg-muted">
          Save as new preset
        </button>
      </div>
    </div>
  );
}
