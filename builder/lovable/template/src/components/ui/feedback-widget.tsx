import * as React from "react";
import { BusyButton } from "@/components/ui/busy-button";
import { TextareaCount } from "@/components/ui/textarea-count";
import { Button } from "@/components/ui/button";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Was this helpful?"
 *
 * Only asks for words after a NO. Asking everyone for a comment gets very few;
 * asking the person who just said it did not help gets the useful ones.
 */
export function FeedbackWidget({ question = "Was this helpful?", onSubmit, busy, className }: {
  question?: string; onSubmit: (v: { helpful: boolean; comment?: string }) => void;
  busy?: boolean; className?: string;
}) {
  const [helpful, setHelpful] = React.useState<boolean | null>(null);
  const [comment, setComment] = React.useState("");
  const [done, setDone] = React.useState(false);
  if (done) return <p data-slot="feedback-widget" className={cn("text-sm text-muted-foreground", className)}>Thanks — that helps.</p>;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-3">
        <span className="text-sm">{question}</span>
        <Button type="button" size="sm" variant={helpful === true ? "secondary" : "outline"}
          onClick={() => { setHelpful(true); onSubmit({ helpful: true }); setDone(true); }}>
          <ThumbsUp className="size-4" /> Yes
        </Button>
        <Button type="button" size="sm" variant={helpful === false ? "secondary" : "outline"}
          onClick={() => setHelpful(false)}><ThumbsDown className="size-4" /> No</Button>
      </div>
      {helpful === false && (
        <div className="flex flex-col gap-2">
          <TextareaCount value={comment} onChange={setComment} max={300} rows={3}
            placeholder="What were you looking for?" />
          <BusyButton size="sm" busy={busy} className="w-fit"
            onClick={() => { onSubmit({ helpful: false, comment }); setDone(true); }}>Send</BusyButton>
        </div>
      )}
    </div>
  );
}
