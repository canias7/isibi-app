import { cn } from "@/lib/utils";
/**
 * What the state of things was — so the next setup matches.
 *
 * IT IS TIED TO A SCRIPT DAY, NOT A SHOOTING DAY. Scenes from one story day are
 * shot weeks apart, and continuity is only checkable against the story. A note
 * filed by shooting date is a note nobody can find when it matters.
 *
 * WHICH HAND, WHICH SIDE, HOW MUCH LEFT — the detail is the whole value. "He is
 * holding a glass" matches nothing; "half-full, left hand, jacket unbuttoned" is
 * a note an editor can cut on.
 *
 * THE FRAME REFERENCE IS A SHOT AND A TAKE, because the reliable answer to a
 * continuity question is going back to the frame rather than to somebody's
 * memory of it.
 *
 * A KNOWN MISMATCH IS RECORDED AS ONE. Continuity errors happen and are
 * frequently unfixable on the day; the useful act is telling the edit, which is
 * where it will be worked around.
 */
export function ContinuityNote({ scriptDay, scene, character, state, referenceShot, referenceTake, mismatch, className }: {
  /** Which day of the story. */
  scriptDay?: string;
  scene?: string;
  character?: string;
  /** The detail — hand, side, level, condition. */
  state: string;
  referenceShot?: string;
  referenceTake?: number;
  /** A known error, recorded rather than hidden. */
  mismatch?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="text-xs text-muted-foreground">
        {scriptDay ? `Script day ${scriptDay}` : "No script day recorded"}
        {scene && ` · scene ${scene}`}
        {character && ` · ${character}`}
      </p>
      <p>{state}</p>
      <p className="text-xs text-muted-foreground">
        {referenceShot
          ? `Reference: ${referenceShot}${referenceTake !== undefined ? `, take ${referenceTake}` : ""}`
          : "No reference frame — this will be settled from memory, badly."}
      </p>
      {/* Two sentences, two nodes. The caller's note already ends in a full
          stop, so appending one gives "…last Thursday.. Flag it to the edit." */}
      {mismatch && (
        <p className="text-xs font-medium">
          <span className="block">Known mismatch: {mismatch}</span>
          <span className="block">Flag it to the edit.</span>
        </p>
      )}
    </div>
  );
}
