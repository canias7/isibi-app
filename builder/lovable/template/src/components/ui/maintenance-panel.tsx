import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * Planned downtime, said before it starts and during it.
 *
 * THE END TIME IS THE ONLY THING ANYBODY WANTS. "Back shortly" is what people
 * have learned to distrust, because it is said whether the work takes ten
 * minutes or a day. A real timestamp lets somebody decide whether to wait or
 * come back tomorrow.
 *
 * WHAT STILL WORKS is stated when the caller can say it. Partial maintenance is
 * the common case and "the site is down" loses the customers who only needed the
 * part that is up.
 *
 * A real `<time>`, so it survives being read in another timezone — which for
 * scheduled downtime is most of the audience.
 */
export function MaintenancePanel({ until, what = "Scheduled maintenance", stillWorks, statusHref, className }: {
  until?: string | number | Date;
  what?: string;
  /** What is unaffected. */
  stillWorks?: string;
  statusHref?: string;
  className?: string;
}) {
  return (
    <section role="status" aria-label="Maintenance"
      className={cn("flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-6 text-center", className)}>
      <h2 className="text-lg font-semibold tracking-tight">{what}</h2>
      <p className="text-sm text-muted-foreground">
        {until
          ? <>Back by <DateFormat date={until} withTime />.</>
          : "We're working on it now."}
      </p>
      {stillWorks && <p className="text-sm">{stillWorks}</p>}
      {statusHref && (
        <p className="text-sm"><a href={statusHref} className="underline underline-offset-4">Live status</a></p>
      )}
    </section>
  );
}
