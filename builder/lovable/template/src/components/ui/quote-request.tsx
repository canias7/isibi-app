import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
/**
 * The intake form a trade actually uses: describe the job, attach photographs.
 *
 * PHOTOGRAPHS ARE THE POINT, not a nicety. A plumber quoting a leak from prose
 * either quotes wrong or drives out to look; a picture of the pipe collapses
 * that into one message. So the attach control is the second field, not buried
 * at the bottom under "anything else?".
 *
 * URGENCY IS ASKED, because it changes the answer rather than the price. "Water
 * is coming through the ceiling" and "sometime next month" want different
 * replies, and a trade that cannot tell them apart answers both late.
 *
 * It reports FILE NAMES and never uploads: a page uploads through
 * `useUploadFile` and submits the returned URLs as ordinary text, which is the
 * one write path the data API has. A component that invented its own would be a
 * second, untested one.
 */
export type QuoteFiles = { name: string; size: number }[];
export function QuoteRequest({
  trades, onSubmit, sent, urgencies = ["Emergency — today", "This week", "No rush"], className,
}: {
  /** What you do, as the job-type choices. */
  trades: string[];
  onSubmit?: (v: { trade: string; urgency: string; detail: string; files: QuoteFiles }) => void;
  sent?: boolean;
  urgencies?: string[];
  className?: string;
}) {
  const [trade, setTrade] = React.useState(trades[0] ?? "");
  const [urgency, setUrgency] = React.useState(urgencies[0] ?? "");
  const [detail, setDetail] = React.useState("");
  const [files, setFiles] = React.useState<QuoteFiles>([]);
  const id = React.useId();
  if (sent) {
    return (
      <div data-slot="quote-request" className={cn("rounded-lg border border-border bg-muted/40 p-5", className)} role="status">
        <p className="font-medium">That's with us.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We answer quotes in the order they arrive, and emergencies first. If it's water coming in,
          ring rather than wait for this.
        </p>
      </div>
    );
  }
  return (
    <form
      className={cn("space-y-5", className)}
      onSubmit={(e) => { e.preventDefault(); onSubmit?.({ trade, urgency, detail, files }); }}
    >
      <fieldset>
        <legend className="text-sm font-medium">What's the job?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {trades.map((t) => (
            <label key={t} className={cn(
              "cursor-pointer rounded-full border px-3 py-1.5 text-sm",
              t === trade ? "border-foreground bg-foreground text-background" : "border-border",
            )}>
              <input type="radio" name={`${id}-trade`} className="sr-only" checked={t === trade}
                onChange={() => setTrade(t)} />
              {t}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-photos`}>Photographs</Label>
        <input id={`${id}-photos`} type="file" accept="image/*" multiple
          className="block w-full text-sm file:me-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).map((f) => ({ name: f.name, size: f.size })))} />
        <p className="text-xs text-muted-foreground">
          {files.length
            ? `${files.length} attached — ${files.map((f) => f.name).join(", ")}`
            : "A picture of the problem gets you a real number instead of a range."}
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">How soon?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {urgencies.map((u) => (
            <label key={u} className={cn(
              "cursor-pointer rounded-md border px-3 py-1.5 text-sm",
              u === urgency ? "border-foreground font-medium" : "border-border text-muted-foreground",
            )}>
              <input type="radio" name={`${id}-urgency`} className="sr-only" checked={u === urgency}
                onChange={() => setUrgency(u)} />
              {u}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-detail`}>Tell us what's happening</Label>
        <Textarea id={`${id}-detail`} rows={4} value={detail} onChange={(e) => setDetail(e.target.value)}
          placeholder="Where it is, how long it's been like that, anything you've already tried." />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-contact`}>Phone or email</Label>
        <Input id={`${id}-contact`} name="contact" autoComplete="tel" inputMode="tel" required
          placeholder="However you'd rather be reached" />
      </div>

      <Button type="submit">Send the job</Button>
    </form>
  );
}
