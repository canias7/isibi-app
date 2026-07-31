import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The "?" sheet listing every keyboard shortcut.
 *
 * The trigger key is IGNORED WHILE TYPING. Binding "?" globally means pressing
 * it in any text field opens the sheet instead of typing a question mark — the
 * single most common bug in this feature, and it makes every form on the page
 * subtly broken. The guard checks for an input, a textarea, a select and
 * `isContentEditable`.
 *
 * Keys are rendered with the PLATFORM's modifiers, so a Mac shows ⌘ and ⌥ and
 * everything else shows Ctrl and Alt. A list of shortcuts naming the wrong keys
 * is worse than none.
 *
 * `<kbd>` elements, which is what they are, with the combination read as words
 * for a screen reader — "Command K" rather than the glyph, which most screen
 * readers pronounce as "place of interest sign" or skip entirely.
 *
 * Grouped by area, because a flat list of thirty shortcuts is a list nobody
 * reads twice.
 */
export function useShortcutSheet(onOpen: () => void, key = "?") {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== key || e.metaKey || e.ctrlKey || e.altKey) return;
      // Never steal a keystroke from a field somebody is typing in.
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      onOpen();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onOpen, key]);
}

const MAC_GLYPH: Record<string, string> = { mod: "⌘", alt: "⌥", shift: "⇧", enter: "↵", esc: "esc" };
const PC_GLYPH: Record<string, string> = { mod: "Ctrl", alt: "Alt", shift: "Shift", enter: "Enter", esc: "Esc" };
const SPOKEN: Record<string, string> = { mod: "Command or Control", alt: "Alt", shift: "Shift", enter: "Enter", esc: "Escape" };

export function isMac() {
  return typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
}

export function ShortcutKeys({ keys, className }: { keys: string[]; className?: string }) {
  const map = isMac() ? MAC_GLYPH : PC_GLYPH;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span aria-hidden className="inline-flex items-center gap-1">
        {keys.map((k) => (
          <kbd key={k} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {map[k] ?? k.toUpperCase()}
          </kbd>
        ))}
      </span>
      <span className="sr-only">{keys.map((k) => SPOKEN[k] ?? k).join(" plus ")}</span>
    </span>
  );
}

export function ShortcutOverlay({ open, onClose, groups, className }: {
  open: boolean;
  onClose: () => void;
  groups: { key: string; title: React.ReactNode; shortcuts: { keys: string[]; label: React.ReactNode }[] }[];
  className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" onClick={onClose} aria-label="Close"
        className="absolute inset-0 cursor-default bg-foreground/50" />
      <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"
        className={cn("relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl", className)}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <div className="grid gap-4 overflow-y-auto p-4 sm:grid-cols-2">
          {groups.map((g) => (
            <section key={g.key}>
              <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{g.title}</h3>
              <ul className="flex flex-col gap-1">
                {g.shortcuts.map((s, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">{s.label}</span>
                    <ShortcutKeys keys={s.keys} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
