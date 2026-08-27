import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
/** Keyboard shortcuts, as a real definition list. */
export function HotkeyList({ items, className }: {
  items: { keys: string[]; description: string }[]; className?: string;
}) {
  return (
    <dl data-slot="hotkey-list" className={cn("flex flex-col", className)}>
      {items.map((h, i) => (
        <div key={i} className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-0">
          <dt className="text-sm text-muted-foreground">{h.description}</dt>
          <dd><KbdGroup>{h.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</KbdGroup></dd>
        </div>
      ))}
    </dl>
  );
}
