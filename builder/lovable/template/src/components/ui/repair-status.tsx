import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Where a repair is, from its ticket number.
 *
 * THIS EXISTS TO STOP THE PHONE RINGING, which is the honest business case. A
 * repair shop's phone rings all day with "is it ready yet", every call
 * interrupts a bench, and the answer is four words. It also removes the reason
 * a customer feels ignored: not knowing is what makes three days feel like a
 * fortnight.
 *
 * "WAITING ON A PART" IS A FIRST-CLASS STAGE, and it is the one that matters.
 * It is the only stage where nothing is happening, it is the most common reason
 * a repair overruns, and a tracker that hides it inside "in progress" produces
 * exactly the customer who rings on day four. Naming it — with the part and the
 * expected date — turns a silence into an explanation.
 *
 * STAGES ARE NUMBERED AND WORDED, never a coloured bar. The current stage is
 * marked by weight and by `aria-current`; the ones behind it are muted and say
 * "done"; the ones ahead are muted and say "to come". That survives greyscale
 * and it survives being read aloud.
 *
 * A WRONG TICKET AND A CLOSED TICKET LOOK THE SAME to somebody typing, so
 * `notFound` says "we cannot find that" without speculating. It never says
 * whether the number exists — a tracker that distinguishes them is an
 * enumeration oracle over sequential ticket numbers.
 *
 * IT LOOKS NOTHING UP ITSELF. `onLookup` fires with the trimmed, uppercased
 * ticket; the answer comes back as props. Same shape as `date-enquiry` and
 * `vehicle-lookup`, and for the same reason — the data is the site's.
 */
export type RepairStage = "received" | "diagnosed" | "waiting_part" | "in_repair" | "ready" | "collected";
const ORDER: RepairStage[] = ["received", "diagnosed", "waiting_part", "in_repair", "ready", "collected"];
const WORDS: Record<RepairStage, string> = {
  received: "Booked in",
  diagnosed: "Looked at",
  waiting_part: "Waiting on a part",
  in_repair: "On the bench",
  ready: "Ready to collect",
  collected: "Collected",
};
export function RepairStatus({
  repair, notFound, checking, onLookup, className,
}: {
  repair?: {
    ticket: string;
    device: string;
    /** What was booked in for. */
    job?: string | null;
    stage: RepairStage;
    /** "Screen, ordered Tuesday" — only meaningful at waiting_part. */
    part?: string | null;
    /** Already formatted: "Thursday". */
    expected?: string | null;
    /** Anything the bench wants to say. */
    note?: string | null;
    /** Quoted price, if it has changed or been confirmed. */
    price?: string | null;
  } | null;
  notFound?: boolean;
  checking?: boolean;
  onLookup?: (ticket: string) => void;
  className?: string;
}) {
  const id = React.useId();
  const [ticket, setTicket] = React.useState("");
  const at = repair ? ORDER.indexOf(repair.stage) : -1;
  // A repair that never waited on a part should not be shown a stage it skipped
  // — but one that IS waiting must see it. So the stage is dropped only when it
  // is neither current nor already passed.
  const stages = ORDER.filter((s) => s !== "waiting_part" || (repair && at >= ORDER.indexOf("waiting_part") && repair.part));
  return (
    <div className={cn("rounded-xl border border-border bg-background p-6 sm:p-8", className)}>
      <h2 className="text-lg font-semibold tracking-tight">Where is my repair?</h2>
      <form
        className="mt-4 flex flex-wrap items-end gap-4"
        onSubmit={(e) => { e.preventDefault(); const t = ticket.trim().toUpperCase(); if (t) onLookup?.(t); }}
      >
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-ticket`} className="text-sm font-medium">Ticket number</label>
          <input
            id={`${id}-ticket`} value={ticket} placeholder="RS-4821" autoComplete="off"
            onChange={(e) => setTicket(e.target.value)}
            className="h-10 w-44 rounded-md border border-border bg-background px-3 uppercase tracking-wider outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button type="submit" disabled={!ticket.trim() || checking}>
          {checking ? "Looking…" : "Check"}
        </Button>
      </form>
      <p className="mt-2 text-sm text-muted-foreground">It is on the slip we gave you, and in the text.</p>

      {notFound && !repair && (
        /* Never says whether the number exists — that would be an enumeration
           oracle over sequential tickets. */
        <p className="mt-5 border-t border-border pt-5 text-sm">
          <span className="font-medium">We cannot find that one. </span>
          <span className="text-muted-foreground">
            Check the slip, or ring the shop and somebody will look on the board.
          </span>
        </p>
      )}

      {repair && (
        <div className="mt-6 border-t border-border pt-6">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{repair.ticket}</p>
          <p className="mt-1 text-lg font-semibold">{repair.device}</p>
          {repair.job && <p className="text-base text-muted-foreground">{repair.job}</p>}

          <ol className="mt-5 divide-y divide-border border-y border-border">
            {stages.map((s, i) => {
              const idx = ORDER.indexOf(s);
              const done = idx < at;
              const current = idx === at;
              return (
                <li key={s} {...(current ? { "aria-current": "step" as const } : {})}
                  className="flex items-baseline gap-4 py-3">
                  <span aria-hidden="true" className={cn("w-5 shrink-0 text-sm tabular-nums",
                    current ? "font-semibold" : "text-muted-foreground")}>{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("text-base", current ? "font-semibold" : done ? "" : "text-muted-foreground")}>
                      {WORDS[s]}
                    </span>
                    {current && s === "waiting_part" && repair.part && (
                      <span className="mt-0.5 block text-sm text-muted-foreground">{repair.part}</span>
                    )}
                  </span>
                  <span className={cn("shrink-0 text-sm", current ? "font-medium" : "text-muted-foreground")}>
                    {done ? "Done" : current ? "Now" : "To come"}
                  </span>
                </li>
              );
            })}
          </ol>

          {(repair.expected || repair.price || repair.note) && (
            <dl className="mt-5 space-y-2 text-sm">
              {repair.expected && (
                <div className="flex gap-3">
                  <dt className="w-28 shrink-0 text-muted-foreground">Expected</dt>
                  <dd className="font-medium">{repair.expected}</dd>
                </div>
              )}
              {repair.price && (
                <div className="flex gap-3">
                  <dt className="w-28 shrink-0 text-muted-foreground">Price</dt>
                  <dd className="font-medium">{repair.price}</dd>
                </div>
              )}
              {repair.note && (
                <div className="flex gap-3">
                  <dt className="w-28 shrink-0 text-muted-foreground">From the bench</dt>
                  <dd>{repair.note}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
