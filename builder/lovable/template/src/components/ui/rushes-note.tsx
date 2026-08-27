import { cn } from "@/lib/utils";
/**
 * A note on a viewed take — the selects, and the technical faults.
 *
 * A TECHNICAL FAULT AND A PERFORMANCE NOTE ARE DIFFERENT AUDIENCES. A soft
 * focus or a boom in frame goes to the floor tomorrow and may need a reshoot;
 * "the second reading is better" goes to the edit. Mixing them in one stream
 * means the reshoot decision is buried.
 *
 * A CIRCLED TAKE IS A DIRECTOR'S PREFERENCE, NOT AN INSTRUCTION TO THE EDIT.
 * Editors routinely use uncircled takes, and marking a preference rather than a
 * decision keeps the rest of the material live.
 *
 * SOMETHING NEEDING A RESHOOT IS SURFACED IMMEDIATELY, because the set may be
 * struck tomorrow and the actor gone next week — the cost of a fault doubles
 * every day it stays in a viewing note.
 *
 * WHO WROTE IT IS RECORDED. Rushes notes come from the director, the editor and
 * the DoP and mean different things, and an unattributed note is followed or
 * ignored at random.
 */
export function RushesNote({ shot, take, circled, note, faults = [], needsReshoot, by, className }: {
  shot?: string;
  take?: number;
  /** The director's preferred take. */
  circled?: boolean;
  note?: string;
  /** Technical problems — soft, boom in shot, flare. */
  faults?: string[];
  needsReshoot?: boolean;
  by?: string;
  className?: string;
}) {
  return (
    <li data-slot="rushes-note" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1 font-mono text-xs text-muted-foreground">
          {shot}
          {take !== undefined && ` take ${take}`}
        </span>
        {circled && <span className="shrink-0 text-xs">Preferred take</span>}
      </p>
      {note && <p>{note}</p>}
      {/* A list, not a comma-joined sentence — each fault is written as its own
          sentence by whoever logged it, so joining them gives "…halfway point,
          Boom dips into frame." */}
      {faults.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs font-medium">Technical</p>
          <ul className="text-xs font-medium">
            {faults.map((f, i) => (
              <li key={i} className="flex gap-2"><span aria-hidden="true" className="font-normal text-muted-foreground">—</span><span>{f}</span></li>
            ))}
          </ul>
        </div>
      )}
      {needsReshoot && (
        <p className="text-xs font-medium">
          Needs reshooting — raise it today, while the set is still standing.
        </p>
      )}
      {by && <p className="text-xs text-muted-foreground">{by}</p>}
      {circled && (
        <p className="text-xs text-muted-foreground">
          A preference, not an instruction — the edit may well use another take.
        </p>
      )}
    </li>
  );
}
