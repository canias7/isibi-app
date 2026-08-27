import { cn } from "@/lib/utils";
/**
 * Somebody acting for somebody else — and exactly what they may do.
 *
 * THE SCOPE IS EXPLICIT AND USUALLY NARROWER THAN PEOPLE ASSUME. A person
 * authorised to receive information is not automatically authorised to change
 * anything, and staff give away both on a phone call because the record says
 * only "representative".
 *
 * THE BASIS IS NAMED — consent, a legal appointment, or a formal power. They
 * are revocable in different ways and by different people, and a consent
 * treated as a legal appointment survives a withdrawal it should not.
 *
 * THE PERSON REPRESENTED CAN ALWAYS ACT THEMSELVES, and that is stated, because
 * an appointed representative is regularly treated as replacing them. It is
 * only true where a court has said so, which is a different and much rarer
 * thing.
 *
 * AN EXPIRY IS SHOWN OR ITS ABSENCE IS. An authority with no end date is a
 * standing permission somebody granted years ago in different circumstances.
 */
export type RepScope = "receive-information" | "act-on-behalf" | "manage-money";

const SCOPE: Record<RepScope, string> = {
  "receive-information": "May be told about the case — may not change anything",
  "act-on-behalf": "May act and make decisions on the case",
  "manage-money": "May manage payments as well as the case",
};

export function RepresentativeNote({ representative, represents, scope, basis, since, until, canRevoke = true, className }: {
  representative: string;
  represents?: string;
  scope: RepScope;
  /** "Written consent", "a legal appointment", "power of attorney". */
  basis?: string;
  /** Free text — "14 March 2026". */
  since?: string;
  until?: string;
  canRevoke?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="representative-note" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">{representative}</span>
        {represents && <span className="text-muted-foreground"> acting for {represents}</span>}
      </p>
      <p className="text-xs">{SCOPE[scope]}.</p>
      <p className="text-xs text-muted-foreground">
        {basis ? `On the basis of ${basis}` : "No basis recorded"}
        {since && ` · since ${since}`}
      </p>
      <p className={cn("text-xs", until ? "text-muted-foreground" : "font-medium")}>
        {until ? `Ends ${until}.` : "No end date — this stays in place until someone removes it."}
      </p>
      {canRevoke && (
        <p className="text-xs text-muted-foreground">
          {represents ?? "The person represented"} can still act directly, and can end this at any time.
        </p>
      )}
    </div>
  );
}
