import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Choosing a language, written in that language.
 *
 * EACH OPTION IS IN ITS OWN LANGUAGE — "Deutsch", not "German". Somebody who
 * cannot read the current interface cannot find their language in a list
 * written in it, and that is precisely the person using this control. Both
 * names are shown where the caller supplies them, with the native one first.
 *
 * NO FLAGS. A flag is a country and a language is not: Spanish is not Spain to
 * most of its speakers, Arabic has no flag at all, and choosing one for English
 * insults somebody either way.
 *
 * `lang` ON EVERY OPTION, so a screen reader pronounces each name with the
 * right phonemes. Without it a list of language names is read in one voice and
 * becomes gibberish — the same reasoning as `language-fallback`.
 *
 * A NATIVE `<select>`, which on a phone becomes the platform's own picker and
 * inherits its font fallbacks — a custom listbox is where scripts render as
 * boxes.
 */
export type Locale = { id: string; native: string; english?: string };

export function LocalePicker({ locales, value, onChange, label = "Language", id = "locale", className }: {
  locales: Locale[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  id?: string;
  className?: string;
}) {
  return (
    <div data-slot="locale-picker" className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <NativeSelect id={id} value={value} className="w-auto" onChange={(e) => onChange(e.target.value)}>
        {locales.map((l) => (
          <option key={l.id} value={l.id} lang={l.id}>
            {l.native}{l.english && l.english !== l.native ? ` — ${l.english}` : ""}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
