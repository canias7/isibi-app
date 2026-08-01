import { cn } from "@/lib/utils";
/**
 * Whether somebody is inducted for this site — checked at the gate.
 *
 * INDUCTION IS PER SITE, NOT PER PERSON. Somebody inducted on three other jobs
 * for the same contractor is not inducted here, and treating it as an attribute
 * of the worker is how uninducted people end up on site with a valid-looking
 * card.
 *
 * IT EXPIRES, and the expiry is what a gate check is for. Inductions are
 * commonly valid for a period or until a significant change on site, and an
 * out-of-date one is the same as none.
 *
 * THE CARDS ARE CHECKED SEPARATELY. A competence card and a site induction are
 * different things and both are required; a component reporting only one lets
 * the other lapse invisibly.
 *
 * A REFUSAL SAYS WHAT IS MISSING, because the answer is usually a twenty-minute
 * induction rather than sending somebody home — and a bare "not authorised"
 * gets them sent home.
 */
export function SiteInduction({ name, site, state, inductedOn, expiresOn, missing = [], cards = [], className }: {
  name: string;
  site: string;
  state: "valid" | "expired" | "none";
  /** Free text. */
  inductedOn?: string;
  expiresOn?: string;
  /** What is needed before they can start. */
  missing?: string[];
  /** Competence cards held. */
  cards?: { name: string; expiresOn?: string; expired?: boolean }[];
  className?: string;
}) {
  const ok = state === "valid";
  return (
    <div className={cn("space-y-1 rounded-md border px-3 py-2 text-sm",
      ok ? "border-border" : "border-foreground/40 bg-muted/40", className)}>
      <p>
        <span className="font-medium">{name}</span>
        <span className={cn("block", !ok && "font-medium")}>
          {state === "valid" ? `Inducted for ${site}`
            : state === "expired" ? `Induction for ${site} has expired`
            : `Not inducted for ${site}`}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        {state === "valid" && (
          <>
            {inductedOn && `Inducted ${inductedOn}`}
            {expiresOn && `${inductedOn ? " · " : ""}valid until ${expiresOn}`}
          </>
        )}
        {state !== "valid" && (
          missing.length
            ? `Needs: ${missing.join(", ")}`
            : "An induction takes about twenty minutes — they do not need to be sent home."
        )}
      </p>
      {cards.length > 0 && (
        <ul className="space-y-0.5 text-xs">
          {cards.map((c) => (
            <li key={c.name} className={cn("flex gap-2", c.expired && "font-medium")}>
              <span aria-hidden="true" className="text-muted-foreground">·</span>
              <span>
                {c.name}
                {c.expired
                  ? " — expired"
                  : c.expiresOn ? <span className="text-muted-foreground"> — until {c.expiresOn}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
