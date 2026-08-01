import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Choose subtitles, including off.
 *
 * "OFF" IS AN OPTION IN THE LIST, not the absence of a selection. A picker where
 * turning captions off means choosing nothing is one people cannot work out how
 * to use, and it leaves the control in an ambiguous state.
 *
 * AUTOMATIC TRACKS ARE LABELLED AS SUCH. Machine-generated captions are useful
 * and often wrong, and somebody relying on them for accessibility rather than
 * convenience is entitled to know which kind they are getting.
 *
 * A native `<select>`, so a phone gets the system picker and language names read
 * correctly — and each option carries its own `lang`, so a screen reader
 * pronounces "Français" in French rather than mangling it.
 */
export type CaptionTrack = { key: string; label: string; lang?: string; automatic?: boolean };

export function CaptionTrackPicker({ tracks, value, onChange, id, className }: {
  tracks: CaptionTrack[];
  /** Empty string means off. */
  value: string;
  onChange: (key: string) => void;
  id?: string;
  className?: string;
}) {
  if (!tracks.length) return null;
  return (
    <NativeSelect id={id} value={value} aria-label="Subtitles"
      className={cn("h-8 w-auto text-sm", className)}
      onChange={(e) => onChange(e.target.value)}>
      <option value="">Subtitles off</option>
      {tracks.map((t) => (
        <option key={t.key} value={t.key} lang={t.lang}>
          {t.label}{t.automatic ? " (automatic)" : ""}
        </option>
      ))}
    </NativeSelect>
  );
}
