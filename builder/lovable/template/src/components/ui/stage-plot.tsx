import { cn } from "@/lib/utils";
/**
 * What goes where on stage — as a list an engineer can work from.
 *
 * IT IS TEXT, NOT A DIAGRAM, AND THAT IS DELIBERATE. Stage plots are emailed,
 * printed at a venue, read on a phone in a dark room and taped to a desk — a
 * drawn one is unreadable in at least two of those, and unusable to a blind
 * engineer entirely. Positions are stated in words.
 *
 * THE INPUT LIST IS THE THING VENUES ACTUALLY WANT. Channel, source and what
 * it needs — a microphone, a DI, phantom power — is what determines whether the
 * desk can take the band at all, and it is the half most plots omit.
 *
 * WHO NEEDS WHAT IN THEIR MONITOR IS PART OF IT. Monitor requirements decided
 * at soundcheck cost twenty minutes; written down they cost none.
 *
 * POWER IS COUNTED. The number of sockets needed on stage is a real constraint
 * at small venues and is discovered when somebody unplugs the fridge.
 */
export type StageInput = {
  channel: number;
  source: string;
  /** "SM57", "DI", "XLR from our desk". */
  needs?: string;
  phantom?: boolean;
  position?: string;
};

export function StagePlot({ band, inputs, monitors = [], powerOutlets, notes, className }: {
  band?: string;
  inputs: StageInput[];
  /** "Vocals and a little guitar for the singer, stage left". */
  monitors?: string[];
  powerOutlets?: number;
  notes?: string;
  className?: string;
}) {
  const phantom = inputs.filter((i) => i.phantom).length;
  return (
    <div className={cn("space-y-1.5", className)}>
      {band && <p className="text-sm font-medium">{band}</p>}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {inputs.map((i) => (
          <li key={i.channel} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="w-8 shrink-0 text-xs tabular-nums text-muted-foreground">{i.channel}</span>
            <span className="min-w-0 flex-1">
              {i.source}
              {i.position && <span className="block text-xs text-muted-foreground">{i.position}</span>}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {i.needs}
              {i.phantom ? " · 48V" : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs tabular-nums text-muted-foreground">
        {inputs.length} {inputs.length === 1 ? "channel" : "channels"}
        {phantom > 0 && ` · ${phantom} needing phantom power`}
        {powerOutlets !== undefined && ` · ${powerOutlets} power ${powerOutlets === 1 ? "socket" : "sockets"} on stage`}
      </p>
      {monitors.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs font-medium">Monitors</p>
          <ul className="text-xs text-muted-foreground">
            {monitors.map((m, i) => (
              <li key={i} className="flex gap-2"><span aria-hidden="true">—</span><span>{m}</span></li>
            ))}
          </ul>
        </div>
      )}
      {notes && <p className="text-xs">{notes}</p>}
    </div>
  );
}
