import { cn } from "@/lib/utils";
/**
 * A formal notice — what is proposed, and by when anybody can object.
 *
 * THE OBJECTION WINDOW IS THE OPERATIVE PART AND IS SHOWN FIRST. A notice
 * published without a visible closing date is a notice that has technically been
 * given; publishing the date is what makes it actually work.
 *
 * WHERE TO SEE THE FULL PAPERS IS INCLUDED. A summary is not the application,
 * and an objection written against the summary is regularly the one that gets
 * dismissed for missing the point.
 *
 * IT SAYS WHO DECIDES AND WHETHER OBJECTIONS ARE PUBLIC. Many schemes publish
 * objections with the objector's name and address, which changes whether some
 * people are willing to write one at all — and finding that out afterwards is
 * the worst possible time.
 *
 * A CLOSED WINDOW SAYS SO PLAINLY rather than hiding the form, since the notice
 * remains a public record long after the window shuts and a page that simply
 * looks broken is worse than one that explains.
 */
export function PublicNotice({ reference, title, proposal, publishedOn, closesOn, closed, papersAt, decidedBy, objectionsPublic, className }: {
  reference?: string;
  title: string;
  proposal?: string;
  /** Free text — "14 July 2026". */
  publishedOn?: string;
  closesOn?: string;
  /** True once the window has shut. */
  closed?: boolean;
  /** Where the full documents can be read. */
  papersAt?: string;
  decidedBy?: string;
  /** True where objections are published with the objector's details. */
  objectionsPublic?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">{title}</span>
        {reference && <span className="block font-mono text-xs text-muted-foreground">{reference}</span>}
      </p>
      <p className={cn("text-xs", closed ? "text-muted-foreground" : "font-medium")}>
        {closed
          ? `Comments closed${closesOn ? ` on ${closesOn}` : ""}.`
          : closesOn
            ? `Comments close ${closesOn}.`
            : "No closing date has been published."}
      </p>
      {proposal && <p className="text-xs">{proposal}</p>}
      <p className="text-xs text-muted-foreground">
        {publishedOn && `Published ${publishedOn}`}
        {publishedOn && decidedBy ? " · " : ""}
        {decidedBy && `Decided by ${decidedBy}`}
      </p>
      {papersAt && <p className="text-xs">The full papers are {papersAt}.</p>}
      {objectionsPublic !== undefined && !closed && (
        <p className="text-xs">
          {objectionsPublic
            ? "Comments are published in full, including your name and address."
            : "Comments are not published, though they can be requested under access-to-information rules."}
        </p>
      )}
    </div>
  );
}
