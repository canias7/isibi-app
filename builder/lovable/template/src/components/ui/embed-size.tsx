import { useId } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Choosing an embed's size, with the responsive option explained.
 *
 * A FIXED HEIGHT IS THE PROBLEM WITH EVERY EMBED. Content grows — a booking
 * form with a validation message, a list with one more row — and a fixed frame
 * either scrolls internally, which is horrible on a phone, or clips. Offering
 * "grows to fit" and saying what it needs is the whole component.
 *
 * IT SAYS THAT AUTO-HEIGHT NEEDS THE SNIPPET'S SCRIPT. That is the trade —
 * resizing across origins requires a message from inside the frame — and
 * somebody who copies only the iframe tag gets a frame stuck at its initial
 * height with no idea why.
 *
 * WIDTH IS ALWAYS FLUID AND IT SAYS SO. A fixed-width embed is what produces a
 * horizontal scrollbar on somebody's phone, and it is never what anybody
 * actually wants.
 *
 * A NATIVE `<select>` plus a number, rather than a slider — an embed height is
 * a specific value somebody wants to match against their page.
 */
export function EmbedSize({ mode, onModeChange, height, onHeightChange, minHeight = 200, className }: {
  mode: "auto" | "fixed";
  onModeChange: (m: "auto" | "fixed") => void;
  height: number;
  onHeightChange: (h: number) => void;
  minHeight?: number;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = useId();
  return (
    <div data-slot="embed-size" className={cn("space-y-2", className)}>
      <div className="space-y-1">
        <label htmlFor={uid + "-es-mode"} className="block text-sm font-medium">Height</label>
        <NativeSelect id={uid + "-es-mode"} value={mode} className="w-auto"
          onChange={(e) => onModeChange(e.target.value as "auto" | "fixed")}>
          <option value="auto">Grows to fit the content</option>
          <option value="fixed">A fixed height</option>
        </NativeSelect>
      </div>
      {mode === "fixed" && (
        <div className="space-y-1">
          <label htmlFor={uid + "-es-height"} className="block text-sm font-medium">Pixels</label>
          <input id={uid + "-es-height"} type="number" inputMode="numeric" min={minHeight} value={height}
            onChange={(e) => onHeightChange(Number(e.target.value))}
            className="h-9 w-28 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
          <p className="text-xs text-muted-foreground">
            Taller content will scroll inside the frame, which is awkward on a phone.
          </p>
        </div>
      )}
      {mode === "auto" && (
        <p className="text-xs text-muted-foreground">
          This needs the script in the snippet — with only the iframe tag it stays at its starting height.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        The width always fills whatever space you give it.
      </p>
    </div>
  );
}
