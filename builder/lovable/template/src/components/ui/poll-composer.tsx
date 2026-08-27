import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Make a poll — the half `poll-result` cannot do.
 *
 * NOTHING IN THE KIT CREATES ONE. `poll-result` renders finished votes,
 * `survey-card` frames a question somebody else wrote, and every product
 * with a poll needs the composing end: a question, some options, how long
 * it runs.
 *
 * BLANK OPTIONS ARE DROPPED ON SUBMIT, NOT REFUSED. People clear a row
 * rather than delete it, and refusing the whole poll over an empty third
 * option is a form arguing with the obvious intent.
 *
 * DUPLICATE OPTIONS ARE REFUSED, because two identical choices split the
 * vote between them and quietly make the result meaningless — the one error
 * here worth blocking on.
 *
 * TWO OPTIONS IS THE MINIMUM and the button says why it is disabled rather
 * than sitting grey with no explanation.
 */
export function PollComposer({ onSubmit, maxOptions = 6, className }: {
  onSubmit: (poll: { question: string; options: string[]; days: number }) => void;
  maxOptions?: number;
  className?: string;
}) {
  const [question, setQuestion] = React.useState("");
  const [options, setOptions] = React.useState(["", ""]);
  const [days, setDays] = React.useState(3);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const dupes = filled.filter((o, i) => filled.findIndex((x) => x.toLowerCase() === o.toLowerCase()) !== i);
  const why = !question.trim() ? "Write a question first."
    : filled.length < 2 ? "A poll needs at least two options."
    : dupes.length ? `“${dupes[0]}” is in there twice — that splits the vote.`
    : null;

  return (
    <form data-slot="poll-composer" className={cn("flex max-w-sm flex-col gap-2 rounded-xl border border-border p-3", className)}
      onSubmit={(e) => { e.preventDefault(); if (!why) onSubmit({ question: question.trim(), options: filled, days }); }}>
      <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask something"
        aria-label="Question"
        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <ul className="flex flex-col gap-1">
        {options.map((o, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <input value={o} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`}
              onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            {options.length > 2 ? (
              <button type="button" aria-label={`Remove option ${i + 1}`}
                onClick={() => setOptions(options.filter((_, j) => j !== i))}
                className="cursor-pointer text-muted-foreground hover:text-foreground">×</button>
            ) : null}
          </li>
        ))}
      </ul>
      {options.length < maxOptions ? (
        <button type="button" onClick={() => setOptions([...options, ""])}
          className="cursor-pointer self-start text-xs underline underline-offset-2">Add an option</button>
      ) : null}
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Runs for
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="h-7 cursor-pointer rounded-md border border-input bg-background px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {[1, 3, 7, 14].map((d) => <option key={d} value={d}>{d} day{d === 1 ? "" : "s"}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={!!why}
          className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
          Post the poll
        </button>
        {/* A disabled button that will not say why is the thing people hate. */}
        {why ? <span className="text-[11px] text-muted-foreground">{why}</span> : null}
      </div>
    </form>
  );
}
