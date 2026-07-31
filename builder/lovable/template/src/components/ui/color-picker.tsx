import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
/**
 * Pick a colour: a swatch grid, plus the native picker, plus a hex box.
 *
 * All three, because each fails on its own. The grid is fast but limited; the
 * native `<input type="color">` is precise but has no keyboard story and
 * looks different on every platform; the hex box is the only one somebody can
 * paste a brand colour into.
 *
 * The hex is normalised on BLUR, never on keystroke — validating as you type
 * means the field fights you after the first character.
 */
const SWATCHES = [
  "#000000", "#3f3f46", "#71717a", "#a1a1aa", "#d4d4d8", "#ffffff",
  "#dc2626", "#ea580c", "#d97706", "#65a30d", "#059669", "#0891b2",
  "#2563eb", "#4f46e5", "#7c3aed", "#c026d3", "#db2777", "#e11d48",
];
export function ColorPicker({ value, onChange, swatches = SWATCHES, id = "color", className }: {
  value: string; onChange: (hex: string) => void; swatches?: string[]; id?: string; className?: string;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const normalise = (s: string) => {
    const t = s.trim().replace(/^#?/, "");
    const full = t.length === 3 ? t.split("").map((c) => c + c).join("") : t;
    return /^[0-9a-f]{6}$/i.test(full) ? "#" + full.toLowerCase() : null;
  };
  return (
    <div className={cn("w-56 space-y-3", className)}>
      <div className="grid grid-cols-6 gap-1.5">
        {swatches.map((s) => (
          <button key={s} type="button" onClick={() => onChange(s)} aria-label={s}
            aria-pressed={s.toLowerCase() === value.toLowerCase()}
            className={cn("size-7 cursor-pointer rounded border",
              s.toLowerCase() === value.toLowerCase() ? "border-foreground ring-2 ring-ring/40" : "border-border")}
            style={{ background: s }} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input id={`${id}-native`} type="color" value={value} aria-label="Pick a colour"
          className="size-8 shrink-0 cursor-pointer rounded border border-border bg-transparent"
          onChange={(e) => onChange(e.target.value)} />
        <Input id={id} value={draft ?? value} aria-label="Hex colour" className="h-8 font-mono text-xs uppercase"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { const n = draft != null ? normalise(draft) : null; if (n) onChange(n); setDraft(null); }} />
      </div>
    </div>
  );
}
