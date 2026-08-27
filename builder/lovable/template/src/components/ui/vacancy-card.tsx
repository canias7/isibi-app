import { cn } from "@/lib/utils";
/**
 * A job advert — with the facts people filter on before reading a word of it.
 *
 * SALARY IS SHOWN OR ITS ABSENCE IS STATED. "Competitive" is not a salary, and
 * withholding the range is measurably worse for candidates who negotiate least
 * — which is not a random sample of them. A component that lets it be omitted
 * silently makes that the easy default.
 *
 * LOCATION AND REMOTE POLICY ARE ONE FACT, NOT TWO. "London, hybrid" is
 * meaningless without the number of days; the days are what decides whether
 * somebody two hours away can take the job.
 *
 * THE CLOSING DATE IS SHOWN WITH WHETHER APPLICATIONS ARE REVIEWED AS THEY
 * ARRIVE. Rolling review means applying on the last day is applying too late,
 * and almost no advert says so.
 *
 * THE CONTRACT TYPE IS NEVER IMPLIED. Permanent, fixed-term and contract are
 * different jobs, and an advert that leaves it out is read as permanent by
 * default — which is how people resign for a six-month post.
 */
export function VacancyCard({ title, employer, location, remotePolicy, salaryFrom, salaryTo, salaryPeriod = "a year", salaryNote, contract, hours, closesOn, rollingReview, currency = "GBP", locale = "en-GB", className }: {
  title: string;
  employer?: string;
  location?: string;
  /** "Hybrid, 2 days in the office" — the days are the fact that matters. */
  remotePolicy?: string;
  salaryFrom?: number;
  salaryTo?: number;
  salaryPeriod?: string;
  /** Where a range genuinely cannot be given, say why. */
  salaryNote?: string;
  /** "Permanent", "Fixed term, 12 months", "Contract". */
  contract?: string;
  /** "Full time, 37.5 hours" or "Part time, 3 days". */
  hours?: string;
  /** Free text — "14 August". */
  closesOn?: string;
  /** True where applications are read as they arrive. */
  rollingReview?: boolean;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const pay = salaryFrom !== undefined && salaryTo !== undefined
    ? `${money(salaryFrom)}–${money(salaryTo)} ${salaryPeriod}`
    : salaryFrom !== undefined
      ? `From ${money(salaryFrom)} ${salaryPeriod}`
      : undefined;
  return (
    <div data-slot="vacancy-card" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">{title}</span>
        {employer && <span className="block text-xs text-muted-foreground">{employer}</span>}
      </p>
      <p className={cn("text-xs tabular-nums", pay ? "" : "font-medium")}>
        {pay ?? salaryNote ?? "No salary published — ask for the range before applying."}
      </p>
      <p className="text-xs text-muted-foreground">
        {[location, remotePolicy, contract ?? "Contract type not stated", hours].filter(Boolean).join(" · ")}
      </p>
      {closesOn && (
        <p className="text-xs">
          Closes {closesOn}
          {rollingReview && (
            <span className="block font-medium">
              Applications are read as they arrive — applying near the closing date is applying late.
            </span>
          )}
        </p>
      )}
    </div>
  );
}
