import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Mute for a while, rather than for ever.
 *
 * A TIMED MUTE IS THE ONE PEOPLE ACTUALLY WANT and almost nothing offers. The
 * usual choice is permanent-or-nothing, so somebody mutes a noisy thread
 * indefinitely and never hears about it again — including the part that mattered.
 *
 * THE RETURN TIME IS SHOWN AS A TIME. Same reasoning as `snooze-picker`: "back
 * on Friday at 09:00" is checkable, "3 days" is arithmetic.
 *
 * "FOR EVER" IS STILL OFFERED, and named plainly rather than dressed up as
 * "indefinitely" — it is a legitimate choice and hiding it just makes people
 * pick the longest option repeatedly.
 */
export function MuteDuration({ options, current, onMute, onUnmute, id, className }: {
  /** Each with the resulting time worked out; use an empty `until` for forever. */
  options: { key: string; label: string; until?: string }[];
  /** When the current mute lifts, if muted. */
  current?: string | null;
  onMute: (key: string) => void;
  onUnmute?: () => void;
  id?: string;
  className?: string;
}) {
  if (current !== undefined && current !== null) {
    return (
      <p data-slot="mute-duration" className={cn("flex flex-wrap items-baseline gap-x-2 text-sm", className)}>
        <span className="text-muted-foreground">Muted until {current}</span>
        {onUnmute && (
          <button type="button" onClick={onUnmute} className="cursor-pointer underline underline-offset-4">Unmute</button>
        )}
      </p>
    );
  }
  if (!options.length) return null;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <label htmlFor={id} className="text-sm text-muted-foreground">Mute for</label>
      <NativeSelect id={id} value="" className="h-8 w-auto text-sm"
        onChange={(e) => e.target.value && onMute(e.target.value)}>
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}{o.until ? ` — until ${o.until}` : ""}</option>
        ))}
      </NativeSelect>
    </span>
  );
}
