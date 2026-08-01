import { useId } from "react";
import { cn } from "@/lib/utils";
/**
 * Asking for this in another language, or in another format.
 *
 * LANGUAGE AND FORMAT ARE ONE REQUEST, DELIBERATELY. Large print, braille, easy
 * read and audio sit in the same place as a spoken language, because they are
 * the same question — "I cannot use it as issued" — and splitting them across
 * two pages means most people find neither.
 *
 * THE LANGUAGE NAMES ARE IN THEIR OWN LANGUAGE. Somebody looking for Polish is
 * scanning for "Polski", and a list rendered only in the service's own language
 * is unusable by exactly the people it is for.
 *
 * IT SAYS HOW LONG A TRANSLATION TAKES AND WHETHER THE DEADLINE MOVES. A
 * translated letter arriving after the reply date is worse than useless, and
 * whether the clock pauses is the question nobody thinks to ask until it is too
 * late.
 *
 * IT IS FREE AND SAYS SO. People do not ask because they assume there is a
 * charge, and the assumption is the barrier rather than the cost.
 */
export type LanguageOption = { code: string; endonym: string; english?: string };

export function TranslationRequest({ languages, formats = ["Large print", "Braille", "Easy read", "Audio"], turnaround, deadlinePauses, value, onChange, className }: {
  languages: LanguageOption[];
  formats?: string[];
  /** Free text — "about 10 working days". */
  turnaround?: string;
  /** True where asking stops the reply clock. */
  deadlinePauses?: boolean;
  value?: string;
  onChange?: (next: string) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        Get this in another language or format
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        aria-describedby={`${id}-help`}
      >
        <option value="">Choose one</option>
        <optgroup label="Language">
          {languages.map((l) => (
            <option key={l.code} value={`lang:${l.code}`}>
              {l.endonym}{l.english ? ` (${l.english})` : ""}
            </option>
          ))}
        </optgroup>
        <optgroup label="Format">
          {formats.map((f) => <option key={f} value={`format:${f}`}>{f}</option>)}
        </optgroup>
      </select>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        This is free.
        {turnaround && ` It usually takes ${turnaround}.`}
        {deadlinePauses !== undefined && (deadlinePauses
          ? " Asking pauses any deadline until it reaches you."
          : " Any deadline still applies — tell us if you need longer.")}
      </p>
    </div>
  );
}
