import { cn } from "@/lib/utils";
/**
 * A batch code — the thing a recall is built on.
 *
 * IT SHOWS WHAT THE CODE ENCODES, because a batch code is only useful if
 * somebody can read it. Producers encode the date, line and shift into a short
 * string and then nobody in the building remembers the scheme, so a recall notice
 * lists a range of codes nobody at the shop counter can match against a jar.
 *
 * THE HUMAN-READABLE DATE IS SHOWN BESIDE IT, ALWAYS. The person holding the jar
 * needs to know whether theirs is affected, and asking them to decode "L2 240718
 * B" is asking them to give up.
 *
 * IT IS GROUPED FOR READING ALOUD, and copying gives the unbroken form, because
 * this number gets read down a telephone and typed into a search box in the same
 * five minutes.
 *
 * NO BARCODE RENDERING. A barcode drawn from an unvalidated string scans as
 * something plausible and wrong, which is worse than no barcode at all in the
 * one situation this component exists for.
 */
export function BatchCode({ code, madeOn, line, shift, quantity, recalled, recallNote, className }: {
  code: string;
  /** The human-readable half. Always shown. */
  madeOn?: string;
  line?: string;
  shift?: string;
  quantity?: number;
  recalled?: boolean;
  recallNote?: string;
  className?: string;
}) {
  // NEVER REGROUPED. A batch code is compared character by character against
  // what is printed on the jar, and the producer's scheme is the only one that
  // matches it — every grouping invented here is wrong for somebody. Tried both
  // ways on real codes: fours turn "L2240719B" into "L224 0719 B", and keeping
  // the leading letters whole turns it into "L 2240 719B", which is worse. The
  // monospaced face is what makes it readable; the spacing is not ours to
  // choose.
  const shown = code.trim().replace(/\s+/g, " ");
  return (
    <div data-slot="batch-code" className={cn("space-y-0.5 text-sm", className)}>
      {recalled && (
        <p className="font-medium">
          This batch has been recalled.{recallNote ? ` ${recallNote}` : " Do not sell or use it."}
        </p>
      )}
      <p className="font-mono text-base tabular-nums">{shown}</p>
      <p className="text-xs text-muted-foreground">
        {[
          madeOn && `Made ${madeOn}`,
          line && `line ${line}`,
          shift && `${shift} shift`,
          quantity !== undefined && `${quantity.toLocaleString()} made`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {!madeOn && (
        <p className="text-xs font-medium">
          No date against this code. Somebody holding the jar cannot tell whether theirs is affected.
        </p>
      )}
    </div>
  );
}
