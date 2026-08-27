import { cn } from "@/lib/utils";
/**
 * One animal — its official tag, where it is, and what it is due.
 *
 * THE OFFICIAL TAG IS THE IDENTIFIER, and a farm name for the animal is not.
 * Movement records, medicine records and any inspection use the tag, and a
 * system keyed on a name cannot be reconciled with the statutory register.
 *
 * WITHDRAWAL PERIODS ARE THE FIELD THAT MATTERS MOST. An animal treated with a
 * medicine cannot enter the food chain until the period has passed — selling
 * inside it is a serious offence, and it is held on a piece of paper in a
 * cabinet. Showing it on the animal is the whole point.
 *
 * "DUE" COVERS SEVERAL THINGS and they are the caller's. Calving, testing,
 * worming and hoof trimming are all due-dates, and hard-coding a list would fit
 * one kind of enterprise.
 *
 * THE DAM IS RECORDED where known, because that is what makes a lineage
 * traceable and it is asked for at every sale.
 */
export function LivestockRow({ tag, name, kind, location, born, dam, withdrawalUntil, due = [], className }: {
  /** Official ear tag. */
  tag: string;
  name?: string;
  /** Breed or type. */
  kind?: string;
  /** Which field or shed. */
  location?: string;
  /** Free text. */
  born?: string;
  /** The mother's tag. */
  dam?: string;
  /** Free text — cannot be sold before this. */
  withdrawalUntil?: string;
  /** What is coming up. */
  due?: { what: string; when: string; overdue?: boolean }[];
  className?: string;
}) {
  const overdue = due.filter((d) => d.overdue);
  return (
    <li data-slot="livestock-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <code className="font-mono text-xs">{tag}</code>
        {name && <span>{name}</span>}
        {kind && <span className="text-xs text-muted-foreground">{kind}</span>}
        {location && <span className="ms-auto text-xs text-muted-foreground">{location}</span>}
      </p>
      <p className="text-xs text-muted-foreground">
        {born && <span>Born {born}</span>}
        {born && dam ? " · " : ""}
        {dam && <span>Dam <code className="font-mono">{dam}</code></span>}
      </p>
      {withdrawalUntil && (
        <p className="text-xs font-medium">
          Must not enter the food chain before {withdrawalUntil}.
        </p>
      )}
      {due.length > 0 && (
        <p className={cn("text-xs", overdue.length ? "font-medium" : "text-muted-foreground")}>
          {due.map((d) => `${d.what} ${d.overdue ? "overdue since" : "due"} ${d.when}`).join(" · ")}
        </p>
      )}
    </li>
  );
}
