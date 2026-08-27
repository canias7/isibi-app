import { cn } from "@/lib/utils";
/**
 * A summary of an uploaded CV — with what the parser could not read.
 *
 * PARSING FAILURES ARE SHOWN TO THE CANDIDATE, NOT SWALLOWED. A CV whose dates
 * did not parse is a CV that will be filtered out for having no experience, and
 * the candidate is never told. Surfacing the gaps is the difference between a
 * fixable upload and an invisible rejection.
 *
 * THE PARSED VERSION IS PRESENTED AS AN INTERPRETATION, NOT AS THEIR CV. What
 * the system extracted is what will actually be searched and screened, and
 * letting somebody see and correct it is the only defence against a bad parse
 * deciding their application.
 *
 * IT SAYS WHETHER THE ORIGINAL IS ALSO SEEN BY A HUMAN. If only the parsed
 * fields are used, formatting effort is wasted and unusual careers are
 * penalised — and candidates deserve to know which game they are playing.
 *
 * IT DOES NOT SCORE THE CV. A number attached to a person, produced by a parser
 * with known failure modes, gets treated as a measurement.
 */
export type ParsedField = { id: string; label: string; value?: string; failed?: boolean };

export function CvPreview({ fileName, fields, originalSeenByHuman, correctable = true, className }: {
  fileName?: string;
  fields: ParsedField[];
  /** Whether a person reads the file itself. */
  originalSeenByHuman?: boolean;
  correctable?: boolean;
  className?: string;
}) {
  const failed = fields.filter((f) => f.failed || !f.value);
  return (
    <div data-slot="cv-preview" className={cn("space-y-1.5", className)}>
      {fileName && <p className="font-mono text-xs text-muted-foreground">{fileName}</p>}
      <p className="text-sm">
        This is what we read from your CV. It is what gets searched and screened.
      </p>
      <dl className="divide-y divide-border rounded-md border border-border text-sm">
        {fields.map((f) => (
          <div key={f.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <dt className="w-32 shrink-0 text-xs text-muted-foreground">{f.label}</dt>
            <dd className={cn("min-w-0 flex-1", !f.value && "font-medium")}>
              {f.value ?? "Could not read this"}
            </dd>
          </div>
        ))}
      </dl>
      {failed.length > 0 && (
        <p className="text-xs font-medium">
          {failed.length} {failed.length === 1 ? "field" : "fields"} could not be read.
          {correctable ? " Correct them here — otherwise they count as blank." : ""}
        </p>
      )}
      {originalSeenByHuman !== undefined && (
        <p className="text-xs text-muted-foreground">
          {originalSeenByHuman
            ? "A person also reads your original file."
            : "Only the fields above are used — your original layout is not read by anyone."}
        </p>
      )}
    </div>
  );
}
