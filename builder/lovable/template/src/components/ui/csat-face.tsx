import * as React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
/**
 * How did we do — five faces, five words.
 *
 * OUTLINE FACES WITH THE WORD UNDER EACH, monochrome. The usual version is
 * five coloured emoji, which fails greyscale, fails print, and reads
 * differently across platforms (one vendor's neutral face is another's
 * disappointment). Drawn strokes mean the five render identically everywhere
 * and the WORD carries the meaning anyway — the face is recognition speed,
 * not the answer.
 *
 * SELECTED IS FILLED (ink face, background strokes) — state by fill, the
 * kit's rule. Nothing pre-selected.
 *
 * A real RadioGroup underneath; each face is a label wrapping an sr-only
 * radio, focus shown by ring on the label.
 */
const FACES = [
  { v: "1", word: "Very unhappy", mouth: "M8 16.5 Q12 12.5 16 16.5" },
  { v: "2", word: "Unhappy", mouth: "M8.5 16 Q12 14.2 15.5 16" },
  { v: "3", word: "Neutral", mouth: "M8.5 15.5 L15.5 15.5" },
  { v: "4", word: "Happy", mouth: "M8.5 15 Q12 17 15.5 15" },
  { v: "5", word: "Very happy", mouth: "M8 14.5 Q12 18.5 16 14.5" },
];

export function CsatFace({ value, onChange, question = "How was it?", className }: {
  value?: string;
  onChange: (v: string) => void;
  question?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-sm font-medium">{question}</p>
      <RadioGroup value={value ?? ""} onValueChange={onChange} className="flex gap-1">
        {FACES.map((f) => {
          const on = value === f.v;
          return (
            <label key={f.v}
              className={cn("flex w-16 cursor-pointer flex-col items-center gap-1 rounded-md p-1.5",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring hover:bg-muted/60")}>
              <RadioGroupItem value={f.v} className="sr-only" />
              <svg viewBox="0 0 24 24" aria-hidden
                className={cn("size-8 rounded-full", on ? "bg-foreground text-background" : "text-foreground")}>
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8.7" cy="9.8" r="1.15" fill="currentColor" />
                <circle cx="15.3" cy="9.8" r="1.15" fill="currentColor" />
                <path d={f.mouth} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className={cn("text-center text-[10px] leading-tight",
                on ? "font-semibold" : "text-muted-foreground")}>
                {f.word}
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
