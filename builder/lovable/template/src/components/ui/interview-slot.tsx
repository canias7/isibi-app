import { cn } from "@/lib/utils";
/**
 * An interview being offered or booked — with what to prepare.
 *
 * WHO WILL BE THERE IS NAMED, AND SO ARE THEIR ROLES. Walking into a room with
 * three unexpected people is a measurable disadvantage, and it costs nothing to
 * prevent. It also lets a candidate say if one of them is a conflict.
 *
 * THE FORMAT IS STATED — a task, a panel, a technical exercise. "Interview" is
 * not a format, and preparing for the wrong one is how a good candidate fails.
 *
 * WHAT TO BRING AND WHERE TO GO ARE PART OF THE SLOT. Photo ID, a building
 * entrance, a video link that needs an account — every one of them turns into a
 * late or missed interview.
 *
 * ADJUSTMENTS ARE ASKED FOR AT BOOKING, in plain words, with the note that they
 * do not affect the decision. Asked only at the end of a form, or not at all,
 * most people who need one do not raise it.
 */
export function InterviewSlot({ round, when, minutes, format, panel = [], where, videoLink, bring = [], adjustmentsNote, className }: {
  /** "First interview", "Final". */
  round?: string;
  /** Free text — "Tuesday 12 August, 10:30". */
  when: string;
  minutes?: number;
  /** "Panel", "Technical exercise", "Informal chat". */
  format?: string;
  /** Who will be there and what they do. */
  panel?: { name: string; role?: string }[];
  where?: string;
  videoLink?: string;
  bring?: string[];
  adjustmentsNote?: string;
  className?: string;
}) {
  return (
    <div data-slot="interview-slot" className={cn("space-y-1 text-sm", className)}>
      <p>
        <span className="font-medium">{round ?? "Interview"}</span>
        <span className="block">{when}{minutes !== undefined ? ` · ${minutes} minutes` : ""}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {format ?? "Format not stated — ask what to expect"}
        {where && ` · ${where}`}
      </p>
      {videoLink && <p className="text-xs">Joining link: {videoLink}</p>}
      {panel.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">You will be meeting</p>
          <ul className="text-xs">
            {panel.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="text-muted-foreground">—</span>
                <span>{p.name}{p.role ? `, ${p.role}` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {bring.length > 0 && <p className="text-xs">Bring {bring.join(", ")}.</p>}
      <p className="text-xs text-muted-foreground">
        {adjustmentsNote ?? "Tell us if you need anything arranged — it has no bearing on the decision."}
      </p>
    </div>
  );
}
