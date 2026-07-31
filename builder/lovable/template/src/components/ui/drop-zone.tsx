import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A file drop area whose highlight does not flicker — and whose real
 * accessible path is the browse button.
 *
 * DRAGENTER/DRAGLEAVE ARE COUNTED. Leave fires every time the drag crosses
 * a CHILD boundary, so the naive on-enter/off-leave highlight strobes as
 * the file moves across the zone's own text. A counter (+1 enter, -1
 * leave, highlight while > 0) is the entire fix, and every hand-rolled
 * zone rediscovers it.
 *
 * CLICK-TO-BROWSE IS THE PRIMARY PATH, not the fallback — drag does not
 * exist for keyboards, screen readers or most phones (the drag-list rule
 * again). The whole zone is a labelled button wrapping a real
 * `<input type=file>`, so it is focusable and announces itself.
 *
 * THE TYPE FILTER RUNS ON THE DROP TOO. `accept` only filters the browse
 * dialog; a drop delivers whatever was dragged, so files are checked
 * against `accept` on the way in and the refused ones are REPORTED, not
 * silently dropped — three photos and a .exe should say "3 added, 1
 * refused", never "3 added".
 */
export function DropZone({ accept, multiple = true, onFiles, label = "Drop files here, or browse", className }: {
  /** Comma-separated like an input's accept: ".png,image/*" */
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[], refused: File[]) => void;
  label?: React.ReactNode;
  className?: string;
}) {
  const [depth, setDepth] = React.useState(0);
  const input = React.useRef<HTMLInputElement>(null);

  const matches = (f: File) => {
    if (!accept) return true;
    return accept.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).some((rule) => {
      if (rule.startsWith(".")) return f.name.toLowerCase().endsWith(rule);
      if (rule.endsWith("/*")) return f.type.toLowerCase().startsWith(rule.slice(0, -1));
      return f.type.toLowerCase() === rule;
    });
  };
  const take = (list: FileList | null) => {
    const all = [...(list ?? [])];
    const files = all.filter(matches);
    onFiles(multiple ? files : files.slice(0, 1), all.filter((f) => !matches(f)));
  };

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragEnter={(e) => { e.preventDefault(); setDepth((d) => d + 1); }}
      onDragLeave={() => setDepth((d) => Math.max(0, d - 1))}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); setDepth(0); take(e.dataTransfer.files); }}
      className={cn(
        "flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-6 text-sm",
        depth > 0 ? "border-foreground bg-muted" : "border-border text-muted-foreground hover:border-foreground/50",
        className,
      )}
    >
      {label}
      {accept ? <span className="text-[11px] text-muted-foreground">{accept}</span> : null}
      <input ref={input} type="file" accept={accept} multiple={multiple} className="sr-only" tabIndex={-1}
        onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
    </button>
  );
}
