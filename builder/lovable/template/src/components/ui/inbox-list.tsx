import { cn } from "@/lib/utils";
export type InboxItem = { id: string; title: string; preview?: string; at?: string; unread?: boolean };
/**
 * A list of messages or submissions.
 *
 * Unread is carried by WEIGHT and a dot, not by colour, so it still reads when
 * the row is selected and the background changes underneath it.
 */
export function InboxList({ items, selected, onSelect, empty = "Nothing here", className }: {
  items: InboxItem[]; selected?: string | null; onSelect?: (id: string) => void;
  empty?: string; className?: string;
}) {
  if (items.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className={cn("flex flex-col", className)}>
      {items.map((m) => (
        <li key={m.id}>
          <button type="button" onClick={() => onSelect?.(m.id)}
            aria-current={selected === m.id ? "true" : undefined}
            className={cn("flex w-full cursor-pointer items-start gap-2.5 border-b border-border px-3 py-3 text-start last:border-0 hover:bg-muted/50",
              selected === m.id && "bg-muted")}>
            <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", m.unread ? "bg-foreground" : "bg-transparent")}
              aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={cn("truncate text-sm", m.unread && "font-semibold")}>{m.title}</span>
                {m.at && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{m.at}</span>}
              </span>
              {m.preview && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{m.preview}</span>}
            </span>
            {m.unread && <span className="sr-only">Unread</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
