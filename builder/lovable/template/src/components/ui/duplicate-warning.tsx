import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * "This looks like one you already have."
 *
 * A WARNING, NEVER A REFUSAL. Two customers genuinely share a name, two
 * bookings genuinely fall on one slot for two chairs, and a system certain
 * enough to block is wrong often enough to be infuriating. It offers the
 * existing record and lets the reader decide.
 *
 * IT SHOWS WHAT MATCHED. "Possible duplicate" sends somebody comparing two
 * records field by field; "same phone number" is the whole answer, and it is
 * usually enough to decide without opening either.
 *
 * `role="status"`, since it appears while somebody is still typing and
 * interrupting on every keystroke that produces a near-match is unbearable.
 */
export function DuplicateWarning({ matches, matchedOn, onOpen, onContinue, className }: {
  /** The records it resembles. */
  matches: { key: string; label: string; detail?: string }[];
  /** What matched — "the same phone number". */
  matchedOn?: string;
  onOpen?: (key: string) => void;
  onContinue?: () => void;
  className?: string;
}) {
  if (!matches.length) return null;
  return (
    <div data-slot="duplicate-warning" role="status" className={cn("flex flex-col gap-2 rounded-md border border-border p-3", className)}>
      <p className="text-sm font-medium">
        {matches.length === 1 ? "This looks like one you already have" : `This looks like ${matches.length} you already have`}
        {matchedOn && <span className="font-normal text-muted-foreground"> — {matchedOn}</span>}
      </p>
      <ul className="flex flex-col gap-0.5 text-sm">
        {matches.map((m) => (
          <li key={m.key} className="flex flex-wrap items-baseline gap-x-2">
            <span>{m.label}</span>
            {m.detail && <span className="text-xs text-muted-foreground">{m.detail}</span>}
            {onOpen && (
              <button type="button" onClick={() => onOpen(m.key)}
                className="cursor-pointer text-xs underline underline-offset-2">
                Open<span className="sr-only"> {m.label}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {onContinue && <div><Button size="sm" variant="outline" onClick={onContinue}>Add it anyway</Button></div>}
    </div>
  );
}
