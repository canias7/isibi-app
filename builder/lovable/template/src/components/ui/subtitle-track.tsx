import * as React from "react";
import { Captions, CaptionsOff } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The captions switch, and the choice of language.
 *
 * "Off" is a real option in the list, not the absence of a selection. Somebody
 * turning captions off wants that remembered; a list where off means "nothing
 * selected" cannot tell the difference between a deliberate off and a track
 * that failed to load.
 *
 * The choice is PERSISTED, and that is most of the value. A person who needs
 * captions needs them on every video, and a player that forgets is one they
 * have to fix every single time. `localStorage` in a try/catch, because it
 * throws outright in a Safari private window and in a sandboxed frame — a
 * crashed player is a worse outcome than a forgotten preference.
 *
 * Language names are shown in THEIR OWN language — "français", not "French".
 * Somebody looking for their language is looking for the word they would use
 * for it, and `Intl.DisplayNames` in that locale produces it without a table.
 *
 * It is BEST EFFORT, and measured: en/fr/es/ja come back native, `cy` comes
 * back as "Welsh" because the runtime has no Welsh locale data and falls back
 * to the default. That is why `label` exists — pass one for any language the
 * audience actually uses and it wins over the guess.
 *
 * The results are lower-case in French and Spanish. That is correct in those
 * languages, which do not capitalise language names, and it looks wrong only
 * next to "English". Do not "fix" it.
 */
const KEY = "captions-pref";

export function useCaptionPreference(fallback = "off") {
  const [value, setValue] = React.useState(fallback);
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setValue(saved);
    } catch { /* private mode or a sandboxed frame — the default is fine */ }
  }, []);
  const set = React.useCallback((next: string) => {
    setValue(next);
    try { localStorage.setItem(KEY, next); } catch { /* as above */ }
  }, []);
  return [value, set] as const;
}

export function nativeLanguageName(lang: string, fallbackLabel?: string) {
  if (fallbackLabel) return fallbackLabel;
  try {
    return new Intl.DisplayNames([lang], { type: "language" }).of(lang) ?? lang;
  } catch {
    return lang;
  }
}

export function SubtitleTrack({ tracks, value, onChange, className }: {
  tracks: { lang: string; label?: string }[];
  value: string;
  onChange: (lang: string) => void;
  className?: string;
}) {
  const id = React.useId();
  const on = value !== "off";
  return (
    <div data-slot="subtitle-track" className={cn("flex items-center gap-2", className)}>
      {on ? <Captions aria-hidden className="size-4" /> : <CaptionsOff aria-hidden className="size-4 text-muted-foreground" />}
      <label htmlFor={id} className="sr-only">Captions</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-8 cursor-pointer rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:border-ring">
        <option value="off">Captions off</option>
        {tracks.map((t) => (
          <option key={t.lang} value={t.lang}>
            {nativeLanguageName(t.lang, t.label)}
          </option>
        ))}
      </select>
    </div>
  );
}
