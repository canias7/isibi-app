import { cn } from "@/lib/utils";
/**
 * The separated parts of a mix — with the facts a mix engineer needs.
 *
 * SAMPLE RATE AND BIT DEPTH ARE PER FILE AND ARE CHECKED FOR CONSISTENCY. A
 * folder mixing 44.1 and 48 kHz stems plays back at the wrong speed and pitch
 * for whichever half is wrong, and it is discovered after an hour of wondering
 * why the vocal sounds odd.
 *
 * WHETHER STEMS START AT THE SAME ZERO IS THE OTHER HALF. Stems trimmed to
 * their first note rather than to the session start are unusable without
 * manual alignment, and "from bar 1" is the single most important note in the
 * folder.
 *
 * WET AND DRY ARE DIFFERENT DELIVERABLES. A stem printed with reverb cannot be
 * re-mixed, and a mix engineer receiving only wet stems has been sent a
 * decision rather than a part.
 *
 * IT DOES NOT PLAY AUDIO. An inline player on a list of forty stems is a
 * download of several gigabytes nobody asked for.
 */
export type Stem = {
  id: string;
  name: string;
  sampleRateHz?: number;
  bitDepth?: number;
  /** True where effects are printed in. */
  wet?: boolean;
  /** False where it has been trimmed. */
  fromSessionStart?: boolean;
  sizeMb?: number;
};

export function StemList({ stems, className }: { stems: Stem[]; className?: string }) {
  const rates = [...new Set(stems.map((s) => s.sampleRateHz).filter(Boolean))];
  const depths = [...new Set(stems.map((s) => s.bitDepth).filter(Boolean))];
  const trimmed = stems.filter((s) => s.fromSessionStart === false);
  return (
    <div data-slot="stem-list" className={cn("space-y-1.5", className)}>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {stems.map((s) => (
          <li key={s.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1">
              {s.name}
              {s.wet && <span className="text-xs text-muted-foreground"> · effects printed in</span>}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {s.sampleRateHz ? `${s.sampleRateHz / 1000} kHz` : ""}
              {s.bitDepth ? ` · ${s.bitDepth}-bit` : ""}
              {s.sizeMb !== undefined ? ` · ${s.sizeMb} MB` : ""}
            </span>
          </li>
        ))}
      </ul>
      {rates.length > 1 && (
        <p className="text-xs font-medium">
          Mixed sample rates in one folder — the wrong half will play back at the wrong speed.
        </p>
      )}
      {depths.length > 1 && (
        <p className="text-xs text-muted-foreground">Mixed bit depths. Usually harmless, occasionally not.</p>
      )}
      {trimmed.length > 0 && (
        <p className="text-xs font-medium">
          {trimmed.length} {trimmed.length === 1 ? "stem does" : "stems do"} not start at the session zero — they will need aligning by hand.
        </p>
      )}
      {rates.length === 1 && trimmed.length === 0 && (
        <p className="text-xs text-muted-foreground">All at one rate and all from bar one.</p>
      )}
    </div>
  );
}
