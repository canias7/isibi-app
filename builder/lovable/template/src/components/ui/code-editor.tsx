import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A code box with line numbers and a sane Tab key.
 *
 * NO SYNTAX HIGHLIGHTING, deliberately. Doing it properly means shiki or
 * prism — roughly a megabyte for something a business site uses once — and
 * doing it improperly means a regex highlighter that mis-colours any string
 * containing a keyword. `code-block` made the same call for display; this is
 * the editable half.
 *
 * TAB INSERTS SPACES rather than leaving the field, which is what anybody
 * typing code expects. Shift+Tab still escapes, so the box is not a keyboard
 * trap — a plain "capture Tab" is an accessibility failure that makes the
 * rest of the form unreachable.
 *
 * The gutter scrolls WITH the textarea, or the numbers drift out of step with
 * the lines as soon as the content is taller than the box.
 */
export function CodeEditor({ value, onChange, rows = 12, tabSize = 2, placeholder, className }: {
  value: string; onChange: (v: string) => void; rows?: number; tabSize?: number;
  placeholder?: string; className?: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const gutter = React.useRef<HTMLDivElement>(null);
  const lines = value.split("\n").length;
  return (
    <div className={cn("flex overflow-hidden rounded-md border border-input font-mono text-xs", className)}>
      <div ref={gutter} aria-hidden="true"
        className="select-none overflow-hidden bg-muted/50 py-2 text-end text-muted-foreground">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="px-2 leading-5 tabular-nums">{i + 1}</div>
        ))}
      </div>
      <textarea ref={ref} value={value} rows={rows} placeholder={placeholder} spellCheck={false}
        className="flex-1 resize-none bg-transparent px-3 py-2 leading-5 outline-none"
        onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; }}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Tab" || e.shiftKey) return;      // Shift+Tab still leaves the field
          e.preventDefault();
          const el = e.currentTarget;
          const start = el.selectionStart, end = el.selectionEnd;
          const pad = " ".repeat(tabSize);
          onChange(value.slice(0, start) + pad + value.slice(end));
          requestAnimationFrame(() => el.setSelectionRange(start + tabSize, start + tabSize));
        }} />
    </div>
  );
}
