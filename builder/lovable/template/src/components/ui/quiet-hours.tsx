import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
/**
 * Hours when nothing is allowed to buzz.
 *
 * IT SAYS WHAT STILL GETS THROUGH. Quiet hours that silence everything are
 * unusable for anybody on call, and quiet hours with an unstated exception are
 * worse — somebody assumes they will be woken for an emergency and they are not.
 * The exception is stated either way.
 *
 * OVERNIGHT RANGES ARE THE NORMAL CASE. 22:00 to 07:00 crosses midnight, and a
 * component that validates "end must be after start" refuses the setting almost
 * everybody wants. It is accepted and described as crossing midnight.
 *
 * Half-hour slots in a native select rather than a time input, for the same
 * reason `working-hours-input` uses them: it is one tap on a phone and removes
 * the whole class of "10pm" versus "22:00" parsing.
 */
const SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2), m = i % 2 ? "30" : "00";
  return `${String(h).padStart(2, "0")}:${m}`;
});

export function QuietHours({ enabled, from, to, onChange, exception, className }: {
  enabled: boolean;
  from: string; to: string;
  onChange: (next: { enabled?: boolean; from?: string; to?: string }) => void;
  /** What still comes through — "urgent alerts still arrive". */
  exception?: string;
  className?: string;
}) {
  const overnight = from > to;
  return (
    <div data-slot="quiet-hours" className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">Quiet hours</span>
        <Switch checked={enabled} onCheckedChange={(v) => onChange({ enabled: v })} aria-label="Quiet hours" />
      </div>
      <div className={cn("flex flex-wrap items-center gap-2", !enabled && "opacity-40")}>
        <NativeSelect value={from} disabled={!enabled} aria-label="Quiet from" className="h-8 w-24 text-sm"
          onChange={(e) => onChange({ from: e.target.value })}>
          {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </NativeSelect>
        <span className="text-sm text-muted-foreground">to</span>
        <NativeSelect value={to} disabled={!enabled} aria-label="Quiet until" className="h-8 w-24 text-sm"
          onChange={(e) => onChange({ to: e.target.value })}>
          {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </NativeSelect>
        {overnight && <span className="text-xs text-muted-foreground">crosses midnight</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        {exception ?? "Everything is held until quiet hours end."}
      </p>
    </div>
  );
}
