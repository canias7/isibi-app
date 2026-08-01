import { cn } from "@/lib/utils";
/**
 * An identifying number, formatted so it can be read aloud and typed back.
 *
 * IT IS GROUPED IN FOURS AND SET IN A MONOSPACED FACE, because the actual job of
 * this field is somebody in a yard reading it down a telephone to somebody at a
 * keyboard. An unbroken 17-character string is misread every time, and the
 * grouping is what makes it survive the journey.
 *
 * A LEADING ALPHABETIC PREFIX IS KEPT WHOLE. Manufacturers use one, people say
 * it as a word, and splitting "HB" across a group boundary makes it unsayable.
 *
 * COPYING IS ONE ACTION AND COPIES THE UNGROUPED VALUE. The spaces are for
 * reading, not for the field it gets pasted into — pasting a prettified serial
 * into a warranty form is a failed lookup.
 *
 * IT IS NEVER TRUNCATED. Every list truncates this and every use of it needs all
 * of it: insurance, police reports, warranty claims and parts lookups.
 */
export function SerialRow({ label = "Serial", value, onCopy, note, className }: {
  label?: string;
  value: string;
  /** Receives the ungrouped value. */
  onCopy?: (raw: string) => void;
  note?: string;
  className?: string;
}) {
  const raw = value.replace(/[\s-]/g, "");
  // A serial that ALREADY has separators keeps them. The manufacturer's grouping
  // is what is stamped on the plate, and that is what the person reading it out
  // is looking at — regrouping "WP90-4417-2211" into fours produces "WP 9044
  // 1722 11", which matches nothing they can see.
  const preGrouped = /[\s-]/.test(value.trim());
  // Only an ungrouped string gets ours: the leading letters are said as a word
  // so they survive whole, and the rest goes in fours, which is what gets read
  // down a telephone without being misheard.
  const m = /^([A-Za-z]+)(.*)$/.exec(raw);
  const prefix = m ? m[1] : "";
  const rest = m ? m[2] : raw;
  const grouped = preGrouped
    ? value.trim().replace(/\s+/g, " ")
    : [prefix, ...(rest.match(/.{1,4}/g) ?? [])].filter(Boolean).join(" ");
  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="flex items-baseline gap-2 text-sm">
        <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
        <span className="min-w-0 flex-1 break-all font-mono tabular-nums">{grouped}</span>
        {onCopy && (
          <button
            type="button"
            onClick={() => onCopy(raw)}
            className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs font-medium hover:bg-accent"
          >
            Copy
          </button>
        )}
      </p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <p className="text-xs text-muted-foreground">
        {preGrouped
          ? "Grouped the way it is stamped on the machine. Copying gives you it unbroken."
          : "Spaces are for reading it out. Copying gives you it without them."}
      </p>
    </div>
  );
}
