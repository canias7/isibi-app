import { cn } from "@/lib/utils";
/**
 * A transcript that can be corrected, with the uncertain words marked.
 *
 * LOW-CONFIDENCE WORDS ARE MARKED, which is what makes a transcript usable
 * rather than merely present. Speech recognition is confidently wrong about
 * names, postcodes and numbers — exactly the parts somebody is transcribing FOR
 * — and a flat wall of text gives no clue which words to check.
 *
 * IT IS EDITABLE, because the recogniser will be wrong and the person who
 * spoke is the only one who can fix it. A read-only transcript makes people
 * re-record the whole thing to change one word.
 *
 * THE PARTIAL RESULT IS SHOWN SEPARATELY from what has settled. Live
 * recognition rewrites its last few words constantly, and text that changes
 * under the cursor while somebody is reading is genuinely disorienting.
 *
 * MARKED WITH A DOTTED UNDERLINE, NOT A COLOUR, and the confidence is in the
 * `title` — the same treatment `missing-translation` uses, and for the same
 * reason.
 */
export type TranscriptWord = { text: string; uncertain?: boolean };

export function VoiceTranscript({ words, partial, onEdit, editing, className }: {
  /** Settled words. */
  words: TranscriptWord[];
  /** The tail still being recognised. */
  partial?: string;
  /** Called with the whole corrected text. */
  onEdit?: (text: string) => void;
  editing?: boolean;
  className?: string;
}) {
  const full = words.map((w) => w.text).join(" ");
  const unsure = words.filter((w) => w.uncertain).length;
  if (editing && onEdit) {
    return (
      <div className={cn("space-y-1", className)}>
        <textarea rows={4} defaultValue={full} aria-label="Transcript"
          onChange={(e) => onEdit(e.target.value)}
          className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm" />
      </div>
    );
  }
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-sm">
        {words.map((w, i) => (
          <span key={i} title={w.uncertain ? "Not sure about this word" : undefined}
            className={cn(w.uncertain && "underline decoration-dotted decoration-from-font underline-offset-4")}>
            {w.text}{i < words.length - 1 ? " " : ""}
          </span>
        ))}
        {partial && <span className="text-muted-foreground"> {partial}…</span>}
      </p>
      <p className="text-xs text-muted-foreground">
        {unsure > 0
          ? `${unsure} ${unsure === 1 ? "word is" : "words are"} underlined because we are not sure of them — check names and numbers.`
          : "Check anything that matters before relying on it."}
      </p>
    </div>
  );
}
