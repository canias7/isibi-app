import { cn } from "@/lib/utils";
/**
 * The browser filled something in that disagrees with what is saved.
 *
 * TWO PLAUSIBLE VALUES AND NO WAY TO TELL WHICH IS CURRENT is a genuinely
 * confusing moment, and it happens constantly on address and card fields. This
 * shows both and makes the reader choose, which is the only honest resolution.
 *
 * NEITHER IS PRESELECTED. Picking one for them means the wrong address is used
 * by whoever presses submit without reading — the same reasoning as
 * `conflict-choice`.
 *
 * The two values are LABELLED BY SOURCE, not left as two strings. "From your
 * browser" and "From your account" is what makes the choice answerable.
 */
export function AutofillConflict({ field, browserValue, savedValue, onUse, className }: {
  field: string;
  browserValue: string;
  savedValue: string;
  onUse: (which: "browser" | "saved") => void;
  className?: string;
}) {
  return (
    <div data-slot="autofill-conflict" role="status" className={cn("flex flex-col gap-1.5 rounded-md border border-border p-2 text-xs", className)}>
      <p className="font-medium">Two versions of {field}</p>
      <div className="flex flex-col gap-1">
        <button type="button" onClick={() => onUse("browser")}
          className="cursor-pointer rounded border border-border px-2 py-1 text-start hover:bg-muted">
          <span className="block text-muted-foreground">From your browser</span>
          <span className="block">{browserValue}</span>
        </button>
        <button type="button" onClick={() => onUse("saved")}
          className="cursor-pointer rounded border border-border px-2 py-1 text-start hover:bg-muted">
          <span className="block text-muted-foreground">From your account</span>
          <span className="block">{savedValue}</span>
        </button>
      </div>
    </div>
  );
}
