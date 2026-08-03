import { cn } from "@/lib/utils";

/**
 * A repair to somebody's HOME, tracked against the date it was promised for.
 *
 * NOT `repair-status`, which is a device on a bench — its stages end at "ready
 * to collect" and its useful fact is whether a part has arrived. A landlord
 * repair never gets collected, it gets ATTENDED, and the fact the tenant needs
 * is the appointment window and whether the target date has already gone.
 *
 * THE TARGET DATE IS PRINTED WHETHER OR NOT IT WAS MET, and a missed one says
 * so in words. Every repairs portal shows a cheerful "in progress" for a job
 * eleven days past its twenty-day promise, which is how a tenant discovers
 * they have to ring to find out they have been forgotten. A landlord that
 * publishes its own lateness is one a tenant can hold to something.
 *
 * `appointment` IS A WINDOW, NOT A TIME, because it always is — and a morning
 * or afternoon slot is the difference between losing half a day and losing a
 * whole one. Where there is no appointment yet the row says so rather than
 * being absent, since "not yet booked" is the answer somebody is looking for.
 *
 * No colour. Late is carried by a written word and by weight; a red banner on
 * somebody's boiler repair adds alarm and no information.
 */
export type RepairJobStage =
  | "reported" | "booked" | "attended" | "parts" | "complete";

const WORDS: Record<RepairJobStage, string> = {
  reported: "Reported — not yet booked",
  booked: "Appointment booked",
  attended: "Visited, work continuing",
  parts: "Waiting on a part",
  complete: "Complete",
};

const ORDER: RepairJobStage[] = ["reported", "booked", "attended", "parts", "complete"];

export function RepairJob({ job, notFound, checking, onLookup, className }: {
  job?: {
    /** The reference on the confirmation text. */
    ticket: string;
    /** What was reported, in the tenant's words. */
    what: string;
    /** "Emergency", "Urgent", "Routine". Free text — every landlord names them differently. */
    priority: string;
    stage: RepairJobStage;
    /** When it was reported. "29 July". */
    reportedOn: string;
    /** What the priority promises. "By 26 August". Printed whether met or not. */
    targetDate: string;
    /** True when the target has passed and the job is not complete. */
    late?: boolean;
    /** "Wednesday 5 August, 08:00 – 12:00". Omit and the card says it is not booked. */
    appointment?: string | null;
    contractor?: string | null;
    note?: string | null;
  };
  notFound?: boolean;
  checking?: boolean;
  onLookup?: (ticket: string) => void;
  className?: string;
}) {
  if (checking) return <p className={cn("text-sm text-muted-foreground", className)}>Looking that up…</p>;
  if (notFound) {
    return (
      <div className={cn("rounded-xl border border-border p-6", className)}>
        <p className="font-medium">No repair with that reference</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Check the text message we sent when it was reported. If you never had one, the number on
          your file is probably wrong — ring and we will find it by address.
        </p>
      </div>
    );
  }
  if (!job) {
    return (
      <form
        className={cn("flex flex-wrap gap-2", className)}
        onSubmit={(e) => {
          e.preventDefault();
          const el = e.currentTarget.elements.namedItem("ticket") as HTMLInputElement | null;
          onLookup?.((el?.value ?? "").trim().toUpperCase());
        }}
      >
        <input
          name="ticket" aria-label="Repair reference" placeholder="LVH-00000"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Track it
        </button>
      </form>
    );
  }

  const at = ORDER.indexOf(job.stage);
  return (
    <div className={cn("rounded-xl border border-border", className)}>
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="font-mono text-sm">{job.ticket}</span>
          <span className="text-sm text-muted-foreground">{job.priority}</span>
        </div>
        <p className="mt-1 font-medium">{job.what}</p>
      </div>

      <div className="px-5 py-4">
        {/* Stage as fill along a track, so the position reads without colour. */}
        <div aria-hidden className="flex gap-1">
          {ORDER.map((s, i) => (
            <span key={s} className={cn("h-1.5 flex-1 rounded-full", i <= at ? "bg-foreground" : "bg-muted")} />
          ))}
        </div>
        <p className="mt-3 font-medium">{WORDS[job.stage]}</p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Reported</dt>
            <dd className="mt-0.5 text-sm">{job.reportedOn}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Promised by</dt>
            <dd className="mt-0.5 text-sm">
              {job.targetDate}
              {job.late && job.stage !== "complete" && (
                <span className="ml-2 font-medium">— we are late</span>
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Appointment</dt>
            <dd className="mt-0.5 text-sm">
              {job.appointment ?? "Not booked yet — we will text you a window within two working days."}
            </dd>
          </div>
          {job.contractor && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Who is coming</dt>
              <dd className="mt-0.5 text-sm">{job.contractor}</dd>
            </div>
          )}
        </dl>

        {job.note && <p className="mt-4 max-w-prose text-sm text-muted-foreground">{job.note}</p>}

        {job.late && job.stage !== "complete" && (
          <p className="mt-4 max-w-prose text-sm">
            <span className="font-medium">This is past its target.</span>{" "}
            Ring 0114 288 6100 and quote the reference — a late job can be escalated and you should
            not have to wait to be offered that.
          </p>
        )}
      </div>
    </div>
  );
}
