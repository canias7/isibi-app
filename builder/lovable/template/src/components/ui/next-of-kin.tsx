import { cn } from "@/lib/utils";
/**
 * Who to contact — separated from who can decide.
 *
 * NEXT OF KIN IS NOT A DECISION-MAKER, AND CONFLATING THE TWO IS THE BUG THIS
 * COMPONENT EXISTS FOR. In most places a relative has no automatic authority
 * over somebody's care at all; a formally appointed representative does, and is
 * often a different person. A single "next of kin" field lets staff ask the
 * wrong person for a decision the right person has already made.
 *
 * THE RELATIONSHIP IS FREE TEXT AND NEVER A DROPDOWN. Families do not come in a
 * list, and a picker of spouse/parent/child forces a partner of thirty years to
 * be filed as "other" on the day it matters most.
 *
 * WHO MAY BE TOLD WHAT IS ITS OWN QUESTION. Somebody can be the first person to
 * call in an emergency and still not be someone the person wants their diagnosis
 * shared with, and both are ordinary.
 *
 * NO NAMED AUTHORITY IS ASSERTED. What a formal appointment is called, and what
 * it lets somebody do, differs everywhere — the caller supplies the label.
 */
export type Contact = {
  id: string;
  name: string;
  /** Free text. Families do not come in a list. */
  relationship?: string;
  phone?: string;
  /** True for the first call in an emergency. */
  callFirst?: boolean;
  /** True where they hold a formal appointment. The caller names it. */
  canDecide?: boolean;
  decisionAuthority?: string;
  /** True where the person has agreed they may be told. */
  mayBeTold?: boolean;
};

export function NextOfKin({ contacts, className }: { contacts: Contact[]; className?: string }) {
  const deciders = contacts.filter((c) => c.canDecide);
  return (
    <div data-slot="next-of-kin" className={cn("space-y-1.5", className)}>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {contacts.map((c) => (
          <li key={c.id} className="space-y-0.5 px-3 py-2">
            <p className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{c.name}</span>
                {c.relationship && <span className="text-muted-foreground"> · {c.relationship}</span>}
              </span>
              {c.phone && <span className="shrink-0 tabular-nums text-muted-foreground">{c.phone}</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {[
                c.callFirst ? "Call first" : "",
                c.canDecide ? c.decisionAuthority ?? "Can make decisions" : "",
                c.mayBeTold ? "May be told about care" : "Has not been agreed for sharing",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </li>
        ))}
      </ul>
      {deciders.length === 0 && (
        <p className="text-xs">
          Nobody here can make a decision on their behalf. Being next of kin is not the same thing, and asking a
          relative for one is asking the wrong person.
        </p>
      )}
    </div>
  );
}
