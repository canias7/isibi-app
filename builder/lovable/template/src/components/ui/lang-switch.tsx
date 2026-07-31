import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Choose a language.
 *
 * Each option is written IN ITS OWN LANGUAGE — "Deutsch", not "German".
 * Somebody who cannot read the current language cannot find theirs in a list
 * translated into it, which is the one situation this control exists for.
 *
 * No flags. A flag is a country and a language is not: Spanish is not
 * Spain to most of its speakers, and Arabic, English and Portuguese have no
 * single flag at all.
 */
export function LangSwitch({ value, onChange, languages, id = "lang", className }: {
  value: string; onChange: (code: string) => void;
  languages: { code: string; label: string }[]; id?: string; className?: string;
}) {
  return (
    <NativeSelect id={id} value={value} aria-label="Language" lang=""
      className={cn("h-8 w-auto text-sm", className)}
      onChange={(e) => onChange(e.target.value)}>
      {languages.map((l) => <option key={l.code} value={l.code} lang={l.code}>{l.label}</option>)}
    </NativeSelect>
  );
}
