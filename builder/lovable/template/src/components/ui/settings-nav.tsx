import { cn } from "@/lib/utils";
/**
 * The left rail of a settings page, grouped.
 *
 * `aria-current="page"` and not just a background: the active item has to be
 * announced, or a screen reader user tabbing this list has no idea which page
 * they are already on.
 */
export function SettingsNav({ groups, current, onSelect, className }: {
  groups: { label?: string; items: { key: string; label: string; href?: string }[] }[];
  current: string; onSelect?: (key: string) => void; className?: string;
}) {
  return (
    <nav className={cn("space-y-5", className)} aria-label="Settings">
      {groups.map((g, gi) => (
        <div key={g.label ?? gi} className="space-y-1">
          {g.label && <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.label}</p>}
          <ul>
            {g.items.map((it) => {
              const active = it.key === current;
              const cls = cn("block w-full cursor-pointer rounded px-2 py-1.5 text-left text-sm",
                active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground");
              return (
                <li key={it.key}>
                  {it.href
                    ? <a href={it.href} aria-current={active ? "page" : undefined} className={cls}>{it.label}</a>
                    : <button type="button" aria-current={active ? "page" : undefined}
                        onClick={() => onSelect?.(it.key)} className={cls}>{it.label}</button>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
