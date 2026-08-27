import { cn } from "@/lib/utils";
/**
 * The plain-text half of an email, with what it loses made obvious.
 *
 * EVERY EMAIL NEEDS ONE AND MOST DO NOT HAVE IT. A message with no text/plain
 * part scores worse with spam filters, is unreadable on a watch or a text-only
 * client, and shows nothing at all where images are blocked — which is a
 * default in plenty of workplaces.
 *
 * LINKS BECOME VISIBLE URLS, because "click here" is meaningless without the
 * anchor. The plain part must carry the destination in the text, and generating
 * it by stripping tags loses exactly that.
 *
 * IT COUNTS WHAT WAS DROPPED. Images, buttons and tables have no plain-text
 * equivalent, so a generated fallback usually loses the call to action
 * entirely — and nobody notices until somebody replies asking where the link
 * is.
 *
 * IT IS EDITABLE. An auto-generated plain part is a starting point, not an
 * output — the same relationship `ai-suggestion` has with its text.
 */
export function PlainTextFallback({ text, onChange, droppedImages = 0, droppedButtons = 0, hasLinks, className }: {
  text: string;
  onChange?: (v: string) => void;
  droppedImages?: number;
  droppedButtons?: number;
  /** Whether the plain text contains visible URLs. */
  hasLinks?: boolean;
  className?: string;
}) {
  const dropped = droppedImages + droppedButtons;
  return (
    <div data-slot="plain-text-fallback" className={cn("space-y-1", className)}>
      {onChange ? (
        <textarea rows={6} value={text} aria-label="Plain text version"
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 font-mono text-xs" />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-muted/30 p-2.5">
          <pre className="whitespace-pre-wrap font-mono text-xs">{text}</pre>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {dropped > 0 && (
          <span className="block">
            {droppedButtons > 0 && (
              <span className="text-foreground">
                {droppedButtons} {droppedButtons === 1 ? "button has" : "buttons have"} no plain-text equivalent —
                write the link out.{" "}
              </span>
            )}
            {droppedImages > 0 && <span>{droppedImages} {droppedImages === 1 ? "image" : "images"} dropped. </span>}
          </span>
        )}
        {hasLinks === false && (
          <span className="block text-foreground">There are no visible web addresses here — nobody can follow anything.</span>
        )}
        <span className="block">
          This is what people see on a watch, in a text-only client, and wherever images are blocked.
        </span>
      </p>
    </div>
  );
}
