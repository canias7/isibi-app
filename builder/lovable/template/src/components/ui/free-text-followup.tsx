import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * The "tell us more" box, asked only of the people worth asking.
 *
 * IT ONLY APPEARS FOR THE ANSWERS THAT NEED EXPLAINING. Asking everybody for a
 * comment gets a handful of empty boxes and trains people to skip the question;
 * asking the person who just said it was bad — or unusually good — gets the
 * comments that are actually worth reading. `askFor` is the caller's list of
 * scores that trigger it.
 *
 * THE QUESTION CHANGES WITH THE ANSWER. "What went wrong?" after a low score
 * and "What did we get right?" after a high one are different questions, and a
 * single "any comments?" gets a worse answer to both.
 *
 * IT IS SKIPPABLE AND SAYS SO. A required comment box on an optional survey is
 * where people close the tab, and the score has already been recorded — losing
 * it because somebody would not type is the worst possible trade.
 *
 * NO CHARACTER MINIMUM. Requiring 20 characters produces "aaaaaaaaaaaaaaaaaaaa"
 * far more often than it produces a considered sentence.
 */
export function FreeTextFollowup({ score, askFor, prompts, onSubmit, onSkip, placeholder, busy, className }: {
  /** The answer just given. */
  score: number | null;
  /** Scores that get asked. */
  askFor: number[];
  /** Question per score. Falls back to a generic one. */
  prompts?: Record<number, string>;
  onSubmit: (text: string) => void;
  onSkip?: () => void;
  placeholder?: string;
  busy?: boolean;
  className?: string;
}) {
  const [text, setText] = useState("");
  if (score === null || !askFor.includes(score)) return null;
  const question = prompts?.[score] ?? "Would you tell us a bit more?";
  return (
    <form className={cn("space-y-2", className)}
      onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSubmit(text.trim()); }}>
      <label htmlFor="ftf" className="block text-sm font-medium">{question}</label>
      <textarea id="ftf" rows={3} value={text} placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm" />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={!text.trim() || busy}>Send</Button>
        {onSkip && (
          <button type="button" onClick={onSkip} className="text-xs underline underline-offset-2">
            Skip this
          </button>
        )}
      </div>
    </form>
  );
}
