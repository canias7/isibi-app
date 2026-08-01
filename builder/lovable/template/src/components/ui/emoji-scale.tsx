import { cn } from "@/lib/utils";
/**
 * A satisfaction scale where every point carries a word, not just a face.
 *
 * THE WORDS ARE THE SCALE AND THE FACES DECORATE IT. A row of five emoji is
 * genuinely ambiguous — the middle two are read as different degrees of the
 * same thing by different people, they render differently on every platform,
 * and they are meaningless to anybody using a screen reader. Labelling each
 * point makes the answers comparable, which is the entire purpose of a scale.
 *
 * ODD NUMBER OF POINTS BY DEFAULT, because a neutral answer is a real one.
 * Forcing a lean produces data that looks decisive and is not — people who felt
 * nothing pick at random.
 *
 * A REAL RADIO GROUP, so arrow keys move between points and the current answer
 * is announced as "3 of 5". A row of buttons announces five unrelated buttons
 * and gives no sense of a scale at all.
 *
 * THE EMOJI ARE `aria-hidden`, since "slightly smiling face" read aloud beside
 * "Good" is noise, and the word is already there.
 */
export type ScalePoint = { value: number; label: string; face?: string };

const DEFAULT_POINTS: ScalePoint[] = [
  { value: 1, label: "Bad", face: "🙁" },
  { value: 2, label: "Poor", face: "😕" },
  { value: 3, label: "Okay", face: "😐" },
  { value: 4, label: "Good", face: "🙂" },
  { value: 5, label: "Great", face: "😃" },
];

export function EmojiScale({ value, onChange, points = DEFAULT_POINTS, question, name = "emoji-scale", className }: {
  value: number | null;
  onChange: (v: number) => void;
  points?: ScalePoint[];
  question?: string;
  name?: string;
  className?: string;
}) {
  return (
    <fieldset className={cn("space-y-1.5", className)}>
      {question && <legend className="mb-1 text-sm font-medium">{question}</legend>}
      <div className="flex flex-wrap gap-1.5">
        {points.map((p) => (
          <label key={p.value}
            className={cn("flex cursor-pointer flex-col items-center gap-0.5 rounded-md border px-2.5 py-1.5",
              value === p.value ? "border-foreground bg-muted/40" : "border-border")}>
            <input type="radio" name={name} value={p.value} checked={value === p.value}
              onChange={() => onChange(p.value)} className="sr-only" />
            {p.face && <span aria-hidden="true" className="text-lg leading-none">{p.face}</span>}
            <span className={cn("text-xs", value === p.value && "font-medium")}>{p.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
