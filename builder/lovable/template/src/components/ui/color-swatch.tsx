import { cn } from "@/lib/utils";
/**
 * A colour, with its value written next to it.
 *
 * The value is not optional and the swatch carries a border regardless of the
 * colour: white on white is invisible, and a palette identified only by the
 * squares is unusable to anyone who cannot see the difference between two of
 * them.
 */
export function ColorSwatch({ color, name, selected, onSelect, className }: {
  color: string; name?: string; selected?: boolean; onSelect?: () => void; className?: string;
}) {
  const body = (
    <>
      <span className="size-8 shrink-0 rounded border border-border" style={{ background: color }} aria-hidden="true" />
      <span className="min-w-0">
        {name && <span className="block truncate text-sm">{name}</span>}
        <span className="block font-mono text-xs uppercase text-muted-foreground">{color}</span>
      </span>
    </>
  );
  const cls = cn("flex items-center gap-2 rounded-md border p-1.5",
    selected ? "border-foreground" : "border-transparent", className);
  return onSelect
    ? <button type="button" onClick={onSelect} aria-pressed={selected}
        className={cn(cls, "cursor-pointer hover:border-border")}>{body}</button>
    : <span className={cls}>{body}</span>;
}
