import { useId } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
/**
 * Entering a recording code — validated on shape, not on a registry.
 *
 * THE FORMAT IS TWO LETTERS, THREE ALPHANUMERICS, TWO DIGITS, FIVE DIGITS, and
 * checking it costs nothing. A malformed code is accepted by a distributor's
 * form and rejected days later by a store, by which time the release window has
 * moved.
 *
 * IT IS VALIDATED BUT NOT VERIFIED, and says which. The shape being right does
 * not mean the code was issued to you; only the registry knows that, and a
 * component claiming otherwise would be lying about the one thing that matters.
 *
 * THE YEAR DIGITS ARE CHECKED AGAINST THE RECORDING YEAR where the caller
 * supplies it. Reusing last year's block is the ordinary mistake and produces
 * codes that clash with a recording somebody else made.
 *
 * SEPARATORS ARE STRIPPED ON THE WAY IN. Codes are written with hyphens and
 * stored without, and forcing the person typing to know which form is wanted is
 * a rejection over punctuation.
 */
export function IsrcField({ label = "ISRC", value, onChange, recordingYear, className }: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  /** Two-digit year the recording was made, for the sanity check. */
  recordingYear?: number;
  className?: string;
}) {
  const id = useId();
  const clean = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const shaped = /^[A-Z]{2}[A-Z0-9]{3}\d{2}\d{5}$/.test(clean);
  const yearPart = clean.length >= 7 ? Number(clean.slice(5, 7)) : undefined;
  const wrongYear =
    shaped && recordingYear !== undefined && yearPart !== undefined && yearPart !== recordingYear % 100;
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <Input
        id={id}
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-help`}
        aria-invalid={value !== "" && !shaped ? true : undefined}
        className="font-mono"
      />
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        Two letters, three characters, two digits for the year, then five. Hyphens are ignored.
      </p>
      {value !== "" && !shaped && (
        <p className="text-xs font-medium">That is not the right shape — a store will reject it.</p>
      )}
      {shaped && (
        <p className="text-xs text-muted-foreground">
          The shape is right. Whether this code was issued to you is something only the registry knows.
        </p>
      )}
      {wrongYear && (
        <p className="text-xs font-medium">
          The year digits do not match the recording year — check you are not reusing an old block.
        </p>
      )}
    </div>
  );
}
