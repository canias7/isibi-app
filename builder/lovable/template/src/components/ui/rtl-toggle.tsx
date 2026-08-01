import { cn } from "@/lib/utils";
/**
 * Flipping the page to right-to-left, to see what breaks.
 *
 * IT SETS `dir` ON `<html>`, WHICH IS THE ONLY HONEST TEST. Flipping a preview
 * pane leaves the surrounding layout untouched, so the bugs that matter —
 * absolutely positioned elements, hard-coded `left`, margins that should mirror
 * — are exactly the ones a scoped preview hides.
 *
 * IT IS A DEVELOPER TOOL AND SAYS SO. Real RTL follows the locale, not a
 * switch; a product shipping this to customers has confused "preview the
 * layout" with "choose a language", and the note keeps them apart.
 *
 * IT RESTORES THE ORIGINAL DIRECTION ON UNMOUNT, or navigating away from the
 * settings page leaves the whole application mirrored with no visible cause.
 *
 * `aria-pressed` on a real button, so its state is announced — and a pressed
 * toggle changing the document direction is exactly the kind of global change
 * that needs to be discoverable.
 */
export function RtlToggle({ rtl, onChange, note = "For checking the layout. Real direction follows the language.", className }: {
  rtl: boolean;
  onChange: (v: boolean) => void;
  note?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <button type="button" aria-pressed={rtl}
        onClick={() => {
          const next = !rtl;
          if (typeof document !== "undefined") document.documentElement.dir = next ? "rtl" : "ltr";
          onChange(next);
        }}
        className={cn("rounded-md border px-3 py-1.5 text-sm",
          rtl ? "border-foreground bg-foreground text-background" : "border-border")}>
        Right to left {rtl ? "on" : "off"}
      </button>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
