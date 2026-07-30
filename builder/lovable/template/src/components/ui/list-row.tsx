import { cn } from "@/lib/utils";
/**
 * One row of a list: something on the left, detail in the middle, action right.
 *
 * When `onClick` is given the whole row becomes a button, so the hit target is
 * the row rather than the four words inside it.
 */
export function ListRow({ leading, title, description, trailing, onClick, className }: {
  leading?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode;
  trailing?: React.ReactNode; onClick?: () => void; className?: string;
}) {
  const inner = (
    <>
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium">{title}</span>
        {description && <span className="block truncate text-sm text-muted-foreground">{description}</span>}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </>
  );
  const base = "flex w-full items-center gap-3 border-b border-border py-3 last:border-0";
  return onClick
    ? <button type="button" onClick={onClick} className={cn(base, "cursor-pointer hover:bg-muted/50", className)}>{inner}</button>
    : <div className={cn(base, className)}>{inner}</div>;
}
